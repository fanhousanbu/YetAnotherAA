#!/bin/bash

echo "🧪 AAStarValidator Integration Test"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Generating signatures with signer tool...${NC}"
cd ../signer
SIGNER_OUTPUT=$(node index.js "integration test message" 1,2 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Signatures generated successfully${NC}"
    echo "$SIGNER_OUTPUT"
else
    echo -e "${RED}❌ Failed to generate signatures${NC}"
    echo "$SIGNER_OUTPUT"
    exit 1
fi

echo -e "\n${YELLOW}Step 2: Running contract tests...${NC}"
cd ../validator

# Run forge tests
echo "Running Forge tests..."
forge test --match-contract AAStarValidatorTest

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Contract tests passed${NC}"
else
    echo -e "${RED}❌ Contract tests failed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 3: Testing on-chain integration...${NC}"
echo "Note: Update TestDualSignature.s.sol with the generated parameters above"
echo "Then run: forge script script/TestDualSignature.s.sol --rpc-url \$RPC_URL"

echo -e "\n${GREEN}✅ Integration test complete!${NC}"
echo "Manual verification required for on-chain testing."