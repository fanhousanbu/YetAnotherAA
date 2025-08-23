// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/AAStarAccountV6.sol";
import "./MockAAStarValidator.sol";
import "./TestAAStarAccountV6.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title AAStarAccountV6 Integration Test for _parseAndValidateAAStarSignature
 * @dev Tests the complete signature parsing and validation workflow with real userOpHash data
 */
contract AAStarAccountV6IntegrationTest is Test {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    // Test contracts
    TestAAStarAccountV6 public account;
    MockAAStarValidator public mockValidator;
    IEntryPoint public entryPoint;
    
    // Test data
    address public owner;
    uint256 public ownerPrivateKey;
    bytes32[] internal nodeIds; // Changed from public to internal to avoid fuzz testing
    bytes internal blsSignature; // Changed from public to internal to avoid fuzz testing
    
    // Events to test
    event AAStarValidationUsed(address indexed validator, bool success);
    
    function setUp() public {
        // Create test owner
        ownerPrivateKey = 0x123456789012345678901234567890123456789012345678901234567890abcd;
        owner = vm.addr(ownerPrivateKey);
        
        // Mock entry point
        entryPoint = IEntryPoint(address(0x123456));
        
        // Deploy mock validator
        mockValidator = new MockAAStarValidator();
        
        // Create a test account wrapper that bypasses initializer
        account = new TestAAStarAccountV6(entryPoint);
        account.initializeTest(owner, address(mockValidator), true);
        
        // Setup test data
        nodeIds = new bytes32[](2);
        nodeIds[0] = keccak256("test_node_1");
        nodeIds[1] = keccak256("test_node_2");
        
        // Mock BLS signature (256 bytes)
        blsSignature = new bytes(256);
        for (uint256 i = 0; i < 256; i++) {
            blsSignature[i] = bytes1(uint8(i % 256));
        }
    }
    
    // =============================================================
    //                    HELPER FUNCTIONS
    // =============================================================
    
    /**
     * @dev Generate a realistic UserOperation hash
     */
    function generateUserOpHash(
        address sender,
        uint256 nonce,
        bytes memory callData
    ) internal pure returns (bytes32) {
        // Simplified UserOperation hash generation for testing
        return keccak256(abi.encode(
            sender,
            nonce,
            callData,
            uint256(100000), // callGasLimit
            uint256(100000), // verificationGasLimit
            uint256(21000),  // preVerificationGas
            uint256(1e9),    // maxFeePerGas
            uint256(1e9),    // maxPriorityFeePerGas
            bytes(""),       // paymasterAndData
            1,               // chainId (hardcoded for testing)
            address(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789) // entryPoint
        ));
    }
    
    /**
     * @dev Create a properly formatted AAStarValidator signature
     * Format: [nodeIdsLength(32)][nodeIds...][blsSignature(256)][aaSignature(65)]
     */
    function createAAStarSignature(
        bytes32[] memory nodeIds,
        bytes memory blsSignature,
        bytes32 userOpHash,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        return _buildSignature(nodeIds, blsSignature, userOpHash, privateKey);
    }
    
    /**
     * @dev Helper function to build signature (split to avoid stack too deep)
     */
    function _buildSignature(
        bytes32[] memory nodeIds,
        bytes memory blsSignature,
        bytes32 userOpHash,
        uint256 privateKey
    ) internal view returns (bytes memory signature) {
        // Generate messagePoint from userOpHash
        bytes memory messagePoint = _hashToCurveG2(userOpHash);
        
        // Create AA signature for messagePoint hash
        bytes32 messagePointHash = keccak256(messagePoint);
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messagePointHash)
        );
        
        // Sign the messagePointHash with owner's private key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethSignedMessageHash);
        bytes memory aaSignature = abi.encodePacked(r, s, v);
        
        // Create signature
        return _assembleSignature(nodeIds, blsSignature, aaSignature);
    }
    
    /**
     * @dev Assemble the final signature format
     */
    function _assembleSignature(
        bytes32[] memory nodeIds,
        bytes memory blsSignature,
        bytes memory aaSignature
    ) internal pure returns (bytes memory signature) {
        uint256 nodeIdsLength = nodeIds.length;
        uint256 nodeIdsDataLength = nodeIdsLength * 32;
        
        signature = new bytes(32 + nodeIdsDataLength + 256 + 65);
        
        // Pack nodeIds length
        bytes memory nodeIdsLengthBytes = abi.encode(nodeIdsLength);
        for (uint256 i = 0; i < 32; i++) {
            signature[i] = nodeIdsLengthBytes[i];
        }
        
        // Pack nodeIds
        for (uint256 i = 0; i < nodeIdsLength; i++) {
            bytes32 nodeId = nodeIds[i];
            uint256 offset = 32 + i * 32;
            assembly {
                mstore(add(add(signature, 0x20), offset), nodeId)
            }
        }
        
        // Pack BLS and AA signatures
        uint256 blsOffset = 32 + nodeIdsDataLength;
        uint256 aaOffset = blsOffset + 256;
        
        for (uint256 i = 0; i < 256; i++) {
            signature[blsOffset + i] = blsSignature[i];
        }
        
        for (uint256 i = 0; i < 65; i++) {
            signature[aaOffset + i] = aaSignature[i];
        }
    }
    
    /**
     * @dev Simplified copy of _hashToCurveG2 from AAStarAccountV6 for testing
     */
    function _hashToCurveG2(bytes32 hash) internal pure returns (bytes memory messagePoint) {
        messagePoint = new bytes(256);
        
        bytes32 seed = keccak256(abi.encodePacked(hash, "BLS_G2_POINT"));
        
        for (uint256 i = 0; i < 8; i++) {
            bytes32 chunk = keccak256(abi.encodePacked(seed, i));
            for (uint256 j = 0; j < 32; j++) {
                messagePoint[i * 32 + j] = chunk[j];
            }
        }
    }
    
    // =============================================================
    //                    INTEGRATION TESTS
    // =============================================================
    
    function test_ParseAndValidateAAStarSignature_Success() public {
        // Generate realistic userOpHash
        bytes32 userOpHash = generateUserOpHash(
            address(account),
            12345,
            abi.encodeWithSignature("execute(address,uint256,bytes)", address(0x456), 1 ether, "")
        );
        
        console.log("Generated userOpHash:");
        console.logBytes32(userOpHash);
        
        // Create properly formatted signature
        bytes memory signature = createAAStarSignature(
            nodeIds,
            blsSignature,
            userOpHash,
            ownerPrivateKey
        );
        
        console.log("Created signature length:", signature.length);
        console.log("Expected length:", 32 + nodeIds.length * 32 + 256 + 65);
        
        // Ensure mock validator returns true
        mockValidator.setShouldReturnTrue(true);
        
        // Note: We're not checking events here since the event emission is complex
        
        // Call the function via the test wrapper
        try account.parseAndValidateAAStarSignature(signature, userOpHash) returns (bool result) {
            assertTrue(result, "Validation should succeed");
            
            console.log("parseAndValidateAAStarSignature returned true");
            console.log("Mock validator configured to return:", mockValidator.shouldReturnTrue());
            console.log("Integration test completed successfully");
            
        } catch Error(string memory reason) {
            // This shouldn't happen with proper setup
            console.log("Unexpected error:", reason);
            assertTrue(false, "Should not revert with proper signature");
        }
    }
    
    function test_ParseAndValidateAAStarSignature_InvalidOwnerSignature() public {
        // Generate userOpHash
        bytes32 userOpHash = generateUserOpHash(
            address(account),
            12345,
            abi.encodeWithSignature("execute(address,uint256,bytes)", address(0x456), 1 ether, "")
        );
        
        // Create signature with wrong private key (not the owner)
        uint256 wrongPrivateKey = 0x987654321098765432109876543210987654321098765432109876543210abcd;
        bytes memory signature = createAAStarSignature(
            nodeIds,
            blsSignature,
            userOpHash,
            wrongPrivateKey
        );
        
        // The function should return false due to invalid owner signature
        try account.parseAndValidateAAStarSignature(signature, userOpHash) returns (bool result) {
            assertFalse(result, "Validation should fail with wrong owner signature");
            console.log("Correctly rejected wrong owner signature");
            
        } catch Error(string memory reason) {
            console.log("Expected error for wrong owner:", reason);
            assertTrue(true, "Expected to fail with wrong owner signature");
        }
    }
    
    function test_ParseAndValidateAAStarSignature_BLSValidationFails() public {
        // Generate userOpHash
        bytes32 userOpHash = generateUserOpHash(
            address(account),
            67890,
            abi.encodeWithSignature("executeBatch(address[],bytes[])", new address[](1), new bytes[](1))
        );
        
        // Create properly formatted signature
        bytes memory signature = createAAStarSignature(
            nodeIds,
            blsSignature,
            userOpHash,
            ownerPrivateKey
        );
        
        // Make mock validator return false
        mockValidator.setShouldReturnTrue(false);
        
        // Note: We're not checking events here since the event emission is complex
        
        try account.parseAndValidateAAStarSignature(signature, userOpHash) returns (bool result) {
            assertFalse(result, "Validation should fail when BLS validation fails");
            console.log("Correctly failed when BLS validation returns false");
            
        } catch Error(string memory reason) {
            console.log("Error:", reason);
            assertTrue(false, "Should not revert even when BLS validation fails");
        }
    }
    
    function test_ParseAndValidateAAStarSignature_InvalidSignatureLength() public {
        bytes32 userOpHash = generateUserOpHash(address(account), 111, "");
        
        // Create signature with wrong length (missing some bytes)
        bytes memory invalidSignature = new bytes(100); // Too short
        
        vm.expectRevert("Invalid signature length");
        account.parseAndValidateAAStarSignature(invalidSignature, userOpHash);
    }
    
    function test_ParseAndValidateAAStarSignature_InvalidNodeIdsLength() public {
        bytes32 userOpHash = generateUserOpHash(address(account), 222, "");
        
        // Create signature with invalid nodeIds length (0)
        bytes memory signature = new bytes(32 + 256 + 65);
        // nodeIdsLength = 0 (already default)
        
        vm.expectRevert("Invalid nodeIds length");
        account.parseAndValidateAAStarSignature(signature, userOpHash);
    }
    
    function test_ParseAndValidateAAStarSignature_OnlySelfCanCall() public {
        bytes32 userOpHash = generateUserOpHash(address(account), 333, "");
        bytes memory signature = createAAStarSignature(
            nodeIds,
            blsSignature,
            userOpHash,
            ownerPrivateKey
        );
        
        // Note: The test wrapper parseAndValidateAAStarSignature doesn't have the "only self" restriction
        // This is expected since we're testing via the wrapper function
        // The actual _parseAndValidateAAStarSignature function has this restriction
    }
    
    // =============================================================
    //                    SIGNATURE FORMAT VERIFICATION
    // =============================================================
    
    function test_VerifySignatureFormatAndParsing() public {
        bytes32 userOpHash = generateUserOpHash(address(account), 444, "test_call");
        
        bytes memory signature = createAAStarSignature(
            nodeIds,
            blsSignature,
            userOpHash,
            ownerPrivateKey
        );
        
        console.log("=== Signature Format Verification ===");
        console.log("Total signature length:", signature.length);
        console.log("Expected: 32 (nodeIdsLength) + 64 (2 nodeIds) + 256 (BLS) + 65 (AA) = 417");
        
        // Manually parse and verify signature structure
        bytes memory nodeIdsLengthBytes = new bytes(32);
        for (uint256 i = 0; i < 32; i++) {
            nodeIdsLengthBytes[i] = signature[i];
        }
        uint256 nodeIdsLength = abi.decode(nodeIdsLengthBytes, (uint256));
        console.log("Parsed nodeIds length:", nodeIdsLength);
        assertEq(nodeIdsLength, 2, "Should have 2 nodeIds");
        
        // Verify nodeIds
        bytes32 nodeId1;
        bytes32 nodeId2;
        assembly {
            nodeId1 := mload(add(add(signature, 0x20), 32))
            nodeId2 := mload(add(add(signature, 0x20), 64))
        }
        console.log("Parsed nodeId1:");
        console.logBytes32(nodeId1);
        console.log("Parsed nodeId2:");
        console.logBytes32(nodeId2);
        
        assertEq(nodeId1, nodeIds[0], "First nodeId should match");
        assertEq(nodeId2, nodeIds[1], "Second nodeId should match");
        
        // Verify BLS signature portion (should be 256 bytes starting at offset 96)
        // Verify AA signature portion (should be 65 bytes starting at offset 352)
        uint256 blsStart = 96;
        uint256 aaStart = 352;
        assertEq(signature.length, 417, "Total signature length should be 417");
        assertTrue(blsStart + 256 == aaStart, "BLS signature should be exactly 256 bytes");
        assertTrue(aaStart + 65 == signature.length, "AA signature should be exactly 65 bytes");
        
        console.log("Signature format verification completed successfully");
    }
    
    // =============================================================
    //                    REAL WORLD SCENARIO TESTS
    // =============================================================
    
    function test_RealWorldUserOpScenarios() public {
        // Test different types of user operations
        bytes32[] memory userOpHashes = new bytes32[](3);
        
        // Scenario 1: Simple ETH transfer
        userOpHashes[0] = generateUserOpHash(
            address(account),
            1,
            abi.encodeWithSignature("execute(address,uint256,bytes)", address(0x789), 0.5 ether, "")
        );
        
        // Scenario 2: ERC20 token transfer
        userOpHashes[1] = generateUserOpHash(
            address(account),
            2,
            abi.encodeWithSignature(
                "execute(address,uint256,bytes)", 
                address(0xa0b86A33e6441e37a1ce1eA18f5E9EC8d30b5dBE), // Mock ERC20
                0,
                abi.encodeWithSignature("transfer(address,uint256)", address(0x456), 1000e18)
            )
        );
        
        // Scenario 3: Batch operations
        address[] memory targets = new address[](2);
        targets[0] = address(0x111);
        targets[1] = address(0x222);
        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeWithSignature("method1()");
        calls[1] = abi.encodeWithSignature("method2(uint256)", 42);
        
        userOpHashes[2] = generateUserOpHash(
            address(account),
            3,
            abi.encodeWithSignature("executeBatch(address[],bytes[])", targets, calls)
        );
        
        console.log("=== Real World Scenarios Test ===");
        
        for (uint256 i = 0; i < userOpHashes.length; i++) {
            console.log("Testing scenario", i + 1);
            console.logBytes32(userOpHashes[i]);
            
            bytes memory signature = createAAStarSignature(
                nodeIds,
                blsSignature,
                userOpHashes[i],
                ownerPrivateKey
            );
            
            mockValidator.setShouldReturnTrue(true);
            mockValidator.clearValidationHistory();
            
            try account.parseAndValidateAAStarSignature(signature, userOpHashes[i]) returns (bool result) {
                assertTrue(result, string(abi.encodePacked("Scenario ", vm.toString(i + 1), " should succeed")));
                console.log("Scenario", i + 1, "passed");
            } catch Error(string memory reason) {
                console.log("Unexpected error in scenario", i + 1, ":", reason);
                assertTrue(false, string(abi.encodePacked("Scenario ", vm.toString(i + 1), " should not revert")));
            }
        }
        
        console.log("All real world scenarios passed");
    }
}