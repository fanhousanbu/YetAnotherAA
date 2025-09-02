// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AAStarAccountV6.sol";

contract DeployAAStarAccountV6 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy AAStarAccountV6 implementation (UUPS proxy will be deployed separately)
        AAStarAccountV6 accountImpl = new AAStarAccountV6(IEntryPoint(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789));

        console.log("==== AAStarAccountV6 Implementation Deployment ====");
        console.log("Implementation address:", address(accountImpl));
        console.log("Uses UUPS proxy pattern - implementation deployed first");
        console.log("Signature format updated to exclude messagePoint");
        console.log("Compatible with secure AAStarValidator");

        vm.stopBroadcast();
    }
}