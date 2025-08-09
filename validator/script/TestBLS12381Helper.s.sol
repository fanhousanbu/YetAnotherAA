// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/BLS12381HelperDeployable.sol";

contract TestBLS12381HelperScript is Script {
    
    function run() external {
        uint256 deployerPrivateKey = 0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a;
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy BLS12381Helper
        BLS12381HelperDeployable helper = new BLS12381HelperDeployable();
        
        console.log("BLS12381HelperDeployable deployed at:", address(helper));
        console.log("\n=== Testing BLS12381Helper Functions ===");
        
        // Test getG1One1 and getG1One2
        console.log("\n--- Getting G1 Generator Points ---");
        bytes memory g1One1 = helper.getG1One1();
        bytes memory g1One2 = helper.getG1One2();
        
        console.log("G1One1 length:", g1One1.length);
        console.log("G1One1:");
        console.logBytes(g1One1);
        
        console.log("G1One2 length:", g1One2.length);
        console.log("G1One2:");
        console.logBytes(g1One2);
        
        // Test Aggregate function (adds g1One1 + g1One2)
        console.log("\n--- Testing Aggregate Function ---");
        try helper.Aggregate() returns (bytes memory aggregated) {
            console.log("Aggregate successful!");
            console.log("Aggregated result length:", aggregated.length);
            console.log("Aggregated result:");
            console.logBytes(aggregated);
        } catch Error(string memory reason) {
            console.log("Aggregate failed:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("Aggregate failed with low-level error");
            console.logBytes(lowLevelData);
        }
        
        // Test direct G1 addition
        console.log("\n--- Testing Direct G1Add ---");
        try helper.testG1Add(g1One1, g1One2) returns (bytes memory addResult) {
            console.log("Direct G1Add successful!");
            console.log("Addition result length:", addResult.length);
            console.log("Addition result:");
            console.logBytes(addResult);
        } catch Error(string memory reason) {
            console.log("Direct G1Add failed:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("Direct G1Add failed with low-level error");
            console.logBytes(lowLevelData);
        }
        
        // Test G1 multiplication
        console.log("\n--- Testing G1Mul ---");
        uint256 scalar = 2;
        try helper.testG1Mul(g1One1, scalar) returns (bytes memory mulResult) {
            console.log("G1Mul successful!");
            console.log("Multiplication result length:", mulResult.length);
            console.log("Multiplication result (g1One1 * 2):");
            console.logBytes(mulResult);
        } catch Error(string memory reason) {
            console.log("G1Mul failed:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("G1Mul failed with low-level error");
            console.logBytes(lowLevelData);
        }
        
        vm.stopBroadcast();
        
        console.log("\n=== Test Complete ===");
    }
}