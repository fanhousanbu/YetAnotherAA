# @yaaa/sdk

> Yet Another Account Abstraction SDK - ERC-4337 + BLS + Passkey

A lightweight, production-ready SDK for building Web3 applications with Passkey
authentication and ERC-4337 account abstraction.

## Features

- 🔐 **Passkey Authentication**: Passwordless login with biometric verification
- 🔑 **BLS Aggregate Signatures**: Efficient multi-signature support
- 💼 **ERC-4337 Account Abstraction**: Smart contract wallets with advanced
  features
- 🚫 **No Private Keys**: All sensitive operations handled securely
- 🎯 **TypeScript First**: Full type safety and IntelliSense support
- 🪶 **Lightweight**: Minimal dependencies, tree-shakeable

## Installation

```bash
npm install @yaaa/sdk
```

## Quick Start

```typescript
import { YAAAClient } from "@yaaa/sdk";

// Initialize the client
const yaaa = new YAAAClient({
  apiURL: "https://api.your-backend.com/v1",
  tokenProvider: () => localStorage.getItem("token"),
  bls: {
    seedNodes: ["https://validator.your-domain.com"],
  },
});

// Register with Passkey
const { user, token } = await yaaa.passkey.register({
  email: "user@example.com",
  username: "JohnDoe",
});

// Login with Passkey
const result = await yaaa.passkey.authenticate();

// Send transaction with Passkey verification
const verification = await yaaa.passkey.verifyTransaction({
  to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  value: "0.01",
});
```

## API Reference

### YAAAClient

Main entry point for the SDK.

```typescript
const yaaa = new YAAAClient(config: YAAAConfig);
```

#### Configuration

```typescript
interface YAAAConfig {
  apiURL: string; // Your backend API URL
  tokenProvider?: () => string | null; // JWT token provider
  bls: {
    seedNodes: string[]; // BLS validator seed nodes
    discoveryTimeout?: number; // Node discovery timeout (ms)
  };
}
```

### Passkey Module

Handle Passkey authentication flows.

#### `yaaa.passkey.register(params)`

Register a new user with Passkey.

```typescript
const result = await yaaa.passkey.register({
  email: string;
  username: string;
  password?: string; // Optional fallback
});

// Returns: { user, token, passkey }
```

#### `yaaa.passkey.authenticate(params?)`

Login with Passkey.

```typescript
const result = await yaaa.passkey.authenticate({
  email?: string; // Optional hint
});

// Returns: { user, token }
```

#### `yaaa.passkey.verifyTransaction(params)`

Verify a transaction with Passkey (for signing UserOpHash).

```typescript
const result = await yaaa.passkey.verifyTransaction({
  to: string;
  value?: string;
  data?: string;
});

// Returns: { credential, userOpHash }
```

#### `yaaa.passkey.addDevice(params)`

Add a new device/Passkey to existing account.

```typescript
const passkey = await yaaa.passkey.addDevice({
  email: string;
  password?: string;
});

// Returns: PasskeyInfo
```

### BLS Module

BLS signature utilities (advanced usage).

#### `yaaa.bls.getAvailableNodes()`

Discover available BLS validator nodes.

```typescript
const nodes = await yaaa.bls.getAvailableNodes();
// Returns: BLSNode[]
```

#### `yaaa.bls.generateMessagePoint(message)`

Generate G2 message point for BLS signing.

```typescript
const messagePoint = await yaaa.bls.generateMessagePoint(userOpHash);
// Returns: string (hex)
```

#### `yaaa.bls.packSignature(data)`

Pack BLS signature data for UserOperation.

```typescript
const packed = yaaa.bls.packSignature({
  nodeIds: ["0x...", "0x..."],
  signature: "0x...",
  messagePoint: "0x...",
  aaAddress: "0x...",
  aaSignature: "0x...",
  messagePointSignature: "0x...",
});
```

### ERC-4337 Utilities

UserOperation packing/unpacking utilities.

```typescript
import { ERC4337Utils } from "@yaaa/sdk";

// Pack gas limits
const packed = ERC4337Utils.packAccountGasLimits(
  verificationGasLimit,
  callGasLimit
);

// Unpack gas limits
const { verificationGasLimit, callGasLimit } =
  ERC4337Utils.unpackAccountGasLimits(packed);

// Pack UserOperation (v0.6 -> v0.7)
const packedOp = ERC4337Utils.packUserOperation(userOp);

// Unpack UserOperation
const userOp = ERC4337Utils.unpackUserOperation(packedOp);
```

## Types

### Core Types

```typescript
interface UserOperation {
  sender: string;
  nonce: bigint | string;
  initCode: string;
  callData: string;
  callGasLimit: bigint | string;
  verificationGasLimit: bigint | string;
  preVerificationGas: bigint | string;
  maxFeePerGas: bigint | string;
  maxPriorityFeePerGas: bigint | string;
  paymasterAndData: string;
  signature: string;
}

interface PackedUserOperation {
  sender: string;
  nonce: bigint | string;
  initCode: string;
  callData: string;
  accountGasLimits: string;
  preVerificationGas: bigint | string;
  gasFees: string;
  paymasterAndData: string;
  signature: string;
}

interface BLSNode {
  nodeId: string;
  nodeName: string;
  apiEndpoint: string;
  status: "active" | "inactive";
  publicKey?: string;
}

interface PasskeyInfo {
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceType: string;
  createdAt: string;
}
```

## Examples

See the [examples](./examples) directory for complete usage examples:

- [Basic Usage](./examples/basic-usage.ts) - Registration, login, transactions
- [React Integration](./examples/README.md#usage-in-react-component)

## Architecture

The SDK is designed to work with a backend API that handles:

- Bundler communication (submitting UserOperations)
- Paymaster integration (gas sponsorship)
- BLS signature coordination

```
┌──────────┐
│ Frontend │  @yaaa/sdk
│  (SDK)   │
└────┬─────┘
     │ HTTPS
     ▼
┌──────────┐
│ Backend  │  Your API
│   API    │
└────┬─────┘
     │
     ├────► Bundler (Pimlico/Alchemy)
     ├────► Paymaster
     └────► BLS Validators
```

## Browser Support

- Chrome/Edge 67+
- Safari 13+
- Firefox 60+

**Note**: Passkey requires HTTPS (localhost is OK for development).

## Security

- ✅ No private keys in browser
- ✅ Passkey credentials stored in secure enclave
- ✅ All sensitive operations server-side
- ✅ BLS signatures coordinated by backend
- ✅ TypeScript for type safety

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Watch mode
npm run dev
```

## License

MIT

## Links

- [GitHub Repository](https://github.com/fanhousanbu/YetAnotherAA)
- [Implementation Plan](../SDK_IMPLEMENTATION_PLAN.md)
- [Detailed Design](../YAAA_SDK_DETAILED_DESIGN.md)
- [API Documentation](https://docs.yetanotheraa.com)

## Support

For issues and questions:

- GitHub Issues: https://github.com/fanhousanbu/YetAnotherAA/issues
- Email: support@yetanotheraa.com
