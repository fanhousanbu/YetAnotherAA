import { ethers } from 'ethers';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    validator: "0x0Fe448a612efD9B38287e25a208448315c2E2Df3",
    selectedNodes: [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
    ]
};

const VALIDATOR_ABI = [
    "function isRegistered(bytes32 nodeId) external view returns (bool)",
    "function getRegisteredNodeCount() external view returns (uint256)",
    "function registeredKeys(bytes32 nodeId) external view returns (bytes memory)",
    "function registeredNodes(uint256 index) external view returns (bytes32)"
];

async function checkValidatorNodes() {
    console.log("🔍 检查验证器节点注册状态");
    console.log("=".repeat(40));
    console.log("验证器地址:", CONFIG.validator);
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const validator = new ethers.Contract(CONFIG.validator, VALIDATOR_ABI, provider);
    
    try {
        const totalNodes = await validator.getRegisteredNodeCount();
        console.log("\n📊 总注册节点数:", totalNodes.toString());
        
        console.log("\n📋 检查测试用节点:");
        for (let i = 0; i < CONFIG.selectedNodes.length; i++) {
            const nodeId = CONFIG.selectedNodes[i];
            const isReg = await validator.isRegistered(nodeId);
            console.log(`节点 ${i+1}: ${isReg ? "✅" : "❌"} (${nodeId.substring(0, 10)}...)`);
            
            if (isReg) {
                try {
                    const pubKey = await validator.registeredKeys(nodeId);
                    console.log(`  公钥长度: ${pubKey.length} 字节`);
                } catch (e) {
                    console.log(`  公钥获取失败: ${e.message}`);
                }
            }
        }
        
        console.log("\n📝 所有注册的节点:");
        for (let i = 0; i < totalNodes; i++) {
            try {
                const nodeId = await validator.registeredNodes(i);
                console.log(`${i+1}. ${nodeId}`);
            } catch (e) {
                console.log(`${i+1}. 获取失败: ${e.message}`);
            }
        }
        
        const allRegistered = CONFIG.selectedNodes.every(async (nodeId) => {
            return await validator.isRegistered(nodeId);
        });
        
        console.log("\n🎯 节点注册状态:");
        if (totalNodes >= 3) {
            console.log("✅ 有足够的节点注册");
        } else {
            console.log("❌ 注册节点数量不足");
        }
        
    } catch (error) {
        console.log("❌ 检查失败:", error.message);
    }
}

checkValidatorNodes().catch(console.error);