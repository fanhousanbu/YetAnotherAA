// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/IntegratedBLSValidator.sol";

contract DeployIntegratedBLSValidatorScript is Script {
    
    function run() external {
        uint256 deployerPrivateKey = 0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a;
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the integrated validator
        IntegratedBLSValidator validator = new IntegratedBLSValidator();
        
        console.log("IntegratedBLSValidator deployed at:", address(validator));
        
        // Get component addresses
        (address aggregatorAddr, address negationAddr) = validator.getComponentAddresses();
        console.log("  - G1PublicKeyAggregator component at:", aggregatorAddr);
        console.log("  - G1PointNegation component at:", negationAddr);
        
        // Validate components
        bool isValid = validator.validateComponents();
        console.log("  - Components validation:", isValid ? "PASSED" : "FAILED");
        
        // Get gas estimate for different key counts
        console.log("\n=== Gas Estimates ===");
        console.log("  - 1 key:", validator.getGasEstimate(1));
        console.log("  - 3 keys:", validator.getGasEstimate(3));
        console.log("  - 10 keys:", validator.getGasEstimate(10));
        
        // Get signature format
        console.log("\nSignature format:", validator.getSignatureFormat());
        
        vm.stopBroadcast();
    }
}