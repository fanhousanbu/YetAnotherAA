// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DelegationFactory.sol";
import "../src/MinimalDelegationContract.sol";

/**
 * @title Deploy Script
 * @notice Deployment script for EIP-7702 delegation system
 */
contract Deploy is Script {
    // Default configuration values
    uint256 private constant DEFAULT_DAILY_LIMIT = 0.1 ether; // 0.1 ETH per day
    address private constant ZERO_ADDRESS = address(0);

    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Network configuration
        uint256 chainId = block.chainid;
        bool isTestnet = chainId != 1;

        console.log("Deploying to chain:", chainId);
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);

        // Paymaster configuration
        address paymaster = vm.envAddress("PAYMASTER_ADDRESS");
        if (paymaster == ZERO_ADDRESS) {
            // Use EntryPoint v0.7 as default paymaster
            paymaster = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
        }

        // Token configuration
        address sbtContract = vm.envAddress("SBT_CONTRACT_ADDRESS");
        address xPNTsContract = vm.envAddress("GTOKEN_CONTRACT_ADDRESS");

        console.log("Paymaster:", paymaster);
        console.log("SBT Contract:", sbtContract);
        console.log("xPNTs Contract:", xPNTsContract);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Delegation Factory
        console.log("\nDeploying DelegationFactory...");
        DelegationFactory factory = new DelegationFactory(
            paymaster,
            sbtContract,
            xPNTsContract
        );
        console.log("DelegationFactory deployed at:", address(factory));

        // 2. Deploy a test delegation contract (optional)
        console.log("\nDeploying test delegation contract...");
        address testUser = vm.envAddress("TEST_EOA_ADDRESS");
        MinimalDelegationContract testDelegation = new MinimalDelegationContract(
            testUser,
            paymaster,
            sbtContract,
            xPNTsContract,
            DEFAULT_DAILY_LIMIT
        );
        console.log("Test delegation deployed at:", address(testDelegation));

        // 3. Verify deployment
        require(address(factory) != ZERO_ADDRESS, "Factory deployment failed");
        require(address(testDelegation) != ZERO_ADDRESS, "Test delegation deployment failed");

        vm.stopBroadcast();

        // 4. Save deployment information
        _saveDeploymentInfo(address(factory), address(testDelegation), chainId);

        console.log("\n[SUCCESS] Deployment Complete!");
        console.log("Factory:", address(factory));
        console.log("Test Delegation:", address(testDelegation));
    }

    /**
     * @notice Save deployment information to a file
     * @param factory Address of deployed factory
     * @param testDelegation Address of test delegation
     * @param chainId Chain ID where deployed
     */
    function _saveDeploymentInfo(
        address factory,
        address testDelegation,
        uint256 chainId
    ) internal {
        string memory json = string(
            abi.encodePacked(
                "{",
                '"chainId": ', vm.toString(chainId), ",",
                '"factory": "', vm.toString(factory), '",',
                '"testDelegation": "', vm.toString(testDelegation), '",',
                '"deployedAt": "', vm.toString(block.timestamp), '",',
                '"deployer": "', vm.toString(tx.origin), '"',
                "}"
            )
        );

        vm.writeJson(json, "./deployments/deployment.json");
    }

    /**
     * @notice Deploy only the factory contract
     */
    function deployFactory() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address paymaster = vm.envAddress("PAYMASTER_ADDRESS");
        address sbtContract = vm.envAddress("SBT_CONTRACT_ADDRESS");
        address xPNTsContract = vm.envAddress("GTOKEN_CONTRACT_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        DelegationFactory factory = new DelegationFactory(
            paymaster,
            sbtContract,
            xPNTsContract
        );

        vm.stopBroadcast();

        console.log("Factory deployed at:", address(factory));
    }

    /**
     * @notice Deploy a delegation contract for specific user
     * @param factory Address of deployed factory
     * @param user User address to create delegation for
     * @param dailyLimit Daily spending limit
     */
    function deployUserDelegation(
        address factory,
        address user,
        uint256 dailyLimit
    ) external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        address delegation = DelegationFactory(factory).deployDelegation(user, dailyLimit);

        vm.stopBroadcast();

        console.log("Delegation for", user, "deployed at:", delegation);
    }

    /**
     * @notice Predict delegation address before deployment
     * @param factory Address of factory contract
     * @param user User address
     * @return predicted Predicted delegation address
     */
    function predictDelegationAddress(
        address factory,
        address user
    ) external view returns (address predicted) {
        return DelegationFactory(factory).predictDelegationAddress(user);
    }
}