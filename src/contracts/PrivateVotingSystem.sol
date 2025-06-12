// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PrivateVotingSystem
 * @dev Specialized voting system for private/whitelist-only polls with meta-transaction support
 */
contract PrivateVotingSystem is EIP712, ReentrancyGuard, Pausable, AccessControl {
    using ECDSA for bytes32;

    // Bitmap for storing votes (extremely gas efficient)
    mapping(uint256 => mapping(uint256 => uint256)) private voteMap;
    
    // Poll data structure (packed for gas savings)
    struct Poll {
        string title;
        address creator;
        uint64 endTime;
        uint16 candidateCount;
        uint64 voterCount;
        uint64 maxVoters;
        address whitelistSigner; // Address authorized to sign whitelist approvals
    }
    
    struct Candidate {
        string name;
        uint64 voteCount;
    }

    // Default relayer wallet & registry
    address public defaultRelayerWallet;
    mapping(address => bool) public authorizedRelayers;
    // relayer allowances: creator => relayer (or zero‐address) => amount
    mapping(address => mapping(address => uint256)) public relayerAllowance;

    // Poll and candidate storage
    Poll[] public polls;
    mapping(uint256 => mapping(uint16 => Candidate)) public candidates;

    // EIP‑712 typehash for Vote and WhitelistApproval
    bytes32 private constant VOTE_TYPEHASH =
        keccak256("Vote(uint256 pollId,uint16 candidateId,address voter)");
    bytes32 private constant WHITELIST_APPROVAL_TYPEHASH =
        keccak256("WhitelistApproval(uint256 pollId,address voter,uint256 expiry)");

    event PollCreated(uint256 indexed pollId, address indexed creator);
    event Voted(uint256 indexed pollId, address indexed voter);
    event RelayerAdded(address indexed relayer, bool status);
    event DefaultRelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event FundsDeposited(address indexed depositor, uint256 amount);
    event FundsWithdrawn(address indexed withdrawer, uint256 amount);
    event PollCancelled(uint256 indexed pollId);

    bool public emergencyOverrideActive = false;

    // Add roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    
    // Add poll state tracking
    mapping(uint256 => bool) public cancelledPolls;

    constructor(address _defaultRelayerWallet)
        EIP712("PrivateVotingSystem", "1")
    {
        require(_defaultRelayerWallet != address(0), "Invalid relayer");
        defaultRelayerWallet = _defaultRelayerWallet;
        authorizedRelayers[_defaultRelayerWallet] = true;
        emit RelayerAdded(_defaultRelayerWallet, true);
        emit DefaultRelayerUpdated(address(0), _defaultRelayerWallet);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, _defaultRelayerWallet);
    }

    /// @notice Create a new private poll
    function createPoll(
        string calldata _title,
        string[] calldata _candidateNames,
        uint24 _durationHours,
        uint64 _maxVoters,
        address _whitelistSigner
    ) external payable {
        require(_candidateNames.length > 0 && _candidateNames.length <= 100, "Invalid candidates");
        require(_whitelistSigner != address(0), "Invalid whitelist signer");

        uint256 pollId = polls.length;
        polls.push(Poll({
            title: _title,
            creator: msg.sender,
            endTime: uint64(block.timestamp + _durationHours * 1 hours),
            candidateCount: uint16(_candidateNames.length),
            voterCount: 0,
            maxVoters: _maxVoters,
            whitelistSigner: _whitelistSigner
        }));

        for (uint16 i = 0; i < _candidateNames.length; i++) {
            candidates[pollId][i] = Candidate({ name: _candidateNames[i], voteCount: 0 });
        }

        if (msg.value > 0) {
            relayerAllowance[msg.sender][address(0)] += msg.value;
        }

        emit PollCreated(pollId, msg.sender);
    }

    /// @notice Vote in a private poll with whitelist approval signature
    function vote(
        uint256 _pollId,
        uint16 _candidateId,
        uint256 _expiry,
        bytes calldata _whitelistSignature
    ) external {
        // Verify whitelist approval signature
        require(_verifyWhitelistApproval(_pollId, msg.sender, _expiry, _whitelistSignature), "Not whitelisted");
        require(block.timestamp <= _expiry, "Whitelist approval expired");
        
        // Process the vote
        _processVote(_pollId, _candidateId, msg.sender);
        
        // Reimburse voter's gas from creator's funds
        Poll storage p = polls[_pollId];
        uint256 genPool = relayerAllowance[p.creator][address(0)];
        require(genPool > 0, "Insufficient creator funds");
        
        // Reimburse fixed 30k gas × gasprice
        uint256 reimbursement = 30000 * tx.gasprice;
        require(genPool >= reimbursement, "Insufficient creator funds");
        relayerAllowance[p.creator][address(0)] -= reimbursement;
        payable(msg.sender).transfer(reimbursement);
    }

    /**
     * @notice Meta‑transaction vote with whitelist approval
     * @param _pollId Poll to vote in
     * @param _candidateId Candidate index
     * @param _voter The voter's address
     * @param _expiry Expiry timestamp for whitelist approval
     * @param _whitelistSignature Signature from whitelist signer
     * @param _voteSignature EIP‑712 signature from voter
     */
    function metaVote(
        uint256 _pollId,
        uint16 _candidateId,
        address _voter,
        uint256 _expiry,
        bytes calldata _whitelistSignature,
        bytes calldata _voteSignature
    ) external {
        require(authorizedRelayers[msg.sender], "Relayer not authorized");
        Poll storage p = polls[_pollId];

        // Verify whitelist approval signature
        require(_verifyWhitelistApproval(_pollId, _voter, _expiry, _whitelistSignature), "Not whitelisted");
        require(block.timestamp <= _expiry, "Whitelist approval expired");

        // Verify vote signature via EIP‐712
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(
                VOTE_TYPEHASH,
                _pollId,
                _candidateId,
                _voter
            ))
        );
        require(ECDSA.recover(digest, _voteSignature) == _voter, "Bad vote signature");

        // Check relayer funds
        uint256 genPool = relayerAllowance[p.creator][address(0)];
        uint256 relPool = relayerAllowance[p.creator][msg.sender];
        require(genPool + relPool > 0, "Insufficient relayer funds");

        // Process vote
        _processVote(_pollId, _candidateId, _voter);

        // Reimburse relayer: fixed 30k gas × gasprice
        uint256 reimbursement = 30000 * tx.gasprice;
        if (relPool >= reimbursement) {
            relayerAllowance[p.creator][msg.sender] -= reimbursement;
        } else {
            // use general pool
            relayerAllowance[p.creator][address(0)] -= reimbursement;
        }
        payable(msg.sender).transfer(reimbursement);
    }

    function setEmergencyOverride(bool _active) external {
        require(msg.sender == defaultRelayerWallet, "Not authorized");
        emergencyOverrideActive = _active;
    }

    // ——— Internal Helpers ———

    function _processVote(uint256 _pollId, uint16 _candidateId, address _voter) internal {
        require(_pollId < polls.length, "Bad poll");
        require(!cancelledPolls[_pollId], "Poll cancelled");
        Poll storage p = polls[_pollId];
        require(block.timestamp <= p.endTime, "Poll ended");
        require(_candidateId < p.candidateCount, "Bad candidate");
        require(p.voterCount < p.maxVoters, "Max voters reached");

        // Bitmap check
        uint256 word = uint256(uint160(_voter)) >> 8;      // /256
        uint256 bit  = uint256(uint160(_voter)) & 0xff;    // %256
        uint256 mask = 1 << bit;
        require((voteMap[_pollId][word] & mask) == 0, "Already voted");

        // Record
        voteMap[_pollId][word] |= mask;
        candidates[_pollId][_candidateId].voteCount++;
        p.voterCount++;

        emit Voted(_pollId, _voter);
    }

    function _verifyWhitelistApproval(
        uint256 _pollId,
        address _voter,
        uint256 _expiry,
        bytes calldata _signature
    ) internal view returns (bool) {
        // Emergency override bypasses whitelist verification
        if (emergencyOverrideActive) {
            return true;
        }
        
        Poll storage p = polls[_pollId];
        
        // Create the whitelist approval digest
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(
                WHITELIST_APPROVAL_TYPEHASH,
                _pollId,
                _voter,
                _expiry
            ))
        );
        
        // Verify the signature is from the poll's whitelist signer
        return ECDSA.recover(digest, _signature) == p.whitelistSigner;
    }

    // ——— Read‑only Views ———

    function getPollDetails(uint256 _pollId) external view returns (
        string memory title,
        address creator,
        uint64 endTime,
        uint16 candidateCount,
        uint64 voterCount,
        uint64 maxVoters,
        address whitelistSigner
    ) {
        require(_pollId < polls.length, "Bad poll");
        Poll storage p = polls[_pollId];
        return (p.title, p.creator, p.endTime, p.candidateCount, p.voterCount, p.maxVoters, p.whitelistSigner);
    }

    function getCandidate(uint256 _pollId, uint16 _candidateId)
        external view returns (string memory name, uint64 voteCount)
    {
        require(_pollId < polls.length, "Bad poll");
        require(_candidateId < polls[_pollId].candidateCount, "Bad candidate");
        Candidate storage c = candidates[_pollId][_candidateId];
        return (c.name, c.voteCount);
    }

    function hasVoted(uint256 _pollId, address _voter) external view returns (bool) {
        uint256 word = uint256(uint160(_voter)) >> 8;
        uint256 bit  = uint256(uint160(_voter)) & 0xff;
        return (voteMap[_pollId][word] & (1 << bit)) != 0;
    }

    function getPollsCount() external view returns (uint256) {
        return polls.length;
    }

    /// @notice Deposit funds for relayer reimbursements
    function depositFunds() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Send MATIC");
        relayerAllowance[msg.sender][address(0)] += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }

    /// @notice Allocate some of your general pool to a specific relayer
    function setRelayerAllowance(address _relayer, uint256 _amount) external {
        require(_relayer != address(0), "Invalid relayer");
        require(authorizedRelayers[_relayer], "Not authorized relayer");
        require(relayerAllowance[msg.sender][address(0)] >= _amount, "Insufficient funds");
        relayerAllowance[msg.sender][address(0)] -= _amount;
        relayerAllowance[msg.sender][_relayer] += _amount;
    }

    /// @notice Withdraw unused funds
    function withdrawFunds(uint256 _amount) external nonReentrant {
        require(relayerAllowance[msg.sender][address(0)] >= _amount, "Insufficient funds");
        relayerAllowance[msg.sender][address(0)] -= _amount;
        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        require(success, "Transfer failed");
        emit FundsWithdrawn(msg.sender, _amount);
    }

    /// @notice Authorize or revoke a relayer (only default relayer)
    function setRelayerStatus(address _relayer, bool _status) external {
        require(msg.sender == defaultRelayerWallet, "Not default relayer");
        require(_relayer != address(0) && _relayer != defaultRelayerWallet, "Bad relayer");
        authorizedRelayers[_relayer] = _status;
        emit RelayerAdded(_relayer, _status);
    }

    /// @notice Change the default relayer (only current default)
    function updateDefaultRelayer(address _newDefault) external {
        require(msg.sender == defaultRelayerWallet, "Not default relayer");
        require(_newDefault != address(0) && _newDefault != defaultRelayerWallet, "Invalid new");
        address old = defaultRelayerWallet;
        defaultRelayerWallet = _newDefault;
        authorizedRelayers[_newDefault] = true;
        emit DefaultRelayerUpdated(old, _newDefault);
    }

    function isAuthorizedRelayer(address _r) external view returns (bool) {
        return authorizedRelayers[_r];
    }

    // Add emergency pause functions
    function emergencyPause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function emergencyUnpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // Add poll cancellation function
    function cancelPoll(uint256 _pollId) external {
        require(_pollId < polls.length, "Bad poll");
        Poll storage p = polls[_pollId];
        require(p.creator == msg.sender, "Not poll creator");
        require(p.voterCount == 0, "Voting already started");
        require(!cancelledPolls[_pollId], "Already cancelled");
        
        cancelledPolls[_pollId] = true;
        emit PollCancelled(_pollId);
    }
} 