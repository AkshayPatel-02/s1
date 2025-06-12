import { ethers } from 'ethers';
import { PUBLIC_VOTING_CONTRACT, PRIVATE_VOTING_CONTRACT } from './config.js';
import { wallet } from './wallet.js';

// Contract ABIs
const PUBLIC_VOTING_ABI = [
  // Poll creation and management
  "function createPoll(string calldata _title, string[] calldata _candidateNames, uint24 _durationHours, uint64 _maxVoters) external payable",
  "function cancelPoll(uint256 _pollId) external",
  
  // Voting functions
  "function vote(uint256 _pollId, uint16 _candidateId) external",
  "function metaVote(uint256 _pollId, uint16 _candidateId, address _voter, bytes calldata _signature) external",
  
  // Poll data retrieval
  "function polls(uint256) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, uint64 voterCount, uint64 maxVoters)",
  "function getPollDetails(uint256 _pollId) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, uint64 voterCount, uint64 maxVoters)",
  "function getCandidate(uint256 _pollId, uint16 _candidateId) external view returns (string memory name, uint64 voteCount)",
  "function hasVoted(uint256 _pollId, address _voter) external view returns (bool)",
  "function getPollCount() external view returns (uint256)",
  "function cancelledPolls(uint256) external view returns (bool)",
  
  // Fund management
  "function depositFunds() external payable",
  "function withdrawFunds(uint256 _amount) external nonReentrant",
  "function relayerAllowance(address,address) external view returns (uint256)",
  "function setRelayerAllowance(address _relayer, uint256 _amount) external",
  
  // Relayer management
  "function authorizedRelayers(address) external view returns (bool)",
  "function isAuthorizedRelayer(address _r) external view returns (bool)",
  "function defaultRelayerWallet() external view returns (address)",
  "function setRelayerStatus(address _relayer, bool _status) external",
  "function updateDefaultRelayer(address _newDefault) external",
  
  // Emergency functions
  "function emergencyPause() external onlyRole(ADMIN_ROLE)",
  "function emergencyUnpause() external onlyRole(ADMIN_ROLE)"
];

const PRIVATE_VOTING_ABI = [
  // Poll creation and management
  "function createPoll(string calldata _title, string[] calldata _candidateNames, uint24 _durationHours, uint64 _maxVoters, address _whitelistSigner) external payable",
  
  // Voting functions
  "function vote(uint256 _pollId, uint16 _candidateId, uint256 _expiry, bytes calldata _whitelistSignature) external",
  "function metaVote(uint256 _pollId, uint16 _candidateId, address _voter, uint256 _expiry, bytes calldata _whitelistSignature, bytes calldata _voteSignature) external",
  
  // Poll data retrieval
  "function polls(uint256) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, uint64 voterCount, uint64 maxVoters, address whitelistSigner)",
  "function getPollDetails(uint256 _pollId) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, uint64 voterCount, uint64 maxVoters)",
  "function getCandidate(uint256 _pollId, uint16 _candidateId) external view returns (string memory name, uint64 voteCount)",
  "function hasVoted(uint256 _pollId, address _voter) external view returns (bool)",
  "function getPollsCount() external view returns (uint256)",
  
  // Fund management
  "function depositFunds() external payable",
  "function withdrawFunds(uint256 _amount) external",
  "function relayerAllowance(address,address) external view returns (uint256)",
  "function setRelayerAllowance(address _relayer, uint256 _amount) external",
  
  // Relayer management
  "function authorizedRelayers(address) external view returns (bool)",
  "function isAuthorizedRelayer(address _r) external view returns (bool)",
  "function defaultRelayerWallet() external view returns (address)",
  "function setRelayerStatus(address _relayer, bool _status) external",
  "function updateDefaultRelayer(address _newDefault) external",
  
  // Emergency functions
  "function emergencyOverrideActive() external view returns (bool)",
  "function setEmergencyOverride(bool _active) external",
  
  // Events
  "event PollCreated(uint256 indexed pollId, address indexed creator)",
  "event Voted(uint256 indexed pollId, address indexed voter)"
];

// Initialize contracts
export const publicVotingContract = new ethers.Contract(
  PUBLIC_VOTING_CONTRACT,
  PUBLIC_VOTING_ABI,
  wallet
);

export const privateVotingContract = new ethers.Contract(
  PRIVATE_VOTING_CONTRACT,
  PRIVATE_VOTING_ABI,
  wallet
);

// Verify signature function
export const verifySignature = (
  pollId: number,
  candidateId: number,
  voter: string,
  signature: string,
  isPrivate = false
): boolean => {
  try {
    // First try to verify as EIP-712 typed data signature
    try {
      console.log('Attempting EIP-712 signature verification...');
      
      // EIP-712 domain
      const domain = {
        name: isPrivate ? "PrivateVotingSystem" : "PublicVotingSystem",
        version: "1",
        chainId: 137, // Polygon Mainnet
        verifyingContract: isPrivate ? PRIVATE_VOTING_CONTRACT : PUBLIC_VOTING_CONTRACT
      };
      
      // The type of the data that was signed
      const types = {
        Vote: [
          { name: "pollId", type: "uint256" },
          { name: "candidateId", type: "uint16" },
          { name: "voter", type: "address" }
        ]
      };
      
      // The data that was signed
      const value = {
        pollId: pollId,
        candidateId: candidateId,
        voter: voter
      };
      
      // Create the EIP-712 typed data hash
      const typedDataEncoder = ethers.TypedDataEncoder.from(types);
      const digest = ethers.TypedDataEncoder.hash(domain, types, value);
      
      // Recover the signer from the signature
      const recoveredAddress = ethers.recoverAddress(digest, signature);
      console.log('EIP-712 recovered address:', recoveredAddress);
      console.log('Expected voter address:', voter);
      
      // Check if the recovered address matches the voter
      if (recoveredAddress.toLowerCase() === voter.toLowerCase()) {
        console.log('EIP-712 signature verification succeeded');
        return true;
      }
      
      console.log('EIP-712 signature verification failed, trying legacy method...');
    } catch (error) {
      console.error('Error in EIP-712 verification, falling back to legacy method:', error);
    }
    
    // Fallback to legacy signature verification
    console.log('Using legacy signature verification...');
    const message = ethers.solidityPackedKeccak256(
      ['uint256', 'uint16', 'address'],
      [pollId, candidateId, voter]
    );
    
    // Recover the signer from the signature
    const messageBytes = ethers.getBytes(message);
    const recoveredAddress = ethers.recoverAddress(ethers.hashMessage(messageBytes), signature);
    console.log('Legacy recovered address:', recoveredAddress);
    
    // Check if the recovered address matches the voter
    const isValid = recoveredAddress.toLowerCase() === voter.toLowerCase();
    console.log('Legacy signature verification result:', isValid);
    return isValid;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
};

// Add new function to verify whitelist approval signatures
export const verifyWhitelistApproval = (
  pollId: number,
  voter: string,
  expiry: number,
  signature: string,
  whitelistSigner: string
): boolean => {
  try {
    console.log('Verifying whitelist approval with parameters:', {
      pollId,
      voter,
      expiry,
      signatureLength: signature?.length,
      whitelistSigner
    });
    
    // EIP-712 domain
    const domain = {
      name: "PrivateVotingSystem",
      version: "1",
      chainId: 137, // Polygon Mainnet
      verifyingContract: PRIVATE_VOTING_CONTRACT
    };
    
    console.log('Using domain:', domain);
    
    // The type of the data that was signed
    const types = {
      WhitelistApproval: [
        { name: "pollId", type: "uint256" },
        { name: "voter", type: "address" },
        { name: "expiry", type: "uint256" }
      ]
    };
    
    // The data that was signed
    const value = {
      pollId: pollId,
      voter: voter,
      expiry: expiry
    };
    
    console.log('Using value:', value);
    
    // Create the EIP-712 typed data hash
    const typedDataEncoder = ethers.TypedDataEncoder.from(types);
    const digest = ethers.TypedDataEncoder.hash(domain, types, value);
    console.log('Generated digest:', digest);
    
    // Recover the signer from the signature
    const recoveredAddress = ethers.recoverAddress(digest, signature);
    console.log('Whitelist approval recovered signer:', recoveredAddress);
    console.log('Expected whitelist signer:', whitelistSigner);
    
    // Check if the recovered address matches the whitelist signer
    const isValid = recoveredAddress.toLowerCase() === whitelistSigner.toLowerCase();
    console.log('Whitelist approval verification result:', isValid);
    return isValid;
  } catch (error) {
    console.error('Error verifying whitelist approval:', error);
    return false;
  }
}; 