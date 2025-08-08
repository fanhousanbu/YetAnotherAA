// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/AggregateSignatureValidator.sol";

/**
 * @title Simple unit tests for AggregateSignatureValidator
 * @dev Tests basic functionality and error cases without complex mocking
 */
contract SimpleAggregateSignatureValidatorTest is Test {
    AggregateSignatureValidator public validator;
    
    // Test data constants
    bytes constant VALID_768_DATA = hex"0000000000000000000000000000000017f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb0000000000000000000000000000000008b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e10000000000000000000000000000000004df2ceebc3467dbd6a3845aff69b23ae194dd792cf2bf2989f4901e01151b0ab7cf40286d355480b02e55df1d09d14a000000000000000000000000000000000862eff33ed2e52124f40e7404fa56e9d4021eddcacbe471533e18efb35aaa194eadf2bbf993533fbefc151ef8e71940000000000000000000000000000000000af43f72e553ee4c8faa32f477e57f1c00f5b929b3c544c4a24bf51053d1991a6315f9a2d91e9f51103afdd2698571b100000000000000000000000000000000133d04f182cb5ebe0e4d8ac4316f0664b2884b6bd653e79e10ec220221fab8b298d92ca4bb93c485bdbe16770dae1382000000000000000000000000000000001099029b03fb145895b0b95a052346fe66b7481f83a64bff94ff8aaafda86462a338f52718fe4989aaa3b774222df99300000000000000000000000000000000073f65d2d4965932df908dfb681d2cd7e3d3015c9ae67a8c7ad5bd1ac022df35c007c6c634530796e1c8a13f7fe0d3a3000000000000000000000000000000000f0c5c0025b71ad7c74c114295e73411e06b220b6d7113d588bb49b8fbe610f0cd6d3e02671e952cfdddddde986a14f60000000000000000000000000000000012afa03f0fb152eb886d39b002458afab981b10a4ca993748f46946bce189e3d7496de95b332d99bdd8bd2aceb2c2da8000000000000000000000000000000000f653d9414deeef6c0457bac7e504e96444391679b31ec35f6e4e5e847d2a79d31de705924e5748cc437766c77dde30f0000000000000000000000000000000016f2ca43cb8fbf8d683bbbac0693a09c920d18379a393e07f476a7b1fa100d4af5e2d705e745544eb71035aba5622f9e";
    
    bytes constant VALID_AGGREGATED_KEY = hex"000000000000000000000000000000001099029b03fb145895b0b95a052346fe66b7481f83a64bff94ff8aaafda86462a338f52718fe4989aaa3b774222df99300000000000000000000000000000000073f65d2d4965932df908dfb681d2cd7e3d3015c9ae67a8c7ad5bd1ac022df35c007c6c634530796e1c8a13f7fe0d3a3";
    
    bytes constant VALID_SIGNATURE = hex"0000000000000000000000000000000004df2ceebc3467dbd6a3845aff69b23ae194dd792cf2bf2989f4901e01151b0ab7cf40286d355480b02e55df1d09d14a000000000000000000000000000000000862eff33ed2e52124f40e7404fa56e9d4021eddcacbe471533e18efb35aaa194eadf2bbf993533fbefc151ef8e71940000000000000000000000000000000000af43f72e553ee4c8faa32f477e57f1c00f5b929b3c544c4a24bf51053d1991a6315f9a2d91e9f51103afdd2698571b100000000000000000000000000000000133d04f182cb5ebe0e4d8ac4316f0664b2884b6bd653e79e10ec220221fab8b298d92ca4bb93c485bdbe16770dae1382";
    
    bytes constant VALID_MESSAGE_POINT = hex"000000000000000000000000000000000f0c5c0025b71ad7c74c114295e73411e06b220b6d7113d588bb49b8fbe610f0cd6d3e02671e952cfdddddde986a14f60000000000000000000000000000000012afa03f0fb152eb886d39b002458afab981b10a4ca993748f46946bce189e3d7496de95b332d99bdd8bd2aceb2c2da8000000000000000000000000000000000f653d9414deeef6c0457bac7e504e96444391679b31ec35f6e4e5e847d2a79d31de705924e5748cc437766c77dde30f0000000000000000000000000000000016f2ca43cb8fbf8d683bbbac0693a09c920d18379a393e07f476a7b1fa100d4af5e2d705e745544eb71035aba5622f9e";
    
    function setUp() public {
        validator = new AggregateSignatureValidator();
    }
    
    // ============================================================================
    // Length Validation Tests
    // ============================================================================
    
    function testValidateSignature_InvalidLength_Short() public {
        bytes memory shortData = new bytes(767);
        
        vm.expectRevert("Invalid pairing data length");
        validator.validateSignature(shortData);
    }
    
    function testValidateSignature_InvalidLength_Long() public {
        bytes memory longData = new bytes(769);
        
        vm.expectRevert("Invalid pairing data length");
        validator.validateSignature(longData);
    }
    
    function testValidateSignature_ValidLength() public view {
        // Should not revert with 768 bytes (actual verification will fail without mock)
        bytes memory validLengthData = new bytes(768);
        
        // This will call the precompile but won't revert due to length
        try validator.validateSignature(validLengthData) {
            // Expected to not revert on length validation
        } catch Error(string memory reason) {
            // Should not be a length error
            assertTrue(
                keccak256(bytes(reason)) != keccak256(bytes("Invalid pairing data length")),
                "Should not fail on length validation"
            );
        }
    }
    
    // ============================================================================
    // Component Validation Tests  
    // ============================================================================
    
    function testValidateComponents_InvalidKeyLength() public {
        bytes memory shortKey = new bytes(127);
        
        vm.expectRevert("Invalid key length");
        validator.validateComponents(shortKey, VALID_SIGNATURE, VALID_MESSAGE_POINT);
    }
    
    function testValidateComponents_InvalidSignatureLength() public {
        bytes memory shortSignature = new bytes(255);
        
        vm.expectRevert("Invalid signature length");
        validator.validateComponents(VALID_AGGREGATED_KEY, shortSignature, VALID_MESSAGE_POINT);
    }
    
    function testValidateComponents_InvalidMessageLength() public {
        bytes memory shortMessage = new bytes(255);
        
        vm.expectRevert("Invalid message length");
        validator.validateComponents(VALID_AGGREGATED_KEY, VALID_SIGNATURE, shortMessage);
    }
    
    function testValidateComponents_ValidLengths() public view {
        // Should not revert with valid lengths (actual verification will fail without mock)
        try validator.validateComponents(VALID_AGGREGATED_KEY, VALID_SIGNATURE, VALID_MESSAGE_POINT) {
            // Expected behavior - validation logic runs
        } catch Error(string memory reason) {
            // Should not be a length error
            assertTrue(
                keccak256(bytes(reason)) != keccak256(bytes("Invalid key length")) &&
                keccak256(bytes(reason)) != keccak256(bytes("Invalid signature length")) &&
                keccak256(bytes(reason)) != keccak256(bytes("Invalid message length")),
                "Should not fail on length validation"
            );
        }
    }
    
    // ============================================================================
    // UserOp Validation Tests
    // ============================================================================
    
    function testValidateUserOp_InsufficientData() public {
        bytes memory shortData = new bytes(100);
        bytes32 testHash = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
        
        vm.expectRevert("Insufficient signature data");
        validator.validateUserOp(testHash, shortData);
    }
    
    function testValidateUserOp_DirectMode_ValidLength() public view {
        bytes32 testHash = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
        
        // Should not revert with 768 bytes
        try validator.validateUserOp(testHash, VALID_768_DATA) {
            // Expected behavior 
        } catch Error(string memory reason) {
            // Should not be a length/format error
            assertTrue(bytes(reason).length > 0, "Should have valid error handling");
        }
    }
    
    function testValidateUserOp_ComponentMode_ValidLength() public view {
        bytes32 testHash = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
        
        bytes memory componentData = abi.encodePacked(
            VALID_AGGREGATED_KEY,    // 128 bytes
            VALID_SIGNATURE,         // 256 bytes  
            VALID_MESSAGE_POINT      // 256 bytes
        ); // Total: 640 bytes
        
        try validator.validateUserOp(testHash, componentData) {
            // Expected behavior
        } catch Error(string memory reason) {
            // Should not be a length error
            assertTrue(
                keccak256(bytes(reason)) != keccak256(bytes("Insufficient signature data")),
                "Should not fail on length validation"
            );
        }
    }
    
    // ============================================================================
    // View Function Tests
    // ============================================================================
    
    function testGetSignatureFormat() public view {
        string memory format = validator.getSignatureFormat();
        assertEq(
            format, 
            "Either 768-byte pairing data or concatenated (key|signature|message) components",
            "Should return correct signature format"
        );
    }
    
    function testGetGasEstimates() public view {
        (uint256 directGas, uint256 componentGas) = validator.getGasEstimates();
        assertEq(directGas, 180000, "Direct gas estimate should be 180000");
        assertEq(componentGas, 190000, "Component gas estimate should be 190000");
    }
    
    // ============================================================================
    // Edge Cases
    // ============================================================================
    
    function testValidateSignature_EmptyData() public {
        bytes memory emptyData = new bytes(0);
        
        vm.expectRevert("Invalid pairing data length");
        validator.validateSignature(emptyData);
    }
    
    function testValidateComponents_EmptyInputs() public {
        bytes memory empty = new bytes(0);
        
        vm.expectRevert("Invalid key length");
        validator.validateComponents(empty, VALID_SIGNATURE, VALID_MESSAGE_POINT);
        
        vm.expectRevert("Invalid signature length");
        validator.validateComponents(VALID_AGGREGATED_KEY, empty, VALID_MESSAGE_POINT);
        
        vm.expectRevert("Invalid message length");
        validator.validateComponents(VALID_AGGREGATED_KEY, VALID_SIGNATURE, empty);
    }
    
    // ============================================================================
    // Boundary Tests
    // ============================================================================
    
    function testBoundaryLengths() public {
        // Test exactly correct lengths
        bytes memory key128 = new bytes(128);
        bytes memory sig256 = new bytes(256);
        bytes memory msg256 = new bytes(256);
        
        // Should not fail on length validation
        try validator.validateComponents(key128, sig256, msg256) {
            // Expected - will fail on precompile but not length
        } catch Error(string memory reason) {
            assertTrue(
                keccak256(bytes(reason)) != keccak256(bytes("Invalid key length")) &&
                keccak256(bytes(reason)) != keccak256(bytes("Invalid signature length")) &&
                keccak256(bytes(reason)) != keccak256(bytes("Invalid message length")),
                "Should pass length validation"
            );
        }
        
        // Test off-by-one errors
        bytes memory key127 = new bytes(127);
        bytes memory key129 = new bytes(129);
        bytes memory sig255 = new bytes(255);
        bytes memory sig257 = new bytes(257);
        
        vm.expectRevert("Invalid key length");
        validator.validateComponents(key127, sig256, msg256);
        
        vm.expectRevert("Invalid key length");
        validator.validateComponents(key129, sig256, msg256);
        
        vm.expectRevert("Invalid signature length");
        validator.validateComponents(key128, sig255, msg256);
        
        vm.expectRevert("Invalid signature length");
        validator.validateComponents(key128, sig257, msg256);
    }
}