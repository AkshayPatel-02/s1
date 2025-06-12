# ScrutinX Voting System - Testing Guide

This guide explains how to test the ScrutinX voting system and fix any issues with the voting process.

## Overview of Changes Made

We've made several improvements to the voting system:

1. **Enhanced Signature Generation**: Updated to use EIP-712 typed data signatures for better security and compatibility with the smart contracts.
2. **Improved Signature Verification**: Added support for both EIP-712 and legacy signature verification on the server side.
3. **Better Error Handling**: Added detailed error messages and logging throughout the system.
4. **Test Scripts**: Created scripts to verify API responses and test the complete voting flow.

## Running the Tests

### 1. API Test

This test verifies that the API is returning real data instead of mock data:

```bash
node test-api.js
```

If successful, you should see:
```
Testing API...
API Response: { formattedDeposits: '0.05', ... }
isMock property exists: false
SUCCESS: API is returning real data!
```

### 2. Voting Flow Test

This test verifies the entire voting flow from signature generation to transaction submission:

1. First, create a `.env.test` file with your test wallet's private key:

```
TEST_PRIVATE_KEY=your_private_key_here
RELAYER_API_URL=http://localhost:3001/api
```

2. Run the test script:

```bash
# Load the environment variables
source .env.test
# Run the test
node test-vote.js
```

The script will:
- Generate an EIP-712 signature for a vote
- Submit the vote to the relayer
- Display the transaction result

## Troubleshooting Common Issues

### 1. "Invalid signature" Error

If you get an "Invalid signature" error, check:

- The contract address in your EIP-712 domain matches the actual deployed contract
- The chainId in your EIP-712 domain matches the network you're using
- The voter address matches the wallet that signed the message

### 2. "Insufficient relayer funds" Error

If you get an "Insufficient funds" error:

- Ensure the poll creator has deposited enough funds for relayer gas fees
- Check the relayerAllowance for the poll creator in the contract
- You can add funds by calling the `depositFunds` function on the contract

### 3. Transaction Fails Silently

If the transaction is submitted but fails:

- Check the transaction hash on the blockchain explorer
- Look for revert reasons in the transaction trace
- Ensure the relayer has enough ETH for gas
- Verify the voter hasn't already voted in this poll

## Understanding the Signature Process

The voting system uses EIP-712 typed data signatures to securely authorize votes without requiring users to pay gas. Here's how it works:

1. **Client Side**: The user signs a structured message containing:
   - Poll ID
   - Candidate ID
   - Their wallet address

2. **Server Side**: The relayer verifies the signature and submits the transaction to the blockchain.

3. **Contract Side**: The smart contract verifies the signature again and processes the vote.

This meta-transaction approach allows users to vote without having to pay for gas themselves.

## Monitoring and Logs

To monitor the system and diagnose issues:

- Check the server logs for detailed information about each request
- Use the `/status` endpoint to verify the relayer's status
- The frontend console logs contain information about signature generation
- Transaction receipts provide information about gas usage and success status

## Next Steps

After confirming that voting works correctly, you may want to:

1. Add more comprehensive error handling in the UI
2. Implement transaction monitoring to show users the status of their votes
3. Add retry logic for failed transactions
4. Create a dashboard to monitor relayer performance and fund usage 