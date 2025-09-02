// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AAStarValidator.sol";

contract DeployAAStarValidator is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy AAStarValidator with secure hash-to-curve
        AAStarValidator validator = new AAStarValidator();

        console.log("==== AAStarValidator Deployment (Secure Version) ====");
        console.log("Validator address:", address(validator));
        console.log("Owner:", validator.owner());
        console.log("Version:", validator.getVersion());
        console.log("Signature Format:", validator.getSignatureFormat());

        // Test gas estimates for different node counts
        console.log("");
        console.log("Gas estimates for different node counts:");
        console.log("1 node:  ", validator.getGasEstimate(1));
        console.log("3 nodes: ", validator.getGasEstimate(3));
        console.log("5 nodes: ", validator.getGasEstimate(5));
        console.log("10 nodes:", validator.getGasEstimate(10));
        console.log("20 nodes:", validator.getGasEstimate(20));

        console.log("");
        console.log("=== Security Enhancements ===");
        console.log("- messagePoint generated on-chain securely");
        console.log("- No external messagePoint input accepted in main functions");
        console.log("- Uses EIP-2537 precompiles for hash-to-curve");
        console.log("- Eliminates messagePoint tampering attack vector");
        console.log("- Maintains backward compatibility for gas estimation");

        vm.stopBroadcast();
    }
}
