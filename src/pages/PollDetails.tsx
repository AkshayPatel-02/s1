import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useWeb3 } from '@/contexts/Web3Context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Clock, Users, Vote, Trophy, CheckCircle, RefreshCw } from 'lucide-react';
import { Poll, Candidate } from '@/contexts/Web3Context';
import { alchemy } from '@/services/alchemyService';
import TransactionDetails from '@/components/TransactionDetails';
import WhitelistManager from '@/components/WhitelistManager';
import WhitelistedVoters from '@/components/WhitelistedVoters';
import StorageToggle from '@/components/StorageToggle';
import FirebaseStatus from '@/components/FirebaseStatus';
import DiagnosticTool from '@/components/DiagnosticTool';
import { whitelistService } from '@/services/whitelistService';
import { ethers } from 'ethers';

const PollDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getPollDetails, vote, state, getTransactionDetails, verifyWhitelist } = useWeb3();
  
  const [poll, setPoll] = useState<Poll | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [votingStatus, setVotingStatus] = useState<'idle' | 'signing' | 'submitting' | 'confirming'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txDetails, setTxDetails] = useState<any>(null);
  const [gasOption, setGasOption] = useState<'standard' | 'fast' | 'rapid'>('standard');
  const [whitelistSignature, setWhitelistSignature] = useState<string | null>(null);
  const [whitelistExpiry, setWhitelistExpiry] = useState<number | null>(null);
  const [whitelistSignatureInput, setWhitelistSignatureInput] = useState<string>('');
  const [whitelistExpiryInput, setWhitelistExpiryInput] = useState<string>('');
  const [whitelistPollIdInput, setWhitelistPollIdInput] = useState<string>(id || '');
  const [showWhitelistInput, setShowWhitelistInput] = useState(false);
  const [showWhitelistManager, setShowWhitelistManager] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [showDiagnosticTool, setShowDiagnosticTool] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  const isPrivate = searchParams.get('type') === 'private';
  const pollId = parseInt(id || '0');

  // Gas price multipliers
  const gasPriceMultipliers = {
    standard: 1,
    fast: 1.5,
    rapid: 2
  };

  useEffect(() => {
    loadPollDetails();
  }, [pollId, isPrivate, state.isConnected]);

  // Add new effect for checking whitelist status
  useEffect(() => {
    if (isPrivate && poll && state.account) {
      // Check if user is the poll creator
      if (poll.creator.toLowerCase() === state.account.toLowerCase()) {
        setIsCreator(true);
      } else if (!whitelistSignature) {
        getWhitelistSignature();
      }
    }
  }, [isPrivate, poll, state.account]);

  const loadPollDetails = async () => {
    if (!state.isConnected || isNaN(pollId)) return;

    try {
      setIsLoading(true);
      const { poll: pollData, candidates: candidatesData } = await getPollDetails(pollId, isPrivate);
      setPoll(pollData);
      setCandidates(candidatesData);
      
      // Check if user has already voted
      if (state.publicContract || state.privateContract) {
        const contract = isPrivate ? state.privateContract : state.publicContract;
        if (contract && state.account) {
          const voted = await contract.hasVoted(pollId, state.account);
          setHasVoted(voted);
        }
      }
      
      // Check if user is the poll creator
      if (pollData.creator.toLowerCase() === state.account?.toLowerCase()) {
        setIsCreator(true);
      }
    } catch (error) {
      console.error('Error loading poll details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load poll details',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getWhitelistSignature = async () => {
    if (!isPrivate || !state.account || !poll) return null;
    
    try {
      // First check if there's a stored signature for this voter
      const storedSignature = await whitelistService.getSignatureForVoter(pollId, state.account);
      
      if (storedSignature) {
        console.log('Found stored whitelist signature:', storedSignature);
        // Ensure the signature has the 0x prefix
        const formattedSignature = storedSignature.signature.startsWith('0x') ? 
          storedSignature.signature : `0x${storedSignature.signature}`;
          
        setWhitelistSignature(formattedSignature);
        setWhitelistExpiry(storedSignature.expiry);
        
        // Check if signature is expired
        const now = Math.floor(Date.now() / 1000);
        if (storedSignature.expiry < now) {
          console.log('Stored signature is expired, will need to regenerate');
          toast({
            title: 'Whitelist Signature Expired',
            description: 'Your whitelist signature has expired. Please request a new one from the poll creator.',
            variant: 'destructive',
          });
          return false;
        }
        
        return true;
      }
      
      // Get the whitelist signer from the contract's polls function
      const pollDetails = await state.privateContract?.polls(pollId);
      
      // Log the structure of pollDetails to help debug
      console.log('Poll details from contract:', pollDetails);
      
      // Add safe check for pollDetails existence and structure
      if (!pollDetails || !Array.isArray(pollDetails)) {
        throw new Error('Failed to retrieve poll details from contract');
      }
      
      // Get current chain ID for domain data
      const chainId = state.chainId || (await state.provider?.getNetwork())?.chainId || 137;
      console.log(`Current chain ID: ${chainId}`);
      
      // Extract the whitelistSigner from the contract's poll details
      const [title, creator, endTime, candidateCount, voterCount, maxVoters, whitelistSigner] = pollDetails;
      console.log('Poll creator:', creator);
      console.log('Whitelist signer from contract:', whitelistSigner);
      
      // Create expiry timestamp (7 days from now)
      const expiry = Math.floor(Date.now() / 1000) + (7 * 86400); // 7 days
      console.log('Setting whitelist expiry to:', new Date(expiry * 1000).toISOString());
      
      // Store the expiry regardless of whether user is creator or not
      setWhitelistExpiry(expiry);
      
      // If user is the poll creator, they need to sign their own whitelist approval
      if (state.account.toLowerCase() === whitelistSigner.toLowerCase()) {
        console.log('User is poll creator and whitelist signer - generating self-whitelist signature');
        
        // Get contract address from the contract instance
        if (!state.privateContract?.target) {
          throw new Error('Private voting contract not initialized');
        }
        
        const contractAddress = state.privateContract.target.toString();
        console.log(`Using contract address: ${contractAddress}`);
        
        // Clear any previous signatures for this poll/voter combination
        localStorage.removeItem(`whitelist_signatures_${pollId}`);
        
        // Use the whitelist service to generate the signature
        const { signature } = await whitelistService.generateSignature(
          state.signer!,
          pollId,
          state.account,
          contractAddress,
          Number(chainId),
          7 // 7 days expiry
        );
        
        console.log(`Generated whitelist signature: ${signature}`);
        
        if (!signature) {
          throw new Error('Failed to generate whitelist signature');
        }
        
        // Verify the signature we just generated with the contract
        try {
          const isValid = await verifyWhitelist(pollId, state.account, expiry, signature);
          if (!isValid) {
            console.error('Self-generated signature failed contract verification!');
          } else {
            console.log('Self-generated signature verified successfully by contract');
          }
        } catch (verifyError) {
          console.error('Error verifying self-generated signature:', verifyError);
        }
        
        setWhitelistSignature(signature);
        return true;
      }
      
      // For non-creators, show the whitelist input UI
      setShowWhitelistInput(true);
      toast({
        title: 'Whitelist Verification Required',
        description: `Please contact the poll creator (${whitelistSigner.slice(0, 6)}...${whitelistSigner.slice(-4)}) to get whitelisted.`,
        duration: 10000,
      });

      return false;
    } catch (error: any) {
      console.error('Error checking whitelist status:', error);
      
      toast({
        title: 'Error',
        description: `Failed to check whitelist status: ${error.message}`,
        variant: 'destructive',
      });
      return false;
    }
  };

  const handleWhitelistSignatureSubmit = async () => {
    if (!whitelistSignatureInput) {
      toast({
        title: 'Error',
        description: 'Please enter a whitelist signature',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Clear any existing signatures for this poll
      await whitelistService.clearSignatures(pollId);
      
      let formattedSignature = '';
      let expiry = 0;
      let parsedPollId = pollId;
      
      // Try to parse input as JSON first
      try {
        // Check if input is JSON format
        if (whitelistSignatureInput.trim().startsWith('{') && whitelistSignatureInput.trim().endsWith('}')) {
          const parsedData = JSON.parse(whitelistSignatureInput);
          
          // Extract values from JSON
          if (parsedData.signature) {
            formattedSignature = parsedData.signature.startsWith('0x') ? 
              parsedData.signature : `0x${parsedData.signature}`;
          } else {
            throw new Error('Missing signature in JSON data');
          }
          
          // Use provided expiry or default
          expiry = parsedData.expiry || Math.floor(Date.now() / 1000) + (7 * 86400);
          
          // Use provided pollId or default to current poll
          parsedPollId = parsedData.pollId || pollId;
        } else {
          // Not JSON, use individual field values
          formattedSignature = whitelistSignatureInput.startsWith('0x') ? 
        whitelistSignatureInput : `0x${whitelistSignatureInput}`;
          
          // Use input expiry or default
          expiry = whitelistExpiryInput ? parseInt(whitelistExpiryInput) : Math.floor(Date.now() / 1000) + (7 * 86400);
          
          // Use input pollId or default
          parsedPollId = whitelistPollIdInput ? parseInt(whitelistPollIdInput) : pollId;
        }
      } catch (parseError) {
        console.warn('Failed to parse input as JSON, using individual fields:', parseError);
        // Use individual field values
        formattedSignature = whitelistSignatureInput.startsWith('0x') ? 
          whitelistSignatureInput : `0x${whitelistSignatureInput}`;
        
        // Use input expiry or default
        expiry = whitelistExpiryInput ? parseInt(whitelistExpiryInput) : Math.floor(Date.now() / 1000) + (7 * 86400);
        
        // Use input pollId or default
        parsedPollId = whitelistPollIdInput ? parseInt(whitelistPollIdInput) : pollId;
      }
      
      console.log(`Verifying whitelist signature: ${formattedSignature.substring(0, 10)}...`);
      console.log(`Expiry: ${expiry} (${new Date(expiry * 1000).toISOString()})`);
      console.log(`Signature length: ${formattedSignature.length} characters, ${(formattedSignature.length - 2) / 2} bytes`);
      console.log(`Poll ID: ${parsedPollId}`);
      
      // Standard ECDSA signature should be 65 bytes (or 132 characters in hex including 0x)
      if (formattedSignature.length !== 132) {
        console.warn(`Unusual signature length: ${formattedSignature.length}. Expected 132 characters for standard ECDSA signature.`);
      }
      
      // Get the poll details from the contract to ensure we have the correct whitelist signer
      const pollDetails = await state.privateContract?.polls(parsedPollId);
      if (!pollDetails) {
        throw new Error('Failed to retrieve poll details');
      }
      
      // Destructure the tuple correctly
      const [title, creator, endTime, candidateCount, voterCount, maxVoters, whitelistSigner] = pollDetails;
      
      console.log('Poll details for verification:');
      console.log('- Poll ID:', parsedPollId);
      console.log('- Whitelist signer:', whitelistSigner);
      console.log('- Current account:', state.account);
      
      // Get contract address and chain ID
      const contractAddress = state.privateContract?.target.toString();
      const chainId = state.chainId || 137;
      
      console.log('Verification parameters:');
      console.log('- Contract address:', contractAddress);
      console.log('- Chain ID:', chainId);
      
      // EIP-712 domain - EXACTLY as used in verification in the contract
      const domain = {
        name: "PrivateVotingSystem",
        version: "1",
        chainId: chainId,
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
        pollId: parsedPollId,
        voter: state.account!,
        expiry: expiry
      };
      
      console.log('Verification data:');
      console.log('- Domain:', JSON.stringify(domain));
      console.log('- Types:', JSON.stringify(types));
      console.log('- Value:', JSON.stringify(value));
      
      // First try local verification using ethers.js
      try {
        const recoveredAddress = ethers.verifyTypedData(domain, types, value, formattedSignature);
        console.log('Recovered address from signature:', recoveredAddress);
        console.log('Expected whitelist signer:', whitelistSigner);
        
        const isLocallyValid = recoveredAddress.toLowerCase() === whitelistSigner.toLowerCase();
        console.log('Local verification result:', isLocallyValid);
        
        if (!isLocallyValid) {
          console.warn('Local verification failed, but trying contract verification anyway');
        }
      } catch (verifyError) {
        console.error('Local verification error:', verifyError);
        // Continue with contract verification even if local verification fails
      }
      
      // Verify the signature using our local verification function
      const isValid = await verifyWhitelist(parsedPollId, state.account!, expiry, formattedSignature);
      
      if (!isValid) {
        throw new Error('Invalid whitelist signature');
      }

      // Store the valid signature
      setWhitelistSignature(formattedSignature);
      setWhitelistExpiry(expiry);
      setShowWhitelistInput(false);
      
      // Store the signature in the whitelist service
      await whitelistService.storeSignature(
        parsedPollId,
        state.account!,
        formattedSignature,
        expiry,
        state.account! // createdBy
      );

      toast({
        title: 'Verification Successful',
        description: 'Your whitelist signature has been verified. You can now vote in this poll.',
        variant: 'success',
      });
    } catch (error: any) {
      console.error('Error verifying whitelist signature:', error);
      
      // Create a more professional error message
      let errorMessage = 'Invalid whitelist signature. Please make sure you have the correct signature from the poll creator.';
      
      if (error.message?.includes('format') || error.message?.includes('length')) {
        errorMessage = 'Invalid signature format. The signature should be the correct length.';
      } else if (error.message?.includes('expired')) {
        errorMessage = 'This whitelist signature has expired. Please request a new one from the poll creator.';
      } else if (error.message?.includes('verification failed')) {
        errorMessage = 'Signature verification failed. This signature may not be valid for this poll or your address.';
      } else if (error.message?.includes('JSON')) {
        errorMessage = 'Invalid JSON format. Please provide a valid signature or properly formatted JSON.';
      }
      
      toast({
        title: 'Verification Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleVote = async () => {
    if (selectedCandidate === -1) {
      toast({
        title: 'Error',
        description: 'Please select a candidate to vote for',
        variant: 'destructive',
      });
      return;
    }

    // Ensure selectedCandidate is a valid index
    if (candidates.length === 0 || selectedCandidate >= candidates.length) {
      toast({
        title: 'Error',
        description: 'Invalid candidate selection',
        variant: 'destructive',
      });
      return;
    }

    // For private polls, check if we have a valid whitelist signature
    if (isPrivate) {
      // Always ensure we have a valid whitelist signature, even for the creator
      if (!whitelistSignature || !whitelistExpiry) {
        // Try to get or generate a whitelist signature
        const hasSignature = await getWhitelistSignature();
        if (!hasSignature) {
      toast({
        title: 'Error',
        description: 'You need to be whitelisted to vote in this poll. Please verify your whitelist signature first.',
        variant: 'destructive',
      });
      return;
        }
      }
    }

    try {
      // Check if user has already voted
      if (state.account) {
        const contract = isPrivate ? state.privateContract : state.publicContract;
        if (contract) {
          const alreadyVoted = await contract.hasVoted(pollId, state.account);
          if (alreadyVoted) {
            toast({
              title: 'Already Voted',
              description: 'You have already voted in this poll.',
              variant: 'destructive',
            });
            setHasVoted(true);
            return;
          }
        }
      }

      setIsVoting(true);
      setVotingStatus('signing');
      console.log('Voting with parameters:', {
        pollId,
        candidateId: selectedCandidate,
        isPrivate,
        isCreator,
        whitelistSignature: whitelistSignature ? whitelistSignature.substring(0, 10) + '...' : null,
        whitelistSignatureLength: whitelistSignature?.length,
        whitelistExpiry,
        currentTime: Math.floor(Date.now() / 1000)
      });
      
      // Get current gas price
      const gasPrice = await state.provider?.getFeeData();
      console.log("Current gas price:", gasPrice);
      
      // Define gas override types to handle both EIP-1559 and legacy transactions
      type GasOverrides = {
        gasPrice?: bigint;
        gasLimit?: bigint;
        maxFeePerGas?: bigint;
        maxPriorityFeePerGas?: bigint;
      };
      
      // Apply multiplier based on selected speed
      let overrides: GasOverrides = {};
      if (gasPrice) {
        const multiplier = gasPriceMultipliers[gasOption];
        
        // Check if EIP-1559 is supported (maxFeePerGas exists)
        if (gasPrice.maxFeePerGas && gasPrice.maxPriorityFeePerGas) {
          const maxFeePerGas = BigInt(Math.floor(Number(gasPrice.maxFeePerGas) * multiplier));
          const maxPriorityFeePerGas = BigInt(Math.floor(Number(gasPrice.maxPriorityFeePerGas) * multiplier));
          
          overrides = { maxFeePerGas, maxPriorityFeePerGas };
          console.log("Using EIP-1559 gas overrides:", overrides);
        } 
        // Fall back to legacy gas price if EIP-1559 is not available
        else if (gasPrice.gasPrice) {
          const gasLimit = BigInt(400000); // Set a reasonable gas limit
          const adjustedGasPrice = BigInt(Math.floor(Number(gasPrice.gasPrice) * multiplier));
          
          overrides = { 
            gasPrice: adjustedGasPrice,
            gasLimit 
          };
          console.log("Using legacy gas overrides:", overrides);
        }
      }
      
      let result;
      
      // Try direct voting if we're having issues with relayer
      const useDirectVoting = false;
      
      if (useDirectVoting && isPrivate) {
        // Direct voting method that bypasses the relayer
        setVotingStatus('submitting');
        console.log('Using direct voting method (bypassing relayer)');
        
        try {
          // First try to verify the whitelist status
          console.log('Verifying whitelist status before voting...');
          
          // Ensure we have a valid signature before proceeding
          if (!whitelistSignature || !whitelistExpiry) {
            console.log('No whitelist signature available, attempting to generate one');
            
            // Generate a signature for the current user
            const contractAddress = state.privateContract?.target.toString();
            if (!contractAddress || !state.signer) {
              throw new Error('Contract not properly initialized');
            }
            
            // For poll creators or regular users, we need a valid signature
            const { signature: newSignature, expiry: newExpiry } = await whitelistService.generateSignature(
              state.signer,
              pollId,
              state.account!,
              contractAddress,
              state.chainId || 137,
              7 // 7 days expiry
            );
            
            console.log(`Generated new signature: ${newSignature.substring(0, 10)}...`);
            console.log(`Expiry: ${newExpiry} (${new Date(newExpiry * 1000).toISOString()})`);
            
            // Store the valid signature
            setWhitelistSignature(newSignature);
            setWhitelistExpiry(newExpiry);
            
            // Use the newly generated signature
            const tx = await state.privateContract?.vote(
              pollId,
              selectedCandidate,
              newExpiry,
              newSignature,
              overrides
            );
            
            console.log('Transaction submitted:', tx);
            setTxHash(tx.hash);
            setVotingStatus('confirming');
            
            // Wait for transaction confirmation
            const receipt = await tx.wait();
            console.log('Transaction confirmed:', receipt);
            
            result = {
              success: true,
              txHash: tx.hash,
              blockNumber: receipt.blockNumber,
              gasUsed: receipt.gasUsed?.toString(),
              message: 'Vote confirmed'
            };
          } else {
            // Use the existing signature
            console.log('Using existing whitelist signature');
            console.log(`Signature: ${whitelistSignature.substring(0, 10)}...`);
            console.log(`Expiry: ${whitelistExpiry} (${new Date(whitelistExpiry * 1000).toISOString()})`);
            
            // Try to estimate gas first to catch any errors before sending
            console.log('Estimating gas for transaction with parameters:', {
          pollId,
          candidateId: selectedCandidate,
          expiry: whitelistExpiry,
              signature: whitelistSignature.substring(0, 10) + '...'
            });
            
            try {
              // Ensure candidateId is a valid number
              if (selectedCandidate < 0 || selectedCandidate >= candidates.length) {
                throw new Error(`Invalid candidate ID: ${selectedCandidate}. Must be between 0 and ${candidates.length - 1}`);
              }
              
              console.log(`Selected candidate: ${selectedCandidate} (${candidates[selectedCandidate]?.name || 'Unknown'})`);
              
              const estimatedGas = await state.privateContract?.vote.estimateGas(
                pollId,
                selectedCandidate,
                whitelistExpiry,
                whitelistSignature
              );
              
              console.log('Estimated gas:', estimatedGas?.toString());
              
              // Set gas limit based on estimate
              overrides.gasLimit = estimatedGas ? estimatedGas * BigInt(12) / BigInt(10) : BigInt(400000); // Add 20% buffer
            } catch (gasError) {
              console.error('Gas estimation failed:', gasError);
              // Use default gas limit
              overrides.gasLimit = BigInt(400000);
            }
            
            console.log('Submitting transaction with gas limit:', overrides.gasLimit.toString());
            
        const tx = await state.privateContract?.vote(
          pollId,
          selectedCandidate,
          whitelistExpiry,
          whitelistSignature,
          overrides
        );
        
        console.log('Transaction submitted:', tx);
        setTxHash(tx.hash);
        setVotingStatus('confirming');
        
        // Wait for transaction confirmation
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);
        
        result = {
          success: true,
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed?.toString(),
          message: 'Vote confirmed'
        };
          }
        } catch (directVoteError) {
          console.error('Error in direct voting:', directVoteError);
          
          // Try to parse any revert reason
          let errorMessage = directVoteError.message || 'Unknown error';
          if (errorMessage.includes('execution reverted')) {
            const reasonMatch = errorMessage.match(/reason="([^"]+)"/);
            if (reasonMatch && reasonMatch[1]) {
              errorMessage = `Contract error: ${reasonMatch[1]}`;
            }
          }
          
          throw new Error(`Voting failed: ${errorMessage}`);
        }
      } else {
        // Call the vote function with the stored whitelist signature and expiry
        setVotingStatus('submitting');
        result = await vote(
          pollId, 
          selectedCandidate, 
          isPrivate, 
          whitelistSignature || undefined, 
          whitelistExpiry || undefined, 
          overrides
        );
      }
      
      // Store the transaction hash
      if (result && result.txHash) {
        setTxHash(result.txHash);
        setVotingStatus('confirming');
        
        // Add a slight delay to show the confirming status
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Fetch transaction details using Alchemy
        try {
          const details = await getTransactionDetails(result.txHash);
          setTxDetails(details);
          console.log("Transaction details:", details);
        } catch (txError) {
          console.error("Error fetching transaction details:", txError);
        }
      }
      
      // Update the UI state to reflect the vote
      setHasVoted(true);
      
      // Update the candidate vote count in the local state
      setCandidates(prevCandidates => {
        return prevCandidates.map((candidate, idx) => {
          if (idx === selectedCandidate) {
            return {
              ...candidate,
              voteCount: candidate.voteCount + 1
            };
          }
          return candidate;
        });
      });
      
      // Update the poll voter count in the local state
      setPoll(prevPoll => {
        if (!prevPoll) return null;
        return {
          ...prevPoll,
          voterCount: prevPoll.voterCount + 1
        };
      });
      
      // Reset the voting status
      setVotingStatus('idle');
      
      // Refresh poll details after a short delay
      setTimeout(() => {
        loadPollDetails();
      }, 3000);
      
      // Show success message
      toast({
        title: "Success!",
        description: "Your vote has been recorded successfully.",
        variant: "default",
      });
    } catch (error) {
      console.error('Error voting:', error);
      setVotingStatus('idle');
      
      // Create a more professional error message
      let errorMessage = 'Unable to submit your vote. Please try again later.';
      
      // Handle specific error cases
      if (error.message?.includes('user rejected') || error.code === 'ACTION_REJECTED') {
        errorMessage = 'Transaction cancelled. You declined the transaction in your wallet.';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds to complete this transaction.';
      } else if (error.message?.includes('gas')) {
        errorMessage = 'Network is congested. Please try again with adjusted gas settings.';
      } else if (error.message?.includes('whitelist')) {
        errorMessage = 'Whitelist verification failed. Please ensure you have a valid signature from the poll creator.';
      } else if (error.message?.includes('already voted')) {
        errorMessage = 'You have already voted in this poll.';
      } else if (error.message?.includes('poll ended') || error.message?.includes('ended')) {
        errorMessage = 'This poll has ended and is no longer accepting votes.';
      } else if (error.message?.includes('max voters')) {
        errorMessage = 'This poll has reached its maximum number of voters.';
      }
      
      toast({
        title: 'Voting Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsVoting(false);
    }
  };

  if (!state.isConnected) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold mb-6">Poll Details</h1>
        <p className="text-gray-600 mb-8">Please connect your wallet to view and vote in polls.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4 w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold mb-6">Poll Not Found</h1>
        <p className="text-gray-600 mb-8">The requested poll could not be found.</p>
        <Button onClick={() => navigate('/polls')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Polls
        </Button>
      </div>
    );
  }

  const isEnded = Date.now() / 1000 > poll.endTime;
  const endDate = new Date(poll.endTime * 1000);
  const totalVotes = candidates.reduce((sum, candidate) => sum + candidate.voteCount, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => navigate(isPrivate ? '/private-polls' : '/polls')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to {isPrivate ? 'Private' : 'Public'} Polls
        </Button>
        
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">{poll.title}</h1>
          <div className="flex items-center gap-2">
            {isPrivate && isCreator && <StorageToggle />}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadPollDetails} 
              disabled={isLoading}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Blockchain Data
            </Button>
          </div>
        </div>

        {isPrivate && isCreator && <FirebaseStatus />}

        {isPrivate && (
          <div className="mb-4 flex justify-end space-x-2">
            {isCreator && (
              <>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowDiagnosticTool(!showDiagnosticTool)}
            >
              {showDiagnosticTool ? 'Hide Diagnostic Tool' : 'Show Diagnostic Tool'}
            </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowDebugInfo(!showDebugInfo)}
                >
                  {showDebugInfo ? 'Hide Debug Info' : 'Show Debug Info'}
                </Button>
              </>
            )}
          </div>
        )}

        {isPrivate && showDebugInfo && isCreator && (
          <div className="mb-6 p-4 bg-gray-50 border rounded-md">
            <h3 className="text-lg font-medium mb-2">Debug Information</h3>
            <div className="bg-black text-green-400 p-3 rounded text-xs font-mono overflow-auto max-h-96">
              <div>Poll ID: {pollId}</div>
              <div>Current Account: {state.account}</div>
              <div>Is Creator: {isCreator ? 'Yes' : 'No'}</div>
              <div>Has Whitelist Signature: {whitelistSignature ? 'Yes' : 'No'}</div>
              {whitelistSignature && (
                <div>Signature: {whitelistSignature.substring(0, 10)}...{whitelistSignature.substring(whitelistSignature.length - 8)}</div>
              )}
              {whitelistExpiry && (
                <div>Expiry: {whitelistExpiry} ({new Date(whitelistExpiry * 1000).toISOString()})</div>
              )}
            </div>
          </div>
        )}

        {isPrivate && showDiagnosticTool && isCreator && (
          <div className="mb-6">
            <DiagnosticTool />
          </div>
        )}

        <div className="flex items-center space-x-4 mb-4">
          <div className="flex space-x-2">
            {isPrivate && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                Private
              </Badge>
            )}
            <Badge variant={isEnded ? "destructive" : "default"}>
              {isEnded ? 'Ended' : 'Active'}
            </Badge>
            {hasVoted && (
              <Badge variant="outline" className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Voted
              </Badge>
            )}
            {isCreator && (
              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                Creator
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-6 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <Users className="w-4 h-4" />
            <span>{poll.voterCount}/{poll.maxVoters} voters</span>
          </div>
          <div className="flex items-center space-x-1">
            <Vote className="w-4 h-4" />
            <span>{poll.candidateCount} candidates</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4" />
            <span>{isEnded ? 'Ended' : 'Ends'} {endDate.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Voting Section */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Vote className="w-5 h-5" />
                <span>{isEnded ? 'Final Results' : 'Cast Your Vote'}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {candidates.map((candidate, index) => {
                const percentage = totalVotes > 0 ? (candidate.voteCount / totalVotes) * 100 : 0;
                const isWinner = isEnded && candidate.voteCount === Math.max(...candidates.map(c => c.voteCount));
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {!isEnded && !hasVoted && (
                          <input
                            type="radio"
                            id={`candidate-${index}`}
                            name="candidate"
                            value={index}
                            checked={selectedCandidate === index}
                            onChange={() => setSelectedCandidate(index)}
                            className="w-4 h-4 text-primary"
                            title={`Select ${candidate.name}`}
                          />
                        )}
                        <Label 
                          htmlFor={`candidate-${index}`}
                          className={`font-medium ${isWinner ? 'text-primary font-bold' : ''} flex items-center space-x-2`}
                        >
                          {isWinner && <Trophy className="w-4 h-4 text-yellow-500" />}
                          <span>{candidate.name}</span>
                        </Label>
                      </div>
                      <div className="text-sm text-gray-600">
                        {candidate.voteCount} votes ({percentage.toFixed(1)}%)
                      </div>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          isWinner ? 'bg-yellow-500' : 'bg-gradient-primary'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              
              {!isEnded && !hasVoted && (
                <div className="pt-4 space-y-4">
                  {isPrivate && !whitelistSignature && (
                    <div className="space-y-4">
                      <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
                        <h4 className="text-sm font-medium text-yellow-800 mb-1">Whitelist Required</h4>
                        <p className="text-xs text-yellow-600">
                          This is a private poll. You need to be whitelisted by the poll creator to vote.
                          {!showWhitelistInput && (
                            <Button
                              variant="link"
                              className="text-yellow-800 p-0 h-auto text-xs ml-1"
                              onClick={() => setShowWhitelistInput(true)}
                            >
                              Have a whitelist signature? Click here
                            </Button>
                          )}
                        </p>
                      </div>

                      {showWhitelistInput && (
                        <div className="space-y-2">
                          <Label htmlFor="whitelist-signature">Whitelist Signature</Label>
                            <input
                              id="whitelist-signature"
                              type="text"
                              value={whitelistSignatureInput}
                              onChange={(e) => setWhitelistSignatureInput(e.target.value)}
                            placeholder="Paste your whitelist signature here (0x...)"
                            className="w-full px-3 py-2 border rounded-md text-sm"
                          />
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor="whitelist-expiry">Expiry Timestamp</Label>
                              <div className="flex">
                                <input
                                  id="whitelist-expiry"
                                  type="text"
                                  value={whitelistExpiryInput}
                                  onChange={(e) => setWhitelistExpiryInput(e.target.value)}
                                  placeholder="Expiry timestamp (seconds)"
                                  className="w-full px-3 py-2 border rounded-md text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="whitelist-poll-id">Poll ID</Label>
                              <div className="flex">
                                <input
                                  id="whitelist-poll-id"
                                  type="text"
                                  value={whitelistPollIdInput}
                                  onChange={(e) => setWhitelistPollIdInput(e.target.value)}
                                  placeholder="Poll ID"
                                  className="w-full px-3 py-2 border rounded-md text-sm"
                                />
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="ml-1 text-xs"
                                  onClick={() => setWhitelistPollIdInput(id || '')}
                                  title="Use current poll ID"
                                >
                                  Use Current
                            </Button>
                          </div>
                            </div>
                          </div>
                          
                          <Button 
                            onClick={handleWhitelistSignatureSubmit}
                            className="w-full mt-2"
                          >
                            Verify Whitelist Credentials
                          </Button>
                          
                          <p className="text-xs text-gray-500 mt-1">
                            Contact the poll creator to get your whitelist signature, expiry timestamp, and poll ID.
                          </p>
                          
                          <div className="bg-blue-50 p-3 rounded-md border border-blue-200 mt-2">
                            <p className="text-xs text-blue-600">
                              Once verified, you'll only need to sign a message with your wallet.
                              You will not pay any gas fees - all transaction costs are covered by the poll creator.
                            </p>
                          </div>
                        
                        </div>
                      )}
                    </div>
                  )}

                  {!isPrivate && !hasVoted && (
                    <div className="bg-blue-50 p-3 rounded-md border border-blue-200 mb-4">
                    <p className="text-xs text-blue-600">
                        Select a candidate and click "Submit Vote" to cast your vote.
                    </p>
                  </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Transaction Speed</Label>
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant={gasOption === 'standard' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setGasOption('standard')}
                        className="flex-1"
                      >
                        Standard
                      </Button>
                      <Button
                        type="button"
                        variant={gasOption === 'fast' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setGasOption('fast')}
                        className="flex-1"
                      >
                        Fast (1.5x)
                      </Button>
                      <Button
                        type="button"
                        variant={gasOption === 'rapid' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setGasOption('rapid')}
                        className="flex-1"
                      >
                        Rapid (2x)
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Higher gas price increases the chance of your transaction being processed quickly.
                      The poll creator pays all gas fees from their deposit.
                    </p>
                  </div>

                  <Button
                    onClick={handleVote}
                    disabled={selectedCandidate === -1 || isVoting}
                    className="w-full btn-gradient"
                  >
                    {isVoting ? (
                      <div className="flex items-center justify-center space-x-2">
                        <span className="animate-spin">
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </span>
                        <span>
                          {votingStatus === 'signing' && (
                            <>
                              Waiting for signature...
                            </>
                          )}
                          {votingStatus === 'submitting' && 'Submitting vote...'}
                          {votingStatus === 'confirming' && 'Confirming transaction...'}
                        </span>
                      </div>
                    ) : (
                      'Submit Vote'
                    )}
                  </Button>
                </div>
              )}

              {hasVoted && (
                <div className="pt-4 text-center space-y-2">
                  <div className="flex items-center justify-center space-x-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Your vote has been recorded!</span>
                  </div>
                  {txHash && (
                    <div className="space-y-4">
                      <div className="text-sm text-gray-500">
                        <a 
                          href={`https://polygonscan.com/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-primary"
                        >
                          View transaction on PolygonScan
                        </a>
                      </div>
                      
                      <TransactionDetails txHash={txHash} className="mt-4" />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Whitelist Manager for poll creators */}
          {isPrivate && isCreator && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Whitelist Management</h2>
                <Button 
                  variant="outline" 
                  onClick={() => setShowWhitelistManager(!showWhitelistManager)}
                >
                  {showWhitelistManager ? 'Hide Manager' : 'Show Manager'}
                </Button>
              </div>
              
              {showWhitelistManager && (
                <>
                  <WhitelistManager pollId={pollId} isCreator={isCreator} />
                  <div className="mt-4">
                    <WhitelistedVoters pollId={pollId} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Poll Information */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Poll Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Creator</Label>
                <p className="text-sm font-mono">
                  {poll.creator.slice(0, 6)}...{poll.creator.slice(-4)}
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-500">Total Votes</Label>
                <p className="text-lg font-semibold">{totalVotes}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-500">Participation Rate</Label>
                <p className="text-lg font-semibold">
                  {((poll.voterCount / poll.maxVoters) * 100).toFixed(1)}%
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-500">Status</Label>
                <p className={`text-lg font-semibold ${isEnded ? 'text-red-600' : 'text-green-600'}`}>
                  {isEnded ? 'Ended' : 'Active'}
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-500">
                  {isEnded ? 'Ended' : 'Ends'}
                </Label>
                <p className="text-sm">{endDate.toLocaleString()}</p>
              </div>

              {isPrivate && isCreator && (
                <div className="mt-4 pt-4 border-t">
                  <Label className="text-sm font-medium text-gray-500">Whitelist Management</Label>
                  <p className="text-sm mb-2">
                    As the poll creator, you can manage whitelist signatures for voters.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowWhitelistManager(!showWhitelistManager)}
                    className="w-full"
                  >
                    {showWhitelistManager ? 'Hide Whitelist Manager' : 'Manage Whitelist'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PollDetails;
