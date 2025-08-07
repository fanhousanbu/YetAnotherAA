# AA Aggregate Signature Validator

A complete aggregate signature validation system for ERC4337 Account Abstraction, using EIP-2537 precompiles for efficient on-chain verification.

## Overview

This project implements:
- **Off-chain signature aggregation** using Node.js and @noble/curves
- **On-chain signature validation** using Solidity and EIP-2537 precompiles  
- **ERC4337 compatible integration** for Account Abstraction wallets
- **Gas-efficient multi-signature operations** for production use

## Project Structure

```
├── signer/                 # Node.js signature aggregation tool
│   ├── index.js           # Main aggregation script  
│   └── package.json       # Dependencies and scripts
├── validator/             # Solidity validation contracts
│   ├── src/
│   │   └── AggregateSignatureValidator.sol  # AA signature validator
│   ├── foundry.toml       # Foundry configuration
│   └── README.md          # Contract documentation
├── EXAMPLE.md             # Usage examples and integration guide
└── README.md              # This file
```

## Features

✅ **AA Multi-signature Support**: Generate m private keys, select n for aggregation  
✅ **ERC4337 Integration**: Native support for UserOperation validation  
✅ **EIP-2537 Compatibility**: Optimized encoding for Ethereum precompiles  
✅ **Multiple Validation Methods**: Direct pairing, components, and UserOp validation  
✅ **Gas Optimized**: Efficient precompile usage for production deployment  
✅ **Production Ready**: Clean, tested, documented code  

## Quick Start

### 1. Generate Aggregate Signatures

```bash
cd signer
npm install
npm run aggregate -- --message "UserOp Hash" --m 5 --n 3
```

### 2. Deploy Contract

```bash
cd validator
forge build
forge create src/AggregateSignatureValidator.sol:AggregateSignatureValidator --rpc-url <RPC_URL> --private-key <PRIVATE_KEY>
```

### 3. Validate Signatures

Use the generated data to call:
- `validateSignature(bytes pairingData)` - Direct 768-byte validation
- `validateComponents(bytes, bytes, bytes)` - Component-based validation  
- `validateUserOp(bytes32, bytes)` - ERC4337 UserOp validation

## Technical Details

### Cryptographic Implementation
- Uses **@noble/curves** library for secure cryptographic operations
- Implements **EIP-2537** encoding format: `[16 zeros][48-byte coordinate]`
- Supports efficient aggregate signature operations for AA wallets

### Smart Contract Validation
- **Gas optimized**: Uses EIP-2537 precompiles for efficient validation
- **Multiple interfaces**: Direct, component, and UserOp validation methods
- **AA focused**: Designed specifically for ERC4337 integration
- **Security focused**: Proper input validation and error handling

### Output Format

The aggregator generates AA-compatible validation data:
```json
{
  "pairingData": "0x...",           // 768-byte direct validation data
  "components": {
    "aggregatedKey": "0x...",       // 128-byte processed key
    "signature": "0x...",           // 256-byte aggregate signature
    "messagePoint": "0x..."         // 256-byte message point
  },
  "userOpSignature": {
    "direct": "0x...",              // Direct UserOp signature format
    "components": "0x..."           // Component-based UserOp format
  },
  "contractMethods": {
    "validateSignature": "validateSignature(bytes)",
    "validateComponents": "validateComponents(bytes,bytes,bytes)",
    "validateUserOp": "validateUserOp(bytes32,bytes)"
  }
}
```

## Usage Examples

### Generate AA wallet signatures
```bash
npm run aggregate -- --message "UserOp Transaction #123" --m 10 --n 3
```

### Validate on-chain
```solidity
// Direct validation
bool success = validator.validateSignature(pairingData);

// Component validation  
bool success = validator.validateComponents(
    aggregatedKey, 
    signature, 
    messagePoint
);

// ERC4337 UserOp validation
bool success = validator.validateUserOp(userOpHash, signatureData);
```

## Security Considerations

- Private keys are generated using secure randomness
- All signatures are individually verified before aggregation
- Contract uses proper input validation and gas limits
- EIP-2537 precompiles provide cryptographic security guarantees
- Designed for AA wallet security with proper UserOp validation
- Gas limits prevent DoS attacks during validation

## Dependencies

### Node.js Signer
- `@noble/curves`: Secure cryptographic operations
- `@noble/hashes`: Cryptographic hash functions

### Solidity Validator
- Solidity ^0.8.19
- EIP-2537 precompiles (available on Ethereum mainnet and testnets)
- ERC4337 compatibility

## License

MIT License