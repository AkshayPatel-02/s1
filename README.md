# Scrutinx Vote dApp

<div align="center">
  <img src="public/ScrutinX.png" alt="ScrutinX Logo" width="150" />
</div>

A decentralized voting application built on Polygon.

## Features

- Public and private voting polls
- Meta transactions for gasless voting
- Relayer service for handling meta transactions
- User-friendly interface

## Project Structure

- `src/` - Frontend React application
- `server/` - Backend relayer service for meta transactions

## Setup

### Frontend

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file with the following content:
   ```
   VITE_RELAYER_API_URL=http://localhost:3001/api
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Relayer Backend

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the server directory with the following content:
   ```
   # Server configuration
   PORT=3001
   NODE_ENV=development
   
   # Blockchain configuration
   RELAYER_PRIVATE_KEY=your_relayer_private_key_here
   RPC_URL=https://polygon-rpc.com
   
   # Contract addresses
   PUBLIC_VOTING_CONTRACT=0x7f3bdcfa2d93052b7f552e6c9a19f7ad40954a65
   PRIVATE_VOTING_CONTRACT=0x5a66f9f14e1bdef2e484a3e6a47701526dcb0f04
   
   # Security
   CORS_ORIGIN=http://localhost:5173
   ```

4. Replace `your_relayer_private_key_here` with the private key of your relayer wallet (0xa0ea96BDf637A926348d24A0A9B7b8A3fD76C3F3)

5. Start the relayer server:
   ```bash
   npm run dev
   ```

## Smart Contracts

The dApp interacts with two smart contracts:

- Public Voting Contract: `0x7f3bdcfa2d93052b7f552e6c9a19f7ad40954a65`
- Private Voting Contract: `0x5a66f9f14e1bdef2e484a3e6a47701526dcb0f04`

## Meta Transactions

The application uses meta transactions to enable gasless voting. The process works as follows:

1. User signs a message containing the poll ID, candidate ID, and their address
2. The signature is sent to the relayer server
3. The relayer verifies the signature and submits the transaction to the blockchain
4. The relayer pays the gas fee on behalf of the user

## Deployment

### Frontend

```bash
npm run build
```

### Relayer Backend

```bash
cd server
npm run build
npm start
```

## Security Considerations

- The relayer's private key should be kept secure
- Use a dedicated wallet with limited funds for the relayer
- Implement proper rate limiting to prevent DoS attacks
- Validate all inputs and signatures before submitting transactions
