// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/BLS12381HelperDeployable.sol";

contract DeployBLS12381HelperScript is Script {
    
    function run() external {
        uint256 deployerPrivateKey = 0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a;
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy BLS12381Helper
        BLS12381HelperDeployable helper = new BLS12381HelperDeployable();
        
        console.log("BLS12381HelperDeployable deployed at:", address(helper));
        
        vm.stopBroadcast();
    }
}