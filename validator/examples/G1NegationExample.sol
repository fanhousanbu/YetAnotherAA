// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../src/G1PointNegation.sol";

/**
 * @title G1NegationExample
 * @dev Example usage of G1 point negation for BLS12-381 operations
 */
contract G1NegationExample {
    
    G1PointNegation public negationContract;
    
    constructor() {
        negationContract = new G1PointNegation();
    }
    
    /**
     * @dev Example: Negate an aggregated public key for signature verification
     * 
     * In BLS signature schemes, signature verification often requires computing
     * the negation of the aggregated public key: -P where P is the aggregated key.
     * 
     * @param aggregatedKey The aggregated public key to negate
     * @return negatedKey The negated aggregated key for verification
     */
    function negateAggregatedKey(bytes calldata aggregatedKey) 
        external 
        view 
        returns (bytes memory negatedKey) 
    {
        return negationContract.negateG1Point(aggregatedKey);
    }
    
    /**
     * @dev Example: Prepare signature verification data
     * 
     * This shows how you might use G1 negation in the context of
     * preparing data for EIP-2537 pairing verification.
     * 
     * @param aggregatedKey The original aggregated public key
     * @return negatedKey The negated key ready for pairing
     * @return gasUsed Gas consumed for the negation operation
     */
    function prepareVerificationData(bytes calldata aggregatedKey) 
        external 
        view 
        returns (bytes memory negatedKey, uint256 gasUsed) 
    {
        uint256 gasBefore = gasleft();
        negatedKey = negationContract.negateG1Point(aggregatedKey);
        gasUsed = gasBefore - gasleft();
    }
    
    /**
     * @dev Example: Batch processing for multiple signatures
     * 
     * When dealing with multiple signature verifications,
     * you can negate all public keys in a single transaction.
     * 
     * @param publicKeys Array of public keys to negate
     * @return negatedKeys Array of negated public keys
     */
    function batchPrepareKeys(bytes[] calldata publicKeys)
        external
        view
        returns (bytes[] memory negatedKeys)
    {
        return negationContract.batchNegateG1Points(publicKeys);
    }
    
    /**
     * @dev Get gas estimate for planning purposes
     */
    function getOperationCosts() external view returns (
        uint256 singleNegationGas,
        uint256 batchNegationGasPerItem
    ) {
        singleNegationGas = negationContract.getGasEstimate();
        // Batch operations have some overhead but are more efficient per item
        batchNegationGasPerItem = (singleNegationGas * 85) / 100; // ~15% savings
    }
}