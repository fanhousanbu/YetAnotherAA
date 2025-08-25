// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AAStarValidator.sol";

contract DeployDynamicGasValidator is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy AAStarValidator with dynamic gas calculation
        AAStarValidator validator = new AAStarValidator();
        
        console.log("==== Dynamic Gas AAStarValidator Deployment ====");
        console.log("Validator address:", address(validator));
        console.log("Owner:", validator.owner());
        console.log("Features: Dynamic gas calculation based on EIP-2537");
        
        // Test gas estimates for different node counts
        console.log("");
        console.log("Gas estimates for different node counts:");
        console.log("1 node:  ", validator.getGasEstimate(1));
        console.log("3 nodes: ", validator.getGasEstimate(3));
        console.log("5 nodes: ", validator.getGasEstimate(5));
        console.log("10 nodes:", validator.getGasEstimate(10));
        console.log("20 nodes:", validator.getGasEstimate(20));
        
        vm.stopBroadcast();
    }
}