# AAStarValidator Off-chain Signature Tool

Focused on off-chain BLS aggregate signature generation and output of on-chain contract call parameters.

## Features

- Generate BLS aggregate signatures using registered nodes
- Output AAStarValidator contract call parameters
- Support custom messages and node combinations

## File Description

- `index.js` - Core signature tool, supports CLI and module import
- `config.json` - Node key configuration (5 generated key pairs)
- `README.md` - This documentation file

## Usage

### CLI Usage
```bash
# Sign with default nodes (1,2,3)
node index.js "Hello World"

# Specify node combination
node index.js "Test Message" 1,2,4,5
```

### Module Import
```javascript
import { generateContractCallParams } from './index.js';

const params = await generateContractCallParams("Hello World", [1, 2, 3]);
console.log(params.signature);    // Aggregate signature
console.log(params.messagePoint); // Message point
console.log(params.nodeIds);      // Node ID array
```

## Output Format

```javascript
{
  nodeIds: ["0x..."],           // Node ID array for contract calls
  signature: "0x...",           // Aggregate signature (256 bytes)
  messagePoint: "0x...",        // Message G2 point (256 bytes)
  contractAddress: "0x...",     // Contract address
  participantNodes: [...]       // Participant node information
}
```

## Contract Call Example

The generated parameters can be directly used to call the AAStarValidator contract:

```solidity
bool isValid = validator.verifyAggregateSignature(
    nodeIds,      // Node ID array
    signature,    // Aggregate signature
    messagePoint  // Message point
);
```