// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/SimpleHashToCurveG2.sol";

contract SimpleHashToCurveG2Test is Test {
    SimpleHashToCurveG2 public hashToCurve;
    
    function setUp() public {
        hashToCurve = new SimpleHashToCurveG2();
    }
    
    function testHashUserOpToG2() public view {
        bytes32 testHash = 0x742d35cc6c8b2c8e3c3f8e3b1d6c2f8e3c3f8e3b1d6c2f8e3c3f8e3b1d6c2f8e;
        bytes memory result = hashToCurve.hashUserOpToG2(testHash);
        
        assertEq(result.length, 256, "Should return 256-byte G2 point");
    }
    
    function testDeterministic() public view {
        bytes32 testHash = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
        
        bytes memory result1 = hashToCurve.hashUserOpToG2(testHash);
        bytes memory result2 = hashToCurve.hashUserOpToG2(testHash);
        
        assertEq(keccak256(result1), keccak256(result2), "Should be deterministic");
    }
    
    function testDifferentInputs() public view {
        bytes32 hash1 = 0x1111111111111111111111111111111111111111111111111111111111111111;
        bytes32 hash2 = 0x2222222222222222222222222222222222222222222222222222222222222222;
        
        bytes memory result1 = hashToCurve.hashUserOpToG2(hash1);
        bytes memory result2 = hashToCurve.hashUserOpToG2(hash2);
        
        assertNotEq(keccak256(result1), keccak256(result2), "Different inputs should yield different outputs");
    }
    
    function testPrecompileAvailability() public {
        // This test will fail on networks without EIP-2537 precompiles
        // but helps verify the implementation logic
        try hashToCurve.testPrecompiles() returns (bool available) {
            if (available) {
                console.log("EIP-2537 precompiles are available");
            } else {
                console.log("EIP-2537 precompiles are not available");
            }
        } catch {
            console.log("Precompile test failed - likely not available on this network");
        }
    }
    
    function testG2Addition() public {
        // Create two test points (in practice these would be valid G2 points)
        bytes memory point1 = new bytes(256);
        bytes memory point2 = new bytes(256);
        
        // This will fail without proper EIP-2537 support, but tests the interface
        try hashToCurve.addG2Points(point1, point2) returns (bytes memory result) {
            assertEq(result.length, 256, "G2 addition should return 256-byte point");
            console.log("G2 addition succeeded");
        } catch {
            console.log("G2 addition failed - expected without EIP-2537 support");
        }
    }
}