// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/AggregateSignatureValidator.sol";

contract PublicKeyAggregationTest is Test {
    AggregateSignatureValidator public validator;
    
    bytes16 constant NODE_UUID_1 = bytes16(0x123e4567e89b12d3a456426614174000);
    bytes16 constant NODE_UUID_2 = bytes16(0x123e4567e89b12d3a456426614174001);
    bytes16 constant NODE_UUID_3 = bytes16(0x123e4567e89b12d3a456426614174002);
    
    address constant NODE_ADDRESS_1 = address(0x1111111111111111111111111111111111111111);
    address constant NODE_ADDRESS_2 = address(0x2222222222222222222222222222222222222222);
    address constant NODE_ADDRESS_3 = address(0x3333333333333333333333333333333333333333);
    
    // Mock BLS public keys (48 bytes each - compressed G1 points)
    bytes constant PUBLIC_KEY_1 = hex"97f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb";
    bytes constant PUBLIC_KEY_2 = hex"8b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e10";
    bytes constant PUBLIC_KEY_3 = hex"93e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7e";
    
    // Mock signature and message point data (256 bytes each for G2 points)
    bytes constant MOCK_SIGNATURE = hex"000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff";
    bytes constant MOCK_MESSAGE_POINT = hex"808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f";
    
    event SignatureValidated(bytes16[] indexed participantUUIDs, bool success, uint256 timestamp);
    
    function setUp() public {
        validator = new AggregateSignatureValidator();
        
        // Register test nodes with their public keys
        validator.registerNode(NODE_UUID_1, NODE_ADDRESS_1, PUBLIC_KEY_1, "Test Node 1");
        validator.registerNode(NODE_UUID_2, NODE_ADDRESS_2, PUBLIC_KEY_2, "Test Node 2");
        validator.registerNode(NODE_UUID_3, NODE_ADDRESS_3, PUBLIC_KEY_3, "Test Node 3");
    }
    
    function testRegisterNodeWithPublicKey() public view {
        AggregateSignatureValidator.NodeInfo memory nodeInfo = validator.getNodeInfo(NODE_UUID_1);
        
        assertEq(nodeInfo.uuid, NODE_UUID_1);
        assertEq(nodeInfo.nodeAddress, NODE_ADDRESS_1);
        assertEq(nodeInfo.publicKey, PUBLIC_KEY_1);
        assertTrue(nodeInfo.isActive);
        assertEq(nodeInfo.metadata, "Test Node 1");
    }
    
    function testRegisterNodePublicKeyValidation() public {
        // Test invalid public key length
        bytes memory shortKey = hex"97f1d3a73197d794";
        
        vm.expectRevert("Public key must be 48 bytes");
        validator.registerNode(
            bytes16(0x99999999999999999999999999999999),
            NODE_ADDRESS_1,
            shortKey,
            "Invalid key node"
        );
    }
    
    function testValidateSignatureNewAPI() public {
        bytes16[] memory participantUUIDs = new bytes16[](1);
        participantUUIDs[0] = NODE_UUID_1;
        
        // This should fail cryptographically but pass node validation and key aggregation
        vm.expectEmit(false, false, false, true);
        emit SignatureValidated(participantUUIDs, false, block.timestamp);
        
        bool result = validator.validateSignature(
            MOCK_SIGNATURE,
            MOCK_MESSAGE_POINT,
            participantUUIDs
        );
        
        assertFalse(result); // Mock data will fail crypto validation
        
        // Verify that last active timestamp was updated
        AggregateSignatureValidator.NodeInfo memory nodeInfo = validator.getNodeInfo(NODE_UUID_1);
        assertEq(nodeInfo.lastActiveAt, block.timestamp);
    }
    
    function testValidateSignatureMultipleNodes() public {
        bytes16[] memory participantUUIDs = new bytes16[](3);
        participantUUIDs[0] = NODE_UUID_1;
        participantUUIDs[1] = NODE_UUID_2;
        participantUUIDs[2] = NODE_UUID_3;
        
        vm.expectEmit(false, false, false, true);
        emit SignatureValidated(participantUUIDs, false, block.timestamp);
        
        bool result = validator.validateSignature(
            MOCK_SIGNATURE,
            MOCK_MESSAGE_POINT,
            participantUUIDs
        );
        
        assertFalse(result); // Mock data will fail crypto validation
        
        // Verify all nodes were updated
        for (uint256 i = 0; i < participantUUIDs.length; i++) {
            AggregateSignatureValidator.NodeInfo memory nodeInfo = validator.getNodeInfo(participantUUIDs[i]);
            assertEq(nodeInfo.lastActiveAt, block.timestamp);
        }
    }
    
    function testValidateSignatureRequiresActiveNodes() public {
        validator.deactivateNode(NODE_UUID_1);
        
        bytes16[] memory participantUUIDs = new bytes16[](1);
        participantUUIDs[0] = NODE_UUID_1;
        
        vm.expectRevert("Participant node is not active");
        validator.validateSignature(
            MOCK_SIGNATURE,
            MOCK_MESSAGE_POINT,
            participantUUIDs
        );
    }
    
    function testValidateSignatureRequiresExistingNodes() public {
        bytes16[] memory participantUUIDs = new bytes16[](1);
        participantUUIDs[0] = bytes16(0x99999999999999999999999999999999);
        
        vm.expectRevert("Participant node does not exist");
        validator.validateSignature(
            MOCK_SIGNATURE,
            MOCK_MESSAGE_POINT,
            participantUUIDs
        );
    }
    
    function testValidateUserOpNewFormat() public {
        // Create signature data with new format: [numParticipants][UUIDs][signature][messagePoint]
        bytes memory signatureData = abi.encodePacked(
            uint8(2),              // 2 participants
            NODE_UUID_1,          // First UUID (16 bytes)
            NODE_UUID_2,          // Second UUID (16 bytes) 
            MOCK_SIGNATURE,       // Signature (256 bytes)
            MOCK_MESSAGE_POINT    // Message point (256 bytes)
        );
        
        bytes16[] memory expectedUUIDs = new bytes16[](2);
        expectedUUIDs[0] = NODE_UUID_1;
        expectedUUIDs[1] = NODE_UUID_2;
        
        vm.expectEmit(false, false, false, true);
        emit SignatureValidated(expectedUUIDs, false, block.timestamp);
        
        bool result = validator.validateUserOp(bytes32(0), signatureData);
        assertFalse(result); // Mock data will fail crypto validation
    }
    
    function testValidateUserOpInvalidFormat() public {
        // Test data too short (empty)
        bytes memory shortData = hex"";
        vm.expectRevert("Signature data too short");
        validator.validateUserOp(bytes32(0), shortData);
        
        // Test no participants
        bytes memory noParticipants = hex"00010203040506070809";
        vm.expectRevert("No participants specified");
        validator.validateUserOp(bytes32(0), noParticipants);
        
        // Test insufficient data for signature components
        bytes memory insufficientData = abi.encodePacked(uint8(1), NODE_UUID_1);
        vm.expectRevert("Insufficient data for UUIDs and signature components");
        validator.validateUserOp(bytes32(0), insufficientData);
    }
    
    function testValidationRequirements() public {
        bytes16[] memory emptyUUIDs = new bytes16[](0);
        
        vm.expectRevert("No participant UUIDs provided");
        validator.validateSignature(
            MOCK_SIGNATURE,
            MOCK_MESSAGE_POINT,
            emptyUUIDs
        );
        
        bytes16[] memory validUUIDs = new bytes16[](1);
        validUUIDs[0] = NODE_UUID_1;
        
        bytes memory shortSignature = hex"8000";
        vm.expectRevert("Invalid signature length");
        validator.validateSignature(
            shortSignature,
            MOCK_MESSAGE_POINT,
            validUUIDs
        );
        
        bytes memory shortMessage = hex"8000";
        vm.expectRevert("Invalid message length");
        validator.validateSignature(
            MOCK_SIGNATURE,
            shortMessage,
            validUUIDs
        );
    }
    
    function testUpdatedGasEstimates() public view {
        (uint256 directGas, uint256 userOpGas) = validator.getGasEstimates();
        
        assertEq(directGas, 250000);
        assertEq(userOpGas, 270000);
    }
    
    function testUpdatedSignatureFormat() public view {
        string memory format = validator.getSignatureFormat();
        
        // Just verify it returns a non-empty string with correct information
        assertTrue(bytes(format).length > 0);
        assertTrue(bytes(format).length > 50); // Should be a descriptive string
    }
}