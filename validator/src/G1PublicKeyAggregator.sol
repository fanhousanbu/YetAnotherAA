// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title G1PublicKeyAggregator
 * @dev Aggregates multiple G1 public keys using EIP-2537 G1Add precompile
 * 
 * This contract takes individual BLS12-381 G1 public keys and aggregates them
 * using the G1 addition precompile (0x0b), then compares the result with
 * expected aggregated public keys from off-chain computation.
 */
contract G1PublicKeyAggregator {
    
    // =============================================================
    //                           CONSTANTS
    // =============================================================
    
    /// @dev EIP-2537 G1 addition precompile address
    address private constant G1_ADD_PRECOMPILE = 0x000000000000000000000000000000000000000b;
    
    /// @dev G1 point encoding length (128 bytes = 64 bytes x + 64 bytes y)
    uint256 private constant G1_POINT_LENGTH = 128;
    
    /// @dev Gas limit for precompile calls (increased for safety)
    uint256 private constant PRECOMPILE_GAS = 100000;
    
    // =============================================================
    //                           EVENTS
    // =============================================================
    
    event PublicKeysAggregated(
        bytes[] individualKeys,
        bytes aggregatedKey,
        uint256 gasUsed,
        bool matchesExpected
    );
    
    // =============================================================
    //                      AGGREGATION FUNCTIONS
    // =============================================================
    
    /**
     * @dev Aggregates multiple G1 public keys using G1Add precompile
     * 
     * @param publicKeys Array of individual G1 public keys to aggregate
     * @return aggregatedKey The resulting aggregated public key
     */
    function aggregatePublicKeys(bytes[] calldata publicKeys)
        external
        view
        returns (bytes memory aggregatedKey)
    {
        require(publicKeys.length > 0, "No public keys provided");
        
        // Start with the first public key
        aggregatedKey = publicKeys[0];
        require(aggregatedKey.length == G1_POINT_LENGTH, "Invalid first key length");
        
        // Add each subsequent public key
        for (uint256 i = 1; i < publicKeys.length; i++) {
            require(publicKeys[i].length == G1_POINT_LENGTH, "Invalid key length");
            aggregatedKey = _addG1Points(aggregatedKey, publicKeys[i]);
        }
    }
    
    /**
     * @dev Aggregates public keys and compares with expected result
     * 
     * @param publicKeys Array of individual G1 public keys to aggregate
     * @param expectedAggregated Expected aggregated public key for comparison
     * @return aggregatedKey The computed aggregated public key
     * @return matches Whether the computed result matches the expected result
     * @return gasUsed Gas consumed for the aggregation process
     */
    function aggregateAndVerify(
        bytes[] calldata publicKeys,
        bytes calldata expectedAggregated
    ) 
        external 
        returns (
            bytes memory aggregatedKey,
            bool matches,
            uint256 gasUsed
        )
    {
        require(expectedAggregated.length == G1_POINT_LENGTH, "Invalid expected key length");
        
        uint256 gasStart = gasleft();
        aggregatedKey = this.aggregatePublicKeys(publicKeys);
        gasUsed = gasStart - gasleft();
        
        matches = keccak256(aggregatedKey) == keccak256(expectedAggregated);
        
        emit PublicKeysAggregated(publicKeys, aggregatedKey, gasUsed, matches);
    }
    
    /**
     * @dev Batch aggregates multiple sets of public keys
     * 
     * @param publicKeySets Array of arrays, each containing public keys to aggregate
     * @return aggregatedKeys Array of aggregated public keys
     */
    function batchAggregatePublicKeys(bytes[][] calldata publicKeySets)
        external
        view
        returns (bytes[] memory aggregatedKeys)
    {
        uint256 setsCount = publicKeySets.length;
        aggregatedKeys = new bytes[](setsCount);
        
        for (uint256 i = 0; i < setsCount; i++) {
            aggregatedKeys[i] = this.aggregatePublicKeys(publicKeySets[i]);
        }
    }
    
    // =============================================================
    //                      INTERNAL FUNCTIONS
    // =============================================================
    
    /**
     * @dev Adds two G1 points using the EIP-2537 precompile
     * 
     * @param point1 First G1 point (128 bytes)
     * @param point2 Second G1 point (128 bytes)
     * @return result Sum of the two G1 points
     */
    function _addG1Points(bytes memory point1, bytes calldata point2) 
        internal 
        view 
        returns (bytes memory result) 
    {
        require(point1.length == G1_POINT_LENGTH, "Invalid point1 length");
        require(point2.length == G1_POINT_LENGTH, "Invalid point2 length");
        
        // Create input: concatenate point1 and point2 (256 bytes total)
        bytes memory input = abi.encodePacked(point1, point2);
        require(input.length == 256, "Invalid input length");
        
        // Use assembly for precompile call (staticcall doesn't work properly for EIP-2537 on Sepolia)
        result = new bytes(G1_POINT_LENGTH);
        
        assembly {
            let success := staticcall(gas(), 0x0b, add(input, 0x20), mload(input), add(result, 0x20), 128)
            if eq(success, 0) {
                revert(0, 0)
            }
        }
    }
    
    // =============================================================
    //                      UTILITY FUNCTIONS
    // =============================================================
    
    /**
     * @dev Validates that all provided public keys are properly encoded
     * 
     * @param publicKeys Array of public keys to validate
     * @return isValid True if all keys are properly encoded
     */
    function validatePublicKeys(bytes[] calldata publicKeys) 
        external 
        pure 
        returns (bool isValid) 
    {
        if (publicKeys.length == 0) {
            return false;
        }
        
        for (uint256 i = 0; i < publicKeys.length; i++) {
            if (publicKeys[i].length != G1_POINT_LENGTH) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * @dev Estimates gas cost for aggregating a given number of public keys
     * 
     * @param keyCount Number of public keys to aggregate
     * @return gasEstimate Estimated gas cost
     */
    function getGasEstimate(uint256 keyCount) external pure returns (uint256 gasEstimate) {
        if (keyCount == 0) return 0;
        if (keyCount == 1) return 5000; // Base cost for single key
        
        // Each G1 addition costs ~375 gas plus overhead
        return 5000 + (keyCount - 1) * 500;
    }
    
    /**
     * @dev Returns the precompile address used for G1 operations
     * @return precompileAddress The EIP-2537 G1 addition precompile address
     */
    function getPrecompileAddress() external pure returns (address precompileAddress) {
        return G1_ADD_PRECOMPILE;
    }
    
    /**
     * @dev Checks if a point is the point at infinity (all zeros)
     * @param point G1 point to check
     * @return isInfinity True if the point is at infinity
     */
    function isPointAtInfinity(bytes calldata point) external pure returns (bool isInfinity) {
        require(point.length == G1_POINT_LENGTH, "Invalid point length");
        
        for (uint256 i = 0; i < G1_POINT_LENGTH; i++) {
            if (point[i] != 0) {
                return false;
            }
        }
        return true;
    }
}