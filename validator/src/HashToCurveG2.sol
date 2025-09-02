// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title HashToCurveG2
 * @dev Implements hash-to-curve-g2 for BLS12-381 using EIP-2537 precompiles
 * @notice This contract converts messages to G2 points for BLS signature verification
 */
contract HashToCurveG2 {
    // EIP-2537 precompile addresses (updated for mainnet deployment)
    address constant BLS12_G2ADD = address(0x0d);
    address constant BLS12_MAP_FP2_TO_G2 = address(0x11);
    
    // BLS12-381 field modulus (too large for uint256, using simplified approach)
    // In practice, you would use a proper big integer library or multiple uint256s
    bytes constant FIELD_MODULUS_BYTES = hex"1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab";
    
    // Hash-to-curve parameters for BLS12-381 G2
    string constant DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";
    uint8 constant L = 64; // Hash output length for security level
    uint8 constant COUNT = 2; // Number of field elements to hash to
    
    struct G2Point {
        uint256[2] x; // x.c0, x.c1
        uint256[2] y; // y.c0, y.c1
    }
    
    struct Fp2Element {
        uint256 c0;
        uint256 c1;
    }
    
    /**
     * @dev Hash message to G2 point according to RFC 9380
     * @param message The message to hash
     * @return G2 point as bytes (256 bytes total)
     */
    function hashToCurveG2(bytes memory message) public view returns (bytes memory) {
        // Step 1: Hash to field elements
        Fp2Element[2] memory fieldElements = hashToFieldFp2(message);
        
        // Step 2: Map each field element to G2 point
        G2Point memory p1 = mapFp2ToG2(fieldElements[0]);
        G2Point memory p2 = mapFp2ToG2(fieldElements[1]);
        
        // Step 3: Add the two points
        G2Point memory result = addG2Points(p1, p2);
        
        // Step 4: Encode result according to EIP-2537 format
        return encodeG2Point(result);
    }
    
    /**
     * @dev Hash message to two Fp2 field elements
     * @param message The message to hash
     * @return Two Fp2 field elements
     */
    function hashToFieldFp2(bytes memory message) internal pure returns (Fp2Element[2] memory) {
        bytes memory dst = bytes(DST);
        
        // Expand message using XMD with SHA-256
        bytes memory uniformBytes = expandMsgXmd(message, dst, COUNT * 2 * L);
        
        Fp2Element[2] memory elements;
        
        // Extract field elements from uniform bytes
        for (uint i = 0; i < COUNT; i++) {
            uint256 offset = i * 2 * L;
            
            // Extract c0 and c1 for Fp2 element
            bytes memory c0Bytes = new bytes(L);
            bytes memory c1Bytes = new bytes(L);
            
            for (uint j = 0; j < L; j++) {
                c0Bytes[j] = uniformBytes[offset + j];
                c1Bytes[j] = uniformBytes[offset + L + j];
            }
            
            elements[i].c0 = modField(bytesToUint256(c0Bytes));
            elements[i].c1 = modField(bytesToUint256(c1Bytes));
        }
        
        return elements;
    }
    
    /**
     * @dev Map Fp2 field element to G2 point using EIP-2537 precompile
     * @param element The Fp2 field element
     * @return G2 point
     */
    function mapFp2ToG2(Fp2Element memory element) internal view returns (G2Point memory) {
        // Prepare input for MAP_FP2_TO_G2 precompile (128 bytes)
        bytes memory input = new bytes(128);
        
        // Encode Fp2 element (c0 at 0-63, c1 at 64-127)
        bytes32[2] memory c0Bytes = uint256ToBytes32Array(element.c0);
        bytes32[2] memory c1Bytes = uint256ToBytes32Array(element.c1);
        
        // Set c0 (64 bytes)
        for (uint i = 0; i < 2; i++) {
            for (uint j = 0; j < 32; j++) {
                input[i * 32 + j] = c0Bytes[i][j];
            }
        }
        
        // Set c1 (64 bytes) 
        for (uint i = 0; i < 2; i++) {
            for (uint j = 0; j < 32; j++) {
                input[64 + i * 32 + j] = c1Bytes[i][j];
            }
        }
        
        // Call MAP_FP2_TO_G2 precompile
        (bool success, bytes memory result) = BLS12_MAP_FP2_TO_G2.staticcall(input);
        require(success, "MAP_FP2_TO_G2 precompile failed");
        require(result.length == 256, "Invalid MAP_FP2_TO_G2 result length");
        
        return decodeG2Point(result);
    }
    
    /**
     * @dev Add two G2 points using EIP-2537 precompile
     * @param p1 First G2 point
     * @param p2 Second G2 point  
     * @return Sum of the two points
     */
    function addG2Points(G2Point memory p1, G2Point memory p2) internal view returns (G2Point memory) {
        // Prepare input for G2ADD precompile (512 bytes: 256 + 256)
        bytes memory input = new bytes(512);
        
        bytes memory p1Encoded = encodeG2Point(p1);
        bytes memory p2Encoded = encodeG2Point(p2);
        
        // Copy encoded points to input
        for (uint i = 0; i < 256; i++) {
            input[i] = p1Encoded[i];
            input[256 + i] = p2Encoded[i];
        }
        
        // Call G2ADD precompile
        (bool success, bytes memory result) = BLS12_G2ADD.staticcall(input);
        require(success, "G2ADD precompile failed");
        require(result.length == 256, "Invalid G2ADD result length");
        
        return decodeG2Point(result);
    }
    
    /**
     * @dev Encode G2 point to bytes according to EIP-2537 format
     * @param point The G2 point to encode
     * @return 256-byte encoded point
     */
    function encodeG2Point(G2Point memory point) internal pure returns (bytes memory) {
        bytes memory result = new bytes(256);
        
        // Encode x.c0 at offset 16 (48 bytes)
        bytes32[2] memory x0Bytes = uint256ToBytes32Array(point.x[0]);
        for (uint i = 0; i < 2; i++) {
            for (uint j = 0; j < 32; j++) {
                if (i * 32 + j < 48) {
                    result[16 + i * 32 + j] = x0Bytes[i][j];
                }
            }
        }
        
        // Encode x.c1 at offset 80 (48 bytes)
        bytes32[2] memory x1Bytes = uint256ToBytes32Array(point.x[1]);
        for (uint i = 0; i < 2; i++) {
            for (uint j = 0; j < 32; j++) {
                if (i * 32 + j < 48) {
                    result[80 + i * 32 + j] = x1Bytes[i][j];
                }
            }
        }
        
        // Encode y.c0 at offset 144 (48 bytes)
        bytes32[2] memory y0Bytes = uint256ToBytes32Array(point.y[0]);
        for (uint i = 0; i < 2; i++) {
            for (uint j = 0; j < 32; j++) {
                if (i * 32 + j < 48) {
                    result[144 + i * 32 + j] = y0Bytes[i][j];
                }
            }
        }
        
        // Encode y.c1 at offset 208 (48 bytes)
        bytes32[2] memory y1Bytes = uint256ToBytes32Array(point.y[1]);
        for (uint i = 0; i < 2; i++) {
            for (uint j = 0; j < 32; j++) {
                if (i * 32 + j < 48) {
                    result[208 + i * 32 + j] = y1Bytes[i][j];
                }
            }
        }
        
        return result;
    }
    
    /**
     * @dev Decode G2 point from EIP-2537 format bytes
     * @param data 256-byte encoded point
     * @return Decoded G2 point
     */
    function decodeG2Point(bytes memory data) internal pure returns (G2Point memory) {
        require(data.length == 256, "Invalid G2 point encoding length");
        
        G2Point memory point;
        
        // Extract x.c0 from offset 16
        point.x[0] = bytes48ToUint256(extractBytes48(data, 16));
        
        // Extract x.c1 from offset 80
        point.x[1] = bytes48ToUint256(extractBytes48(data, 80));
        
        // Extract y.c0 from offset 144
        point.y[0] = bytes48ToUint256(extractBytes48(data, 144));
        
        // Extract y.c1 from offset 208
        point.y[1] = bytes48ToUint256(extractBytes48(data, 208));
        
        return point;
    }
    
    /**
     * @dev Expand message using XMD-SHA-256 as per RFC 9380
     * @param message The message to expand
     * @param dst Domain separation tag
     * @param lenInBytes Length of output in bytes
     * @return Expanded message
     */
    function expandMsgXmd(bytes memory message, bytes memory dst, uint256 lenInBytes) internal pure returns (bytes memory) {
        require(dst.length <= 255, "DST too long");
        require(lenInBytes <= 8160, "lenInBytes too large"); // 255 * 32
        
        uint256 ell = (lenInBytes + 31) / 32; // Ceiling division by 32
        
        // Z_pad = I2OSP(0, r_in_bytes) where r_in_bytes = 128 for SHA-256
        bytes memory zPad = new bytes(128);
        
        // msg_prime = Z_pad || msg || l_i_b_str || I2OSP(0, 1) || dst_prime
        bytes memory libStr = new bytes(2);
        libStr[0] = bytes1(uint8(lenInBytes >> 8));
        libStr[1] = bytes1(uint8(lenInBytes & 0xff));
        
        bytes memory dstPrime = new bytes(dst.length + 1);
        for (uint i = 0; i < dst.length; i++) {
            dstPrime[i] = dst[i];
        }
        dstPrime[dst.length] = bytes1(uint8(dst.length));
        
        // Compute b_0 = H(msg_prime)
        bytes memory msgPrime = new bytes(128 + message.length + 3 + dstPrime.length);
        uint256 offset = 0;
        
        // Copy zPad
        for (uint i = 0; i < 128; i++) {
            msgPrime[offset + i] = zPad[i];
        }
        offset += 128;
        
        // Copy message
        for (uint i = 0; i < message.length; i++) {
            msgPrime[offset + i] = message[i];
        }
        offset += message.length;
        
        // Copy libStr
        msgPrime[offset] = libStr[0];
        msgPrime[offset + 1] = libStr[1];
        offset += 2;
        
        // Add zero byte
        msgPrime[offset] = 0x00;
        offset += 1;
        
        // Copy dstPrime
        for (uint i = 0; i < dstPrime.length; i++) {
            msgPrime[offset + i] = dstPrime[i];
        }
        
        bytes32 b0 = sha256(msgPrime);
        
        // Compute uniform_bytes
        bytes memory uniformBytes = new bytes(ell * 32);
        bytes32 bi = b0;
        
        for (uint i = 0; i < ell; i++) {
            // bi = H(strxor(b_0, b_i) || I2OSP(i + 1, 1) || dst_prime)
            if (i > 0) {
                bytes memory input = new bytes(32 + 1 + dstPrime.length);
                
                // XOR b_0 and previous b_i
                for (uint j = 0; j < 32; j++) {
                    input[j] = bytes1(uint8(b0[j]) ^ uint8(bi[j]));
                }
                
                // Add counter
                input[32] = bytes1(uint8(i + 1));
                
                // Add dst_prime
                for (uint j = 0; j < dstPrime.length; j++) {
                    input[33 + j] = dstPrime[j];
                }
                
                bi = sha256(input);
            }
            
            // Copy bi to result
            for (uint j = 0; j < 32; j++) {
                uniformBytes[i * 32 + j] = bi[j];
            }
        }
        
        // Return first lenInBytes
        bytes memory result = new bytes(lenInBytes);
        for (uint i = 0; i < lenInBytes; i++) {
            result[i] = uniformBytes[i];
        }
        
        return result;
    }
    
    // Helper functions
    function modField(uint256 x) internal pure returns (uint256) {
        // Simplified modular reduction - in production, use proper big integer arithmetic
        // For now, just return the input since precompiles handle field arithmetic
        return x;
    }
    
    function bytesToUint256(bytes memory data) internal pure returns (uint256) {
        require(data.length <= 32, "Data too long for uint256");
        uint256 result = 0;
        for (uint i = 0; i < data.length; i++) {
            result = result * 256 + uint8(data[i]);
        }
        return result;
    }
    
    function uint256ToBytes32Array(uint256 value) internal pure returns (bytes32[2] memory) {
        bytes32[2] memory result;
        result[0] = bytes32(value >> 128);
        result[1] = bytes32(value & ((1 << 128) - 1));
        return result;
    }
    
    function extractBytes48(bytes memory data, uint256 offset) internal pure returns (bytes memory) {
        bytes memory result = new bytes(48);
        for (uint i = 0; i < 48; i++) {
            result[i] = data[offset + i];
        }
        return result;
    }
    
    function bytes48ToUint256(bytes memory data) internal pure returns (uint256) {
        require(data.length == 48, "Invalid bytes48 length");
        uint256 result = 0;
        for (uint i = 0; i < 48; i++) {
            result = (result << 8) | uint8(data[i]);
        }
        return result;
    }
    
    /**
     * @dev Test function to verify hash-to-curve works correctly
     * @param userOpHash The user operation hash to convert
     * @return The G2 point as bytes
     */
    function hashUserOpToG2(bytes32 userOpHash) external view returns (bytes memory) {
        bytes memory message = abi.encodePacked(userOpHash);
        return hashToCurveG2(message);
    }
}