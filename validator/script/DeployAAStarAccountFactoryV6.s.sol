// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AAStarAccountFactoryV6.sol";

contract DeployAAStarAccountFactoryV6 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy AAStarAccountFactoryV6 with EntryPoint
        // This will automatically create a new AAStarAccountV6 implementation inside
        AAStarAccountFactoryV6 factory = new AAStarAccountFactoryV6(
            IEntryPoint(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789)
        );

        console.log("==== AAStarAccountFactoryV6 Deployment ====");
        console.log("Factory address:", address(factory));
        console.log("Implementation address:", factory.getImplementation());
        console.log("EntryPoint:", address(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789));
        console.log("Uses ERC1967 proxy pattern for individual accounts");
        console.log("Compatible with secure AAStarValidator");

        vm.stopBroadcast();
    }
}
