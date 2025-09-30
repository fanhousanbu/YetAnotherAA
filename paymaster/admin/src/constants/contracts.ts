// EntryPoint addresses for different versions
export const ENTRY_POINT_ADDRESSES = {
  v06: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  v07: "0x0000000071727De22E5E9d8BAf0edAc6f37da032", // EntryPoint v0.7
  v08: "0x4337084d9e255ff0702461cf8895ce9e3b5ff108", // EntryPoint v0.8
};

// Paymaster addresses for different versions
export const PAYMASTER_ADDRESSES = {
  v06: "0xdde25C1d254AeBcA592d8574Dc9421f87a491dF4",
  v07: "0x8E9756738B2B9D96f1480c15302e1Ba2F788234A",
  v08: "0x76721BaD7a22C8651517591110E5e60E1d40963f",
};

export const PAYMASTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "callGasLimit", type: "uint256" },
          { name: "verificationGasLimit", type: "uint256" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "maxFeePerGas", type: "uint256" },
          { name: "maxPriorityFeePerGas", type: "uint256" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
        name: "userOp",
        type: "tuple",
      },
      { name: "userOpHash", type: "bytes32" },
      { name: "maxCost", type: "uint256" },
    ],
    name: "validatePaymasterUserOp",
    outputs: [
      { name: "context", type: "bytes" },
      { name: "validationData", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "withdrawAddress", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "withdrawTo",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "unstakeDelaySec", type: "uint32" }],
    name: "addStake",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "unlockStake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "withdrawAddress", type: "address" }],
    name: "withdrawStake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getDeposit",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

export const ENTRY_POINT_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "getDepositInfo",
    outputs: [
      {
        components: [
          { name: "deposit", type: "uint112" },
          { name: "staked", type: "bool" },
          { name: "stake", type: "uint112" },
          { name: "unstakeDelaySec", type: "uint32" },
          { name: "withdrawTime", type: "uint48" },
        ],
        name: "info",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];
