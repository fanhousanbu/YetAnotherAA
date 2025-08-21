// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AAStarAccountV6_Simplified.sol";

contract DeploySimplifiedAccount is Script {
    function run() external {
        // EntryPoint地址（ERC-4337标准合约）
        address ENTRY_POINT_ADDRESS = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
        
        console.log("========================================");
        console.log("Deploying AAStarAccountV6_Simplified");
        console.log("========================================");
        console.log("EntryPoint:", ENTRY_POINT_ADDRESS);
        
        // 获取部署者地址
        address deployer = msg.sender;
        console.log("Deployer:", deployer);
        
        vm.startBroadcast();
        
        // 部署简化版账户合约
        AAStarAccountV6_Simplified accountImpl = new AAStarAccountV6_Simplified(
            IEntryPoint(ENTRY_POINT_ADDRESS)
        );
        
        address accountImplAddress = address(accountImpl);
        console.log("\nSimplified Account Implementation deployed at:", accountImplAddress);
        
        vm.stopBroadcast();
        
        console.log("\n========================================");
        console.log("Deployment Summary");
        console.log("========================================");
        console.log("AAStarAccountV6_Simplified:", accountImplAddress);
        console.log("\nNext step: Create factory with this implementation");
        console.log(string.concat("SIMPLIFIED_ACCOUNT_IMPL=", vm.toString(accountImplAddress)));
    }
}