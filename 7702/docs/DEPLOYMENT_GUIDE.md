# 🚀 Sepolia Testnet Deployment Guide

**Target Network**: Sepolia Testnet
**Estimated Time**: 30-45 minutes
**Required Funds**: ~0.5 ETH (Sepolia testnet ETH)

---

## 📋 Pre-Deployment Checklist

### 1. Environment Setup

- [ ] Node.js >= 20.19.0 installed
- [ ] Foundry installed (`foundryup`)
- [ ] Git repository cloned
- [ ] Dependencies installed (`npm install`)

### 2. Accounts & Keys

- [ ] Deployer wallet created (with private key)
- [ ] Relayer wallet created (with private key)
- [ ] Test EOA wallet created (for testing)
- [ ] All wallets funded with Sepolia ETH

### 3. API Keys

- [ ] Alchemy/Infura RPC API key obtained
- [ ] Pimlico Bundler API key obtained (optional)
- [ ] Etherscan API key obtained (for verification)

### 4. Configuration

- [ ] `.env.sepolia` file created and configured
- [ ] All placeholders replaced with actual values
- [ ] Private keys secured (not committed to git)

---

## 🔧 Step-by-Step Deployment

### Step 1: Prepare Environment

```bash
# Navigate to 7702 directory
cd /path/to/YetAnotherAA/7702

# Copy example env file
cp .env.sepolia.example .env.sepolia

# Edit with your values
nano .env.sepolia
```

**Required Values**:
```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
RELAYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

### Step 2: Get Testnet ETH

**Sepolia Faucets**:
1. **Alchemy Faucet**: https://sepoliafaucet.com/
2. **Infura Faucet**: https://www.infura.io/faucet/sepolia
3. **Chainlink Faucet**: https://faucets.chain.link/sepolia
4. **QuickNode Faucet**: https://faucet.quicknode.com/ethereum/sepolia

**Required Amounts**:
- Deployer: 0.3-0.5 ETH (for contract deployment)
- Relayer: 0.1-0.2 ETH (for transaction relaying)
- Test EOA: 0.01 ETH (for testing)

**Check Balance**:
```bash
# Load environment
source .env.sepolia

# Check deployer balance
cast balance $DEPLOYER_ADDRESS --rpc-url $SEPOLIA_RPC_URL

# Check relayer balance
cast balance $RELAYER_ADDRESS --rpc-url $SEPOLIA_RPC_URL
```

### Step 3: Compile Contracts

```bash
# Clean previous builds
forge clean

# Compile contracts
forge build

# Verify compilation
ls -lh out/MinimalDelegationContract.sol/MinimalDelegationContract.json
ls -lh out/DelegationFactory.sol/DelegationFactory.json
ls -lh out/SponsorPaymaster.sol/SponsorPaymaster.json
```

**Expected Output**:
```
✅ Compilation successful
✅ 3 contracts compiled
✅ ABIs generated in out/ directory
```

### Step 4: Deploy Contracts

#### Option A: Full Deployment (Recommended)

```bash
# Deploy all contracts with verification
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvvv
```

#### Option B: Step-by-Step Deployment

**1. Deploy SponsorPaymaster**:
```bash
forge script script/DeploySponsorPaymaster.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

**2. Deploy DelegationFactory**:
```bash
# After getting Paymaster address, update .env.sepolia
# Then deploy factory
forge script script/Deploy.s.sol:Deploy \
  --sig "deployFactory()" \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify
```

**3. Deploy Test Delegation**:
```bash
# Deploy delegation for test EOA
forge script script/Deploy.s.sol:Deploy \
  --sig "deployUserDelegation(address,address,uint256)" \
  $DELEGATION_FACTORY_ADDRESS \
  $TEST_EOA_ADDRESS \
  $DEFAULT_DAILY_LIMIT \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

### Step 5: Verify Deployment

```bash
# Check deployed contracts
forge script script/Deploy.s.sol \
  --sig "predictDelegationAddress(address,address)" \
  $DELEGATION_FACTORY_ADDRESS \
  $TEST_EOA_ADDRESS \
  --rpc-url $SEPOLIA_RPC_URL
```

**Verification Checklist**:
- [ ] Factory contract deployed and verified on Etherscan
- [ ] Paymaster contract deployed and verified
- [ ] Test delegation contract deployed
- [ ] All addresses saved to `.env.sepolia`
- [ ] Deployment info saved to `deployments/sepolia.json`

### Step 6: Fund Paymaster

```bash
# Send ETH to Paymaster for sponsorship
cast send $SPONSOR_PAYMASTER_ADDRESS \
  --value 0.5ether \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url $SEPOLIA_RPC_URL

# Verify Paymaster balance
cast call $SPONSOR_PAYMASTER_ADDRESS \
  "getBalance()" \
  --rpc-url $SEPOLIA_RPC_URL
```

### Step 7: Update Backend Configuration

```bash
# Navigate to backend
cd backend

# Update .env with deployed addresses
cat > .env << EOF
NODE_ENV=development
PORT=3001
SEPOLIA_RPC_URL=$SEPOLIA_RPC_URL
DELEGATION_FACTORY_ADDRESS=$DELEGATION_FACTORY_ADDRESS
PAYMASTER_ADDRESS=$SPONSOR_PAYMASTER_ADDRESS
RELAYER_PRIVATE_KEY=$RELAYER_PRIVATE_KEY
EOF

# Install dependencies
npm install

# Start backend
npm start
```

### Step 8: Update Frontend Configuration

```bash
# Navigate to frontend
cd ../frontend

# Update .env
cat > .env << EOF
VITE_NETWORK=sepolia
VITE_CHAIN_ID=11155111
VITE_RPC_URL=$SEPOLIA_RPC_URL
VITE_API_URL=http://localhost:3001
VITE_FACTORY_ADDRESS=$DELEGATION_FACTORY_ADDRESS
VITE_PAYMASTER_ADDRESS=$SPONSOR_PAYMASTER_ADDRESS
EOF

# Install dependencies
npm install

# Start frontend
npm run dev
```

---

## 🧪 Post-Deployment Testing

### Test 1: Health Check

```bash
# Check backend health
curl http://localhost:3001/health

# Expected: {"status":"ok","timestamp":"..."}
```

### Test 2: Check Delegation Status

```bash
# Check if test EOA has delegation
curl -X POST http://localhost:3001/api/eip7702/status \
  -H "Content-Type: application/json" \
  -d "{\"userAddress\":\"$TEST_EOA_ADDRESS\"}"

# Expected: {"enabled":true,"address":"0x...","method":"paymaster","isSponsored":false}
```

### Test 3: Frontend Access

1. Open browser: http://localhost:8080
2. Connect MetaMask to Sepolia
3. Import test EOA private key to MetaMask
4. Try "Check Status" button
5. Try "Enable Delegation" button

### Test 4: On-Chain Verification

```bash
# Verify factory on Etherscan
echo "https://sepolia.etherscan.io/address/$DELEGATION_FACTORY_ADDRESS"

# Verify paymaster on Etherscan
echo "https://sepolia.etherscan.io/address/$SPONSOR_PAYMASTER_ADDRESS"

# Check factory configuration
cast call $DELEGATION_FACTORY_ADDRESS \
  "getConfiguration()" \
  --rpc-url $SEPOLIA_RPC_URL
```

---

## 📊 Gas Monitoring Setup

### Create Monitoring Script

```bash
cat > scripts/monitor-gas.js << 'EOF'
const { ethers } = require("ethers");

async function monitorGas() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

  // Get current gas price
  const feeData = await provider.getFeeData();
  console.log("Current Gas Price:", ethers.formatUnits(feeData.gasPrice, "gwei"), "Gwei");

  // Monitor deployment transactions
  const factory = await provider.getContract(process.env.DELEGATION_FACTORY_ADDRESS);
  // Add monitoring logic here
}

monitorGas().catch(console.error);
EOF

# Run monitoring
node scripts/monitor-gas.js
```

### Set Up Gas Alerts

Create `scripts/gas-alerts.js`:
```javascript
// Monitor gas costs and send alerts when thresholds exceeded
// Integrate with Discord/Telegram/Email for notifications
```

---

## 📝 Deployment Record

### Save Deployment Info

```bash
# Create deployment record
cat > deployments/sepolia-$(date +%Y%m%d).json << EOF
{
  "network": "sepolia",
  "chainId": 11155111,
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployer": "$DEPLOYER_ADDRESS",
  "contracts": {
    "DelegationFactory": {
      "address": "$DELEGATION_FACTORY_ADDRESS",
      "txHash": "",
      "blockNumber": "",
      "verified": true
    },
    "SponsorPaymaster": {
      "address": "$SPONSOR_PAYMASTER_ADDRESS",
      "txHash": "",
      "blockNumber": "",
      "verified": true
    },
    "TestDelegation": {
      "address": "",
      "owner": "$TEST_EOA_ADDRESS",
      "dailyLimit": "$DEFAULT_DAILY_LIMIT"
    }
  },
  "configuration": {
    "sbtContract": "$SBT_CONTRACT_ADDRESS",
    "xPNTsContract": "$XPNTS_CONTRACT_ADDRESS",
    "entryPoint": "$ENTRY_POINT_V7_ADDRESS"
  }
}
EOF
```

---

## ⚠️ Troubleshooting

### Issue 1: Insufficient Funds

**Error**: `Error: insufficient funds for intrinsic transaction cost`

**Solution**:
```bash
# Check balance
cast balance $DEPLOYER_ADDRESS --rpc-url $SEPOLIA_RPC_URL

# Get more testnet ETH from faucets
```

### Issue 2: RPC Rate Limiting

**Error**: `Error: rate limit exceeded`

**Solution**:
- Use different RPC provider
- Upgrade to paid tier
- Add delays between transactions

### Issue 3: Verification Failed

**Error**: `Error: verification failed on Etherscan`

**Solution**:
```bash
# Manual verification
forge verify-contract \
  $DELEGATION_FACTORY_ADDRESS \
  src/DelegationFactory.sol:DelegationFactory \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" $PAYMASTER_ADDRESS $SBT_CONTRACT_ADDRESS $XPNTS_CONTRACT_ADDRESS)
```

### Issue 4: Contract Size Too Large

**Error**: `Error: contract size exceeds limit`

**Solution**:
```bash
# Enable optimizer in foundry.toml
[profile.default]
optimizer = true
optimizer_runs = 200

# Recompile
forge build
```

---

## 📚 Additional Resources

### Documentation Links
- **Sepolia Explorer**: https://sepolia.etherscan.io/
- **Foundry Book**: https://book.getfoundry.sh/
- **ERC-4337 Docs**: https://docs.erc4337.io/
- **Pimlico Docs**: https://docs.pimlico.io/

### Community Support
- **Discord**: [Your Discord Link]
- **GitHub Issues**: https://github.com/fanhousanbu/YetAnotherAA/issues
- **Documentation**: See `docs/` folder

---

## ✅ Deployment Complete!

If all steps succeeded, you should have:

- ✅ All contracts deployed to Sepolia
- ✅ Contracts verified on Etherscan
- ✅ Backend API running
- ✅ Frontend accessible
- ✅ Test EOA with delegation enabled
- ✅ Paymaster funded and ready
- ✅ Monitoring tools configured

**Next Step**: Proceed to **Integration Testing** → See `INTEGRATION_TEST_GUIDE.md`

---

**Last Updated**: 2025-11-13
**Maintainer**: YetAnotherAA Team
