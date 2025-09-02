// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleTestContract {
    address constant MAP_FP2_TO_G2 = address(0x11);
    
    function testZeroInput() external view returns (bool success, uint256 resultLength, bytes memory result) {
        bytes memory input = new bytes(128); // All zeros
        (success, result) = MAP_FP2_TO_G2.staticcall(input);
        resultLength = result.length;
    }
    
    function testCustomInput(bytes memory input) external view returns (bool success, uint256 resultLength, bytes memory result) {
        require(input.length == 128, "Input must be 128 bytes");
        (success, result) = MAP_FP2_TO_G2.staticcall(input);
        resultLength = result.length;
    }
    
    function createSimpleFp2(bytes32 hash) external pure returns (bytes memory) {
        bytes memory fp2 = new bytes(128);
        
        // Put hash in the last 32 bytes of first Fp element (c0)
        for (uint i = 0; i < 32; i++) {
            fp2[32 + i] = hash[i];
        }
        
        // Second Fp element (c1) stays zero
        
        return fp2;
    }
    
    function hashToG2Simple(bytes32 userOpHash) external view returns (bool success, bytes memory result) {
        // Create Fp2 element from hash
        bytes memory fp2Element = new bytes(128);
        
        // Simple approach: put hash bytes directly in appropriate positions
        // First Fp element (c0): put hash in last 32 bytes
        for (uint i = 0; i < 32; i++) {
            fp2Element[32 + i] = userOpHash[i];
        }
        
        // Second Fp element (c1): leave as zero
        
        // Call precompile
        (success, result) = MAP_FP2_TO_G2.staticcall(fp2Element);
    }
}