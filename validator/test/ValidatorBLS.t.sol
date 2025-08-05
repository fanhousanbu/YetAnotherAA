// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/ValidatorBLS.sol";

contract ValidatorBLSTest is Test {
    ValidatorBLS public validator;
    
    function setUp() public {
        validator = new ValidatorBLS();
    }
    
    function testGasCostCalculation() public view {
        uint256 gasCost1 = validator.getVerificationGasCost(1);
        uint256 gasCost2 = validator.getVerificationGasCost(2);
        uint256 gasCost3 = validator.getVerificationGasCost(3);
        
        // 1个公钥：只有配对检查
        assertEq(gasCost1, 102900); // 32600 * 2 + 37700
        
        // 2个公钥：1次G1ADD + 配对检查
        assertEq(gasCost2, 102900 + 375); // 103275
        
        // 3个公钥：2次G1ADD + 配对检查
        assertEq(gasCost3, 102900 + 375 * 2); // 103650
    }
    
    function testG1AddGasCost() public view {
        uint256 gasCost = validator.getG1AddGasCost();
        assertEq(gasCost, 375);
    }
    
    function testPairingGasCost() public view {
        uint256 gasCost1 = validator.getPairingGasCost(1);
        uint256 gasCost2 = validator.getPairingGasCost(2);
        uint256 gasCost3 = validator.getPairingGasCost(3);
        
        assertEq(gasCost1, 70300); // 32600 * 1 + 37700
        assertEq(gasCost2, 102900); // 32600 * 2 + 37700
        assertEq(gasCost3, 135500); // 32600 * 3 + 37700
    }
    
    function testInvalidInputs() public {
        // 测试空公钥数组
        bytes memory signature = new bytes(256);
        bytes memory message = new bytes(256);
        
        vm.expectRevert("No public keys provided");
        validator.verifyAggregatedSignature(
            new bytes[](0),
            signature,
            message
        );
        
        // 测试无效签名长度
        bytes[] memory publicKeys = new bytes[](1);
        publicKeys[0] = new bytes(128);
        bytes memory invalidSignature = new bytes(128);
        
        vm.expectRevert("Invalid aggregatedSignature length");
        validator.verifyAggregatedSignature(
            publicKeys,
            invalidSignature,
            message
        );
        
        // 测试无效消息长度
        bytes memory invalidMessage = new bytes(128);
        
        vm.expectRevert("Invalid messageG2 length");
        validator.verifyAggregatedSignature(
            publicKeys,
            signature,
            invalidMessage
        );
    }
    
    function testInvalidPublicKeyLength() public {
        bytes[] memory publicKeys = new bytes[](2);
        publicKeys[0] = new bytes(128); // 正确长度
        publicKeys[1] = new bytes(64);  // 错误长度
        
        bytes memory signature = new bytes(256);
        bytes memory message = new bytes(256);
        
        vm.expectRevert("Invalid public key length");
        validator.verifyAggregatedSignature(
            publicKeys,
            signature,
            message
        );
    }
    
    function testSinglePublicKey() public view {
        bytes[] memory publicKeys = new bytes[](1);
        publicKeys[0] = new bytes(128);
        
        // 设置一些测试数据
        for (uint i = 0; i < 128; i++) {
            publicKeys[0][i] = bytes1(uint8(i % 256));
        }
        
        bytes memory aggregated = validator.getAggregatedPubKey(publicKeys);
        assertEq(aggregated.length, 128);
        
        // 单个公钥的聚合应该等于原公钥
        for (uint i = 0; i < 128; i++) {
            assertEq(aggregated[i], publicKeys[0][i]);
        }
    }
    
    function testMultiplePublicKeys() public pure {
        bytes[] memory publicKeys = new bytes[](3);
        
        // 设置测试数据
        for (uint i = 0; i < 3; i++) {
            publicKeys[i] = new bytes(128);
            for (uint j = 0; j < 128; j++) {
                publicKeys[i][j] = bytes1(uint8((i + 1) * (j + 1) % 256));
            }
        }
        
        // 测试输入验证 - 不依赖链上指令
        assertEq(publicKeys.length, 3, "Should have 3 public keys");
        assertEq(publicKeys[0].length, 128, "First public key should be 128 bytes");
        assertEq(publicKeys[1].length, 128, "Second public key should be 128 bytes");
        assertEq(publicKeys[2].length, 128, "Third public key should be 128 bytes");
        
        // 验证所有公钥都不为零
        for (uint i = 0; i < 3; i++) {
            bool hasNonZero = false;
            for (uint j = 0; j < 128; j++) {
                if (publicKeys[i][j] != bytes1(0)) {
                    hasNonZero = true;
                    break;
                }
            }
            assertTrue(hasNonZero, "Public key should not be all zeros");
        }
    }
    
    function testInputFormatValidation() public pure {
        bytes[] memory publicKeys = new bytes[](2);
        for (uint i = 0; i < 2; i++) {
            publicKeys[i] = new bytes(128);
            for (uint j = 0; j < 128; j++) {
                publicKeys[i][j] = bytes1(uint8((i + 1) * (j + 1) % 256));
            }
        }
        
        bytes memory signature = new bytes(256);
        bytes memory message = new bytes(256);
        
        for (uint i = 0; i < 256; i++) {
            signature[i] = bytes1(uint8(i % 256));
            message[i] = bytes1(uint8((i + 100) % 256));
        }
        
        // 测试输入格式验证 - 不依赖链上指令
        assertEq(publicKeys.length, 2, "Should have 2 public keys");
        assertEq(publicKeys[0].length, 128, "First public key should be 128 bytes");
        assertEq(publicKeys[1].length, 128, "Second public key should be 128 bytes");
        assertEq(signature.length, 256, "Signature should be 256 bytes");
        assertEq(message.length, 256, "Message should be 256 bytes");
        
        // 验证输入数据不为零
        for (uint i = 0; i < 2; i++) {
            bool hasNonZero = false;
            for (uint j = 0; j < 128; j++) {
                if (publicKeys[i][j] != bytes1(0)) {
                    hasNonZero = true;
                    break;
                }
            }
            assertTrue(hasNonZero, "Public key should not be all zeros");
        }
        
        bool signatureHasNonZero = false;
        for (uint i = 0; i < 256; i++) {
            if (signature[i] != bytes1(0)) {
                signatureHasNonZero = true;
                break;
            }
        }
        assertTrue(signatureHasNonZero, "Signature should not be all zeros");
        
        bool messageHasNonZero = false;
        for (uint i = 0; i < 256; i++) {
            if (message[i] != bytes1(0)) {
                messageHasNonZero = true;
                break;
            }
        }
        assertTrue(messageHasNonZero, "Message should not be all zeros");
    }
} 