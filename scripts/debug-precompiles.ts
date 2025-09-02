import { ethers } from "ethers";

// Deployed contract address on Sepolia
const CONTRACT_ADDRESS = "0xA956143d3AD106504c043437168DB49C3D059E54";

// Extended ABI for debugging
const CONTRACT_ABI = [
  "function testPrecompiles() external view returns (bool)",
  "function mapHashToG2(bytes32 hash1, bytes32 hash2) internal view returns (bytes memory)",
  "function hashToCurveG2Simple(bytes memory message) public view returns (bytes memory)"
];

async function testPrecompileDirectly() {
  console.log("=== 直接测试 EIP-2537 预编译合约 ===\n");

  const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20");
  const wallet = new ethers.Wallet("0xc801db57d05466a8f16d645c39f59aeb0c1aee15b3a07b4f5680d3349f094009", provider);

  console.log("网络信息:");
  const network = await provider.getNetwork();
  console.log(`Chain ID: ${network.chainId}`);
  console.log(`Name: ${network.name}`);

  // Test precompile addresses directly
  const precompileAddresses = {
    "BLS12_G1ADD": "0x0b",
    "BLS12_G1MSM": "0x0c", 
    "BLS12_G2ADD": "0x0d",
    "BLS12_G2MSM": "0x0e",
    "BLS12_PAIRING_CHECK": "0x0f",
    "BLS12_MAP_FP_TO_G1": "0x10",
    "BLS12_MAP_FP2_TO_G2": "0x11"
  };

  console.log("\n检查预编译合约地址:");
  for (const [name, address] of Object.entries(precompileAddresses)) {
    try {
      const code = await provider.getCode(address);
      console.log(`${name} (${address}): ${code.length > 2 ? "有代码" : "无代码"}`);
    } catch (error) {
      console.log(`${name} (${address}): 检查失败`);
    }
  }

  // Test MAP_FP2_TO_G2 directly with minimal input
  console.log("\n直接测试 MAP_FP2_TO_G2 预编译合约:");
  const mapFp2ToG2Address = "0x11";
  
  // Create minimal valid Fp2 input (128 bytes of zeros)
  const minimalInput = "0x" + "00".repeat(128);
  
  try {
    console.log("测试输入长度:", minimalInput.length - 2, "字节");
    
    // Try to call the precompile directly
    const result = await provider.call({
      to: mapFp2ToG2Address,
      data: minimalInput
    });
    
    console.log("预编译合约调用成功!");
    console.log("返回长度:", result.length - 2, "字节");
    console.log("返回数据:", result.slice(0, 66) + "...");
    
  } catch (error: any) {
    console.log("预编译合约调用失败:", error.message);
  }

  // Test our contract's testPrecompiles function
  console.log("\n测试合约的 testPrecompiles 函数:");
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
  
  try {
    const result = await contract.testPrecompiles();
    console.log("testPrecompiles() 结果:", result);
    
    // Get the transaction to see what it actually does
    const tx = await contract.testPrecompiles.populateTransaction();
    console.log("调用数据:", tx.data);
    
  } catch (error: any) {
    console.log("testPrecompiles() 失败:", error.message);
  }

  // Test with very simple message
  console.log("\n测试简单消息的 hash-to-curve:");
  try {
    const simpleMessage = ethers.getBytes("0x00");
    const result = await contract.hashToCurveG2Simple(simpleMessage);
    console.log("简单消息测试成功, 结果长度:", result.length);
  } catch (error: any) {
    console.log("简单消息测试失败:", error.message);
  }
}

async function checkNetworkSupport() {
  console.log("\n=== 检查网络 EIP-2537 支持状态 ===");
  
  const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20");
  
  // Check latest block to see if we're post-Pectra
  const latestBlock = await provider.getBlock("latest");
  console.log("最新区块:", latestBlock?.number);
  console.log("区块时间:", new Date((latestBlock?.timestamp || 0) * 1000).toISOString());
  
  // The Pectra upgrade should activate around May 7, 2025
  // But since this is January 2025, it might not be active yet
  const pectarActivationTimestamp = new Date("2025-05-07T10:05:11Z").getTime() / 1000;
  const currentTimestamp = latestBlock?.timestamp || 0;
  
  console.log("Pectra 激活时间:", new Date(pectarActivationTimestamp * 1000).toISOString());
  console.log("当前时间:", new Date(currentTimestamp * 1000).toISOString());
  console.log("EIP-2537 应该已激活:", currentTimestamp >= pectarActivationTimestamp);
}

async function main() {
  await checkNetworkSupport();
  await testPrecompileDirectly();
}

main().catch(console.error);