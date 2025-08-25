import { ethers } from 'ethers';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    account: "0x75815E5604317DA2b42705659e5459a7a8E58aAa"
};

async function fundAndTest() {
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
    
    console.log("💰 Checking and funding account...");
    
    const currentBalance = await provider.getBalance(CONFIG.account);
    console.log("Current balance:", ethers.formatEther(currentBalance), "ETH");
    
    const requiredBalance = ethers.parseEther("0.01"); // 0.01 ETH should be enough for 0.0043 prefund
    
    if (currentBalance < requiredBalance) {
        console.log("Adding more funds...");
        
        // Send from owner directly - this should work
        const tx = await wallet.sendTransaction({
            to: CONFIG.account,
            value: ethers.parseEther("0.02"), // Send 0.02 ETH
            gasLimit: 21000,
            maxFeePerGas: ethers.parseUnits("10", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("2", "gwei")
        });
        
        console.log("Funding tx sent:", tx.hash);
        await tx.wait();
        console.log("✅ Funding completed");
    }
    
    const newBalance = await provider.getBalance(CONFIG.account);
    console.log("New balance:", ethers.formatEther(newBalance), "ETH");
    
    if (newBalance >= ethers.parseEther("0.008")) {
        console.log("✅ Account has sufficient balance for BLS operations");
        console.log("Ready to retry the test!");
    } else {
        console.log("❌ Still insufficient balance");
    }
}

fundAndTest().catch(console.error);