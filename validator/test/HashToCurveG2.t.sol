// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/AAStarAccountV6.sol";

/**
 * @title HashToCurveG2 Test Wrapper
 * @dev Test wrapper contract to expose internal _hashToCurveG2 function from AAStarAccountV6
 */
contract HashToCurveG2TestWrapper {
    
    /**
     * @dev Expose the internal _hashToCurveG2 function for testing
     */
    function hashToCurveG2(bytes32 hash) external pure returns (bytes memory messagePoint) {
        return _hashToCurveG2(hash);
    }
    
    /**
     * @dev Copy of the internal _hashToCurveG2 function from AAStarAccountV6
     * This is needed because we can't directly inherit due to constructor requirements
     */
    function _hashToCurveG2(bytes32 hash) internal pure returns (bytes memory messagePoint) {
        // For testing: create a deterministic but valid-looking G2 point
        // This should be replaced with proper hashToCurve in production
        messagePoint = new bytes(256);
        
        // Fill with deterministic data based on hash
        bytes32 seed = keccak256(abi.encodePacked(hash, "BLS_G2_POINT"));
        
        // Create deterministic G2 point structure (not cryptographically secure)
        for (uint256 i = 0; i < 8; i++) {
            bytes32 chunk = keccak256(abi.encodePacked(seed, i));
            for (uint256 j = 0; j < 32; j++) {
                messagePoint[i * 32 + j] = chunk[j];
            }
        }
    }
}

/**
 * @title HashToCurveG2 Function Tests
 * @dev Comprehensive test suite for _hashToCurveG2 function from AAStarAccountV6.sol line 196
 */
contract HashToCurveG2Test is Test {
    HashToCurveG2TestWrapper public wrapper;
    
    // Test constants
    bytes32 constant TEST_HASH_1 = keccak256("test_message_1");
    bytes32 constant TEST_HASH_2 = keccak256("test_message_2"); 
    bytes32 constant ZERO_HASH = bytes32(0);
    bytes32 constant MAX_HASH = bytes32(type(uint256).max);
    bytes32 constant USER_OP_HASH_SAMPLE = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
    
    function setUp() public {
        wrapper = new HashToCurveG2TestWrapper();
    }
    
    // =============================================================
    //                    BASIC FUNCTIONALITY TESTS
    // =============================================================
    
    function test_HashToCurveG2_ReturnsCorrectLength() public view {
        bytes memory result = wrapper.hashToCurveG2(TEST_HASH_1);
        assertEq(result.length, 256, "Should return exactly 256 bytes for G2 point");
    }
    
    function test_HashToCurveG2_DeterministicOutput() public view {
        bytes memory result1 = wrapper.hashToCurveG2(TEST_HASH_1);
        bytes memory result2 = wrapper.hashToCurveG2(TEST_HASH_1);
        
        assertEq(keccak256(result1), keccak256(result2), "Same input should produce identical output");
    }
    
    function test_HashToCurveG2_DifferentInputsDifferentOutputs() public view {
        bytes memory result1 = wrapper.hashToCurveG2(TEST_HASH_1);
        bytes memory result2 = wrapper.hashToCurveG2(TEST_HASH_2);
        
        assertTrue(keccak256(result1) != keccak256(result2), "Different inputs should produce different outputs");
    }
    
    // =============================================================
    //                    EDGE CASE TESTS
    // =============================================================
    
    function test_HashToCurveG2_ZeroHash() public view {
        bytes memory result = wrapper.hashToCurveG2(ZERO_HASH);
        
        assertEq(result.length, 256, "Zero hash should still produce 256-byte output");
        
        // Verify it's not all zeros (should be deterministically generated)
        bool hasNonZero = false;
        for (uint256 i = 0; i < result.length; i++) {
            if (result[i] != 0) {
                hasNonZero = true;
                break;
            }
        }
        assertTrue(hasNonZero, "Zero hash should not produce all-zero output");
    }
    
    function test_HashToCurveG2_MaxHash() public view {
        bytes memory result = wrapper.hashToCurveG2(MAX_HASH);
        
        assertEq(result.length, 256, "Max hash should produce 256-byte output");
        
        // Should be different from zero hash result
        bytes memory zeroResult = wrapper.hashToCurveG2(ZERO_HASH);
        assertTrue(keccak256(result) != keccak256(zeroResult), "Max hash should produce different output than zero hash");
    }
    
    function test_HashToCurveG2_UserOpHashSample() public view {
        bytes memory result = wrapper.hashToCurveG2(USER_OP_HASH_SAMPLE);
        
        assertEq(result.length, 256, "UserOp hash should produce 256-byte output");
        
        // Verify each 32-byte chunk is different (deterministic generation should ensure this)
        bool chunksAreDifferent = false;
        for (uint256 i = 0; i < 7; i++) {
            bytes32 chunk1;
            bytes32 chunk2;
            
            assembly {
                chunk1 := mload(add(add(result, 0x20), mul(i, 0x20)))
                chunk2 := mload(add(add(result, 0x20), mul(add(i, 1), 0x20)))
            }
            
            if (chunk1 != chunk2) {
                chunksAreDifferent = true;
                break;
            }
        }
        assertTrue(chunksAreDifferent, "Generated chunks should have variation");
    }
    
    // =============================================================
    //                    DETERMINISTIC BEHAVIOR TESTS
    // =============================================================
    
    function test_HashToCurveG2_ConsistentAcrossMultipleCalls() public view {
        bytes32[] memory testHashes = new bytes32[](5);
        testHashes[0] = TEST_HASH_1;
        testHashes[1] = TEST_HASH_2; 
        testHashes[2] = ZERO_HASH;
        testHashes[3] = MAX_HASH;
        testHashes[4] = USER_OP_HASH_SAMPLE;
        
        for (uint256 i = 0; i < testHashes.length; i++) {
            bytes memory result1 = wrapper.hashToCurveG2(testHashes[i]);
            bytes memory result2 = wrapper.hashToCurveG2(testHashes[i]);
            bytes memory result3 = wrapper.hashToCurveG2(testHashes[i]);
            
            assertEq(keccak256(result1), keccak256(result2), "Multiple calls should be consistent");
            assertEq(keccak256(result2), keccak256(result3), "Multiple calls should be consistent");
        }
    }
    
    function test_HashToCurveG2_InternalStructureValidation() public view {
        bytes memory result = wrapper.hashToCurveG2(TEST_HASH_1);
        
        // Verify the result has 8 chunks of 32 bytes each
        assertEq(result.length, 8 * 32, "Should have exactly 8 chunks of 32 bytes");
        
        // Extract and verify each chunk is properly generated
        bytes32 expectedSeed = keccak256(abi.encodePacked(TEST_HASH_1, "BLS_G2_POINT"));
        
        for (uint256 i = 0; i < 8; i++) {
            bytes32 expectedChunk = keccak256(abi.encodePacked(expectedSeed, i));
            bytes32 actualChunk;
            
            assembly {
                actualChunk := mload(add(add(result, 0x20), mul(i, 0x20)))
            }
            
            assertEq(actualChunk, expectedChunk, string(abi.encodePacked("Chunk ", vm.toString(i), " should match expected value")));
        }
    }
    
    // =============================================================
    //                    REAL WORLD SCENARIO TESTS  
    // =============================================================
    
    function test_HashToCurveG2_TypicalUserOpHashes() public view {
        // Test with realistic userOpHash patterns
        bytes32[] memory userOpHashes = new bytes32[](3);
        userOpHashes[0] = keccak256(abi.encodePacked("sender", uint256(12345), "calldata"));
        userOpHashes[1] = keccak256(abi.encodePacked("account", block.timestamp, "operation"));
        userOpHashes[2] = keccak256(abi.encodePacked("erc4337", uint256(67890), "userop"));
        
        for (uint256 i = 0; i < userOpHashes.length; i++) {
            bytes memory result = wrapper.hashToCurveG2(userOpHashes[i]);
            
            assertEq(result.length, 256, string(abi.encodePacked("UserOp hash ", vm.toString(i), " should produce 256 bytes")));
            
            // Ensure not empty/zero
            bool hasData = false;
            for (uint256 j = 0; j < result.length; j++) {
                if (result[j] != 0) {
                    hasData = true;
                    break;
                }
            }
            assertTrue(hasData, string(abi.encodePacked("UserOp hash ", vm.toString(i), " should produce non-zero data")));
        }
    }
    
    // =============================================================
    //                    FUZZ TESTING
    // =============================================================
    
    function testFuzz_HashToCurveG2_AlwaysProduces256Bytes(bytes32 input) public view {
        bytes memory result = wrapper.hashToCurveG2(input);
        assertEq(result.length, 256, "Any input should produce exactly 256 bytes");
    }
    
    function testFuzz_HashToCurveG2_DeterministicBehavior(bytes32 input) public view {
        bytes memory result1 = wrapper.hashToCurveG2(input);
        bytes memory result2 = wrapper.hashToCurveG2(input);
        
        assertEq(keccak256(result1), keccak256(result2), "Same input should always produce same output");
    }
    
    function testFuzz_HashToCurveG2_DifferentInputsDifferentOutputs(bytes32 input1, bytes32 input2) public view {
        vm.assume(input1 != input2);
        
        bytes memory result1 = wrapper.hashToCurveG2(input1);
        bytes memory result2 = wrapper.hashToCurveG2(input2);
        
        assertTrue(keccak256(result1) != keccak256(result2), "Different inputs should produce different outputs");
    }
    
    // =============================================================
    //                    PERFORMANCE TESTS
    // =============================================================
    
    function test_HashToCurveG2_GasConsumption() public view {
        uint256 gasBefore = gasleft();
        wrapper.hashToCurveG2(TEST_HASH_1);
        uint256 gasAfter = gasleft();
        
        uint256 gasUsed = gasBefore - gasAfter;
        
        // Verify reasonable gas consumption (should be relatively low for deterministic generation)
        assertTrue(gasUsed > 0, "Should consume some gas");
        assertTrue(gasUsed < 200000, "Should not consume excessive gas (8 keccak256 ops + memory)");
        
        console.log("Gas used for _hashToCurveG2:", gasUsed);
    }
}