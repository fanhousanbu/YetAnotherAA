import { ethers } from 'ethers';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    account: "0x75815E5604317DA2b42705659e5459a7a8E58aAa"
};

async function fundAccount() {
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
    
    console.log("💰 Funding account with more ETH...");
    console.log("From:", wallet.address);
    console.log("To:", CONFIG.account);
    
    const currentBalance = await provider.getBalance(CONFIG.account);
    console.log("Current balance:", ethers.formatEther(currentBalance), "ETH");
    
    const tx = await wallet.sendTransaction({
        to: CONFIG.account,
        value: ethers.parseEther("0.05"), // 0.05 ETH should be plenty
        gasLimit: 21000,
        maxFeePerGas: ethers.parseUnits("20", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("5", "gwei")
    });
    
    console.log("Transaction sent:", tx.hash);
    await tx.wait();
    
    const newBalance = await provider.getBalance(CONFIG.account);
    console.log("New balance:", ethers.formatEther(newBalance), "ETH");
    console.log("✅ Account funded successfully!");
}

fundAccount().catch(console.error);