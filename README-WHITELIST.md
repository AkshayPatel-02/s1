# Whitelist Management System

This document describes the whitelist management system for private polls in the Scrutinx Voting Platform.

## Overview

The whitelist system allows poll creators to:
1. Manage a list of whitelisted addresses for private polls
2. Generate EIP-712 signatures for whitelisted voters
3. Store and manage these signatures in Firebase
4. Export/import whitelist data

## Setup Instructions

### 1. Firebase Configuration

The system uses Firebase for storing whitelist signatures. To set it up:

1. Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Firebase Authentication and Firestore Database
3. Create a web app in your Firebase project
4. Copy your Firebase configuration to the `.env` file:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 2. Firestore Security Rules

Add these security rules to your Firestore database:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Whitelist signatures can be read by anyone but only written by authenticated users
    match /whitelist_signatures/{signatureId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Whitelist addresses can be read by anyone but only written by authenticated users
    match /whitelist_addresses/{pollId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Using the Whitelist System

### For Poll Creators

1. Create a private poll
2. Navigate to the poll details page
3. Click "Manage Whitelist" to open the whitelist manager
4. Add addresses to the whitelist
5. Click "Generate Signatures" to create signatures for all addresses
6. Use the "Export" tab to export signatures if needed

### For Voters

1. Navigate to a private poll
2. If you're not whitelisted, you'll see a prompt to enter a whitelist signature
3. Paste the signature provided by the poll creator
4. Click "Verify" to verify the signature
5. Once verified, you can vote in the poll

## Technical Details

### Signature Format

The system uses EIP-712 typed data signatures with the following structure:

```typescript
// EIP-712 domain
const domain = {
  name: "PrivateVotingSystem",
  version: "1",
  chainId: chainId,
  verifyingContract: contractAddress
};

// The type of the data being signed
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
```

### Storage Structure

Signatures are stored in Firebase with the following structure:

```
whitelist_signatures/{pollId}_{voterAddress}
{
  pollId: number,
  address: string,
  signature: string,
  expiry: number,
  createdAt: number,
  createdBy: string
}
```

Whitelisted addresses are stored as:

```
whitelist_addresses/{pollId}
{
  pollId: number,
  addresses: string[],
  updatedAt: number,
  createdBy: string
}
```

## Fallback to LocalStorage

If Firebase is not available or disabled, the system will fall back to using localStorage for storing signatures and addresses. To disable Firebase and use only localStorage, set `USE_FIREBASE = false` in the WhitelistService. 