import { ethers } from 'ethers';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20"
};

async function correctEIP2537Check() {
    console.log("🔍 Correctly checking EIP-2537 support on Sepolia");
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    
    // Test BLS12-381 G1 addition with valid input
    console.log("\n🧪 Testing BLS12_G1ADD (0x0a) with valid data...");
    
    try {
        // Valid G1 points for addition (identity + identity = identity)
        const g1Identity = "0x" + 
            "400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" + // x coord (48 bytes)
            "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";   // y coord (48 bytes)
        
        const inputData = g1Identity + g1Identity.slice(2); // Two identity points
        
        const result = await provider.call({
            to: "0x000000000000000000000000000000000000000a", // Full address format
            data: inputData,
            gasLimit: 500
        });
        
        console.log("BLS12_G1ADD result length:", result.length);
        console.log("Result:", result.slice(0, 50) + "...");
        
        if (result.length === 194) { // 0x + 96 bytes = 194 chars
            console.log("✅ BLS12_G1ADD works! EIP-2537 is supported on Sepolia");
        } else {
            console.log("❌ Unexpected result length");
        }
        
    } catch (error) {
        console.log("❌ BLS12_G1ADD failed:", error.message);
        
        if (error.message.includes("execution reverted")) {
            console.log("   This could mean invalid input data, but precompile exists");
        } else if (error.message.includes("invalid opcode") || error.message.includes("not found")) {
            console.log("   This confirms EIP-2537 is not supported");
        }
    }
    
    // Test with a different approach - check if address has code
    console.log("\n🔍 Checking precompile addresses directly...");
    
    const addresses = [
        "0x000000000000000000000000000000000000000a", // BLS12_G1ADD
        "0x000000000000000000000000000000000000000b", // BLS12_G1MUL
        "0x000000000000000000000000000000000000000c", // BLS12_G1MSM
    ];
    
    for (const addr of addresses) {
        try {
            // Try to get code at precompile address
            const code = await provider.getCode(addr);
            console.log(`${addr}: code length = ${code.length}`);
            
            // For precompiles, code might be empty but they still work
            // Try a minimal call
            const result = await provider.call({
                to: addr,
                data: "0x",
                gasLimit: 100
            });
            console.log(`${addr}: minimal call result = ${result}`);
            
        } catch (error) {
            console.log(`${addr}: error = ${error.message.substring(0, 100)}...`);
        }
    }
    
    // Check recent Sepolia hardforks
    console.log("\n📋 Checking Sepolia network status...");
    const latestBlock = await provider.getBlock("latest");
    console.log("Latest block number:", latestBlock.number);
    console.log("Block timestamp:", new Date(latestBlock.timestamp * 1000).toISOString());
    
    // Cancun upgrade on Sepolia was around block 5187023 (January 2024)
    // EIP-2537 should be active after Cancun
    if (latestBlock.number > 5200000) {
        console.log("✅ Block number suggests Cancun upgrade is active (includes EIP-2537)");
    } else {
        console.log("⚠️ Block number suggests Cancun might not be active yet");
    }
}

correctEIP2537Check().catch(console.error);