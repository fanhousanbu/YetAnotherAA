export const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

export const PAYMASTER_ABI = [
  {
    "inputs": [
      {
        "components": [
          {"name": "sender", "type": "address"},
          {"name": "nonce", "type": "uint256"},
          {"name": "initCode", "type": "bytes"},
          {"name": "callData", "type": "bytes"},
          {"name": "callGasLimit", "type": "uint256"},
          {"name": "verificationGasLimit", "type": "uint256"},
          {"name": "preVerificationGas", "type": "uint256"},
          {"name": "maxFeePerGas", "type": "uint256"},
          {"name": "maxPriorityFeePerGas", "type": "uint256"},
          {"name": "paymasterAndData", "type": "bytes"},
          {"name": "signature", "type": "bytes"}
        ],
        "name": "userOp",
        "type": "tuple"
      },
      {"name": "userOpHash", "type": "bytes32"},
      {"name": "maxCost", "type": "uint256"}
    ],
    "name": "validatePaymasterUserOp",
    "outputs": [
      {"name": "context", "type": "bytes"},
      {"name": "validationData", "type": "uint256"}
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "withdrawAddress", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "name": "withdrawTo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "unstakeDelaySec", "type": "uint32"}
    ],
    "name": "addStake",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unlockStake",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "withdrawAddress", "type": "address"}
    ],
    "name": "withdrawStake",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getDeposit",
    "outputs": [
      {"name": "", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "account", "type": "address"}
    ],
    "name": "balanceOf",
    "outputs": [
      {"name": "", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {"name": "", "type": "address"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export const ENTRY_POINT_ABI = [
  {
    "inputs": [
      {"name": "account", "type": "address"}
    ],
    "name": "getDepositInfo",
    "outputs": [
      {
        "components": [
          {"name": "deposit", "type": "uint112"},
          {"name": "staked", "type": "bool"},
          {"name": "stake", "type": "uint112"},
          {"name": "unstakeDelaySec", "type": "uint32"},
          {"name": "withdrawTime", "type": "uint48"}
        ],
        "name": "info",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];