// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SimpleBLSNoNeg
 * @dev 简化的BLS12-381聚合签名验证合约
 * 接受已经取负的聚合公钥，避免合约中的复杂取负计算
 */
contract SimpleBLSNoNeg {
    // EIP-2537 预编译合约地址
    uint256 constant BLS12_PAIRING_CHECK = 0x0f;
    
    // G1和G2点的编码长度
    uint256 constant G1_ENCODED_LENGTH = 128;
    uint256 constant G2_ENCODED_LENGTH = 256;
    uint256 constant PAIR_LENGTH = 384; // G1 + G2
    
    // G1生成元 (标准BLS12-381生成元，128字节EIP-2537格式)
    bytes constant G1_GENERATOR = hex"0000000000000000000000000000000017f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb0000000000000000000000000000000008b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1";
    
    /**
     * @dev 验证BLS聚合签名 (使用预先取负的公钥)
     * @param negatedAggregatedPubKey 已经取负的聚合公钥 (G1点，128字节)
     * @param aggregatedSignature 聚合签名 (G2点，256字节)
     * @param messageG2 消息哈希映射到G2 (G2点，256字节)
     * @return 验证结果
     */
    function verifyWithNegatedPubKey(
        bytes calldata negatedAggregatedPubKey,
        bytes calldata aggregatedSignature,
        bytes calldata messageG2
    ) external view returns (bool) {
        require(negatedAggregatedPubKey.length == G1_ENCODED_LENGTH, "Invalid negatedAggregatedPubKey length");
        require(aggregatedSignature.length == G2_ENCODED_LENGTH, "Invalid aggregatedSignature length");
        require(messageG2.length == G2_ENCODED_LENGTH, "Invalid messageG2 length");
        
        // 构建配对检查的输入数据
        bytes memory pairingInput = buildPairingInputWithNegated(
            negatedAggregatedPubKey,
            aggregatedSignature,
            messageG2
        );
        
        // 调用EIP-2537预编译合约进行配对检查
        (bool success, bytes memory result) = address(uint160(BLS12_PAIRING_CHECK)).staticcall{gas: 200000}(pairingInput);
        
        if (!success) {
            return false;
        }
        
        // 检查结果是否为1 (配对验证成功)
        return result.length == 32 && bytes32(result) == bytes32(uint256(1));
    }
    
    /**
     * @dev 直接验证Go生成的配对数据
     * @param pairingCalldata Go signer生成的完整配对数据
     * @return 验证结果
     */
    function verify(bytes calldata pairingCalldata) external view returns (bool) {
        // 直接调用配对预编译，使用Go的成功数据格式
        (bool success, bytes memory result) = address(uint160(BLS12_PAIRING_CHECK)).staticcall{gas: 200000}(pairingCalldata);
        
        if (!success) {
            return false;
        }
        
        return result.length == 32 && bytes32(result) == bytes32(uint256(1));
    }
    
    /**
     * @dev 构建配对检查的输入数据 (使用已经取负的公钥)
     * 格式: (G1生成元, aggregatedSignature) + (negatedAggregatedPubKey, messageG2)
     * 每个配对384字节: 128字节G1 + 256字节G2
     */
    function buildPairingInputWithNegated(
        bytes calldata negatedAggregatedPubKey,
        bytes calldata aggregatedSignature,
        bytes calldata messageG2
    ) internal pure returns (bytes memory) {
        bytes memory input = new bytes(PAIR_LENGTH * 2);
        
        // 第一个配对: (G1生成元, aggregatedSignature)
        // 复制G1生成元 (完整128字节)
        for (uint i = 0; i < G1_ENCODED_LENGTH; i++) {
            input[i] = G1_GENERATOR[i];
        }
        
        // 复制aggregatedSignature (256字节)
        for (uint i = 0; i < G2_ENCODED_LENGTH; i++) {
            input[G1_ENCODED_LENGTH + i] = aggregatedSignature[i];
        }
        
        // 第二个配对: (negatedAggregatedPubKey, messageG2)
        // 直接复制已经取负的公钥
        for (uint i = 0; i < G1_ENCODED_LENGTH; i++) {
            input[PAIR_LENGTH + i] = negatedAggregatedPubKey[i];
        }
        
        // 复制messageG2 (256字节)
        for (uint i = 0; i < G2_ENCODED_LENGTH; i++) {
            input[PAIR_LENGTH + G1_ENCODED_LENGTH + i] = messageG2[i];
        }
        
        return input;
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
}