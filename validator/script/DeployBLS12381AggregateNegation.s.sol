// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/BLS12381AggregateNegation.sol";

contract DeployBLS12381AggregateNegationScript is Script {
    
    function run() external {
        uint256 deployerPrivateKey = 0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a;
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the combined contract
        BLS12381AggregateNegation combined = new BLS12381AggregateNegation();
        
        console.log("BLS12381AggregateNegation deployed at:", address(combined));
        
        // Get component addresses
        (address helperAddr, address negationAddr) = combined.getComponentAddresses();
        console.log("  - BLS12381Helper component at:", helperAddr);
        console.log("  - G1PointNegation component at:", negationAddr);
        
        // Validate components
        bool isValid = combined.validateComponents();
        console.log("  - Components validation:", isValid ? "PASSED" : "FAILED");
        
        vm.stopBroadcast();
    }
}