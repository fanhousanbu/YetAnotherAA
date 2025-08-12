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
VALIDATOR_CONTRACT_ADDRESS=0x0bC9DD7BCa3115198a59D367423E1535104A5882
ETH_RPC_URL=https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20
ETH_PRIVATE_KEY=0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a
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
- `POST /signature/aggregate` - Generate aggregate signature format

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
  "contractAddress": "0x0bC9DD7BCa3115198a59D367423E1535104A5882"
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

node_dev_*.json         # Development node state files (tracked)
node_*.json             # Dynamic node files (ignored)
```

## Security

- Private keys are never exposed in API responses
- Node state files contain sensitive keys and should be protected
- Development node files use test keys only
- Production deployments should use secure key management

## Contract Compatibility

Compatible with AAStarValidator contract functions:
- `registerPublicKey(bytes32 nodeId, bytes calldata publicKey)`
- `isRegistered(bytes32 nodeId) returns (bool)`
- `verifyAggregateSignature(...)` - via signature generation endpoints