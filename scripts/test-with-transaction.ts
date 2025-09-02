import { ethers } from "ethers";

async function testWithTransaction() {
  console.log("=== 使用交易方式测试 EIP-2537 ===\n");

  const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20");
  const wallet = new ethers.Wallet("0xc801db57d05466a8f16d645c39f59aeb0c1aee15b3a07b4f5680d3349f094009", provider);

  console.log("钱包地址:", await wallet.getAddress());
  console.log("余额:", ethers.formatEther(await provider.getBalance(wallet.address)), "ETH");

  // Create a simple contract that just calls the precompile
  const testContractCode = `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.19;
    
    contract EIP2537Tester {
        function testMapFp2ToG2() external view returns (bool success, bytes memory result) {
            bytes memory input = new bytes(128); // All zeros
            (success, result) = address(0x11).staticcall(input);
        }
        
        function testMapFp2ToG2WithData(bytes memory input) external view returns (bool success, bytes memory result) {
            (success, result) = address(0x11).staticcall(input);
        }
        
        function testG2Add() external view returns (bool success, bytes memory result) {
            bytes memory input = new bytes(512); // All zeros  
            (success, result) = address(0x0d).staticcall(input);
        }
    }
  `;

  // Let's also test by sending a transaction directly to the precompile address
  console.log("1. 直接向预编译合约地址发送交易...");
  
  const precompileAddress = "0x0000000000000000000000000000000000000011"; // MAP_FP2_TO_G2
  const inputData = "0x" + "00".repeat(128);
  
  try {
    // First check if there's any code at the address
    const code = await provider.getCode(precompileAddress);
    console.log("预编译合约地址的代码长度:", code.length);
    console.log("是否有代码:", code !== "0x");
    
    // Try to estimate gas for the call
    const gasEstimate = await provider.estimateGas({
      to: precompileAddress,
      data: inputData,
      from: wallet.address
    });
    
    console.log("✅ Gas 估算成功:", gasEstimate.toString());
    
    // Now try the actual call
    const result = await provider.call({
      to: precompileAddress,
      data: inputData,
      from: wallet.address
    });
    
    console.log("✅ 预编译合约调用成功!");
    console.log("返回长度:", result.length - 2, "字节");
    console.log("返回数据前66字符:", result.slice(0, 66));
    
  } catch (error: any) {
    console.log("❌ 预编译合约调用失败:", error.message);
    console.log("错误码:", error.code);
    if (error.data) {
      console.log("错误数据:", error.data);
    }
  }

  // Test all precompile addresses with full addresses (not short form)
  console.log("\n2. 测试完整地址格式的预编译合约:");
  
  const fullAddressPrecompiles = [
    { name: "MAP_FP2_TO_G2", address: "0x0000000000000000000000000000000000000011", input: "00".repeat(128) },
    { name: "G2ADD", address: "0x000000000000000000000000000000000000000d", input: "00".repeat(512) },
    { name: "MAP_FP_TO_G1", address: "0x0000000000000000000000000000000000000010", input: "00".repeat(64) }
  ];

  for (const precompile of fullAddressPrecompiles) {
    console.log(`\n测试 ${precompile.name} at ${precompile.address}:`);
    
    try {
      const testData = "0x" + precompile.input;
      console.log(`输入长度: ${testData.length - 2} 字节`);
      
      // Check if address has code
      const code = await provider.getCode(precompile.address);
      console.log(`地址是否有代码: ${code !== "0x"}`);
      
      // Try gas estimation first
      try {
        const gasEst = await provider.estimateGas({
          to: precompile.address,
          data: testData,
          from: wallet.address
        });
        console.log(`Gas 估算: ${gasEst.toString()}`);
      } catch (gasError: any) {
        console.log(`Gas 估算失败: ${gasError.message.slice(0, 100)}...`);
      }
      
      // Try the call
      const callResult = await provider.call({
        to: precompile.address,
        data: testData,
        from: wallet.address,
        gasLimit: 100000
      });
      
      console.log(`✅ ${precompile.name} 成功!`);
      console.log(`返回长度: ${callResult.length - 2} 字节`);
      console.log(`返回数据: ${callResult.slice(0, 66)}...`);
      
    } catch (error: any) {
      console.log(`❌ ${precompile.name} 失败: ${error.message.slice(0, 100)}...`);
    }
  }
}

testWithTransaction().catch(console.error);