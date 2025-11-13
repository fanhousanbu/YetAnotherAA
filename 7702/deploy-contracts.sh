#!/bin/bash

# EIP-7702 Contract Deployment Script
# This script deploys all contracts to Sepolia testnet

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  EIP-7702 Contract Deployment${NC}"
echo -e "${BLUE}========================================${NC}"

# Load environment variables
if [ -f .env ]; then
    source .env
    echo -e "${GREEN}✅ Loaded .env file${NC}"
else
    echo -e "${RED}❌ .env file not found!${NC}"
    exit 1
fi

# Check deployer balance
DEPLOYER_ADDR=$(cast wallet address $DEPLOYER_PRIVATE_KEY)
BALANCE=$(cast balance $DEPLOYER_ADDR --rpc-url $SEPOLIA_RPC_URL)
BALANCE_ETH=$(cast to-unit $BALANCE ether)

echo -e "${YELLOW}Deployer: $DEPLOYER_ADDR${NC}"
echo -e "${YELLOW}Balance: $BALANCE_ETH ETH${NC}"

if (( $(echo "$BALANCE_ETH < 0.05" | bc -l) )); then
    echo -e "${RED}❌ Insufficient balance! Need at least 0.05 ETH${NC}"
    exit 1
fi

# Deploy SponsorPaymaster
echo -e "\n${BLUE}1️⃣  Deploying SponsorPaymaster...${NC}"
PAYMASTER_DEPLOY=$(cast send --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --create $(cat out/SponsorPaymaster.sol/SponsorPaymaster.json | jq -r '.bytecode.object') \
  --json)

PAYMASTER_ADDRESS=$(echo $PAYMASTER_DEPLOY | jq -r '.contractAddress')
PAYMASTER_TX=$(echo $PAYMASTER_DEPLOY | jq -r '.transactionHash')

if [ "$PAYMASTER_ADDRESS" == "null" ] || [ -z "$PAYMASTER_ADDRESS" ]; then
    echo -e "${RED}❌ Paymaster deployment failed!${NC}"
    echo $PAYMASTER_DEPLOY
    exit 1
fi

echo -e "${GREEN}✅ SponsorPaymaster deployed!${NC}"
echo -e "${GREEN}   Address: $PAYMASTER_ADDRESS${NC}"
echo -e "${GREEN}   TX: $PAYMASTER_TX${NC}"
echo -e "${GREEN}   Explorer: https://sepolia.etherscan.io/address/$PAYMASTER_ADDRESS${NC}"

# Update .env file
sed -i '' "s|SPONSOR_PAYMASTER_ADDRESS=.*|SPONSOR_PAYMASTER_ADDRESS=$PAYMASTER_ADDRESS|" .env
sed -i '' "s|PAYMASTER_ADDRESS=.*|PAYMASTER_ADDRESS=$PAYMASTER_ADDRESS|" .env

# Deploy DelegationFactory
echo -e "\n${BLUE}2️⃣  Deploying DelegationFactory...${NC}"
# Constructor args: (address paymaster, address sbtContract, address xPNTsContract)
CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address,address,address)" $PAYMASTER_ADDRESS $SBT_CONTRACT_ADDRESS $XPNTS_CONTRACT_ADDRESS)
FACTORY_BYTECODE=$(cat out/DelegationFactory.sol/DelegationFactory.json | jq -r '.bytecode.object')$CONSTRUCTOR_ARGS

FACTORY_DEPLOY=$(cast send --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --create $FACTORY_BYTECODE \
  --json)

FACTORY_ADDRESS=$(echo $FACTORY_DEPLOY | jq -r '.contractAddress')
FACTORY_TX=$(echo $FACTORY_DEPLOY | jq -r '.transactionHash')

if [ "$FACTORY_ADDRESS" == "null" ] || [ -z "$FACTORY_ADDRESS" ]; then
    echo -e "${RED}❌ Factory deployment failed!${NC}"
    echo $FACTORY_DEPLOY
    exit 1
fi

echo -e "${GREEN}✅ DelegationFactory deployed!${NC}"
echo -e "${GREEN}   Address: $FACTORY_ADDRESS${NC}"
echo -e "${GREEN}   TX: $FACTORY_TX${NC}"
echo -e "${GREEN}   Explorer: https://sepolia.etherscan.io/address/$FACTORY_ADDRESS${NC}"

# Update .env file
sed -i '' "s|DELEGATION_FACTORY_ADDRESS=.*|DELEGATION_FACTORY_ADDRESS=$FACTORY_ADDRESS|" .env

# Deploy test delegation contract for TEST_EOA_ADDRESS
echo -e "\n${BLUE}3️⃣  Deploying Test Delegation for $TEST_EOA_ADDRESS...${NC}"
DELEGATION_CONSTRUCTOR=$(cast abi-encode "constructor(address,address,address,address,uint256)" \
  $TEST_EOA_ADDRESS \
  $PAYMASTER_ADDRESS \
  $SBT_CONTRACT_ADDRESS \
  $XPNTS_CONTRACT_ADDRESS \
  $DEFAULT_DAILY_LIMIT)

DELEGATION_BYTECODE=$(cat out/MinimalDelegationContract.sol/MinimalDelegationContract.json | jq -r '.bytecode.object')$DELEGATION_CONSTRUCTOR

DELEGATION_DEPLOY=$(cast send --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --create $DELEGATION_BYTECODE \
  --json)

TEST_DELEGATION_ADDRESS=$(echo $DELEGATION_DEPLOY | jq -r '.contractAddress')
DELEGATION_TX=$(echo $DELEGATION_DEPLOY | jq -r '.transactionHash')

if [ "$TEST_DELEGATION_ADDRESS" == "null" ] || [ -z "$TEST_DELEGATION_ADDRESS" ]; then
    echo -e "${RED}❌ Test delegation deployment failed!${NC}"
    echo $DELEGATION_DEPLOY
    exit 1
fi

echo -e "${GREEN}✅ Test Delegation deployed!${NC}"
echo -e "${GREEN}   Address: $TEST_DELEGATION_ADDRESS${NC}"
echo -e "${GREEN}   TX: $DELEGATION_TX${NC}"
echo -e "${GREEN}   Explorer: https://sepolia.etherscan.io/address/$TEST_DELEGATION_ADDRESS${NC}"

# Update .env file
sed -i '' "s|TEST_DELEGATION_ADDRESS=.*|TEST_DELEGATION_ADDRESS=$TEST_DELEGATION_ADDRESS|" .env

# Save deployment info
mkdir -p deployments
DEPLOY_FILE="deployments/sepolia-$(date +%Y%m%d-%H%M%S).json"
cat > $DEPLOY_FILE << EOF
{
  "network": "sepolia",
  "chainId": 11155111,
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployer": "$DEPLOYER_ADDR",
  "contracts": {
    "SponsorPaymaster": {
      "address": "$PAYMASTER_ADDRESS",
      "txHash": "$PAYMASTER_TX",
      "explorer": "https://sepolia.etherscan.io/address/$PAYMASTER_ADDRESS"
    },
    "DelegationFactory": {
      "address": "$FACTORY_ADDRESS",
      "txHash": "$FACTORY_TX",
      "explorer": "https://sepolia.etherscan.io/address/$FACTORY_ADDRESS"
    },
    "TestDelegation": {
      "address": "$TEST_DELEGATION_ADDRESS",
      "owner": "$TEST_EOA_ADDRESS",
      "dailyLimit": "$DEFAULT_DAILY_LIMIT",
      "txHash": "$DELEGATION_TX",
      "explorer": "https://sepolia.etherscan.io/address/$TEST_DELEGATION_ADDRESS"
    }
  },
  "configuration": {
    "sbtContract": "$SBT_CONTRACT_ADDRESS",
    "xPNTsContract": "$XPNTS_CONTRACT_ADDRESS",
    "paymasterAddress": "$PAYMASTER_ADDRESS"
  }
}
EOF

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Deployment info saved to: $DEPLOY_FILE${NC}"
echo -e "\n${BLUE}Contract Addresses:${NC}"
echo -e "${GREEN}SponsorPaymaster:    $PAYMASTER_ADDRESS${NC}"
echo -e "${GREEN}DelegationFactory:   $FACTORY_ADDRESS${NC}"
echo -e "${GREEN}TestDelegation:      $TEST_DELEGATION_ADDRESS${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Fund Paymaster: cast send $PAYMASTER_ADDRESS --value 0.1ether --private-key \$DEPLOYER_PRIVATE_KEY --rpc-url \$SEPOLIA_RPC_URL"
echo -e "2. Update backend/.env with new addresses"
echo -e "3. Update frontend/.env with new addresses"
echo -e "4. Start services: npm start"

echo -e "\n${BLUE}========================================${NC}"
