# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is **YetAnotherAA (YAAA)** - a production-ready implementation combining WebAuthn/Passkey biometric authentication, BLS aggregate signatures, and ERC-4337 account abstraction. The project enables passwordless blockchain interactions with enterprise-grade key management.

## Development Commands

### Monorepo Commands (Root)

```bash
# Install all dependencies
npm install

# Format code across all packages
npm run format
npm run format:check

# Lint across all packages
npm run lint
npm run lint:fix

# Build all packages
npm run build

# Run tests across all packages
npm run test
npm run test:ci

# Run full CI pipeline
npm run ci
```

### Backend (aastar)

```bash
# Development
npm run start:dev -w aastar        # Start with hot reload (port 3000)

# Building and Production
npm run build -w aastar            # Build to dist/
npm run start:prod -w aastar       # Start production build

# Testing
npm run test -w aastar             # Run tests
npm run test:ci -w aastar          # Run tests with coverage
npm run test:e2e -w aastar         # Run e2e tests

# Type checking
npm run type-check -w aastar       # TypeScript type check

# Database operations
npm run db:clear -w aastar         # Clear all data
npm run db:clear:json -w aastar    # Clear JSON data only

# Linting
npm run lint -w aastar             # ESLint with auto-fix
npm run lint:check -w aastar       # ESLint check only
```

### Frontend (aastar-frontend)

```bash
# Development
npm run dev -w aastar-frontend     # Start dev server (port 8080)

# Building and Production
npm run build -w aastar-frontend   # Build for production
npm run start -w aastar-frontend   # Start production server (port 8080)
npm run start:prod -w aastar-frontend  # Start on port 80 (Docker)

# Type checking and linting
npm run type-check -w aastar-frontend  # TypeScript type check
npm run lint -w aastar-frontend        # ESLint
npm run lint:check -w aastar-frontend  # ESLint check only

# Testing
npm run test -w aastar-frontend     # Currently no tests implemented
```

### Docker Deployment

```bash
# Build image
docker build -t yaaa:latest .

# Run container
docker run -p 80:80 yaaa:latest

# View logs
docker logs -f <container_id>
docker exec <container_id> pm2 logs
```

## Architecture Overview

### Core Components

1. **Backend API (NestJS) - `/aastar/`**
   - WebAuthn authentication service (`src/auth/`)
   - KMS integration for key management (`src/kms/`)
   - ERC-4337 transaction orchestration (`src/transfer/`)
   - BLS signature coordination (`src/bls/`)
   - Account abstraction logic (`src/account/`)

2. **Frontend (Next.js) - `/aastar-frontend/`**
   - WebAuthn biometric interface (`app/`)
   - React components for wallet operations (`components/`)
   - Context providers for state management (`contexts/`)

3. **External Services**
   - **BLS Signing Service**: https://yetanotheraa-validator.onrender.com
   - **Smart Contracts**: Separate repository (YetAnotherAA-Validator)
   - **Bundler**: Pimlico API (configurable)

### Key Architecture Patterns

**Authentication Flow**
```
WebAuthn (Frontend) → Backend Verification → KMS/JWT Token → Secured Session
```

**Transaction Flow**
```
User Action → WebAuthn Signature → BLS Aggregation → ERC-4337 UserOp → Bundle → Ethereum
```

**Dual Signature System**
- ECDSA: Verifies `userOpHash` (standard ERC-4337)
- BLS: Verifies `messagePoint` with aggregate signatures from multiple nodes

### Gas Optimization

Dynamic gas calculation based on EIP-2537:
```solidity
// BLS pairing cost: 32600 * k + 37700 (k=2)
// G1 additions: (nodeCount - 1) * 500
// Storage reads: nodeCount * 2100
// EVM overhead: 50000 + (nodeCount * 1000)
```

### BLS Signature Format (705 bytes)
```
[nodeIdsLength(32)][nodeIds...][blsSignature(256)][messagePoint(256)][aaSignature(65)]
```

## Environment Configuration

### Required Environment Variables

**Backend (`.env`)**
- `DATABASE_*`: PostgreSQL connection
- `JWT_SECRET`: JWT signing secret
- `KMS_ENABLED`: Enable/disable KMS (false for dev)
- `KMS_ENDPOINT`: KMS service URL (production)
- `BLS_SEED_NODES`: BLS signer endpoints
- `ENTRY_POINT_V*_ADDRESS`: ERC-4337 EntryPoint addresses
- `AASTAR_ACCOUNT_FACTORY_V*_ADDRESS`: Factory contract addresses
- `VALIDATOR_CONTRACT_V*_ADDRESS`: BLS validator addresses
- `BUNDLER_RPC_URL`: Pimlico/Alchemy bundler RPC

**Frontend**
- `NEXT_PUBLIC_API_URL`: Backend API URL
- `NEXT_PUBLIC_CHAIN_ID`: Ethereum chain ID
- `NEXT_PUBLIC_RPC_URL`: Ethereum RPC URL

## Development Workflow

### VS Code Debugging
Use `.vscode/launch.json` for one-click launch of all services.

### Smart Contract Development
Smart contracts are in a separate repository:
```bash
git clone https://github.com/fanhousanbu/YetAnotherAA-Validator.git
cd YetAnotherAA-Validator
forge build
forge script script/DeployValidator.s.sol --rpc-url $RPC_URL --broadcast
```

### Testing WebAuthn
- Requires HTTPS in production
- Works on localhost for development
- Test with Chrome/Edge (WebAuthn support)
- Face ID/Touch ID requires hardware support

## Key Dependencies

**Backend**
- `@nestjs/*`: NestJS framework
- `@simplewebauthn/*`: WebAuthn server implementation
- `ethers`: Ethereum interactions
- `typeorm`: Database ORM
- `pg`: PostgreSQL driver

**Frontend**
- `next`: React framework
- `@simplewebauthn/browser`: WebAuthn client
- `axios`: HTTP client
- `tailwindcss`: Styling

## Important Notes

- No private keys needed for runtime (KMS manages in production)
- BLS signing service is remote and configurable
- Supports EntryPoint v0.6, v0.7, and v0.8
- Gasless deployment via Paymaster sponsorship
- User wallet = creator = signer (unified ownership model)