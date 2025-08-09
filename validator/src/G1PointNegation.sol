// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title G1PointNegation
 * @dev Direct G1 point negation without verification
 * 
 * Simple and efficient G1 point negation that directly computes -P = (x, -y mod p)
 * where P = (x, y) is a point on the BLS12-381 curve.
 */
contract G1PointNegation {
    
    // =============================================================
    //                           CONSTANTS
    // =============================================================
    
    /// @dev G1 point encoding length (128 bytes = 64 bytes x + 64 bytes y)
    uint256 private constant G1_POINT_LENGTH = 128;
    
    /// @dev BLS12-381 field modulus (381 bits)
    /// p = 0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab
    uint256 private constant P_0 = 0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f624;
    uint256 private constant P_1 = 0x1eabfffeb153ffffb9feffffffffaaab;
    
    // =============================================================
    //                      NEGATION FUNCTION
    // =============================================================
    
    /**
     * @dev Negates a G1 point by computing -P = (x, -y mod p)
     * 
     * @param point G1 point in EIP-2537 format (128 bytes)
     * @return negatedPoint The negated G1 point (-P)
     */
    function negateG1Point(bytes calldata point) 
        external 
        pure 
        returns (bytes memory negatedPoint) 
    {
        require(point.length == G1_POINT_LENGTH, "Invalid G1 point length");
        
        negatedPoint = new bytes(G1_POINT_LENGTH);
        
        // Copy x coordinate unchanged (first 64 bytes)
        for (uint256 i = 0; i < 64; i++) {
            negatedPoint[i] = point[i];
        }
        
        // Handle point at infinity (all zeros)
        bool isInfinity = true;
        for (uint256 i = 0; i < G1_POINT_LENGTH; i++) {
            if (point[i] != 0) {
                isInfinity = false;
                break;
            }
        }
        
        if (isInfinity) {
            // Point at infinity remains unchanged
            return negatedPoint; // Already all zeros
        }
        
        // Negate y coordinate: compute p - y
        _negateYCoordinate(point, negatedPoint);
    }
    
    /**
     * @dev Batch negates multiple G1 points
     * 
     * @param points Array of G1 points to negate
     * @return negatedPoints Array of negated G1 points
     */
    function batchNegateG1Points(bytes[] calldata points)
        external
        pure
        returns (bytes[] memory negatedPoints)
    {
        uint256 length = points.length;
        negatedPoints = new bytes[](length);
        
        for (uint256 i = 0; i < length; i++) {
            require(points[i].length == G1_POINT_LENGTH, "Invalid G1 point length");
            negatedPoints[i] = _negatePoint(points[i]);
        }
    }
    
    /**
     * @dev Internal helper for batch operations
     */
    function _negatePoint(bytes calldata point) internal pure returns (bytes memory) {
        bytes memory negatedPoint = new bytes(G1_POINT_LENGTH);
        
        // Copy x coordinate unchanged (first 64 bytes)
        for (uint256 i = 0; i < 64; i++) {
            negatedPoint[i] = point[i];
        }
        
        // Handle point at infinity (all zeros)
        bool isInfinity = true;
        for (uint256 i = 0; i < G1_POINT_LENGTH; i++) {
            if (point[i] != 0) {
                isInfinity = false;
                break;
            }
        }
        
        if (isInfinity) {
            // Point at infinity remains unchanged
            return negatedPoint; // Already all zeros
        }
        
        // Negate y coordinate: compute p - y
        _negateYCoordinate(point, negatedPoint);
        return negatedPoint;
    }
    
    // =============================================================
    //                      INTERNAL FUNCTIONS
    // =============================================================
    
    /**
     * @dev Negates the y coordinate by computing p - y
     * Uses the BLS12-381 field modulus for correct negation
     */
    function _negateYCoordinate(
        bytes calldata point, 
        bytes memory result
    ) internal pure {
        // Extract y coordinate (bytes 64-127 in EIP-2537 format)
        // EIP-2537: [16 zero bytes][48 bytes x][16 zero bytes][48 bytes y]
        
        // For BLS12-381, coordinates are 48 bytes (384 bits) each
        // In the 64-byte encoding, the actual coordinate starts at byte 16 of each 64-byte chunk
        
        // Y coordinate: bytes 64+16 = 80 to 127 (48 bytes)
        // We need to compute p - y where both p and y are 381-bit numbers
        
        // Extract the full 48-byte y coordinate from the 64-byte encoding
        // EIP-2537 format: [16 zero bytes][48 bytes coordinate]
        uint256 y_high = 0;
        uint256 y_low = 0;
        
        assembly {
            let yPtr := add(point.offset, 80)
            // Load first 32 bytes of the 48-byte y coordinate
            y_high := calldataload(yPtr)
            // Load remaining 16 bytes of y coordinate (shift to align properly)
            let temp := calldataload(add(yPtr, 32))
            y_low := shr(128, temp) // Shift right by 16 bytes to get the 16-byte portion
        }
        
        // Compute p - y
        uint256 neg_y_high;
        uint256 neg_y_low;
        
        if (P_1 >= y_low) {
            neg_y_low = P_1 - y_low;
            neg_y_high = P_0 - y_high;
        } else {
            // Need to borrow
            unchecked {
                neg_y_low = P_1 - y_low + type(uint256).max + 1;
                neg_y_high = P_0 - y_high - 1;
            }
        }
        
        // Store the negated y coordinate back to result in EIP-2537 format
        // Set y coordinate padding (16 zero bytes at offset 64-79)
        for (uint256 i = 64; i < 80; i++) {
            result[i] = 0;
        }
        
        // Store negated y coordinate (48 bytes starting at offset 80)
        assembly {
            let resultPtr := add(result, 0x20) // Skip length prefix
            // Store first 32 bytes of negated y
            mstore(add(resultPtr, 80), neg_y_high)
            // Store remaining 16 bytes of negated y in the correct position
            let temp := shl(128, neg_y_low) // Shift left to align the 16 bytes correctly
            mstore(add(resultPtr, 112), temp)
        }
    }
    
    // =============================================================
    //                      UTILITY FUNCTIONS
    // =============================================================
    
    /**
     * @dev Returns the BLS12-381 field modulus components
     * @return p0 High part of the modulus
     * @return p1 Low part of the modulus
     */
    function getFieldModulus() external pure returns (uint256 p0, uint256 p1) {
        return (P_0, P_1);
    }
    
    /**
     * @dev Estimates gas cost for single point negation
     * @return gasEstimate Estimated gas cost
     */
    function getGasEstimate() external pure returns (uint256 gasEstimate) {
        return 3000; // Conservative estimate for direct computation
    }
    
    /**
     * @dev Validates that a point is properly encoded
     * @param point G1 point to validate
     * @return isValid True if properly encoded (correct length)
     */
    function validateG1PointLength(bytes calldata point) 
        external 
        pure 
        returns (bool isValid) 
    {
        return point.length == G1_POINT_LENGTH;
    }
}