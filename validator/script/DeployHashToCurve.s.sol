// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/SimpleHashToCurveG2.sol";

contract DeployHashToCurve is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        SimpleHashToCurveG2 hashToCurve = new SimpleHashToCurveG2();
        
        console.log("SimpleHashToCurveG2 deployed to:", address(hashToCurve));
        
        // Test the contract immediately after deployment
        bytes32 testHash = 0x7970c13dcd8651528866f649abfe94af364ceac8b8532ef5b02f728a7b03451b;
        
        try hashToCurve.testPrecompiles() returns (bool precompilesWork) {
            console.log("Precompiles test result:", precompilesWork);
        } catch {
            console.log("Precompiles test failed");
        }
        
        try hashToCurve.hashUserOpToG2(testHash) returns (bytes memory result) {
            console.log("Hash-to-curve test successful, result length:", result.length);
            console.logBytes(result);
        } catch Error(string memory reason) {
            console.log("Hash-to-curve test failed:", reason);
        } catch {
            console.log("Hash-to-curve test failed with unknown error");
        }
        
        vm.stopBroadcast();
    }
}