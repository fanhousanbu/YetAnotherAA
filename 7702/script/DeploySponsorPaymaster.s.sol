// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SponsorPaymaster.sol";

/**
 * @title DeploySponsorPaymaster
 * @notice 部署赞助 Paymaster 合约
 */
contract DeploySponsorPaymaster is Script {
    function run() external {
        uint256 deployerPrivateKey = 0x2717524c39f8b8ab74c902dc712e590fee36993774119c1e06d31daa4b0fbc81;
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // 配置参数
        address xPNTsToken = 0x868F843723a98c6EECC4BF0aF3352C53d5004147; // GToken
        uint256 sponsorshipCap = 10 ether; // 10 ETH 赞助上限

        console.log("\nDeploying SponsorPaymaster...");
        console.log("xPNTs Token:", xPNTsToken);
        console.log("Sponsorship Cap:", sponsorshipCap);

        SponsorPaymaster paymaster = new SponsorPaymaster(
            xPNTsToken,
            sponsorshipCap
        );

        console.log("SponsorPaymaster deployed at:", address(paymaster));

        // 初始充值
        uint256 initialDeposit = 5 ether;
        console.log("\nDepositing initial funding:", initialDeposit);
        payable(address(paymaster)).transfer(initialDeposit);

        vm.stopBroadcast();

        console.log("\n[SUCCESS] Deployment Complete!");
        console.log("Paymaster:", address(paymaster));
        console.log("Balance:", paymaster.getBalance());
        console.log("Remaining Cap:", paymaster.getRemainingSponsorshipCap());

        // 保存部署信息
        string memory json = string(
            abi.encodePacked(
                "{",
                '"paymaster": "', vm.toString(address(paymaster)), '",',
                '"xPNTsToken": "', vm.toString(xPNTsToken), '",',
                '"sponsorshipCap": ', vm.toString(sponsorshipCap), ',',
                '"initialDeposit": ', vm.toString(initialDeposit), ',',
                '"chainId": ', vm.toString(block.chainid), ',',
                '"deployedAt": "', vm.toString(block.timestamp), '"',
                "}"
            )
        );

        vm.writeJson(json, "./deployments/sponsor-paymaster.json");
    }

    function testPaymaster(address paymasterAddress) external {
        uint256 deployerPrivateKey = 0x2717524c39f8b8ab74c902dc712e590fee36993774119c1e06d31daa4b0fbc81;
        address testUser = 0xc8d1Ae1063176BEBC750D9aD5D057BA4A65daf3d;

        vm.startBroadcast(deployerPrivateKey);

        SponsorPaymaster paymaster = SponsorPaymaster(payable(paymasterAddress));

        console.log("Testing SponsorPaymaster at:", paymasterAddress);

        // 检查状态
        console.log("Balance:", paymaster.getBalance());
        console.log("Remaining Cap:", paymaster.getRemainingSponsorshipCap());
        console.log("Daily Limit:", paymaster.getRemainingDailySponsorship());
        console.log("Is user sponsored:", paymaster.isUserSponsored(testUser));

        vm.stopBroadcast();
    }
}