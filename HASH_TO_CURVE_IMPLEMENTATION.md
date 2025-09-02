# BLS12-381 Hash-to-Curve Implementation for AA Star

This implementation provides a secure solution for converting UserOperation hashes to BLS12-381 G2 curve points on-chain, eliminating the security vulnerability of computing messagePoints off-chain.

## Problem Statement

Currently, the AA Star project computes messagePoints off-chain and passes them directly to the smart contract for BLS signature verification. This approach has a critical security vulnerability:

- **Attack Vector**: Malicious actors could provide invalid messagePoints that don't correspond to the actual UserOperation hash
- **Security Risk**: This could lead to signature bypass attacks where invalid operations are accepted

## Solution

Our implementation moves the hash-to-curve computation on-chain using EIP-2537 precompiles, ensuring:

1. **Security**: UserOperation hashes are converted to messagePoints on-chain, eliminating tampering possibilities
2. **Standards Compliance**: Uses RFC 9380 hash-to-curve specification for BLS12-381 G2
3. **Gas Efficiency**: Leverages EIP-2537 precompiles for optimized elliptic curve operations

## Implementation Details

### Off-Chain Components

#### 1. UserOperation Hash Generation (`scripts/generate-userop.ts`)
- Implements EIP-4337 UserOperation hash computation
- Follows the standard: `keccak256(abi.encode(userOp)) + entryPoint + chainId`
- Test case generates hash: `0x7970c13dcd8651528866f649abfe94af364ceac8b8532ef5b02f728a7b03451b`

#### 2. Hash-to-Curve Implementation (`scripts/complete-test.ts`)
- Uses `@noble/curves/bls12-381` library for off-chain computation
- Follows RFC 9380 specification with DST: `"BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_"`
- Encodes G2 points in EIP-2537 format (256 bytes)
- Test result: `0x00000000000000000000000000000000004b6a52ee951e0e5f7f69489961e474a872814ed947189647449caf3518392fa7f0f4a27c984a9b02dc6bf9508a7bb7...`

### On-Chain Components

#### 1. Hash-to-Curve Contract (`validator/src/SimpleHashToCurveG2.sol`)
- Uses EIP-2537 precompiles for BLS12-381 operations
- Precompile addresses:
  - `0x0d`: BLS12_G2ADD (600 gas)
  - `0x11`: BLS12_MAP_FP2_TO_G2 (23,800 gas)
- Provides `hashUserOpToG2(bytes32 userOpHash)` function for secure on-chain computation

#### 2. Comprehensive Test Suite (`validator/test/SimpleHashToCurveG2.t.sol`)
- Tests deterministic behavior
- Validates different input scenarios
- Checks gas usage and precompile availability

## EIP-2537 Precompile Details

The implementation uses updated EIP-2537 precompile addresses (as of 2025):

```solidity
address constant BLS12_G2ADD = address(0x0d);        // G2 point addition
address constant BLS12_MAP_FP2_TO_G2 = address(0x11); // Fp2 to G2 mapping
```

**Gas Costs:**
- MAP_FP2_TO_G2: 23,800 gas
- G2ADD: 600 gas
- Total estimated: ~25,000 gas per hash-to-curve operation

## Deployment Status

**EIP-2537 Mainnet Deployment:**
- **Activation Date**: May 7, 2025 (Pectra Upgrade)
- **Epoch**: 364032 (approximately 10:05:11 UTC)
- **Current Status**: Available on private networks, coming to mainnet

## Usage Instructions

### 1. Off-Chain Testing
```bash
cd scripts
npm install
npx ts-node --esm complete-test.ts
```

### 2. Contract Compilation
```bash
cd validator
forge build
forge test --match-contract SimpleHashToCurveG2Test
```

### 3. Deployment (Post-Pectra)
1. Deploy `SimpleHashToCurveG2.sol` to mainnet/testnet with EIP-2537 support
2. Call `hashUserOpToG2(userOpHash)` instead of computing messagePoint off-chain
3. Compare results with off-chain implementation for verification

## Security Benefits

### Before (Insecure)
```javascript
// Off-chain computation (vulnerable)
const messagePoint = await bls.hashToCurve(userOpHash);
const signature = await contract.verifyBLS(publicKeys, signature, messagePoint);
```

### After (Secure)
```solidity
// On-chain computation (secure)
function verifyBLSSignature(
    bytes32 userOpHash,
    bytes[] calldata publicKeys,
    bytes calldata signature
) external view returns (bool) {
    bytes memory messagePoint = hashUserOpToG2(userOpHash);
    return verifyBLS(publicKeys, signature, messagePoint);
}
```

## Test Results

The implementation successfully:
- ✅ Generates consistent UserOperation hashes
- ✅ Computes deterministic messagePoints
- ✅ Produces 256-byte EIP-2537 compatible G2 points
- ✅ Handles various input scenarios (zero, max, random)
- ⚠️ Requires EIP-2537 support for on-chain execution

## Integration Path

1. **Phase 1 (Current)**: Use off-chain implementation for testing and development
2. **Phase 2 (Post-Pectra)**: Deploy on-chain contracts with EIP-2537 support
3. **Phase 3**: Update AA Star validators to use on-chain hash-to-curve computation
4. **Phase 4**: Remove off-chain messagePoint computation from client code

## Files Created

- `/scripts/generate-userop.ts` - UserOp hash generation
- `/scripts/complete-test.ts` - Comprehensive test suite
- `/validator/src/SimpleHashToCurveG2.sol` - On-chain implementation
- `/validator/test/SimpleHashToCurveG2.t.sol` - Contract tests
- `/HASH_TO_CURVE_IMPLEMENTATION.md` - This documentation

This implementation provides a robust foundation for secure BLS signature verification in the AA Star ecosystem, eliminating the critical security vulnerability while maintaining compatibility with existing systems.