import { ethers } from "ethers";
import { bls12_381 } from "@noble/curves/bls12-381";

const BLS_DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";

interface UserOperation {
  sender: string;
  nonce: bigint;
  initCode: string;
  callData: string;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: string;
  signature: string;
}

function encodeG2Point(point: any): string {
  const result = new Uint8Array(256);
  const affine = point.toAffine();

  // Convert field elements to hex strings with proper padding
  const x0Hex = affine.x.c0.toString(16).padStart(96, "0");
  const x1Hex = affine.x.c1.toString(16).padStart(96, "0");
  const y0Hex = affine.y.c0.toString(16).padStart(96, "0");
  const y1Hex = affine.y.c1.toString(16).padStart(96, "0");

  // Convert hex strings to bytes
  const x0Bytes = hexToBytes(x0Hex);
  const x1Bytes = hexToBytes(x1Hex);
  const y0Bytes = hexToBytes(y0Hex);
  const y1Bytes = hexToBytes(y1Hex);

  // Set bytes in the result array according to EIP-2537 format
  result.set(x0Bytes, 16); // x.c0 at offset 16
  result.set(x1Bytes, 80); // x.c1 at offset 80
  result.set(y0Bytes, 144); // y.c0 at offset 144
  result.set(y1Bytes, 208); // y.c1 at offset 208

  return "0x" + Buffer.from(result).toString("hex");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function generateUserOpHash(userOp: UserOperation, entryPoint: string, chainId: number): string {
  // Encode UserOperation struct according to EIP-4337
  const types = [
    "address", // sender
    "uint256", // nonce
    "bytes32", // initCode hash
    "bytes32", // callData hash
    "uint256", // callGasLimit
    "uint256", // verificationGasLimit
    "uint256", // preVerificationGas
    "uint256", // maxFeePerGas
    "uint256", // maxPriorityFeePerGas
    "bytes32", // paymasterAndData hash
  ];

  const values = [
    userOp.sender,
    userOp.nonce,
    ethers.keccak256(userOp.initCode),
    ethers.keccak256(userOp.callData),
    userOp.callGasLimit,
    userOp.verificationGasLimit,
    userOp.preVerificationGas,
    userOp.maxFeePerGas,
    userOp.maxPriorityFeePerGas,
    ethers.keccak256(userOp.paymasterAndData),
  ];

  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(types, values);
  const userOpHash = ethers.keccak256(encoded);

  // Generate final hash with entryPoint and chainId
  const finalHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "uint256"],
      [userOpHash, entryPoint, chainId]
    )
  );

  return finalHash;
}

async function hashToCurveG2(message: Uint8Array): Promise<any> {
  return await bls12_381.G2.hashToCurve(message, { DST: BLS_DST });
}

async function main() {
  console.log("Generating UserOperation and computing messagePoint...\n");

  // Sample UserOperation
  const userOp: UserOperation = {
    sender: "0x1234567890123456789012345678901234567890",
    nonce: BigInt(42),
    initCode: "0x",
    callData:
      "0xa9059cbb000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcdef0000000000000000000000000000000000000000000000000de0b6b3a7640000",
    callGasLimit: BigInt(21000),
    verificationGasLimit: BigInt(100000),
    preVerificationGas: BigInt(21000),
    maxFeePerGas: BigInt(2000000000), // 2 gwei
    maxPriorityFeePerGas: BigInt(1000000000), // 1 gwei
    paymasterAndData: "0x",
    signature: "0x",
  };

  const entryPoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
  const chainId = 11155111; // Sepolia

  // Generate userOpHash
  const userOpHash = generateUserOpHash(userOp, entryPoint, chainId);
  console.log(
    "UserOperation:",
    JSON.stringify(
      userOp,
      (key, value) => (typeof value === "bigint" ? value.toString() : value),
      2
    )
  );
  console.log("UserOp Hash:", userOpHash);

  // Compute messagePoint using hash-to-curve
  const messageBytes = ethers.getBytes(userOpHash);
  const messagePoint = await hashToCurveG2(messageBytes);
  const encodedMessagePoint = encodeG2Point(messagePoint);

  console.log("Message Point (encoded):", encodedMessagePoint);
  console.log("Message Point length:", encodedMessagePoint.length - 2); // Subtract "0x"

  // Output for contract testing
  const testData = {
    userOpHash,
    messagePoint: encodedMessagePoint,
    userOp: {
      ...userOp,
      nonce: userOp.nonce.toString(),
      callGasLimit: userOp.callGasLimit.toString(),
      verificationGasLimit: userOp.verificationGasLimit.toString(),
      preVerificationGas: userOp.preVerificationGas.toString(),
      maxFeePerGas: userOp.maxFeePerGas.toString(),
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas.toString(),
    },
  };

  console.log("\n=== Test Data for Contract ===");
  console.log(JSON.stringify(testData, null, 2));
}

// Check if this is the main module (ES modules)
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { generateUserOpHash, hashToCurveG2, encodeG2Point };
