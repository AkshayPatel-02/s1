import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { toast } from '@/hooks/use-toast';
import { alchemy } from '@/services/alchemyService';
import { submitPublicVote, submitPrivateVote } from '@/services/relayerService';
import { whitelistService } from '@/services/whitelistService';

// Contract addresses on Polygon
const CONTRACT_ADDRESSES = {
  PUBLIC_VOTING: '0x7f3bdcfa2d93052b7f552e6c9a19f7ad40954a65',
  PRIVATE_VOTING: '0x5a66f9f14e1bdef2e484a3e6a47701526dcb0f04'
};

// Types
export interface Poll {
  id: number;
  title: string;
  creator: string;
  endTime: number;
  candidateCount: number;
  voterCount: number;
  maxVoters: number;
  isPrivate?: boolean;
}

export interface Candidate {
  name: string;
  voteCount: number;
}

interface Web3State {
  isConnected: boolean;
  account: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  publicContract: ethers.Contract | null;
  privateContract: ethers.Contract | null;
  chainId: number | null;
  isLoading: boolean;
  error: string | null;
}

type Web3Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONNECTED'; payload: { account: string; provider: ethers.BrowserProvider; signer: ethers.Signer; chainId: number } }
  | { type: 'SET_CONTRACTS'; payload: { publicContract: ethers.Contract; privateContract: ethers.Contract } }
  | { type: 'DISCONNECT' };

const initialState: Web3State = {
  isConnected: false,
  account: null,
  provider: null,
  signer: null,
  publicContract: null,
  privateContract: null,
  chainId: null,
  isLoading: false,
  error: null,
};

const web3Reducer = (state: Web3State, action: Web3Action): Web3State => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_CONNECTED':
      return {
        ...state,
        isConnected: true,
        account: action.payload.account,
        provider: action.payload.provider,
        signer: action.payload.signer,
        chainId: action.payload.chainId,
        error: null,
        isLoading: false,
      };
    case 'SET_CONTRACTS':
      return {
        ...state,
        publicContract: action.payload.publicContract,
        privateContract: action.payload.privateContract,
      };
    case 'DISCONNECT':
      return {
        ...initialState,
      };
    default:
      return state;
  }
};

// Updated Contract ABIs with deposit/withdraw functions and meta transactions
const PUBLIC_VOTING_ABI = [
  // Poll creation and management
  "function createPoll(string calldata _title, string[] calldata _candidateNames, uint24 _durationHours, uint64 _maxVoters) external payable",
  "function cancelPoll(uint256 _pollId) external",
  
  // Voting functions
  "function vote(uint256 _pollId, uint16 _candidateId) external",
  "function metaVote(uint256 _pollId, uint16 _candidateId, address _voter, bytes calldata _signature) external",
  
  // Poll data retrieval
  "function getPollDetails(uint256 _pollId) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, uint64 voterCount, uint64 maxVoters)",
  "function getCandidate(uint256 _pollId, uint16 _candidateId) external view returns (string memory name, uint64 voteCount)",
  "function hasVoted(uint256 _pollId, address _voter) external view returns (bool)",
  "function getPollsCount() external view returns (uint256)",
  "function cancelledPolls(uint256) external view returns (bool)",
  
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
  
  // Events
  "event PollCreated(uint256 indexed pollId, address indexed creator)",
  "event Voted(uint256 indexed pollId, address indexed voter)"
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
  "event Voted(uint256 indexed pollId, address indexed voter)",
  
  // New functions
  "function isWhitelisted(uint256 _pollId, address _voter) external view returns (bool)",
  "function verifyWhitelistApproval(uint256 _pollId, address _voter, uint256 _expiry, bytes calldata _signature) external view returns (bool)"
];

interface Web3ContextType {
  state: Web3State;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToPolygon: () => Promise<void>;
  getPublicPolls: () => Promise<Poll[]>;
  getPrivatePolls: () => Promise<Poll[]>;
  getPollDetails: (pollId: number, isPrivate?: boolean) => Promise<{ poll: Poll; candidates: Candidate[] }>;
  vote: (pollId: number, candidateId: number, isPrivate?: boolean, whitelistSignature?: string, expiry?: number, overrides?: any) => Promise<{ 
    success: boolean; 
    txHash: string; 
    blockNumber?: number;
    gasUsed?: string;
    message: string 
  }>;
  createPoll: (pollData: any) => Promise<void>;
  isRelayer: (address: string | null) => Promise<boolean>;
  getUserDeposits: (contractType: 'public' | 'private') => Promise<number>;
  getTransactionDetails: (txHash: string) => Promise<any>;
  getTokenBalances: (address: string) => Promise<any>;
  verifyWhitelist: (pollId: number, voter: string, expiry?: number, signature?: string) => Promise<boolean>;
  setEmergencyOverride: (active: boolean) => Promise<boolean>;
}

const Web3Context = createContext<Web3ContextType | null>(null);

export const Web3Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(web3Reducer, initialState);

  // Auto-connect if previously connected
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Check if we have a stored connection
        const storedAccount = localStorage.getItem('connected_account');
        
        if (storedAccount && window.ethereum) {
          // Silently try to reconnect
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          
          // Only auto-connect if the account is still available
          if (accounts.length > 0 && accounts[0].address.toLowerCase() === storedAccount.toLowerCase()) {
            console.log('Auto-reconnecting to previously connected account');
            await connectWallet(true); // Pass silent=true to avoid notifications
          }
        }
      } catch (error) {
        console.error('Auto-connect error:', error);
        // Don't show error toast for auto-connect failures
      }
    };
    
    checkConnection();
  }, []);

  // Setup event listeners for account and chain changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          disconnectWallet();
        } else if (state.account !== accounts[0] && state.isConnected) {
          // Account changed, reconnect with new account
          await connectWallet(true);
        }
      };

      const handleChainChanged = () => {
        // Reload the page when chain changes as recommended by MetaMask
        window.location.reload();
      };

      // Add listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      // Cleanup listeners on unmount
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [state.account, state.isConnected]);

  // Periodic connection check for private polls
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    // If we're connected and have contracts initialized, periodically check connection
    if (state.isConnected && state.publicContract && state.privateContract) {
      interval = setInterval(async () => {
        try {
          // Simple call to check if connection is still active
          await state.provider?.getBlockNumber();
        } catch (error) {
          console.log('Connection check failed, attempting to reconnect');
          await connectWallet(true);
        }
      }, 30000); // Check every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state.isConnected, state.publicContract, state.privateContract]);

  const connectWallet = async (silent = false) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      dispatch({
        type: 'SET_CONNECTED',
        payload: {
          account: accounts[0],
          provider,
          signer,
          chainId: Number(network.chainId),
        },
      });

      // Initialize contracts
      const publicContract = new ethers.Contract(CONTRACT_ADDRESSES.PUBLIC_VOTING, PUBLIC_VOTING_ABI, signer);
      const privateContract = new ethers.Contract(CONTRACT_ADDRESSES.PRIVATE_VOTING, PRIVATE_VOTING_ABI, signer);

      dispatch({
        type: 'SET_CONTRACTS',
        payload: { publicContract, privateContract },
      });

      // Store connected account for auto-reconnect
      localStorage.setItem('connected_account', accounts[0]);

      if (!silent) {
        toast({
          title: 'Wallet Connected',
          description: `Connected to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`,
        });
      }

    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      if (!silent) {
        toast({
          title: 'Connection Failed',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  const disconnectWallet = () => {
    // Remove stored connection
    localStorage.removeItem('connected_account');
    
    dispatch({ type: 'DISCONNECT' });
    toast({
      title: 'Wallet Disconnected',
      description: 'Successfully disconnected from MetaMask',
    });
  };

  const switchToPolygon = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }], // Polygon Mainnet
      });
    } catch (error: any) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x89',
            chainName: 'Polygon Mainnet',
            nativeCurrency: {
              name: 'MATIC',
              symbol: 'MATIC',
              decimals: 18,
            },
            rpcUrls: ['https://polygon-rpc.com/'],
            blockExplorerUrls: ['https://polygonscan.com/'],
          }],
        });
      }
    }
  };

  const getPublicPolls = async (): Promise<Poll[]> => {
    if (!state.publicContract) throw new Error('Contract not initialized');

    try {
      const pollCount = await state.publicContract.getPollsCount();
      const polls: Poll[] = [];

      for (let i = 0; i < Number(pollCount); i++) {
        const pollDetails = await state.publicContract.getPollDetails(i);
        polls.push({
          id: i,
          title: pollDetails[0],
          creator: pollDetails[1],
          endTime: Number(pollDetails[2]),
          candidateCount: Number(pollDetails[3]),
          voterCount: Number(pollDetails[4]),
          maxVoters: Number(pollDetails[5]),
          isPrivate: false,
        });
      }

      return polls;
    } catch (error) {
      console.error('Error fetching public polls:', error);
      return [];
    }
  };

  const getPrivatePolls = async (): Promise<Poll[]> => {
    if (!state.privateContract) throw new Error('Contract not initialized');

    try {
      const pollCount = await state.privateContract.getPollsCount();
      const polls: Poll[] = [];

      for (let i = 0; i < Number(pollCount); i++) {
        const pollDetails = await state.privateContract.getPollDetails(i);
        polls.push({
          id: i,
          title: pollDetails[0],
          creator: pollDetails[1],
          endTime: Number(pollDetails[2]),
          candidateCount: Number(pollDetails[3]),
          voterCount: Number(pollDetails[4]),
          maxVoters: Number(pollDetails[5]),
          isPrivate: true,
        });
      }

      return polls;
    } catch (error) {
      console.error('Error fetching private polls:', error);
      return [];
    }
  };

  const getUserDeposits = async (contractType: 'public' | 'private'): Promise<number> => {
    if (!state.account) return 0;

    console.log(`Getting ${contractType} deposits for account: ${state.account}`);
    
    try {
      // Always use direct contract call for accurate data
      const contract = contractType === 'public' ? state.publicContract : state.privateContract;
      
      if (!contract) {
        console.log(`Contract not initialized for ${contractType}`);
        return 0;
      }
      
      // Direct contract call for accurate data
      try {
        console.log(`Calling contract.relayerAllowance directly for ${state.account}`);
        const result = await contract.relayerAllowance.staticCall(state.account, ethers.ZeroAddress);
        console.log(`Direct contract call returned:`, result);
        
        // Convert to string first to avoid BigNumber issues
        const depositAmount = result.toString();
        const formattedDeposits = parseFloat(ethers.formatEther(depositAmount));
        console.log(`Formatted deposits: ${formattedDeposits}`);
        return formattedDeposits;
      } catch (contractError) {
        console.error(`Error calling contract directly: ${contractError}`);
        return 0;
      }
    } catch (error) {
      console.error(`Error fetching ${contractType} contract deposits:`, error);
      return 0;
    }
  };

  const getPollDetails = async (pollId: number, isPrivate = false) => {
    const contract = isPrivate ? state.privateContract : state.publicContract;
    if (!contract) throw new Error('Contract not initialized');

    const pollDetails = await contract.getPollDetails(pollId);
    const poll: Poll = {
      id: pollId,
      title: pollDetails[0],
      creator: pollDetails[1],
      endTime: Number(pollDetails[2]),
      candidateCount: Number(pollDetails[3]),
      voterCount: Number(pollDetails[4]),
      maxVoters: Number(pollDetails[5]),
      isPrivate,
    };

    const candidates: Candidate[] = [];
    for (let i = 0; i < poll.candidateCount; i++) {
      const candidate = await contract.getCandidate(pollId, i);
      candidates.push({
        name: candidate[0],
        voteCount: Number(candidate[1]),
      });
    }

    return { poll, candidates };
  };

  const signMetaTransaction = async (pollId: number, candidateId: number, voter: string, isPrivate = false) => {
    if (!state.signer) throw new Error('Signer not available');

    toast({
      title: 'Signature Required',
      description: 'Please sign with your wallet to confirm your vote',
      duration: 3000,
    });

    console.log(`Signing meta transaction for poll ${pollId}, candidate ${candidateId}, voter ${voter}`);
    console.log(`Parameter types: pollId (${typeof pollId}), candidateId (${typeof candidateId}), voter (${typeof voter})`);
    
    // EIP-712 domain
    const domain = {
      name: isPrivate ? "PrivateVotingSystem" : "PublicVotingSystem",
      version: "1",
      chainId: state.chainId || 137, // Polygon Mainnet
      verifyingContract: isPrivate ? CONTRACT_ADDRESSES.PRIVATE_VOTING : CONTRACT_ADDRESSES.PUBLIC_VOTING
    };
    
    // The type of the data we're signing
    const types = {
      Vote: [
        { name: "pollId", type: "uint256" },
        { name: "candidateId", type: "uint16" },
        { name: "voter", type: "address" }
      ]
    };
    
    // The data to sign
    const value = {
      pollId: pollId,
      candidateId: candidateId,
      voter: voter
    };
    
    try {
      // Use EIP-712 typed data signing
      console.log("Requesting signature with EIP-712 typed data");
      const signature = await state.signer.signTypedData(domain, types, value);
      console.log(`Generated EIP-712 signature: ${signature.substring(0, 20)}...`);
      return signature;
    } catch (error) {
      console.error("Error with EIP-712 signing, falling back to ethers.signMessage:", error);
      
      // Fallback to legacy signing method
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint16', 'address'],
        [pollId, candidateId, voter]
      );
      
      console.log(`Generated message hash: ${message}`);
      const signature = await state.signer.signMessage(ethers.getBytes(message));
      console.log(`Generated legacy signature: ${signature.substring(0, 20)}...`);
      
      return signature;
    }
  };

  const vote = async (pollId: number, candidateId: number, isPrivate = false, whitelistSignature?: string, expiry?: number, overrides = {}) => {
    const contract = isPrivate ? state.privateContract : state.publicContract;
    if (!contract || !state.account) throw new Error('Contract not initialized');

    try {
      // Step 1: Sign the meta-transaction
      
      console.log('Vote parameters:', {
        pollId,
        candidateId,
        isPrivate,
        hasWhitelistSig: !!whitelistSignature,
        whitelistSigLength: whitelistSignature?.length,
        expiry,
        voter: state.account
      });
      
      // For private voting, get the whitelist signature if not provided
      if (isPrivate && !whitelistSignature) {
        const storedSignature = await whitelistService.getSignatureForVoter(pollId, state.account);
        if (storedSignature) {
          console.log('Using stored whitelist signature from local storage');
          whitelistSignature = storedSignature.signature;
          expiry = storedSignature.expiry;
        } else {
          console.error('No whitelist signature found for this voter');
          throw new Error('You are not whitelisted for this poll');
        }
      }
      
      const voteSignature = await signMetaTransaction(pollId, candidateId, state.account, isPrivate);
      
      // Step 2: Submit meta-transaction to relayer
      toast({
        title: 'Vote Submitted',
        description: 'Your vote is being processed...',
        duration: 3000,
      });

      // Track start time for performance metrics
      const startTime = Date.now();
      
      let result;
      if (isPrivate && whitelistSignature && expiry) {
        // For private polls with whitelist signature
        console.log('Submitting private meta-vote with parameters:', {
          pollId,
          candidateId,
          voter: state.account,
          expiry,
          whitelistSignature: whitelistSignature.substring(0, 10) + '...',
          voteSignature: voteSignature.substring(0, 10) + '...'
        });
        
        // Ensure the signatures are properly formatted
        const formattedWhitelistSig = whitelistSignature.startsWith('0x') ? 
          whitelistSignature : `0x${whitelistSignature}`;
        
        result = await submitPrivateVote(pollId, candidateId, state.account, expiry, formattedWhitelistSig, voteSignature);
      } else {
        // For public polls
        console.log(`Submitting public meta-vote for poll ${pollId}, candidate ${candidateId}`);
        result = await submitPublicVote(pollId, candidateId, state.account, voteSignature);
      }
      
      console.log("Meta-transaction submitted:", result);
      
      // Calculate processing time
      const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

      if (result.success) {
        toast({
          title: 'Vote Confirmed',
          description: `Your vote has been successfully recorded! Transaction: ${result.txHash.slice(0, 10)}...`,
          duration: 5000,
        });
      } else {
        // Handle unsuccessful but not error case
        toast({
          title: 'Vote Processing',
          description: `Transaction submitted but confirmation is pending. Please check transaction ${result.txHash.slice(0, 10)}... on the explorer.`,
          duration: 5000,
        });
      }
      
      return result;
      
    } catch (error: any) {
      console.error('Error during voting process:', error);
      
      let errorMessage = 'Failed to submit vote. Please try again.';
      
      if (error.message.includes('user rejected')) {
        errorMessage = 'You rejected the signature request.';
      } else if (error.message.includes('already voted')) {
        errorMessage = 'You have already voted in this poll.';
      } else if (error.message.includes('poll ended')) {
        errorMessage = 'This poll has ended.';
      } else if (error.message.includes('max voters reached')) {
        errorMessage = 'Maximum number of voters has been reached.';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'The poll creator has insufficient funds for gas reimbursement.';
      } else if (error.message.includes('confirmation timeout')) {
        errorMessage = 'Transaction was submitted but confirmation timed out. Please check the explorer.';
      } else if (error.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error while submitting transaction. Please try again.';
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
        duration: 7000,
      });
      
      throw error;
    }
  };

  const createPoll = async (pollData: any) => {
    try {
      if (pollData.isPrivate) {
        if (!state.privateContract) throw new Error('Private contract not initialized');
        if (!state.account) throw new Error('Wallet not connected');
        
        console.log('Creating private poll with:', {
          title: pollData.title,
          candidates: pollData.candidates,
          durationHours: pollData.durationHours,
          maxVoters: pollData.maxVoters,
          whitelistSigner: state.account, // Poll creator will be the whitelist signer
          fundingAmount: pollData.fundingAmount
        });
        
        const tx = await state.privateContract.createPoll(
          pollData.title,
          pollData.candidates,
          pollData.durationHours,
          pollData.maxVoters,
          state.account, // Poll creator will be the whitelist signer
          { value: ethers.parseEther(pollData.fundingAmount.toString()) }
        );
        
        await tx.wait();

        // After poll is created, store the whitelist addresses for later verification
        const pollId = await state.privateContract.getPollsCount() - BigInt(1);
        console.log('New poll created with ID:', pollId.toString());
        
        // Store whitelist addresses in local storage or your backend
        localStorage.setItem(`poll_${pollId}_whitelist`, JSON.stringify(pollData.whitelist));
        
      } else {
        if (!state.publicContract) throw new Error('Public contract not initialized');
        
        const tx = await state.publicContract.createPoll(
          pollData.title,
          pollData.candidates,
          pollData.durationHours,
          pollData.maxVoters,
          { value: ethers.parseEther(pollData.fundingAmount.toString()) }
        );
        
        await tx.wait();
      }

      toast({
        title: 'Poll Created',
        description: 'Your poll has been created successfully!',
        variant: 'success',
      });
    } catch (error: any) {
      console.error('Error creating poll:', error);
      
      // Don't show toast here as we'll let the calling component handle it
      // This prevents duplicate error messages
      throw error;
    }
  };

  const isRelayer = async (address: string | null): Promise<boolean> => {
    if (!address || !state.publicContract || !state.privateContract) return false;
    
    try {
      // Check if the address is an authorized relayer in either contract
      const isPublicRelayer = await state.publicContract.authorizedRelayers(address);
      const isPrivateRelayer = await state.privateContract.authorizedRelayers(address);
      
      return isPublicRelayer || isPrivateRelayer;
    } catch (error) {
      console.error('Error checking relayer status:', error);
      return false;
    }
  };

  const verifyWhitelist = async (pollId: number, voter: string, expiry?: number, signature?: string): Promise<boolean> => {
    if (!state.privateContract) throw new Error('Contract not initialized');
    
    try {
      console.log(`Verifying whitelist for poll ${pollId}, voter ${voter}`);
      
      // First check if the voter is the poll creator - they're always whitelisted
      try {
        // Use polls function instead of getPollDetails to get the whitelistSigner
        const pollDetails = await state.privateContract.polls(pollId);
        
        // Destructure the tuple correctly
        const [title, creator, endTime, candidateCount, voterCount, maxVoters, whitelistSigner] = pollDetails;
        
        if (voter.toLowerCase() === whitelistSigner.toLowerCase()) {
          console.log('Voter is the poll creator and whitelistSigner - automatically whitelisted');
          
          // If the voter is the poll creator, they're automatically whitelisted
          // Return true immediately without requiring signature verification
          return true;
          
          // The code below is only needed if we want to generate and store a signature for the creator
          // for use with the contract's vote function, but not for verification purposes
          
          // If no signature is provided, generate a self-signature for the creator
          if (!signature && state.signer) {
            console.log('Generating self-signature for poll creator');
            
            // Get contract address
            const contractAddress = state.privateContract.target.toString();
            
            // Create expiry timestamp if not provided
            const selfExpiry = expiry || Math.floor(Date.now() / 1000) + (7 * 86400); // 7 days
            
            // Generate a signature using the whitelist service
            const { signature: selfSignature } = await whitelistService.generateSignature(
              state.signer,
              pollId,
              voter,
              contractAddress,
              state.chainId || 137,
              7 // 7 days expiry
            );
            
            console.log('Generated self-signature for poll creator:', selfSignature.substring(0, 10) + '...');
            
            // Verify the signature locally since we can't call the internal contract function
            try {
              // EIP-712 domain
              const domain = {
                name: "PrivateVotingSystem",
                version: "1",
                chainId: state.chainId || 137,
                verifyingContract: contractAddress
              };
              
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
                expiry: selfExpiry
              };
              
              // Verify the signature
              const recoveredAddress = ethers.verifyTypedData(domain, types, value, selfSignature);
              const isValid = recoveredAddress.toLowerCase() === whitelistSigner.toLowerCase();
              
              if (isValid) {
                console.log('Self-signature verified successfully locally');
                
                // Store the valid signature for future use
                await whitelistService.storeSignature(pollId, voter, selfSignature, selfExpiry);
                
                return true;
              } else {
                console.error('Self-signature failed local verification');
                return false;
              }
            } catch (verifyError) {
              console.error('Error verifying self-signature locally:', verifyError);
              return false;
            }
          }
          
          // Even if the user is the creator, we still need a valid signature for the contract
          if (signature && expiry) {
            try {
              // Verify the signature locally
              const contractAddress = state.privateContract.target.toString();
              
              // EIP-712 domain
              const domain = {
                name: "PrivateVotingSystem",
                version: "1",
                chainId: state.chainId || 137,
                verifyingContract: contractAddress
              };
              
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
              
              // Verify the signature
              const recoveredAddress = ethers.verifyTypedData(domain, types, value, signature);
              const isValid = recoveredAddress.toLowerCase() === whitelistSigner.toLowerCase();
              
              console.log('Creator signature verification result:', isValid);
              return isValid;
            } catch (verifyError) {
              console.error('Error verifying creator signature locally:', verifyError);
              return false;
            }
          }
          
          // If we get here without a signature, return false to indicate one is needed
          return false;
        }
      } catch (error) {
        console.error('Error checking if voter is poll creator:', error);
      }
      
      // Next check if there's a stored signature for this voter
      const storedSignature = await whitelistService.getSignatureForVoter(pollId, voter);
      
      if (storedSignature) {
        console.log('Found stored whitelist signature:', storedSignature);
        
        // Check if the signature is expired
        const now = Math.floor(Date.now() / 1000);
        if (storedSignature.expiry < now) {
          console.log('Stored signature is expired');
          return false;
        }
        
        // Try local verification since we can't call the internal contract function
        try {
          console.log('Verifying stored signature locally');
          
          // Get poll details to find the whitelist signer
          // Use polls function instead of getPollDetails to get the whitelistSigner
          const pollDetails = await state.privateContract.polls(pollId);
          
          // Destructure the tuple correctly
          const [title, creator, endTime, candidateCount, voterCount, maxVoters, whitelistSigner] = pollDetails;
          
          // Get contract address
          const contractAddress = state.privateContract.target.toString();
          
          // EIP-712 domain
          const domain = {
            name: "PrivateVotingSystem",
            version: "1",
            chainId: state.chainId || 137,
            verifyingContract: contractAddress
          };
          
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
            expiry: storedSignature.expiry
          };
          
          // Verify the signature
          const recoveredAddress = ethers.verifyTypedData(domain, types, value, storedSignature.signature);
          const isValid = recoveredAddress.toLowerCase() === whitelistSigner.toLowerCase();
          
          console.log('Local verification result:', isValid);
          
          if (!isValid) {
            // Clear the invalid stored signature
            await whitelistService.clearSignatures(pollId);
          }
          
          return isValid;
        } catch (contractError) {
          console.error('Local verification failed:', contractError);
          // Clear the invalid stored signature
          await whitelistService.clearSignatures(pollId);
          return false;
        }
      }
      
      // If no signature provided, we can't verify non-creator addresses
      if (!signature || !expiry) {
        console.log('No signature provided for non-creator address');
        return false;
      }
      
      // Verify new signature locally
      try {
      // Ensure the signature has the 0x prefix
      const formattedSignature = signature.startsWith('0x') ? signature : `0x${signature}`;
      
        console.log('Verifying new signature locally:', {
        pollId,
        voter,
        expiry,
          signatureLength: formattedSignature.length
        });
        
        // Get poll details to find the whitelist signer
        // Use polls function instead of getPollDetails to get the whitelistSigner
        const pollDetails = await state.privateContract.polls(pollId);
        
        // Destructure the tuple correctly
        const [title, creator, endTime, candidateCount, voterCount, maxVoters, whitelistSigner] = pollDetails;
        
        // Get contract address
        const contractAddress = state.privateContract.target.toString();
        
        // EIP-712 domain
        const domain = {
          name: "PrivateVotingSystem",
          version: "1",
          chainId: state.chainId || 137,
          verifyingContract: contractAddress
        };
        
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
        
        // Verify the signature
        const recoveredAddress = ethers.verifyTypedData(domain, types, value, formattedSignature);
        const isValid = recoveredAddress.toLowerCase() === whitelistSigner.toLowerCase();
        
        console.log('Local verification result:', isValid);
      
      // If valid, store the signature for future use
      if (isValid) {
        await whitelistService.storeSignature(pollId, voter, formattedSignature, expiry);
        console.log('Valid signature stored for future use');
      }
      
      return isValid;
      } catch (error) {
        console.error('Error verifying whitelist locally:', error);
        return false;
      }
    } catch (error) {
      console.error('Error verifying whitelist:', error);
      return false;
    }
  };

  const setEmergencyOverride = async (active: boolean): Promise<boolean> => {
    if (!state.privateContract || !state.signer) {
      console.error('Contract or signer not initialized');
      return false;
    }
    
    try {
      console.log(`Setting emergency override to: ${active}`);
      
      // Get the default relayer wallet from the contract
      const defaultRelayerWallet = await state.privateContract.defaultRelayerWallet();
      
      // Check if the current user is the default relayer
      if (state.account?.toLowerCase() !== defaultRelayerWallet.toLowerCase()) {
        console.error('Only the default relayer can set emergency override');
        toast({
          title: "Permission Denied",
          description: "Only the default relayer can set emergency override",
          variant: "destructive"
        });
        return false;
      }
      
      // Call the contract function
      const tx = await state.privateContract.setEmergencyOverride(active);
      
      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      
      console.log(`Emergency override set to ${active}. Transaction hash: ${receipt.hash}`);
      
      toast({
        title: "Success",
        description: `Emergency override set to ${active}`,
        variant: "default"
      });
      
      return true;
    } catch (error) {
      console.error('Error setting emergency override:', error);
      
      toast({
        title: "Error",
        description: `Failed to set emergency override: ${error.message}`,
        variant: "destructive"
      });
      
      return false;
    }
  };

  // Add new method to get transaction details using Alchemy
  const getTransactionDetails = async (txHash: string) => {
    try {
      // Get transaction receipt
      const receipt = await alchemy.core.getTransactionReceipt(txHash);
      
      // Get transaction details
      const tx = await alchemy.core.getTransaction(txHash);
      
      return {
        receipt,
        transaction: tx,
        confirmations: receipt?.confirmations || 0,
        blockNumber: receipt?.blockNumber || 0,
        gasUsed: receipt?.gasUsed ? ethers.formatUnits(receipt.gasUsed.toString(), 'wei') : '0',
        effectiveGasPrice: receipt?.effectiveGasPrice ? ethers.formatUnits(receipt.effectiveGasPrice.toString(), 'gwei') : '0',
      };
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      throw error;
    }
  };

  // Add new method to get token balances using Alchemy
  const getTokenBalances = async (address: string) => {
    try {
      const balances = await alchemy.core.getTokenBalances(address);
      return balances;
    } catch (error) {
      console.error('Error fetching token balances:', error);
      throw error;
    }
  };

  return (
    <Web3Context.Provider
      value={{
        state,
        connectWallet,
        disconnectWallet,
        switchToPolygon,
        getPublicPolls,
        getPrivatePolls,
        getPollDetails,
        vote,
        createPoll,
        isRelayer,
        getUserDeposits,
        getTransactionDetails,
        getTokenBalances,
        verifyWhitelist,
        setEmergencyOverride
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

// Extend window interface for MetaMask
declare global {
  interface Window {
    ethereum?: any;
  }
}
