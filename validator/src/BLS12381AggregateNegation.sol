// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./BLS12381HelperDeployable.sol";
import "./G1PointNegation.sol";

/**
 * @title BLS12381AggregateNegation
 * @dev Combines BLS12381Helper's Aggregate() with G1PointNegation's negateG1Point()
 * 
 * This contract performs two operations in sequence:
 * 1. Aggregates two predefined G1 points using BLS12381Helper
 * 2. Negates the aggregated result using G1PointNegation
 */
contract BLS12381AggregateNegation {
    
    // =============================================================
    //                           COMPONENTS
    // =============================================================
    
    BLS12381HelperDeployable private immutable helper;
    G1PointNegation private immutable negation;
    
    // =============================================================
    //                           EVENTS
    // =============================================================
    
    event AggregateAndNegate(
        bytes aggregatedPoint,
        bytes negatedPoint,
        uint256 gasUsed
    );
    
    // =============================================================
    //                        CONSTRUCTOR
    // =============================================================
    
    /**
     * @dev Constructor - creates new instances of both component contracts
     * For using existing contracts, deploy separately and call functions directly
     */
    constructor() {
        helper = new BLS12381HelperDeployable();
        negation = new G1PointNegation();
    }
    
    // =============================================================
    //                      MAIN FUNCTIONALITY
    // =============================================================
    
    /**
     * @dev Aggregates the two predefined G1 points and then negates the result
     * 
     * This function:
     * 1. Calls helper.Aggregate() to get the aggregated G1 point
     * 2. Passes the result to negation.negateG1Point() to get the negated point
     * 
     * @return aggregatedPoint The result from BLS12381Helper.Aggregate()
     * @return negatedPoint The negated result
     */
    function aggregateAndNegate() 
        external 
        returns (bytes memory aggregatedPoint, bytes memory negatedPoint) 
    {
        uint256 gasStart = gasleft();
        
        // Step 1: Aggregate the two predefined G1 points
        aggregatedPoint = helper.Aggregate();
        
        // Step 2: Negate the aggregated result
        negatedPoint = negation.negateG1Point(aggregatedPoint);
        
        uint256 gasUsed = gasStart - gasleft();
        emit AggregateAndNegate(aggregatedPoint, negatedPoint, gasUsed);
    }
    
    /**
     * @dev View version that doesn't emit events or track gas
     * 
     * @return aggregatedPoint The result from BLS12381Helper.Aggregate()
     * @return negatedPoint The negated result
     */
    function aggregateAndNegateView() 
        external 
        view 
        returns (bytes memory aggregatedPoint, bytes memory negatedPoint) 
    {
        // Step 1: Aggregate the two predefined G1 points
        aggregatedPoint = helper.Aggregate();
        
        // Step 2: Negate the aggregated result
        negatedPoint = negation.negateG1Point(aggregatedPoint);
    }
    
    /**
     * @dev Returns only the final negated result (most concise function)
     * 
     * @return negatedPoint The final negated aggregated point
     */
    function getNegatedAggregateResult() external view returns (bytes memory negatedPoint) {
        bytes memory aggregated = helper.Aggregate();
        negatedPoint = negation.negateG1Point(aggregated);
    }
    
    // =============================================================
    //                      UTILITY FUNCTIONS
    // =============================================================
    
    /**
     * @dev Gets the original G1 points used for aggregation
     * 
     * @return g1One1 The first G1 generator point
     * @return g1One2 The second G1 generator point
     */
    function getOriginalPoints() 
        external 
        view 
        returns (bytes memory g1One1, bytes memory g1One2) 
    {
        g1One1 = helper.getG1One1();
        g1One2 = helper.getG1One2();
    }
    
    /**
     * @dev Allows custom G1 addition and negation for testing
     * 
     * @param pointA First G1 point to add
     * @param pointB Second G1 point to add
     * @return aggregated The sum of pointA and pointB
     * @return negated The negation of the sum
     */
    function customAggregateAndNegate(bytes memory pointA, bytes memory pointB)
        external
        view
        returns (bytes memory aggregated, bytes memory negated)
    {
        // Use helper's testG1Add function for custom points
        aggregated = helper.testG1Add(pointA, pointB);
        negated = negation.negateG1Point(aggregated);
    }
    
    /**
     * @dev Returns the addresses of the component contracts
     * 
     * @return helperAddr Address of the BLS12381Helper contract
     * @return negationAddr Address of the G1PointNegation contract
     */
    function getComponentAddresses() 
        external 
        view 
        returns (address helperAddr, address negationAddr) 
    {
        return (address(helper), address(negation));
    }
    
    /**
     * @dev Validates that both component contracts are properly initialized
     * 
     * @return isValid True if both contracts respond correctly
     */
    function validateComponents() external view returns (bool isValid) {
        try helper.getG1One1() returns (bytes memory) {
            try negation.getFieldModulus() returns (uint256, uint256) {
                return true;
            } catch {
                return false;
            }
        } catch {
            return false;
        }
    }
    
    /**
     * @dev Estimates gas cost for the aggregate and negate operation
     * 
     * @return gasEstimate Conservative gas estimate
     */
    function getGasEstimate() external pure returns (uint256 gasEstimate) {
        // Conservative estimate: aggregation (~5000) + negation (~3000) + overhead
        return 10000;
    }
}