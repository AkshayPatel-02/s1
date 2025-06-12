import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, DatabaseIcon, CheckCircle, RefreshCw } from 'lucide-react';
import { useWeb3 } from '@/contexts/Web3Context';
import { ethers } from 'ethers';

const CONTRACT_ADDRESSES = {
  PRIVATE_VOTING: '0x5a66f9f14e1bdef2e484a3e6a47701526dcb0f04'
};

const FirebaseStatus: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'configured' | 'not-configured' | 'permissions-error'>('checking');
  const [firebaseEnabled, setFirebaseEnabled] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [diagnosticResult, setDiagnosticResult] = useState<string | null>(null);
  const { state } = useWeb3();
  
  useEffect(() => {
    // Check if Firebase is configured
    const checkFirebaseConfig = () => {
      // Check if we have permissions error in localStorage
      const hasPermissionsError = localStorage.getItem('firebase_permissions_error') === 'true';
      
      if (hasPermissionsError) {
        setStatus('permissions-error');
        return;
      }
      
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      const appId = import.meta.env.VITE_FIREBASE_APP_ID;
      
      const hasValidConfig = apiKey && projectId && appId && 
                            apiKey !== "YOUR_API_KEY" && 
                            projectId !== "YOUR_PROJECT_ID" && 
                            appId !== "YOUR_APP_ID";
      
      setStatus(hasValidConfig ? 'configured' : 'not-configured');
    };
    
    checkFirebaseConfig();
    
    // Also check for permissions errors in the console
    const originalConsoleError = console.error;
    console.error = function(...args) {
      if (args[0] && typeof args[0] === 'string' && 
          args[0].includes('Missing or insufficient permissions')) {
        setStatus('permissions-error');
        localStorage.setItem('firebase_permissions_error', 'true');
      }
      originalConsoleError.apply(console, args);
    };
    
    return () => {
      console.error = originalConsoleError;
    };
  }, []);
  
  useEffect(() => {
    // Check if Firebase is enabled
    const stored = localStorage.getItem('whitelist_use_firebase');
    setFirebaseEnabled(stored ? JSON.parse(stored) : true);
  }, []);
  
  // If we haven't checked yet, or if Firebase is configured correctly, don't show anything
  if (status === 'checking' || status === 'configured') {
    return null;
  }
  
  if (status === 'permissions-error') {
    return (
      <Alert className="mb-4 bg-yellow-50 border-yellow-200">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800">Firebase Permissions Error</AlertTitle>
        <AlertDescription className="text-yellow-700">
          Your Firebase project is configured correctly, but there are permission issues accessing the database.
          The whitelist system will use localStorage instead. To fix this, update your Firestore security rules:
          
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /whitelist_signatures/{signatureId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /whitelist_addresses/{pollId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}`}
          </pre>
        </AlertDescription>
      </Alert>
    );
  }
  
  // Show warning if Firebase is not configured
  return (
    <Alert className="mb-4 bg-amber-50 border-amber-200">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800">Firebase Not Configured</AlertTitle>
      <AlertDescription className="text-amber-700">
        Firebase is not properly configured. The whitelist system will use localStorage instead, 
        which means your data won't be synchronized across devices or browsers. 
        Check the README-WHITELIST.md file for setup instructions.
      </AlertDescription>
    </Alert>
  );
};

export default FirebaseStatus; 