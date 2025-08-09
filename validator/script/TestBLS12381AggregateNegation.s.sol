// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/BLS12381AggregateNegation.sol";

contract TestBLS12381AggregateNegationScript is Script {
    
    function run() external {
        uint256 deployerPrivateKey = 0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a;
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the combined contract
        BLS12381AggregateNegation combined = new BLS12381AggregateNegation();
        
        console.log("BLS12381AggregateNegation deployed at:", address(combined));
        console.log("\n=== Testing Combined Aggregate + Negation ===");
        
        // Get the original G1 points
        console.log("\n--- Original G1 Points ---");
        (bytes memory g1One1, bytes memory g1One2) = combined.getOriginalPoints();
        console.log("G1One1 length:", g1One1.length);
        console.logBytes(g1One1);
        console.log("G1One2 length:", g1One2.length);
        console.logBytes(g1One2);
        
        // Test the main functionality
        console.log("\n--- Testing aggregateAndNegateView ---");
        try combined.aggregateAndNegateView() returns (bytes memory aggregated, bytes memory negated) {
            console.log("Success!");
            console.log("Aggregated point length:", aggregated.length);
            console.log("Aggregated point:");
            console.logBytes(aggregated);
            
            console.log("Negated point length:", negated.length);
            console.log("Negated point:");
            console.logBytes(negated);
            
            // Verify they are different (unless point at infinity)
            bool isDifferent = keccak256(aggregated) != keccak256(negated);
            console.log("Aggregated != Negated:", isDifferent);
            
        } catch Error(string memory reason) {
            console.log("aggregateAndNegateView failed:", reason);
        }
        
        // Test the concise version
        console.log("\n--- Testing getNegatedAggregateResult ---");
        try combined.getNegatedAggregateResult() returns (bytes memory finalResult) {
            console.log("Success!");
            console.log("Final negated result length:", finalResult.length);
            console.log("Final negated result:");
            console.logBytes(finalResult);
        } catch Error(string memory reason) {
            console.log("getNegatedAggregateResult failed:", reason);
        }
        
        // Test the state-changing version with events
        console.log("\n--- Testing aggregateAndNegate (with events) ---");
        try combined.aggregateAndNegate() returns (bytes memory aggregated2, bytes memory negated2) {
            console.log("Success!");
            console.log("Event-emitting version completed");
            console.log("Aggregated length:", aggregated2.length);
            console.log("Negated length:", negated2.length);
        } catch Error(string memory reason) {
            console.log("aggregateAndNegate failed:", reason);
        }
        
        // Test component validation
        console.log("\n--- Component Validation ---");
        bool componentsValid = combined.validateComponents();
        console.log("Components are valid:", componentsValid);
        
        // Get gas estimate
        uint256 gasEstimate = combined.getGasEstimate();
        console.log("Gas estimate:", gasEstimate);
        
        vm.stopBroadcast();
        
        console.log("\n=== Test Complete ===");
    }
}