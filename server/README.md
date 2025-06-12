# Scrutinx Vote Relayer

This is a relayer server for handling meta transactions for the Scrutinx Vote dApp. The relayer pays for gas fees on behalf of users, enabling gasless voting.

## Requirements

- Node.js 16+
- npm or yarn

## Setup

1. Clone the repository
2. Navigate to the server directory
3. Install dependencies:
```bash
npm install
```
4. Create a `.env` file based on the example below:
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
5. Replace `your_relayer_private_key_here` with the private key of your relayer wallet

## Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Get Relayer Address
```
GET /api/relayer-address
```

### Submit Public Vote
```
POST /api/public-vote
Content-Type: application/json

{
  "pollId": 0,
  "candidateId": 0,
  "voter": "0x...",
  "signature": "0x..."
}
```

### Submit Private Vote
```
POST /api/private-vote
Content-Type: application/json

{
  "pollId": 0,
  "candidateId": 0,
  "voter": "0x...",
  "merkleProof": ["0x...", "0x..."],
  "signature": "0x..."
}
```

## Security Considerations

1. The relayer's private key should be kept secure and not shared.
2. Consider using a dedicated wallet with limited funds for the relayer.
3. Implement proper rate limiting to prevent DoS attacks.
4. Validate all inputs and signatures before submitting transactions.
5. Consider implementing additional authentication mechanisms for relayer endpoints.

## Deployment

For production deployment, consider using a process manager like PM2 or deploying to a service like AWS, Google Cloud, or Heroku.

Example PM2 startup:
```bash
pm2 start npm --name "scrutinx-relayer" -- start
``` 