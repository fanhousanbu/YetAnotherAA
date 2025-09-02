// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title WorkingHashToCurveG2
 * @dev Working implementation for BLS12-381 hash-to-curve on Sepolia
 */
contract WorkingHashToCurveG2 {
    address constant BLS12_MAP_FP2_TO_G2 = address(0x11);
    
    event HashResult(bytes32 indexed userOpHash, bytes result);
    
    /**
     * @dev Hash user operation to G2 point  
     * @param userOpHash The user operation hash
     * @return G2 point as bytes
     */
    function hashUserOpToG2(bytes32 userOpHash) external view returns (bytes memory) {
        // Create Fp2 element from userOpHash using simple but effective method
        bytes memory fp2Element = createFp2FromHash(userOpHash);
        
        // Call MAP_FP2_TO_G2 precompile
        (bool success, bytes memory result) = BLS12_MAP_FP2_TO_G2.staticcall(fp2Element);
        require(success, "MAP_FP2_TO_G2 failed");
        require(result.length > 0, "Empty result from precompile");
        
        return result;
    }
    
    /**
     * @dev Create Fp2 element from hash for hash-to-curve
     * @param userOpHash Source hash
     * @return 128-byte Fp2 element
     */
    function createFp2FromHash(bytes32 userOpHash) public pure returns (bytes memory) {
        bytes memory fp2 = new bytes(128);
        
        // Method: Use hash to create two field elements
        // First field element (c0): use first half of hash
        // Second field element (c1): use second half of hash
        
        // Create c0 from first 16 bytes of hash (padded to 64 bytes)
        for (uint i = 0; i < 16; i++) {
            fp2[48 + i] = userOpHash[i];  // Put in last 16 bytes of 64-byte element
        }
        
        // Create c1 from last 16 bytes of hash (padded to 64 bytes)  
        for (uint i = 0; i < 16; i++) {
            fp2[112 + i] = userOpHash[16 + i]; // Put in last 16 bytes of second 64-byte element
        }
        
        return fp2;
    }
    
    /**
     * @dev Hash message bytes to G2 point (generic version)
     * @param message Message to hash
     * @return G2 point as bytes
     */
    function hashMessageToG2(bytes memory message) external view returns (bytes memory) {
        // For simplicity, hash message to get 32-byte seed, then use same logic
        bytes32 messageHash = keccak256(message);
        bytes memory fp2Element = createFp2FromHash(messageHash);
        
        (bool success, bytes memory result) = BLS12_MAP_FP2_TO_G2.staticcall(fp2Element);
        require(success, "MAP_FP2_TO_G2 failed");
        require(result.length > 0, "Empty result from precompile");
        
        return result;
    }
    
    /**
     * @dev Test precompile with zero input
     * @return success and result
     */
    function testPrecompile() external view returns (bool success, uint256 resultLength, bytes memory result) {
        bytes memory zeroInput = new bytes(128);
        (success, result) = BLS12_MAP_FP2_TO_G2.staticcall(zeroInput);
        resultLength = result.length;
    }
    
    /**
     * @dev Get the Fp2 element that would be used for a given hash
     * @param userOpHash The hash
     * @return The Fp2 element bytes
     */
    function getFp2Element(bytes32 userOpHash) external pure returns (bytes memory) {
        return createFp2FromHash(userOpHash);
    }
}