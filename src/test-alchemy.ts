// Test script for Alchemy SDK integration
import alchemy, { getBlock } from './services/alchemyService';

// Test function to demonstrate Alchemy SDK usage
const testAlchemySDK = async () => {
  try {
    console.log("Testing Alchemy SDK integration...");
    
    // Test getting a block from Polygon
    console.log("Fetching block #15221026 from Polygon...");
    const block = await getBlock(15221026);
    console.log("Block hash:", block.hash);
    console.log("Block timestamp:", new Date(block.timestamp * 1000).toLocaleString());
    console.log("Number of transactions:", block.transactions.length);
    
    // Test direct Alchemy SDK usage
    console.log("\nFetching latest block from Polygon...");
    const latestBlock = await alchemy.core.getBlockNumber();
    console.log("Latest block number:", latestBlock);
    
    console.log("\nAlchemy SDK integration test completed successfully!");
  } catch (error) {
    console.error("Error testing Alchemy SDK:", error);
  }
};

// Run the test
testAlchemySDK(); 