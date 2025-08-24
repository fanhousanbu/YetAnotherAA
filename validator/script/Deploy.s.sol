// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AAStarValidator.sol";
import "../src/AAStarAccountFactoryV6.sol";

contract DeployScript is Script {
    // EntryPoint address for Sepolia testnet (ERC-4337 v0.6)
    address constant ENTRY_POINT = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    
    function run() external {
        uint256 deployerPrivateKey = 0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a;
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy AAStarValidator
        console.log("Deploying AAStarValidator...");
        AAStarValidator validator = new AAStarValidator();
        console.log("AAStarValidator deployed at:", address(validator));
        
        // Deploy AAStarAccountFactoryV6
        console.log("Deploying AAStarAccountFactoryV6...");
        AAStarAccountFactoryV6 factory = new AAStarAccountFactoryV6(IEntryPoint(ENTRY_POINT));
        console.log("AAStarAccountFactoryV6 deployed at:", address(factory));
        
        // Get account implementation address
        address implementation = factory.getImplementation();
        console.log("Account implementation deployed at:", implementation);
        
        // Verify deployments
        console.log("\n=== Deployment Summary ===");
        console.log("Network: Sepolia");
        console.log("EntryPoint:", ENTRY_POINT);
        console.log("AAStarValidator:", address(validator));
        console.log("AAStarAccountFactoryV6:", address(factory));
        console.log("AAStarAccountV6 Implementation:", implementation);
        
        // Test basic functionality
        console.log("\n=== Verification ===");
        console.log("Validator owner:", validator.owner());
        console.log("Validator registered nodes:", validator.getRegisteredNodeCount());
        console.log("Factory implementation:", factory.getImplementation());
        
        vm.stopBroadcast();
    }
}