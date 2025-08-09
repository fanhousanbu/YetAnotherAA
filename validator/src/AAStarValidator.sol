// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AAStarValidator
 * @dev AA* BLS聚合签名验证器
 * 
 * 此合约提供完整的BLS签名验证功能，包括：
 * - 多方公钥聚合
 * - BLS聚合签名验证
 * - ERC-4337 Account Abstraction 兼容性
 * - 高效的Gas优化实现
 * 
 * 业务流程：
 * 1. 验证多个参与方的BLS聚合签名
 * 2. 支持直接验证和组件验证模式
 * 3. 提供详细的验证结果和Gas使用统计
 */
contract AAStarValidator {
    
    // =============================================================
    //                           CONSTANTS
    // =============================================================
    
    /// @dev EIP-2537 precompile addresses
    address private constant G1_ADD_PRECOMPILE = 0x000000000000000000000000000000000000000b;
    address private constant PAIRING_PRECOMPILE = 0x000000000000000000000000000000000000000F;
    
    /// @dev Cryptographic point lengths
    uint256 private constant G1_POINT_LENGTH = 128;
    uint256 private constant G2_POINT_LENGTH = 256;
    uint256 private constant PAIRING_INPUT_LENGTH = 768; // 2 * (G1 + G2)
    
    /// @dev BLS12-381 field modulus (381 bits split into two 256-bit parts)
    uint256 private constant FIELD_MODULUS_HIGH = 0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f624;
    uint256 private constant FIELD_MODULUS_LOW = 0x1eabfffeb153ffffb9feffffffffaaab;
    
    /// @dev G1 generator point for pairing verification
    bytes private constant G1_GENERATOR = hex"0000000000000000000000000000000017f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb0000000000000000000000000000000008b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1";
    
    // =============================================================
    //                           EVENTS
    // =============================================================
    
    event SignatureVerified(
        bytes32 indexed messageHash,
        uint256 participantCount,
        bool isValid,
        uint256 gasConsumed
    );
    
    
    // =============================================================
    //                      MAIN VERIFICATION API
    // =============================================================
    
    /**
     * @dev 验证多方聚合BLS签名的主要接口
     * 
     * @param participantKeys 参与签名的公钥列表
     * @param aggregateSignature 聚合后的BLS签名
     * @param messageHash 待验证的消息哈希（G2点编码）
     * @return isValid 签名是否有效
     */
    function verifyAggregateSignature(
        bytes[] calldata participantKeys,
        bytes calldata aggregateSignature,
        bytes calldata messageHash
    ) external returns (bool isValid) {
        require(participantKeys.length > 0, "No participants");
        require(aggregateSignature.length == G2_POINT_LENGTH, "Invalid signature format");
        require(messageHash.length == G2_POINT_LENGTH, "Invalid message format");
        
        uint256 gasStart = gasleft();
        
        // Step 1: 聚合参与方公钥
        bytes memory combinedKey = _combineParticipantKeys(participantKeys);
        
        // Step 2: 执行BLS签名验证
        isValid = _executeSignatureVerification(combinedKey, aggregateSignature, messageHash);
        
        uint256 gasUsed = gasStart - gasleft();
        emit SignatureVerified(
            keccak256(abi.encode(participantKeys, aggregateSignature, messageHash)),
            participantKeys.length,
            isValid,
            gasUsed
        );
    }
    
    /**
     * @dev 验证多方聚合签名（只读版本，不触发事件）
     * 
     * @param participantKeys 参与签名的公钥列表
     * @param aggregateSignature 聚合后的BLS签名
     * @param messageHash 待验证的消息哈希
     * @return isValid 签名是否有效
     */
    function validateAggregateSignature(
        bytes[] calldata participantKeys,
        bytes calldata aggregateSignature,
        bytes calldata messageHash
    ) external view returns (bool isValid) {
        require(participantKeys.length > 0, "No participants");
        require(aggregateSignature.length == G2_POINT_LENGTH, "Invalid signature format");
        require(messageHash.length == G2_POINT_LENGTH, "Invalid message format");
        
        bytes memory combinedKey = _combineParticipantKeys(participantKeys);
        bytes memory sigMem = aggregateSignature;
        bytes memory msgMem = messageHash;
        isValid = _executeSignatureVerification(combinedKey, sigMem, msgMem);
    }
    
    
    // =============================================================
    //                      PARTICIPANT MANAGEMENT
    // =============================================================
    
    /**
     * @dev 预估多方验证的Gas消耗
     * 
     * @param participantCount 参与方数量
     * @return gasEstimate Gas消耗估算
     */
    function estimateVerificationCost(uint256 participantCount) 
        external 
        pure 
        returns (uint256 gasEstimate) 
    {
        if (participantCount == 0) return 0;
        
        // 基础成本 + 聚合成本 + 密钥处理成本 + 配对验证成本
        return 50000 + (participantCount * 500) + 3000 + 180000;
    }
    
    // =============================================================
    //                      INTERNAL CORE LOGIC
    // =============================================================
    
    /**
     * @dev 聚合参与方公钥
     */
    function _combineParticipantKeys(bytes[] calldata participantKeys) 
        internal 
        view 
        returns (bytes memory combinedKey) 
    {
        require(participantKeys.length > 0, "No participants");
        
        combinedKey = participantKeys[0];
        require(combinedKey.length == G1_POINT_LENGTH, "Invalid key length");
        
        // 使用G1加法逐步聚合公钥
        for (uint256 i = 1; i < participantKeys.length; i++) {
            require(participantKeys[i].length == G1_POINT_LENGTH, "Invalid key length");
            combinedKey = _addG1Points(combinedKey, participantKeys[i]);
        }
    }
    
    /**
     * @dev 处理聚合公钥用于验证（取反操作）
     */
    function _processKeyForVerification(bytes memory aggregatedKey) 
        internal 
        pure 
        returns (bytes memory processedKey) 
    {
        require(aggregatedKey.length == G1_POINT_LENGTH, "Invalid key length");
        
        processedKey = new bytes(G1_POINT_LENGTH);
        
        // 复制x坐标不变（前64字节）
        for (uint256 i = 0; i < 64; i++) {
            processedKey[i] = aggregatedKey[i];
        }
        
        // 检查是否为无限远点
        bool isInfinity = _isPointAtInfinity(aggregatedKey);
        if (isInfinity) {
            return processedKey; // 无限远点保持不变
        }
        
        // 对y坐标取反：计算 p - y
        _negateYCoordinate(aggregatedKey, processedKey);
    }
    
    /**
     * @dev 执行BLS签名验证
     */
    function _executeSignatureVerification(
        bytes memory aggregatedKey,
        bytes memory signature,
        bytes memory messageHash
    ) internal view returns (bool isValid) {
        // 处理聚合公钥（取反）
        bytes memory processedKey = _processKeyForVerification(aggregatedKey);
        
        // 构建配对验证数据
        bytes memory pairingData = _buildPairingData(processedKey, signature, messageHash);
        
        // 调用配对预编译进行验证
        return _verifyPairingData(pairingData);
    }
    
    /**
     * @dev G1点加法
     */
    function _addG1Points(bytes memory point1, bytes calldata point2) 
        internal 
        view 
        returns (bytes memory result) 
    {
        require(point1.length == G1_POINT_LENGTH, "Invalid point1 length");
        require(point2.length == G1_POINT_LENGTH, "Invalid point2 length");
        
        bytes memory input = abi.encodePacked(point1, point2);
        result = new bytes(G1_POINT_LENGTH);
        
        assembly {
            let success := staticcall(gas(), 0x0b, add(input, 0x20), 256, add(result, 0x20), 128)
            if eq(success, 0) {
                revert(0, 0)
            }
        }
    }
    
    /**
     * @dev 对G1点的y坐标取反
     */
    function _negateYCoordinate(bytes memory point, bytes memory result) internal pure {
        // 提取y坐标（字节80-127，48字节）
        uint256 y_high = 0;
        uint256 y_low = 0;
        
        assembly {
            let yPtr := add(point, 100) // 跳过长度前缀(32) + x坐标(64) + y坐标前缀(16) = 112 - 12 = 100
            y_high := mload(yPtr)
            let temp := mload(add(yPtr, 32))
            y_low := shr(128, temp) // 右移16字节得到低16字节
        }
        
        // 计算 p - y
        uint256 neg_y_high;
        uint256 neg_y_low;
        
        if (FIELD_MODULUS_LOW >= y_low) {
            neg_y_low = FIELD_MODULUS_LOW - y_low;
            neg_y_high = FIELD_MODULUS_HIGH - y_high;
        } else {
            unchecked {
                neg_y_low = FIELD_MODULUS_LOW - y_low + type(uint256).max + 1;
                neg_y_high = FIELD_MODULUS_HIGH - y_high - 1;
            }
        }
        
        // 设置y坐标前缀为零（字节64-79）
        for (uint256 i = 64; i < 80; i++) {
            result[i] = 0;
        }
        
        // 存储取反后的y坐标
        assembly {
            let resultPtr := add(result, 0x20)
            mstore(add(resultPtr, 80), neg_y_high)
            let temp := shl(128, neg_y_low)
            mstore(add(resultPtr, 112), temp)
        }
    }
    
    /**
     * @dev 检查点是否为无限远点
     */
    function _isPointAtInfinity(bytes memory point) internal pure returns (bool) {
        for (uint256 i = 0; i < G1_POINT_LENGTH; i++) {
            if (point[i] != 0) return false;
        }
        return true;
    }
    
    /**
     * @dev 构建配对验证数据
     */
    function _buildPairingData(
        bytes memory processedKey,
        bytes memory signature,
        bytes memory messageHash
    ) internal pure returns (bytes memory pairingData) {
        pairingData = new bytes(PAIRING_INPUT_LENGTH);
        
        // 第一个配对：(G1_GENERATOR, signature)
        for (uint256 i = 0; i < G1_POINT_LENGTH; i++) {
            pairingData[i] = G1_GENERATOR[i];
        }
        for (uint256 i = 0; i < G2_POINT_LENGTH; i++) {
            pairingData[G1_POINT_LENGTH + i] = signature[i];
        }
        
        // 第二个配对：(processedKey, messageHash)
        uint256 offset = G1_POINT_LENGTH + G2_POINT_LENGTH;
        for (uint256 i = 0; i < G1_POINT_LENGTH; i++) {
            pairingData[offset + i] = processedKey[i];
        }
        for (uint256 i = 0; i < G2_POINT_LENGTH; i++) {
            pairingData[offset + G1_POINT_LENGTH + i] = messageHash[i];
        }
    }
    
    /**
     * @dev 执行配对验证
     */
    function _verifyPairingData(bytes memory pairingData) internal view returns (bool) {
        require(pairingData.length == PAIRING_INPUT_LENGTH, "Invalid pairing data");
        
        (bool success, bytes memory result) = PAIRING_PRECOMPILE.staticcall{
            gas: 200000
        }(pairingData);
        
        return success && result.length == 32 && bytes32(result) == bytes32(uint256(1));
    }
    
}

