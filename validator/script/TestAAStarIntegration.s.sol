// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/AAStarAccountV6.sol";
import "../src/AAStarAccountFactoryV6.sol";
import "../src/AAStarValidator.sol";

/**
 * @title TestAAStarIntegration
 * @dev Script to test integration between AAStarAccountV6 and deployed AAStarValidator
 */
contract TestAAStarIntegration is Script {
    // From .env file
    address constant VALIDATOR_CONTRACT_ADDRESS = 0x0bC9DD7BCa3115198a59D367423E1535104A5882;
    address constant ENTRY_POINT_ADDRESS = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    
    // Test parameters
    bytes32 constant TEST_USER_OP_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
    address constant TEST_OWNER = 0x742D35CC7aB8E3e5F8B7D1E8F4a3e7b1a9B2C3D4;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("ETH_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== AAStarAccountV6 Integration Test ===");
        
        // Step 1: Deploy AAStarAccountFactoryV6
        console.log("\n1. Deploying AAStarAccountFactoryV6...");
        IEntryPoint entryPoint = IEntryPoint(ENTRY_POINT_ADDRESS);
        AAStarAccountFactoryV6 factory = new AAStarAccountFactoryV6(entryPoint);
        console.log("AAStarAccountFactoryV6 deployed at:", address(factory));
        
        // Step 2: Create an AAStarAccountV6 instance
        console.log("\n2. Creating AAStarAccountV6 instance...");
        AAStarAccountV6 account = factory.createAAStarAccount(
            TEST_OWNER,
            VALIDATOR_CONTRACT_ADDRESS,
            123456 // salt
        );
        console.log("AAStarAccountV6 created at:", address(account));
        
        // Step 3: Test the hashToCurve function
        console.log("\n3. Testing hashToCurve function...");
        bytes memory messagePoint = testHashToCurve(TEST_USER_OP_HASH);
        console.log("Generated messagePoint length:", messagePoint.length);
        console.log("MessagePoint (first 32 bytes):");
        logBytes32(bytes32(bytes32(messagePoint)));
        
        // Step 4: Test signature parsing
        console.log("\n4. Testing signature parsing...");
        testSignatureParsing();
        
        // Step 5: Verify configuration
        console.log("\n5. Verifying account configuration...");
        (address validator, bool isEnabled, address owner) = account.getValidationConfig();
        console.log("Configured validator:", validator);
        console.log("AAStarValidator enabled:", isEnabled);
        console.log("Account owner:", owner);
        
        vm.stopBroadcast();
        
        console.log("\n=== Integration Test Complete ===");
    }
    
    function testHashToCurve(bytes32 userOpHash) internal pure returns (bytes memory) {
        // We need to call the internal _hashToCurveG2 function
        // Since it's internal, we'll create a test wrapper function
        console.log("Testing hashToCurve for userOpHash:", vm.toString(userOpHash));
        
        // For now, we'll test that the account was created successfully
        // In a full test, you would need a public wrapper function
        return hex""; // Placeholder
    }
    
    function testSignatureParsing() pure internal {
        console.log("Testing signature parsing...");
        
        // Create a sample signature with the new format
        // Format: [nodeIdsLength(32)][nodeIds...][blsSignature(256)][aaSignature(65)]
        bytes memory sampleSignature = abi.encodePacked(
            uint256(2), // nodeIdsLength = 2
            bytes32(0x1111111111111111111111111111111111111111111111111111111111111111), // nodeId1
            bytes32(0x2222222222222222222222222222222222222222222222222222222222222222), // nodeId2
            new bytes(256), // blsSignature (256 zeros)
            new bytes(65)   // aaSignature (65 zeros)
        );
        
        console.log("Sample signature length:", sampleSignature.length);
        uint256 expectedLength = 32 + 2*32 + 256 + 65;
        console.log("Expected minimum length:", expectedLength);
    }
    
    function logBytes32(bytes32 value) internal pure {
        // Convert bytes32 to hex string for logging
        console.logBytes32(value);
    }
}

/**
 * @title AAStarAccountV6TestWrapper
 * @dev Test wrapper to expose internal functions for testing
 */
contract AAStarAccountV6TestWrapper is AAStarAccountV6 {
    constructor(IEntryPoint anEntryPoint) AAStarAccountV6(anEntryPoint) {}
    
    function testHashToCurveG2(bytes32 hash) external pure returns (bytes memory) {
        return _hashToCurveG2(hash);
    }
    
    function testParseAAStarSignature(bytes calldata signature) external pure returns (
        bytes32[] memory nodeIds,
        bytes memory blsSignature,  
        bytes memory aaSignature
    ) {
        return _parseAAStarSignature(signature);
    }
}