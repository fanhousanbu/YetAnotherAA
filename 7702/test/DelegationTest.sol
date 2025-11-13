// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MinimalDelegationContract.sol";
import "../src/DelegationFactory.sol";

contract DelegationTest is Test {
    // Test addresses
    address private owner = address(0x1);
    address private paymaster = address(0x2);
    address private sbtContract = address(0x3);
    address private xPNTsContract = address(0x4);
    uint256 private dailyLimit = 1 ether;

    MinimalDelegationContract public delegation;
    DelegationFactory public factory;

    function setUp() public {
        // Deploy contracts
        vm.startPrank(owner);

        factory = new DelegationFactory(paymaster, sbtContract, xPNTsContract);

        delegation = new MinimalDelegationContract(
            owner,
            paymaster,
            sbtContract,
            xPNTsContract,
            dailyLimit
        );

        vm.stopPrank();
    }

    function testDeployment() public {
        assertEq(delegation.OWNER(), owner, "Owner should be set correctly");
        assertEq(delegation.paymaster(), paymaster, "Paymaster should be set correctly");
        assertEq(delegation.dailyLimit(), dailyLimit, "Daily limit should be set correctly");
    }

    function testExecute() public {
        vm.startPrank(owner);

        // Test execution to paymaster
        vm.deal(address(delegation), 1 ether);
        delegation.execute{value: 0.1 ether}(paymaster, 0.01 ether, "");

        vm.stopPrank();
    }

    function testExecuteUnauthorized() public {
        vm.startPrank(address(0x999));

        vm.expectRevert(MinimalDelegationContract.Unauthorized.selector);
        delegation.execute(paymaster, 0, "");

        vm.stopPrank();
    }

    function testDailyLimit() public {
        vm.startPrank(owner);

        // This should pass
        delegation.execute(paymaster, 0.5 ether, "");

        // This should fail due to daily limit
        vm.expectRevert(MinimalDelegationContract.DailyLimitExceeded.selector);
        delegation.execute(paymaster, 0.6 ether, "");

        vm.stopPrank();
    }

    function testFactoryDeployment() public {
        vm.startPrank(owner);

        address newOwner = address(0x5);
        address newDelegation = factory.deployDelegation(newOwner, 0.5 ether);

        assertEq(newDelegation != address(0), true, "Delegation should be deployed");
        assertEq(factory.getDelegation(newOwner), newDelegation, "Delegation should be tracked");

        vm.stopPrank();
    }

    function testFactoryPredictAddress() public {
        address predicted = factory.predictDelegationAddress(owner);
        assertEq(predicted != address(0), true, "Should predict non-zero address");
    }

    function testReceive() public {
        vm.startPrank(owner);

        vm.deal(owner, 1 ether);
        (bool success,) = payable(delegation).call{value: 0.5 ether}("");
        assertEq(success, true, "Should be able to receive ETH");

        vm.stopPrank();
    }
}