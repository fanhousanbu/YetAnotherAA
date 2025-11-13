// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MinimalDelegationContract
 * @notice EIP-7702 delegation contract for gasless EOA transactions
 * @dev Minimal implementation focused on security and gas efficiency
 */
contract MinimalDelegationContract {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error Unauthorized();
    error SBTRequired();
    error InsufficientBalance();
    error DailyLimitExceeded();
    error InvalidPaymaster();
    error InvalidTarget();

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event DelegationExecuted(
        address indexed target,
        uint256 value,
        bytes32 indexed dataHash,
        address indexed paymaster
    );
    event DailyLimitUpdated(uint256 newLimit);
    event PaymasterUpdated(address newPaymaster);

    /*//////////////////////////////////////////////////////////////
                                 CONSTANTS
    //////////////////////////////////////////////////////////////*/
    uint256 private constant DAY_IN_SECONDS = 86400;
    bytes4 private constant EIP1271_MAGIC_VALUE = 0x1626ba7e;

    // Gas payment configuration
    uint256 public constant MIN_APNTS_BALANCE = 10 ether;  // Minimum 10 aPNTs required
    uint256 public constant ETH_PRICE_USD = 3500;          // $3500 per ETH
    uint256 public constant APNTS_PRICE_USD = 21;          // $0.021 per aPNTs (21/1000)

    /*//////////////////////////////////////////////////////////////
                            IMMUTABLE STORAGE
    //////////////////////////////////////////////////////////////*/
    address public immutable OWNER;
    address public immutable SBT_CONTRACT;
    address public immutable XPNTS_CONTRACT;
    uint256 public immutable CREATION_BLOCK;

    /*//////////////////////////////////////////////////////////////
                            MUTABLE STORAGE
    //////////////////////////////////////////////////////////////*/
    address public paymaster;
    uint256 public dailyLimit;
    mapping(address => uint256) public dailySpent;
    mapping(address => uint256) public lastSpentDay;
    mapping(bytes32 => bool) public usedNonces;

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyOwner() {
        if (msg.sender != OWNER) revert Unauthorized();
        _;
    }

    modifier onlyPaymaster() {
        if (msg.sender != paymaster) revert InvalidPaymaster();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(
        address _owner,
        address _paymaster,
        address _sbtContract,
        address _xPNTsContract,
        uint256 _dailyLimit
    ) {
        if (_owner == address(0) || _paymaster == address(0)) revert InvalidTarget();

        OWNER = _owner;
        paymaster = _paymaster;
        SBT_CONTRACT = _sbtContract;
        XPNTS_CONTRACT = _xPNTsContract;
        dailyLimit = _dailyLimit;
        CREATION_BLOCK = block.number;
    }

    /*//////////////////////////////////////////////////////////////
                        EIP-7702 CORE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Execute a delegated call
     * @dev Only callable by the owner EOA
     * @param target Target contract address
     * @param value ETH value to send
     * @param data Call data
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external payable {
        // Verify sender is owner
        if (msg.sender != OWNER) revert Unauthorized();

        // Verify target is valid
        if (target == address(0)) revert InvalidTarget();

        // Check SBT ownership (if configured)
        if (SBT_CONTRACT != address(0)) {
            if (IERC721(SBT_CONTRACT).balanceOf(OWNER) == 0) revert SBTRequired();
        }

        // Update daily spent
        _updateDailySpent(value);

        // Execute call
        (bool success, ) = target.call{value: value}(data);
        if (!success) revert("Execution failed");

        emit DelegationExecuted(target, value, keccak256(abi.encodePacked(data)), paymaster);
    }

    /*//////////////////////////////////////////////////////////////
                    ERC-4337 PAYMASTER INTEGRATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Validate UserOperation for ERC-4337
     * @dev Called by paymaster to validate operation
     * @param userOpHash Hash of the UserOperation
     * @param userOp The UserOperation struct
     * @param missingAccountFunds Amount needed to cover gas
     * @return validationData 0 if valid, non-zero otherwise
     */
    function validateUserOp(
        bytes32 userOpHash,
        UserOperation calldata userOp,
        uint256 missingAccountFunds
    ) external payable onlyPaymaster returns (uint256 validationData) {
        // Verify SBT ownership
        if (SBT_CONTRACT != address(0)) {
            if (IERC721(SBT_CONTRACT).balanceOf(OWNER) == 0) {
                return 1; // Invalid: No SBT
            }
        }

        // Check aPNTs balance for gas payment
        if (XPNTS_CONTRACT != address(0) && missingAccountFunds > 0) {
            uint256 balance = IERC20(XPNTS_CONTRACT).balanceOf(OWNER);

            // Check minimum balance requirement (>10 aPNTs)
            if (balance < MIN_APNTS_BALANCE) {
                return 2; // Invalid: Balance < 10 aPNTs
            }

            // Calculate required aPNTs based on gas cost
            // Formula: (ETH cost * ETH price in USD) / aPNTs price in USD
            // = (missingAccountFunds * 3500) / 0.021
            // = (missingAccountFunds * 3500 * 1000) / 21
            uint256 apntsNeeded = (missingAccountFunds * ETH_PRICE_USD * 1000) / APNTS_PRICE_USD;

            if (balance < apntsNeeded) {
                return 3; // Invalid: Insufficient aPNTs for gas
            }

            // Approve paymaster to spend aPNTs
            IERC20(XPNTS_CONTRACT).approve(paymaster, apntsNeeded);
        }

        // Check nonce to prevent replay
        if (userOp.nonce != block.chainid) {
            return 4; // Invalid: Wrong nonce
        }

        return 0; // Valid
    }

    /**
     * @notice Post-operation hook called after execution
     * @dev Called by paymaster to deduct aPNTs for gas
     * @param actualGasCost Actual gas cost incurred (in ETH wei)
     */
    function postOp(
        uint256 actualGasCost
    ) external onlyPaymaster {
        if (XPNTS_CONTRACT != address(0) && actualGasCost > 0) {
            // Calculate aPNTs amount to deduct
            // Formula: (ETH cost * ETH price in USD) / aPNTs price in USD
            // = (actualGasCost * 3500) / 0.021
            // = (actualGasCost * 3500 * 1000) / 21
            uint256 apntsAmount = (actualGasCost * ETH_PRICE_USD * 1000) / APNTS_PRICE_USD;

            // Transfer aPNTs to paymaster
            bool success = IERC20(XPNTS_CONTRACT).transferFrom(
                OWNER,
                paymaster,
                apntsAmount
            );
            if (!success) revert InsufficientBalance();
        }
    }

    /*//////////////////////////////////////////////////////////////
                        OWNER MANAGEMENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Update daily limit
     * @dev Only callable by owner
     * @param _newLimit New daily limit in wei
     */
    function updateDailyLimit(uint256 _newLimit) external {
        require(msg.sender == OWNER, "Only owner");
        dailyLimit = _newLimit;
        emit DailyLimitUpdated(_newLimit);
    }

    /**
     * @notice Update paymaster address
     * @dev Only callable by owner
     * @param _newPaymaster New paymaster address
     */
    function updatePaymaster(address _newPaymaster) external {
        require(msg.sender == OWNER, "Only owner");
        if (_newPaymaster == address(0)) revert InvalidTarget();
        paymaster = _newPaymaster;
        emit PaymasterUpdated(_newPaymaster);
    }

    /*//////////////////////////////////////////////////////////////
                            UTILITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get current day identifier
     * @return Current day number since Unix epoch
     */
    function getCurrentDay() external view returns (uint256) {
        return block.timestamp / DAY_IN_SECONDS;
    }

    /**
     * @notice Get remaining daily limit
     * @return Remaining daily allowance
     */
    function getRemainingDailyLimit() external view returns (uint256) {
        uint256 currentDay = block.timestamp / DAY_IN_SECONDS;
        if (currentDay > lastSpentDay[OWNER]) {
            return dailyLimit;
        }
        return dailyLimit > dailySpent[OWNER] ? dailyLimit - dailySpent[OWNER] : 0;
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Update daily spent tracking
     * @param amount Amount to add to daily spent
     */
    function _updateDailySpent(uint256 amount) internal {
        uint256 currentDay = block.timestamp / DAY_IN_SECONDS;

        // Reset if new day
        if (currentDay > lastSpentDay[OWNER]) {
            dailySpent[OWNER] = amount;
            lastSpentDay[OWNER] = currentDay;
        } else {
            // Check daily limit
            if (dailySpent[OWNER] + amount > dailyLimit) {
                revert DailyLimitExceeded();
            }
            dailySpent[OWNER] += amount;
        }
    }

    /*//////////////////////////////////////////////////////////////
                        ERC-1271 SIGNATURE VALIDATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice ERC-1271 signature validation
     * @dev Allows contract to validate signatures on behalf of owner
     * @param hash Hash of the signed data
     * @param signature Signature bytes
     * @return magicValue Magic value if signature is valid
     */
    function isValidSignature(
        bytes32 hash,
        bytes calldata signature
    ) external view returns (bytes4 magicValue) {
        // Recover signer
        address signer = ECDSA.recover(hash, signature);

        // Check if signer is owner
        if (signer == OWNER) {
            return EIP1271_MAGIC_VALUE;
        }

        return bytes4(0);
    }

    /*//////////////////////////////////////////////////////////////
                            ERC-4337 STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    /*//////////////////////////////////////////////////////////////
                             RECEIVE FUNCTION
    //////////////////////////////////////////////////////////////*/

    receive() external payable {
        // Allow contract to receive ETH for gas refunds
    }
}