# Usage Example

## 1. Generate Aggregate Signature

```bash
cd bls-aggregator
npm run aggregate -- --message "Hello Ethereum!" --m 5 --n 3
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
cd contracts
forge create src/BLSAggregateVerifier.sol:BLSAggregateVerifier \
  --rpc-url https://sepolia.infura.io/v3/YOUR_KEY \
  --private-key YOUR_PRIVATE_KEY
```

**Output:**
```
Deployed to: 0x...
Transaction hash: 0x...
```

## 3. Verify Signature On-Chain

### Method 1: Direct Verification
```bash
cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS \
  "verify(bytes)" \
  "0x[768-byte-pairing-calldata]"
```

### Method 2: Parameter Verification
```bash
cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS \
  "verifyWithNegatedPubKey(bytes,bytes,bytes)" \
  "0x[negated-pubkey]" \
  "0x[aggregated-signature]" \
  "0x[message-g2]"
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
  "function verify(bytes calldata pairingCalldata) external view returns (bool)",
  "function verifyWithNegatedPubKey(bytes,bytes,bytes) external view returns (bool)"
];

// Connect to contract
const contract = new ethers.Contract(contractAddress, abi, provider);

// Verify signature
const result = await contract.verify(pairingCalldata);
console.log('Verification result:', result); // true
```

### Solidity Integration
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./BLSAggregateVerifier.sol";

contract MyApp {
    BLSAggregateVerifier public immutable verifier;
    
    constructor(address _verifier) {
        verifier = BLSAggregateVerifier(_verifier);
    }
    
    function processTransaction(
        bytes calldata pairingData,
        // ... other parameters
    ) external {
        require(
            verifier.verify(pairingData),
            "Invalid BLS signature"
        );
        
        // Process verified transaction
        // ...
    }
}
```

## Real-world Usage Scenarios

### Multi-signature Wallet
```bash
# Generate 10 guardian keys, require 7 signatures
npm run aggregate -- --message "Transfer 100 ETH to 0x..." --m 10 --n 7
```

### Validator Consensus
```bash
# Aggregate validator signatures for block finalization
npm run aggregate -- --message "Block #12345 Hash: 0x..." --m 100 --n 67
```

### Rollup Batch Processing
```bash
# Aggregate user signatures for batch processing
npm run aggregate -- --message "Batch #456 Merkle Root: 0x..." --m 1000 --n 800
```

## Gas Costs

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| `verify(bytes)` | ~180,000 | Direct pairing check |
| `verifyWithNegatedPubKey` | ~190,000 | Parameter processing + pairing |
| Contract deployment | ~1,200,000 | One-time cost |

## Security Best Practices

1. **Always verify signatures off-chain first** before sending transactions
2. **Use proper message formatting** - include context, nonces, or timestamps
3. **Validate input lengths** in your application layer
4. **Consider gas limits** when processing large aggregations
5. **Test thoroughly** on testnets before mainnet deployment