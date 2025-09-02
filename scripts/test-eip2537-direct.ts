import { ethers } from "ethers";

async function testEIP2537Direct() {
  console.log("=== 直接测试 EIP-2537 预编译合约 ===\n");

  const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20");

  // Test MAP_FP2_TO_G2 precompile (0x11)
  console.log("测试 MAP_FP2_TO_G2 预编译合约 (0x11):");

  // Create proper input for MAP_FP2_TO_G2 according to EIP-2537
  // Input should be 128 bytes: two Fp2 elements (64 bytes each)
  // Each Fp2 element has two Fp components (48 bytes each with 16-byte padding)
  
  // Let's create the simplest possible input: all zeros
  const input = "0x" + "00".repeat(128);
  
  console.log("输入长度:", input.length - 2, "字节");
  
  try {
    const result = await provider.call({
      to: "0x11", // MAP_FP2_TO_G2
      data: input,
      gasLimit: 50000 // Set explicit gas limit
    });
    
    console.log("✅ MAP_FP2_TO_G2 调用成功!");
    console.log("返回长度:", result.length - 2, "字节");
    console.log("返回数据:", result);
    
    if (result.length - 2 === 256) {
      console.log("✅ 返回长度正确 (256 字节)");
    } else {
      console.log("❌ 返回长度不正确");
    }
    
  } catch (error: any) {
    console.log("❌ MAP_FP2_TO_G2 调用失败:", error.message);
    if (error.data) {
      console.log("错误数据:", error.data);
    }
  }

  // Test with a non-zero input to see if it works
  console.log("\n测试非零输入:");
  
  // Create a simple non-zero Fp2 element: (1, 0)
  const nonZeroInput = "0x" + 
    "00".repeat(16) + "00".repeat(47) + "01" + // Fp2.c0 = 1
    "00".repeat(64); // Fp2.c1 = 0
    
  console.log("非零输入长度:", nonZeroInput.length - 2, "字节");
  
  try {
    const result2 = await provider.call({
      to: "0x11",
      data: nonZeroInput,
      gasLimit: 50000
    });
    
    console.log("✅ 非零输入调用成功!");
    console.log("返回长度:", result2.length - 2, "字节");
    console.log("返回数据前64字节:", result2.slice(0, 66));
    
  } catch (error: any) {
    console.log("❌ 非零输入调用失败:", error.message);
  }

  // Test G2ADD precompile (0x0d)
  console.log("\n测试 G2ADD 预编译合约 (0x0d):");
  
  // G2ADD expects 512 bytes (two G2 points, 256 bytes each)
  const g2AddInput = "0x" + "00".repeat(512);
  
  try {
    const result3 = await provider.call({
      to: "0x0d",
      data: g2AddInput,
      gasLimit: 50000
    });
    
    console.log("✅ G2ADD 调用成功!");
    console.log("返回长度:", result3.length - 2, "字节");
    
  } catch (error: any) {
    console.log("❌ G2ADD 调用失败:", error.message);
  }

  // Test other precompiles to confirm they exist
  const precompiles = [
    { name: "BLS12_G1ADD", address: "0x0b", inputSize: 256 },
    { name: "BLS12_G1MSM", address: "0x0c", inputSize: 160 }, // 1 point + 1 scalar
    { name: "BLS12_G2MSM", address: "0x0e", inputSize: 288 }, // 1 G2 point + 1 scalar  
    { name: "BLS12_PAIRING_CHECK", address: "0x0f", inputSize: 384 }, // 1 G1 + 1 G2 pair
    { name: "BLS12_MAP_FP_TO_G1", address: "0x10", inputSize: 64 }
  ];

  console.log("\n测试其他预编译合约:");
  
  for (const precompile of precompiles) {
    const testInput = "0x" + "00".repeat(precompile.inputSize);
    
    try {
      const result = await provider.call({
        to: precompile.address,
        data: testInput,
        gasLimit: 50000
      });
      
      console.log(`✅ ${precompile.name} (${precompile.address}): 成功, 返回 ${result.length - 2} 字节`);
      
    } catch (error: any) {
      console.log(`❌ ${precompile.name} (${precompile.address}): 失败 - ${error.message.slice(0, 100)}...`);
    }
  }
}

testEIP2537Direct().catch(console.error);