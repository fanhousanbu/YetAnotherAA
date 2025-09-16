// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Script.sol";
import "../src/BasicPaymaster.sol";
import {IEntryPoint} from "account-abstraction/legacy/v06/IEntryPoint06.sol";

contract DeployBasicPaymaster is Script {
    // EntryPoint addresses for different networks
    address constant ENTRYPOINT_MAINNET = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    address constant ENTRYPOINT_SEPOLIA = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    address constant ENTRYPOINT_ARBITRUM = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    address constant ENTRYPOINT_OPTIMISM = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    address constant ENTRYPOINT_POLYGON = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    address constant ENTRYPOINT_BASE = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    
    function run() external returns (BasicPaymaster) {
        // Get the EntryPoint address based on chain ID
        address entryPointAddress = getEntryPointAddress();
        
        // Get deployment private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying BasicPaymaster (ERC-4337)");
        console.log("Deployer:", deployer);
        console.log("EntryPoint:", entryPointAddress);
        console.log("Chain ID:", block.chainid);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the paymaster
        BasicPaymaster paymaster = new BasicPaymaster(IEntryPoint(entryPointAddress));
        console.log("BasicPaymaster deployed at:", address(paymaster));
        
        // Optional: Initial deposit to the paymaster
        uint256 initialDeposit = vm.envOr("INITIAL_DEPOSIT", uint256(0));
        if (initialDeposit > 0) {
            console.log("Making initial deposit:", initialDeposit);
            paymaster.deposit{value: initialDeposit}();
        }
        
        // Optional: Set up initial configuration
        bool requireAllowlist = vm.envOr("REQUIRE_ALLOWLIST", false);
        if (requireAllowlist) {
            console.log("Enabling allowlist requirement");
            paymaster.setRequireAllowlist(true);
        }
        
        uint256 minDeposit = vm.envOr("MIN_DEPOSIT", uint256(0.01 ether));
        if (minDeposit != 0.01 ether) {
            console.log("Setting minimum deposit:", minDeposit);
            paymaster.setMinDeposit(minDeposit);
        }
        
        vm.stopBroadcast();
        
        // Log deployment information
        console.log("=== Deployment Complete ===");
        console.log("Paymaster Address:", address(paymaster));
        console.log("Owner:", paymaster.owner());
        console.log("EntryPoint:", address(paymaster.entryPoint()));
        console.log("Current Deposit:", paymaster.getDeposit());
        console.log("Min Deposit Required:", paymaster.minDeposit());
        console.log("Allowlist Required:", paymaster.requireAllowlist());
        console.log("Version: ERC-4337");
        
        return paymaster;
    }
    
    function getEntryPointAddress() internal view returns (address) {
        uint256 chainId = block.chainid;
        
        // Check for environment variable override
        address envEntryPoint = vm.envOr("ENTRYPOINT_ADDRESS", address(0));
        if (envEntryPoint != address(0)) {
            return envEntryPoint;
        }
        
        // Return address based on chain ID
        if (chainId == 1) {
            return ENTRYPOINT_MAINNET;
        } else if (chainId == 11155111) {
            return ENTRYPOINT_SEPOLIA;
        } else if (chainId == 42161) {
            return ENTRYPOINT_ARBITRUM;
        } else if (chainId == 10) {
            return ENTRYPOINT_OPTIMISM;
        } else if (chainId == 137) {
            return ENTRYPOINT_POLYGON;
        } else if (chainId == 8453) {
            return ENTRYPOINT_BASE;
        } else if (chainId == 31337) {
            // Local development - deploy a mock or use a specific address
            return vm.envOr("ENTRYPOINT_ADDRESS", ENTRYPOINT_SEPOLIA);
        } else {
            revert(string.concat("Unsupported chain ID: ", vm.toString(chainId)));
        }
    }
}