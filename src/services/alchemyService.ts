// Alchemy SDK integration for blockchain data
import { Network, Alchemy } from "alchemy-sdk";

// Alchemy configuration
const settings = {
  apiKey: "6zo2b7aZ7LuSzvtnoAOJO", // Replace with your actual Alchemy API Key
  network: Network.MATIC_MAINNET, // Polygon Mainnet
};

// Initialize Alchemy SDK
export const alchemy = new Alchemy(settings);

// Helper functions for common blockchain operations
export const getBlock = async (blockNumber: number) => {
  try {
    return await alchemy.core.getBlock(blockNumber);
  } catch (error) {
    console.error("Error fetching block:", error);
    throw error;
  }
};

export const getTransaction = async (txHash: string) => {
  try {
    return await alchemy.core.getTransaction(txHash);
  } catch (error) {
    console.error("Error fetching transaction:", error);
    throw error;
  }
};

export const getTokenBalances = async (address: string) => {
  try {
    return await alchemy.core.getTokenBalances(address);
  } catch (error) {
    console.error("Error fetching token balances:", error);
    throw error;
  }
};

export const getTransactionReceipt = async (txHash: string) => {
  try {
    return await alchemy.core.getTransactionReceipt(txHash);
  } catch (error) {
    console.error("Error fetching transaction receipt:", error);
    throw error;
  }
};

// Default export for convenience
export default alchemy; 