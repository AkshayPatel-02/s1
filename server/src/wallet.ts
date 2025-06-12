import { ethers } from 'ethers';
import { RPC_URL, FORMATTED_PRIVATE_KEY } from './config.js';

// Initialize provider
export const provider = new ethers.JsonRpcProvider(RPC_URL);

// Initialize wallet with formatted private key
export const wallet = new ethers.Wallet(FORMATTED_PRIVATE_KEY, provider);

// Export wallet address for convenience
export const RELAYER_ADDRESS = await wallet.getAddress(); 