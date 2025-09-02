import { ethers } from "ethers";
import { bls12_381 } from "@noble/curves/bls12-381";

const BLS_DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";
const FIXED_CONTRACT_ADDRESS = "0x87770210e354a26F76b51dfafc04368db3a3F807";

const FIXED_CONTRACT_ABI = [
  "function hashUserOpToG2(bytes32 userOpHash) external view returns (bytes memory)",
  "function testPrecompiles() external view returns (bool)",
  "function debugMapFp2ToG2(bytes32 hash1, bytes32 hash2) external view returns (bytes memory)",
  "function rawPrecompileCall(bytes memory fp2Input) external view returns (bool success, bytes memory result)",
  "function createFp2Element(bytes32 hash1, bytes32 hash2) internal pure returns (bytes memory)"
];

async function testFixedContract() {
  console.log("=== 测试修复后的合约 ===\n");

  const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20");
  const wallet = new ethers.Wallet("0xc801db57d05466a8f16d645c39f59aeb0c1aee15b3a07b4f5680d3349f094009", provider);
  const contract = new ethers.Contract(FIXED_CONTRACT_ADDRESS, FIXED_CONTRACT_ABI, wallet);

  console.log("合约地址:", FIXED_CONTRACT_ADDRESS);

  // First, let's test the raw precompile call
  console.log("\n1. 测试原始预编译调用:");
  
  // Create a simple 128-byte input (all zeros)
  const simpleInput = "0x" + "00".repeat(128);
  
  try {
    const [success, result] = await contract.rawPrecompileCall(simpleInput);
    console.log("原始调用成功:", success);
    console.log("返回长度:", result.length - 2, "字节");
    console.log("返回数据前66字符:", result.slice(0, 66));
    
    if (success) {
      console.log("✅ 预编译合约工作正常, 返回", result.length - 2, "字节");
    }
    
  } catch (error: any) {
    console.log("❌ 原始调用失败:", error.message);
  }

  // Test with specific hash values
  console.log("\n2. 测试特定哈希值:");
  
  const testHash1 = "0x7970c13dcd8651528866f649abfe94af364ceac8b8532ef5b02f728a7b03451b";
  const testHash2 = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  
  try {
    const debugResult = await contract.debugMapFp2ToG2(testHash1, testHash2);
    console.log("Debug 调用成功!");
    console.log("结果长度:", debugResult.length - 2, "字节");
    console.log("结果数据:", debugResult.slice(0, 66) + "...");
    
  } catch (error: any) {
    console.log("❌ Debug 调用失败:", error.message);
  }

  // Now let's understand the exact format issue
  console.log("\n3. 分析实际返回格式:");
  
  // Call precompile directly with ethers to see raw result
  const MAP_FP2_TO_G2 = "0x0000000000000000000000000000000000000011";
  
  try {
    const directResult = await provider.call({
      to: MAP_FP2_TO_G2,
      data: simpleInput,
      from: wallet.address
    });
    
    console.log("直接调用预编译结果:");
    console.log("长度:", directResult.length - 2, "字节");
    console.log("前128字符:", directResult.slice(0, 130));
    
    // Based on this, we need to update our contract expectation
    console.log("\n我们需要修改合约以接受", directResult.length - 2, "字节的返回值");
    
  } catch (error: any) {
    console.log("❌ 直接调用失败:", error.message);
  }

  // Compare with off-chain calculation
  console.log("\n4. 对比链下计算:");
  
  const userOpHash = "0x7970c13dcd8651528866f649abfe94af364ceac8b8532ef5b02f728a7b03451b";
  const messageBytes = ethers.getBytes(userOpHash);
  
  try {
    const messagePoint = await bls12_381.G2.hashToCurve(messageBytes, { DST: BLS_DST });
    const encodedPoint = encodeG2Point(messagePoint);
    
    console.log("链下 messagePoint:");
    console.log("长度:", encodedPoint.length - 2, "字节");
    console.log("数据:", encodedPoint.slice(0, 66) + "...");
    
  } catch (error: any) {
    console.log("❌ 链下计算失败:", error.message);
  }
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

testFixedContract().catch(console.error);