// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DelegationFactory.sol";
import "../src/MinimalDelegationContract.sol";
import "../src/SponsorPaymaster.sol";

/**
 * @title DeployNew
 * @notice Fresh deployment script with proper address generation
 */
contract DeployNew is Script {
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

        // Paymaster configuration - use EntryPoint as default
        address paymaster = vm.envAddress("PAYMASTER_ADDRESS");
        if (paymaster == ZERO_ADDRESS) {
            // Use EntryPoint v0.7 as default paymaster
            paymaster = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
        }

        // Token configuration
        address sbtContract = vm.envAddress("SBT_CONTRACT_ADDRESS");
        address xPNTsContract = vm.envAddress("GTOKEN_CONTRACT_ADDRESS");
        if (sbtContract == ZERO_ADDRESS) sbtContract = ZERO_ADDRESS;
        if (xPNTsContract == ZERO_ADDRESS) xPNTsContract = ZERO_ADDRESS;

        console.log("Paymaster (for DelegationFactory):", paymaster);
        console.log("SBT Contract:", sbtContract);
        console.log("xPNTs Contract:", xPNTsContract);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Delegation Factory FIRST
        console.log("\n[STEP 1] Deploying DelegationFactory...");
        DelegationFactory factory = new DelegationFactory(
            paymaster,
            sbtContract,
            xPNTsContract
        );
        address factoryAddress = address(factory);
        console.log("[SUCCESS] DelegationFactory deployed at:", factoryAddress);

        // Add a small delay to ensure different nonce usage
        vm.warp(block.timestamp + 1);

        // 2. Deploy SponsorPaymaster SECOND (different contract, different address)
        console.log("\n[STEP 2] Deploying SponsorPaymaster...");
        uint256 sponsorshipCap = 10 ether; // 10 ETH sponsorship cap

        SponsorPaymaster sponsorPaymaster = new SponsorPaymaster(
            xPNTsContract != ZERO_ADDRESS ? xPNTsContract : deployer, // fallback to deployer if no token
            sponsorshipCap
        );
        address paymasterAddress = address(sponsorPaymaster);
        console.log("[SUCCESS] SponsorPaymaster deployed at:", paymasterAddress);

        // 3. Verify addresses are different
        require(factoryAddress != paymasterAddress, "ADDRESSES_MUST_BE_DIFFERENT");
        require(factoryAddress != ZERO_ADDRESS, "FACTORY_ADDRESS_INVALID");
        require(paymasterAddress != ZERO_ADDRESS, "PAYMASTER_ADDRESS_INVALID");

        console.log("\n[SUCCESS] Both contracts deployed with different addresses:");
        console.log("DelegationFactory:", factoryAddress);
        console.log("SponsorPaymaster:", paymasterAddress);
        console.log("Are they different?", factoryAddress != paymasterAddress);

        // 4. Fund the SponsorPaymaster (optional)
        if (deployer.balance >= 5 ether) {
            console.log("\n[STEP 3] Funding SponsorPaymaster...");
            payable(paymasterAddress).call{value: 5 ether}("");
            console.log("[SUCCESS] SponsorPaymaster funded with 5 ETH");
        }

        vm.stopBroadcast();

        // 5. Save deployment information
        _saveDeploymentInfo(factoryAddress, paymasterAddress, chainId);

        console.log("\n[FINAL] Deployment Complete!");
        console.log("Deployment info saved to deployments/sepolia-new.json");
    }

    /**
     * @notice Save deployment information to a file
     * @param factory Address of deployed factory
     * @param paymaster Address of deployed paymaster
     * @param chainId Chain ID where deployed
     */
    function _saveDeploymentInfo(
        address factory,
        address paymaster,
        uint256 chainId
    ) internal {
        string memory json = string(
            abi.encodePacked(
                "{",
                '"chainId": ', vm.toString(chainId), ",",
                '"network": "sepolia-new",',
                '"factory": "', vm.toString(factory), '",',
                '"paymaster": "', vm.toString(paymaster), '",',
                '"deployedAt": "', vm.toString(block.timestamp), '",',
                '"deployer": "', vm.toString(tx.origin), '",',
                '"addressesDiffer": ', vm.toString(factory != paymaster),
                "}"
            )
        );

        vm.writeJson(json, "./deployments/sepolia-new.json");
    }

    /**
     * @notice Deploy only SponsorPaymaster (for testing)
     */
    function deployPaymasterOnly() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address xPNTsContract = vm.envAddress("GTOKEN_CONTRACT_ADDRESS");
        if (xPNTsContract == ZERO_ADDRESS) {
            xPNTsContract = deployer; // fallback
        }

        vm.startBroadcast(deployerPrivateKey);

        SponsorPaymaster paymaster = new SponsorPaymaster(
            xPNTsContract,
            10 ether
        );

        address paymasterAddress = address(paymaster);
        console.log("SponsorPaymaster deployed at:", paymasterAddress);

        vm.stopBroadcast();
    }
}
