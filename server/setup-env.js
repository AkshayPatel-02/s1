/**
 * This script creates a .env file with the necessary configuration for the server
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a .env file with default values
const envContent = `# Server configuration
PORT=3001
NODE_ENV=development

# Blockchain configuration
RELAYER_PRIVATE_KEY=0xc8d2548ea4e9ab9d5bfeba982ab570ce42040d03cd88bf55f0aa82154187a2d1
RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/6zo2b7aZ7LuSzvtnoAOJO

# Contract addresses
PUBLIC_VOTING_CONTRACT=0x7f3bdcfa2d93052b7f552e6c9a19f7ad40954a65
PRIVATE_VOTING_CONTRACT=0x5a66f9f14e1bdef2e484a3e6a47701526dcb0f04

# Security
CORS_ORIGIN=http://localhost:8080,http://localhost:5173

CHAIN_ID=137
`;

// Write the .env file
const envPath = path.join(__dirname, '.env');
fs.writeFileSync(envPath, envContent);

console.log(`Created .env file at ${envPath}`);
console.log('NOTE: For production, replace the RELAYER_PRIVATE_KEY with a real private key'); 