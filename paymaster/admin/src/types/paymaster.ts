export interface UserOperation {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

export interface PaymasterConfig {
  address: string;
  owner: string;
  deposit: string;
  withdrawStake: string;
}

export interface PaymasterStats {
  totalOperations: number;
  totalGasSponsored: string;
  activeUsers: number;
  remainingBalance: string;
}

export interface StakeInfo {
  stake: string;
  unstakeDelaySec: string;
}

export interface DepositInfo {
  deposit: string;
  staked: boolean;
  stake: string;
  unstakeDelaySec: string;
  withdrawTime: string;
}