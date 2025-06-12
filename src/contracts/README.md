# ScrutinX Voting Smart Contracts

This directory contains the Solidity smart contracts used in the ScrutinX voting application.

## Deployed Contracts

The following contracts are deployed on Polygon Mainnet:

- **Public Voting Contract**: `0x7f3bdcfa2d93052b7f552e6c9a19f7ad40954a65`
- **Private Voting Contract**: `0x5a66f9f14e1bdef2e484a3e6a47701526dcb0f04`

## Contracts Overview

### PublicVotingSystem.sol

A gas-efficient voting system for public polls with meta-transaction support. Key features:

- Create public polls with multiple candidates
- Vote directly or via meta-transactions (gasless voting)
- Fund management for relayer reimbursements
- Bitmap-based vote tracking for gas efficiency
- Emergency pause functionality
- Poll cancellation

### PrivateVotingSystem.sol

A specialized voting system for private/whitelist-only polls. Key features:

- Create private polls with Merkle-tree based whitelists
- Vote with Merkle proof verification
- Meta-transaction support for gasless voting
- Fund management for relayer reimbursements
- Emergency override functionality

## Contract Architecture

Both contracts use a similar architecture with these key components:

1. **Poll Management**: Create and track polls with candidates
2. **Vote Tracking**: Efficient bitmap-based vote tracking
3. **Meta-Transaction Support**: EIP-712 signatures for gasless voting
4. **Relayer System**: Authorized relayers can submit votes on behalf of users
5. **Fund Management**: Deposit and withdraw funds for relayer reimbursements

## Dependencies

These contracts depend on OpenZeppelin libraries:

- EIP712: For typed structured data hashing and signing
- ECDSA: For signature verification
- ReentrancyGuard: For protection against reentrancy attacks
- Pausable: For emergency pause functionality
- AccessControl: For role-based access control

## Development

To compile these contracts:

```bash
npx hardhat compile
```

To deploy:

```bash
npx hardhat run scripts/deploy.js --network polygon
```

## Security

These contracts have been designed with gas efficiency and security in mind. Key security features:

- Reentrancy protection
- Access control for admin functions
- Signature verification for meta-transactions
- Merkle proof verification for whitelist access 