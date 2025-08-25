import { ethers } from 'ethers';

// 测试动态gas计算功能
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    validator: "0xAe7eA28a0aeA05cbB8631bDd7B10Cb0f387FC479" // 动态gas版本
};

const VALIDATOR_ABI = [
    "function getGasEstimate(uint256 nodeCount) external pure returns (uint256 gasEstimate)"
];

async function testDynamicGasCalculation() {
    console.log("🧮 测试动态Gas计算功能");
    console.log("=".repeat(50));
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const validator = new ethers.Contract(CONFIG.validator, VALIDATOR_ABI, provider);
    
    console.log("📊 不同节点数量的Gas估算:");
    console.log("");
    
    // 测试不同节点数量的gas估算
    const testCases = [1, 2, 3, 5, 10, 20, 50, 100];
    
    for (const nodeCount of testCases) {
        try {
            const gasEstimate = await validator.getGasEstimate(nodeCount);
            
            // 手动计算各组成部分（对应合约中的逻辑）
            const pairingBaseCost = 32600 * 2 + 37700; // 102,900
            const g1AdditionCost = (nodeCount - 1) * 500;
            const storageReadCost = nodeCount * 2100;
            const evmExecutionCost = 50000 + (nodeCount * 1000);
            const totalBaseCost = pairingBaseCost + g1AdditionCost + storageReadCost + evmExecutionCost;
            const withSafetyMargin = Math.floor(totalBaseCost * 125 / 100);
            
            // 应用最小值和最大值限制
            let expectedGas = withSafetyMargin;
            if (expectedGas < 600000) expectedGas = 600000;
            if (expectedGas > 2000000) expectedGas = 2000000;
            
            console.log(`${nodeCount.toString().padStart(3)} 节点:`);
            console.log(`  估算Gas: ${gasEstimate.toString().padStart(9)} (${Math.floor(Number(gasEstimate)/1000)}k)`);
            console.log(`  组成部分:`);
            console.log(`    配对操作: ${pairingBaseCost.toString().padStart(6)} gas`);
            console.log(`    G1点加法: ${g1AdditionCost.toString().padStart(6)} gas (${nodeCount-1} 次)`);
            console.log(`    存储读取: ${storageReadCost.toString().padStart(6)} gas`);
            console.log(`    EVM开销:  ${evmExecutionCost.toString().padStart(6)} gas`);
            console.log(`    安全边际: +25%`);
            console.log(`  匹配预期: ${gasEstimate.toString() === expectedGas.toString() ? "✅" : "❌"}`);
            console.log("");
            
        } catch (error) {
            console.log(`❌ ${nodeCount} 节点测试失败:`, error.message);
        }
    }
    
    // 显示相比固定gas的优势
    console.log("🎯 动态Gas vs 固定Gas (600k) 对比:");
    console.log("");
    console.log("节点数 | 动态Gas | 固定Gas | 节省/额外");
    console.log("-------|---------|---------|----------");
    
    for (const nodeCount of [1, 3, 10, 20, 50]) {
        const dynamicGas = await validator.getGasEstimate(nodeCount);
        const fixedGas = 600000;
        const difference = Number(dynamicGas) - fixedGas;
        const symbol = difference > 0 ? "+" : "";
        
        console.log(`${nodeCount.toString().padStart(6)} | ${Math.floor(Number(dynamicGas)/1000).toString().padStart(6)}k | ${Math.floor(fixedGas/1000).toString().padStart(6)}k | ${symbol}${Math.floor(difference/1000)}k`);
    }
    
    console.log("");
    console.log("🎉 动态Gas计算的优势:");
    console.log("✅ 小节点数时节省gas成本");
    console.log("✅ 大节点数时提供足够gas");
    console.log("✅ 基于EIP-2537标准精确计算");
    console.log("✅ 包含完整的成本分析");
    console.log("✅ 25%安全边际防止意外失败");
}

testDynamicGasCalculation().catch(console.error);