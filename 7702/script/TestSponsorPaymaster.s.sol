// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SponsorPaymaster.sol";

/**
 * @title TestSponsorPaymaster
 * @notice 测试 SponsorPaymaster 合约功能
 */
contract TestSponsorPaymaster is Script {
    function run() external {
        uint256 deployerPrivateKey = 0x2717524c39f8b8ab74c902dc712e590fee36993774119c1e06d31daa4b0fbc81;
        address paymasterAddress = 0x91Cb993E50e959C10b4600CB825A93740b79FeA9;
        address testUser = 0xc8d1Ae1063176BEBC750D9aD5D057BA4A65daf3d;

        console.log("Testing SponsorPaymaster at:", paymasterAddress);
        console.log("Test user:", testUser);

        vm.startBroadcast(deployerPrivateKey);

        SponsorPaymaster paymaster = SponsorPaymaster(payable(paymasterAddress));

        // 检查状态
        console.log("\n=== Paymaster Status ===");
        console.log("Balance:", paymaster.getBalance());
        console.log("Remaining Cap:", paymaster.getRemainingSponsorshipCap());
        console.log("Daily Limit:", paymaster.getRemainingDailySponsorship());
        console.log("Is user sponsored:", paymaster.isUserSponsored(testUser));

        // 小额充值测试
        uint256 testAmount = 0.01 ether;
        console.log("\nDepositing test amount:", testAmount);
        paymaster.addDeposit{value: testAmount}();

        console.log("New balance:", paymaster.getBalance());

        vm.stopBroadcast();

        console.log("\n[SUCCESS] Test completed!");
    }

    function testSponsorship(address paymasterAddress, address user) external {
        uint256 deployerPrivateKey = 0x2717524c39f8b8ab74c902dc712e590fee36993774119c1e06d31daa4b0fbc81;

        vm.startBroadcast(deployerPrivateKey);

        SponsorPaymaster paymaster = SponsorPaymaster(payable(paymasterAddress));

        // 构造测试 UserOperation Hash
        bytes32 userOpHash = keccak256(abi.encodePacked("test", block.timestamp));

        // 用户签名
        vm.startPrank(user);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(12345, userOpHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        vm.stopPrank();

        // 测试赞助
        console.log("\n=== Testing Sponsorship ===");
        console.log("User:", user);
        console.log("UserOpHash:", uint256(userOpHash));

        uint256 validationData = paymaster.validateAndSponsor(
            user,
            userOpHash,
            100000000000000000, // 0.1 ETH
            signature
        );

        console.log("Validation result:", validationData);

        if (validationData == 0) {
            console.log("[SUCCESS] Sponsorship approved!");
        } else {
            console.log("[FAILED] Sponsorship rejected, code:", validationData);
        }

        // 检查用户状态
        console.log("Is user sponsored after:", paymaster.isUserSponsored(user));

        vm.stopBroadcast();
    }
}