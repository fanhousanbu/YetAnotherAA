// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/AAStarAccountV6.sol";
import "../src/AAStarAccountFactoryV6.sol";

/**
 * @title DeployAndTest  
 * @dev Deploy test wrapper and test hashToCurve functionality
 */
contract DeployAndTest is Script {
    address constant VALIDATOR_CONTRACT_ADDRESS = 0x1E0c95946801ef4Fc294eA1F8214faB2357bFF9C;
    address constant ENTRY_POINT_ADDRESS = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("ETH_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Deploying Test Wrapper ===");
        
        // Deploy test wrapper
        IEntryPoint entryPoint = IEntryPoint(ENTRY_POINT_ADDRESS);
        AAStarAccountV6TestWrapper testWrapper = new AAStarAccountV6TestWrapper(entryPoint);
        console.log("Test wrapper deployed at:", address(testWrapper));
        
        // Test hashToCurve with sample userOpHash
        bytes32 testHash = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
        console.log("Testing hashToCurve with hash:", vm.toString(testHash));
        
        try testWrapper.testHashToCurveG2(testHash) returns (bytes memory result) {
            console.log("HashToCurve successful!");
            console.log("Result length:", result.length);
            
            // Log first few bytes of result
            if (result.length >= 32) {
                bytes32 firstChunk;
                assembly {
                    firstChunk := mload(add(result, 32))
                }
                console.log("First 32 bytes:");
                console.logBytes32(firstChunk);
            }
        } catch Error(string memory reason) {
            console.log("HashToCurve failed with reason:", reason);
        } catch {
            console.log("HashToCurve failed with unknown error");
        }
        
        // Test signature parsing
        console.log("\n=== Testing Signature Parsing ===");
        testSignatureParsing(testWrapper);
        
        vm.stopBroadcast();
    }
    
    function testSignatureParsing(AAStarAccountV6TestWrapper wrapper) internal pure {
        // Create test signature: [nodeIdsLength(32)][nodeIds...][blsSignature(256)][aaSignature(65)]
        bytes memory testSig = abi.encodePacked(
            uint256(2), // 2 node IDs
            bytes32(0x1111111111111111111111111111111111111111111111111111111111111111),
            bytes32(0x2222222222222222222222222222222222222222222222222222222222222222),
            new bytes(256), // BLS signature
            new bytes(65)   // AA signature  
        );
        
        console.log("Test signature length:", testSig.length);
        
        try wrapper.testParseAAStarSignature(testSig) returns (
            bytes32[] memory nodeIds,
            bytes memory blsSignature,
            bytes memory aaSignature  
        ) {
            console.log("Signature parsing successful!");
            console.log("NodeIds count:", nodeIds.length);
            console.log("BLS signature length:", blsSignature.length);
            console.log("AA signature length:", aaSignature.length);
            
            if (nodeIds.length > 0) {
                console.log("First nodeId:");
                console.logBytes32(nodeIds[0]);
            }
        } catch Error(string memory reason) {
            console.log("Signature parsing failed:", reason);
        } catch {
            console.log("Signature parsing failed with unknown error");
        }
    }
}

/**
 * @title AAStarAccountV6TestWrapper
 * @dev Test wrapper to expose internal functions
 */
contract AAStarAccountV6TestWrapper is AAStarAccountV6 {
    constructor(IEntryPoint anEntryPoint) AAStarAccountV6(anEntryPoint) {}
    
    function testHashToCurveG2(bytes32 hash) external pure returns (bytes memory) {
        return _hashToCurveG2(hash);
    }
    
    function testParseAAStarSignature(bytes calldata signature) external pure returns (
        bytes32[] memory nodeIds,
        bytes memory blsSignature,  
        bytes memory aaSignature
    ) {
        return _parseAAStarSignature(signature);
    }
}