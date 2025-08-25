import { ethers } from 'ethers';

// 给账户充值更多ETH并重新测试
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    account: "0x18d9066EA77558c71286b84FcBbA924077F9E24e"
};

async function fundAccount() {
    console.log("💰 给账户充值更多ETH");
    console.log("=".repeat(30));
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
    
    // 检查当前余额
    const currentBalance = await provider.getBalance(CONFIG.account);
    console.log("当前账户余额:", ethers.formatEther(currentBalance), "ETH");
    
    // 充值0.1 ETH
    console.log("充值 0.1 ETH...");
    const tx = await wallet.sendTransaction({
        to: CONFIG.account,
        value: ethers.parseEther("0.1"),
        maxFeePerGas: ethers.parseUnits("50", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("10", "gwei")
    });
    
    console.log("充值交易:", tx.hash);
    await tx.wait();
    
    // 检查充值后余额
    const newBalance = await provider.getBalance(CONFIG.account);
    console.log("充值后余额:", ethers.formatEther(newBalance), "ETH");
    
    console.log("✅ 充值完成，现在重新运行转账测试");
}

fundAccount().catch(console.error);