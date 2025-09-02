// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/SimpleTestContract.sol";

contract DeploySimpleTest is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        SimpleTestContract testContract = new SimpleTestContract();
        console.log("SimpleTestContract deployed to:", address(testContract));
        
        // Test zero input
        try testContract.testZeroInput() returns (bool success, uint256 length, bytes memory result) {
            console.log("Zero input test - Success:", success, "Length:", length);
        } catch {
            console.log("Zero input test failed");
        }
        
        // Test with userOp hash
        bytes32 testHash = 0x7970c13dcd8651528866f649abfe94af364ceac8b8532ef5b02f728a7b03451b;
        try testContract.hashToG2Simple(testHash) returns (bool success, bytes memory result) {
            console.log("UserOp hash test - Success:", success, "Length:", result.length);
        } catch {
            console.log("UserOp hash test failed");
        }
        
        vm.stopBroadcast();
    }
}