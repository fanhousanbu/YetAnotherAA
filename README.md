# BLS12-381 Aggregate Signature System

A complete BLS12-381 aggregate signature system for Ethereum, using EIP-2537 precompiles for on-chain verification.

## Overview

This project implements:
- **Off-chain BLS signature aggregation** using Node.js and @noble/curves
- **On-chain signature verification** using Solidity and EIP-2537 precompiles
- **EIP-2537 compatible data formatting** for seamless integration

## Project Structure

```
├── bls-aggregator/          # Node.js signature aggregation tool
│   ├── index.js            # Main aggregation script
│   └── package.json        # Dependencies and scripts
├── contracts/              # Solidity smart contracts
│   ├── src/
│   │   └── BLSAggregateVerifier.sol  # Main verification contract
│   └── foundry.toml        # Foundry configuration
└── README.md               # This file
```

## Features

✅ **Multi-signature Aggregation**: Generate m private keys, select n for aggregation  
✅ **EIP-2537 Compatibility**: Proper encoding for Ethereum precompiles  
✅ **Dual Verification Methods**: 768-byte pairing data or separated parameters  
✅ **Production Ready**: Clean, tested, documented code  

## Quick Start

### 1. Generate Aggregate Signatures

```bash
cd bls-aggregator
npm install
npm run aggregate -- --message "Hello World" --m 5 --n 3
```

### 2. Deploy Contract

```bash
cd contracts
forge build
forge create src/BLSAggregateVerifier.sol:BLSAggregateVerifier --rpc-url <RPC_URL> --private-key <PRIVATE_KEY>
```

### 3. Verify Signatures

Use the generated data to call either:
- `verify(bytes pairingCalldata)` - Direct 768-byte verification
- `verifyWithNegatedPubKey(bytes, bytes, bytes)` - Separated parameters

## Technical Details

### BLS12-381 Implementation
- Uses **@noble/curves** library for cryptographic operations
- Implements **EIP-2537** encoding format: `[16 zeros][48-byte coordinate]`
- Supports both **G1** (public keys) and **G2** (signatures) points

### Smart Contract Verification
- **Gas optimized**: Uses EIP-2537 precompiles for efficient pairing checks
- **Dual interfaces**: Supports both direct and parameterized verification
- **Security focused**: Proper input validation and error handling

### Output Format

The aggregator generates:
```json
{
  "aggregatedPubKey": "0x...",      // 128-byte G1 point
  "negatedPubKey": "0x...",         // 128-byte negated G1 point
  "aggregatedSignature": "0x...",   // 256-byte G2 point
  "messageG2": "0x...",             // 256-byte message mapped to G2
  "pairingCalldata": "0x..."        // 768-byte pairing verification data
}
```

## Usage Examples

### Generate 10 keys, aggregate 3 signatures
```bash
npm run aggregate -- --message "Transaction #123" --m 10 --n 3
```

### Verify on-chain
```solidity
// Direct verification
bool success = verifier.verify(pairingCalldata);

// Parameter verification  
bool success = verifier.verifyWithNegatedPubKey(
    negatedPubKey, 
    aggregatedSignature, 
    messageG2
);
```

## Security Considerations

- Private keys are generated using secure randomness
- All signatures are individually verified before aggregation
- Contract uses proper input validation and gas limits
- EIP-2537 precompiles provide cryptographic security guarantees

## Dependencies

### Node.js
- `@noble/curves`: BLS12-381 cryptographic operations
- `@noble/hashes`: Cryptographic hash functions

### Solidity
- Solidity ^0.8.19
- EIP-2537 precompiles (available on Ethereum mainnet and testnets)

## License

MIT License