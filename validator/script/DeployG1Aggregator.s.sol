// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/G1PublicKeyAggregator.sol";

contract DeployG1AggregatorScript is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy G1 Public Key Aggregator
        G1PublicKeyAggregator aggregator = new G1PublicKeyAggregator();
        
        console.log("G1PublicKeyAggregator deployed at:", address(aggregator));
        console.log("Precompile address used:", aggregator.getPrecompileAddress());
        
        vm.stopBroadcast();
    }
}