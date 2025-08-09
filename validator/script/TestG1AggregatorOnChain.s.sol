// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/G1PublicKeyAggregator.sol";

contract TestG1AggregatorOnChainScript is Script {
    
    // Test data from index.js output
    bytes constant PUBLIC_KEY_1 = hex"00000000000000000000000000000000039de640beedf8ba1e935e6730da2e6cddc2ce58de91925561ddf7201120a288b5c5f01f1a320b63f11598e4b8ce3d0b000000000000000000000000000000001633cf00e5a713a368a715e5d2be87d2ceee08106db6d22acc566f68bf87797799d6525379e52bf558b97b2792987dc3";
    
    bytes constant PUBLIC_KEY_2 = hex"000000000000000000000000000000001610956436231a1d4d2cf32a58cbe069257c97539425f924f607440a4fa959cc128a66c6cbf9ad4b5272aeccb376aee60000000000000000000000000000000006658a610645f32c0824d1ff2462363b9ee89533900232f5c82ea14a7d0770731b158ef3b67559159106993cd044351b";
    
    bytes constant PUBLIC_KEY_3 = hex"000000000000000000000000000000000f3ddd77a7387e39155bc302a26342eaef48ddcf4087d032d88529c704a448476efc7363d00c497c02a2a6ca906582a90000000000000000000000000000000011a51192cc928d19d6cc95c390a2ab48d59cf4c6fc3cb3e239e4691489b02c1c94cf83ab805ff67b5b99a9bafd5e993b";
    
    bytes constant EXPECTED_AGGREGATED = hex"00000000000000000000000000000000065b4d393c287f86206be2e8d1b5166fb2dad25ae3649c62b5e465a80c9bf6b155de2de5e1262d9f2f00f3a7a0b95f430000000000000000000000000000000001a77ec6ba22d57dcece6ed70a7acb433097c161a6b137a731c86348b8888323beb59268f513d466a081060acc085a38";
    
    function run() external {
        uint256 deployerPrivateKey = 0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a;
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy aggregator contract
        G1PublicKeyAggregator aggregator = new G1PublicKeyAggregator();
        console.log("G1PublicKeyAggregator deployed at:", address(aggregator));
        
        // Prepare test data
        bytes[] memory publicKeys = new bytes[](3);
        publicKeys[0] = PUBLIC_KEY_1;
        publicKeys[1] = PUBLIC_KEY_2;
        publicKeys[2] = PUBLIC_KEY_3;
        
        console.log("\n=== Testing G1 Public Key Aggregation On-Chain ===");
        console.log("Input public keys count:", publicKeys.length);
        
        // Test aggregation and verification
        try aggregator.aggregateAndVerify(publicKeys, EXPECTED_AGGREGATED) 
            returns (bytes memory aggregated, bool matches, uint256 gasUsed) {
            
            console.log("\n--- Aggregation Results ---");
            console.log("Success: true");
            console.log("Gas used:", gasUsed);
            console.log("Results match expected:", matches);
            console.log("Aggregated key length:", aggregated.length);
            
            // Log the results
            console.log("\nComputed aggregated key:");
            console.logBytes(aggregated);
            
            console.log("\nExpected aggregated key:");
            console.logBytes(EXPECTED_AGGREGATED);
            
            if (matches) {
                console.log("\n[SUCCESS] On-chain aggregation matches index.js result!");
            } else {
                console.log("\n[MISMATCH] On-chain result differs from index.js");
            }
            
        } catch Error(string memory reason) {
            console.log("\n--- Aggregation Failed ---");
            console.log("Error:", reason);
        } catch (bytes memory) {
            console.log("\n--- Aggregation Failed ---");
            console.log("Unknown error occurred");
        }
        
        // Test individual key aggregation to debug
        console.log("\n=== Testing Step-by-Step Aggregation ===");
        
        try aggregator.aggregatePublicKeys(publicKeys) returns (bytes memory result) {
            console.log("Step-by-step aggregation successful");
            console.log("Result length:", result.length);
            console.logBytes(result);
        } catch Error(string memory reason) {
            console.log("Step-by-step aggregation failed:", reason);
        }
        
        // Test single key (should just return the input)
        console.log("\n=== Testing Single Key ===");
        bytes[] memory singleKey = new bytes[](1);
        singleKey[0] = PUBLIC_KEY_1;
        
        try aggregator.aggregatePublicKeys(singleKey) returns (bytes memory single) {
            bool matchesInput = keccak256(single) == keccak256(PUBLIC_KEY_1);
            console.log("Single key aggregation works:", matchesInput);
        } catch Error(string memory reason) {
            console.log("Single key aggregation failed:", reason);
        }
        
        vm.stopBroadcast();
        
        console.log("\n=== Test Complete ===");
    }
}