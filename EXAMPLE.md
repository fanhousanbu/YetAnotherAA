# AA Aggregate Signature Validator - Usage Example

## 1. Generate Aggregate Signature

```bash
cd signer
npm run start -- --message "Hello Ethereum!" --m 5 --n 3
```

**Output:**
```
开始BLS签名聚合过程...
消息: Hello Ethereum!
生成私钥数量: 5
聚合签名数量: 3

=== 生成私钥和公钥 ===
私钥 0: 0x...
公钥 0: 0x...
...

=== 聚合签名验证: true ===

=== 合约调用参数 ===
aggregatedPubKey: "0x..."
negatedPubKey: "0x..."
aggregatedSignature: "0x..."
messageG2: "0x..."

=== 768字节配对数据 ===
pairingCalldata: "0x..."
```

## 2. Deploy Contract

```bash
cd validator
forge create src/AggregateSignatureValidator.sol:AggregateSignatureValidator \
  --rpc-url https://sepolia.infura.io/v3/YOUR_KEY \
  --private-key YOUR_PRIVATE_KEY
```

**Output:**
```
Deployed to: 0x...
Transaction hash: 0x...
```

## 3. Verify Signature On-Chain

### Method 1: Direct Validation
```bash
cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS \
  "validateSignature(bytes)" \
  "0x[768-byte-pairing-data]"
```

### Method 2: Component Validation
```bash
cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS \
  "validateComponents(bytes,bytes,bytes)" \
  "0x[aggregated-key]" \
  "0x[signature]" \
  "0x[message-point]"
```

### Method 3: UserOp Validation (ERC4337)
```bash
cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS \
  "validateUserOp(bytes32,bytes)" \
  "0x[user-op-hash]" \
  "0x[signature-data]"
```

**Successful Output:**
```
0x0000000000000000000000000000000000000000000000000000000000000001
```

## 4. Integration Example

### JavaScript/Node.js
```javascript
import { ethers } from 'ethers';

// Contract ABI (simplified)
const abi = [
  "function validateSignature(bytes calldata pairingData) external view returns (bool)",
  "function validateComponents(bytes,bytes,bytes) external view returns (bool)",
  "function validateUserOp(bytes32,bytes) external view returns (bool)"
];

// Connect to contract
const contract = new ethers.Contract(contractAddress, abi, provider);

// Validate signature
const result = await contract.validateSignature(pairingData);
console.log('Validation result:', result); // true

// ERC4337 UserOp validation
const userOpResult = await contract.validateUserOp(userOpHash, signatureData);
console.log('UserOp validation:', userOpResult); // true
```

### Solidity Integration
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AggregateSignatureValidator.sol";

contract AAWallet {
    AggregateSignatureValidator public immutable validator;
    
    constructor(address _validator) {
        validator = AggregateSignatureValidator(_validator);
    }
    
    function executeUserOp(
        bytes32 userOpHash,
        bytes calldata signatureData,
        // ... other parameters
    ) external {
        require(
            validator.validateUserOp(userOpHash, signatureData),
            "Invalid aggregate signature"
        );
        
        // Execute validated UserOperation
        // ...
    }
    
    function processTransaction(
        bytes calldata pairingData,
        // ... other parameters
    ) external {
        require(
            validator.validateSignature(pairingData),
            "Invalid signature"
        );
        
        // Process verified transaction
        // ...
    }
}
```

## Real-world AA Usage Scenarios

### ERC4337 Multi-signature Wallet
```bash
# Generate 10 guardian keys for AA wallet, require 7 signatures
npm run start -- --message "UserOp: Transfer 100 ETH to 0x..." --m 10 --n 7
```

### AA Validator Consensus
```bash
# Aggregate AA validator signatures for operation approval
npm run start -- --message "AA Operation #12345 Hash: 0x..." --m 100 --n 67
```

### Batch UserOp Processing
```bash
# Aggregate multiple AA wallet signatures for batch processing
npm run start -- --message "Batch UserOps #456 Root: 0x..." --m 50 --n 35
```

## Gas Costs

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| `validateSignature(bytes)` | ~180,000 | Direct pairing validation |
| `validateComponents(bytes,bytes,bytes)` | ~190,000 | Component processing + validation |
| `validateUserOp(bytes32,bytes)` | ~185,000 | ERC4337 UserOp validation |
| Contract deployment | ~1,200,000 | One-time deployment cost |

## Security Best Practices

1. **Always verify signatures off-chain first** before sending transactions
2. **Use proper message formatting** - include context, nonces, or timestamps
3. **Validate input lengths** in your application layer
4. **Consider gas limits** when processing large aggregations
5. **Test thoroughly** on testnets before mainnet deployment