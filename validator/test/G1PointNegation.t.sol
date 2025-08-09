// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/G1PointNegation.sol";

contract G1PointNegationTest is Test {
    
    G1PointNegation public negation;
    
    // Test data from index.js output
    bytes constant ORIGINAL_AGGREGATED_KEY = hex"00000000000000000000000000000000064154a7a4dbdeec2393f6db4cac3dd4f5668a7b1e5b2ac884eb70b6bf4964bbbd9b5f892a5477d4df2bb998ddceca62000000000000000000000000000000000012a5d94d020a6e3a70d4565cd95ed6298f0b7026b6f7950677a7ff08970f0a851d64a953489b0a152a9d93b98af41c";
    
    bytes constant EXPECTED_NEGATED_KEY = hex"00000000000000000000000000000000064154a7a4dbdeec2393f6db4cac3dd4f5668a7b1e5b2ac884eb70b6bf4964bbbd9b5f892a5477d4df2bb998ddceca620000000000000000000000000000000019ee6c10ec7ddc2c10aad35fe6724e013ae84014ccce1b2a60b92aa1ee19e719998e9b555e0b64f5a4d4626c4674b68f";
    
    bytes constant GENERATOR_POINT = hex"0000000000000000000000000000000017f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb0000000000000000000000000000000008b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1";
    
    function setUp() public {
        negation = new G1PointNegation();
    }
    
    function testNegateAggregatedKey() public view {
        console.log("=== Testing G1 Point Negation ===");
        console.log("");
        
        console.log("Original aggregated key:");
        console.logBytes(ORIGINAL_AGGREGATED_KEY);
        console.log("");
        
        // Test the negation
        uint256 gasBefore = gasleft();
        bytes memory result = negation.negateG1Point(ORIGINAL_AGGREGATED_KEY);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Contract negation result:");
        console.logBytes(result);
        console.log("");
        
        console.log("Expected result (from index.js):");
        console.logBytes(EXPECTED_NEGATED_KEY);
        console.log("");
        
        console.log("Gas used:", gasUsed);
        console.log("Results match:", keccak256(result) == keccak256(EXPECTED_NEGATED_KEY));
        
        // Assert they match
        assertEq(keccak256(result), keccak256(EXPECTED_NEGATED_KEY), 
            "Contract result should match index.js result");
    }
    
    function testNegateGenerator() public view {
        console.log("Testing generator point negation...");
        
        uint256 gasBefore = gasleft();
        bytes memory result = negation.negateG1Point(GENERATOR_POINT);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Generator point negated successfully");
        console.log("Gas used:", gasUsed);
        console.log("Result length:", result.length);
        
        // Verify x coordinate is unchanged
        bool xUnchanged = true;
        for (uint256 i = 0; i < 64; i++) {
            if (result[i] != GENERATOR_POINT[i]) {
                xUnchanged = false;
                break;
            }
        }
        
        console.log("X coordinate unchanged:", xUnchanged);
        assertTrue(xUnchanged, "X coordinate should remain unchanged");
        
        // Verify y coordinate is different
        bool yChanged = false;
        for (uint256 i = 64; i < 128; i++) {
            if (result[i] != GENERATOR_POINT[i]) {
                yChanged = true;
                break;
            }
        }
        
        console.log("Y coordinate changed:", yChanged);
        assertTrue(yChanged, "Y coordinate should change");
    }
    
    function testPointAtInfinity() public view {
        console.log("Testing point at infinity...");
        
        bytes memory infinityPoint = new bytes(128); // All zeros
        
        uint256 gasBefore = gasleft();
        bytes memory result = negation.negateG1Point(infinityPoint);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas used:", gasUsed);
        
        // Verify result is also all zeros
        bool isZero = true;
        for (uint256 i = 0; i < 128; i++) {
            if (result[i] != 0) {
                isZero = false;
                break;
            }
        }
        
        console.log("Result is point at infinity:", isZero);
        assertTrue(isZero, "Point at infinity should remain unchanged");
    }
    
    function testBatchNegation() public view {
        console.log("Testing batch negation...");
        
        bytes[] memory points = new bytes[](3);
        points[0] = ORIGINAL_AGGREGATED_KEY;
        points[1] = GENERATOR_POINT;
        points[2] = new bytes(128); // Point at infinity
        
        uint256 gasBefore = gasleft();
        bytes[] memory results = negation.batchNegateG1Points(points);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Batch negation completed");
        console.log("Gas used:", gasUsed);
        console.log("Results count:", results.length);
        
        // Verify first result matches expected
        assertEq(keccak256(results[0]), keccak256(EXPECTED_NEGATED_KEY), 
            "Batch result should match single negation");
        
        // Verify individual negation matches batch result
        bytes memory singleResult = negation.negateG1Point(GENERATOR_POINT);
        assertEq(keccak256(results[1]), keccak256(singleResult), 
            "Batch and single results should match");
    }
    
    function testUtilityFunctions() public view {
        console.log("Testing utility functions...");
        
        (uint256 p0, uint256 p1) = negation.getFieldModulus();
        console.log("Field modulus p0:", p0);
        console.log("Field modulus p1:", p1);
        
        uint256 gasEstimate = negation.getGasEstimate();
        console.log("Gas estimate:", gasEstimate);
        
        bool validLength = negation.validateG1PointLength(GENERATOR_POINT);
        console.log("Generator point has valid length:", validLength);
        
        bytes memory shortPoint = new bytes(64);
        bool invalidLength = negation.validateG1PointLength(shortPoint);
        console.log("Short point has valid length:", invalidLength);
        
        assertTrue(validLength, "128-byte point should be valid");
        assertFalse(invalidLength, "64-byte point should be invalid");
    }
    
    function testGasUsage() public view {
        console.log("=== Gas Usage Analysis ===");
        
        // Test different types of points
        bytes[] memory testPoints = new bytes[](3);
        testPoints[0] = ORIGINAL_AGGREGATED_KEY;
        testPoints[1] = GENERATOR_POINT;  
        testPoints[2] = new bytes(128); // Point at infinity
        
        string[] memory names = new string[](3);
        names[0] = "Aggregated Key";
        names[1] = "Generator Point";
        names[2] = "Point at Infinity";
        
        for (uint256 i = 0; i < testPoints.length; i++) {
            uint256 gasBefore = gasleft();
            negation.negateG1Point(testPoints[i]);
            uint256 gasUsed = gasBefore - gasleft();
            
            console.log(string.concat(names[i], " gas usage:"), gasUsed);
        }
    }
}