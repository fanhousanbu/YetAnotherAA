// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AAStarValidator
 * @dev 整合版BLS聚合签名验证器
 * 
 * 此合约整合了AggregateSignatureValidator和BLS12381AggregateNegation的功能，
 * 实现以下流程：
 * 1. 接受G2编码的Message，聚合后的签名，以及参与签名的公钥数组
 * 2. 通过G1Add聚合公钥数组
 * 3. 对聚合后的公钥取反
 * 4. 进行配对验证
 * 5. 输出签名验证是否成功的结果
 */
contract AAStarValidator {
    
    // =============================================================
    //                           CONSTANTS
    // =============================================================
    
    /// @dev EIP-2537 pairing precompile address
    address private constant PAIRING_PRECOMPILE = 0x000000000000000000000000000000000000000F;
    
    /// @dev Standard encoded lengths for cryptographic points
    uint256 private constant G1_POINT_LENGTH = 128;
    uint256 private constant G2_POINT_LENGTH = 256;
    uint256 private constant PAIRING_LENGTH = 384; // G1 + G2
    
    /// @dev Generator point for the cryptographic group (EIP-2537 encoded format)
    bytes private constant GENERATOR_POINT = hex"0000000000000000000000000000000017f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb0000000000000000000000000000000008b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1";
        
    // =============================================================
    //                           CONSTANTS
    // =============================================================
    
    /// @dev BLS12-381 field modulus (381 bits)
    /// p = 0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab
    uint256 private constant P_0 = 0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f624;
    uint256 private constant P_1 = 0x1eabfffeb153ffffb9feffffffffaaab;
    
    // =============================================================
    //                           EVENTS
    // =============================================================
    
    event SignatureValidated(
        bytes32 indexed messageHash,
        uint256 publicKeysCount,
        bool isValid,
        uint256 gasUsed
    );
    
    // =============================================================
    //                      MAIN VALIDATION METHOD
    // =============================================================
    
    /**
     * @dev 验证聚合BLS签名的主方法
     * 
     * 接受公钥数组，在合约内部进行聚合和取反，然后验证签名
     * 
     * @param publicKeys 参与签名的G1公钥数组 (每个128字节)
     * @param signature 聚合后的BLS签名 (256字节，G2点)
     * @param messagePoint G2编码的消息点 (256字节)
     * @return isValid 签名验证是否成功
     */
    function validateAggregateSignature(
        bytes[] calldata publicKeys,
        bytes calldata signature,
        bytes calldata messagePoint
    ) external returns (bool isValid) {
        require(publicKeys.length > 0, "No public keys provided");
        require(signature.length == G2_POINT_LENGTH, "Invalid signature length");
        require(messagePoint.length == G2_POINT_LENGTH, "Invalid message length");
        
        uint256 gasStart = gasleft();
        
        // Step 1: 聚合公钥数组
        bytes memory aggregatedKey = _aggregatePublicKeys(publicKeys);
        
        // Step 2: 对聚合后的公钥取反
        bytes memory negatedAggregatedKey = _negateG1Point(aggregatedKey);
        
        // Step 3: 构建配对数据并验证
        isValid = _validateWithNegatedKey(negatedAggregatedKey, signature, messagePoint);
        
        uint256 gasUsed = gasStart - gasleft();
        emit SignatureValidated(
            keccak256(abi.encode(publicKeys, signature, messagePoint)),
            publicKeys.length,
            isValid,
            gasUsed
        );
    }
    
    /**
     * @dev 验证聚合BLS签名的视图方法 (不触发事件)
     * 
     * @param publicKeys 参与签名的G1公钥数组
     * @param signature 聚合后的BLS签名
     * @param messagePoint G2编码的消息点
     * @return isValid 签名验证是否成功
     */
    function validateAggregateSignatureView(
        bytes[] calldata publicKeys,
        bytes calldata signature,
        bytes calldata messagePoint
    ) external view returns (bool isValid) {
        require(publicKeys.length > 0, "No public keys provided");
        require(signature.length == G2_POINT_LENGTH, "Invalid signature length");
        require(messagePoint.length == G2_POINT_LENGTH, "Invalid message length");
        
        // Step 1: 聚合公钥数组
        bytes memory aggregatedKey = _aggregatePublicKeys(publicKeys);
        
        // Step 2: 对聚合后的公钥取反
        bytes memory negatedAggregatedKey = _negateG1Point(aggregatedKey);
        
        // Step 3: 验证签名
        isValid = _validateWithNegatedKey(negatedAggregatedKey, signature, messagePoint);
    }

    // =============================================================
    //                      AGGREGATION FUNCTIONS
    // =============================================================
    
    /**
     * @dev Aggregates multiple G1 public keys using G1Add precompile
     * 
     * @param publicKeys Array of individual G1 public keys to aggregate
     * @return aggregatedKey The resulting aggregated public key
     */
    function _aggregatePublicKeys(bytes[] calldata publicKeys)
        internal
        view
        returns (bytes memory aggregatedKey)
    {
        require(publicKeys.length > 0, "No public keys provided");
        
        // Start with the first public key
        aggregatedKey = publicKeys[0];
        require(aggregatedKey.length == G1_POINT_LENGTH, "Invalid first key length");
        
        // Add each subsequent public key
        for (uint256 i = 1; i < publicKeys.length; i++) {
            require(publicKeys[i].length == G1_POINT_LENGTH, "Invalid key length");
            aggregatedKey = _addG1Points(aggregatedKey, publicKeys[i]);
        }
    }

    
    // =============================================================
    //                      INTERNAL FUNCTIONS
    // =============================================================
    
    /**
     * @dev 使用取反后的公钥进行配对验证
     * 
     * @param negatedAggregatedKey 取反后的聚合公钥
     * @param signature 聚合签名
     * @param messagePoint 消息点
     * @return isValid 验证是否成功
     */
    function _validateWithNegatedKey(
        bytes memory negatedAggregatedKey,
        bytes calldata signature,
        bytes calldata messagePoint
    ) internal view returns (bool isValid) {
        bytes memory pairingData = _buildPairingDataFromComponents(
            negatedAggregatedKey,
            signature,
            messagePoint
        );
        
        (bool callSuccess, bytes memory result) = PAIRING_PRECOMPILE.staticcall{
            gas: 200000
        }(pairingData);
        
        if (!callSuccess) {
            return false;
        }
        
        isValid = result.length == 32 && bytes32(result) == bytes32(uint256(1));
    }
    
    /**
     * @dev 从组件构建配对验证数据
     * 
     * @param aggregatedKey 聚合公钥
     * @param signature 签名
     * @param messagePoint 消息点
     * @return pairingData 配对数据
     */
    function _buildPairingDataFromComponents(
        bytes memory aggregatedKey,
        bytes calldata signature,
        bytes calldata messagePoint
    ) internal pure returns (bytes memory pairingData) {
        pairingData = new bytes(768);
        
        // First pairing: (generator, signature)
        // Copy generator point (128 bytes)
        for (uint256 i = 0; i < G1_POINT_LENGTH; i++) {
            pairingData[i] = GENERATOR_POINT[i];
        }
        
        // Copy signature (256 bytes)
        for (uint256 i = 0; i < G2_POINT_LENGTH; i++) {
            pairingData[G1_POINT_LENGTH + i] = signature[i];
        }
        
        // Second pairing: (aggregated key, message point)
        uint256 secondPairingOffset = PAIRING_LENGTH;
        
        // Copy aggregated key (128 bytes)
        for (uint256 i = 0; i < G1_POINT_LENGTH; i++) {
            pairingData[secondPairingOffset + i] = aggregatedKey[i];
        }
        
        // Copy message point (256 bytes)
        for (uint256 i = 0; i < G2_POINT_LENGTH; i++) {
            pairingData[secondPairingOffset + G1_POINT_LENGTH + i] = messagePoint[i];
        }
    }

    /**
     * @dev Adds two G1 points using the EIP-2537 precompile
     * 
     * @param point1 First G1 point (128 bytes)
     * @param point2 Second G1 point (128 bytes)
     * @return result Sum of the two G1 points
     */
    function _addG1Points(bytes memory point1, bytes calldata point2) 
        internal 
        view 
        returns (bytes memory result) 
    {
        require(point1.length == G1_POINT_LENGTH, "Invalid point1 length");
        require(point2.length == G1_POINT_LENGTH, "Invalid point2 length");
        
        // Create input: concatenate point1 and point2 (256 bytes total)
        bytes memory input = abi.encodePacked(point1, point2);
        require(input.length == 256, "Invalid input length");
        
        // Use assembly for precompile call (staticcall doesn't work properly for EIP-2537 on Sepolia)
        result = new bytes(G1_POINT_LENGTH);
        
        assembly {
            let success := staticcall(gas(), 0x0b, add(input, 0x20), mload(input), add(result, 0x20), 128)
            if eq(success, 0) {
                revert(0, 0)
            }
        }
    }


    // =============================================================
    //                      NEGATION FUNCTION
    // =============================================================
    
    /**
     * @dev Negates a G1 point by computing -P = (x, -y mod p)
     * 
     * @param point G1 point in EIP-2537 format (128 bytes)
     * @return negatedPoint The negated G1 point (-P)
     */
    function _negateG1Point(bytes memory point) 
        internal 
        pure 
        returns (bytes memory negatedPoint) 
    {
        require(point.length == G1_POINT_LENGTH, "Invalid G1 point length");
        
        negatedPoint = new bytes(G1_POINT_LENGTH);
        
        // Copy x coordinate unchanged (first 64 bytes)
        for (uint256 i = 0; i < 64; i++) {
            negatedPoint[i] = point[i];
        }
        
        // Handle point at infinity (all zeros)
        bool isInfinity = true;
        for (uint256 i = 0; i < G1_POINT_LENGTH; i++) {
            if (point[i] != 0) {
                isInfinity = false;
                break;
            }
        }
        
        if (isInfinity) {
            // Point at infinity remains unchanged
            return negatedPoint; // Already all zeros
        }
        
        // Negate y coordinate: compute p - y
        _negateYCoordinate(point, negatedPoint);
    }
    // =============================================================
    //                      INTERNAL FUNCTIONS
    // =============================================================
    
    /**
     * @dev Negates the y coordinate by computing p - y
     * Uses the BLS12-381 field modulus for correct negation
     */
    function _negateYCoordinate(
        bytes memory point, 
        bytes memory result
    ) internal pure {
        // Extract y coordinate (bytes 64-127 in EIP-2537 format)
        // EIP-2537: [16 zero bytes][48 bytes x][16 zero bytes][48 bytes y]
        
        // For BLS12-381, coordinates are 48 bytes (384 bits) each
        // In the 64-byte encoding, the actual coordinate starts at byte 16 of each 64-byte chunk
        
        // Y coordinate: bytes 64+16 = 80 to 127 (48 bytes)
        // We need to compute p - y where both p and y are 381-bit numbers
        
        // Extract the full 48-byte y coordinate from the 64-byte encoding
        // EIP-2537 format: [16 zero bytes][48 bytes coordinate]
        uint256 y_high = 0;
        uint256 y_low = 0;
        
        assembly {
            // point points to the start of the bytes struct in memory; data starts at point + 32
            let dataPtr := add(point, 32)
            let yPtr := add(dataPtr, 80)
            // Load first 32 bytes of the 48-byte y coordinate
            y_high := mload(yPtr)
            // Load remaining 16 bytes of y coordinate (shift to align properly)
            let temp := mload(add(yPtr, 32))
            y_low := shr(128, temp) // Shift right by 16 bytes to get the 16-byte portion
        }
        
        // Compute p - y
        uint256 neg_y_high;
        uint256 neg_y_low;
        
        if (P_1 >= y_low) {
            neg_y_low = P_1 - y_low;
            neg_y_high = P_0 - y_high;
        } else {
            // Need to borrow
            unchecked {
                neg_y_low = P_1 - y_low + type(uint256).max + 1;
                neg_y_high = P_0 - y_high - 1;
            }
        }
        
        // Store the negated y coordinate back to result in EIP-2537 format
        // Set y coordinate padding (16 zero bytes at offset 64-79)
        for (uint256 i = 64; i < 80; i++) {
            result[i] = 0;
        }
        
        // Store negated y coordinate (48 bytes starting at offset 80)
        assembly {
            let resultPtr := add(result, 0x20) // Skip length prefix
            // Store first 32 bytes of negated y
            mstore(add(resultPtr, 80), neg_y_high)
            // Store remaining 16 bytes of negated y in the correct position
            let temp := shl(128, neg_y_low) // Shift left to align the 16 bytes correctly
            mstore(add(resultPtr, 112), temp)
        }
    }
    
    // =============================================================
    //                      UTILITY FUNCTIONS
    // =============================================================
    
    /**
     * @dev 获取Gas估算
     * 
     * @param publicKeysCount 公钥数量
     * @return gasEstimate 预估Gas消耗
     */
    function getGasEstimate(uint256 publicKeysCount) external pure returns (uint256 gasEstimate) {
        if (publicKeysCount == 0) return 0;
        
        // 基础成本 + 聚合成本 + 取反成本 + 配对验证成本
        return 50000 + (publicKeysCount * 500) + 3000 + 180000;
    }
    
    /**
     * @dev 获取支持的签名格式说明
     * 
     * @return format 签名格式说明
     */
    function getSignatureFormat() external pure returns (string memory format) {
        return "BLS aggregate signature: publicKeys[] + G2_signature + G2_messagePoint";
    }
}