// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title FixedHashToCurveG2
 * @dev Fixed implementation based on actual Sepolia EIP-2537 behavior
 */
contract FixedHashToCurveG2 {
    // EIP-2537 precompile addresses
    address constant BLS12_G2ADD = address(0x0d);
    address constant BLS12_MAP_FP2_TO_G2 = address(0x11);
    
    // Hash-to-curve parameters
    string constant DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";
    
    event HashToCurveResult(bytes32 indexed input, bytes result);
    event Debug(string message, bytes data);
    
    /**
     * @dev Hash message to G2 point using actual Sepolia format
     * @param message The message to hash
     * @return G2 point as bytes
     */
    function hashToCurveG2Fixed(bytes memory message) public view returns (bytes memory) {
        // Generate two pseudo-random field elements from message
        bytes32 hash1 = keccak256(abi.encodePacked(message, uint8(1)));
        bytes32 hash2 = keccak256(abi.encodePacked(message, uint8(2)));
        
        // Create first Fp2 element
        bytes memory fp2Element1 = createFp2Element(hash1, hash2);
        
        // Map to G2 point
        bytes memory point1 = mapFp2ToG2(fp2Element1);
        
        // For now, return single point (in full implementation, would add two points)
        return point1;
    }
    
    /**
     * @dev Create properly formatted Fp2 element for EIP-2537
     * @param hash1 Source for c0 component  
     * @param hash2 Source for c1 component
     * @return 128-byte Fp2 element
     */
    function createFp2Element(bytes32 hash1, bytes32 hash2) internal pure returns (bytes memory) {
        bytes memory fp2 = new bytes(128);
        
        // Each Fp element is 64 bytes: 16 zero bytes + 48 value bytes
        // c0 component (first 64 bytes)
        // bytes 0-15: zeros (already initialized)
        // bytes 16-31: first 16 bytes of hash1  
        // bytes 32-47: remaining 16 bytes of hash1
        for (uint i = 0; i < 32; i++) {
            fp2[16 + i] = hash1[i];
        }
        
        // c1 component (next 64 bytes)  
        // bytes 64-79: zeros
        // bytes 80-95: first 16 bytes of hash2
        // bytes 96-111: remaining 16 bytes of hash2
        for (uint i = 0; i < 32; i++) {
            fp2[80 + i] = hash2[i];
        }
        
        return fp2;
    }
    
    /**
     * @dev Map Fp2 element to G2 using precompile
     * @param fp2Element 128-byte Fp2 element
     * @return G2 point bytes
     */
    function mapFp2ToG2(bytes memory fp2Element) internal view returns (bytes memory) {
        require(fp2Element.length == 128, "Invalid Fp2 element length");
        
        (bool success, bytes memory result) = BLS12_MAP_FP2_TO_G2.staticcall(fp2Element);
        require(success, "MAP_FP2_TO_G2 precompile failed");
        
        // Based on our testing, Sepolia returns 512 bytes instead of 256
        require(result.length == 256 || result.length == 512, 
            string(abi.encodePacked("Unexpected result length: ", Strings.toString(result.length))));
        
        return result;
    }
    
    /**
     * @dev Hash user operation to G2 point
     * @param userOpHash The user operation hash
     * @return G2 point as bytes
     */
    function hashUserOpToG2(bytes32 userOpHash) external view returns (bytes memory) {
        bytes memory message = abi.encodePacked(userOpHash);
        bytes memory result = hashToCurveG2Fixed(message);
        
        return result;
    }
    
    /**
     * @dev Test precompile availability  
     * @return true if precompiles work
     */
    function testPrecompiles() external view returns (bool) {
        bytes memory testInput = new bytes(128); // All zeros
        
        (bool success, bytes memory result) = BLS12_MAP_FP2_TO_G2.staticcall(testInput);
        return success && (result.length == 256 || result.length == 512);
    }
    
    /**
     * @dev Debug function to test specific inputs
     * @param hash1 First hash for Fp2 creation
     * @param hash2 Second hash for Fp2 creation  
     * @return result from precompile
     */
    function debugMapFp2ToG2(bytes32 hash1, bytes32 hash2) external view returns (bytes memory) {
        bytes memory fp2Element = createFp2Element(hash1, hash2);
        bytes memory result = mapFp2ToG2(fp2Element);
        
        return result;
    }
    
    /**
     * @dev Get raw precompile result for debugging
     * @param fp2Input Raw 128-byte Fp2 input
     * @return success and result from precompile
     */
    function rawPrecompileCall(bytes memory fp2Input) external view returns (bool success, bytes memory result) {
        require(fp2Input.length == 128, "Input must be 128 bytes");
        (success, result) = BLS12_MAP_FP2_TO_G2.staticcall(fp2Input);
    }
}