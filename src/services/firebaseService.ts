import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, setPersistence, browserLocalPersistence } from 'firebase/auth';

// Check if Firebase configuration is available
const hasValidConfig = () => {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;
  
  return apiKey && projectId && appId && 
         apiKey !== "YOUR_API_KEY" && 
         projectId !== "YOUR_PROJECT_ID" && 
         appId !== "YOUR_APP_ID";
};

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  // TODO: Replace with your Firebase config
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase only if we have valid config
let app;
let db;
let auth;
let authInitialized = false;
let authError = null;
let permissionsError = false;

try {
  if (hasValidConfig()) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    // Set persistence to LOCAL to prevent frequent disconnections
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log("Firebase persistence set to LOCAL");
        authInitialized = true;
      })
      .catch((error) => {
        console.error("Error setting persistence:", error);
        authError = error;
      });
      
    console.log("Firebase initialized successfully");
  } else {
    console.warn("Firebase configuration is missing or invalid. Firebase features will be disabled.");
  }
} catch (error) {
  console.error("Error initializing Firebase:", error);
  authError = error;
}

// Sign in anonymously to access Firestore
const ensureAuth = async () => {
  if (!auth) {
    throw new Error('Firebase auth not initialized');
  }
  
  // Wait for auth persistence to be initialized
  if (!authInitialized) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // If we've already tried and failed to authenticate, don't keep trying
  if (authError) {
    throw new Error('Firebase authentication previously failed');
  }
  
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
      console.log('Signed in anonymously to Firebase');
    } catch (error) {
      console.error('Error signing in anonymously:', error);
      authError = error; // Store the error so we don't keep trying
      throw error;
    }
  }
  return auth.currentUser;
};

// Helper to check if an error is a permissions error
const isPermissionsError = (error: any): boolean => {
  return error && 
    (error.message?.includes('Missing or insufficient permissions') || 
     error.code === 'permission-denied');
};

export interface WhitelistEntry {
  pollId: number;
  address: string;
  signature: string;
  expiry: number;
  createdAt: number;
  createdBy?: string;
}

/**
 * Firebase service for storing whitelist signatures
 */
class FirebaseService {
  /**
   * Check if Firebase is properly initialized
   */
  private isInitialized(): boolean {
    return !!db && !!auth && !authError && !permissionsError;
  }

  /**
   * Store a whitelist signature in Firebase
   */
  async storeSignature(entry: WhitelistEntry): Promise<boolean> {
    if (!this.isInitialized()) {
      console.warn("Firebase not initialized or authentication failed, cannot store signature");
      return false;
    }
    
    try {
      await ensureAuth();
      
      // Create a safe copy of the entry with properly formatted address
      const safeEntry = {
        ...entry,
        address: entry.address.toLowerCase(),
        updatedAt: Date.now()
      };
      
      // Remove any undefined fields
      const cleanEntry = Object.fromEntries(
        Object.entries(safeEntry).filter(([_, value]) => value !== undefined)
      );
      
      const signatureRef = doc(db, 'whitelist_signatures', `${entry.pollId}_${entry.address.toLowerCase()}`);
      await setDoc(signatureRef, cleanEntry);
      
      return true;
    } catch (error) {
      if (isPermissionsError(error)) {
        console.error('Permission error storing signature in Firebase:', error);
        permissionsError = true;
        localStorage.setItem('firebase_permissions_error', 'true');
      } else {
        console.error('Error storing signature in Firebase:', error);
      }
      return false;
    }
  }
  
  /**
   * Get a whitelist signature for a specific voter
   */
  async getSignatureForVoter(pollId: number, voterAddress: string): Promise<WhitelistEntry | null> {
    if (!this.isInitialized()) {
      console.warn("Firebase not initialized or authentication failed, cannot get signature");
      return null;
    }
    
    try {
      await ensureAuth();
      
      const signatureRef = doc(db, 'whitelist_signatures', `${pollId}_${voterAddress.toLowerCase()}`);
      const docSnap = await getDoc(signatureRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as WhitelistEntry;
      }
      
      return null;
    } catch (error) {
      if (isPermissionsError(error)) {
        console.error('Permission error getting signature from Firebase:', error);
        permissionsError = true;
        localStorage.setItem('firebase_permissions_error', 'true');
      } else {
        console.error('Error getting signature from Firebase:', error);
      }
      return null;
    }
  }
  
  /**
   * Get all signatures for a poll
   */
  async getSignaturesForPoll(pollId: number): Promise<WhitelistEntry[]> {
    if (!this.isInitialized()) {
      console.warn("Firebase not initialized or authentication failed, cannot get signatures");
      return [];
    }
    
    try {
      await ensureAuth();
      
      const q = query(
        collection(db, 'whitelist_signatures'),
        where('pollId', '==', pollId)
      );
      
      const querySnapshot = await getDocs(q);
      const signatures: WhitelistEntry[] = [];
      
      querySnapshot.forEach((doc) => {
        signatures.push(doc.data() as WhitelistEntry);
      });
      
      return signatures;
    } catch (error) {
      if (isPermissionsError(error)) {
        console.error('Permission error getting signatures from Firebase:', error);
        permissionsError = true;
        localStorage.setItem('firebase_permissions_error', 'true');
      } else {
        console.error('Error getting signatures from Firebase:', error);
      }
      return [];
    }
  }
  
  /**
   * Store whitelisted addresses for a poll
   */
  async storeWhitelistedAddresses(pollId: number, addresses: string[], createdBy?: string): Promise<boolean> {
    if (!this.isInitialized()) {
      console.warn("Firebase not initialized or authentication failed, cannot store addresses");
      return false;
    }
    
    try {
      await ensureAuth();
      
      const pollRef = doc(db, 'whitelist_addresses', pollId.toString());
      await setDoc(pollRef, {
        pollId,
        addresses: addresses.map(addr => addr.toLowerCase()),
        updatedAt: Date.now(),
        createdBy
      });
      
      return true;
    } catch (error) {
      if (isPermissionsError(error)) {
        console.error('Permission error storing whitelist addresses in Firebase:', error);
        permissionsError = true;
        localStorage.setItem('firebase_permissions_error', 'true');
      } else {
        console.error('Error storing whitelist addresses in Firebase:', error);
      }
      return false;
    }
  }
  
  /**
   * Get whitelisted addresses for a poll
   */
  async getWhitelistedAddresses(pollId: number): Promise<string[]> {
    if (!this.isInitialized()) {
      console.warn("Firebase not initialized or authentication failed, cannot get addresses");
      return [];
    }
    
    try {
      await ensureAuth();
      console.log(`Fetching whitelisted addresses for poll ${pollId} from Firebase`);
      
      const pollRef = doc(db, 'whitelist_addresses', pollId.toString());
      const docSnap = await getDoc(pollRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(`Found whitelist data for poll ${pollId}:`, data);
        return data.addresses || [];
      }
      
      console.log(`No whitelist document found for poll ${pollId}`);
      return [];
    } catch (error) {
      if (isPermissionsError(error)) {
        console.error('Permission error getting whitelist addresses from Firebase:', error);
        permissionsError = true;
        localStorage.setItem('firebase_permissions_error', 'true');
      } else {
        console.error('Error getting whitelist addresses from Firebase:', error);
      }
      return [];
    }
  }
  
  /**
   * Delete a signature
   */
  async deleteSignature(pollId: number, voterAddress: string): Promise<boolean> {
    if (!this.isInitialized()) {
      console.warn("Firebase not initialized or authentication failed, cannot delete signature");
      return false;
    }
    
    try {
      await ensureAuth();
      
      const signatureRef = doc(db, 'whitelist_signatures', `${pollId}_${voterAddress.toLowerCase()}`);
      await deleteDoc(signatureRef);
      
      return true;
    } catch (error) {
      if (isPermissionsError(error)) {
        console.error('Permission error deleting signature from Firebase:', error);
        permissionsError = true;
        localStorage.setItem('firebase_permissions_error', 'true');
      } else {
        console.error('Error deleting signature from Firebase:', error);
      }
      return false;
    }
  }
  
  /**
   * Batch store signatures
   */
  async batchStoreSignatures(entries: WhitelistEntry[]): Promise<boolean> {
    if (!this.isInitialized()) {
      console.warn("Firebase not initialized or authentication failed, cannot batch store signatures");
      return false;
    }
    
    try {
      await ensureAuth();
      
      // Process each entry one by one to ensure proper type handling
      const processedEntries = entries.map(entry => {
        // Create a safe copy with properly formatted address
        const safeEntry = {
          ...entry,
          address: entry.address.toLowerCase(),
          updatedAt: Date.now()
        };
        
        // Remove undefined fields
        return Object.fromEntries(
          Object.entries(safeEntry).filter(([_, value]) => value !== undefined)
        );
      });
      
      // Firebase doesn't support traditional batch operations in the web SDK
      // So we'll use Promise.all to parallelize the requests
      await Promise.all(
        processedEntries.map(processedEntry => {
          const id = `${processedEntry.pollId}_${processedEntry.address}`;
          const signatureRef = doc(db, 'whitelist_signatures', id);
          return setDoc(signatureRef, processedEntry);
        })
      );
      
      return true;
    } catch (error) {
      if (isPermissionsError(error)) {
        console.error('Permission error batch storing signatures in Firebase:', error);
        permissionsError = true;
        localStorage.setItem('firebase_permissions_error', 'true');
      } else {
        console.error('Error batch storing signatures in Firebase:', error);
      }
      return false;
    }
  }
}

// Export a singleton instance
export const firebaseService = new FirebaseService(); 