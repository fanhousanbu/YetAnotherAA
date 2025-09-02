import { ethers } from "ethers";
import { bls12_381 } from "@noble/curves/bls12-381";

const BLS_DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";

// Working contract address
const CONTRACT_ADDRESS = "0x11ca946e52aB8054Ea4478346Dd9732bccA52513";
const CONTRACT_ABI = [
  "function hashToG2Simple(bytes32 userOpHash) external view returns (bool success, bytes memory result)"
];

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

function generateUserOpHash(userOp: UserOperation, entryPoint: string, chainId: number): string {
  const types = [
    "address", "uint256", "bytes32", "bytes32", "uint256", 
    "uint256", "uint256", "uint256", "uint256", "bytes32"
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

  const finalHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "uint256"],
      [userOpHash, entryPoint, chainId]
    )
  );

  return finalHash;
}

function encodeG2Point(point: any): string {
  const result = new Uint8Array(256);
  const affine = point.toAffine();

  const x0Hex = affine.x.c0.toString(16).padStart(96, "0");
  const x1Hex = affine.x.c1.toString(16).padStart(96, "0");
  const y0Hex = affine.y.c0.toString(16).padStart(96, "0");
  const y1Hex = affine.y.c1.toString(16).padStart(96, "0");

  const x0Bytes = hexToBytes(x0Hex);
  const x1Bytes = hexToBytes(x1Hex);
  const y0Bytes = hexToBytes(y0Hex);
  const y1Bytes = hexToBytes(y1Hex);

  result.set(x0Bytes, 16);
  result.set(x1Bytes, 80);
  result.set(y0Bytes, 144);
  result.set(y1Bytes, 208);

  return "0x" + Buffer.from(result).toString("hex");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Decode G2 point from bytes (reverse of encode)
function decodeG2Point(bytes: string): any {
  const data = hexToBytes(bytes.slice(2)); // Remove 0x
  
  // Extract components (each 48 bytes with 16-byte padding)
  const x0Bytes = data.slice(16, 64);   // Skip first 16 bytes
  const x1Bytes = data.slice(80, 128);  // Skip padding
  const y0Bytes = data.slice(144, 192); // Skip padding  
  const y1Bytes = data.slice(208, 256); // Skip padding
  
  // Convert to bigints
  const x0 = bytesToBigInt(x0Bytes);
  const x1 = bytesToBigInt(x1Bytes);
  const y0 = bytesToBigInt(y0Bytes);
  const y1 = bytesToBigInt(y1Bytes);
  
  // Create G2 point using noble/curves
  try {
    const point = bls12_381.G2.ProjectivePoint.fromAffine({
      x: bls12_381.fields.Fp2.create({ c0: x0, c1: x1 }),
      y: bls12_381.fields.Fp2.create({ c0: y0, c1: y1 })
    });
    return point;
  } catch (error) {
    console.log("Failed to create G2 point:", error);
    return null;
  }
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

async function hashToCurveG2(message: Uint8Array): Promise<any> {
  return await bls12_381.G2.hashToCurve(message, { DST: BLS_DST });
}

async function blsVerificationTest() {
  console.log("=== BLS 签名验证测试 ===\n");

  const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20");
  const wallet = new ethers.Wallet("0xc801db57d05466a8f16d645c39f59aeb0c1aee15b3a07b4f5680d3349f094009", provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

  // 创建测试数据
  const userOp: UserOperation = {
    sender: "0x1234567890123456789012345678901234567890",
    nonce: BigInt(42),
    initCode: "0x",
    callData: "0xa9059cbb000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcdef0000000000000000000000000000000000000000000000000de0b6b3a7640000",
    callGasLimit: BigInt(21000),
    verificationGasLimit: BigInt(100000),
    preVerificationGas: BigInt(21000),
    maxFeePerGas: BigInt(2000000000),
    maxPriorityFeePerGas: BigInt(1000000000),
    paymasterAndData: "0x",
    signature: "0x",
  };

  const entryPoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
  const chainId = 11155111;

  console.log("1. 生成 UserOp Hash...");
  const userOpHash = generateUserOpHash(userOp, entryPoint, chainId);
  console.log("UserOp Hash:", userOpHash);

  // 生成测试私钥和公钥
  console.log("\n2. 生成 BLS 密钥对...");
  const privateKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const privateKeyBytes = hexToBytes(privateKey.slice(2));
  
  const publicKey = bls12_381.getPublicKey(privateKeyBytes);
  console.log("私钥:", privateKey);
  console.log("公钥:", "0x" + Buffer.from(publicKey).toString("hex"));

  // 链下 messagePoint 和签名
  console.log("\n3. 链下方法：标准 RFC 9380 hash-to-curve...");
  const messageBytes = ethers.getBytes(userOpHash);
  const offChainMessagePoint = await hashToCurveG2(messageBytes);
  const offChainEncoded = encodeG2Point(offChainMessagePoint);
  
  console.log("链下 messagePoint:", offChainEncoded.slice(0, 66) + "...");
  
  // 链下签名
  const offChainSignature = bls12_381.sign(messageBytes, privateKeyBytes);
  console.log("链下签名:", "0x" + Buffer.from(offChainSignature).toString("hex"));

  // 链下验证
  const offChainVerifyResult = bls12_381.verify(offChainSignature, messageBytes, publicKey);
  console.log("链下验证结果:", offChainVerifyResult ? "✅ 成功" : "❌ 失败");

  // 链上 messagePoint 和签名
  console.log("\n4. 链上方法：EIP-2537 预编译 hash-to-curve...");
  const [onChainSuccess, onChainResult] = await contract.hashToG2Simple(userOpHash);
  
  if (!onChainSuccess || onChainResult.length <= 2) {
    console.log("❌ 链上 messagePoint 生成失败");
    return;
  }

  console.log("链上 messagePoint:", onChainResult.slice(0, 66) + "...");

  // 尝试将链上 messagePoint 转换为可用于签名的格式
  console.log("\n5. 解析链上 messagePoint...");
  
  // 链上返回的是 512 字节，可能是不同的格式
  // 让我们尝试不同的解析方法
  
  try {
    // 方法1：假设前256字节是我们需要的G2点
    const onChainPoint256 = onChainResult.slice(0, 514); // 256 bytes + "0x"
    console.log("尝试解析前256字节...");
    
    const decodedPoint = decodeG2Point(onChainPoint256);
    if (decodedPoint) {
      console.log("✅ 成功解析链上 messagePoint");
      
      // 用解析的点进行签名
      const onChainSignature = bls12_381.sign(decodedPoint, privateKeyBytes);
      console.log("链上 messagePoint 签名:", "0x" + Buffer.from(onChainSignature).toString("hex"));
      
      // 验证签名
      const onChainVerifyResult = bls12_381.verify(onChainSignature, decodedPoint, publicKey);
      console.log("链上 messagePoint 验证结果:", onChainVerifyResult ? "✅ 成功" : "❌ 失败");
      
      // 交叉验证：用链下签名验证链上messagePoint
      const crossVerify1 = bls12_381.verify(offChainSignature, decodedPoint, publicKey);
      console.log("交叉验证1 (链下签名 + 链上messagePoint):", crossVerify1 ? "✅ 成功" : "❌ 失败");
      
      // 交叉验证：用链上签名验证链下messagePoint  
      const crossVerify2 = bls12_381.verify(onChainSignature, offChainMessagePoint, publicKey);
      console.log("交叉验证2 (链上签名 + 链下messagePoint):", crossVerify2 ? "✅ 成功" : "❌ 失败");
      
    } else {
      console.log("❌ 无法解析链上 messagePoint");
      
      // 方法2：尝试直接使用原始字节作为messagePoint
      console.log("尝试方法2：直接使用原始字节...");
      
      // 这种情况下，我们可能需要不同的验证方法
      // 或者链上格式确实不兼容链下验证
      
    }
    
  } catch (error: any) {
    console.log("❌ 解析链上 messagePoint 时出错:", error.message);
  }

  console.log("\n=== 测试总结 ===");
  console.log("1. 链下标准方法正常工作 ✅");
  console.log("2. 链上预编译方法能生成结果 ✅");
  console.log("3. 需要找到正确的链上结果解析方法 ⚠️");
  
  console.log("\n=== 下一步建议 ===");
  console.log("1. 研究链上返回的确切格式");
  console.log("2. 可能需要在合约中添加格式转换函数");
  console.log("3. 或者直接在链上完成完整的BLS验证");
}

blsVerificationTest().catch(console.error);