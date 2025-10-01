export enum EntryPointVersion {
  V0_6 = "0.6",
  V0_7 = "0.7",
  V0_8 = "0.8"
}

export interface EntryPointConfig {
  version: EntryPointVersion;
  address: string;
  factoryAddress: string;
  validatorAddress: string;
}

// Default EntryPoint addresses on different networks
export const ENTRYPOINT_ADDRESSES = {
  [EntryPointVersion.V0_6]: {
    sepolia: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    mainnet: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  },
  [EntryPointVersion.V0_7]: {
    sepolia: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    mainnet: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  },
  [EntryPointVersion.V0_8]: {
    sepolia: "0x0576a174D229E3cFA37253523E645A78A0C91B57",
    mainnet: "0x0576a174D229E3cFA37253523E645A78A0C91B57",
  },
};

// ABI differences between versions
export const ENTRYPOINT_ABI_V6 = [
  "function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external",
  "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)",
  "function getUserOpHash((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external view returns (bytes32)",
  "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address payable beneficiary) external",
];

export const ENTRYPOINT_ABI_V7_V8 = [
  "function simulateValidation((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes) packedUserOp) external",
  "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)",
  "function getUserOpHash((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes) packedUserOp) external view returns (bytes32)",
  "function handleOps((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes)[] ops, address payable beneficiary) external",
];

// Factory ABIs for different versions
export const FACTORY_ABI_V6 = [
  "function getAddress(address creator, address signer, address validator, bool useAAStarValidator, uint256 salt) view returns (address)",
  "function createAccountWithAAStarValidator(address creator, address signer, address aaStarValidator, bool useAAStarValidator, uint256 salt) returns (address)",
];

export const FACTORY_ABI_V7_V8 = [
  "function getAddress(address creator, address signer, address validator, bool useAAStarValidator, uint256 salt) view returns (address)",
  "function createAccount(address creator, address signer, address aaStarValidator, bool useAAStarValidator, uint256 salt) returns (address)",
];