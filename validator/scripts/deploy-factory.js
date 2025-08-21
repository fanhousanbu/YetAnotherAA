const { ethers } = require("hardhat");

async function main() {
    console.log("开始部署 AAStarAccountFactoryV6...");
    
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("账户余额:", ethers.formatEther(balance), "ETH");
    
    // EntryPoint地址（ERC-4337标准合约）
    const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
    console.log("EntryPoint地址:", ENTRY_POINT_ADDRESS);
    
    // 部署AAStarAccountFactoryV6
    console.log("\n部署AAStarAccountFactoryV6...");
    const AAStarAccountFactoryV6 = await ethers.getContractFactory("AAStarAccountFactoryV6");
    const factory = await AAStarAccountFactoryV6.deploy(ENTRY_POINT_ADDRESS);
    
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    
    console.log("✅ AAStarAccountFactoryV6 部署成功!");
    console.log("   地址:", factoryAddress);
    
    // 验证部署
    const code = await deployer.provider.getCode(factoryAddress);
    console.log("   合约代码大小:", (code.length - 2) / 2, "字节");
    
    // 获取账户实现地址
    const implementationAddress = await factory.getImplementation();
    console.log("   账户实现地址:", implementationAddress);
    
    // 测试getAddress函数
    console.log("\n测试getAddress函数...");
    const testOwner = deployer.address;
    const aaStarValidator = "0x0bC9DD7BCa3115198a59D367423E1535104A5882";
    const salt = 1;
    
    try {
        const predictedAddress = await factory.getAddress(
            testOwner,
            aaStarValidator,
            true,
            salt
        );
        console.log("✅ getAddress调用成功!");
        console.log("   预测地址:", predictedAddress);
    } catch (error) {
        console.log("❌ getAddress调用失败:", error.message);
    }
    
    console.log("\n========================================");
    console.log("部署总结:");
    console.log("========================================");
    console.log("AAStarAccountFactoryV6:", factoryAddress);
    console.log("账户实现:", implementationAddress);
    console.log("\n请更新 .env 文件:");
    console.log(`AASTAR_ACCOUNT_FACTORY_ADDRESS=${factoryAddress}`);
    
    return factoryAddress;
}

main()
    .then((address) => {
        console.log("\n✅ 部署成功完成!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("部署失败:", error);
        process.exit(1);
    });