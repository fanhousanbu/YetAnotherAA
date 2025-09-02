// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/BLSVerificationContract.sol";

contract DeployBLSVerification is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        BLSVerificationContract blsContract = new BLSVerificationContract();
        console.log("BLSVerificationContract deployed to:", address(blsContract));
        
        // Test messagePoint generation
        bytes32 testHash = 0x7970c13dcd8651528866f649abfe94af364ceac8b8532ef5b02f728a7b03451b;
        
        try blsContract.testMessagePointGeneration(testHash) returns (bool success, uint256 length, bytes32 preview) {
            console.log("MessagePoint test - Success:", success, "Length:", length);
            console.logBytes32(preview);
        } catch {
            console.log("MessagePoint test failed");
        }
        
        vm.stopBroadcast();
    }
}