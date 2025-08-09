// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AAStarValidator.sol";

contract TestAAStarValidatorScript is Script {
    
    // Test data - using the same public keys from previous tests
    bytes constant PARTICIPANT_KEY_1 = hex"00000000000000000000000000000000039de640beedf8ba1e935e6730da2e6cddc2ce58de91925561ddf7201120a288b5c5f01f1a320b63f11598e4b8ce3d0b000000000000000000000000000000001633cf00e5a713a368a715e5d2be87d2ceee08106db6d22acc566f68bf87797799d6525379e52bf558b97b2792987dc3";
    
    bytes constant PARTICIPANT_KEY_2 = hex"000000000000000000000000000000001610956436231a1d4d2cf32a58cbe069257c97539425f924f607440a4fa959cc128a66c6cbf9ad4b5272aeccb376aee60000000000000000000000000000000006658a610645f32c0824d1ff2462363b9ee89533900232f5c82ea14a7d0770731b158ef3b67559159106993cd044351b";
    
    bytes constant PARTICIPANT_KEY_3 = hex"000000000000000000000000000000000f3ddd77a7387e39155bc302a26342eaef48ddcf4087d032d88529c704a448476efc7363d00c497c02a2a6ca906582a90000000000000000000000000000000011a51192cc928d19d6cc95c390a2ab48d59cf4c6fc3cb3e239e4691489b02c1c94cf83ab805ff67b5b99a9bafd5e993b";
    
    // Mock G2 signature and message hash (256 bytes each)
    bytes constant MOCK_SIGNATURE = hex"000000000000000000000000000000001234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef000000000000000000000000000000001234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef000000000000000000000000000000001234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef000000000000000000000000000000001234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    
    bytes constant MOCK_MESSAGE_HASH = hex"000000000000000000000000000000009876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba000000000000000000000000000000009876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba000000000000000000000000000000009876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba000000000000000000000000000000009876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba";
    
    function run() external {
        uint256 deployerPrivateKey = 0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a;
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the validator
        AAStarValidator validator = new AAStarValidator();
        
        console.log("AAStarValidator deployed at:", address(validator));
        console.log("\n=== Testing AA* BLS Validator ===");
        
        // Prepare participant keys
        bytes[] memory participantKeys = new bytes[](3);
        participantKeys[0] = PARTICIPANT_KEY_1;
        participantKeys[1] = PARTICIPANT_KEY_2;
        participantKeys[2] = PARTICIPANT_KEY_3;
        
        console.log("\n--- Input Data ---");
        console.log("Participant count:", participantKeys.length);
        console.log("Signature length:", MOCK_SIGNATURE.length);
        console.log("Message hash length:", MOCK_MESSAGE_HASH.length);
        
        // Test 1: Validate aggregate signature (view version)
        console.log("\n--- Testing Signature Validation (View) ---");
        try validator.validateAggregateSignature(
            participantKeys,
            MOCK_SIGNATURE,
            MOCK_MESSAGE_HASH
        ) returns (bool isValid) {
            console.log("Validation completed!");
            console.log("Signature is valid:", isValid);
            
            if (!isValid) {
                console.log("(Expected: mock data validation should fail)");
            }
            
        } catch Error(string memory reason) {
            console.log("validateAggregateSignature failed:", reason);
        }
        
        // Test 2: Verify aggregate signature (with events)
        console.log("\n--- Testing Signature Verification (With Events) ---");
        try validator.verifyAggregateSignature(
            participantKeys,
            MOCK_SIGNATURE,
            MOCK_MESSAGE_HASH
        ) returns (bool isValid2) {
            console.log("Event-emitting verification completed!");
            console.log("Signature is valid:", isValid2);
            
        } catch Error(string memory reason) {
            console.log("verifyAggregateSignature failed:", reason);
        }
        
        // Test 3: Gas estimation
        console.log("\n--- Testing Gas Estimation ---");
        uint256 gasFor1 = validator.estimateVerificationCost(1);
        uint256 gasFor3 = validator.estimateVerificationCost(3);
        uint256 gasFor5 = validator.estimateVerificationCost(5);
        console.log("Gas estimate for 1 participant:", gasFor1);
        console.log("Gas estimate for 3 participants:", gasFor3);
        console.log("Gas estimate for 5 participants:", gasFor5);
        
        vm.stopBroadcast();
        
        console.log("\n=== Test Complete ===");
        console.log("\nNote: Signature validations are expected to fail with mock data.");
        console.log("In production, use real BLS signatures and properly encoded G2 message hashes.");
    }
}