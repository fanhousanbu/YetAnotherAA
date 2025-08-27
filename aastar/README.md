# AAStar API

ERC-4337 Account Abstraction API with BLS Aggregate Signatures

## Features

- 👤 User authentication (JWT)
- 🔐 ERC-4337 account creation and management
- ✍️ BLS signature aggregation
- 💸 ERC-4337 transfers with UserOperation
- 📊 Transfer history and status tracking
- 📚 Swagger API documentation

## Tech Stack

- NestJS + TypeScript
- ethers.js v6
- @noble/curves (BLS signatures)
- JSON file storage (ready for MongoDB migration)
- JWT authentication
- Swagger/OpenAPI

## Installation

```bash
npm install
```

## Configuration

Create `.env` file with your configuration (already provided):

```env
# RPC Configuration
ETH_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
ETH_PRIVATE_KEY=YOUR_PRIVATE_KEY
BUNDLER_RPC_URL=https://api.pimlico.io/v2/11155111/rpc?apikey=YOUR_KEY

# Contract Addresses (Sepolia)
VALIDATOR_CONTRACT_ADDRESS=0xAe7eA28a0aeA05cbB8631bDd7B10Cb0f387FC479
AASTAR_ACCOUNT_FACTORY_ADDRESS=0x559DD2D8Bf9180A70Da56FEFF57DA531BF3f2E1c
ENTRY_POINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789

# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# API Configuration
PORT=3000
API_PREFIX=api/v1
```

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Documentation

Once the application is running, visit:

- Swagger UI: http://localhost:3000/api-docs
- API Base URL: http://localhost:3000/api/v1

## API Endpoints

### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/profile` - Get user profile (requires auth)

### Account Management

- `POST /api/v1/account/create` - Create ERC-4337 account
- `GET /api/v1/account` - Get account information
- `GET /api/v1/account/balance` - Get account balance
- `GET /api/v1/account/nonce` - Get account nonce
- `POST /api/v1/account/fund` - Fund account with ETH

### BLS Signatures

- `GET /api/v1/bls/nodes` - Get available BLS nodes
- `POST /api/v1/bls/sign` - Generate BLS aggregate signature

### Transfers

- `POST /api/v1/transfer/execute` - Execute ERC-4337 transfer
- `POST /api/v1/transfer/estimate` - Estimate gas for transfer
- `GET /api/v1/transfer/status/:id` - Get transfer status
- `GET /api/v1/transfer/history` - Get transfer history

## Usage Example

### 1. Register User

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 3. Create Account (with auth token)

```bash
curl -X POST http://localhost:3000/api/v1/account/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deploy": true,
    "fundAmount": "0.1"
  }'
```

### 4. Execute Transfer

```bash
curl -X POST http://localhost:3000/api/v1/transfer/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0x962753056921000790fb7Fe7C2dCA3006bA605f3",
    "amount": "0.001",
    "nodeIndices": [1, 2, 3]
  }'
```

## Data Storage

Currently uses JSON files in `/data` directory:

- `users.json` - User accounts
- `accounts.json` - ERC-4337 accounts
- `transfers.json` - Transfer history
- `bls-config.json` - BLS node configuration

Ready for MongoDB migration when needed.

## Development

```bash
# Run tests
npm test

# Format code
npm run format

# Lint
npm run lint
```

## Architecture

```
src/
├── auth/           # Authentication module (JWT)
├── account/        # ERC-4337 account management
├── bls/            # BLS signature aggregation
├── transfer/       # Transfer operations
├── ethereum/       # Ethereum/Web3 services
├── database/       # Data persistence layer
└── common/         # Shared DTOs and interfaces
```

## Security Notes

⚠️ **For Production:**

- Change JWT_SECRET to a strong random value
- Encrypt private keys before storing
- Use proper database (MongoDB/PostgreSQL)
- Implement rate limiting
- Add input sanitization
- Use environment-specific configs
- Implement proper error handling
- Add monitoring and logging

## License

MIT
