import { ethers } from "ethers";

const SIMPLE_CONTRACT_ADDRESS = "0x11ca946e52aB8054Ea4478346Dd9732bccA52513";
const SIMPLE_CONTRACT_ABI = [
  "function testZeroInput() external view returns (bool success, uint256 resultLength, bytes memory result)",
  "function testCustomInput(bytes memory input) external view returns (bool success, uint256 resultLength, bytes memory result)",
  "function createSimpleFp2(bytes32 hash) external pure returns (bytes memory)",
  "function hashToG2Simple(bytes32 userOpHash) external view returns (bool success, bytes memory result)"
];

async function testSimpleContract() {
  console.log("=== 测试简单合约 ===\n");

  const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20");
  const wallet = new ethers.Wallet("0xc801db57d05466a8f16d645c39f59aeb0c1aee15b3a07b4f5680d3349f094009", provider);
  const contract = new ethers.Contract(SIMPLE_CONTRACT_ADDRESS, SIMPLE_CONTRACT_ABI, wallet);

  console.log("合约地址:", SIMPLE_CONTRACT_ADDRESS);

  // Test 1: Zero input
  console.log("\n1. 测试零输入:");
  try {
    const [success, resultLength, result] = await contract.testZeroInput();
    console.log("成功:", success);
    console.log("结果长度:", resultLength.toString());
    console.log("结果数据:", result);
    
    if (success && resultLength > 0) {
      console.log("✅ 零输入测试成功");
    } else {
      console.log("⚠️ 零输入返回空结果");
    }
  } catch (error: any) {
    console.log("❌ 零输入测试失败:", error.message);
  }

  // Compare with direct call
  console.log("\n2. 直接调用预编译合约对比:");
  const MAP_FP2_TO_G2 = "0x0000000000000000000000000000000000000011";
  const zeroInput = "0x" + "00".repeat(128);
  
  try {
    const directResult = await provider.call({
      to: MAP_FP2_TO_G2,
      data: zeroInput,
      from: wallet.address
    });
    
    console.log("直接调用成功");
    console.log("返回长度:", directResult.length - 2, "字节");
    console.log("返回数据前66字符:", directResult.slice(0, 66));
    
    console.log("🤔 合约调用与直接调用结果不一致！");
    
  } catch (error: any) {
    console.log("❌ 直接调用失败:", error.message);
  }

  // Test 2: Custom input
  console.log("\n3. 测试自定义输入:");
  
  // Create the same input that works in direct call
  const workingInput = zeroInput;
  
  try {
    const [success, resultLength, result] = await contract.testCustomInput(workingInput);
    console.log("自定义输入成功:", success);
    console.log("结果长度:", resultLength.toString());
    
    if (success && resultLength > 0) {
      console.log("✅ 自定义输入测试成功");
      console.log("结果数据:", result.slice(0, 66) + "...");
    } else {
      console.log("⚠️ 自定义输入返回空结果");
    }
  } catch (error: any) {
    console.log("❌ 自定义输入测试失败:", error.message);
  }

  // Test 3: UserOp hash
  console.log("\n4. 测试 UserOp 哈希:");
  const userOpHash = "0x7970c13dcd8651528866f649abfe94af364ceac8b8532ef5b02f728a7b03451b";
  
  try {
    const [success, result] = await contract.hashToG2Simple(userOpHash);
    console.log("UserOp 哈希成功:", success);
    console.log("结果长度:", result.length);
    
    if (success && result.length > 2) {
      console.log("✅ UserOp 哈希测试成功");
      console.log("结果数据:", result.slice(0, 66) + "...");
    } else {
      console.log("⚠️ UserOp 哈希返回空结果");
    }
  } catch (error: any) {
    console.log("❌ UserOp 哈希测试失败:", error.message);
  }

  // Test 4: Create Fp2 element
  console.log("\n5. 测试 Fp2 元素创建:");
  
  try {
    const fp2Element = await contract.createSimpleFp2(userOpHash);
    console.log("创建 Fp2 成功");
    console.log("Fp2 长度:", fp2Element.length - 2, "字节");
    console.log("Fp2 数据:", fp2Element.slice(0, 66) + "...");
    
    // Now test this with direct precompile call
    const directWithFp2 = await provider.call({
      to: MAP_FP2_TO_G2,
      data: fp2Element,
      from: wallet.address
    });
    
    console.log("使用创建的 Fp2 直接调用:");
    console.log("成功返回长度:", directWithFp2.length - 2, "字节");
    
    if (directWithFp2.length > 2) {
      console.log("✅ 创建的 Fp2 元素有效");
    }
    
  } catch (error: any) {
    console.log("❌ Fp2 元素测试失败:", error.message);
  }
}

testSimpleContract().catch(console.error);