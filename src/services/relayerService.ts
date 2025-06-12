/**
 * Service for interacting with the relayer API
 */

const API_BASE_URL = import.meta.env.VITE_RELAYER_API_URL || 'http://localhost:3001/api';

// Helper function to convert hex string to bytes array
const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
};

// Helper function to convert bytes array to hex string
const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Get the relayer's address
 */
export const getRelayerAddress = async (): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/relayer-address`);
    if (!response.ok) {
      throw new Error(`Failed to get relayer address: ${response.statusText}`);
    }
    const data = await response.json();
    return data.address;
  } catch (error) {
    console.error('Error getting relayer address:', error);
    throw error;
  }
};

/**
 * Get user deposits from a contract
 */
export const getUserDeposits = async (
  contractType: 'public' | 'private',
  address: string
): Promise<number> => {
  try {
    console.log(`Fetching ${contractType} deposits for address ${address}`);
    console.log(`API URL: ${API_BASE_URL}/user-deposits/${contractType}/${address}`);
    
    const response = await fetch(`${API_BASE_URL}/user-deposits/${contractType}/${address}`);
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get user deposits: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Deposits data received:`, data);
    
    return parseFloat(data.formattedDeposits);
  } catch (error) {
    console.error(`Error getting ${contractType} contract deposits:`, error);
    return 0;
  }
};

/**
 * Response type for vote submission
 */
export interface VoteResponse {
  success: boolean;
  txHash: string;
  blockNumber?: number;
  gasUsed?: string;
  message: string;
}

/**
 * Submit a vote to a public poll via the relayer
 */
export const submitPublicVote = async (
  pollId: number,
  candidateId: number,
  voter: string,
  signature: string,
  retryCount = 0
): Promise<VoteResponse> => {
  try {
    console.log(`Submitting public vote to relayer API: ${API_BASE_URL}/public-vote`);
    console.log(`Parameters: pollId=${pollId}, candidateId=${candidateId}, voter=${voter}`);
    
    // Convert signature to bytes if it's a hex string
    const signatureBytes = signature.startsWith('0x') ? hexToBytes(signature.slice(2)) : hexToBytes(signature);
    
    const response = await fetch(`${API_BASE_URL}/public-vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pollId: Number(pollId),
        candidateId: Number(candidateId),
        voter,
        signature: '0x' + bytesToHex(signatureBytes)
      }, (_, value) => {
        // Handle BigInt serialization
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to submit vote');
    }

    const result = await response.json();
    return {
      ...result,
      // Convert any string numbers back to numbers if needed
      blockNumber: result.blockNumber ? Number(result.blockNumber) : undefined,
      gasUsed: result.gasUsed || undefined
    };
  } catch (error) {
    console.error('Error submitting public vote via relayer:', error);
    throw error;
  }
};

/**
 * Submit a vote to a private poll via the relayer
 */
export const submitPrivateVote = async (
  pollId: number,
  candidateId: number,
  voter: string,
  expiry: number,
  whitelistSignature: string,
  voteSignature: string,
  retryCount = 0
): Promise<VoteResponse> => {
  try {
    console.log('=== Submitting Private Vote ===');
    console.log('Input parameters:', {
      pollId,
      candidateId,
      voter,
      expiry,
      whitelistSignatureLength: whitelistSignature?.length || 0,
      voteSignatureLength: voteSignature?.length || 0,
      retryCount
    });
    
    // Check if expiry is valid
    const now = Math.floor(Date.now() / 1000);
    if (expiry < now) {
      console.error('Whitelist signature is expired:', {
        expiry,
        currentTime: now,
        difference: now - expiry
      });
      throw new Error('Whitelist signature has expired');
    }
    
    // Validate parameters before making the request
    if (pollId === undefined || pollId === null || 
        candidateId === undefined || 
        !voter || !expiry || !whitelistSignature || !voteSignature) {
      console.error('Missing or invalid parameters:', {
        hasPollId: pollId !== undefined && pollId !== null,
        hasCandidateId: candidateId !== undefined,
        hasVoter: !!voter,
        hasExpiry: !!expiry,
        hasWhitelistSig: !!whitelistSignature,
        hasVoteSig: !!voteSignature
      });
      throw new Error('Missing required parameters');
    }
    
    // Log raw signature values
    console.log('Raw signatures:', {
      whitelistSignature: whitelistSignature.slice(0, 10) + '...' + whitelistSignature.slice(-8),
      voteSignature: voteSignature.slice(0, 10) + '...' + voteSignature.slice(-8)
    });
    
    // Ensure signatures are properly formatted with 0x prefix and not truncated
    const formattedWhitelistSig = whitelistSignature.startsWith('0x') ? 
      whitelistSignature : `0x${whitelistSignature}`;
    const formattedVoteSig = voteSignature.startsWith('0x') ? 
      voteSignature : `0x${voteSignature}`;
    
    // Log formatted signatures
    console.log('Formatted signatures:', {
      whitelistSig: formattedWhitelistSig.slice(0, 10) + '...' + formattedWhitelistSig.slice(-8),
      voteSig: formattedVoteSig.slice(0, 10) + '...' + formattedVoteSig.slice(-8)
    });
    
    // Create request data as a plain JavaScript object
    const requestData = {
      pollId: Number(pollId),
      candidateId: Number(candidateId),
      voter: voter.toLowerCase(), // Ensure consistent address format
      expiry: Number(expiry),
      whitelistSignature: formattedWhitelistSig,
      voteSignature: formattedVoteSig,
      gasMultiplier: 1 + (retryCount * 0.2)
    };
    
    // Log the request data
    console.log('Request data:', {
      ...requestData,
      whitelistSignature: requestData.whitelistSignature.slice(0, 10) + '...' + requestData.whitelistSignature.slice(-8),
      voteSignature: requestData.voteSignature.slice(0, 10) + '...' + requestData.voteSignature.slice(-8)
    });
    
    // Try a different approach for stringifying the request
    const stringifiedBody = JSON.stringify({
      pollId: requestData.pollId,
      candidateId: requestData.candidateId,
      voter: requestData.voter,
      expiry: requestData.expiry,
      whitelistSignature: requestData.whitelistSignature,
      voteSignature: requestData.voteSignature,
      gasMultiplier: requestData.gasMultiplier
    });
    
    console.log('Sending request to:', `${API_BASE_URL}/private-vote`);
    
    // Make the request
    const response = await fetch(`${API_BASE_URL}/private-vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: stringifiedBody
    });

    // Handle response
    if (!response.ok) {
      const errorData = await response.json();
      console.error('=== Relayer API Error ===');
      console.error(errorData);
      
      // Enhanced error logging for whitelist signature issues
      if (errorData.error?.includes('whitelist')) {
        console.error('Whitelist signature validation failed. Details:', {
          pollId,
          voter,
          expiry,
          signatureLength: whitelistSignature.length,
          signatureStart: whitelistSignature.slice(0, 20),
          signatureEnd: whitelistSignature.slice(-20),
          currentTime: Math.floor(Date.now() / 1000)
        });
        
        // Try to provide more helpful error message
        if (errorData.error?.includes('expired')) {
          throw new Error('Whitelist approval has expired. Please request a new signature.');
        } else if (errorData.error?.includes('not whitelisted') || errorData.error?.includes('invalid signature')) {
          throw new Error('Invalid whitelist signature. The signature may be incorrect or you are not authorized for this poll.');
        }
      }
      
      const error = errorData.error || 'Failed to submit vote';
      if (error.includes('could not replace existing tx') && retryCount < 3) {
        console.log(`Retrying with higher gas price, attempt ${retryCount + 1}`);
        return submitPrivateVote(pollId, candidateId, voter, expiry, whitelistSignature, voteSignature, retryCount + 1);
      }
      
      throw new Error(error);
    }

    const result = await response.json();
    console.log('=== Relayer API Success ===');
    console.log(result);
    return result;
  } catch (error) {
    console.error('=== Error Submitting Private Vote ===');
    console.error(error);
    throw error;
  }
};

/**
 * Test function to debug request parsing
 */
export const testRequestParsing = async (): Promise<any> => {
  try {
    console.log('=== Testing Request Parsing ===');
    
    // Create a test request body similar to the private vote request
    const testBody = {
      pollId: 0,
      candidateId: 0,
      voter: '0x91288e9a57a814f44a6c0bc46cf4ebca1e2f35ea',
      expiry: Math.floor(Date.now() / 1000) + 86400,
      whitelistSignature: '0x' + '1'.repeat(130),
      voteSignature: '0x' + '2'.repeat(130),
      gasMultiplier: 1
    };
    
    console.log('Test request body:', testBody);
    
    // Stringify the request body
    const stringifiedBody = JSON.stringify(testBody);
    console.log('Stringified test body:', stringifiedBody);
    
    // Make the request
    const response = await fetch(`${API_BASE_URL}/test-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: stringifiedBody
    });

    // Handle response
    const result = await response.json();
    console.log('=== Test Response ===');
    console.log(result);
    return result;
  } catch (error) {
    console.error('=== Test Request Error ===');
    console.error(error);
    throw error;
  }
}; 