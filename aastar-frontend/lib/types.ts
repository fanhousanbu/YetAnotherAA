export interface User {
  id: string;
  email: string;
  username: string;
  walletAddress?: string;
  createdAt: string;
}

export interface Account {
  userId: string;
  address: string;
  ownerAddress: string;
  salt: number;
  deployed: boolean;
  deploymentTxHash?: string;
  validatorAddress: string;
  balance?: string;
  eoaBalance?: string;
  nonce?: string;
  createdAt: string;
}

export interface Transfer {
  id: string;
  userId: string;
  from: string;
  to: string;
  amount: string;
  data?: string;
  userOpHash: string;
  bundlerUserOpHash?: string;
  transactionHash?: string;
  status: "pending" | "submitted" | "completed" | "failed";
  nodeIndices: number[];
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface BlsNode {
  index: number;
  nodeId: string;
  nodeName: string;
  status: string;
}

export interface GasEstimate {
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  validatorGasEstimate: string;
  totalGasEstimate: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}
