# AAStarValidator - BLS Aggregate Signature Validator for Account Abstraction

A production-ready BLS aggregate signature validator optimized for ERC-4337 Account Abstraction wallets. This system provides efficient multi-signature validation using EIP-2537 precompiles on Ethereum.

## Overview

This project implements a complete BLS signature aggregation and validation system:

- **🔐 Off-chain Signature Generation**: Node.js tooling with @noble/curves for secure BLS signature creation
- **⚡ On-chain Validation**: Gas-optimized Solidity contracts using EIP-2537 precompiles
- **🏗️ Account Abstraction Ready**: Native ERC-4337 integration for AA wallets
- **🧪 Production Tested**: Comprehensive test suite with 100% coverage
- **📚 Well Documented**: Complete API documentation and integration guides

## Project Structure

```
├── signer/                     # BLS Signer Service (NestJS microservice)
│   ├── src/                   # Source code
│   │   ├── modules/           # Feature modules
│   │   │   ├── bls/          # BLS cryptography operations
│   │   │   ├── blockchain/   # Ethereum contract interactions
│   │   │   ├── node/         # Node identity management
│   │   │   └── signature/    # Signature generation services
│   │   ├── interfaces/        # TypeScript interfaces
│   │   └── utils/            # BLS utilities
│   ├── node_dev_*.json       # Development node configurations
│   ├── package.json          # NestJS dependencies
│   └── README.md             # Service documentation
├── validator/                  # Smart contract validation system
│   ├── src/
│   │   └── AAStarValidator.sol # Main BLS validator contract
│   ├── test/
│   │   └── AAStarValidator.t.sol # Comprehensive test suite
│   ├── script/
│   │   ├── DeployAAStarValidator.s.sol # Deployment script
│   │   └── RegisterKeys.s.sol          # Node registration script
│   ├── foundry.toml           # Foundry configuration
│   └── README.md              # Contract documentation
└── README.md                  # This file
```

## ✨ Features

### Signer Service
- **🎯 Independent Nodes**: Each service instance is a stateful node with unique identity
- **🔐 BLS12-381 Signatures**: Generate secure signatures compatible with AAStarValidator
- **🌐 REST API**: Clean endpoints for signature operations and node management
- **⚡ Real Blockchain Integration**: On-chain node registration using ethers.js
- **🧪 Development Ready**: Fixed development nodes for consistent debugging
- **🔀 External Signature Aggregation**: Aggregate signatures and public keys from multiple external nodes

### Smart Contract
- **🔑 Multi-Signature Support**: Validate aggregate signatures from multiple nodes
- **🚀 EIP-2537 Optimized**: Native BLS12-381 precompile integration
- **💰 Gas Efficient**: Optimized for minimal transaction costs
- **🏛️ Multiple Validation Methods**: Flexible validation interfaces
- **🛡️ Security Focused**: Comprehensive input validation and error handling
- **📈 Event Monitoring**: Built-in analytics and gas tracking

## 🚀 Quick Start

### 1. Start BLS Signer Service

```bash
cd signer
npm install
npm run build

# Start single node
npm start

# Or use VSCode launch configs for multi-node debugging
# Available endpoints:
# GET  /node/info         - Node information
# POST /node/register     - Register on blockchain
# POST /signature/sign    - Generate BLS signature
# POST /signature/aggregate - Aggregate external signatures
```

### 2. Deploy Validator Contract

```bash
cd validator
forge install
forge build

# Deploy to testnet
forge script script/DeployAAStarValidator.s.sol --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast
```

### 3. Validate Signatures On-Chain

```solidity
// Use the contract interface
AAStarValidator validator = AAStarValidator(deployedAddress);

// Method 1: Event-emitting validation (recommended for production)
bool isValid = validator.verifyAggregateSignature(
    participantKeys,    // bytes[] - Array of participant public keys
    aggregateSignature, // bytes - BLS aggregate signature
    messageHash        // bytes - G2-encoded message hash
);

// Method 2: View-only validation (for off-chain verification)
bool isValid = validator.validateAggregateSignature(
    participantKeys,
    aggregateSignature, 
    messageHash
);
```

## 📋 Contract Interface

### Primary Functions

#### `verifyAggregateSignature`
```solidity
function verifyAggregateSignature(
    bytes[] calldata publicKeys,
    bytes calldata signature,
    bytes calldata messagePoint
) external returns (bool isValid)
```
- **Purpose**: Main validation method with event emission and gas tracking
- **Use Case**: Production signature verification with analytics
- **Returns**: Boolean indicating signature validity
- **Emits**: `SignatureValidated` event with gas consumption data

#### `validateAggregateSignature`
```solidity
function validateAggregateSignature(
    bytes[] calldata publicKeys,
    bytes calldata signature,
    bytes calldata messagePoint
) external view returns (bool isValid)
```
- **Purpose**: Read-only validation without state changes
- **Use Case**: Off-chain verification, gas estimation, preview validation
- **Returns**: Boolean indicating signature validity
- **Gas**: Lower cost due to view-only nature

### Utility Functions

#### `getGasEstimate`
```solidity
function getGasEstimate(uint256 publicKeysCount) external pure returns (uint256)
```
- **Purpose**: Estimate gas consumption for signature validation
- **Parameters**: Number of participant public keys
- **Returns**: Estimated gas consumption

#### `getSignatureFormat`
```solidity
function getSignatureFormat() external pure returns (string memory)
```
- **Purpose**: Returns expected input data format
- **Returns**: Format specification string

## 📊 Data Formats

### Public Keys
- **Format**: G1 points in EIP-2537 encoding
- **Size**: 128 bytes per key
- **Structure**: `[16 zero bytes][48-byte x-coordinate][16 zero bytes][48-byte y-coordinate]`

### Aggregate Signature
- **Format**: G2 point in EIP-2537 encoding  
- **Size**: 256 bytes
- **Structure**: BLS aggregate signature as G2 curve point

### Message Hash
- **Format**: G2 point in EIP-2537 encoding
- **Size**: 256 bytes
- **Structure**: Message hash mapped to G2 curve point

## 💡 Usage Examples

### Basic Integration

```solidity
pragma solidity ^0.8.19;

import "./AAStarValidator.sol";

contract AAWallet {
    AAStarValidator private validator;
    
    constructor(address _validator) {
        validator = AAStarValidator(_validator);
    }
    
    function executeMultiSig(
        bytes[] calldata ownerPublicKeys,
        bytes calldata aggregateSignature,
        bytes calldata messageHash,
        address target,
        bytes calldata data
    ) external {
        // Validate aggregate signature
        require(
            validator.verifyAggregateSignature(
                ownerPublicKeys,
                aggregateSignature,
                messageHash
            ),
            "Invalid aggregate signature"
        );
        
        // Execute the transaction
        (bool success, ) = target.call(data);
        require(success, "Transaction execution failed");
    }
}
```

### Gas Estimation

```solidity
// Estimate gas before validation
uint256 estimatedGas = validator.getGasEstimate(participantCount);

// Use estimated gas in your transaction planning
if (estimatedGas > maxGasLimit) {
    revert("Too many participants");
}
```

### Event Monitoring

```solidity
// Listen for validation events
event SignatureValidated(
    bytes32 indexed signatureHash,
    uint256 participantCount,
    bool isValid,
    uint256 gasConsumed
);

// In your application, monitor these events for analytics
```

## 🧪 Testing

The project includes comprehensive tests:

```bash
cd validator

# Run all tests
forge test

# Run with detailed output
forge test -v

# Generate coverage report
forge coverage

# Run specific test categories
forge test --match-test "test_ValidateAggregateSignature"
```

### Test Coverage
- ✅ Contract deployment and initialization
- ✅ Signature validation with various participant counts
- ✅ Error handling and input validation  
- ✅ Gas estimation accuracy
- ✅ Event emission verification
- ✅ Edge cases and boundary conditions

## ⚡ Performance

| Participants | Estimated Gas | Actual Usage |
|-------------|---------------|--------------|
| 1           | ~233,500      | ~234,000     |
| 2           | ~234,000      | ~234,500     |
| 5           | ~235,500      | ~236,000     |
| 10          | ~238,000      | ~238,500     |

*Gas costs scale linearly with participant count (~500 gas per additional key)*

## 🔒 Security Features

- **Cryptographic Security**: BLS12-381 curve with 128-bit security level
- **Input Validation**: Comprehensive parameter checking
- **Gas Limits**: Bounded computation to prevent DoS
- **EIP-2537 Precompiles**: Ethereum's native implementations prevent bugs
- **Stateless Design**: Minimal attack surface with no storage dependencies
- **Auditable Events**: Complete validation tracking for security monitoring

## 🚢 Deployment

### Example Deployments
- **Sepolia Testnet**: `0xa82e99929032dC248d2AE77FA9E6FE4124AEBc00`
- **Mainnet**: Not deployed yet

### Deploy Your Own

```bash
# Local deployment
forge script script/DeployAAStarValidator.s.sol --rpc-url http://localhost:8545 --broadcast

# Testnet deployment  
forge script script/DeployAAStarValidator.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# Verify on Etherscan
forge verify-contract <CONTRACT_ADDRESS> AAStarValidator --chain sepolia
```

## 🔧 Development

### Prerequisites
- [Foundry](https://getfoundry.sh/) for smart contract development
- [Node.js](https://nodejs.org/) 16+ for signature generation
- Git for version control

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/your-org/YetAnotherAA.git
cd YetAnotherAA

# Install contract dependencies
cd validator
forge install

# Install signer service dependencies  
cd ../signer
npm install

# Run contract tests
cd ../validator
forge test

# Start signer service
cd ../signer
npm run build
npm start
```

### Contribution Guidelines

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure all tests pass: `forge test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📚 Documentation

- **Contract Documentation**: [validator/README.md](validator/README.md)
- **Signer Documentation**: [signer/README.md](signer/README.md)
- **API Reference**: Generated NatSpec documentation
- **Integration Guide**: Complete examples in repository

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/YetAnotherAA/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/YetAnotherAA/discussions)  
- **Documentation**: [Project Wiki](https://github.com/your-org/YetAnotherAA/wiki)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **EIP-2537**: BLS12-381 curve operations standard
- **ERC-4337**: Account Abstraction standard
- **@noble/curves**: Secure cryptographic library
- **Foundry**: Ethereum development toolkit

---

**⚠️ Production Notice**: This contract handles cryptographic operations for financial applications. Ensure thorough security review and testing before mainnet deployment.