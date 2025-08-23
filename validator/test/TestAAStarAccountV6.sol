// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../src/AAStarAccountV6.sol";

/**
 * @title Test wrapper for AAStarAccountV6
 * @dev Extends AAStarAccountV6 to bypass initializer restrictions for testing
 */
contract TestAAStarAccountV6 is AAStarAccountV6 {
    
    constructor(IEntryPoint anEntryPoint) AAStarAccountV6(anEntryPoint) {
        // Constructor calls parent constructor
    }
    
    /**
     * @dev Test-only initialization function that bypasses initializer modifier
     */
    function initializeTest(
        address anOwner,
        address _aaStarValidator,
        bool _useAAStarValidator
    ) public {
        // Directly call internal initialize without modifier
        _initialize(anOwner, _aaStarValidator, _useAAStarValidator);
    }
    
    /**
     * @dev Expose _parseAndValidateAAStarSignature for testing
     */
    function parseAndValidateAAStarSignature(
        bytes calldata signature,
        bytes32 userOpHash
    ) external returns (bool isValid) {
        // Call the external function (bypassing the "only self" check by calling from this contract)
        return this._parseAndValidateAAStarSignature(signature, userOpHash);
    }
}