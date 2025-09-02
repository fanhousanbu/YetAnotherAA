export interface UserOperation {
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

export interface GasEstimate {
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
}

export interface BlsSignatureData {
  nodeIds?: string[];
  signatures?: string[];
  publicKeys?: string[];
  signature: string;
  // messagePoint removed: now generated on-chain by AAStarValidatorV7
  aaAddress?: string;
  aaSignature?: string;
  aggregatedSignature?: string;
}
