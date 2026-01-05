# YAAA SDK Examples

This directory contains example code demonstrating how to use the YAAA SDK in
your applications.

## Quick Start

### Installation

```bash
npm install @yaaa/sdk
```

### Basic Setup

```typescript
import { YAAAClient } from "@yaaa/sdk";

const yaaa = new YAAAClient({
  apiURL: "https://api.your-backend.com/v1",
  tokenProvider: () => localStorage.getItem("token"),
  bls: {
    seedNodes: ["https://validator.your-domain.com"],
  },
});
```

## Examples

### 1. Passkey Registration

See: `basic-usage.ts` - `registerWithPasskey()`

```typescript
const result = await yaaa.passkey.register({
  email: "user@example.com",
  username: "JohnDoe",
});

// Save the token
localStorage.setItem("token", result.token);
```

### 2. Passkey Login

See: `basic-usage.ts` - `loginWithPasskey()`

```typescript
const result = await yaaa.passkey.authenticate();
localStorage.setItem("token", result.token);
```

### 3. Transaction with Passkey Verification

See: `basic-usage.ts` - `sendTransaction()`

```typescript
// Step 1: Verify with Passkey
const verification = await yaaa.passkey.verifyTransaction({
  to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  value: "0.01",
});

// Step 2: Send to your backend
const response = await fetch("/api/transfer", {
  method: "POST",
  body: JSON.stringify({
    to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    amount: "0.01",
    passkeyCredential: verification.credential,
  }),
});
```

## Architecture

```
┌─────────────┐
│   Browser   │
│   (SDK)     │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────┐
│  Your API   │
│  (Backend)  │
└──────┬──────┘
       │
       ├─────► Bundler (Pimlico/Alchemy)
       │
       └─────► Paymaster (Gas Sponsorship)
```

## Key Concepts

### Passkey Flow

1. **Registration**: SDK calls your backend → backend generates challenge →
   browser shows biometric prompt → backend verifies and creates account
2. **Login**: Similar flow but for authentication
3. **Transaction**: User confirms transaction via biometric → SDK gets
   credential → backend verifies and submits to blockchain

### BLS Signatures

The SDK provides utilities for BLS signature operations, but actual signing is
coordinated by your backend with BLS validator nodes.

### No Private Keys in Browser

The SDK never handles private keys directly. All sensitive operations are:

- Passkey: Handled by browser's secure enclave
- BLS: Handled by backend validator nodes
- Smart Account: Deployed on-chain, controlled by Passkey signatures

## Running Examples

```bash
# Install dependencies
cd sdk
npm install

# Run the example (requires backend running)
npx ts-node examples/basic-usage.ts
```

## Integration Checklist

- [ ] Backend API running and accessible
- [ ] BLS validator nodes configured
- [ ] Bundler RPC endpoint configured
- [ ] (Optional) Paymaster configured for gasless transactions
- [ ] HTTPS enabled in production (required for Passkey)
- [ ] CORS configured to allow your frontend domain

## Troubleshooting

### "Passkey not supported"

- Ensure you're using HTTPS (localhost is OK for development)
- Check browser compatibility (Chrome 67+, Safari 13+, Edge 18+)

### "Network request failed"

- Verify `apiURL` is correct
- Check CORS settings on your backend
- Ensure backend is running

### "BLS nodes unavailable"

- Check `seedNodes` configuration
- Verify BLS validator nodes are running and accessible

## Next Steps

- Read the [API Documentation](../README.md)
- Check out the [Implementation Plan](../../SDK_IMPLEMENTATION_PLAN.md)
- See the [Detailed Design](../../YAAA_SDK_DETAILED_DESIGN.md)
