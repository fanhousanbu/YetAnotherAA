// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/AAStarValidator.sol";

/**
 * @title ViewRegisteredNodes
 * @dev View registered BLS nodes in AAStarValidator
 */
contract ViewRegisteredNodes is Script {
    address constant VALIDATOR_CONTRACT_ADDRESS = 0x6f5F51654eeDfDBba5E053d022A7282f63ec8687;
    
    function run() external view {
        console.log("=== Viewing Registered BLS Nodes ===");
        
        AAStarValidator validator = AAStarValidator(VALIDATOR_CONTRACT_ADDRESS);
        
        uint256 nodeCount = validator.getRegisteredNodeCount();
        console.log("Total registered nodes:", nodeCount);
        
        if (nodeCount > 0) {
            console.log("\n=== Node Details ===");
            
            // Get all nodes (offset=0, limit=nodeCount)
            (bytes32[] memory nodeIds, bytes[] memory publicKeys) = validator.getRegisteredNodes(0, nodeCount);
            
            for (uint256 i = 0; i < nodeIds.length; i++) {
                console.log("\n--- Node", i + 1, "---");
                console.log("NodeId:");
                console.logBytes32(nodeIds[i]);
                console.log("Public Key length:", publicKeys[i].length);
                
                // Show first 32 bytes of public key
                if (publicKeys[i].length >= 32) {
                    bytes memory pubKey = publicKeys[i];
                    bytes32 firstChunk;
                    assembly {
                        firstChunk := mload(add(pubKey, 32))
                    }
                    console.log("Public Key (first 32 bytes):");
                    console.logBytes32(firstChunk);
                }
                
                // Check if this node is registered
                bool isRegistered = validator.isRegistered(nodeIds[i]);
                console.log("Is registered:", isRegistered);
            }
        } else {
            console.log("No nodes registered yet.");
        }
        
        console.log("\n=== Owner Information ===");
        console.log("Contract owner:", validator.owner());
    }
}