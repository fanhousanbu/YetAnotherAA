// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AAStarAccountV6.sol";
import "../src/AAStarAccountFactoryV6.sol";

contract DeploySimplifiedScript is Script {
    // EntryPoint address for Sepolia testnet (ERC-4337 v0.6)
    address constant ENTRY_POINT = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    
    // Use existing deployed AAStarValidator (already has registered keys)
    address constant AA_STAR_VALIDATOR = 0x6f5F51654eeDfDBba5E053d022A7282f63ec8687;
    
    function run() external {
        uint256 deployerPrivateKey = 0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a;
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Deploying simplified AAStarAccount system...");
        console.log("Using existing AAStarValidator:", AA_STAR_VALIDATOR);
        
        // Deploy AAStarAccountFactoryV6 (using existing validator)
        console.log("Deploying AAStarAccountFactoryV6...");
        AAStarAccountFactoryV6 factory = new AAStarAccountFactoryV6(IEntryPoint(ENTRY_POINT));
        console.log("AAStarAccountFactoryV6 deployed at:", address(factory));
        
        // Get account implementation address
        address implementation = factory.getImplementation();
        console.log("AAStarAccountV6 Implementation deployed at:", implementation);
        
        // Create a test account with BLS validation enabled
        console.log("\nCreating test account with BLS validation...");
        
        address testOwner = vm.addr(deployerPrivateKey);
        uint256 testSalt = 67890;
        
        // Create account with AAStarValidator enabled
        AAStarAccountV6 testAccount = factory.createAccountWithAAStarValidator(
            testOwner,
            AA_STAR_VALIDATOR,
            true,  // Enable BLS validation
            testSalt
        );
        console.log("Test account with BLS validation created at:", address(testAccount));
        
        // Verify account configuration
        (address validator, bool isEnabled, address accountOwner) = testAccount.getValidationConfig();
        console.log("Account validation config:");
        console.log("- Validator:", validator);
        console.log("- BLS enabled:", isEnabled);
        console.log("- Owner:", accountOwner);
        
        vm.stopBroadcast();
        
        console.log("\n=== Final Deployment Summary ===");
        console.log("Network: Sepolia");
        console.log("EntryPoint:", ENTRY_POINT);
        console.log("AAStarValidator:", AA_STAR_VALIDATOR, "(existing, with 5 registered keys)");
        console.log("AAStarAccountFactoryV6:", address(factory));
        console.log("AAStarAccountV6 Implementation:", implementation);
        console.log("Test BLS Account:", address(testAccount));
        
        console.log("\nSystem ready for ERC-4337 testing!");
    }
}