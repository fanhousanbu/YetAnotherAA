# ERC-4337 + BLS Transfer Tool

Complete ERC-4337 account abstraction transfer tool with integrated BLS
aggregate signature functionality.

## Setup

1. **Copy configuration template:**

   ```bash
   cp config.example.json config.json
   ```

2. **Configure your private keys:** Edit `config.json` and replace the following
   placeholders with your actual values:
   - `YOUR_BLS_NODE_1_PRIVATE_KEY` → `YOUR_BLS_NODE_5_PRIVATE_KEY`: BLS private
     keys for signing nodes
   - `YOUR_OWNER_PRIVATE_KEY`: Contract owner private key for deployment and
     funding
   - `YOUR_OWNER_ADDRESS`: Contract owner address
   - `YOUR_EOA_PRIVATE_KEY`: Ethereum private key for AA signature
   - `YOUR_EOA_ADDRESS`: Ethereum address corresponding to the private key
   - `YOUR_INFURA_API_KEY`: Infura API key for RPC access
   - `YOUR_PIMLICO_API_KEY`: Pimlico API key for bundler services

3. **Install dependencies:**
   ```bash
   npm install
   ```

## Usage

Run the transfer tool:

```bash
node main.js
```

## Security Note

⚠️ **NEVER commit `config.json` to version control** - it contains private keys!

The `config.json` file is automatically ignored by git. Only the template file
`config.example.json` should be committed.

## Configuration Structure

The configuration includes:

- **Owner Account**: Contract owner private key and address for deployment and
  funding operations
- **AA Account**: EOA private key and address for ERC-4337 account abstraction
  signatures
- **BLS Node Private Keys**: Used for generating BLS signatures (5 nodes)
- **RPC Configuration**: Ethereum and bundler service endpoints with API keys
- **Contract Addresses**: Deployed validator, factory, and implementation
  contracts
- **Node Registration Info**: Public keys and registration status

## Files

- `main.js` - Main transfer tool (BLS signing + ERC-4337 execution)
- `config.json` - Your private configuration (not in git)
- `config.example.json` - Configuration template (safe for git)
