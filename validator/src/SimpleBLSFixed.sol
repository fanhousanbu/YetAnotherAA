// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleBLSFixed {
    // EIP-2537 预编译合约地址
    uint256 constant BLS12_PAIRING_CHECK = 0x0f;
    
    // G1和G2点的编码长度
    uint256 constant G1_ENCODED_LENGTH = 128;
    uint256 constant G2_ENCODED_LENGTH = 256;
    uint256 constant PAIR_LENGTH = 384; // G1 + G2
    
    // G1生成元 (标准BLS12-381生成元，128字节完整格式)
    bytes constant G1_GENERATOR = hex"17f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb08b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    
    /**
     * @dev 验证BLS聚合签名
     * @param aggregatedPubKey 聚合后的公钥 (G1点，128字节)
     * @param aggregatedSignature 聚合签名 (G2点，256字节)
     * @param messageG2 消息哈希映射到G2 (G2点，256字节)
     * @return 验证结果
     */
    function verifyAggregatedSignature(
        bytes calldata aggregatedPubKey,
        bytes calldata aggregatedSignature,
        bytes calldata messageG2
    ) external view returns (bool) {
        require(aggregatedPubKey.length == G1_ENCODED_LENGTH, "Invalid aggregatedPubKey length");
        require(aggregatedSignature.length == G2_ENCODED_LENGTH, "Invalid aggregatedSignature length");
        require(messageG2.length == G2_ENCODED_LENGTH, "Invalid messageG2 length");
        
        // 构建配对检查的输入数据
        bytes memory pairingInput = buildPairingInput(
            aggregatedPubKey,
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
     * @dev 构建配对检查的输入数据
     * 格式: (G1生成元, aggregatedSignature) + (-aggregatedPubKey, messageG2)
     * 每个配对384字节: 128字节G1 + 256字节G2
     */
    function buildPairingInput(
        bytes calldata aggregatedPubKey,
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
        
        // 第二个配对: (-aggregatedPubKey, messageG2)
        // 对G1点取负：复制x坐标，对y坐标取负
        bytes memory negatedPubKey = negateG1Point(aggregatedPubKey);
        for (uint i = 0; i < G1_ENCODED_LENGTH; i++) {
            input[PAIR_LENGTH + i] = negatedPubKey[i];
        }
        
        // 复制messageG2 (256字节)
        for (uint i = 0; i < G2_ENCODED_LENGTH; i++) {
            input[PAIR_LENGTH + G1_ENCODED_LENGTH + i] = messageG2[i];
        }
        
        return input;
    }
    
    /**
     * @dev 对G1点取负 - 手动实现 (将y坐标取负模p)
     * BLS12-381的素数p需要分块处理，因为它超过了uint256的范围
     */
    function negateG1Point(bytes calldata point) internal pure returns (bytes memory) {
        require(point.length == G1_ENCODED_LENGTH, "Invalid G1 point length");
        
        bytes memory negated = new bytes(G1_ENCODED_LENGTH);
        
        // 复制x坐标 (前64字节)
        for (uint i = 0; i < 64; i++) {
            negated[i] = point[i];
        }
        
        // 检查y坐标是否为0 (64-128字节)
        bool isZero = true;
        for (uint i = 64; i < 128; i++) {
            if (point[i] != 0) {
                isZero = false;
                break;
            }
        }
        
        if (isZero) {
            // 如果y=0，则-y=0，直接复制
            for (uint i = 64; i < 128; i++) {
                negated[i] = point[i];
            }
        } else {
            // 对y坐标取负：p - y (使用字节级减法)
            // BLS12-381的素数p (48字节)
            bytes memory p = hex"1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab";
            
            // 执行 p - y 的字节级减法
            // 注意：y坐标是64字节，但p只有48字节，前16字节应该为0
            uint256 borrow = 0;
            
            // 处理低48字节 (p的有效部分)
            for (uint i = 0; i < 48; i++) {
                uint256 pByte = uint256(uint8(p[47 - i]));
                uint256 yByte = uint256(uint8(point[127 - i]));
                
                if (pByte >= yByte + borrow) {
                    negated[127 - i] = bytes1(uint8(pByte - yByte - borrow));
                    borrow = 0;
                } else {
                    negated[127 - i] = bytes1(uint8(pByte + 256 - yByte - borrow));
                    borrow = 1;
                }
            }
            
            // 处理高16字节 (应该都是0，因为y < p)
            for (uint i = 48; i < 64; i++) {
                uint256 yByte = uint256(uint8(point[127 - i]));
                
                if (yByte == 0 && borrow == 0) {
                    negated[127 - i] = 0x00;
                } else {
                    // 如果y的高位不为0或有借位，说明y >= p，这是无效的
                    revert("Invalid G1 point: y coordinate >= p");
                }
            }
        }
        
        return negated;
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