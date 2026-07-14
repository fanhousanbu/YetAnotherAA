const {
  createPublicClient,
  http,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  parseAbi,
} = require("viem");

// 从失败的交易日志中提取的数据
const userOp = {
  sender: "0x975961302a83090B1eb94676E1430B5baCa43F9E",
  nonce: "0x1",
  initCode: "0x",
  callData:
    "0xb61d27f6000000000000000000000000d14e87d8d8b69016fcc08728c33799bd3f66f180000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044a9059cbb0000000000000000000000001f889dac7f0686467e6826df51dcd3966b21a5370000000000000000000000000000000000000000000000001bc16d674ec8000000000000000000000000000000000000000000000000000000000000",
  accountGasLimits: "0x000000000000000000000000000f4240000000000000000000000000000249f0",
  preVerificationGas: 70000,
  gasFees: "0x000000000000000000000000001276900000000000000000000000000012769c",
  paymasterAndData:
    "0x64c95279ba723394aaa01fe47eca1bfc4a23450800000000000000000000000000030000000000000000000000000000000000030000",
};

const entryPoint = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const chainId = 11155111; // Sepolia

// 方法1：使用 SDK 的方式计算（客户端）
function calculateUserOpHashSDK() {
  const encoded = encodeAbiParameters(
    parseAbiParameters(
      "address, uint256, bytes32, bytes32, bytes32, uint256, bytes32, bytes32"
    ),
    [
      userOp.sender,
      BigInt(userOp.nonce),
      keccak256(userOp.initCode),
      keccak256(userOp.callData),
      userOp.accountGasLimits,
      BigInt(userOp.preVerificationGas),
      userOp.gasFees,
      keccak256(userOp.paymasterAndData),
    ]
  );

  return keccak256(
    encodeAbiParameters(parseAbiParameters("bytes32, address, uint256"), [
      keccak256(encoded),
      entryPoint,
      BigInt(chainId),
    ])
  );
}

// 方法2：调用 EntryPoint 合约（后端方式）
async function calculateUserOpHashContract() {
  const client = createPublicClient({
    transport: http(process.env.ETH_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"),
  });

  const entryPointABI = parseAbi([
    "function getUserOpHash((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) packedUserOp) view returns (bytes32)",
  ]);

  const packedOp = {
    sender: userOp.sender,
    nonce: BigInt(userOp.nonce),
    initCode: userOp.initCode,
    callData: userOp.callData,
    accountGasLimits: userOp.accountGasLimits,
    preVerificationGas: BigInt(userOp.preVerificationGas),
    gasFees: userOp.gasFees,
    paymasterAndData: userOp.paymasterAndData,
    signature: "0x", // empty signature for hash calculation
  };

  return await client.readContract({
    address: entryPoint,
    abi: entryPointABI,
    functionName: "getUserOpHash",
    args: [packedOp],
  });
}

async function main() {
  console.log("🔍 Comparing UserOp Hash Calculations\n");

  const sdkHash = calculateUserOpHashSDK();
  console.log("SDK Hash (client-side):");
  console.log(sdkHash);
  console.log("");

  const contractHash = await calculateUserOpHashContract();
  console.log("Contract Hash (EntryPoint.getUserOpHash):");
  console.log(contractHash);
  console.log("");

  if (sdkHash === contractHash) {
    console.log("✅ Hashes match!");
  } else {
    console.log("❌ Hashes DO NOT match!");
    console.log("This could explain the AA34 signature error.");
  }
}

main().catch(console.error);
