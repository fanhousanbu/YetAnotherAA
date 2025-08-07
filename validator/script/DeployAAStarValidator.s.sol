// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AAStarValidator.sol";

contract DeployAAStarValidatorScript is Script {
    
    function run() external {
        uint256 deployerPrivateKey = 0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a;
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the AA* BLS validator
        AAStarValidator validator = new AAStarValidator();
        
        console.log("AAStarValidator deployed at:", address(validator));

        vm.stopBroadcast();
    }
}