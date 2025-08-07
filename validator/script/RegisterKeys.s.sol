// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AAStarValidator.sol";

contract RegisterKeys is Script {
    AAStarValidator public validator;
    
    function run() external {
        // Contract address
        address validatorAddress = 0x0F94305c763705424CeD41234068342D03138add;
        validator = AAStarValidator(validatorAddress);
        
        // Start broadcasting transactions
        vm.startBroadcast();
        
        // Node ID and public key data (from config.json)
        bytes32[] memory nodeIds = new bytes32[](5);
        bytes[] memory publicKeys = new bytes[](5);
        
        // node_1
        nodeIds[0] = 0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d;
        publicKeys[0] = hex"000000000000000000000000000000000052464ad7afdeaa9416263fb0eb72925b77957796973ecb7fcda5d4fc733c4a2eb01ba15edeff51b1a0f08530f3bf4a0000000000000000000000000000000008db250fe656f5334bedca95ceb0ce9b1030928be39bce6d547146bc7335c1dee0eebce4b8129d42cb5ed2432a98e8de";
        
        // node_2
        nodeIds[1] = 0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272;
        publicKeys[1] = hex"000000000000000000000000000000000338213c412750cf16925dd3d85ac8f5ec32bc1133ce8261959d6afcdcc3ce0155ecbddb8692eea2b49e88c2d71f0c76000000000000000000000000000000000793efb79bb1624d6d3ab6c6b6b3e1d6a098bce76d91ae01e22940c1c57d85109cb20cccf7f189dfdc1014c271c0a1fc";
        
        // node_3
        nodeIds[2] = 0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b;
        publicKeys[2] = hex"000000000000000000000000000000000932ae492c94f0e8302b8a59871e9b62dd0d451c7dcff31ba201cf9c7ace3085fe52a3887054483d2492b4f3884476f4000000000000000000000000000000001075d2cd423b4c3534415c1b64179ee02f371def5122279131c8a6dde6e0333ef8fb31198f252ba48524b52701c35177";
        
        // node_4
        nodeIds[3] = 0x41defc00c28336b45595c24b26e1d0a83ad4ea6832f1a276dcf42a1d43a72681;
        publicKeys[3] = hex"0000000000000000000000000000000010502ac5cfcfda2477a767ce762410bc9fb90c069e9b07826b189fba3b4096b559d1fc390e23e5efa39f5191dffc64b9000000000000000000000000000000001579fc08b75f8ec4eb05d339ecb9d46ab3954b5459fd4ce454befefccc16d7b2b86758054c81eb8c32976302e9c85d65";
        
        // node_5
        nodeIds[4] = 0x4dc85a434ba7af786ce05d388df756cae4d8d7236edd2c2a36991d5660ee36d7;
        publicKeys[4] = hex"0000000000000000000000000000000009372b17ab3e93075183c40a024206cecb573f56c513759fba67800fc8c6ec3fa2cc1784e3ba0152a87500f953f1760d0000000000000000000000000000000011998d83b339db015eb501cb6cad165d7065a3035a43ec3a7d3b36e3e45b9d8a2bcb4f4b96e8af3ecd2bc84bad2f04de";
        
        console.log("=== Batch Register Public Keys ===");
        console.log("Contract Address:", validatorAddress);
        console.log("Node Count:", nodeIds.length);
        
        // Batch register public keys
        validator.batchRegisterPublicKeys(nodeIds, publicKeys);
        
        console.log("SUCCESS: All public keys registered successfully");
        
        vm.stopBroadcast();
        
        // Verify registration results
        console.log("\n=== Verification Results ===");
        uint256 registeredCount = validator.getRegisteredNodeCount();
        console.log("Registered Node Count:", registeredCount);
        
        for (uint256 i = 0; i < nodeIds.length; i++) {
            bool isReg = validator.isRegistered(nodeIds[i]);
            console.log("Node", i + 1, "Registration Status:", isReg ? "Registered" : "Not Registered");
        }
    }
}