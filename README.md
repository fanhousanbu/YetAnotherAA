# 🔐 WebAuthn + BLS + ERC-4337 Account Abstraction

[![GitHub Stars](https://img.shields.io/github/stars/fanhousanbu/YetAnotherAA?style=for-the-badge&logo=github)](https://github.com/fanhousanbu/YetAnotherAA/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/fanhousanbu/YetAnotherAA?style=for-the-badge&logo=github)](https://github.com/fanhousanbu/YetAnotherAA/network)
[![CI Status](https://img.shields.io/github/actions/workflow/status/fanhousanbu/YetAnotherAA/ci.yml?branch=master&style=for-the-badge&logo=github-actions)](https://github.com/fanhousanbu/YetAnotherAA/actions)
[![License](https://img.shields.io/github/license/fanhousanbu/YetAnotherAA?style=for-the-badge)](https://github.com/fanhousanbu/YetAnotherAA/blob/master/LICENSE)

<div align="center">

🚀 **Production-Ready** | 🔐 **WebAuthn/Passkey** | ⚡ **BLS Signatures** | 🏗️ **ERC-4337 AA** | 🔑 **KMS Integration**

</div>

---

A **complete, production-ready** implementation combining **biometric authentication** (Face ID, Touch ID, Windows Hello), **BLS aggregate signatures**, and **ERC-4337 account abstraction**. Features passwordless login, mandatory transaction verification, **KMS-based key management**, and **gasless account deployment** via Paymaster sponsorship.

> **🎯 Perfect for**: Web3 developers building secure wallets, DeFi applications requiring enhanced security, and projects needing passwordless blockchain authentication with enterprise-grade key management.

## ⚡ Quick Start

```bash
# Clone and install
git clone https://github.com/fanhousanbu/YetAnotherAA.git
cd YetAnotherAA && npm install

# Start all services (using VS Code launch configuration)
npm run start:dev -w aastar        # Backend API (port 3000)
npm run start:dev -w signer        # BLS Signer (port 3001)
npm run dev -w aastar-frontend     # Frontend (port 8080)

# Visit http://localhost:8080 and register with Face ID/Touch ID!
```

## ✨ Core Innovations

### 🔐 **1. WebAuthn/Passkey Authentication**

- **Passwordless Experience**: Login and transactions using only biometrics (Face ID, Touch ID, Windows Hello)
- **FIDO2 Compliant**: Industry-standard WebAuthn implementation with mandatory user verification
- **Multi-Device Support**: Register passkeys across multiple devices
- **Transaction Security**: Every transaction requires biometric confirmation

### ⚡ **2. BLS Signature Aggregation**

- **Multi-Node Signatures**: Aggregate signatures from multiple BLS nodes efficiently
- **Dynamic Gas Optimization**: EIP-2537-based calculation adapts to node count
- **Gossip Network**: Automatic node discovery and selection via P2P network
- **Quantum-Ready**: BLS12-381 curve provides preparation for post-quantum security

### 🏗️ **3. ERC-4337 Account Abstraction**

- **Multi-Version Support**: Compatible with EntryPoint v0.6, v0.7, and v0.8
- **Unified Architecture**: User wallet acts as both creator and signer (no separate deployer)
- **Gasless Deployment**: Account creation sponsored by Paymaster - **zero ETH required**
- **Dual Verification**: AA signatures verify userOpHash, BLS signatures verify messagePoint

### 🔑 **4. KMS Integration (Production Ready)**

- **Secure Key Management**: Production wallets managed by Key Management Service
- **Zero Private Key Exposure**: Keys never leave the secure KMS environment
- **Auto-Generated Wallets**: User wallets created automatically (KMS in production, local in dev)
- **No Manual Configuration**: Private keys only needed for initial contract deployment

### 💰 **5. Paymaster Sponsorship**

- **Gasless Onboarding**: Account deployment fully sponsored - users need zero ETH
- **Flexible Sponsorship**: Optional transaction sponsorship for improved UX
- **True Web2 Experience**: Users can interact with blockchain without holding gas tokens

## 🛠️ Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│              WebAuthn + Biometric Interface                  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Backend API (NestJS)                            │
│   • WebAuthn Authentication  • KMS Integration              │
│   • Account Management       • Transfer Orchestration       │
└────────┬───────────────────────────────────┬────────────────┘
         │                                   │
┌────────▼──────────┐              ┌────────▼────────────────┐
│ BLS Signer Service│              │   KMS Service           │
│ • Gossip Network  │              │ • Key Generation        │
│ • Signature Agg   │              │ • Secure Signing        │
└────────┬──────────┘              └─────────────────────────┘
         │
┌────────▼─────────────────────────────────────────────────────┐
│               Ethereum (ERC-4337)                             │
│  EntryPoint → Factory → AAStarAccount → Validator (BLS)      │
└───────────────────────────────────────────────────────────────┘
```

### Key Technical Features

**Dynamic Gas Calculation**

```solidity
function _calculateRequiredGas(uint256 nodeCount) internal pure returns (uint256) {
  // EIP-2537 pairing: 32600 * k + 37700 (k=2)
  uint256 pairingBaseCost = 102900;
  // G1 additions: (nodeCount - 1) * 500
  uint256 g1AdditionCost = (nodeCount - 1) * 500;
  // Storage reads: nodeCount * 2100
  uint256 storageReadCost = nodeCount * 2100;
  // EVM overhead: 50000 + (nodeCount * 1000)
  uint256 evmExecutionCost = 50000 + (nodeCount * 1000);

  return calculateFinalGas(totalCost); // 25% margin + limits
}
```

**BLS Signature Format** (705 bytes)

```
[nodeIdsLength(32)][nodeIds...][blsSignature(256)][messagePoint(256)][aaSignature(65)]
```

**Dual Verification Process**

```
1. ECDSA: Verify userOpHash.toEthSignedMessageHash() against signer
2. BLS: Aggregate public keys from selected nodes
3. Pairing: Verify e(G, signature) = e(aggPubKey, messagePoint)
```

## 📊 Verification & Results

### Successful Transfer Proof

- **Transaction**: [0x8aa6fdef...714370a55](https://sepolia.etherscan.io/tx/0x8aa6fdef19f66e687a570c4fefeb7524538a32fcb06320251d25c5b714370a55)
- **Amount**: 0.002 ETH
- **Gas Used**: 653,060
- **Status**: ✅ BLS aggregate signature verified

### Gas Efficiency

| Node Count | Estimated Gas | Actual Usage | Status |
| ---------- | ------------- | ------------ | ------ |
| 1 node     | 600,000       | ~520k        | ✅     |
| 3 nodes    | 600,000       | ~653k        | ✅     |
| 100 nodes  | 640,500       | N/A          | Scaled |

## 🔒 Security Model

### Multi-Layer Security

1. **Biometric Authentication**
   - FIDO2-compliant WebAuthn with mandatory user verification
   - No password-only access for sensitive operations
   - Multi-device passkey support

2. **KMS Key Management**
   - Production wallets managed in secure KMS environment
   - Private keys never exposed to application layer
   - Automatic wallet generation on user registration

3. **Unified Ownership**
   - User wallet = creator = signer (no third-party deployer)
   - Full account control from genesis
   - Simplified trust model

4. **Smart Contract Security**
   - Dual verification (AA + BLS)
   - Time locks (validAfter/validUntil)
   - Nonce-based replay protection
   - Owner-only critical operations

## 📁 Project Structure

```
YetAnotherAA/
├── validator/              # Solidity contracts (Foundry)
│   ├── AAStarValidator.sol     # BLS signature validator
│   ├── AAStarAccountV6.sol     # ERC-4337 account implementation
│   └── AAStarAccountFactory*.sol  # Account factories (v6/v7/v8)
├── aastar/                 # Backend API (NestJS)
│   ├── auth/                   # WebAuthn authentication
│   ├── kms/                    # KMS integration
│   └── transfer/               # ERC-4337 transaction service
├── signer/                 # BLS signing service (NestJS)
│   ├── gossip/                 # P2P node discovery
│   └── signature/              # BLS signature generation
├── aastar-frontend/        # Frontend (Next.js)
│   └── app/                    # Biometric authentication UI
└── paymaster/              # Paymaster contracts & admin
```

## 🎓 What You'll Learn

This project demonstrates:

- **Modern Cryptography**: BLS12-381 pairing-based signatures and aggregation
- **Account Abstraction**: ERC-4337 implementation with multiple EntryPoint versions
- **Biometric Auth**: Production-grade WebAuthn/Passkey integration
- **Key Management**: Enterprise KMS integration for secure key storage
- **Gas Optimization**: Dynamic calculation based on EIP-2537 standards
- **System Design**: Full-stack blockchain application with multiple services

## 🚀 Deployment

### Reference Deployment (Sepolia Testnet)

For testing purposes only:

- **AAStarValidator**: `0xAe7eA28a0aeA05cbB8631bDd7B10Cb0f387FC479`
- **AAStarAccountFactory (v0.6)**: `0x559DD2D8Bf9180A70Da56FEFF57DA531BF3f2E1c`
- **EntryPoint v0.6**: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`
- **EntryPoint v0.7**: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`

> **⚠️ Production**: Deploy your own contracts. Private keys only needed for contract deployment - runtime wallets are KMS-managed.

## 🌟 Enhanced Features

- ✅ **Zero Configuration**: No private keys needed for operation
- ✅ **Gasless Onboarding**: Account creation requires zero ETH
- ✅ **Multi-Version Support**: EntryPoint v0.6, v0.7, v0.8
- ✅ **KMS Integration**: Production-ready key management
- ✅ **Unified Ownership**: User wallet controls everything
- ✅ **Real-time Gossip**: Automatic BLS node discovery
- ✅ **Full Stack**: Complete monorepo with all components

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Issues and Pull Requests are welcome!

---

**Status**: ✅ Production Ready | **Network**: Sepolia Testnet | **Security**: WebAuthn + KMS Enhanced
