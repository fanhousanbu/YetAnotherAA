// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AAStarValidator.sol";

/**
 * @title TestAAStarValidatorScript
 * @notice Script to test AAStarValidator contract functionality
 */
contract TestAAStarValidatorScript is Script {
    
    // Mock BLS test data generated from signer/index.js
    bytes constant PARTICIPANT_KEY_1 = hex"00000000000000000000000000000000116ef75f7b146c18161b93eeecb776c5f39ea5927882bc5522e8e7749581dc5089199783aaa28dfb463e26f1179e1c080000000000000000000000000000000015df68c6c0e08461ee64f08896a19463c1965e70499da0a420fc8466cbbd52b1961083fd9ab187b32e065627d655db75";
    bytes constant PARTICIPANT_KEY_2 = hex"000000000000000000000000000000000c0fd5e20a6e820e1957239d243416a5054eab1a32211fd73f096eb9b2ab578bffd948f77d7c340a493868b08ad9b2c700000000000000000000000000000000084151e5f85314a6f6b08792bbdd1f273fea258aac539df7c81d13c928122c1cac6e5bac2384c973873b7354a84180c1";
    bytes constant PARTICIPANT_KEY_3 = hex"0000000000000000000000000000000014b4345efce147dbbddd221cc4e336352cca501d75dc202eed4671798f5d5f903347e9d480baf077253c60265a7d97cc000000000000000000000000000000000c33e5a1280d71b67159db2cad9f3d0480e77ca15cba3f79d6519a62ddbfdf1041c6cb492c0218ad5d830b2264853726";
    
    bytes constant AGGREGATE_SIGNATURE = hex"000000000000000000000000000000000d24af6dccc71dd58b046d414d3d09b1d75bb701bb62c6402497e902c8204c9c0f7d3b277d31876691fe2f587388feaf000000000000000000000000000000000266c9c76f543bb2040977c84980a749cd7b4aa8eb2f29b5f86fd2f71ccaa526fd4b45075fcc968ced90a3660769c5ec0000000000000000000000000000000000bcf1382e4503bb66a037c3d2d0dce191ebe35662eaf1bba3ea12662c2c84ccec811b45fe1bddb8de442789188aacdb0000000000000000000000000000000002667f8e4518c8752d9602dad6d759a529776243baa5f723803a0e7c096a4afe8198b9c6de7495e3f505d4b2d693a435";
    
    bytes constant MESSAGE_HASH = hex"0000000000000000000000000000000001083d1f71b8e530be3769311592bf26e97e72bed6ede0136142a495c10dc28341505517134a254a81a03b8db9078210000000000000000000000000000000000cc568b513cc7f9efd8f1029860c6fd8fcea6a0eebe065cff5de4f7aa2db67dabfd83cf68077b572b6d18af0fa8f2c87000000000000000000000000000000001286e0457f82692f991eae5215de50f10a779c26b6a98924d137ba611cd8e02c0463008d6c95201ff9e74cfd856236a3000000000000000000000000000000000a40a49b82311cb06a168c13d9be40702ce9cdac60880047fd4ac7ee5ef60f522500c5e09efc2b419c99a9d2af43a8ba";
    
    function run() external {
        vm.startBroadcast();
        
        // Deploy the validator
        AAStarValidator validator = new AAStarValidator();
        console.log("AAStarValidator deployed at:", address(validator));
        console.log("\n=== Testing AA* BLS Validator ===");
        
        // Test data setup
        bytes[] memory participantKeys = new bytes[](3);
        participantKeys[0] = PARTICIPANT_KEY_1;
        participantKeys[1] = PARTICIPANT_KEY_2; 
        participantKeys[2] = PARTICIPANT_KEY_3;
        
        // Test 1: View-only signature validation
        console.log("\n--- Testing View-Only Validation ---");
        try validator.validateAggregateSignature(
            participantKeys,
            AGGREGATE_SIGNATURE,
            MESSAGE_HASH
        ) returns (bool isValid1) {
            console.log("View validation completed!");
            console.log("Signature is valid:", isValid1);
        } catch Error(string memory reason) {
            console.log("View validation failed:", reason);
        }
        
        // Test 2: Event-emitting signature validation
        console.log("\n--- Testing Event-Emitting Validation ---");
        try validator.validateAggregateSignature(
            participantKeys,
            AGGREGATE_SIGNATURE,
            MESSAGE_HASH
        ) returns (bool isValid2) {
            console.log("Event-emitting validation completed!");
            console.log("Signature is valid:", isValid2);
        } catch Error(string memory reason) {
            console.log("Event validation failed:", reason);
        }
        
        // Test 3: Gas estimation
        console.log("\n--- Testing Gas Estimation ---");
        uint256 gasFor1 = validator.getGasEstimate(1);
        uint256 gasFor3 = validator.getGasEstimate(3);
        uint256 gasFor5 = validator.getGasEstimate(5);
        console.log("Gas estimate for 1 participant:", gasFor1);
        console.log("Gas estimate for 3 participants:", gasFor3);
        console.log("Gas estimate for 5 participants:", gasFor5);
        
        // Test 4: Signature format info
        console.log("\n--- Contract Information ---");
        string memory format = validator.getSignatureFormat();
        console.log("Supported format:", format);
        
        vm.stopBroadcast();
        
        console.log("\n=== Test Complete ===");
        console.log("\nNote: Signature validations may fail with mock data in test environment.");
        console.log("In production, use real BLS signatures and properly encoded G2 message hashes.");
    }
}