import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { PUBLIC_VOTING_CONTRACT, PRIVATE_VOTING_CONTRACT, RPC_URL, FORMATTED_PRIVATE_KEY } from '../src/config.js';

dotenv.config();

const PUBLIC_VOTING_ABI = [
  "function authorizedRelayers(address) external view returns (bool)",
  "function defaultRelayerWallet() external view returns (address)",
  "function setRelayerStatus(address _relayer, bool _status) external",
  "function updateDefaultRelayer(address _newDefault) external"
] as const;

async function setupRelayer() {
  try {
    console.log('Setting up relayer...');
    
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(FORMATTED_PRIVATE_KEY, provider);
    const relayerAddress = await wallet.getAddress();
    
    console.log(`Relayer address: ${relayerAddress}`);
    
    // Initialize contract
    const publicVotingContract = new ethers.Contract(
      PUBLIC_VOTING_CONTRACT,
      PUBLIC_VOTING_ABI,
      wallet
    );
    
    // Check if relayer is already authorized
    const isAuthorized = await publicVotingContract.authorizedRelayers(relayerAddress);
    console.log(`Relayer authorization status: ${isAuthorized}`);
    
    if (!isAuthorized) {
      console.log('Authorizing relayer...');
      
      // Get the default relayer
      const defaultRelayer = await publicVotingContract.defaultRelayerWallet();
      console.log(`Default relayer: ${defaultRelayer}`);
      
      if (defaultRelayer === relayerAddress) {
        console.log('This relayer is already the default relayer');
      } else {
        // We need to be authorized by the default relayer
        console.error(`
          This relayer needs to be authorized by the default relayer (${defaultRelayer}).
          Please contact the contract owner or default relayer to authorize this address: ${relayerAddress}
        `);
        process.exit(1);
      }
    }
    
    console.log('Relayer setup complete!');
    
  } catch (error) {
    console.error('Error setting up relayer:', error);
    process.exit(1);
  }
}

setupRelayer(); 