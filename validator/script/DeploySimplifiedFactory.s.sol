// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AAStarAccountFactoryV6_Simplified.sol";

contract DeploySimplifiedFactory is Script {
    function run() external {
        // EntryPoint地址（ERC-4337标准合约）
        address ENTRY_POINT_ADDRESS = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
        
        // AAStarValidator地址（已部署）
        address AASTAR_VALIDATOR_ADDRESS = 0x0bC9DD7BCa3115198a59D367423E1535104A5882;
        
        console.log("========================================");
        console.log("Deploying AAStarAccountFactoryV6_Simplified");
        console.log("========================================");
        console.log("EntryPoint:", ENTRY_POINT_ADDRESS);
        console.log("AAStarValidator:", AASTAR_VALIDATOR_ADDRESS);
        
        // 获取部署者地址
        address deployer = msg.sender;
        console.log("Deployer:", deployer);
        
        vm.startBroadcast();
        
        // 部署简化版工厂合约
        AAStarAccountFactoryV6_Simplified factory = new AAStarAccountFactoryV6_Simplified(
            IEntryPoint(ENTRY_POINT_ADDRESS)
        );
        
        address factoryAddress = address(factory);
        console.log("\nSimplified Factory deployed at:", factoryAddress);
        
        // 获取实现地址
        address implementation = factory.getImplementation();
        console.log("Account implementation:", implementation);
        
        // 测试getAddress函数
        console.log("\nTesting getAddress function...");
        address predictedAddress = factory.getAddress(
            deployer,
            AASTAR_VALIDATOR_ADDRESS,
            true,
            1
        );
        console.log("Predicted address for salt=1:", predictedAddress);
        
        vm.stopBroadcast();
        
        console.log("\n========================================");
        console.log("Deployment Summary");
        console.log("========================================");
        console.log("AAStarAccountFactoryV6_Simplified:", factoryAddress);
        console.log("Account Implementation:", implementation);
        console.log("\nUpdate your .env file:");
        console.log(string.concat("SIMPLIFIED_FACTORY_ADDRESS=", vm.toString(factoryAddress)));
    }
}