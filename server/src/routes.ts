import { Router, Request, Response } from 'express';
import { publicVotingContract, privateVotingContract, verifySignature, verifyWhitelistApproval } from './contracts.js';
import { wallet } from './wallet.js';
import { ethers } from 'ethers';
import { provider } from './wallet.js';
import { GAS_LIMIT } from './config.js';
import { JsonRpcProvider } from 'ethers';

const router = Router();

// Add this helper function at the top of the file after imports
function serializeBigInts(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => serializeBigInts(item));
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInts(value);
    }
    return result;
  }
  
  return obj;
}

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Get relayer address
router.get('/relayer-address', async (req: Request, res: Response) => {
  try {
    // Get the wallet address from the ethers wallet
    const address = await wallet.getAddress();
    res.status(200).json({ address });
  } catch (error: any) {
    console.error('Error getting relayer address:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user deposits
router.get('/user-deposits/:contractType/:address', async (req: Request, res: Response) => {
  try {
    const { contractType, address } = req.params;
    
    if (!address || (contractType !== 'public' && contractType !== 'private')) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
    
    const contract = contractType === 'public' ? publicVotingContract : privateVotingContract;
    
    // Get the general pool allowance (address(0) is the general pool)
    const deposits = await contract.relayerAllowance(address, ethers.ZeroAddress);
    
    res.status(200).json({
      deposits: deposits.toString(),
      formattedDeposits: ethers.formatEther(deposits)
    });
  } catch (error: any) {
    console.error(`Error getting ${req.params.contractType} deposits:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Submit public vote as a meta transaction
router.post('/public-vote', async (req: Request, res: Response) => {
  try {
    console.log('Received public vote request:', { 
      pollId: req.body.pollId,
      candidateId: req.body.candidateId,
      voter: req.body.voter,
      signatureLength: req.body.signature?.length || 0
    });
    
    const { pollId, candidateId, voter, signature } = req.body;
    
    // Validate inputs
    if (!pollId || candidateId === undefined || !voter || !signature) {
      console.error('Missing required parameters:', { pollId, candidateId, voter, hasSignature: !!signature });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Check if the relayer has enough MATIC
    const relayerBalance = await provider.getBalance(wallet.address);
    console.log('Relayer balance:', ethers.formatEther(relayerBalance), 'MATIC');
    
    if (relayerBalance < ethers.parseEther('0.1')) {
      console.error('Relayer balance too low');
      return res.status(500).json({ error: 'Relayer has insufficient funds' });
    }

    // Check if relayer is authorized
    const isAuthorized = await publicVotingContract.authorizedRelayers(wallet.address);
    console.log('Relayer authorization status:', {
      address: wallet.address,
      isAuthorized
    });

    if (!isAuthorized) {
      console.error('Relayer not authorized');
      return res.status(500).json({ error: 'Relayer not authorized for this contract' });
    }

    // Get current gas price and network conditions
    const feeData = await provider.getFeeData();
    console.log('Network fee data:', {
      gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : 'null',
      maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') : 'null',
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : 'null'
    });

    // Check if the poll exists and get creator's allowance
    console.log('Getting poll details...');
    const pollDetails = await publicVotingContract.getPollDetails(pollId);
    console.log('Poll details:', pollDetails);

    // Check if poll has ended
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime > Number(pollDetails[2])) {
      console.error('Poll has ended');
      return res.status(400).json({ error: 'Poll has ended' });
    }

    // Check if maximum voters reached
    if (pollDetails[4] >= pollDetails[5]) {
      console.error('Maximum voters reached');
      return res.status(400).json({ error: 'Maximum number of voters has been reached' });
    }

    // Verify signature
    console.log('Verifying signature...');
    const isValid = verifySignature(pollId, candidateId, voter, signature, false);
    if (!isValid) {
      console.error('Invalid signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Estimate gas for this specific transaction
    console.log('Estimating gas for transaction...');
    const estimatedGas = await publicVotingContract.metaVote.estimateGas(
      pollId,
      candidateId,
      voter,
      signature
    );
    
    console.log('Estimated gas:', estimatedGas.toString());

    // Add 20% buffer to estimated gas
    const gasLimit = (estimatedGas * BigInt(120)) / BigInt(100);
    console.log('Gas limit with buffer:', gasLimit.toString());

    // Calculate gas cost using current network conditions
    const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
    if (!maxFeePerGas) {
      throw new Error('Could not determine gas price from network');
    }

    // Add 20% to gas price for faster processing
    const adjustedMaxFeePerGas = (maxFeePerGas * BigInt(120)) / BigInt(100);
    const estimatedGasCost = gasLimit * adjustedMaxFeePerGas;
    
    console.log('Gas pricing:', {
      maxFeePerGas: ethers.formatUnits(maxFeePerGas, 'gwei'),
      adjustedMaxFeePerGas: ethers.formatUnits(adjustedMaxFeePerGas, 'gwei'),
      estimatedCost: ethers.formatEther(estimatedGasCost)
    });

    // Check if the poll creator has enough funds for gas reimbursement
    const creatorAllowance = await publicVotingContract.relayerAllowance(pollDetails[1], ethers.ZeroAddress);
    console.log('Creator allowance:', ethers.formatEther(creatorAllowance), 'MATIC');

    if (creatorAllowance < estimatedGasCost) {
      console.error('Creator allowance too low');
      return res.status(400).json({ 
        error: 'Poll creator has insufficient funds for gas reimbursement',
        required: ethers.formatEther(estimatedGasCost),
        available: ethers.formatEther(creatorAllowance)
      });
    }

    // Check if user has already voted
    const hasVoted = await publicVotingContract.hasVoted(pollId, voter);
    if (hasVoted) {
      console.error('User has already voted');
      return res.status(400).json({ error: 'You have already voted in this poll' });
    }

    // Prepare the transaction with proper gas settings
    console.log('Preparing transaction...');
    const tx = await publicVotingContract.metaVote.populateTransaction(
      pollId,
      candidateId,
      voter,
      signature
    );

    // Get the current nonce
    const nonce = await wallet.getNonce();
    console.log('Current nonce:', nonce);

    // Use EIP-1559 gas settings if supported, otherwise fall back to legacy
    const txRequest = {
      ...tx,
      gasLimit,
      maxFeePerGas: adjustedMaxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || adjustedMaxFeePerGas,
      nonce: nonce,
      // Ensure proper chainId is set
      chainId: (await provider.getNetwork()).chainId
    };

    console.log('Submitting transaction:', {
      to: txRequest.to,
      from: wallet.address,
      gasLimit: txRequest.gasLimit.toString(),
      maxFeePerGas: ethers.formatUnits(txRequest.maxFeePerGas, 'gwei'),
      maxPriorityFeePerGas: ethers.formatUnits(txRequest.maxPriorityFeePerGas, 'gwei'),
      nonce: txRequest.nonce,
      chainId: txRequest.chainId
    });

    // Send the transaction with retry logic
    let signedTx;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        signedTx = await wallet.sendTransaction(txRequest);
        console.log('Transaction submitted:', signedTx.hash);

        // Wait for transaction to be propagated to the network
        console.log('Waiting for transaction to be propagated to the network...');
        const isPropagated = await waitForTransactionPropagation(provider, signedTx.hash);
        
        if (!isPropagated) {
          throw new Error('Transaction failed to propagate to the network');
        }

        // Verify the transaction was actually sent
        const txResponse = await provider.getTransaction(signedTx.hash);
        if (!txResponse) {
          throw new Error('Transaction was not found on the network after submission');
        }

        console.log('Transaction verified on network:', {
          hash: txResponse.hash,
          nonce: txResponse.nonce,
          gasLimit: txResponse.gasLimit.toString(),
          maxFeePerGas: txResponse.maxFeePerGas ? ethers.formatUnits(txResponse.maxFeePerGas, 'gwei') : 'n/a',
          maxPriorityFeePerGas: txResponse.maxPriorityFeePerGas ? ethers.formatUnits(txResponse.maxPriorityFeePerGas, 'gwei') : 'n/a',
          chainId: txResponse.chainId
        });

        break; // Success - exit retry loop
      } catch (error: any) {
        retryCount++;
        console.error(`Transaction attempt ${retryCount} failed:`, error);
        
        if (retryCount === maxRetries) {
          throw new Error(`Failed to submit transaction after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Update nonce for retry
        txRequest.nonce = await wallet.getNonce();
      }
    }

    if (!signedTx) {
      throw new Error('Failed to submit transaction after all retries');
    }

    // Return initial response with transaction hash
    res.status(202).json(serializeBigInts({ 
      status: 'pending',
      message: 'Vote transaction submitted and verified on network',
      txHash: signedTx.hash,
      estimatedGasCost: ethers.formatEther(estimatedGasCost),
      nonce: txRequest.nonce,
      chainId: txRequest.chainId
    }));

    // Continue monitoring the transaction in the background
    try {
      console.log('Waiting for transaction confirmation...');
      const receipt = await provider.waitForTransaction(signedTx.hash, 1, 180000); // 3 minutes timeout
      
      if (receipt) {
        const actualGasUsed = receipt.gasUsed * (receipt.gasPrice || 0n);
        console.log('Transaction confirmed:', {
          hash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          effectiveGasPrice: ethers.formatUnits(receipt.gasPrice || 0n, 'gwei'),
          actualCost: ethers.formatEther(actualGasUsed),
          status: receipt.status,
          confirmations: receipt.confirmations
        });

        if (receipt.status === 0) {
          console.error('Transaction reverted on chain');
        }
      } else {
        console.error('Transaction receipt is null');
      }
    } catch (confirmError) {
      console.error('Error during transaction confirmation:', confirmError);
    }
    
  } catch (error: any) {
    console.error('Error submitting public vote:', error);
    
    // Provide more specific error messages
    let errorMessage = error.message;
    let statusCode = 500;
    
    if (error.message.includes('user rejected')) {
      errorMessage = 'Transaction rejected by relayer';
      statusCode = 400;
    } else if (error.message.includes('already voted')) {
      errorMessage = 'You have already voted in this poll';
      statusCode = 400;
    } else if (error.message.includes('poll ended')) {
      errorMessage = 'This poll has ended';
      statusCode = 400;
    } else if (error.message.includes('max voters reached')) {
      errorMessage = 'Maximum number of voters has been reached';
      statusCode = 400;
    } else if (error.message.includes('insufficient funds')) {
      errorMessage = 'Insufficient funds for relayer to process transaction';
      statusCode = 500;
    } else if (error.code === 'NETWORK_ERROR') {
      errorMessage = 'Network error while submitting transaction. Please try again.';
      statusCode = 503;
    }
    
    res.status(statusCode).json(serializeBigInts({ 
      error: errorMessage,
      code: error.code || 'UNKNOWN_ERROR'
    }));
  }
});

// Submit private vote as a meta transaction
router.post('/private-vote', async (req: Request, res: Response) => {
  try {
    console.log('Received private vote request:', { 
      pollId: req.body.pollId,
      candidateId: req.body.candidateId,
      voter: req.body.voter,
      expiry: req.body.expiry,
      whitelistSignatureLength: req.body.whitelistSignature?.length || 0,
      voteSignatureLength: req.body.voteSignature?.length || 0
    });
    
    const { pollId, candidateId, voter, expiry, whitelistSignature, voteSignature } = req.body;
    
    // Validate inputs
    if (pollId === undefined || pollId === null || 
        candidateId === undefined || 
        !voter || !expiry || !whitelistSignature || !voteSignature) {
      console.error('Missing required parameters:', { 
        hasPollId: pollId !== undefined && pollId !== null,
        hasCandidateId: candidateId !== undefined,
        hasVoter: !!voter,
        hasExpiry: !!expiry,
        hasWhitelistSig: !!whitelistSignature,
        hasVoteSig: !!voteSignature
      });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Check if the relayer has enough MATIC
    const relayerBalance = await provider.getBalance(wallet.address);
    console.log('Relayer balance:', ethers.formatEther(relayerBalance), 'MATIC');
    
    if (relayerBalance < ethers.parseEther('0.1')) {
      console.error('Relayer balance too low');
      return res.status(500).json({ error: 'Relayer has insufficient funds' });
    }

    // Check if relayer is authorized
    const isAuthorized = await privateVotingContract.authorizedRelayers(wallet.address);
    console.log('Relayer authorization status:', {
      address: wallet.address,
      isAuthorized
    });

    if (!isAuthorized) {
      console.error('Relayer not authorized');
      return res.status(500).json({ error: 'Relayer not authorized for this contract' });
    }

    // Get current gas price and network conditions
    const feeData = await provider.getFeeData();
    console.log('Network fee data:', {
      gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : 'null',
      maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') : 'null',
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : 'null'
    });

    // Check if the poll exists and get creator's allowance
    console.log('Getting poll details...');
    const pollDetails = await privateVotingContract.polls(pollId);
    console.log('Poll details:', pollDetails);

    // Check if poll has ended
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime > Number(pollDetails[2])) {
      console.error('Poll has ended');
      return res.status(400).json({ error: 'Poll has ended' });
    }

    // Check if maximum voters reached
    if (pollDetails[4] >= pollDetails[5]) {
      console.error('Maximum voters reached');
      return res.status(400).json({ error: 'Maximum number of voters has been reached' });
    }

    // Verify whitelist approval signature
    console.log('Verifying whitelist approval signature...');
    const isWhitelistValid = verifyWhitelistApproval(pollId, voter, expiry, whitelistSignature, pollDetails[6]); // pollDetails[6] is whitelistSigner
    if (!isWhitelistValid) {
      console.error('Invalid whitelist signature');
      return res.status(400).json({ error: 'Invalid whitelist signature' });
    }

    // Verify vote signature
    console.log('Verifying vote signature...');
    const isVoteValid = verifySignature(pollId, candidateId, voter, voteSignature, true);
    if (!isVoteValid) {
      console.error('Invalid vote signature');
      return res.status(400).json({ error: 'Invalid vote signature' });
    }

    // Check if user has already voted
    const hasVoted = await privateVotingContract.hasVoted(pollId, voter);
    if (hasVoted) {
      console.error('User has already voted');
      return res.status(400).json({ error: 'You have already voted in this poll' });
    }

    // Estimate gas for this specific transaction
    console.log('Estimating gas for transaction...');
    const estimatedGas = await privateVotingContract.metaVote.estimateGas(
      pollId,
      candidateId,
      voter,
      expiry,
      whitelistSignature,
      voteSignature
    );
    
    console.log('Estimated gas:', estimatedGas.toString());

    // Add 20% buffer to estimated gas
    const gasLimit = (estimatedGas * BigInt(120)) / BigInt(100);
    console.log('Gas limit with buffer:', gasLimit.toString());

    // Calculate gas cost using current network conditions
    const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
    if (!maxFeePerGas) {
      throw new Error('Could not determine gas price from network');
    }

    // Add 20% to gas price for faster processing
    const adjustedMaxFeePerGas = (maxFeePerGas * BigInt(120)) / BigInt(100);
    const estimatedGasCost = gasLimit * adjustedMaxFeePerGas;
    
    console.log('Gas pricing:', {
      maxFeePerGas: ethers.formatUnits(maxFeePerGas, 'gwei'),
      adjustedMaxFeePerGas: ethers.formatUnits(adjustedMaxFeePerGas, 'gwei'),
      estimatedCost: ethers.formatEther(estimatedGasCost)
    });

    // Check if the poll creator has enough funds for gas reimbursement
    const creatorAllowance = await privateVotingContract.relayerAllowance(pollDetails[1], ethers.ZeroAddress);
    console.log('Creator allowance:', ethers.formatEther(creatorAllowance), 'MATIC');

    if (creatorAllowance < estimatedGasCost) {
      console.error('Creator allowance too low');
      return res.status(400).json({ 
        error: 'Poll creator has insufficient funds for gas reimbursement',
        required: ethers.formatEther(estimatedGasCost),
        available: ethers.formatEther(creatorAllowance)
      });
    }

    // Submit the vote transaction
    console.log('Submitting vote transaction...');
    const tx = await privateVotingContract.metaVote(
      pollId,
      candidateId,
      voter,
      expiry,
      whitelistSignature,
      voteSignature,
      {
        gasLimit,
        maxFeePerGas: adjustedMaxFeePerGas
      }
    );
    
    console.log('Vote transaction submitted:', tx.hash);

    // Wait for transaction propagation
    const confirmed = await waitForTransactionPropagation(provider, tx.hash);
    
    res.status(200).json({
      success: confirmed,
      txHash: tx.hash,
      message: confirmed ? 'Vote submitted successfully' : 'Vote submitted but confirmation pending'
    });
    
  } catch (error: any) {
    console.error('Error processing private vote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get public polls
router.get('/public-polls', async (req: Request, res: Response) => {
  try {
    const pollCount = await publicVotingContract.getPollCount();
    const polls = [];
    
    for (let i = 0; i < Number(pollCount); i++) {
      try {
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
      } catch (error: any) {
        console.error(`Error fetching details for public poll #${i}:`, error);
        // Skip this poll if there was an error
      }
    }
    
    res.status(200).json(polls);
  } catch (error: any) {
    console.error('Error fetching public polls:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get private polls
router.get('/private-polls', async (req: Request, res: Response) => {
  try {
    const pollCount = await privateVotingContract.getPollCount();
    const polls = [];
    
    for (let i = 0; i < Number(pollCount); i++) {
      try {
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
      } catch (error: any) {
        console.error(`Error fetching details for private poll #${i}:`, error);
        // Skip this poll if there was an error
      }
    }
    
    res.status(200).json(polls);
  } catch (error: any) {
    console.error('Error fetching private polls:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get poll details
router.get('/poll-details/:contractType/:pollId', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error(`Error fetching poll details for ${req.params.contractType} poll #${req.params.pollId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Add this function after imports and before router definition
async function waitForTransactionPropagation(
  provider: JsonRpcProvider,
  txHash: string,
  maxAttempts: number = 10,
  delayMs: number = 1000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const tx = await provider.getTransaction(txHash);
    if (tx) {
      return true;
    }
    console.log(`Transaction not found in network, attempt ${i + 1}/${maxAttempts}`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
}

export default router; 