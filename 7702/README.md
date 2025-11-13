# EIP-7702 Delegation System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-FFDB1C.svg)](https://getfoundry.sh/)

> 🚀 Zero ETH threshold EIP-7702 delegation system with Paymaster sponsorship + Relayer backup solution

## ✨ Features

- ✅ **Zero ETH Threshold**: Users can use EIP-7702 delegation without holding ETH
- 🔄 **Hybrid Solution**: Paymaster priority + Relayer fallback mechanism
- 🔒 **Secure Authentication**: Integrated WebAuthn biometric authentication
- 📊 **Real-time Status**: Complete delegation status monitoring
- ⚡ **Fast Deployment**: One-click startup with Docker or manual setup
- 🏗️ **Full Stack**: Smart contracts (Foundry) + Backend (Express) + Frontend (Vite)

## 📦 Project Structure

```
7702/
├── src/                        # Foundry Smart Contracts
│   ├── DelegationFactory.sol          # Factory contract for creating delegation contracts
│   ├── MinimalDelegationContract.sol  # Core delegation implementation
│   └── SponsorPaymaster.sol           # Paymaster for gasless transactions
├── backend/                    # Express Backend Service
│   └── src/
│       └── index.js                   # Main API server (port 3001)
├── frontend/                   # Vite Frontend Application
│   ├── test.html                      # Full test page
│   ├── simple-test.html               # Simple test page
│   └── index.html                     # Main UI
├── script/                     # Deployment Scripts
├── test/                       # Smart Contract Tests
├── docs/                       # Documentation
│   ├── README.md                      # Detailed documentation
│   ├── PRD.md                         # Product requirements
│   └── EIP7702-Hybrid-Implementation.md
├── deployments/                # Deployed contract addresses
├── foundry.toml                # Foundry configuration
├── package.json                # Root package config
└── start.sh                    # Quick start script
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 8+
- Foundry (for smart contracts)
- MetaMask Browser Extension
- Sepolia Test Network access

### Installation

```bash
# Clone the repository
git clone https://github.com/fanhousanbu/YetAnotherAA.git
cd YetAnotherAA

# Switch to 7702 branch
git checkout 7702
cd 7702

# Install Foundry dependencies
forge install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Running the Application

#### Option 1: Using Startup Script (Recommended)

```bash
chmod +x start.sh
./start.sh
```

#### Option 2: Manual Start

```bash
# Terminal 1: Start backend (port 3001)
cd backend && npm start

# Terminal 2: Start frontend (port 8080)
cd frontend && npm run dev
```

### Access the Application

- **Frontend Interface**: http://localhost:8080
- **Simple Test Page**: http://localhost:8080/simple-test.html
- **Full Test Page**: http://localhost:8080/test.html
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## 🔧 Smart Contract Development

### Compile Contracts

```bash
forge build
```

### Run Tests

```bash
forge test
```

### Deploy Contracts

```bash
# Deploy to Sepolia
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast --verify

# Deploy to OP Sepolia
npm run deploy:op-sepolia
```

## 📚 Documentation

- [Detailed Documentation](./docs/README.md) - Complete system documentation
- [Test Guide](./test-guide.md) - Testing instructions
- [Product Requirements](./docs/PRD.md) - Product specifications
- [EIP-7702 Implementation](./docs/EIP7702-Hybrid-Implementation.md) - Technical details

## 🎯 How It Works

### 1. Connect Wallet
- Install MetaMask
- Connect to Sepolia test network
- No ETH required in wallet

### 2. Check Delegation Status
- Enter user address or use default test address
- System checks current delegation state

### 3. Enable Delegation
- Set daily spending limit (default 0.1 ETH)
- Click "Enable Zero-Gas Delegation"
- System automatically selects optimal solution

### 4. Transaction Solutions

#### Paymaster Solution (Priority)
- Uses ERC-4337 Paymaster
- Fully gasless for users
- Requires UserOperation signature
- Bundler handles transaction submission

#### Relayer Solution (Fallback)
- Activated when Paymaster unavailable
- Relayer pays gas on behalf of user
- Requires transaction signature
- Direct on-chain submission

## 🔒 Security

- Smart contracts inherit from OpenZeppelin
- WebAuthn biometric authentication
- Daily spending limits
- Transaction signature verification
- Secure key management in backend

## 🧪 Testing

### Run Backend Tests

```bash
cd backend
npm test
```

### Run Smart Contract Tests

```bash
forge test -vvv
```

### Manual Testing

1. Open http://localhost:8080/simple-test.html
2. Follow on-screen instructions
3. Check console for detailed logs

## 📝 Environment Configuration

### Backend (.env)

```bash
NODE_ENV=production
PORT=3001
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
DEPLOYER_PRIVATE_KEY=0x...
RELAYER_PRIVATE_KEY=0x...
```

### Frontend

Frontend automatically proxies API requests to backend via Vite config.

## 🌐 Deployed Contracts (Sepolia Testnet)

- **DelegationFactory**: `0x91Cb993E50e959C10b4600CB825A93740b79FeA9`
- **SponsorPaymaster**: `0x91Cb993E50e959C10b4600CB825A93740b79FeA9`

See [deployments/](./deployments/) for complete addresses.

## 🤝 Contributing

This is a test implementation for EIP-7702. Contributions welcome!

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - See [LICENSE](../LICENSE) file for details

## 🔗 Links

- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [Main Repository](https://github.com/fanhousanbu/YetAnotherAA)
- [Documentation](./docs/)

## 💬 Support

For questions or issues:
- Open an issue in the repository
- Check the [docs/](./docs/) folder
- Review the [test-guide.md](./test-guide.md)

---

**Status**: 🧪 Experimental - Test Branch
**Network**: Sepolia Testnet
**Objective**: EIP-7702 exploration and integration with YetAnotherAA
