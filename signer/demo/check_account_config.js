import { ethers } from 'ethers';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    // 最新创建的账户地址
    account: "0x18d9066EA77558c71286b84FcBbA924077F9E24e",
    // gas修复版本的验证器
    newValidator: "0x0Fe448a612efD9B38287e25a208448315c2E2Df3",
    owner: "0x075F227E25a63417Bf66F6e751b376B09Fd43928"
};

const ACCOUNT_ABI = [
    "function getValidationConfig() external view returns (address validator, bool isAAStarEnabled, address accountOwner)",
    "function owner() external view returns (address)",
    "function aaStarValidator() external view returns (address)",
    "function useAAStarValidator() external view returns (bool)"
];

async function checkConfig() {
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const account = new ethers.Contract(CONFIG.account, ACCOUNT_ABI, provider);
    
    console.log("🔍 Checking account configuration...");
    console.log("Account:", CONFIG.account);
    
    try {
        // Get validation config
        const config = await account.getValidationConfig();
        console.log("\n📋 Validation Configuration:");
        console.log("  Validator:", config.validator);
        console.log("  Expected:", CONFIG.newValidator);
        console.log("  Match:", config.validator.toLowerCase() === CONFIG.newValidator.toLowerCase() ? "✅" : "❌");
        console.log("  AAStarEnabled:", config.isAAStarEnabled);
        console.log("  Account Owner:", config.accountOwner);
        console.log("  Expected Owner:", CONFIG.owner);
        console.log("  Owner Match:", config.accountOwner.toLowerCase() === CONFIG.owner.toLowerCase() ? "✅" : "❌");
        
        // Try direct getters
        try {
            const owner = await account.owner();
            console.log("\n📌 Direct Getters:");
            console.log("  owner():", owner);
        } catch (e) {
            console.log("  owner(): Not available");
        }
        
        try {
            const validator = await account.aaStarValidator();
            console.log("  aaStarValidator():", validator);
        } catch (e) {
            console.log("  aaStarValidator(): Not available");
        }
        
        try {
            const useValidator = await account.useAAStarValidator();
            console.log("  useAAStarValidator():", useValidator);
        } catch (e) {
            console.log("  useAAStarValidator(): Not available");
        }
        
        // Summary
        console.log("\n📊 Summary:");
        if (config.isAAStarEnabled && 
            config.validator.toLowerCase() === CONFIG.newValidator.toLowerCase() &&
            config.accountOwner.toLowerCase() === CONFIG.owner.toLowerCase()) {
            console.log("✅ Account is correctly configured for BLS validation");
        } else {
            console.log("❌ Account configuration issues detected");
            if (!config.isAAStarEnabled) {
                console.log("  - AAStarValidator is not enabled");
            }
            if (config.validator.toLowerCase() !== CONFIG.newValidator.toLowerCase()) {
                console.log("  - Validator address mismatch");
            }
            if (config.accountOwner.toLowerCase() !== CONFIG.owner.toLowerCase()) {
                console.log("  - Owner address mismatch");
            }
        }
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

checkConfig().catch(console.error);