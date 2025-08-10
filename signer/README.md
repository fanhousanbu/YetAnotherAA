# AAStarValidator Off-chain Signature Tool

Focused on off-chain BLS aggregate signature generation and ECDSA AA signature generation for on-chain contract call parameters.

## Features

- Generate BLS aggregate signatures using registered nodes
- Generate ECDSA signatures for AA account verification
- Output AAStarValidator contract call parameters with dual signatures
- Support custom messages and node combinations
- Built-in EOA account management

## File Description

- `index.js` - Core signature tool, supports CLI and module import
- `config.json` - Node key configuration (5 generated key pairs) + EOA account
- `generate-eoa.js` - Generate new random EOA account
- `README.md` - This documentation file

## Usage

### CLI Usage
```bash
# Generate new EOA account (updates config.json)
npm run generate-eoa

# Sign with default nodes (1,2,3)
node index.js "Hello World"

# Specify node combination
node index.js "Test Message" 1,2,4,5

# Using npm scripts
npm run test  # Test with default message
npm start -- "Custom Message" 1,2  # Custom message and nodes
```

### Module Import
```javascript
import { generateContractCallParams } from './index.js';

const params = await generateContractCallParams("Hello World", [1, 2, 3]);
console.log(params.signature);    // BLS aggregate signature
console.log(params.messagePoint); // Message point
console.log(params.nodeIds);      // Node ID array
console.log(params.aaAddress);    // AA account address
console.log(params.aaSignature);  // ECDSA signature
```

## Output Format

```javascript
{
  nodeIds: ["0x..."],           // Node ID array for contract calls
  signature: "0x...",           // BLS aggregate signature (256 bytes)
  messagePoint: "0x...",        // Message G2 point (256 bytes)
  aaAddress: "0x...",           // AA account owner address
  aaSignature: "0x...",         // ECDSA signature (65 bytes)
  contractAddress: "0x...",     // Contract address
  participantNodes: [...]       // Participant node information
}
```

## Contract Call Example

The generated parameters can be directly used to call the AAStarValidator contract:

```solidity
bool isValid = validator.verifyAggregateSignature(
    nodeIds,      // Node ID array
    signature,    // BLS aggregate signature
    messagePoint, // Message point
    aaAddress,    // AA account owner address
    aaSignature   // ECDSA signature
);
```

## EOA Account Management

The tool includes built-in EOA account management for AA signature verification:

```bash
# Generate a new random EOA account
npm run generate-eoa
```

This will update `config.json` with a new randomly generated EOA account that will be used for all future signature generation.