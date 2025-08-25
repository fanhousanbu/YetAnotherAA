import { ethers } from 'ethers';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20"
};

async function checkEIP2537Support() {
    console.log("🔍 Checking EIP-2537 (BLS12-381 precompiles) support on Sepolia");
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    
    // EIP-2537 precompile addresses
    const precompiles = {
        "0x0a": "BLS12_G1ADD",
        "0x0b": "BLS12_G1MUL", 
        "0x0c": "BLS12_G1MSM",
        "0x0d": "BLS12_G2ADD",
        "0x0e": "BLS12_G2MUL",
        "0x0f": "BLS12_G2MSM",
        "0x10": "BLS12_PAIRING_CHECK",
        "0x11": "BLS12_MAP_FP_TO_G1",
        "0x12": "BLS12_MAP_FP2_TO_G2"
    };
    
    console.log("\nChecking precompile addresses:");
    
    for (const [address, name] of Object.entries(precompiles)) {
        try {
            const code = await provider.getCode(address);
            const exists = code !== "0x";
            console.log(`${address} (${name}):`, exists ? "✅ EXISTS" : "❌ NOT FOUND");
        } catch (error) {
            console.log(`${address} (${name}): ❌ ERROR -`, error.message);
        }
    }
    
    // Test a simple BLS operation
    console.log("\n🧪 Testing BLS operations...");
    
    try {
        // Try to call BLS12_G1ADD precompile with dummy data
        const dummyData = "0x" + "00".repeat(256); // 256 bytes of zeros
        
        const tx = {
            to: "0x0a", // BLS12_G1ADD
            data: dummyData,
            gasLimit: 150
        };
        
        const result = await provider.call(tx);
        console.log("BLS12_G1ADD test result:", result !== "0x" ? "✅ WORKS" : "❌ FAILED");
    } catch (error) {
        console.log("BLS12_G1ADD test: ❌ FAILED -", error.message);
        
        if (error.message.includes("execution reverted")) {
            console.log("   (This might be expected with dummy data)");
        }
    }
    
    // Check network info
    console.log("\n📋 Network Information:");
    const network = await provider.getNetwork();
    console.log("Chain ID:", network.chainId.toString());
    console.log("Network name:", network.name);
    
    const block = await provider.getBlock("latest");
    console.log("Latest block:", block.number);
    console.log("Block timestamp:", new Date(block.timestamp * 1000).toISOString());
    
    console.log("\n💡 Analysis:");
    console.log("If BLS precompiles are not supported on Sepolia, this explains why");
    console.log("BLS verification fails in simulateValidation even though our logic is correct.");
    console.log("\nPossible solutions:");
    console.log("1. Test on Ethereum Mainnet (EIP-2537 activated)");
    console.log("2. Test on Holesky testnet (should support EIP-2537)");
    console.log("3. Use a local network with EIP-2537 enabled");
}

checkEIP2537Support().catch(console.error);