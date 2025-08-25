# ERC-4337 + BLS Transfer Tool

Complete ERC-4337 account abstraction transfer tool with integrated BLS aggregate signature functionality.

## Setup

1. **Copy configuration template:**
   ```bash
   cp config.example.json config.json
   ```

2. **Configure your private keys:**
   Edit `config.json` and replace the following placeholders with your actual values:
   - `YOUR_BLS_NODE_1_PRIVATE_KEY` → `YOUR_BLS_NODE_5_PRIVATE_KEY`: BLS private keys for signing nodes
   - `YOUR_EOA_PRIVATE_KEY`: Ethereum private key for AA signature
   - `YOUR_EOA_ADDRESS`: Ethereum address corresponding to the private key
   - `YOUR_OWNER_ADDRESS`: Owner address (usually same as EOA address)

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

The `config.json` file is automatically ignored by git. Only the template file `config.example.json` should be committed.

## Configuration Structure

The configuration includes:
- **BLS Node Private Keys**: Used for generating BLS signatures
- **AA Account Private Key**: Used for ERC-4337 account abstraction signatures  
- **Contract Addresses**: Deployed validator, factory, and implementation contracts
- **Node Registration Info**: Public keys and registration status

## Files

- `main.js` - Main transfer tool (BLS signing + ERC-4337 execution)
- `config.json` - Your private configuration (not in git)
- `config.example.json` - Configuration template (safe for git)