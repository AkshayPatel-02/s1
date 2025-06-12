import React, { useState, useEffect } from 'react';
import { useWeb3 } from '@/contexts/Web3Context';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, RefreshCw, Shield, Key } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { whitelistService } from '@/services/whitelistService';

const CONTRACT_ADDRESSES = {
  PRIVATE_VOTING: '0x5a66f9f14e1bdef2e484a3e6a47701526dcb0f04'
};

const DiagnosticTool: React.FC = () => {
  const { state, verifyWhitelist, setEmergencyOverride } = useWeb3();
  const [pollId, setPollId] = useState<string>('0');
  const [signature, setSignature] = useState<string>('');
  const [expiry, setExpiry] = useState<string>(Math.floor(Date.now() / 1000 + 86400).toString());
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{success: boolean; message: string} | null>(null);
  const [emergencyOverrideStatus, setEmergencyOverrideStatus] = useState<boolean>(false);
  const [isDefaultRelayer, setIsDefaultRelayer] = useState<boolean>(false);
  const [whitelistSigner, setWhitelistSigner] = useState<string>('');
  const [privateKey, setPrivateKey] = useState<string>('');
  const [generatedSignature, setGeneratedSignature] = useState<string>('');
  const [isCurrentWalletWhitelistSigner, setIsCurrentWalletWhitelistSigner] = useState<boolean>(false);
  const [voterAddress, setVoterAddress] = useState<string>('');
  const [detailedDebug, setDetailedDebug] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState<boolean>(false);

  // Check if emergency override is active
  useEffect(() => {
    const checkEmergencyOverride = async () => {
      if (!state.provider) return;
      
      try {
        const privateVotingABI = [
          "function emergencyOverrideActive() external view returns (bool)",
          "function defaultRelayerWallet() external view returns (address)"
        ];
        
        const privateContract = new ethers.Contract(
          CONTRACT_ADDRESSES.PRIVATE_VOTING,
          privateVotingABI,
          state.provider
        );
        
        // Check emergency override status
        const isActive = await privateContract.emergencyOverrideActive();
        setEmergencyOverrideStatus(isActive);
        
        // Check if the current user is the default relayer
        if (state.account) {
          const defaultRelayer = await privateContract.defaultRelayerWallet();
          setIsDefaultRelayer(state.account.toLowerCase() === defaultRelayer.toLowerCase());
        }
      } catch (error) {
        console.error('Error checking emergency override status:', error);
      }
    };
    
    checkEmergencyOverride();
  }, [state.provider, state.account]);

  // Check if the current wallet is the whitelist signer
  useEffect(() => {
    const checkWhitelistSigner = async () => {
      if (!state.provider || !state.account || !pollId) return;
      
      try {
        const pollIdNum = parseInt(pollId);
        if (isNaN(pollIdNum)) return;
        
        const privateVotingABI = [
          "function polls(uint256) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, uint64 voterCount, uint64 maxVoters, address whitelistSigner)"
        ];
        
        const privateContract = new ethers.Contract(
          CONTRACT_ADDRESSES.PRIVATE_VOTING,
          privateVotingABI,
          state.provider
        );
        
        // Use polls function to get the whitelistSigner
        const pollDetails = await privateContract.polls(pollIdNum);
        const [title, creator, endTime, candidateCount, voterCount, maxVoters, pollWhitelistSigner] = pollDetails;
        
        setWhitelistSigner(pollWhitelistSigner);
        
        // Check if current wallet is the whitelist signer
        setIsCurrentWalletWhitelistSigner(
          state.account.toLowerCase() === pollWhitelistSigner.toLowerCase()
        );
      } catch (error) {
        console.error('Error checking whitelist signer:', error);
      }
    };
    
    checkWhitelistSigner();
  }, [state.provider, state.account, pollId]);

  // Toggle emergency override
  const toggleEmergencyOverride = async () => {
    if (!state.provider || !state.account) {
      setResult({
        success: false,
        message: "Not connected to wallet"
      });
      return;
    }
    
    try {
      setIsRunning(true);
      
      // Toggle the current status
      const newStatus = !emergencyOverrideStatus;
      
      // Call the function in Web3Context
      const success = await setEmergencyOverride(newStatus);
      
      if (success) {
        setEmergencyOverrideStatus(newStatus);
        setResult({
          success: true,
          message: `Emergency override ${newStatus ? 'enabled' : 'disabled'} successfully`
        });
      } else {
        setResult({
          success: false,
          message: "Failed to set emergency override"
        });
      }
    } catch (error) {
      console.error('Error toggling emergency override:', error);
      setResult({
        success: false,
        message: `Error: ${error.message}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runTest = async () => {
    if (!state.provider || !state.account) {
      setResult({
        success: false,
        message: "Not connected to wallet"
      });
      return;
    }

    try {
      setIsRunning(true);
      setResult(null);

      // Format the signature
      const formattedSignature = signature.startsWith('0x') ? signature : `0x${signature}`;
      const pollIdNum = parseInt(pollId);
      const expiryNum = parseInt(expiry);

      console.log('Running whitelist signature verification test:', {
        pollId: pollIdNum,
        voter: state.account,
        expiry: expiryNum,
        expiryDate: new Date(expiryNum * 1000).toISOString(),
        signature: formattedSignature.substring(0, 10) + '...' + formattedSignature.substring(formattedSignature.length - 8)
      });

      // Use our local verification function instead of calling the contract directly
      const isValid = await verifyWhitelist(
        pollIdNum,
        state.account,
        expiryNum,
        formattedSignature
      );
      
      setResult({
        success: isValid,
        message: isValid 
          ? "Signature is valid! This whitelist signature will work with the contract."
          : "Signature is invalid. The signature verification failed."
      });

    } catch (error) {
      console.error('Diagnostic error:', error);
      setResult({
        success: false,
        message: `Error: ${error.message}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Verify signature manually using EIP-712
  const verifySignatureManually = async () => {
    if (!state.provider || !state.account) {
      setResult({
        success: false,
        message: "Not connected to wallet"
      });
      return;
    }

    try {
      setIsRunning(true);
      setResult(null);

      // Format the signature
      const formattedSignature = signature.startsWith('0x') ? signature : `0x${signature}`;
      const pollIdNum = parseInt(pollId);
      const expiryNum = parseInt(expiry);

      // Get poll details to find the whitelist signer
      const privateVotingABI = [
        "function polls(uint256) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, uint64 voterCount, uint64 maxVoters, address whitelistSigner)"
      ];
      
      const privateContract = new ethers.Contract(
        CONTRACT_ADDRESSES.PRIVATE_VOTING,
        privateVotingABI,
        state.provider
      );
      
      // Use polls function instead of getPollDetails to get the whitelistSigner
      const pollDetails = await privateContract.polls(pollIdNum);
      const [title, creator, endTime, candidateCount, voterCount, maxVoters, whitelistSigner] = pollDetails;
      
      console.log('Poll details:', {
        title,
        creator,
        whitelistSigner
      });

      // EIP-712 domain
      const domain = {
        name: "PrivateVotingSystem",
        version: "1",
        chainId: state.chainId || 137,
        verifyingContract: CONTRACT_ADDRESSES.PRIVATE_VOTING
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
        pollId: pollIdNum,
        voter: state.account,
        expiry: expiryNum
      };
      
      // Verify the signature
      const recoveredAddress = ethers.verifyTypedData(domain, types, value, formattedSignature);
      const isValid = recoveredAddress.toLowerCase() === whitelistSigner.toLowerCase();
      
      console.log('Manual verification result:', {
        recoveredAddress,
        whitelistSigner,
        isValid
      });
      
      setResult({
        success: isValid,
        message: isValid 
          ? `Signature is valid! Recovered signer: ${recoveredAddress}`
          : `Signature is invalid. Expected: ${whitelistSigner}, Got: ${recoveredAddress}`
      });

    } catch (error) {
      console.error('Manual verification error:', error);
      setResult({
        success: false,
        message: `Error: ${error.message}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Generate a signature using the current wallet if it's the whitelist signer
  const generateSignatureWithCurrentWallet = async () => {
    if (!state.provider || !state.account || !state.signer) {
      setResult({
        success: false,
        message: "Not connected to wallet"
      });
      return;
    }
    
    try {
      setIsRunning(true);
      setResult(null);
      const debugLogs: string[] = [];
      
      const pollIdNum = parseInt(pollId);
      const expiryNum = parseInt(expiry);
      
      debugLogs.push(`Step 1: Collecting signature generation parameters`);
      
      // Get poll details to find the whitelist signer
      const privateVotingABI = [
        "function polls(uint256) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, uint64 voterCount, uint64 maxVoters, address whitelistSigner)"
      ];
      
      const privateContract = new ethers.Contract(
        CONTRACT_ADDRESSES.PRIVATE_VOTING,
        privateVotingABI,
        state.provider
      );
      
      // Use polls function to get the whitelistSigner
      debugLogs.push(`Step 2: Retrieving poll details from contract`);
      const pollDetails = await privateContract.polls(pollIdNum);
      const [title, creator, endTime, candidateCount, voterCount, maxVoters, pollWhitelistSigner] = pollDetails;
      
      setWhitelistSigner(pollWhitelistSigner);
      
      debugLogs.push(`- Poll title: ${title}`);
      debugLogs.push(`- Poll creator: ${creator}`);
      debugLogs.push(`- Whitelist signer: ${pollWhitelistSigner}`);
      debugLogs.push(`- Current connected wallet: ${state.account}`);
      
      // Check if current wallet is the whitelist signer
      if (state.account.toLowerCase() !== pollWhitelistSigner.toLowerCase()) {
        debugLogs.push(`- ERROR: Current wallet is not the whitelist signer!`);
        setDetailedDebug(debugLogs);
        setShowDebug(true);
        
        setResult({
          success: false,
          message: `Your current wallet (${state.account}) is not the whitelist signer (${pollWhitelistSigner})`
        });
        return;
      }
      
      // Determine which voter address to use
      const targetVoter = voterAddress && ethers.isAddress(voterAddress) 
        ? voterAddress 
        : state.account;
      
      debugLogs.push(`- Target voter: ${targetVoter}`);
      debugLogs.push(`- Expiry: ${expiryNum} (${new Date(expiryNum * 1000).toISOString()})`);
      
      // Use the EXACT same contract address format as the verification
      const contractAddress = CONTRACT_ADDRESSES.PRIVATE_VOTING;
      const chainId = state.chainId || 137;
      
      debugLogs.push(`\nStep 3: Preparing EIP-712 typed data`);
      debugLogs.push(`- Contract address: ${contractAddress}`);
      debugLogs.push(`- Chain ID: ${chainId}`);
      
      // EIP-712 domain - EXACTLY as used in verification
      const domain = {
        name: "PrivateVotingSystem",
        version: "1",
        chainId: chainId,
        verifyingContract: contractAddress
      };
      
      // The type of the data that was signed - EXACTLY as used in verification
      const types = {
        WhitelistApproval: [
          { name: "pollId", type: "uint256" },
          { name: "voter", type: "address" },
          { name: "expiry", type: "uint256" }
        ]
      };
      
      // The data that was signed - EXACTLY as used in verification
      const value = {
        pollId: pollIdNum,
        voter: targetVoter,
        expiry: expiryNum
      };
      
      debugLogs.push(`- Domain: ${JSON.stringify(domain, null, 2)}`);
      debugLogs.push(`- Types: ${JSON.stringify(types, null, 2)}`);
      debugLogs.push(`- Value: ${JSON.stringify(value, null, 2)}`);
      
      debugLogs.push(`\nStep 4: Generating signature`);
      
      // Generate the signature
      const newSignature = await state.signer.signTypedData(domain, types, value);
      debugLogs.push(`- Generated signature: ${newSignature.substring(0, 10)}...${newSignature.substring(newSignature.length - 8)}`);
      
      // Verify the signature
      debugLogs.push(`\nStep 5: Verifying generated signature`);
      const recoveredAddress = ethers.verifyTypedData(domain, types, value, newSignature);
      const isValid = recoveredAddress.toLowerCase() === pollWhitelistSigner.toLowerCase();
      
      debugLogs.push(`- Recovered address: ${recoveredAddress}`);
      debugLogs.push(`- Expected signer: ${pollWhitelistSigner}`);
      debugLogs.push(`- Signature valid: ${isValid}`);
      
      if (isValid) {
        // Store the signature if it's for the current user
        if (targetVoter.toLowerCase() === state.account.toLowerCase()) {
          await whitelistService.storeSignature(
            pollIdNum,
            targetVoter,
            newSignature,
            expiryNum,
            state.account
          );
          debugLogs.push(`- Signature stored locally for current user`);
        }
        
        setGeneratedSignature(newSignature);
        setSignature(newSignature);
        
        debugLogs.push(`\nStep 6: Success! Signature generated and verified.`);
        setDetailedDebug(debugLogs);
        setShowDebug(true);
        
        setResult({
          success: true,
          message: `Valid signature generated for ${targetVoter}! ${targetVoter.toLowerCase() === state.account.toLowerCase() ? 'Signature has been stored locally.' : 'Share this signature with the voter.'}`
        });
      } else {
        debugLogs.push(`\nStep 6: ERROR! Generated signature failed verification.`);
        setDetailedDebug(debugLogs);
        setShowDebug(true);
        
        setResult({
          success: false,
          message: "Failed to generate a valid signature. Verification failed."
        });
      }
    } catch (error) {
      console.error('Error generating signature:', error);
      setResult({
        success: false,
        message: `Error: ${error.message}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Generate a valid whitelist signature using the correct signer
  const generateValidSignature = async () => {
    if (!state.provider || !state.account) {
      setResult({
        success: false,
        message: "Not connected to wallet"
      });
      return;
    }
    
    try {
      setIsRunning(true);
      setResult(null);
      const debugLogs: string[] = [];
      
      const pollIdNum = parseInt(pollId);
      const expiryNum = parseInt(expiry);
      
      debugLogs.push(`Step 1: Collecting signature generation parameters`);
      
      // Get poll details to find the whitelist signer
      const privateVotingABI = [
        "function polls(uint256) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, uint64 voterCount, uint64 maxVoters, address whitelistSigner)"
      ];
      
      const privateContract = new ethers.Contract(
        CONTRACT_ADDRESSES.PRIVATE_VOTING,
        privateVotingABI,
        state.provider
      );
      
      // Use polls function to get the whitelistSigner
      debugLogs.push(`Step 2: Retrieving poll details from contract`);
      const pollDetails = await privateContract.polls(pollIdNum);
      const [title, creator, endTime, candidateCount, voterCount, maxVoters, pollWhitelistSigner] = pollDetails;
      
      setWhitelistSigner(pollWhitelistSigner);
      
      debugLogs.push(`- Poll title: ${title}`);
      debugLogs.push(`- Poll creator: ${creator}`);
      debugLogs.push(`- Whitelist signer: ${pollWhitelistSigner}`);
      
      if (!privateKey) {
        debugLogs.push(`- ERROR: No private key provided!`);
        setDetailedDebug(debugLogs);
        setShowDebug(true);
        
        setResult({
          success: false,
          message: "Please enter the private key of the whitelist signer"
        });
        return;
      }
      
      // Create a wallet from the private key
      const wallet = new ethers.Wallet(privateKey, state.provider);
      
      debugLogs.push(`- Wallet address from private key: ${wallet.address}`);
      
      // Check if the wallet address matches the whitelist signer
      if (wallet.address.toLowerCase() !== pollWhitelistSigner.toLowerCase()) {
        debugLogs.push(`- ERROR: Private key wallet does not match whitelist signer!`);
        setDetailedDebug(debugLogs);
        setShowDebug(true);
        
        setResult({
          success: false,
          message: `Private key does not match whitelist signer. Expected: ${pollWhitelistSigner}, Got: ${wallet.address}`
        });
        return;
      }
      
      // Determine which voter address to use
      const targetVoter = voterAddress && ethers.isAddress(voterAddress) 
        ? voterAddress 
        : state.account;
      
      debugLogs.push(`- Target voter: ${targetVoter}`);
      debugLogs.push(`- Expiry: ${expiryNum} (${new Date(expiryNum * 1000).toISOString()})`);
      
      // Use the EXACT same contract address format as the verification
      const contractAddress = CONTRACT_ADDRESSES.PRIVATE_VOTING;
      const chainId = state.chainId || 137;
      
      debugLogs.push(`\nStep 3: Preparing EIP-712 typed data`);
      debugLogs.push(`- Contract address: ${contractAddress}`);
      debugLogs.push(`- Chain ID: ${chainId}`);
      
      // EIP-712 domain - EXACTLY as used in verification
      const domain = {
        name: "PrivateVotingSystem",
        version: "1",
        chainId: chainId,
        verifyingContract: contractAddress
      };
      
      // The type of the data that was signed - EXACTLY as used in verification
      const types = {
        WhitelistApproval: [
          { name: "pollId", type: "uint256" },
          { name: "voter", type: "address" },
          { name: "expiry", type: "uint256" }
        ]
      };
      
      // The data that was signed - EXACTLY as used in verification
      const value = {
        pollId: pollIdNum,
        voter: targetVoter,
        expiry: expiryNum
      };
      
      debugLogs.push(`- Domain: ${JSON.stringify(domain, null, 2)}`);
      debugLogs.push(`- Types: ${JSON.stringify(types, null, 2)}`);
      debugLogs.push(`- Value: ${JSON.stringify(value, null, 2)}`);
      
      debugLogs.push(`\nStep 4: Generating signature`);
      
      // Generate the signature
      const newSignature = await wallet.signTypedData(domain, types, value);
      debugLogs.push(`- Generated signature: ${newSignature.substring(0, 10)}...${newSignature.substring(newSignature.length - 8)}`);
      
      // Verify the signature
      debugLogs.push(`\nStep 5: Verifying generated signature`);
      const recoveredAddress = ethers.verifyTypedData(domain, types, value, newSignature);
      const isValid = recoveredAddress.toLowerCase() === pollWhitelistSigner.toLowerCase();
      
      debugLogs.push(`- Recovered address: ${recoveredAddress}`);
      debugLogs.push(`- Expected signer: ${pollWhitelistSigner}`);
      debugLogs.push(`- Signature valid: ${isValid}`);
      
      if (isValid) {
        // Store the signature if it's for the current user
        if (targetVoter.toLowerCase() === state.account.toLowerCase()) {
          await whitelistService.storeSignature(
            pollIdNum,
            targetVoter,
            newSignature,
            expiryNum,
            wallet.address
          );
          debugLogs.push(`- Signature stored locally for current user`);
        }
        
        setGeneratedSignature(newSignature);
        setSignature(newSignature);
        
        debugLogs.push(`\nStep 6: Success! Signature generated and verified.`);
        setDetailedDebug(debugLogs);
        setShowDebug(true);
        
        setResult({
          success: true,
          message: `Valid signature generated for ${targetVoter}! ${targetVoter.toLowerCase() === state.account.toLowerCase() ? 'Signature has been stored locally.' : 'Share this signature with the voter.'}`
        });
      } else {
        debugLogs.push(`\nStep 6: ERROR! Generated signature failed verification.`);
        setDetailedDebug(debugLogs);
        setShowDebug(true);
        
        setResult({
          success: false,
          message: "Failed to generate a valid signature. Verification failed."
        });
      }
    } catch (error) {
      console.error('Error generating signature:', error);
      setResult({
        success: false,
        message: `Error: ${error.message}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Step-by-step verification function
  const performDetailedVerification = async () => {
    if (!state.provider || !state.account) {
      setResult({
        success: false,
        message: "Not connected to wallet"
      });
      return;
    }
    
    try {
      setIsRunning(true);
      setResult(null);
      const debugLogs: string[] = [];
      
      // Format the signature
      const formattedSignature = signature.startsWith('0x') ? signature : `0x${signature}`;
      const pollIdNum = parseInt(pollId);
      const expiryNum = parseInt(expiry);
      
      debugLogs.push(`Step 1: Collecting verification parameters`);
      debugLogs.push(`- Poll ID: ${pollIdNum}`);
      debugLogs.push(`- Voter address: ${state.account}`);
      debugLogs.push(`- Expiry: ${expiryNum} (${new Date(expiryNum * 1000).toISOString()})`);
      debugLogs.push(`- Signature: ${formattedSignature.substring(0, 10)}...${formattedSignature.substring(formattedSignature.length - 8)}`);
      debugLogs.push(`- Signature length: ${formattedSignature.length} characters, ${(formattedSignature.length - 2) / 2} bytes`);
      
      // Get poll details to find the whitelist signer
      debugLogs.push(`\nStep 2: Retrieving poll details from contract`);
      const privateVotingABI = [
        "function polls(uint256) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, uint64 voterCount, uint64 maxVoters, address whitelistSigner)"
      ];
      
      const privateContract = new ethers.Contract(
        CONTRACT_ADDRESSES.PRIVATE_VOTING,
        privateVotingABI,
        state.provider
      );
      
      // Use polls function to get the whitelistSigner
      const pollDetails = await privateContract.polls(pollIdNum);
      const [title, creator, endTime, candidateCount, voterCount, maxVoters, whitelistSigner] = pollDetails;
      
      debugLogs.push(`- Poll title: ${title}`);
      debugLogs.push(`- Poll creator: ${creator}`);
      debugLogs.push(`- Whitelist signer: ${whitelistSigner}`);
      debugLogs.push(`- Current connected wallet: ${state.account}`);
      
      // Get contract address and chain ID
      const contractAddress = CONTRACT_ADDRESSES.PRIVATE_VOTING;
      const chainId = state.chainId || 137;
      
      debugLogs.push(`\nStep 3: Preparing EIP-712 typed data`);
      debugLogs.push(`- Contract address: ${contractAddress}`);
      debugLogs.push(`- Chain ID: ${chainId}`);
      
      // EIP-712 domain
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
        pollId: pollIdNum,
        voter: state.account,
        expiry: expiryNum
      };
      
      debugLogs.push(`- Domain: ${JSON.stringify(domain, null, 2)}`);
      debugLogs.push(`- Types: ${JSON.stringify(types, null, 2)}`);
      debugLogs.push(`- Value: ${JSON.stringify(value, null, 2)}`);
      
      debugLogs.push(`\nStep 4: Verifying signature`);
      
      try {
        // Verify the signature
        const recoveredAddress = ethers.verifyTypedData(domain, types, value, formattedSignature);
        debugLogs.push(`- Recovered address: ${recoveredAddress}`);
        debugLogs.push(`- Expected signer: ${whitelistSigner}`);
        
        const isValid = recoveredAddress.toLowerCase() === whitelistSigner.toLowerCase();
        debugLogs.push(`- Signature valid: ${isValid}`);
        
        if (!isValid) {
          debugLogs.push(`\nStep 5: Verification failed - Attempting alternative verification`);
          
          // Try with different case for the voter address
          const valueWithLowerCase = {
            ...value,
            voter: state.account.toLowerCase()
          };
          
          debugLogs.push(`- Trying with lowercase voter address: ${valueWithLowerCase.voter}`);
          const recoveredAddress2 = ethers.verifyTypedData(domain, types, valueWithLowerCase, formattedSignature);
          const isValid2 = recoveredAddress2.toLowerCase() === whitelistSigner.toLowerCase();
          debugLogs.push(`- Result with lowercase: ${isValid2}`);
          
          // Try with different case for the contract address
          const domainWithLowerCase = {
            ...domain,
            verifyingContract: contractAddress.toLowerCase()
          };
          
          debugLogs.push(`- Trying with lowercase contract address: ${domainWithLowerCase.verifyingContract}`);
          const recoveredAddress3 = ethers.verifyTypedData(domainWithLowerCase, types, value, formattedSignature);
          const isValid3 = recoveredAddress3.toLowerCase() === whitelistSigner.toLowerCase();
          debugLogs.push(`- Result with lowercase contract: ${isValid3}`);
          
          // Try with both lowercase
          debugLogs.push(`- Trying with both lowercase`);
          const recoveredAddress4 = ethers.verifyTypedData(domainWithLowerCase, types, valueWithLowerCase, formattedSignature);
          const isValid4 = recoveredAddress4.toLowerCase() === whitelistSigner.toLowerCase();
          debugLogs.push(`- Result with both lowercase: ${isValid4}`);
        }
        
        setDetailedDebug(debugLogs);
        setShowDebug(true);
        
        setResult({
          success: isValid,
          message: isValid 
            ? `Signature is valid! Recovered signer: ${recoveredAddress}`
            : `Signature is invalid. Expected: ${whitelistSigner}, Got: ${recoveredAddress}`
        });
      } catch (verifyError) {
        debugLogs.push(`- Verification error: ${verifyError.message}`);
        setDetailedDebug(debugLogs);
        setShowDebug(true);
        
        setResult({
          success: false,
          message: `Error: ${verifyError.message}`
        });
      }
    } catch (error) {
      console.error('Manual verification error:', error);
      setResult({
        success: false,
        message: `Error: ${error.message}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  const loadFromStorage = () => {
    const storedPollId = localStorage.getItem('diagnostic_poll_id');
    const storedSignature = localStorage.getItem('diagnostic_whitelist_signature');
    const storedExpiry = localStorage.getItem('diagnostic_whitelist_expiry');
    
    if (storedPollId) setPollId(storedPollId);
    if (storedSignature) setSignature(storedSignature);
    if (storedExpiry) setExpiry(storedExpiry);
  };

  const saveToStorage = () => {
    localStorage.setItem('diagnostic_poll_id', pollId);
    localStorage.setItem('diagnostic_whitelist_signature', signature);
    localStorage.setItem('diagnostic_whitelist_expiry', expiry);
    
    setResult({
      success: true,
      message: 'Diagnostic data saved to localStorage'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Whitelist Diagnostic Tool</CardTitle>
        <CardDescription>
          Test and troubleshoot whitelist signature verification
        </CardDescription>
        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-700">
          <strong>⚠️ Poll Creator Only Tool:</strong> This diagnostic tool should only be accessible to poll creators.
          It contains sensitive functionality that could compromise security if used by unauthorized users.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Emergency Override Section */}
        <div className="p-3 rounded-md bg-amber-50 border border-amber-200 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className={`h-5 w-5 ${emergencyOverrideStatus ? 'text-green-500' : 'text-gray-400'}`} />
              <span className="font-medium">Emergency Override</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${emergencyOverrideStatus ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {emergencyOverrideStatus ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            
            {isDefaultRelayer && (
              <div className="flex items-center space-x-2">
                <Switch
                  checked={emergencyOverrideStatus}
                  disabled={isRunning}
                  id="emergency-override"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleEmergencyOverride}
                  disabled={isRunning || !isDefaultRelayer}
                >
                  {isRunning ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    emergencyOverrideStatus ? 'Disable' : 'Enable'
                  )}
                </Button>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {isDefaultRelayer 
              ? 'As the default relayer, you can enable emergency override to bypass whitelist verification'
              : 'Only the default relayer can toggle emergency override'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="poll-id">Poll ID</Label>
          <Input
            id="poll-id"
            value={pollId}
            onChange={(e) => setPollId(e.target.value)}
            type="number"
            min="0"
          />
        </div>
        
        {/* Voter Address Field */}
        <div className="space-y-2">
          <Label htmlFor="voter-address">Voter Address (optional)</Label>
          <Input
            id="voter-address"
            value={voterAddress}
            onChange={(e) => setVoterAddress(e.target.value)}
            placeholder="0x... (leave empty to use your own address)"
          />
          <p className="text-sm text-gray-500">
            The address of the voter to generate a signature for. If left empty, your own address will be used.
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="expiry">Expiry Timestamp</Label>
          <Input
            id="expiry"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            type="number"
          />
          <p className="text-sm text-gray-500">
            Timestamp (in seconds) when the signature expires
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="signature">Whitelist Signature</Label>
          <Input
            id="signature"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="0x..."
          />
          <p className="text-sm text-gray-500">
            The signature used to verify your whitelist status
          </p>
        </div>
        
        {/* New Signature Generation Section */}
        <div className="p-3 rounded-md bg-blue-50 border border-blue-200 mb-4">
          <div className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-blue-500" />
            <span className="font-medium">Generate Valid Signature</span>
          </div>
          <p className="text-sm text-gray-600 mt-1 mb-3">
            Generate a valid whitelist signature for the specified voter address (or your own address if none specified)
          </p>
          
          {/* Current Wallet Option */}
          {isCurrentWalletWhitelistSigner && (
            <div className="mb-4">
              <Button 
                onClick={generateSignatureWithCurrentWallet} 
                disabled={isRunning}
                className="w-full mb-3"
                variant="secondary"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Using Current Wallet'
                )}
              </Button>
              <p className="text-xs text-green-600">
                Your current wallet is the whitelist signer for this poll!
              </p>
            </div>
          )}
          
          {/* Private Key Option */}
          <div className="space-y-2 mb-3">
            <Label htmlFor="private-key">Whitelist Signer Private Key</Label>
            <Input
              id="private-key"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="0x..."
              type="password"
            />
            <p className="text-sm text-gray-500">
              The private key of the whitelist signer (address: {whitelistSigner || 'unknown'})
            </p>
          </div>
          
          <Button 
            onClick={generateValidSignature} 
            disabled={isRunning || !privateKey}
            className="w-full"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Using Private Key'
            )}
          </Button>
          
          {generatedSignature && (
            <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded text-xs break-all">
              <p className="font-medium mb-1">Generated Signature:</p>
              {generatedSignature}
            </div>
          )}
        </div>
        
        {result && (
          <div className={`p-3 rounded-md ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <div className="flex items-center space-x-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">{result.message}</span>
            </div>
          </div>
        )}
        
        {showDebug && detailedDebug.length > 0 && (
          <div className="p-3 rounded-md bg-gray-50 border border-gray-200 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Detailed Debug Information</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowDebug(false)}
              >
                Hide
              </Button>
            </div>
            <div className="bg-black text-green-400 p-3 rounded text-xs font-mono overflow-auto max-h-96">
              {detailedDebug.map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="space-x-2">
          <Button variant="outline" onClick={loadFromStorage}>
            Load Saved
          </Button>
          <Button variant="outline" onClick={saveToStorage}>
            Save
          </Button>
        </div>
        <div className="space-x-2">
          <Button onClick={runTest} disabled={isRunning}>
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              'Test with Context'
            )}
          </Button>
          <Button onClick={verifySignatureManually} disabled={isRunning} variant="secondary">
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              'Manual Verify'
            )}
          </Button>
          <Button onClick={performDetailedVerification} disabled={isRunning} variant="default">
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Detailed Verification'
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default DiagnosticTool; 