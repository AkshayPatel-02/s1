#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}ScrutinX Voting System - Test Script${NC}"
echo "This script will test the entire voting flow"
echo

# Check if server is running
echo -e "${YELLOW}Checking if server is running...${NC}"
if curl -s http://localhost:3001/api/status > /dev/null; then
  echo -e "${GREEN}Server is running!${NC}"
else
  echo -e "${RED}Server is not running. Starting server...${NC}"
  echo "Starting server in a new terminal window..."
  
  # Start server in a new terminal window or tab
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    osascript -e 'tell app "Terminal" to do script "cd '$(pwd)' && cd server && npm start"'
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v gnome-terminal &> /dev/null; then
      gnome-terminal -- bash -c "cd '$(pwd)'/server && npm start; exec bash"
    elif command -v xterm &> /dev/null; then
      xterm -e "cd '$(pwd)'/server && npm start" &
    else
      echo -e "${RED}Could not open a new terminal window. Please start the server manually in another terminal:${NC}"
      echo "cd $(pwd)/server && npm start"
      exit 1
    fi
  elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    start cmd /k "cd $(pwd)/server && npm start"
  else
    echo -e "${RED}Unsupported OS. Please start the server manually in another terminal:${NC}"
    echo "cd $(pwd)/server && npm start"
    exit 1
  fi
  
  echo "Waiting for server to start..."
  for i in {1..30}; do
    if curl -s http://localhost:3001/api/status > /dev/null; then
      echo -e "${GREEN}Server started successfully!${NC}"
      break
    fi
    if [ $i -eq 30 ]; then
      echo -e "${RED}Server failed to start within the timeout period.${NC}"
      exit 1
    fi
    sleep 1
  done
fi

# Test API
echo
echo -e "${YELLOW}Testing API...${NC}"
node test-api.js
echo

# Check if .env.test exists
if [ ! -f .env.test ]; then
  echo -e "${RED}.env.test file not found. Creating template...${NC}"
  cat > .env.test << EOL
# Test wallet private key (DO NOT use your main wallet!)
TEST_PRIVATE_KEY=your_private_key_here
RELAYER_API_URL=http://localhost:3001/api
EOL
  echo -e "${YELLOW}Please edit .env.test and add your test wallet private key${NC}"
  echo -e "${YELLOW}Then run this script again${NC}"
  exit 1
fi

# Source .env.test
echo -e "${YELLOW}Loading environment variables from .env.test...${NC}"
source .env.test

# Check if TEST_PRIVATE_KEY is set
if [ -z "$TEST_PRIVATE_KEY" ] || [ "$TEST_PRIVATE_KEY" == "your_private_key_here" ]; then
  echo -e "${RED}TEST_PRIVATE_KEY not set in .env.test${NC}"
  echo "Please edit .env.test and add your test wallet private key"
  exit 1
fi

# Test voting flow
echo
echo -e "${YELLOW}Testing voting flow...${NC}"
node test-vote.js

echo
echo -e "${GREEN}Tests completed!${NC}"
echo "Check the output above for any errors"
echo "For troubleshooting, refer to VOTING-TESTS.md" 