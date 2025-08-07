// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/AggregateSignatureValidator.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();

        AggregateSignatureValidator validator = new AggregateSignatureValidator();
        
        console.log("AggregateSignatureValidator deployed to:", address(validator));
        
        // Verify the contract is working by checking gas estimates
        (uint256 directGas, uint256 componentGas) = validator.getGasEstimates();
        console.log("Direct validation gas estimate:", directGas);
        console.log("Component validation gas estimate:", componentGas);
        
        // Check signature format
        string memory format = validator.getSignatureFormat();
        console.log("Signature format:", format);

        vm.stopBroadcast();
    }
}