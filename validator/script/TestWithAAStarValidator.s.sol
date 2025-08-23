// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/AAStarValidator.sol";

/**
 * @title TestWithAAStarValidator
 * @dev Test integration with deployed AAStarValidator on Sepolia
 */
contract TestWithAAStarValidator is Script {
    address constant VALIDATOR_CONTRACT_ADDRESS = 0x1E0c95946801ef4Fc294eA1F8214faB2357bFF9C;
    address constant TEST_WRAPPER_ADDRESS = 0x3Ef479D1def610f53E64217C3B46c00A9475D8aa;
    
    function run() external view {
        console.log("=== Testing with deployed AAStarValidator ===");
        
        // Connect to deployed validator
        AAStarValidator validator = AAStarValidator(VALIDATOR_CONTRACT_ADDRESS);
        
        // Test basic validator functions
        console.log("Validator contract address:", VALIDATOR_CONTRACT_ADDRESS);
        console.log("Validator owner:", validator.owner());
        console.log("Registered node count:", validator.getRegisteredNodeCount());
        
        // Get validator signature format
        console.log("Signature format:", validator.getSignatureFormat());
        
        // Test gas estimation
        uint256 gasEstimate = validator.getGasEstimate(3);
        console.log("Gas estimate for 3 nodes:", gasEstimate);
        
        // Test messagePoint generation with our test wrapper
        console.log("\n=== Testing messagePoint generation ===");
        AAStarAccountV6TestWrapper wrapper = AAStarAccountV6TestWrapper(TEST_WRAPPER_ADDRESS);
        
        bytes32 testUserOpHash = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
        console.log("Test userOpHash:", vm.toString(testUserOpHash));
        
        bytes memory messagePoint = wrapper.testHashToCurveG2(testUserOpHash);
        console.log("Generated messagePoint length:", messagePoint.length);
        
        // Log first few bytes
        if (messagePoint.length >= 32) {
            bytes32 firstChunk;
            assembly {
                firstChunk := mload(add(messagePoint, 32))
            }
            console.log("MessagePoint first 32 bytes:");
            console.logBytes32(firstChunk);
        }
        
        console.log("\n=== Test Complete ===");
    }
}

/**
 * @title AAStarAccountV6TestWrapper
 * @dev Interface for deployed test wrapper
 */
interface AAStarAccountV6TestWrapper {
    function testHashToCurveG2(bytes32 hash) external view returns (bytes memory);
    function testParseAAStarSignature(bytes calldata signature) external pure returns (
        bytes32[] memory nodeIds,
        bytes memory blsSignature,  
        bytes memory aaSignature
    );
}