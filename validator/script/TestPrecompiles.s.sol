// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";

/**
 * @title TestPrecompiles
 * @dev Test EIP-2537 precompiles directly
 */
contract TestPrecompiles is Script {
    address constant BLS12_MAP_FP2_TO_G2 = 0x0000000000000000000000000000000000000011;
    address constant BLS12_G2_ADD = 0x000000000000000000000000000000000000000d;

    function run() external view {
        console.log("=== Testing EIP-2537 Precompiles ===");
        
        // Test with simple Fp2 element (all zeros)
        bytes memory fp2Element = new bytes(128);
        console.log("Testing Fp2 element of length:", fp2Element.length);
        
        // Test precompile 0x11
        (bool success, bytes memory result) = BLS12_MAP_FP2_TO_G2.staticcall{
            gas: 50000
        }(fp2Element);
        
        console.log("Precompile 0x11 call success:", success);
        if (success) {
            console.log("Result length:", result.length);
        } else {
            console.log("Precompile 0x11 failed");
        }
        
        // Test if precompiles exist by checking code
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(0x11)
        }
        console.log("Precompile 0x11 code size:", codeSize);
    }
}