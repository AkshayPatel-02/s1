import dotenv from 'dotenv';
// Load environment variables
dotenv.config();
// Server configuration
export const PORT = process.env.PORT || 3001;
export const NODE_ENV = process.env.NODE_ENV || 'development';
// Blockchain configuration
export const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
export const RPC_URL = process.env.RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/6zo2b7aZ7LuSzvtnoAOJO';
export const CHAIN_ID = 137; // Polygon Mainnet
// Contract addresses
export const PUBLIC_VOTING_CONTRACT = process.env.PUBLIC_VOTING_CONTRACT || '0x7f3bdcfa2d93052b7f552e6c9a19f7ad40954a65';
export const PRIVATE_VOTING_CONTRACT = process.env.PRIVATE_VOTING_CONTRACT || '0x5a66f9f14e1bdef2e484a3e6a47701526dcb0f04';
// Security
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
// Gas configuration
export const GAS_LIMIT = 300000;
export const GAS_PRICE_MULTIPLIER = 1.2; // 20% increase for faster processing
// Domain for EIP-712 signatures
export const PUBLIC_VOTING_DOMAIN = {
    name: "PublicVotingSystem",
    version: "1",
    chainId: CHAIN_ID,
    verifyingContract: PUBLIC_VOTING_CONTRACT
};
export const PRIVATE_VOTING_DOMAIN = {
    name: "PrivateVotingSystem",
    version: "1",
    chainId: CHAIN_ID,
    verifyingContract: PRIVATE_VOTING_CONTRACT
};
// Validation
if (!RELAYER_PRIVATE_KEY) {
    throw new Error('RELAYER_PRIVATE_KEY is required in environment variables');
}
// Convert private key to proper format if needed
export const FORMATTED_PRIVATE_KEY = RELAYER_PRIVATE_KEY.startsWith('0x')
    ? RELAYER_PRIVATE_KEY
    : `0x${RELAYER_PRIVATE_KEY}`;
//# sourceMappingURL=config.js.map