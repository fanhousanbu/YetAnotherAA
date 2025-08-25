# BLS Signer Service

A NestJS-based microservice for BLS12-381 signature generation and on-chain node registration for the AAStarValidator system.

## Features

- **Individual Node Identity**: Each service instance runs as an independent node with unique BLS key pairs
- **BLS12-381 Signatures**: Generate BLS signatures compatible with AAStarValidator contract
- **On-chain Registration**: Real blockchain integration for node registration using ethers.js
- **RESTful API**: Clean REST endpoints for signature operations and node management
- **Development Ready**: Fixed development nodes for consistent debugging experience

## Architecture

Each signer service instance is a stateful node with:
- Unique node ID and BLS key pair
- Local state persistence in `node_*.json` files
- Independent blockchain registration capability
- Self-contained signing operations

## Quick Start

### Environment Setup

Set environment variables (or use project root `.env`):

```bash
# Node Configuration
NODE_STATE_FILE=./node_dev_001.json
PORT=3001

# Blockchain Configuration
VALIDATOR_CONTRACT_ADDRESS=0xAe7eA28a0aeA05cbB8631bDd7B10Cb0f387FC479
ETH_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_API_KEY
ETH_PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
```

### Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start development server
npm start

# Or use VSCode launch configurations for multi-node debugging
```

## API Endpoints

### Node Management

- `GET /node/info` - Get current node information
- `POST /node/register` - Register node on AAStarValidator contract

### Signature Operations

- `POST /signature/sign` - Generate BLS signature for message
- `POST /signature/aggregate` - Aggregate external signatures from multiple nodes

### Documentation

- `GET /api` - Swagger API documentation

## Node Startup Modes

The service supports three initialization modes:

### 1. Specific Node ID (Highest Priority)
```bash
NODE_ID=0x123e4567e89b12d3a456426614174001 npm start
```

### 2. State File Path
```bash
NODE_STATE_FILE=/path/to/node_state.json npm start
```

### 3. Auto Discovery (Default)
```bash
npm start  # Discovers existing node files automatically
```

## Development Nodes

Three fixed development nodes are provided for consistent debugging:

- **node_dev_001.json**: Port 3001, Node ID `0x123e4567e89b12d3a456426614174001`
- **node_dev_002.json**: Port 3002, Node ID `0x123e4567e89b12d3a456426614174002`  
- **node_dev_003.json**: Port 3003, Node ID `0x123e4567e89b12d3a456426614174003`

VSCode launch configurations are provided for single or multi-node debugging.

## Blockchain Integration

### On-chain Registration

The `/node/register` endpoint performs real blockchain transactions:

1. Check if node is already registered via `isRegistered()`
2. Call `registerPublicKey()` on AAStarValidator contract
3. Wait for transaction confirmation
4. Update local node state

### Requirements

- Contract owner private key (`ETH_PRIVATE_KEY`)
- Sufficient ETH balance for gas fees
- Valid RPC endpoint (`ETH_RPC_URL`)

### Response Example

```json
{
  "success": true,
  "message": "Node registered successfully on-chain",
  "nodeId": "0x123e4567e89b12d3a456426614174001",
  "txHash": "0x1234...abcd",
  "contractAddress": "0xAe7eA28a0aeA05cbB8631bDd7B10Cb0f387FC479"
}
```

## File Structure

```
src/
├── interfaces/          # TypeScript interfaces
├── modules/
│   ├── bls/            # BLS cryptography operations  
│   ├── blockchain/     # Ethereum contract interactions
│   ├── node/           # Node identity and state management
│   └── signature/      # Signature generation services
├── utils/              # BLS utilities and helpers
└── main.ts             # Application entry point

node_dev_*.json         # Development node state files (REMOVED from git - contain private keys)
node_*.json             # Dynamic node files (ignored by git)
```

## Security

- Private keys are never exposed in API responses
- Node state files contain sensitive keys and should be protected
- **IMPORTANT**: All `node_*.json` files contain private keys and are excluded from git
- Development node files have been removed from version control for security
- Production deployments should use secure key management and environment variables

## Signature Aggregation Workflow

The aggregation system follows a distributed workflow where nodes operate independently:

### 1. Individual Node Signing
Each node signs messages independently:

```bash
curl -X POST http://localhost:3001/signature/sign \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello World"}'
```

Response:
```json
{
  "nodeId": "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
  "signature": "afc696360a866979fb4b4e6757af4d1621616b5d928061be5aa2243c0b8ded9b...",
  "publicKey": "8052464ad7afdeaa9416263fb0eb72925b77957796973ecb7fcda5d4fc733c4a...",
  "message": "Hello World"
}
```

### 2. Central Collection
A central coordinator collects signatures from multiple nodes. Each node only knows about itself, not other nodes.

### 3. Signature Aggregation
Any node can aggregate the collected external signatures. BLS aggregation requires signatures and their corresponding public keys:

```bash
curl -X POST http://localhost:3001/signature/aggregate \
  -H "Content-Type: application/json" \
  -d '{
    "signatures": [
      {
        "nodeId": "0x123e4567e89b12d3a456426614174001",
        "signature": "0xafc696360a866979fb4b4e6757af4d1621616b5d928061be5aa2243c0b8ded9b...",
        "publicKey": "0x8052464ad7afdeaa9416263fb0eb72925b77957796973ecb7fcda5d4fc733c4a..."
      },
      {
        "nodeId": "0x123e4567e89b12d3a456426614174002", 
        "signature": "0xdef789abc123456789def123456789abc456789def123456789def123456789...",
        "publicKey": "0x9876543210fedcbafedcba0987654321098765432109876543210987654321..."
      }
    ]
  }'
```

Response:
```json
{
  "nodeIds": [
    "0x123e4567e89b12d3a456426614174001",
    "0x123e4567e89b12d3a456426614174002"
  ],
  "aggregateSignature": "0x000000000000000000000000000000000b74054fd1bd02d6f1d83d35c472490c...",
  "aggregatePublicKey": "0x000000000000000000000000000000000052464ad7afdeaa9416263fb0eb72925b..."
}
```

### Key Properties

- **Efficient BLS Aggregation**: Aggregates signatures and public keys using BLS12-381 mathematics
- **Stateless Operation**: Nodes don't need access to other nodes' private keys or registration data  
- **Flexible Coordination**: Any node can perform aggregation with provided external signatures
- **Complete Output**: Returns both aggregated signature and aggregated public key
- **EIP-2537 Format**: All outputs are formatted for direct use with AAStarValidator contract

## Demo Tool

A complete ERC-4337 + BLS transfer tool is available in the `demo/` directory:

- **`demo/main.js`** - Complete transfer tool with integrated BLS signing
- **`demo/config.example.json`** - Configuration template for setup
- **`demo/README.md`** - Setup and usage instructions

The demo tool provides a complete end-to-end example of using the BLS signer service for ERC-4337 account abstraction transfers.

## Contract Compatibility

Compatible with AAStarValidator contract functions:
- `registerPublicKey(bytes32 nodeId, bytes calldata publicKey)`
- `isRegistered(bytes32 nodeId) returns (bool)`
- `verifyAggregateSignature(...)` - via signature generation endpoints