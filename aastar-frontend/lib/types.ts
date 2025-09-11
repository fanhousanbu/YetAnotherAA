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
  creatorAddress: string;
  signerAddress: string;
  salt: number;
  deployed: boolean;
  deploymentTxHash?: string;
  sponsored: boolean;
  sponsorTxHash?: string;
  validatorAddress: string;
  balance?: string;
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

// ERC20 Token types
export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  isCustom?: boolean;
  chainId?: number;
}

export interface TokenBalance {
  token: Token;
  balance: string;
  formattedBalance: string;
  usdValue?: string;
}

export interface TokenTransfer extends Omit<Transfer, 'amount'> {
  tokenAddress?: string;
  tokenAmount?: string;
  tokenSymbol?: string;
  amount: string; // For ETH transfers, this is ETH amount; for token transfers, this is "0"
}
