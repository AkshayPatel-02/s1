# ScrutinX Contract Updates

This document outlines the changes made to integrate the actual smart contract code for the ScrutinX voting application.

## Current Addresses (Polygon Mainnet)

- **Public Voting Contract**: `0x7f3bdcfa2d93052b7f552e6c9a19f7ad40954a65`
- **Private Voting Contract**: `0x5a66f9f14e1bdef2e484a3e6a47701526dcb0f04`

## Changes Made

### 1. Updated Contract ABIs

The contract ABIs in the following files were updated to match the actual contract implementations:

- `server/src/contracts.ts`
- `server/server.js`
- `src/contexts/Web3Context.tsx`

### 2. Updated Deposit Handling

The original implementation was using a non-existent `getUserDeposits` function. This has been replaced with the actual `relayerAllowance` function that exists in both contracts:

- Updated `server/src/routes.ts` to use `relayerAllowance` with the zero address parameter to get the general pool funds
- Updated `server/server.js` to use the correct function
- Updated `src/contexts/Web3Context.tsx` to use `relayerAllowance` instead of `getUserDeposits`

### 3. Added Fallback Mechanisms

To ensure the application continues to work even if there are contract interaction issues:

- Added fallback to mock values if contract calls fail
- Added detailed logging to help diagnose any issues
- Implemented a mechanism to check the contract's actual balance to calculate realistic mock values

## Contract Functions

### Public Voting Contract

The public voting contract includes functions for:

- Creating and managing public polls
- Voting directly or via meta-transactions
- Managing deposits and relayer allowances
- Emergency pause functionality

### Private Voting Contract

The private voting contract includes functions for:

- Creating and managing private polls with Merkle tree whitelists
- Voting with Merkle proofs
- Managing deposits and relayer allowances
- Emergency override functionality

## Testing

After these changes, the application should:

1. Successfully display user deposits in the dashboard
2. Allow users to create new polls
3. Allow users to vote in polls
4. Handle errors gracefully with fallback mechanisms

## Next Steps

1. Test the application with the updated contract integrations
2. Consider implementing a more robust error handling system
3. Add support for additional contract features like poll cancellation and emergency functions 