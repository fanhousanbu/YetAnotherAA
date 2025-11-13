// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DelegationFactory.sol";
import "../src/MinimalDelegationContract.sol";

/**
 * @title DeploySimple
 * @notice Simplified deployment script without environment variables
 */
contract DeploySimple is Script {
    uint256 private constant DEFAULT_DAILY_LIMIT = 0.1 ether; // 0.1 ETH per day

    function run() external {
        // Load private key directly
        uint256 deployerPrivateKey = 0x2717524c39f8b8ab74c902dc712e590fee36993774119c1e06d31daa4b0fbc81;
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Delegation Factory
        console.log("\nDeploying DelegationFactory...");

        // Use placeholder addresses for now
        address paymaster = 0x0000000071727De22E5E9d8BAf0edAc6f37da032; // EntryPoint v0.7
        address sbtContract = address(0); // No SBT yet
        address xPNTsContract = 0x868F843723a98c6EECC4BF0aF3352C53d5004147; // GToken

        DelegationFactory factory = new DelegationFactory(
            paymaster,
            sbtContract,
            xPNTsContract
        );
        console.log("DelegationFactory deployed at:", address(factory));

        // 2. Deploy a test delegation
        console.log("\nDeploying test delegation...");
        address testUser = 0xc8d1Ae1063176BEBC750D9aD5D057BA4A65daf3d; // TEST_EOA_ADDRESS

        MinimalDelegationContract testDelegation = new MinimalDelegationContract(
            testUser,
            paymaster,
            sbtContract,
            xPNTsContract,
            DEFAULT_DAILY_LIMIT
        );
        console.log("Test delegation deployed at:", address(testDelegation));

        vm.stopBroadcast();

        console.log("\n[SUCCESS] Deployment Complete!");
        console.log("Factory:", address(factory));
        console.log("Test Delegation:", address(testDelegation));

        // Save deployment info
        string memory json = string(
            abi.encodePacked(
                "{",
                '"factory": "', vm.toString(address(factory)), '",',
                '"testDelegation": "', vm.toString(address(testDelegation)), '",',
                '"chainId": ', vm.toString(block.chainid), ",",
                '"paymaster": "', vm.toString(paymaster), '",',
                '"deployedAt": "', vm.toString(block.timestamp), '"',
                "}"
            )
        );

        vm.writeJson(json, "./deployments/deployment.json");
    }
}