import { ethers } from 'ethers';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    account: "0x75815E5604317DA2b42705659e5459a7a8E58aAa",
    validator: "0x91Fc1Ff9646A2e5F09525837769F25c87777A07F"
};

const ACCOUNT_ABI = [
    "function owner() external view returns (address)",
    "function aaStarValidator() external view returns (address)",  
    "function useAAStarValidator() external view returns (bool)",
    "function getValidationConfig() external view returns (address validator, bool isAAStarEnabled, address accountOwner)",
    "function initialize(address anOwner, address _aaStarValidator, bool _useAAStarValidator) external"
];

const VALIDATOR_ABI = [
    "function isRegistered(bytes32 nodeId) external view returns (bool)",
    "function getRegisteredNodeCount() external view returns (uint256)"
];

async function debugAccountState() {
    console.log("🔍 Debugging account state...");
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const account = new ethers.Contract(CONFIG.account, ACCOUNT_ABI, provider);
    const validator = new ethers.Contract(CONFIG.validator, VALIDATOR_ABI, provider);
    
    console.log("Account:", CONFIG.account);
    console.log("Validator:", CONFIG.validator);
    
    try {
        // Check if account is initialized
        console.log("\n📋 Account Configuration:");
        
        const config = await account.getValidationConfig();
        console.log("  Validator:", config.validator);
        console.log("  AAStarEnabled:", config.isAAStarEnabled);
        console.log("  Account Owner:", config.accountOwner);
        
        const owner = await account.owner();
        console.log("  Direct owner():", owner);
        
        // Check validator state
        console.log("\n📊 Validator State:");
        const nodeCount = await validator.getRegisteredNodeCount();
        console.log("  Registered nodes:", nodeCount.toString());
        
        // Check specific nodes
        const nodeIds = [
            "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
            "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
            "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
        ];
        
        for (let i = 0; i < nodeIds.length; i++) {
            const isReg = await validator.isRegistered(nodeIds[i]);
            console.log(`  Node ${i+1} registered:`, isReg);
        }
        
        // Check account code
        console.log("\n🔧 Account Code:");
        const code = await provider.getCode(CONFIG.account);
        console.log("  Has code:", code !== "0x");
        console.log("  Code length:", code.length);
        
        if (code === "0x") {
            console.log("❌ Account is not deployed!");
        } else {
            console.log("✅ Account is deployed");
        }
        
        // Check balance
        const balance = await provider.getBalance(CONFIG.account);
        console.log("\n💰 Account Balance:");
        console.log("  Balance:", ethers.formatEther(balance), "ETH");
        
        if (balance < ethers.parseEther("0.002")) {
            console.log("⚠️  Balance may be insufficient for gas fees");
        } else {
            console.log("✅ Balance should be sufficient");
        }
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

debugAccountState().catch(console.error);