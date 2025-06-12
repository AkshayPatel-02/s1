import { ethers } from 'ethers';
import { firebaseService, WhitelistEntry as FirebaseWhitelistEntry } from './firebaseService';

interface WhitelistEntry {
  address: string;
  signature: string;
  expiry: number;
  pollId: number;
  createdAt: number;
}

/**
 * Service for managing whitelist signatures
 */
class WhitelistService {
  private static STORAGE_PREFIX = 'whitelist_signatures_';
  private static WHITELIST_ADDRESSES_PREFIX = 'whitelist_addresses_poll_';
  private static DEFAULT_EXPIRY_DAYS = 7; // Default expiry in days
  private static USE_FIREBASE_KEY = 'whitelist_use_firebase';

  /**
   * Check if Firebase should be used for storage
   */
  private useFirebase(): boolean {
    // Check if Firebase is enabled in localStorage
    const useFirebaseStr = localStorage.getItem(WhitelistService.USE_FIREBASE_KEY);
    
    // Default to true if not set
    const useFirebase = useFirebaseStr ? JSON.parse(useFirebaseStr) : true;
    
    console.log(`Storage method: ${useFirebase ? 'Firebase' : 'localStorage'}`);
    return useFirebase;
  }

  /**
   * Generate a whitelist signature for a voter
   */
  public async generateSignature(
    signer: ethers.Signer,
    pollId: number,
    voterAddress: string,
    contractAddress: string,
    chainId: number,
    expiryDays: number = this.getDefaultExpiryDays()
  ): Promise<{ signature: string; expiry: number }> {
    // Create expiry timestamp (in seconds)
    const expiry = Math.floor(Date.now() / 1000) + (expiryDays * 86400);
    
    console.log(`Generating whitelist signature for poll ${pollId}, voter ${voterAddress}`);
    console.log(`Contract address: ${contractAddress}`);
    console.log(`Signature will expire at: ${new Date(expiry * 1000).toISOString()}`);
    
    // Get the signer's address for verification
    const signerAddress = await signer.getAddress();
    console.log(`Signer address: ${signerAddress}`);
    
    // EIP-712 domain
    const domain = {
      name: "PrivateVotingSystem",
      version: "1",
      chainId: chainId,
      verifyingContract: contractAddress
    };
    
    // The type of the data we're signing
    const types = {
      WhitelistApproval: [
        { name: "pollId", type: "uint256" },
        { name: "voter", type: "address" },
        { name: "expiry", type: "uint256" }
      ]
    };
    
    // The data to sign
    const value = {
      pollId: pollId,
      voter: voterAddress,
      expiry: expiry
    };
    
    console.log('Signing with parameters:', {
      domain,
      types,
      value
    });
    
    // Use EIP-712 typed data signing
    const signature = await signer.signTypedData(domain, types, value);
    console.log(`Generated whitelist signature: ${signature.substring(0, 10)}...${signature.substring(signature.length - 8)}`);
    
    // Get the signer's address
    console.log(`Signature created by: ${signerAddress}`);
    
    // Store the signature
    await this.storeSignature(pollId, voterAddress, signature, expiry, signerAddress);
    
    return { signature, expiry };
  }
  
  /**
   * Generate batch signatures for multiple voters
   */
  public async generateBatchSignatures(
    signer: ethers.Signer,
    pollId: number,
    voterAddresses: string[],
    contractAddress: string,
    chainId: number,
    expiryDays: number = this.getDefaultExpiryDays()
  ): Promise<{ [address: string]: { signature: string; expiry: number } }> {
    const results: { [address: string]: { signature: string; expiry: number } } = {};
    const signerAddress = await signer.getAddress();
    
    if (this.useFirebase()) {
      // For Firebase, generate all signatures first, then batch store them
      const entries: FirebaseWhitelistEntry[] = [];
      
      for (const address of voterAddresses) {
        const result = await this.generateSignature(
          signer, 
          pollId, 
          address, 
          contractAddress,
          chainId,
          expiryDays
        );
        
        results[address] = result;
        
        entries.push({
          pollId,
          address,
          signature: result.signature,
          expiry: result.expiry,
          createdAt: Date.now(),
          createdBy: signerAddress
        });
      }
      
      // Batch store in Firebase
      await firebaseService.batchStoreSignatures(entries);
    } else {
      // For localStorage, just generate signatures one by one
      for (const address of voterAddresses) {
        const result = await this.generateSignature(
          signer, 
          pollId, 
          address, 
          contractAddress,
          chainId,
          expiryDays
        );
        results[address] = result;
      }
    }
    
    return results;
  }
  
  /**
   * Store a whitelist signature
   */
  public async storeSignature(
    pollId: number,
    voterAddress: string,
    signature: string,
    expiry: number,
    createdBy?: string
  ): Promise<void> {
    const entry: WhitelistEntry = {
      address: voterAddress.toLowerCase(),
      signature,
      expiry,
      pollId,
      createdAt: Date.now()
    };
    
    if (this.useFirebase()) {
      // Store in Firebase
      // Only include createdBy if it's defined
      const firebaseEntry: FirebaseWhitelistEntry = {
        ...entry
      };
      
      // Only add createdBy if it's defined
      if (createdBy) {
        firebaseEntry.createdBy = createdBy;
      }
      
      await firebaseService.storeSignature(firebaseEntry);
    } else {
      // Store in localStorage
      // Get existing signatures for this poll
      const signatures = await this.getStoredSignatures(pollId);
      
      // Add or update the signature
      const existingIndex = signatures.findIndex(s => s.address === voterAddress.toLowerCase());
      if (existingIndex >= 0) {
        signatures[existingIndex] = entry;
      } else {
        signatures.push(entry);
      }
      
      // Store updated signatures
      localStorage.setItem(
        this.getStorageKey(pollId),
        JSON.stringify(signatures)
      );
    }
  }
  
  /**
   * Get stored signatures for a poll
   */
  public async getStoredSignatures(pollId: number): Promise<WhitelistEntry[]> {
    if (this.useFirebase()) {
      // Get from Firebase
      const signatures = await firebaseService.getSignaturesForPoll(pollId);
      return signatures as WhitelistEntry[];
    } else {
      // Get from localStorage
      const stored = localStorage.getItem(this.getStorageKey(pollId));
      if (!stored) return [];
      
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Error parsing stored whitelist signatures:', e);
        return [];
      }
    }
  }
  
  /**
   * Get a signature for a specific voter
   */
  public async getSignatureForVoter(pollId: number, voterAddress: string): Promise<WhitelistEntry | null> {
    if (this.useFirebase()) {
      // Get from Firebase
      return await firebaseService.getSignatureForVoter(pollId, voterAddress);
    } else {
      // Get from localStorage
      const signatures = await this.getStoredSignatures(pollId);
      const entry = signatures.find(s => s.address === voterAddress.toLowerCase());
      
      if (!entry) return null;
      
      // Check if the signature is expired
      if (entry.expiry < Math.floor(Date.now() / 1000)) {
        return null;
      }
      
      return entry;
    }
  }
  
  /**
   * Get all whitelisted addresses for a poll
   */
  public async getWhitelistedAddresses(pollId: number): Promise<string[]> {
    console.log(`Getting whitelisted addresses for poll ${pollId}`);
    const usingFirebase = this.useFirebase();
    
    // First, check localStorage as it's always available
    const localStorageKey = `${WhitelistService.WHITELIST_ADDRESSES_PREFIX}${pollId}`;
    const storedLocal = localStorage.getItem(localStorageKey);
    let localAddresses: string[] = [];
    
    if (storedLocal) {
      try {
        localAddresses = JSON.parse(storedLocal);
        console.log(`Retrieved ${localAddresses.length} addresses from localStorage for poll ${pollId}`);
      } catch (e) {
        console.error('Error parsing stored whitelist addresses from localStorage:', e);
      }
    }
    
    // If Firebase is enabled and we have no permissions error, try to get from Firebase too
    let firebaseAddresses: string[] = [];
    if (usingFirebase && localStorage.getItem('firebase_permissions_error') !== 'true') {
      try {
        console.log(`Retrieving addresses from Firebase for poll ${pollId}`);
        firebaseAddresses = await firebaseService.getWhitelistedAddresses(pollId);
        console.log(`Retrieved ${firebaseAddresses.length} addresses from Firebase for poll ${pollId}`);
      } catch (error) {
        console.error('Error retrieving addresses from Firebase:', error);
      }
    }
    
    // Combine and deduplicate addresses from both sources
    const allAddresses = [...localAddresses, ...firebaseAddresses];
    const uniqueAddresses = [...new Set(allAddresses.map(addr => addr.toLowerCase()))];
    
    console.log(`Returning ${uniqueAddresses.length} unique addresses for poll ${pollId}`);
    return uniqueAddresses;
  }
  
  /**
   * Set whitelisted addresses for a poll
   */
  public async setWhitelistedAddresses(pollId: number, addresses: string[], createdBy?: string): Promise<void> {
    console.log(`Setting whitelisted addresses for poll ${pollId}:`, addresses);
    const usingFirebase = this.useFirebase();
    const normalizedAddresses = addresses.map(addr => addr.toLowerCase());
    
    // Always save to localStorage as a fallback
    const localStorageKey = `${WhitelistService.WHITELIST_ADDRESSES_PREFIX}${pollId}`;
    console.log(`Storing addresses in localStorage for poll ${pollId} with key ${localStorageKey}:`, normalizedAddresses);
    localStorage.setItem(localStorageKey, JSON.stringify(normalizedAddresses));
    console.log(`localStorage storage completed for poll ${pollId}`);
    
    // If Firebase is enabled, also try to save there
    if (usingFirebase) {
      try {
        console.log(`Storing addresses in Firebase for poll ${pollId}`);
        const result = await firebaseService.storeWhitelistedAddresses(pollId, addresses, createdBy);
        console.log(`Firebase storage result: ${result ? 'success' : 'failed'}`);
      } catch (error) {
        console.error('Error storing addresses in Firebase:', error);
        // Already saved to localStorage as fallback, so we can continue
      }
    }
  }
  
  /**
   * Export signatures as JSON
   */
  public async exportSignatures(pollId: number): Promise<string> {
    const signatures = await this.getStoredSignatures(pollId);
    return JSON.stringify(signatures, null, 2);
  }
  
  /**
   * Import signatures from JSON
   */
  public async importSignatures(pollId: number, jsonData: string): Promise<boolean> {
    try {
      const signatures = JSON.parse(jsonData) as WhitelistEntry[];
      
      // Validate the data
      if (!Array.isArray(signatures)) {
        throw new Error('Invalid signature data format');
      }
      
      if (this.useFirebase()) {
        // Store in Firebase
        const firebaseEntries: FirebaseWhitelistEntry[] = signatures.map(sig => ({
          ...sig,
          pollId,
          createdAt: sig.createdAt || Date.now()
        }));
        
        await firebaseService.batchStoreSignatures(firebaseEntries);
      } else {
        // Store in localStorage
        localStorage.setItem(
          this.getStorageKey(pollId),
          JSON.stringify(signatures)
        );
      }
      
      return true;
    } catch (e) {
      console.error('Error importing whitelist signatures:', e);
      return false;
    }
  }
  
  /**
   * Clear all signatures for a poll
   */
  public async clearSignatures(pollId: number): Promise<void> {
    if (this.useFirebase()) {
      // For Firebase, we would need to delete each signature individually
      // This is a simplified version - in a real app, you'd want to batch delete
      const signatures = await this.getStoredSignatures(pollId);
      for (const sig of signatures) {
        await firebaseService.deleteSignature(pollId, sig.address);
      }
    } else {
      // For localStorage
      localStorage.removeItem(this.getStorageKey(pollId));
    }
  }
  
  /**
   * Get the default expiry days
   */
  private getDefaultExpiryDays(): number {
    return WhitelistService.DEFAULT_EXPIRY_DAYS;
  }
  
  /**
   * Get the storage key for a poll
   */
  private getStorageKey(pollId: number): string {
    return `${WhitelistService.STORAGE_PREFIX}${pollId}`;
  }
}

// Export a singleton instance
export const whitelistService = new WhitelistService(); 