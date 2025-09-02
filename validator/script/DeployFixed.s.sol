// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/FixedHashToCurveG2.sol";

contract DeployFixed is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        FixedHashToCurveG2 hashToCurve = new FixedHashToCurveG2();
        
        console.log("FixedHashToCurveG2 deployed to:", address(hashToCurve));
        
        // Test immediately after deployment
        bytes32 testHash = 0x7970c13dcd8651528866f649abfe94af364ceac8b8532ef5b02f728a7b03451b;
        
        try hashToCurve.testPrecompiles() returns (bool precompilesWork) {
            console.log("Precompiles test result:", precompilesWork);
        } catch {
            console.log("Precompiles test failed");
        }
        
        try hashToCurve.hashUserOpToG2(testHash) returns (bytes memory result) {
            console.log("Hash-to-curve successful, result length:", result.length);
            // Log first 32 bytes of result
            if (result.length >= 32) {
                bytes32 firstBytes;
                assembly {
                    firstBytes := mload(add(result, 32))
                }
                console.logBytes32(firstBytes);
            }
        } catch Error(string memory reason) {
            console.log("Hash-to-curve failed:", reason);
        } catch {
            console.log("Hash-to-curve failed with unknown error");
        }
        
        vm.stopBroadcast();
    }
}