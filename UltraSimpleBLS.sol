// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract UltraSimpleBLS {
    /**
     * @dev 直接调用配对预编译，使用Go的成功数据格式
     * @param pairingCalldata 完整的配对数据 (768字节)
     * @return 验证结果
     */
    function verify(bytes calldata pairingCalldata) external view returns (bool) {
        (bool success, bytes memory result) = address(0x0f).staticcall{gas: 200000}(pairingCalldata);
        if (!success) return false;
        return result.length == 32 && bytes32(result) == bytes32(uint256(1));
    }
    
    /**
     * @dev 调试函数：返回预编译调用的详细信息
     */
    function debug(bytes calldata pairingCalldata) external view returns (
        bool success,
        bytes memory result,
        uint256 inputLength,
        bool isValidResult
    ) {
        (success, result) = address(0x0f).staticcall{gas: 200000}(pairingCalldata);
        inputLength = pairingCalldata.length;
        isValidResult = result.length == 32 && bytes32(result) == bytes32(uint256(1));
    }
}