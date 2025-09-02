import { ethers } from "ethers";

async function analyzeFormat() {
  console.log("=== 分析 EIP-2537 输入输出格式 ===\n");

  const provider = new ethers.JsonRpcProvider(
    "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20"
  );
  const wallet = new ethers.Wallet(
    "0xc801db57d05466a8f16d645c39f59aeb0c1aee15b3a07b4f5680d3349f094009",
    provider
  );

  const MAP_FP2_TO_G2 = "0x0000000000000000000000000000000000000011";

  console.log("1. 测试正确的输入格式:");

  // According to EIP-2537, input should be 128 bytes:
  // - 64 bytes for Fp element c0 (16 zero bytes + 48 bytes value)
  // - 64 bytes for Fp element c1 (16 zero bytes + 48 bytes value)

  // Let's create a proper Fp2 element: (1, 0)
  const c0 = "0x" + "00".repeat(16) + "00".repeat(47) + "01"; // Fp element = 1
  const c1 = "0x" + "00".repeat(64); // Fp element = 0
  const properInput = c0.slice(2) + c1.slice(2); // Remove 0x prefix
  const fullInput = "0x" + properInput;

  console.log("输入格式分析:");
  console.log("c0 (64 bytes):", c0);
  console.log("c1 (64 bytes):", c1);
  console.log("完整输入长度:", fullInput.length - 2, "字节");
  console.log("输入数据:", fullInput.slice(0, 66) + "...");

  try {
    const result = await provider.call({
      to: MAP_FP2_TO_G2,
      data: fullInput,
      from: wallet.address,
      gasLimit: 50000,
    });

    console.log("\n✅ MAP_FP2_TO_G2 调用成功!");
    console.log("输出长度:", result.length - 2, "字节");
    console.log("输出数据:", result.slice(0, 66) + "...");

    // Parse the output according to EIP-2537 format
    if (result.length - 2 === 256) {
      console.log("\n输出格式分析 (256 字节 G2 点):");

      // G2 point format: x || y where x,y are Fp2 elements (128 bytes each)
      // Each Fp2 element: c0 || c1 where c0,c1 are Fp elements (64 bytes each)

      const x_c0 = result.slice(2, 2 + 128); // First 64 bytes
      const x_c1 = result.slice(2 + 128, 2 + 256); // Next 64 bytes
      const y_c0 = result.slice(2 + 256, 2 + 384); // Next 64 bytes
      const y_c1 = result.slice(2 + 384, 2 + 512); // Last 64 bytes

      console.log("x.c0:", "0x" + x_c0);
      console.log("x.c1:", "0x" + x_c1);
      console.log("y.c0:", "0x" + y_c0);
      console.log("y.c1:", "0x" + y_c1);
    } else if (result.length - 2 === 512) {
      console.log("\n⚠️ 输出长度为 512 字节 - 这不符合 EIP-2537 规范");
      console.log("可能的原因: 网络实现差异或规范版本不同");
    }
  } catch (error: any) {
    console.log("❌ 调用失败:", error.message);
  }

  // Test with different inputs
  console.log("\n2. 测试不同的输入值:");

  const testCases = [
    {
      name: "零元素 (0, 0)",
      c0: "00".repeat(64),
      c1: "00".repeat(64),
    },
    {
      name: "单位元素 (1, 0)",
      c0: "00".repeat(16) + "00".repeat(47) + "01",
      c1: "00".repeat(64),
    },
    {
      name: "另一个元素 (2, 1)",
      c0: "00".repeat(16) + "00".repeat(47) + "02",
      c1: "00".repeat(16) + "00".repeat(47) + "01",
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n测试: ${testCase.name}`);
    const testInput = "0x" + testCase.c0 + testCase.c1;

    try {
      const result = await provider.call({
        to: MAP_FP2_TO_G2,
        data: testInput,
        from: wallet.address,
      });

      console.log(`✅ 成功, 输出长度: ${result.length - 2} 字节`);
      console.log(`输出前16字节: ${result.slice(0, 34)}`);
    } catch (error: any) {
      console.log(`❌ 失败: ${error.message.slice(0, 50)}...`);
    }
  }
}

analyzeFormat().catch(console.error);
