// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import "../src/BasicPaymaster.sol";
import {IEntryPoint} from "account-abstraction/legacy/v06/IEntryPoint06.sol";
import {UserOperation06} from "account-abstraction/legacy/v06/UserOperation06.sol";
import {IPaymaster06} from "account-abstraction/legacy/v06/IPaymaster06.sol";
import {IStakeManager06} from "account-abstraction/legacy/v06/IStakeManager06.sol";

contract MockEntryPoint is IEntryPoint {
    mapping(address => uint256) private balances;
    mapping(address => uint256) private stakes;
    mapping(address => IStakeManager06.DepositInfo) private deposits;
    
    function depositTo(address account) external payable {
        balances[account] += msg.value;
        deposits[account].deposit += uint112(msg.value);
    }
    
    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external {
        require(balances[msg.sender] >= withdrawAmount, "Insufficient balance");
        balances[msg.sender] -= withdrawAmount;
        deposits[msg.sender].deposit -= uint112(withdrawAmount);
        withdrawAddress.transfer(withdrawAmount);
    }
    
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }
    
    function getDepositInfo(address account) external view returns (IStakeManager06.DepositInfo memory info) {
        return deposits[account];
    }
    
    function addStake(uint32) external payable {
        stakes[msg.sender] += msg.value;
        deposits[msg.sender].stake = uint112(stakes[msg.sender]);
        deposits[msg.sender].staked = true;
    }
    
    function unlockStake() external {
        deposits[msg.sender].withdrawTime = uint48(block.timestamp + deposits[msg.sender].unstakeDelaySec);
    }
    
    function withdrawStake(address payable withdrawAddress) external {
        uint256 stake = stakes[msg.sender];
        stakes[msg.sender] = 0;
        deposits[msg.sender].stake = 0;
        deposits[msg.sender].staked = false;
        withdrawAddress.transfer(stake);
    }
    
    function incrementNonce(uint192) external {
        // Mock implementation
    }
    
    // Other IEntryPoint methods not implemented for simplicity
    function handleOps(UserOperation06[] calldata, address payable) external {}

    function handleAggregatedOps(IEntryPoint.UserOpsPerAggregator[] calldata, address payable) external {}
    function getUserOpHash(UserOperation06 calldata) external view returns (bytes32) { return bytes32(0); }
    function simulateValidation(UserOperation06 calldata) external {}
    function simulateHandleOp(UserOperation06 calldata, address, bytes calldata) external {}
    function getSenderAddress(bytes calldata) external pure {}
    function getNonce(address, uint192) external view returns (uint256) { return 0; }
}

contract BasicPaymasterTest is Test {
    BasicPaymaster public paymaster;
    MockEntryPoint public entryPoint;
    
    address public owner;
    address public user1;
    address public user2;
    address public beneficiary;
    
    event SenderAllowlistUpdated(address indexed sender, bool allowed);
    event MinDepositUpdated(uint256 newMinDeposit);
    event AllowlistRequirementUpdated(bool required);
    event UserOperationSponsored(address indexed sender, address indexed paymaster, uint256 actualGasCost);
    
    function setUp() public {
        owner = address(this);
        user1 = address(0x1);
        user2 = address(0x2);
        beneficiary = address(0x3);
        
        entryPoint = new MockEntryPoint();
        paymaster = new BasicPaymaster(IEntryPoint(address(entryPoint)));
    }
    
    function testConstructor() public view {
        assertEq(address(paymaster.entryPoint()), address(entryPoint));
        assertEq(paymaster.owner(), owner);
        assertEq(paymaster.minDeposit(), 0.01 ether);
        assertEq(paymaster.requireAllowlist(), false);
    }
    
    function testDeposit() public {
        uint256 depositAmount = 1 ether;
        paymaster.deposit{value: depositAmount}();
        
        assertEq(entryPoint.balanceOf(address(paymaster)), depositAmount);
        assertEq(paymaster.getDeposit(), depositAmount);
    }
    
    function testReceive() public {
        uint256 depositAmount = 0.5 ether;
        (bool success,) = address(paymaster).call{value: depositAmount}("");
        assertTrue(success);
        
        assertEq(entryPoint.balanceOf(address(paymaster)), depositAmount);
    }
    
    function testWithdrawTo() public {
        uint256 depositAmount = 1 ether;
        paymaster.deposit{value: depositAmount}();
        
        uint256 initialBalance = beneficiary.balance;
        paymaster.withdrawTo(payable(beneficiary), depositAmount);
        
        assertEq(beneficiary.balance, initialBalance + depositAmount);
        assertEq(entryPoint.balanceOf(address(paymaster)), 0);
    }
    
    function testWithdrawToNotOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        paymaster.withdrawTo(payable(beneficiary), 1 ether);
    }
    
    function testSetAllowedSender() public {
        assertEq(paymaster.allowedSenders(user1), false);
        
        vm.expectEmit(true, false, false, true);
        emit SenderAllowlistUpdated(user1, true);
        paymaster.setAllowedSender(user1, true);
        
        assertEq(paymaster.allowedSenders(user1), true);
        
        vm.expectEmit(true, false, false, true);
        emit SenderAllowlistUpdated(user1, false);
        paymaster.setAllowedSender(user1, false);
        
        assertEq(paymaster.allowedSenders(user1), false);
    }
    
    function testSetAllowedSendersBatch() public {
        address[] memory senders = new address[](2);
        senders[0] = user1;
        senders[1] = user2;
        
        bool[] memory allowed = new bool[](2);
        allowed[0] = true;
        allowed[1] = true;
        
        paymaster.setAllowedSendersBatch(senders, allowed);
        
        assertEq(paymaster.allowedSenders(user1), true);
        assertEq(paymaster.allowedSenders(user2), true);
    }
    
    function testSetRequireAllowlist() public {
        assertEq(paymaster.requireAllowlist(), false);
        
        vm.expectEmit(false, false, false, true);
        emit AllowlistRequirementUpdated(true);
        paymaster.setRequireAllowlist(true);
        
        assertEq(paymaster.requireAllowlist(), true);
    }
    
    function testSetMinDeposit() public {
        uint256 newMinDeposit = 0.1 ether;
        
        vm.expectEmit(false, false, false, true);
        emit MinDepositUpdated(newMinDeposit);
        paymaster.setMinDeposit(newMinDeposit);
        
        assertEq(paymaster.minDeposit(), newMinDeposit);
    }
    
    function testValidatePaymasterUserOpSuccess() public {
        // Setup: deposit enough funds
        paymaster.deposit{value: 1 ether}();
        
        // Create a mock user operation
        UserOperation06 memory userOp;
        userOp.sender = user1;
        userOp.nonce = 0;
        userOp.initCode = "";
        userOp.callData = "";
        userOp.callGasLimit = 100000;
        userOp.verificationGasLimit = 100000;
        userOp.preVerificationGas = 21000;
        userOp.maxFeePerGas = 1000000000;
        userOp.maxPriorityFeePerGas = 1000000000;
        userOp.paymasterAndData = "";
        userOp.signature = "";
        
        // Call from EntryPoint
        vm.prank(address(entryPoint));
        (bytes memory context, uint256 validationData) = paymaster.validatePaymasterUserOp(
            userOp,
            bytes32(0),
            0.1 ether
        );
        
        assertEq(validationData, 0); // Success
        assertTrue(context.length > 0);
    }
    
    function testValidatePaymasterUserOpWithAllowlist() public {
        // Setup: enable allowlist and add user1
        paymaster.setRequireAllowlist(true);
        paymaster.setAllowedSender(user1, true);
        paymaster.deposit{value: 1 ether}();
        
        // Create a mock user operation
        UserOperation06 memory userOp;
        userOp.sender = user1;
        userOp.nonce = 0;
        userOp.initCode = "";
        userOp.callData = "";
        userOp.callGasLimit = 100000;
        userOp.verificationGasLimit = 100000;
        userOp.preVerificationGas = 21000;
        userOp.maxFeePerGas = 1000000000;
        userOp.maxPriorityFeePerGas = 1000000000;
        userOp.paymasterAndData = "";
        userOp.signature = "";
        
        // Call from EntryPoint - should succeed
        vm.prank(address(entryPoint));
        (bytes memory context, uint256 validationData) = paymaster.validatePaymasterUserOp(
            userOp,
            bytes32(0),
            0.1 ether
        );
        
        assertEq(validationData, 0); // Success
        assertTrue(context.length > 0);
    }
    
    function testValidatePaymasterUserOpNotAllowed() public {
        // Setup: enable allowlist but don't add user1
        paymaster.setRequireAllowlist(true);
        paymaster.deposit{value: 1 ether}();
        
        // Create a mock user operation
        UserOperation06 memory userOp;
        userOp.sender = user1;
        
        // Call from EntryPoint - should revert
        vm.prank(address(entryPoint));
        vm.expectRevert(BasicPaymaster.SenderNotAllowed.selector);
        paymaster.validatePaymasterUserOp(
            userOp,
            bytes32(0),
            0.1 ether
        );
    }
    
    function testValidatePaymasterUserOpInsufficientDeposit() public {
        // Don't deposit enough funds
        paymaster.deposit{value: 0.001 ether}();
        
        // Create a mock user operation
        UserOperation06 memory userOp;
        userOp.sender = user1;
        
        // Call from EntryPoint - should revert
        vm.prank(address(entryPoint));
        vm.expectRevert(BasicPaymaster.InsufficientDeposit.selector);
        paymaster.validatePaymasterUserOp(
            userOp,
            bytes32(0),
            0.1 ether
        );
    }
    
    function testValidatePaymasterUserOpNotEntryPoint() public {
        UserOperation06 memory userOp;
        
        vm.expectRevert(BasicPaymaster.EntryPointOnly.selector);
        paymaster.validatePaymasterUserOp(
            userOp,
            bytes32(0),
            0.1 ether
        );
    }
    
    function testPostOp() public {
        paymaster.deposit{value: 1 ether}();
        
        // Prepare context
        bytes memory context = abi.encode(user1, uint256(0), uint256(0.1 ether));
        
        // Call from EntryPoint
        vm.prank(address(entryPoint));
        vm.expectEmit(true, true, false, true);
        emit UserOperationSponsored(user1, address(paymaster), 0.05 ether);
        paymaster.postOp(
            IPaymaster06.PostOpMode.opSucceeded,
            context,
            0.05 ether
        );
    }
    
    function testPostOpNotEntryPoint() public {
        bytes memory context = abi.encode(user1, uint256(0), uint256(0.1 ether));
        
        vm.expectRevert(BasicPaymaster.EntryPointOnly.selector);
        paymaster.postOp(
            IPaymaster06.PostOpMode.opSucceeded,
            context,
            0.05 ether
        );
    }
    
    function testStakeManagement() public {
        // Add stake
        paymaster.addStake{value: 0.5 ether}(86400);
        
        // Unlock stake
        paymaster.unlockStake();
        
        // Withdraw stake
        uint256 initialBalance = beneficiary.balance;
        paymaster.withdrawStake(payable(beneficiary));
        assertEq(beneficiary.balance, initialBalance + 0.5 ether);
    }
    
    function testWithdrawToOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user1));
        paymaster.withdrawTo(payable(beneficiary), 1 ether);
    }
    
    function testSetAllowedSenderOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user1));
        paymaster.setAllowedSender(user2, true);
    }
    
    function testSetRequireAllowlistOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user1));
        paymaster.setRequireAllowlist(true);
    }
    
    function testSetMinDepositOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user1));
        paymaster.setMinDeposit(0.1 ether);
    }
}