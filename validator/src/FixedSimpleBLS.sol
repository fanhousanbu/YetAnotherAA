// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract FixedSimpleBLS {
    // EIP-2537 预编译合约地址
    uint256 constant BLS12_PAIRING_CHECK = 0x0f;
    
    /**
     * @dev 直接验证Go生成的配对数据 - 最简单的方式
     * @param pairingCalldata Go signer生成的完整配对数据 (768字节)
     * @return 验证结果
     */
    function verify(bytes calldata pairingCalldata) external view returns (bool) {
        // 验证输入长度
        require(pairingCalldata.length == 768, "Invalid pairing data length");
        
        // 直接调用配对预编译
        (bool success, bytes memory result) = address(uint160(BLS12_PAIRING_CHECK)).staticcall{gas: 200000}(pairingCalldata);
        
        if (!success) {
            return false;
        }
        
        // 检查结果是否为1 (配对验证成功)
        return result.length == 32 && bytes32(result) == bytes32(uint256(1));
    }
    
    /**
     * @dev 调试函数：返回详细的调用信息
     */
    function debug(bytes calldata pairingCalldata) external view returns (
        bool success,
        bytes memory result,
        uint256 inputLength,
        bool isValidResult
    ) {
        inputLength = pairingCalldata.length;
        (success, result) = address(uint160(BLS12_PAIRING_CHECK)).staticcall{gas: 200000}(pairingCalldata);
        isValidResult = success && result.length == 32 && bytes32(result) == bytes32(uint256(1));
    }
    
    /**
     * @dev 获取预估的gas消耗
     */
    function getGasCost() external pure returns (uint256) {
        // 配对检查的基础gas成本: 32600*2 + 37700 = 102900
        return 32600 * 2 + 37700;
    }
}