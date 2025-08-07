// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockPairingPrecompile
 * @dev Mock contract for EIP-2537 pairing precompile for testing
 * 
 * This mock simulates the behavior of the EIP-2537 pairing precompile at address 0x000...000F.
 * It validates the input format and returns success/failure based on test scenarios.
 */
contract MockPairingPrecompile {
    
    // Test scenario flags
    bool public shouldReturnTrue = true;
    bool public shouldRevert = false;
    uint256 public expectedInputLength = 768;
    
    // Event for debugging
    event PairingCall(bytes input, bool result);
    
    /**
     * @dev Sets the mock behavior for pairing operations
     * @param _shouldReturnTrue Whether to return true (successful pairing)
     * @param _shouldRevert Whether to revert the call
     */
    function setMockBehavior(bool _shouldReturnTrue, bool _shouldRevert) external {
        shouldReturnTrue = _shouldReturnTrue;
        shouldRevert = _shouldRevert;
    }
    
    /**
     * @dev Sets expected input length for validation
     * @param _length Expected length in bytes
     */
    function setExpectedInputLength(uint256 _length) external {
        expectedInputLength = _length;
    }
    
    /**
     * @dev Mock implementation of EIP-2537 pairing operation
     * @param input Pairing input data
     * @return result 32-byte result (1 for success, 0 for failure)
     */
    function pairing(bytes calldata input) external view returns (bytes memory result) {
        if (shouldRevert) {
            revert("MockPairingPrecompile: Forced revert");
        }
        
        // Validate input length
        if (input.length != expectedInputLength) {
            return abi.encodePacked(uint256(0));
        }
        
        // Return success or failure based on mock setting
        return abi.encodePacked(shouldReturnTrue ? uint256(1) : uint256(0));
    }
    
    /**
     * @dev Fallback function to handle staticcall from validator
     */
    fallback() external {
        if (shouldRevert) {
            revert("MockPairingPrecompile: Forced revert");
        }
        
        bytes memory input = msg.data;
        
        // Validate input length
        if (input.length != expectedInputLength) {
            bytes memory result = abi.encodePacked(uint256(0));
            assembly {
                return(add(result, 0x20), mload(result))
            }
        }
        
        // Return success or failure based on mock setting
        bytes memory result = abi.encodePacked(shouldReturnTrue ? uint256(1) : uint256(0));
        assembly {
            return(add(result, 0x20), mload(result))
        }
    }
    
    /**
     * @dev Reset mock to default state
     */
    function resetMock() external {
        shouldReturnTrue = true;
        shouldRevert = false;
        expectedInputLength = 768;
    }
}