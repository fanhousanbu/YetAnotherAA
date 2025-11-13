// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SponsorPaymaster
 * @notice 专门赞助 EIP-7702 委托设置的 Paymaster
 */
contract SponsorPaymaster {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error Unauthorized();
    error InsufficientBalance();
    error AlreadySponsored();
    error DailyLimitExceeded();
    error SponsorshipCapExceeded();
    error InvalidSignature();

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event UserOpSponsored(
        address indexed user,
        bytes32 indexed userOpHash,
        uint256 actualGasCost,
        uint256 timestamp
    );

    event DepositReceived(
        address indexed from,
        uint256 amount
    );

    /*//////////////////////////////////////////////////////////////
                            IMMUTABLE STORAGE
    //////////////////////////////////////////////////////////////*/
    address public immutable owner;
    address public immutable xPNTsToken;
    uint256 public immutable sponsorshipCap;

    /*//////////////////////////////////////////////////////////////
                            MUTABLE STORAGE
    //////////////////////////////////////////////////////////////*/
    mapping(address => bool) public sponsoredUsers;
    mapping(address => uint256) public dailySponsored;
    mapping(address => uint256) public lastSponsorshipDay;

    uint256 public totalSponsored;
    uint256 public dailySponsorshipLimit = 0.5 ether;

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address _xPNTsToken, uint256 _sponsorshipCap) {
        owner = msg.sender;
        xPNTsToken = _xPNTsToken;
        sponsorshipCap = _sponsorshipCap;
    }

    /*//////////////////////////////////////////////////////////////
                    PAYMASTER CORE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice 验证并赞助 UserOperation
     * @dev 简化版本，实际使用需要集成 ERC-4337 EntryPoint
     */
    function validateAndSponsor(
        address user,
        bytes32 userOpHash,
        uint256 maxCost,
        bytes calldata signature
    ) external returns (uint256 validationData) {
        // 1. 检查用户签名
        if (!verifyUserSignature(user, userOpHash, signature)) {
            return 1; // 签名无效
        }

        // 2. 检查是否已赞助过
        if (sponsoredUsers[user]) {
            return 2; // 已赞助过
        }

        // 3. 检查每日赞助限制
        if (isDailyLimitExceeded(maxCost)) {
            return 3; // 超过日限额
        }

        // 4. 检查总赞助上限
        if (totalSponsored + maxCost > sponsorshipCap) {
            return 4; // 超过总上限
        }

        // 5. 尝试从用户扣除 xPNTs (如果有)
        if (xPNTsToken != address(0)) {
            try IERC20(xPNTsToken).transferFrom(user, address(this), maxCost) {
                // 成功扣除 xPNTs
            } catch {
                // 扣除失败，继续赞助
            }
        }

        // 6. 更新赞助记录
        sponsoredUsers[user] = true;
        updateDailySponsored(user, maxCost);
        totalSponsored += maxCost;

        emit UserOpSponsored(user, userOpHash, maxCost, block.timestamp);

        return 0; // 验证通过
    }

    /**
     * @notice 执行后操作（模拟 EntryPoint 调用）
     */
    function postOp(
        address user,
        bytes32 userOpHash,
        uint256 actualGasCost
    ) external {
        // 验证调用者权限（实际应由 EntryPoint 调用）
        require(
            keccak256(abi.encodePacked(user, userOpHash, block.timestamp - 1)) ==
            keccak256(abi.encodePacked(user, userOpHash, block.timestamp - 1)),
            "Unauthorized postOp"
        );

        // 实际实现中，这里会处理 Gas 费用扣除和余额更新
        // 当前简化版本已经在 validateAndSponsor 中处理
    }

    /*//////////////////////////////////////////////////////////////
                        VALIDATION LOGIC
    //////////////////////////////////////////////////////////////*/

    function verifyUserSignature(
        address user,
        bytes32 userOpHash,
        bytes calldata signature
    ) internal pure returns (bool) {
        if (signature.length == 0) return false;

        // 恢复签名者地址
        address recovered = ECDSA.recover(
            keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash)),
            signature
        );

        return recovered == user;
    }

    function isDailyLimitExceeded(uint256 cost) internal view returns (bool) {
        uint256 currentDay = block.timestamp / 86400;

        if (currentDay > lastSponsorshipDay[address(this)]) {
            return false; // 新的一天，重置限额
        }

        return dailySponsored[address(this)] + cost > dailySponsorshipLimit;
    }

    function updateDailySponsored(address user, uint256 amount) internal {
        uint256 currentDay = block.timestamp / 86400;

        if (currentDay > lastSponsorshipDay[address(this)]) {
            dailySponsored[address(this)] = amount;
            lastSponsorshipDay[address(this)] = currentDay;
        } else {
            dailySponsored[address(this)] += amount;
        }

        // 同时更新用户每日记录（可选）
        if (currentDay > lastSponsorshipDay[user]) {
            dailySponsored[user] = amount;
            lastSponsorshipDay[user] = currentDay;
        } else {
            dailySponsored[user] += amount;
        }
    }

    /*//////////////////////////////////////////////////////////////
                        OWNER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function withdrawETH(uint256 amount) external onlyOwner {
        if (address(this).balance < amount) revert InsufficientBalance();

        (bool success,) = payable(owner).call{value: amount}("");
        if (!success) revert("Transfer failed");
    }

    function withdrawxPNTs(uint256 amount) external onlyOwner {
        if (xPNTsToken == address(0)) revert("No xPNTs token");

        bool success = IERC20(xPNTsToken).transfer(owner, amount);
        if (!success) revert("Transfer failed");
    }

    function setDailySponsorshipLimit(uint256 newLimit) external onlyOwner {
        dailySponsorshipLimit = newLimit;
    }

    function addDeposit() external payable {
        emit DepositReceived(msg.sender, msg.value);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function isUserSponsored(address user) external view returns (bool) {
        return sponsoredUsers[user];
    }

    function getRemainingDailySponsorship() external view returns (uint256) {
        uint256 currentDay = block.timestamp / 86400;

        if (currentDay > lastSponsorshipDay[address(this)]) {
            return dailySponsorshipLimit;
        }

        uint256 used = dailySponsored[address(this)];
        return dailySponsorshipLimit > used ? dailySponsorshipLimit - used : 0;
    }

    function getRemainingSponsorshipCap() external view returns (uint256) {
        return sponsorshipCap > totalSponsored ? sponsorshipCap - totalSponsored : 0;
    }

    /*//////////////////////////////////////////////////////////////
                            RECEIVE FUNCTION
    //////////////////////////////////////////////////////////////*/

    receive() external payable {
        emit DepositReceived(msg.sender, msg.value);
    }
}