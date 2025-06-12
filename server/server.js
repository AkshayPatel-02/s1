import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get configuration from environment variables
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8082';
const RPC_URL = process.env.RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/6zo2b7aZ7LuSzvtnoAOJO';

// Use a test private key for development - NEVER use this in production
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || '0x0123456789012345678901234567890123456789012345678901234567890123';
const PUBLIC_VOTING_CONTRACT = process.env.PUBLIC_VOTING_CONTRACT || '0x7f3bdcfa2d93052b7f552e6c9a19f7ad40954a65';
const PRIVATE_VOTING_CONTRACT = process.env.PRIVATE_VOTING_CONTRACT || '0x5a66f9f14e1bdef2e484a3e6a47701526dcb0f04';

// Contract ABIs
const PUBLIC_VOTING_ABI = [
  "function relayerAllowance(address,address) external view returns (uint256)",
  "function metaVote(uint256 _pollId, uint16 _candidateId, address _voter, bytes calldata _signature) external",
  "function getPollCount() external view returns (uint256)",
  "function getPollDetails(uint256 _pollId) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, uint64 voterCount, uint64 maxVoters)",
  "function getCandidate(uint256 _pollId, uint16 _candidateId) external view returns (string memory name, uint64 voteCount)",
  "function hasVoted(uint256 _pollId, address _voter) external view returns (bool)"
];

const PRIVATE_VOTING_ABI = [
  "function relayerAllowance(address,address) external view returns (uint256)",
  "function metaVote(uint256 _pollId, uint16 _candidateId, address _voter, uint256 _expiry, bytes calldata _whitelistSignature, bytes calldata _voteSignature) external",
  "function getPollCount() external view returns (uint256)",
  "function getPollDetails(uint256 _pollId) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, uint64 voterCount, uint64 maxVoters)",
  "function getCandidate(uint256 _pollId, uint16 _candidateId) external view returns (string memory name, uint64 voteCount)",
  "function hasVoted(uint256 _pollId, address _voter) external view returns (bool)",
  "function verifyWhitelistApproval(uint256 _pollId, address _voter, uint256 _expiry, bytes calldata _signature) external view returns (bool)"
];

// Initialize provider and wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

// Initialize contracts
const publicVotingContract = new ethers.Contract(
  PUBLIC_VOTING_CONTRACT,
  PUBLIC_VOTING_ABI,
  wallet
);

const privateVotingContract = new ethers.Contract(
  PRIVATE_VOTING_CONTRACT,
  PRIVATE_VOTING_ABI,
  wallet
);

// Initialize express app
const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow requests from any origin during development
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Add raw body parsing
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      req.rawBody = buf.toString();
      console.log('Raw request body received:', req.rawBody);
      
      // Try parsing it ourselves to see if there are any issues
      try {
        const parsedBody = JSON.parse(req.rawBody);
        console.log('Successfully parsed JSON body:', {
          keys: Object.keys(parsedBody),
          pollId: parsedBody.pollId,
          candidateId: parsedBody.candidateId,
          voter: parsedBody.voter,
          expiry: parsedBody.expiry,
          hasWhitelistSig: !!parsedBody.whitelistSignature,
          hasVoteSig: !!parsedBody.voteSignature
        });
      } catch (parseError) {
        console.error('Error parsing request body as JSON:', parseError);
      }
    } catch (e) {
      console.error('Error in request body verification:', e);
    }
  }
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Contract info endpoint
app.get('/api/contract-info', (req, res) => {
  try {
    const publicContractInfo = {
      address: PUBLIC_VOTING_CONTRACT,
      functions: Object.keys(publicVotingContract.interface.functions),
      abi: PUBLIC_VOTING_ABI
    };
    
    const privateContractInfo = {
      address: PRIVATE_VOTING_CONTRACT,
      functions: Object.keys(privateVotingContract.interface.functions),
      abi: PRIVATE_VOTING_ABI
    };
    
    res.status(200).json({
      public: publicContractInfo,
      private: privateContractInfo
    });
  } catch (error) {
    console.error('Error getting contract info:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint for debugging request parsing
app.post('/api/test-request', (req, res) => {
  console.log('=== Test Request Received ===');
  console.log('Headers:', req.headers);
  console.log('Raw body:', req.rawBody);
  console.log('Parsed body:', req.body);
  
  // Echo back what we received
  res.status(200).json({
    received: {
      headers: req.headers,
      body: req.body,
      rawBodyLength: req.rawBody?.length || 0
    },
    parsedOk: true
  });
});

// Get relayer address
app.get('/api/relayer-address', async (req, res) => {
  try {
    const address = await wallet.getAddress();
    res.status(200).json({ address });
  } catch (error) {
    console.error('Error getting relayer address:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user deposits
app.get('/api/user-deposits/:contractType/:address', async (req, res) => {
  try {
    const { contractType, address } = req.params;
    
    console.log(`Getting deposits for ${address} from ${contractType} contract`);
    
    if (!address || (contractType !== 'public' && contractType !== 'private')) {
      console.log('Invalid parameters');
      return res.status(400).json({ error: 'Invalid parameters' });
    }
    
    const contract = contractType === 'public' ? publicVotingContract : privateVotingContract;
    const contractAddress = contractType === 'public' ? PUBLIC_VOTING_CONTRACT : PRIVATE_VOTING_CONTRACT;
    
    console.log(`Using contract at address: ${contractAddress}`);
    console.log(`Contract interface: ${JSON.stringify(contract.interface.fragments.map(f => f.name))}`);
    
    // Check if the address is valid
    if (!ethers.isAddress(address)) {
      console.log(`Invalid Ethereum address: ${address}`);
      return res.status(400).json({ 
        error: 'Invalid Ethereum address',
        deposits: "0",
        formattedDeposits: "0.0"
      });
    }
    
    // Normalize the address to checksum format
    const checksumAddress = ethers.getAddress(address);
    console.log(`Normalized address: ${checksumAddress}`);
    
    // Call the contract function
    const deposits = await contract.relayerAllowance(checksumAddress, ethers.ZeroAddress);
    console.log(`Raw deposits value: ${deposits}`);
    console.log(`Deposits: ${deposits.toString()}`);
    
    // Format the deposits as Ether
    const formattedDeposits = ethers.formatEther(deposits);
    console.log(`Formatted deposits: ${formattedDeposits}`);
    
    // Return the result
    res.status(200).json({
      deposits: deposits.toString(),
      formattedDeposits: formattedDeposits
    });
  } catch (error) {
    console.error(`Error getting ${req.params.contractType} deposits:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Add public vote submission endpoint
app.post('/api/public-vote', async (req, res) => {
  try {
    let { pollId, candidateId, voter, signature } = req.body;
    
    console.log('Received vote request with body:', JSON.stringify(req.body, null, 2));
    
    // Try to convert parameters to the correct types
    try {
      pollId = pollId !== undefined ? BigInt(pollId) : undefined;
      candidateId = candidateId !== undefined ? Number(candidateId) : undefined;
      voter = String(voter || '');
      signature = String(signature || '');
    } catch (conversionError) {
      console.error('Error converting parameters:', conversionError);
    }
    
    console.log(`Submitting public vote for poll ${pollId}, candidate ${candidateId}, voter ${voter}`);
    console.log(`Signature length: ${signature ? signature.length : 'undefined'}`);
    
    // Validate inputs
    if (pollId === undefined || pollId === null) {
      console.log('Missing pollId');
      return res.status(400).json({ error: 'Missing required parameter: pollId' });
    }
    
    if (candidateId === undefined || candidateId === null) {
      console.log('Missing candidateId');
      return res.status(400).json({ error: 'Missing required parameter: candidateId' });
    }
    
    if (!voter) {
      console.log('Missing voter');
      return res.status(400).json({ error: 'Missing required parameter: voter' });
    }
    
    if (!signature) {
      console.log('Missing signature');
      return res.status(400).json({ error: 'Missing required parameter: signature' });
    }
    
    try {
      console.log(`Converted parameters: pollId=${pollId}, candidateId=${candidateId}`);
      
      // Submit the transaction
      const tx = await publicVotingContract.metaVote(pollId, candidateId, voter, signature);
      console.log(`Transaction submitted: ${tx.hash}`);
      
      // Return the transaction hash
      res.status(200).json({ 
        success: true, 
        txHash: tx.hash,
        message: 'Vote submitted successfully'
      });
    } catch (contractError) {
      console.error(`Contract error: ${contractError.message}`);
      res.status(400).json({ 
        error: contractError.message,
        code: contractError.code || 'CONTRACT_ERROR'
      });
    }
  } catch (error) {
    console.error('Error submitting public vote:', error);
    res.status(500).json({ 
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Add private vote submission endpoint
app.post('/api/private-vote', async (req, res) => {
  try {
    // Log raw request details
    console.log('=== Private Vote Request Details ===');
    console.log('Headers:', req.headers);
    console.log('Raw body:', req.rawBody);
    console.log('Parsed body:', req.body);
    
    const { pollId, candidateId, voter, expiry, whitelistSignature, voteSignature } = req.body;
    
    // Log each parameter's type and value
    console.log('=== Parameter Details ===');
    console.log({
      pollId: {
        type: typeof pollId,
        value: pollId,
        isDefined: pollId !== undefined,
        isNull: pollId === null
      },
      candidateId: {
        type: typeof candidateId,
        value: candidateId,
        isDefined: candidateId !== undefined,
        isNull: candidateId === null
      },
      voter: {
        type: typeof voter,
        value: voter,
        length: voter?.length,
        isDefined: voter !== undefined,
        isNull: voter === null
      },
      expiry: {
        type: typeof expiry,
        value: expiry,
        isDefined: expiry !== undefined,
        isNull: expiry === null
      },
      whitelistSignature: {
        type: typeof whitelistSignature,
        length: whitelistSignature?.length,
        isDefined: whitelistSignature !== undefined,
        isNull: whitelistSignature === null,
        startsWith0x: whitelistSignature?.startsWith('0x'),
        sample: whitelistSignature?.slice(0, 10) + '...' + whitelistSignature?.slice(-8)
      },
      voteSignature: {
        type: typeof voteSignature,
        length: voteSignature?.length,
        isDefined: voteSignature !== undefined,
        isNull: voteSignature === null,
        startsWith0x: voteSignature?.startsWith('0x'),
        sample: voteSignature?.slice(0, 10) + '...' + voteSignature?.slice(-8)
      }
    });
    
    // Validate inputs with more detailed error messages
    const validationErrors = [];
    
    // Check each parameter with type validation
    if (pollId === undefined || pollId === null) {
      validationErrors.push('pollId is missing');
    } else if (typeof pollId !== 'number') {
      validationErrors.push(`pollId must be a number, got ${typeof pollId}`);
    }
    
    if (candidateId === undefined) {
      validationErrors.push('candidateId is missing');
    } else if (typeof candidateId !== 'number') {
      validationErrors.push(`candidateId must be a number, got ${typeof candidateId}`);
    }
    
    if (!voter) {
      validationErrors.push('voter is missing');
    } else if (typeof voter !== 'string' || !voter.startsWith('0x')) {
      validationErrors.push('voter must be a valid Ethereum address');
    }
    
    if (!expiry) {
      validationErrors.push('expiry is missing');
    } else if (typeof expiry !== 'number') {
      validationErrors.push(`expiry must be a number, got ${typeof expiry}`);
    }
    
    if (!whitelistSignature) {
      validationErrors.push('whitelistSignature is missing');
    } else if (typeof whitelistSignature !== 'string' || !whitelistSignature.startsWith('0x')) {
      validationErrors.push('whitelistSignature must be a valid hex string starting with 0x');
    }
    
    if (!voteSignature) {
      validationErrors.push('voteSignature is missing');
    } else if (typeof voteSignature !== 'string' || !voteSignature.startsWith('0x')) {
      validationErrors.push('voteSignature must be a valid hex string starting with 0x');
    }
    
    if (validationErrors.length > 0) {
      console.error('=== Validation Errors ===');
      console.error(validationErrors);
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: validationErrors
      });
    }
    
    // If we get here, all parameters are valid
    console.log('=== All parameters valid, proceeding with vote submission ===');
    
    try {
      // Skip getting poll details and proceed directly to vote submission
      console.log('Submitting vote transaction...');
      
      // Check if the contract is properly initialized
      console.log('Contract address:', PRIVATE_VOTING_CONTRACT);
      console.log('Contract methods:', Object.keys(privateVotingContract.interface.functions));
      
      // Submit the transaction
      const tx = await privateVotingContract.metaVote(
        pollId, 
        candidateId, 
        voter, 
        expiry,
        whitelistSignature,
        voteSignature
      );
      console.log(`Transaction submitted: ${tx.hash}`);
      
      // Return the transaction hash
      res.status(200).json({ 
        success: true, 
        txHash: tx.hash,
        message: 'Vote submitted successfully'
      });
    } catch (contractError) {
      console.error('=== Contract Error ===');
      console.error(contractError);
      res.status(400).json({ 
        error: contractError.message,
        code: contractError.code || 'CONTRACT_ERROR'
      });
    }
  } catch (error) {
    console.error('=== Server Error ===');
    console.error(error);
    res.status(500).json({ 
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Get public polls
app.get('/api/public-polls', async (req, res) => {
  try {
    console.log('Fetching public polls from blockchain...');
    let pollCount = 0;
    try {
      pollCount = await publicVotingContract.getPollCount();
      console.log(`Public poll count: ${pollCount}`);
    } catch (error) {
      console.error('Error getting public poll count:', error.message);
      console.log('Returning empty polls array');
      return res.status(200).json([]);
    }
    
    const polls = [];
    for (let i = 0; i < Number(pollCount); i++) {
      try {
        console.log(`Fetching details for public poll #${i}...`);
        const pollDetails = await publicVotingContract.getPollDetails(i);
        polls.push({
          id: i,
          title: pollDetails[0],
          creator: pollDetails[1],
          endTime: Number(pollDetails[2]),
          candidateCount: Number(pollDetails[3]),
          voterCount: Number(pollDetails[4]),
          maxVoters: Number(pollDetails[5]),
          isPrivate: false
        });
      } catch (error) {
        console.error(`Error fetching details for public poll #${i}:`, error.message);
        // Skip this poll if there was an error
      }
    }
    
    console.log(`Successfully fetched ${polls.length} public polls`);
    res.status(200).json(polls);
  } catch (error) {
    console.error('Error fetching public polls:', error.message);
    res.status(200).json([]);
  }
});

// Get private polls
app.get('/api/private-polls', async (req, res) => {
  try {
    console.log('Fetching private polls from blockchain...');
    let pollCount = 0;
    try {
      pollCount = await privateVotingContract.getPollCount();
      console.log(`Private poll count: ${pollCount}`);
    } catch (error) {
      console.error('Error getting private poll count:', error.message);
      console.log('Returning empty polls array');
      return res.status(200).json([]);
    }
    
    const polls = [];
    for (let i = 0; i < Number(pollCount); i++) {
      try {
        console.log(`Fetching details for private poll #${i}...`);
        const pollDetails = await privateVotingContract.getPollDetails(i);
        polls.push({
          id: i,
          title: pollDetails[0],
          creator: pollDetails[1],
          endTime: Number(pollDetails[2]),
          candidateCount: Number(pollDetails[3]),
          voterCount: Number(pollDetails[4]),
          maxVoters: Number(pollDetails[5]),
          isPrivate: true
        });
      } catch (error) {
        console.error(`Error fetching details for private poll #${i}:`, error.message);
        // Skip this poll if there was an error
      }
    }
    
    console.log(`Successfully fetched ${polls.length} private polls`);
    res.status(200).json(polls);
  } catch (error) {
    console.error('Error fetching private polls:', error.message);
    res.status(200).json([]);
  }
});

// Get poll details
app.get('/api/poll-details/:contractType/:pollId', async (req, res) => {
  try {
    const { contractType, pollId } = req.params;
    
    if (!pollId || (contractType !== 'public' && contractType !== 'private')) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
    
    const contract = contractType === 'public' ? publicVotingContract : privateVotingContract;
    
    // Get poll details
    const pollDetails = await contract.getPollDetails(pollId);
    const poll = {
      id: Number(pollId),
      title: pollDetails[0],
      creator: pollDetails[1],
      endTime: Number(pollDetails[2]),
      candidateCount: Number(pollDetails[3]),
      voterCount: Number(pollDetails[4]),
      maxVoters: Number(pollDetails[5]),
      isPrivate: contractType === 'private'
    };
    
    // Get candidates
    const candidates = [];
    for (let i = 0; i < poll.candidateCount; i++) {
      const candidate = await contract.getCandidate(pollId, i);
      candidates.push({
        name: candidate[0],
        voteCount: Number(candidate[1])
      });
    }
    
    res.status(200).json({ poll, candidates });
  } catch (error) {
    console.error(`Error fetching poll details for ${req.params.contractType} poll #${req.params.pollId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Relayer server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 