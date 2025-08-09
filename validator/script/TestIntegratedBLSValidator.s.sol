// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/IntegratedBLSValidator.sol";

contract TestIntegratedBLSValidatorScript is Script {
    
    // Test data - using the same public keys from previous tests
    bytes constant PUBLIC_KEY_1 = hex"00000000000000000000000000000000039de640beedf8ba1e935e6730da2e6cddc2ce58de91925561ddf7201120a288b5c5f01f1a320b63f11598e4b8ce3d0b000000000000000000000000000000001633cf00e5a713a368a715e5d2be87d2ceee08106db6d22acc566f68bf87797799d6525379e52bf558b97b2792987dc3";
    
    bytes constant PUBLIC_KEY_2 = hex"000000000000000000000000000000001610956436231a1d4d2cf32a58cbe069257c97539425f924f607440a4fa959cc128a66c6cbf9ad4b5272aeccb376aee60000000000000000000000000000000006658a610645f32c0824d1ff2462363b9ee89533900232f5c82ea14a7d0770731b158ef3b67559159106993cd044351b";
    
    bytes constant PUBLIC_KEY_3 = hex"000000000000000000000000000000000f3ddd77a7387e39155bc302a26342eaef48ddcf4087d032d88529c704a448476efc7363d00c497c02a2a6ca906582a90000000000000000000000000000000011a51192cc928d19d6cc95c390a2ab48d59cf4c6fc3cb3e239e4691489b02c1c94cf83ab805ff67b5b99a9bafd5e993b";
    
    // Mock G2 signature and message point (256 bytes each)
    bytes constant MOCK_SIGNATURE = hex"000000000000000000000000000000001234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef000000000000000000000000000000001234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef000000000000000000000000000000001234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef000000000000000000000000000000001234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    
    bytes constant MOCK_MESSAGE_POINT = hex"000000000000000000000000000000009876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba000000000000000000000000000000009876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba000000000000000000000000000000009876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba000000000000000000000000000000009876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba";
    
    function run() external {
        uint256 deployerPrivateKey = 0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a;
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the validator
        IntegratedBLSValidator validator = new IntegratedBLSValidator();
        
        console.log("IntegratedBLSValidator deployed at:", address(validator));
        console.log("\n=== Testing Integrated BLS Validator ===");
        
        // Prepare public keys array
        bytes[] memory publicKeys = new bytes[](3);
        publicKeys[0] = PUBLIC_KEY_1;
        publicKeys[1] = PUBLIC_KEY_2;
        publicKeys[2] = PUBLIC_KEY_3;
        
        console.log("\n--- Input Data ---");
        console.log("Public keys count:", publicKeys.length);
        console.log("Signature length:", MOCK_SIGNATURE.length);
        console.log("Message point length:", MOCK_MESSAGE_POINT.length);
        
        // Test 1: Get aggregated and negated key
        console.log("\n--- Testing Key Aggregation and Negation ---");
        try validator.getAggregatedAndNegatedKey(publicKeys) returns (
            bytes memory aggregated, 
            bytes memory negated
        ) {
            console.log("Success!");
            console.log("Aggregated key length:", aggregated.length);
            console.log("Aggregated key:");
            console.logBytes(aggregated);
            
            console.log("Negated key length:", negated.length);
            console.log("Negated key:");
            console.logBytes(negated);
            
            bool areEqual = keccak256(aggregated) == keccak256(negated);
            console.log("Aggregated == Negated:", areEqual);
            
        } catch Error(string memory reason) {
            console.log("getAggregatedAndNegatedKey failed:", reason);
        }
        
        // Test 2: Validate aggregate signature (view version)
        console.log("\n--- Testing Signature Validation (View) ---");
        try validator.validateAggregateSignatureView(
            publicKeys,
            MOCK_SIGNATURE,
            MOCK_MESSAGE_POINT
        ) returns (bool isValid) {
            console.log("Validation completed!");
            console.log("Signature is valid:", isValid);
            
            // Note: This will likely return false because we're using mock data
            // In a real scenario, the signature and message point would be properly generated
            if (!isValid) {
                console.log("(Expected: mock data validation should fail)");
            }
            
        } catch Error(string memory reason) {
            console.log("validateAggregateSignatureView failed:", reason);
        }
        
        // Test 3: Validate with events (state-changing version)
        console.log("\n--- Testing Signature Validation (With Events) ---");
        try validator.validateAggregateSignature(
            publicKeys,
            MOCK_SIGNATURE,
            MOCK_MESSAGE_POINT
        ) returns (bool isValid2) {
            console.log("Event-emitting validation completed!");
            console.log("Signature is valid:", isValid2);
            
        } catch Error(string memory reason) {
            console.log("validateAggregateSignature failed:", reason);
        }
        
        // Test 4: Test legacy validateComponents method
        console.log("\n--- Testing Legacy validateComponents ---");
        
        // First get the aggregated and negated key for legacy test
        try validator.getAggregatedAndNegatedKey(publicKeys) returns (
            bytes memory, 
            bytes memory negatedForLegacy
        ) {
            try validator.validateComponents(
                negatedForLegacy,
                MOCK_SIGNATURE,
                MOCK_MESSAGE_POINT
            ) returns (bool legacyValid) {
                console.log("Legacy validation completed!");
                console.log("Legacy validation result:", legacyValid);
            } catch Error(string memory reason) {
                console.log("Legacy validateComponents failed:", reason);
            }
        } catch {
            console.log("Could not get keys for legacy test");
        }
        
        // Test 5: Component validation
        console.log("\n--- Component Validation ---");
        bool componentsValid = validator.validateComponents();
        console.log("Components are valid:", componentsValid);
        
        vm.stopBroadcast();
        
        console.log("\n=== Test Complete ===");
        console.log("\nNote: Signature validations are expected to fail with mock data.");
        console.log("In production, use real BLS signatures and properly encoded G2 message points.");
    }
}