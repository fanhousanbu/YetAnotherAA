// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/ValidatorBLS.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        ValidatorBLS validator = new ValidatorBLS();
        
        console.log("ValidatorBLS deployed at:", address(validator));
        console.log("Gas cost for verification (1 public key):", validator.getVerificationGasCost(1));
        console.log("Gas cost for verification (2 public keys):", validator.getVerificationGasCost(2));
        console.log("Gas cost for verification (3 public keys):", validator.getVerificationGasCost(3));

        vm.stopBroadcast();
    }
} 