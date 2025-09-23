# BLS Aggregate Signature + ERC-4337 Account Abstraction System

A complete implementation integrating BLS aggregate signatures with ERC-4337
account abstraction, featuring WebAuthn/Passkey authentication, dynamic gas
calculation and multi-node signature verification.

> **⚠️ Security Notice**: This repository provides reference implementations and
> example deployments for educational and testing purposes. For production use,
> you should deploy your own contracts and manage your own private keys. Do not
> rely on the reference contract addresses provided in this documentation for
> production applications.

## 🎯 System Features

- **WebAuthn/Passkey Authentication**: Biometric authentication (Face ID, Touch ID, Windows Hello) for secure login and transaction verification
- **BLS12-381 Aggregate Signatures**: Multi-node signature aggregation to reduce
  on-chain verification costs
- **ERC-4337 Account Abstraction**: Full compatibility with Ethereum Account
  Abstraction standard
- **Automatic Node Selection**: Automatically selects active BLS nodes from
  gossip network
- **Gas Optimization**: Precise gas estimation based on EIP-2537 standards
- **Dual Verification Mechanism**: AA signatures verify userOpHash, BLS
  signatures verify messagePoint
- **Enhanced Security**: Mandatory passkey verification for all transactions
- **Production Ready**: Complete verification on Sepolia testnet

## 📁 Project Structure

```
YetAnotherAA/
├── validator/                    # Validator contracts
│   ├── src/
│   │   ├── AAStarValidator.sol   # BLS validator with gas optimization
│   │   ├── AAStarAccountV6.sol   # ERC-4337 account implementation
│   │   └── AAStarAccountFactoryV6.sol # Account factory
│   ├── script/
│   │   ├── DeployValidator.s.sol      # Deployment script
│   │   └── RegisterKeys.s.sol         # Registration script
│   └── archive/                  # Archived legacy files
├── signer/
│   ├── demo/                     # Core tools
│   │   ├── main.js               # ERC-4337 + BLS transfer tool
│   │   ├── config.example.json   # Configuration template
│   │   └── README.md             # Demo usage guide
│   ├── src/                      # BLS signing service
│   └── README.md                 # Signer service documentation
├── aastar/                       # Backend API (NestJS)
│   ├── src/                      # API source code with WebAuthn/Passkey support
│   ├── data/                     # JSON data storage
│   └── README.md                 # API documentation
├── aastar-frontend/              # Frontend Application (Next.js)
│   ├── app/                      # Next.js pages with biometric authentication
│   ├── components/               # React components
│   ├── lib/                      # Utilities and API client
│   └── README.md                 # Frontend documentation
├── paymaster/                    # Paymaster Implementation
│   ├── contracts/                # Paymaster smart contracts
│   └── admin/                    # Paymaster admin interface
└── README.md                     # Project documentation
```

## 📋 Contract Deployment

**⚠️ Important**: You should deploy your own contracts for production use. The
addresses below are reference examples from our testnet deployment.

### Required Contracts

- **AAStarValidator**: Your deployed validator contract
- **AAStarAccountFactory**: Your deployed account factory
- **AAStarAccountV6 Implementation**: Your deployed account implementation
- **EntryPoint**: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` (Official
  ERC-4337 EntryPoint)

### Reference Deployment (Sepolia Testnet)

For testing and reference purposes only:

- **AAStarValidator**: `0xAe7eA28a0aeA05cbB8631bDd7B10Cb0f387FC479`
- **AAStarAccountFactory**: `0x559DD2D8Bf9180A70Da56FEFF57DA531BF3f2E1c`
- **AAStarAccountV6 Implementation**:
  `0x15c0f6d0d6152121099ab05993f5975299410f6a`

## 🛠️ Core Technical Implementation

### 1. Dynamic Gas Calculation

Precise gas estimation algorithm based on EIP-2537 standards:

```solidity
function _calculateRequiredGas(
  uint256 nodeCount
) internal pure returns (uint256) {
  // EIP-2537 pairing operations: 32600 * k + 37700 (k=2)
  uint256 pairingBaseCost = 102900;

  // G1 point addition: (nodeCount - 1) * 500
  uint256 g1AdditionCost = (nodeCount - 1) * 500;

  // Storage reads: nodeCount * 2100
  uint256 storageReadCost = nodeCount * 2100;

  // EVM execution overhead: 50000 + (nodeCount * 1000)
  uint256 evmExecutionCost = 50000 + (nodeCount * 1000);

  // 25% safety margin + boundary limits (600k - 2M)
  return calculateFinalGas(totalCost);
}
```

### 2. BLS Signature Format

Complete 705-byte signature structure:

```
[nodeIdsLength(32)][nodeIds...][blsSignature(256)][messagePoint(256)][aaSignature(65)]
```

### 3. Verification Process

```
1. ECDSA Verification: userOpHash.toEthSignedMessageHash() vs owner
2. BLS Verification: aggregate public key + BLS signature + messagePoint
3. Pairing Check: e(G, signature) = e(aggPubKey, messagePoint)
```

## 🧪 Verification Results

### Transfer Success Proof

- **Transaction Hash**:
  [0x8aa6fdef19f66e687a570c4fefeb7524538a32fcb06320251d25c5b714370a55](https://sepolia.etherscan.io/tx/0x8aa6fdef19f66e687a570c4fefeb7524538a32fcb06320251d25c5b714370a55)
- **Transfer Amount**: 0.002 ETH ✅
- **Gas Used**: 653,060
- **Verification Status**: BLS aggregate signature verification successful

### Gas Efficiency Comparison

| Node Count | Dynamic Gas Estimate | Actual Usage | Efficiency          |
| ---------- | -------------------- | ------------ | ------------------- |
| 1 node     | 600,000              | ~520k        | Baseline protection |
| 3 nodes    | 600,000              | ~653k        | Moderate            |
| 100 nodes  | 640,500              | Estimated    | Auto-scaling        |

## 🔐 WebAuthn/Passkey Integration

### Authentication Features

The system implements FIDO2-compliant WebAuthn authentication with the following security enhancements:

1. **Passwordless Login**: Users can log in using only biometric authentication
2. **Multi-Device Support**: Register passkeys on multiple devices for convenience
3. **Transaction Verification**: Every transaction requires passkey confirmation
4. **Device Registration**: Secure process for adding new devices to existing accounts

### Supported Authentication Methods

- **Face ID** (iOS/macOS)
- **Touch ID** (iOS/macOS)
- **Windows Hello** (Windows)
- **Android Biometric** (Android devices)
- **Hardware Security Keys** (YubiKey, etc.)

### Security Configuration

```typescript
// Passkey registration settings
authenticatorSelection: {
  residentKey: "required",           // Discoverable credentials
  userVerification: "required",      // Mandatory biometric verification
}

// Verification requirements
requireUserVerification: true        // Force biometric check
```

### API Endpoints

- `POST /auth/passkey/login/begin` - Start passkey login
- `POST /auth/passkey/login/complete` - Complete passkey login
- `POST /auth/transaction/verify/begin` - Start transaction verification
- `POST /auth/transaction/verify/complete` - Complete transaction verification

## 🔄 Automatic Node Selection

The system now automatically selects active BLS nodes from the gossip network:

1. **Gossip Network Discovery**: Queries active nodes from the P2P network
2. **Automatic Selection**: Selects the optimal 3 nodes for signature generation
3. **No Manual Configuration**: Users don't need to select nodes manually
4. **Improved UX**: Simplified transfer process with automatic node management

## 📖 Usage Guide

### 1. Deploy Your Own Contracts

**Important**: Deploy your own contracts for security and control.

```bash
cd validator
# Set up your environment variables
export PRIVATE_KEY=your_private_key_here
export RPC_URL=your_rpc_url_here

# Deploy validator contracts
forge script script/DeployValidator.s.sol --rpc-url $RPC_URL --broadcast
```

### 2. Register Your BLS Nodes

```bash
# Update RegisterKeys.s.sol with your deployed validator address
# Then register your BLS public keys
forge script script/RegisterKeys.s.sol --rpc-url $RPC_URL --broadcast
```

### 3. Configure and Run Demo

```bash
cd signer/demo
cp config.example.json config.json
# Edit config.json with:
# - Your deployed contract addresses
# - Your private keys
# - Your BLS node configurations
node main.js
```

### 4. BLS Signing Service (Optional)

```bash
cd signer
npm install
npm start
```

## 🔧 Technical Features

### ERC-4337 Compatibility

- ✅ Standard UserOperation structure
- ✅ EntryPoint v0.6 support
- ✅ Complete account abstraction functionality
- ✅ Paymaster compatibility (optional)

### BLS Signature Advantages

- ✅ Aggregate signatures reduce on-chain costs
- ✅ Support for arbitrary number of nodes
- ✅ Quantum-resistant preparation
- ✅ High-security multi-signature

### Dynamic Gas Optimization

- ✅ EIP-2537 standard-based calculation
- ✅ Node count adaptive
- ✅ 25% safety margin
- ✅ Reasonable boundary protection

## 🛡️ Security Features

1. **WebAuthn/Passkey Security**:
   - Biometric authentication for all logins and transactions
   - FIDO2-compliant passkey verification
   - Mandatory user verification (userVerification: "required")
   - No password-only access for sensitive operations

2. **Dual Verification**: AA + BLS dual signature mechanism
3. **Transaction Security**: Every transaction requires passkey verification
4. **Time Locks**: Support for validAfter/validUntil
5. **Replay Protection**: Nonce mechanism prevents replay
6. **Access Control**: Owner-only critical operations
7. **Gas Limits**: Prevent DoS attacks

### 🔐 Authentication Security Model

- **Login**: Requires biometric verification (Face ID, Touch ID, Windows Hello)
- **Transaction Execution**: Mandatory passkey verification before each transaction
- **Device Registration**: New devices require existing credentials for passkey setup
- **Session Security**: JWT tokens combined with passkey verification for sensitive operations

## 🔒 Security Considerations

- **Private Key Management**: All configuration files with private keys are
  excluded from git
- **Template Configuration**: Use `config.example.json` to set up your private
  keys
- **Development Keys**: Test keys only - never use in production
- **Environment Variables**: Production deployments should use secure key
  management

## 🎓 Learning Value

This project demonstrates:

- **Modern Cryptography**: BLS12-381 elliptic curve pairing
- **Ethereum Frontier**: ERC-4337 account abstraction
- **Engineering Optimization**: Dynamic gas calculation
- **System Integration**: Multi-component coordination
- **Production Deployment**: Complete testing and verification

## 🚀 Quick Start

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd YetAnotherAA
   ```

2. **Deploy your contracts**

   ```bash
   cd validator
   # Set up environment variables first
   export PRIVATE_KEY=your_private_key_here
   export RPC_URL=your_rpc_url_here
   forge script script/DeployValidator.s.sol --rpc-url $RPC_URL --broadcast
   ```

3. **Configure demo with your contracts**

   ```bash
   cd signer/demo
   cp config.example.json config.json
   # Edit config.json with YOUR deployed contract addresses and keys
   ```

4. **Run the transfer tool**
   ```bash
   node main.js
   ```

**Note**: For quick testing, you can use our reference contracts on Sepolia, but
deploy your own for production use.

## 🌐 Complete Application Stack

A full-stack application with all components is now available:

### BLS Signer Service (NestJS)

- **Location**: `signer/`
- **Port**: http://localhost:3001 (HTTP API & WebSocket Gossip at /ws)
- **Features**: BLS signature generation, gossip network, node management
- **Documentation**: Swagger UI at http://localhost:3001/api
- **Gossip Network**: WebSocket at ws://localhost:3001/ws

```bash
cd signer
npm install
npm run start
```

### Backend API (NestJS)

- **Location**: `aastar/`
- **Port**: http://localhost:3000
- **Features**: User auth, account management, ERC-4337 transfers
- **Documentation**: Swagger UI at http://localhost:3000/api-docs

```bash
cd aastar
npm install
npm run start:dev
```

### Frontend Application (Next.js)

- **Location**: `aastar-frontend/`
- **Port**: http://localhost:8080
- **Features**: Complete user interface for registration, login, transfers

```bash
cd aastar-frontend
npm install
npm run dev
```

### Complete User Flow

1. **Start all services**:
   ```bash
   npm run start:dev -w aastar        # Backend API, port 3000
   npm run start:dev -w signer        # Signer service, port 3001
   npm run dev -w aastar-frontend     # Frontend, port 8080
   npm start -w paymaster/admin       # Paymaster admin, port 8081
   ```

2. **User Registration & Authentication**:
   - Visit http://localhost:8080
   - Register with email/password + setup passkey (biometric authentication)
   - Login using passkey only (no password required after setup)

3. **Account Management**:
   - Create ERC-4337 smart account
   - Fund account through various methods
   - View account balance and details

4. **Secure Transactions**:
   - **Transaction Flow**: Amount → Passkey Verification → Execution
   - Every transaction requires biometric authentication
   - Real-time status tracking with polling

5. **Advanced Features**:
   - View transfer history and status
   - Paymaster integration for gasless transactions
   - Multi-device passkey support

**Enhanced Features**:

- ✅ **WebAuthn/Passkey Authentication**: Biometric security for login and transactions
- ✅ **Multi-node BLS signature aggregation**
- ✅ **ERC-4337 account abstraction**
- ✅ **Mandatory transaction verification**: No unauthorized transactions possible
- ✅ **Gasless transaction support** via Paymaster
- ✅ **Real-time gossip network**
- ✅ **Complete user interface** with security indicators
- ✅ **No CORS issues** (API proxy)
- ✅ **Multi-device support** for passkeys

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Issues and Pull Requests are welcome to improve this project!

---

**Project Status**: ✅ Production Ready | **Last Updated**: September 2025 |
**Network**: Sepolia Testnet | **Security**: WebAuthn/Passkey Enhanced
