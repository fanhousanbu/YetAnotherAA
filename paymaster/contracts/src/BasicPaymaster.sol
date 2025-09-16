// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import {IPaymaster06} from "account-abstraction/legacy/v06/IPaymaster06.sol";
import {IEntryPoint} from "account-abstraction/legacy/v06/IEntryPoint06.sol";
import {UserOperation06} from "account-abstraction/legacy/v06/UserOperation06.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BasicPaymaster
 * @notice A basic paymaster implementation compatible with ERC-4337
 * @dev This paymaster sponsors user operations and can be configured with deposit thresholds
 */
contract BasicPaymaster is IPaymaster06, Ownable {
    IEntryPoint public immutable entryPoint;
    
    uint256 private constant POST_OP_GAS = 50000;
    
    mapping(address => bool) public allowedSenders;
    mapping(address => uint256) public senderNonce;
    
    uint256 public minDeposit = 0.01 ether;
    bool public requireAllowlist = false;
    
    event SenderAllowlistUpdated(address indexed sender, bool allowed);
    event MinDepositUpdated(uint256 newMinDeposit);
    event AllowlistRequirementUpdated(bool required);
    event UserOperationSponsored(address indexed sender, address indexed paymaster, uint256 actualGasCost);
    
    error EntryPointOnly();
    error SenderNotAllowed();
    error InsufficientDeposit();
    error WithdrawFailed();
    
    modifier onlyEntryPoint() {
        if (msg.sender != address(entryPoint)) {
            revert EntryPointOnly();
        }
        _;
    }
    
    constructor(IEntryPoint _entryPoint) Ownable(msg.sender) {
        entryPoint = _entryPoint;
    }
    
    /**
     * @notice Validates a paymaster user operation
     * @param userOp The user operation
     * @param userOpHash The hash of the user operation
     * @param maxCost The maximum cost of the operation
     * @return context The context to be passed to postOp
     * @return validationData Validation data (0 for success)
     */
    function validatePaymasterUserOp(
        UserOperation06 calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        (userOpHash);
        
        // Check if sender is allowed (if allowlist is enabled)
        if (requireAllowlist && !allowedSenders[userOp.sender]) {
            revert SenderNotAllowed();
        }
        
        // Check if paymaster has enough deposit
        uint256 paymasterDeposit = entryPoint.balanceOf(address(this));
        if (paymasterDeposit < minDeposit) {
            revert InsufficientDeposit();
        }
        
        // Store sender and nonce in context for postOp
        context = abi.encode(userOp.sender, senderNonce[userOp.sender]++, maxCost);
        
        // Return 0 for successful validation
        validationData = 0;
    }
    
    /**
     * @notice Post-operation handler
     * @param mode The mode of the operation
     * @param context The context from validatePaymasterUserOp
     * @param actualGasCost The actual gas cost of the operation
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external override onlyEntryPoint {
        (mode);
        
        (address sender, , ) = abi.decode(context, (address, uint256, uint256));
        
        emit UserOperationSponsored(sender, address(this), actualGasCost);
    }
    
    /**
     * @notice Deposits funds to the EntryPoint for this paymaster
     */
    function deposit() public payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }
    
    /**
     * @notice Withdraws funds from the EntryPoint
     * @param withdrawAddress The address to withdraw to
     * @param amount The amount to withdraw
     */
    function withdrawTo(address payable withdrawAddress, uint256 amount) public onlyOwner {
        entryPoint.withdrawTo(withdrawAddress, amount);
    }
    
    /**
     * @notice Adds stake to the EntryPoint
     * @param unstakeDelaySec The unstake delay in seconds
     */
    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }
    
    /**
     * @notice Unlocks stake from the EntryPoint
     */
    function unlockStake() external onlyOwner {
        entryPoint.unlockStake();
    }
    
    /**
     * @notice Withdraws stake from the EntryPoint
     * @param withdrawAddress The address to withdraw to
     */
    function withdrawStake(address payable withdrawAddress) external onlyOwner {
        entryPoint.withdrawStake(withdrawAddress);
    }
    
    /**
     * @notice Updates the allowlist status for a sender
     * @param sender The sender address
     * @param allowed Whether the sender is allowed
     */
    function setAllowedSender(address sender, bool allowed) external onlyOwner {
        allowedSenders[sender] = allowed;
        emit SenderAllowlistUpdated(sender, allowed);
    }
    
    /**
     * @notice Updates multiple allowlist statuses
     * @param senders The sender addresses
     * @param allowed Whether the senders are allowed
     */
    function setAllowedSendersBatch(address[] calldata senders, bool[] calldata allowed) external onlyOwner {
        require(senders.length == allowed.length, "Length mismatch");
        for (uint256 i = 0; i < senders.length; i++) {
            allowedSenders[senders[i]] = allowed[i];
            emit SenderAllowlistUpdated(senders[i], allowed[i]);
        }
    }
    
    /**
     * @notice Sets whether the allowlist is required
     * @param required Whether the allowlist is required
     */
    function setRequireAllowlist(bool required) external onlyOwner {
        requireAllowlist = required;
        emit AllowlistRequirementUpdated(required);
    }
    
    /**
     * @notice Sets the minimum deposit required
     * @param _minDeposit The minimum deposit amount
     */
    function setMinDeposit(uint256 _minDeposit) external onlyOwner {
        minDeposit = _minDeposit;
        emit MinDepositUpdated(_minDeposit);
    }
    
    /**
     * @notice Gets the current deposit for this paymaster
     * @return The current deposit amount
     */
    function getDeposit() public view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }
    
    /**
     * @notice Allows the paymaster to receive ETH
     */
    receive() external payable {
        deposit();
    }
}