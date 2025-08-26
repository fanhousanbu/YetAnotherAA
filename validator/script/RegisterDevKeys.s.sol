// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AAStarValidator.sol";

contract RegisterDevKeys is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address validatorAddress = 0xAe7eA28a0aeA05cbB8631bDd7B10Cb0f387FC479;

        vm.startBroadcast(deployerPrivateKey);

        AAStarValidator validator = AAStarValidator(validatorAddress);

        console.log("==== Registering Development BLS Keys to Validator ====");
        console.log("Validator address:", validatorAddress);

        // 3 Development BLS nodes 
        bytes32[] memory nodeIds = new bytes32[](3);
        bytes[] memory publicKeys = new bytes[](3);

        // Node IDs from the development configuration files
        nodeIds[0] = 0x6d9979585bc7a83bff3e7bb344c002ccd630f3aa351c893f0a96728d62a371b4; // Node 1 contractNodeId
        nodeIds[1] = 0x7eab846a94cff4e4bb455c3fe8d60bd2b97c6c5a462d904e1d36739375b482c5; // Node 2 contractNodeId
        nodeIds[2] = 0x8fbc957b95dff5f5cc566d4fe9e71ce3ca8d7d6b573e015f2e47849486c593d6; // Node 3 contractNodeId

        // Public keys (G1 points) - exactly 256 hex chars each (128 bytes)
        
        // Node 1 (dev_001) - Development BLS key 
        publicKeys[
            0
        ] = hex"00000000000000000000000000000000a74aa90cbfaa6048944864878af539240a283df13efbf8d9d47f58983218381800000000000000000000000000000000f45e46c187d595c6804b49558edbbb8900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
        
        // Node 2 (dev_002) - Development BLS key
        publicKeys[
            1
        ] = hex"00000000000000000000000000000000885c6c8b84ba7d3d4c8f9c7c5e6a4b3d2f1e9c8b7a6d5c4e3f2e1d0c9b8a7d600000000000000000000000000000000e5c4b3a2f1e0d9c8b7a6e5d4c3b2a1f0e9d8c7b6a5e4d3c2b1a0f9e8d700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
        
        // Node 3 (dev_003) - Development BLS key  
        publicKeys[
            2
        ] = hex"0000000000000000000000000000000096d7d9c95cb8e4e5d9fae8e6f7b5c4e3d2f0efd9e8d7c6b5a4f3e2d1c0bfae00000000000000000000000000000000d9c8b7a6f5e4d3c2b1a0ffefd8c7b6a5f4e3d2c1b0ffe9d8c7b6a5f4e3d2c100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

        // Register all development keys
        validator.batchRegisterPublicKeys(nodeIds, publicKeys);

        console.log("Successfully registered 3 development BLS keys");
        console.log("Current registered node count:", validator.getRegisteredNodeCount());

        // Test gas estimates with registered nodes
        console.log("");
        console.log("Gas estimates after registration:");
        for (uint256 i = 1; i <= 3; i++) {
            console.log("For", i, "nodes:", validator.getGasEstimate(i));
        }

        vm.stopBroadcast();
    }
}