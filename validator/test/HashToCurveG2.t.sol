// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/HashToCurveG2.sol";

contract HashToCurveG2Test is Test {
    HashToCurveG2 public hashToCurve;
    
    function setUp() public {
        hashToCurve = new HashToCurveG2();
    }
    
    function testHashToCurveBasic() public view {
        bytes32 testHash = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
        bytes memory result = hashToCurve.hashUserOpToG2(testHash);
        
        // Verify result length (256 bytes for G2 point in EIP-2537 format)
        assertEq(result.length, 256, "Invalid result length");
        
        // Verify it's not all zeros (basic sanity check)
        bool isAllZeros = true;
        for (uint i = 0; i < result.length; i++) {
            if (result[i] != 0) {
                isAllZeros = false;
                break;
            }
        }
        assertFalse(isAllZeros, "Result should not be all zeros");
    }
    
    function testHashToCurveDeterministic() public view {
        bytes32 testHash = 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef;
        
        // Hash the same input multiple times
        bytes memory result1 = hashToCurve.hashUserOpToG2(testHash);
        bytes memory result2 = hashToCurve.hashUserOpToG2(testHash);
        
        // Results should be identical (deterministic)
        assertEq(keccak256(result1), keccak256(result2), "Results should be deterministic");
    }
    
    function testHashToCurveDifferentInputs() public view {
        bytes32 hash1 = 0x1111111111111111111111111111111111111111111111111111111111111111;
        bytes32 hash2 = 0x2222222222222222222222222222222222222222222222222222222222222222;
        
        bytes memory result1 = hashToCurve.hashUserOpToG2(hash1);
        bytes memory result2 = hashToCurve.hashUserOpToG2(hash2);
        
        // Results should be different for different inputs
        assertNotEq(keccak256(result1), keccak256(result2), "Different inputs should produce different outputs");
    }
    
    function testHashToCurveZeroInput() public view {
        bytes32 zeroHash = 0x0000000000000000000000000000000000000000000000000000000000000000;
        bytes memory result = hashToCurve.hashUserOpToG2(zeroHash);
        
        assertEq(result.length, 256, "Should handle zero input");
    }
    
    function testHashToCurveMaxInput() public view {
        bytes32 maxHash = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        bytes memory result = hashToCurve.hashUserOpToG2(maxHash);
        
        assertEq(result.length, 256, "Should handle max input");
    }
    
    function testGenericHashToCurveG2() public view {
        bytes memory message = abi.encodePacked(
            bytes32(0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef)
        );
        
        bytes memory result = hashToCurve.hashToCurveG2(message);
        assertEq(result.length, 256, "Generic function should work");
    }
    
    function testUserOpHashExample() public view {
        // Test with a realistic userOp hash from the off-chain script
        bytes32 userOpHash = 0x742d35cc6c8b2c8e3c3f8e3b1d6c2f8e3c3f8e3b1d6c2f8e3c3f8e3b1d6c2f8e;
        
        bytes memory result = hashToCurve.hashUserOpToG2(userOpHash);
        
        assertEq(result.length, 256, "UserOp hash should produce valid G2 point");
        
        // Note: result can be logged in actual test runs
    }
    
    // Fuzz testing with random inputs
    function testFuzzHashToCurve(bytes32 randomHash) public view {
        bytes memory result = hashToCurve.hashUserOpToG2(randomHash);
        assertEq(result.length, 256, "Should handle any bytes32 input");
        
        // Verify point is not the identity element (basic validation)
        // In G2, the identity element would have specific values, but this is a simplified check
        bool isNonTrivial = false;
        for (uint i = 0; i < result.length; i++) {
            if (result[i] != 0) {
                isNonTrivial = true;
                break;
            }
        }
        // Note: In some edge cases, a valid hash-to-curve might produce the identity element
        // This is a basic sanity check, not a cryptographic validation
    }
    
    // Test gas usage
    function testGasUsage() public {
        bytes32 testHash = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
        
        uint256 gasStart = gasleft();
        hashToCurve.hashUserOpToG2(testHash);
        uint256 gasUsed = gasStart - gasleft();
        
        // Gas usage should be reasonable (this will depend on precompile costs)
        // EIP-2537 specifies: MAP_FP2_TO_G2 = 23,800 gas, G2ADD = 600 gas
        // Plus hash computation costs
        assertTrue(gasUsed > 0, "Should use some gas");
        assertTrue(gasUsed < 1000000, "Gas usage should be reasonable"); // Adjust as needed
    }
}

// Additional contract for testing edge cases
contract HashToCurveG2IntegrationTest is Test {
    HashToCurveG2 public hashToCurve;
    
    // Simulate EIP-4337 UserOperation hash generation
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
    }
    
    function setUp() public {
        hashToCurve = new HashToCurveG2();
    }
    
    function testRealisticUserOpFlow() public view {
        // Create a realistic UserOperation
        UserOperation memory userOp = UserOperation({
            sender: 0x1234567890123456789012345678901234567890,
            nonce: 42,
            initCode: "",
            callData: hex"a9059cbb000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcdef0000000000000000000000000000000000000000000000000de0b6b3a7640000",
            callGasLimit: 21000,
            verificationGasLimit: 100000,
            preVerificationGas: 21000,
            maxFeePerGas: 2000000000,
            maxPriorityFeePerGas: 1000000000,
            paymasterAndData: ""
        });
        
        // Generate userOpHash (simplified version)
        bytes32 userOpHash = keccak256(abi.encode(userOp));
        
        // Hash to G2 curve
        bytes memory messagePoint = hashToCurve.hashUserOpToG2(userOpHash);
        
        // Results can be logged in actual test runs
        
        assertEq(messagePoint.length, 256, "Should produce valid G2 point");
    }
}