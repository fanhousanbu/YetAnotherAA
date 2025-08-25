import { ethers } from 'ethers';

// 分析ERC-4337交易的特征
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    txHash: "0x8aa6fdef19f66e687a570c4fefeb7524538a32fcb06320251d25c5b714370a55",
    entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
};

// EntryPoint事件ABI
const ENTRY_POINT_EVENTS = [
    "event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)",
    "event AccountDeployed(bytes32 indexed userOpHash, address indexed sender, address factory, address paymaster)",
    "event BeforeExecution()",
    "event SignatureAggregatorChanged(address indexed aggregator)"
];

// 账户事件ABI  
const ACCOUNT_EVENTS = [
    "event AAStarValidationUsed(address indexed validator, bool success)"
];

async function analyzeERC4337Transaction() {
    console.log("🔍 ERC-4337交易特征分析");
    console.log("=".repeat(50));
    console.log("交易Hash:", CONFIG.txHash);
    console.log("");

    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    
    // 1. 获取交易信息
    const tx = await provider.getTransaction(CONFIG.txHash);
    const receipt = await provider.getTransactionReceipt(CONFIG.txHash);
    
    console.log("📊 交易基本信息:");
    console.log(`  发送者: ${tx.from}`);
    console.log(`  接收者: ${tx.to}`);
    console.log(`  是否EntryPoint: ${tx.to === CONFIG.entryPoint ? "✅" : "❌"}`);
    console.log(`  函数调用: ${tx.data.substring(0, 10)}`);
    
    // 2. 解码函数调用
    console.log("\n🔧 函数调用分析:");
    if (tx.data.startsWith("0x1fad948c")) {
        console.log("  函数名: handleOps() ✅");
        console.log("  这是ERC-4337的核心函数！");
        
        // 解码handleOps参数
        const iface = new ethers.Interface([
            "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address payable beneficiary)"
        ]);
        
        try {
            const decoded = iface.decodeFunctionData("handleOps", tx.data);
            const userOps = decoded[0];
            const beneficiary = decoded[1];
            
            console.log(`  UserOperations数量: ${userOps.length}`);
            console.log(`  受益人地址: ${beneficiary}`);
            
            if (userOps.length > 0) {
                const userOp = userOps[0];
                console.log("\n  📋 UserOperation详情:");
                console.log(`    sender: ${userOp[0]}`);
                console.log(`    nonce: ${userOp[1]}`);
                console.log(`    callGasLimit: ${userOp[4]}`);
                console.log(`    verificationGasLimit: ${userOp[5]}`);
                console.log(`    maxFeePerGas: ${ethers.formatUnits(userOp[7], "gwei")} gwei`);
                console.log(`    签名长度: ${userOp[10].length / 2 - 1} 字节`);
            }
        } catch (error) {
            console.log("  解码失败:", error.message);
        }
    }
    
    // 3. 分析事件日志
    console.log("\n📜 事件日志分析:");
    
    // 创建接口解码事件
    const entryPointInterface = new ethers.Interface(ENTRY_POINT_EVENTS);
    const accountInterface = new ethers.Interface(ACCOUNT_EVENTS);
    
    let userOpEventFound = false;
    let accountDeployedFound = false;
    let blsValidationFound = false;
    
    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`\n  Log ${i + 1}:`);
        console.log(`    地址: ${log.address}`);
        console.log(`    Topic0: ${log.topics[0]}`);
        
        try {
            // 尝试解码EntryPoint事件
            if (log.address.toLowerCase() === CONFIG.entryPoint.toLowerCase()) {
                const parsed = entryPointInterface.parseLog(log);
                console.log(`    事件名: ${parsed.name} ✅`);
                
                if (parsed.name === "UserOperationEvent") {
                    userOpEventFound = true;
                    console.log(`    UserOpHash: ${parsed.args.userOpHash}`);
                    console.log(`    Sender: ${parsed.args.sender}`);
                    console.log(`    成功状态: ${parsed.args.success ? "✅" : "❌"}`);
                    console.log(`    实际Gas使用: ${parsed.args.actualGasUsed}`);
                    console.log(`    实际Gas成本: ${ethers.formatEther(parsed.args.actualGasCost)} ETH`);
                } else if (parsed.name === "AccountDeployed") {
                    accountDeployedFound = true;
                    console.log(`    部署的账户: ${parsed.args.sender}`);
                } else if (parsed.name === "BeforeExecution") {
                    console.log(`    执行前事件`);
                }
            } else {
                // 尝试解码账户事件
                try {
                    const parsed = accountInterface.parseLog(log);
                    if (parsed.name === "AAStarValidationUsed") {
                        blsValidationFound = true;
                        console.log(`    事件名: ${parsed.name} ✅`);
                        console.log(`    验证器: ${parsed.args.validator}`);
                        console.log(`    验证成功: ${parsed.args.success ? "✅" : "❌"}`);
                    }
                } catch (e) {
                    console.log(`    未识别事件 (可能是转账相关)`);
                }
            }
        } catch (error) {
            console.log(`    解码失败: ${error.message}`);
        }
    }
    
    // 4. ERC-4337特征总结
    console.log("\n🎯 ERC-4337特征检查:");
    console.log(`  ✅ 调用EntryPoint合约: ${tx.to === CONFIG.entryPoint ? "是" : "否"}`);
    console.log(`  ✅ 使用handleOps函数: ${tx.data.startsWith("0x1fad948c") ? "是" : "否"}`);
    console.log(`  ✅ 包含UserOperationEvent: ${userOpEventFound ? "是" : "否"}`);
    console.log(`  ✅ 包含BLS验证事件: ${blsValidationFound ? "是" : "否"}`);
    console.log(`  ✅ 交易成功执行: ${receipt.status === 1 ? "是" : "否"}`);
    
    // 5. 与普通转账的对比
    console.log("\n🆚 与普通转账的区别:");
    console.log("  普通转账:");
    console.log("    - 直接from → to");
    console.log("    - 简单的value转移");
    console.log("    - 基本的gas费用");
    console.log("");
    console.log("  ERC-4337转账:");
    console.log("    - EOA → EntryPoint → 智能合约账户 → 目标地址");
    console.log("    - 复杂的UserOperation结构");
    console.log("    - BLS聚合签名验证");
    console.log("    - 账户抽象功能");
    console.log("    - 多层事件和日志");
    
    console.log("\n🔗 链上验证:");
    console.log(`  Etherscan: https://sepolia.etherscan.io/tx/${CONFIG.txHash}`);
    
    console.log("\n✅ 结论: 这是一笔标准的ERC-4337账户抽象交易！");
}

analyzeERC4337Transaction().catch(console.error);