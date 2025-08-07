// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/SimpleBLSVerifier.sol";

contract DeploySimpleScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a");
        vm.startBroadcast(deployerPrivateKey);

        SimpleBLSVerifier verifier = new SimpleBLSVerifier();
        
        console.log("SimpleBLSVerifier deployed at:", address(verifier));
        console.log("Gas cost for verification:", verifier.getVerificationGasCost());

        vm.stopBroadcast();
    }
}