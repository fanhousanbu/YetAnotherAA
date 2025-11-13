// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DelegationFactory.sol";
import "../src/MinimalDelegationContract.sol";

/**
 * @title Helper Script
 * @notice Helper functions for testing and management
 */
contract Helper is Script {
    /**
     * @notice Test delegation functionality
     */
    function testDelegation() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address factory = vm.envAddress("DELEGATION_FACTORY_ADDRESS");
        address testUser = vm.envAddress("TEST_EOA_ADDRESS");
        address paymaster = vm.envAddress("PAYMASTER_ADDRESS");

        console.log("Testing delegation with factory:", factory);
        console.log("Test user:", testUser);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy delegation if not exists
  address payable delegation = payable(DelegationFactory(factory).getDelegation(testUser));
        if (delegation == address(0)) {
            console.log("Deploying new delegation...");
            delegation = payable(DelegationFactory(factory).deployDelegation(testUser, 0.1 ether));
            console.log("New delegation at:", delegation);
        } else {
            console.log("Existing delegation at:", delegation);
        }

        // Test execute function (will fail if not owner)
        try MinimalDelegationContract(delegation).execute(
            paymaster,
            0,
            "0x"
        ) {
            console.log("[SUCCESS] Execute test passed");
        } catch Error(string memory reason) {
            console.log("Expected error:", reason);
        }

        vm.stopBroadcast();
    }

    /**
     * @notice Get delegation info
     * @param factory Factory address
     * @param user User address
     */
    function getDelegationInfo(address factory, address user) external view {
        address delegation = DelegationFactory(factory).getDelegation(user);
        console.log("Delegation address:", delegation);

        if (delegation != address(0)) {
            MinimalDelegationContract del = MinimalDelegationContract(payable(delegation));
            console.log("Owner:", del.OWNER());
            console.log("Paymaster:", del.paymaster());
            console.log("Daily Limit:", del.dailyLimit());
            console.log("Daily Spent:", del.dailySpent(user));
            console.log("Remaining Daily Limit:", del.getRemainingDailyLimit());
        }
    }
}