# BLS Aggregate Signature + ERC-4337 Account Abstraction System

A complete implementation integrating BLS aggregate signatures with ERC-4337 account abstraction, featuring dynamic gas calculation and multi-node signature verification.

## 🎯 System Features

- **BLS12-381 Aggregate Signatures**: Multi-node signature aggregation to reduce on-chain verification costs
- **ERC-4337 Account Abstraction**: Full compatibility with Ethereum Account Abstraction standard
- **Dynamic Gas Calculation**: Precise gas estimation based on EIP-2537 standards
- **Dual Verification Mechanism**: AA signatures verify userOpHash, BLS signatures verify messagePoint
- **Production Ready**: Complete verification on Sepolia testnet

## 📁 Project Structure

```
YetAnotherAA/
├── validator/                    # Validator contracts
│   ├── src/
│   │   ├── AAStarValidator.sol   # Dynamic gas BLS validator
│   │   ├── AAStarAccountV6.sol   # ERC-4337 account implementation
│   │   └── AAStarAccountFactoryV6.sol # Account factory
│   ├── script/
│   │   ├── DeployDynamicGasValidator.s.sol  # Deployment script
│   │   └── RegisterKeysDynamicGas.s.sol     # Registration script
│   └── archive/                  # Archived legacy files
├── signer/
│   ├── demo/                     # Core tools
│   │   ├── main.js               # ERC-4337 + BLS transfer tool
│   │   ├── config.example.json   # Configuration template
│   │   └── README.md             # Demo usage guide
│   ├── src/                      # BLS signing service
│   └── README.md                 # Signer service documentation
└── README.md                     # Project documentation
```

## 🚀 Deployed Contracts (Sepolia Testnet)

### Dynamic Gas Version (Recommended)
- **AAStarValidator**: `0xAe7eA28a0aeA05cbB8631bDd7B10Cb0f387FC479`
- **AAStarAccountFactory**: `0x559DD2D8Bf9180A70Da56FEFF57DA531BF3f2E1c`
- **AAStarAccountV6 Implementation**: `0x15c0f6d0d6152121099ab05993f5975299410f6a`
- **EntryPoint**: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` (Official)

### Fixed Gas Version (Legacy)
- **AAStarValidator**: `0x0Fe448a612efD9B38287e25a208448315c2E2Df3`

## 🛠️ Core Technical Implementation

### 1. Dynamic Gas Calculation
Precise gas estimation algorithm based on EIP-2537 standards:

```solidity
function _calculateRequiredGas(uint256 nodeCount) internal pure returns (uint256) {
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
- **Transaction Hash**: [0x8aa6fdef19f66e687a570c4fefeb7524538a32fcb06320251d25c5b714370a55](https://sepolia.etherscan.io/tx/0x8aa6fdef19f66e687a570c4fefeb7524538a32fcb06320251d25c5b714370a55)
- **Transfer Amount**: 0.002 ETH ✅
- **Gas Used**: 653,060
- **Verification Status**: BLS aggregate signature verification successful

### Gas Efficiency Comparison
| Node Count | Dynamic Gas Estimate | Actual Usage | Efficiency |
|------------|---------------------|--------------|------------|
| 1 node     | 600,000             | ~520k        | Baseline protection |
| 3 nodes    | 600,000             | ~653k        | Moderate |
| 100 nodes  | 640,500             | Estimated    | Auto-scaling |

## 📖 Usage Guide

### 1. Deploy Contracts
```bash
cd validator
forge script script/DeployDynamicGasValidator.s.sol --rpc-url $RPC_URL --broadcast
```

### 2. Register BLS Nodes
```bash
forge script script/RegisterKeysDynamicGas.s.sol --rpc-url $RPC_URL --broadcast
```

### 3. Execute Transfer
```bash
cd signer/demo
cp config.example.json config.json
# Edit config.json with your private keys
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

1. **Dual Verification**: AA + BLS dual signature mechanism
2. **Time Locks**: Support for validAfter/validUntil
3. **Replay Protection**: Nonce mechanism prevents replay
4. **Access Control**: Owner-only critical operations
5. **Gas Limits**: Prevent DoS attacks

## 🔒 Security Considerations

- **Private Key Management**: All configuration files with private keys are excluded from git
- **Template Configuration**: Use `config.example.json` to set up your private keys
- **Development Keys**: Test keys only - never use in production
- **Environment Variables**: Production deployments should use secure key management

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

2. **Set up demo configuration**
   ```bash
   cd signer/demo
   cp config.example.json config.json
   # Edit config.json with your keys
   ```

3. **Run the transfer tool**
   ```bash
   node main.js
   ```

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Issues and Pull Requests are welcome to improve this project!

---

**Project Status**: ✅ Production Ready | **Last Updated**: August 2025 | **Network**: Sepolia Testnet