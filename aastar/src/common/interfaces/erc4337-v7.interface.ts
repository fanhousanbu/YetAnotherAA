// ERC-4337 v0.7 and v0.8 PackedUserOperation interface
export interface PackedUserOperation {
  sender: string;
  nonce: bigint | string;
  initCode: string;
  callData: string;
  accountGasLimits: string; // Packed: verificationGasLimit (16 bytes) + callGasLimit (16 bytes)
  preVerificationGas: bigint | string;
  gasFees: string; // Packed: maxPriorityFeePerGas (16 bytes) + maxFeePerGas (16 bytes)
  paymasterAndData: string;
  signature: string;
}

// Helper functions for packing/unpacking gas values
export function packAccountGasLimits(
  verificationGasLimit: bigint | string,
  callGasLimit: bigint | string
): string {
  const vgl = BigInt(verificationGasLimit);
  const cgl = BigInt(callGasLimit);
  // Pack as bytes32: upper 16 bytes = verificationGasLimit, lower 16 bytes = callGasLimit
  const packed = (vgl << 128n) | cgl;
  return "0x" + packed.toString(16).padStart(64, "0");
}

export function unpackAccountGasLimits(accountGasLimits: string): {
  verificationGasLimit: bigint;
  callGasLimit: bigint;
} {
  const packed = BigInt(accountGasLimits);
  return {
    verificationGasLimit: packed >> 128n,
    callGasLimit: packed & ((1n << 128n) - 1n),
  };
}

export function packGasFees(
  maxPriorityFeePerGas: bigint | string,
  maxFeePerGas: bigint | string
): string {
  const priority = BigInt(maxPriorityFeePerGas);
  const max = BigInt(maxFeePerGas);
  // Pack as bytes32: upper 16 bytes = maxPriorityFeePerGas, lower 16 bytes = maxFeePerGas
  const packed = (priority << 128n) | max;
  return "0x" + packed.toString(16).padStart(64, "0");
}

export function unpackGasFees(gasFees: string): {
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
} {
  const packed = BigInt(gasFees);
  return {
    maxPriorityFeePerGas: packed >> 128n,
    maxFeePerGas: packed & ((1n << 128n) - 1n),
  };
}

// Convert standard UserOperation to PackedUserOperation
export function packUserOperation(userOp: any): PackedUserOperation {
  return {
    sender: userOp.sender,
    nonce: userOp.nonce,
    initCode: userOp.initCode || "0x",
    callData: userOp.callData,
    accountGasLimits: packAccountGasLimits(userOp.verificationGasLimit, userOp.callGasLimit),
    preVerificationGas: userOp.preVerificationGas,
    gasFees: packGasFees(userOp.maxPriorityFeePerGas, userOp.maxFeePerGas),
    paymasterAndData: userOp.paymasterAndData || "0x",
    signature: userOp.signature || "0x",
  };
}

// Convert PackedUserOperation back to standard UserOperation
export function unpackUserOperation(packedOp: PackedUserOperation): any {
  const gasLimits = unpackAccountGasLimits(packedOp.accountGasLimits);
  const gasFees = unpackGasFees(packedOp.gasFees);

  return {
    sender: packedOp.sender,
    nonce: packedOp.nonce,
    initCode: packedOp.initCode,
    callData: packedOp.callData,
    callGasLimit: "0x" + gasLimits.callGasLimit.toString(16),
    verificationGasLimit: "0x" + gasLimits.verificationGasLimit.toString(16),
    preVerificationGas: packedOp.preVerificationGas,
    maxFeePerGas: "0x" + gasFees.maxFeePerGas.toString(16),
    maxPriorityFeePerGas: "0x" + gasFees.maxPriorityFeePerGas.toString(16),
    paymasterAndData: packedOp.paymasterAndData,
    signature: packedOp.signature,
  };
}
