import { ethers } from 'ethers';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    factory: "0xCA837737D80574E041a35F5395D7032E55E27D62",
    validator: "0x91Fc1Ff9646A2e5F09525837769F25c87777A07F"
};

const FACTORY_ABI = [
    "function getAddress(address owner, address validator, bool useAAStarValidator, uint256 salt) view returns (address)",
    "function createAccountWithAAStarValidator(address owner, address aaStarValidator, bool useAAStarValidator, uint256 salt) returns (address)",
    "function accountImplementation() view returns (address)"
];

async function testFactory() {
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
    const factory = new ethers.Contract(CONFIG.factory, FACTORY_ABI, wallet);
    
    console.log("Testing factory functionality...");
    console.log("Factory:", CONFIG.factory);
    console.log("Validator:", CONFIG.validator);
    console.log("Owner:", wallet.address);
    
    try {
        // Test getting implementation
        const impl = await factory.accountImplementation();
        console.log("Account implementation:", impl);
        
        // Test getting address
        const addr = await factory["getAddress(address,address,bool,uint256)"](
            wallet.address,
            CONFIG.validator,
            true,
            0
        );
        console.log("Predicted account address:", addr);
        
        // Check if account exists
        const code = await provider.getCode(addr);
        console.log("Account deployed:", code !== "0x");
        
        if (code === "0x") {
            console.log("\nAttempting to deploy account...");
            const tx = await factory.createAccountWithAAStarValidator(
                wallet.address,
                CONFIG.validator,
                true,
                0,
                { gasLimit: 1000000 }
            );
            console.log("Deploy tx:", tx.hash);
            const receipt = await tx.wait();
            console.log("Account deployed successfully!");
            console.log("Gas used:", receipt.gasUsed.toString());
        }
        
    } catch (error) {
        console.error("Error:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
    }
}

testFactory().catch(console.error);