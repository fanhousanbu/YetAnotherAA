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

export interface UserOperationReceipt {
  userOpHash: string;
  sender: string;
  nonce: string;
  actualGasCost: string;
  actualGasUsed: string;
  success: boolean;
  receipt: {
    transactionHash: string;
    transactionIndex: string;
    blockHash: string;
    blockNumber: string;
    from: string;
    to: string;
    cumulativeGasUsed: string;
    gasUsed: string;
    contractAddress?: string;
    logs: any[];
    status: string;
  };
}

export interface ValidationConfig {
  validator: string;
  isCustom: boolean;
  accountOwner: string;
}

export interface AccountInfo {
  address: string;
  isDeployed: boolean;
  balance: string;
  validationConfig: ValidationConfig;
}

export interface TransferRequest {
  fromPrivateKey: string;
  toAddress: string;
  amount: string;
  useAAStarValidator?: boolean;
  nodeIds?: string[];
}

