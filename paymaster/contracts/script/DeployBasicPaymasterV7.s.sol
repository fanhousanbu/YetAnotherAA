// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/BasicPaymasterV7.sol";

contract DeployBasicPaymasterV7 is Script {
    // EntryPoint v0.7 address for Sepolia
    address constant SEPOLIA_ENTRY_POINT_V7 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address constant MAINNET_ENTRY_POINT_V7 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external {
        vm.startBroadcast();

        // Determine which EntryPoint to use based on chain ID
        address entryPointAddress;
        uint256 chainId = block.chainid;

        if (chainId == 11155111) { // Sepolia
            entryPointAddress = SEPOLIA_ENTRY_POINT_V7;
            console.log("Using Sepolia EntryPoint v0.7");
        } else if (chainId == 1) { // Mainnet
            entryPointAddress = MAINNET_ENTRY_POINT_V7;
            console.log("Using Mainnet EntryPoint v0.7");
        } else {
            entryPointAddress = SEPOLIA_ENTRY_POINT_V7;
            console.log("Using default EntryPoint v0.7 (Sepolia address)");
        }

        console.log("==== Deploying BasicPaymaster V7 ====");
        console.log("EntryPoint v0.7:", entryPointAddress);
        console.log("Deployer:", msg.sender);
        console.log("Chain ID:", chainId);

        // Deploy BasicPaymasterV7
        BasicPaymasterV7 paymaster = new BasicPaymasterV7(IEntryPoint(entryPointAddress));
        console.log("BasicPaymasterV7 deployed at:", address(paymaster));

        // Configure paymaster
        paymaster.setRequireAllowlist(false); // Demo mode: no allowlist required
        paymaster.setMinDeposit(0.001 ether); // Set minimal deposit requirement
        console.log("Paymaster configured for demo mode (no allowlist, min deposit: 0.001 ETH)");

        // Note: To fund the paymaster, send ETH directly to its address after deployment

        console.log("");
        console.log("==== Deployment Summary ====");
        console.log("BASIC_PAYMASTER_V7_ADDRESS=", address(paymaster));
        console.log("ENTRY_POINT_V7_ADDRESS=", entryPointAddress);
        console.log("Current paymaster deposit:", paymaster.getDeposit());

        console.log("");
        console.log("==== Next Steps ====");
        console.log("1. Fund the paymaster by sending ETH to:", address(paymaster));
        console.log("2. Or call deposit() function with ETH");
        console.log("3. Update configuration files with the paymaster address");

        vm.stopBroadcast();
    }
}