// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockG1AddPrecompile
 * @dev Mock contract for EIP-2537 G1 addition precompile (0x0b) for testing
 * 
 * This mock simulates the behavior of the G1 addition precompile.
 * For testing purposes, it performs simple operations on the input data.
 */
contract MockG1AddPrecompile {
    
    // Test scenario flags
    bool public shouldRevert = false;
    bytes public mockResult;
    
    // Expected input length for G1 addition (256 bytes = 2 * 128 bytes)
    uint256 public constant EXPECTED_INPUT_LENGTH = 256;
    uint256 public constant G1_POINT_LENGTH = 128;
    
    // Event for debugging
    event G1AddCall(bytes input, bytes result);
    
    constructor() {
        // Set default mock result to a valid G1 point (all zeros for testing)
        mockResult = new bytes(G1_POINT_LENGTH);
    }
    
    /**
     * @dev Sets the mock behavior for G1 addition operations
     * @param _shouldRevert Whether to revert the call
     */
    function setMockBehavior(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }
    
    /**
     * @dev Sets a custom result to return from G1 addition
     * @param _result Custom 128-byte result
     */
    function setMockResult(bytes calldata _result) external {
        require(_result.length == G1_POINT_LENGTH, "Invalid result length");
        mockResult = _result;
    }
    
    /**
     * @dev Fallback function to handle staticcall from G1 addition precompile
     * For G1 addition, we expect 256 bytes input and return 128 bytes output
     */
    fallback() external {
        if (shouldRevert) {
            revert("MockG1AddPrecompile: Forced revert");
        }
        
        bytes memory input = msg.data;
        
        // Simple validation: input should be 256 bytes (2 x 128-byte G1 points)
        require(input.length == EXPECTED_INPUT_LENGTH, "Invalid input length");
        
        // For mock testing, return a fixed valid G1 point
        // In real world, this would be proper elliptic curve point addition
        bytes memory result = new bytes(G1_POINT_LENGTH);
        
        // Create a simple mock result (non-zero to avoid point at infinity)
        result[0] = 0x12;  // Ensure non-zero result
        result[64] = 0x34; // Set some bytes in y coordinate too
        
        emit G1AddCall(input, result);
        
        // Return the result
        assembly {
            return(add(result, 0x20), mload(result))
        }
    }
    
    /**
     * @dev Mock aggregation logic - XORs corresponding bytes for simplicity
     * In real world, this would be proper elliptic curve point addition
     */
    function _mockAggregation(bytes memory point1, bytes memory point2) 
        internal 
        pure 
        returns (bytes memory result) 
    {
        result = new bytes(G1_POINT_LENGTH);
        
        // Simple mock: XOR the points (not cryptographically meaningful, just for testing)
        for (uint256 i = 0; i < G1_POINT_LENGTH; i++) {
            result[i] = point1[i] ^ point2[i];
        }
        
        // Ensure result is not all zeros (avoid point at infinity in mock)
        if (_isPointAtInfinity(result)) {
            // Set a non-zero value in the last byte
            result[G1_POINT_LENGTH - 1] = 0x01;
        }
    }
    
    /**
     * @dev Checks if a point is the point at infinity (all zeros)
     */
    function _isPointAtInfinity(bytes memory point) internal pure returns (bool) {
        for (uint256 i = 0; i < point.length; i++) {
            if (point[i] != 0) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * @dev Reset mock to default state
     */
    function resetMock() external {
        shouldRevert = false;
        mockResult = new bytes(G1_POINT_LENGTH);
    }
    
    /**
     * @dev Get current mock result
     */
    function getMockResult() external view returns (bytes memory) {
        return mockResult;
    }
}