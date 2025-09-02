// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/WorkingHashToCurveG2.sol";

contract DeployWorking is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        WorkingHashToCurveG2 hashToCurve = new WorkingHashToCurveG2();
        console.log("WorkingHashToCurveG2 deployed to:", address(hashToCurve));
        
        // Test with our known userOp hash
        bytes32 testHash = 0x7970c13dcd8651528866f649abfe94af364ceac8b8532ef5b02f728a7b03451b;
        
        try hashToCurve.hashUserOpToG2(testHash) returns (bytes memory result) {
            console.log("Hash-to-curve SUCCESS!");
            console.log("Result length:", result.length);
            console.logBytes32(bytes32(result));
        } catch Error(string memory reason) {
            console.log("Hash-to-curve failed:", reason);
        } catch {
            console.log("Hash-to-curve failed with unknown error");
        }
        
        // Test precompile directly
        try hashToCurve.testPrecompile() returns (bool success, uint256 length, bytes memory) {
            console.log("Precompile test - Success:", success, "Length:", length);
        } catch {
            console.log("Precompile test failed");
        }
        
        vm.stopBroadcast();
    }
}