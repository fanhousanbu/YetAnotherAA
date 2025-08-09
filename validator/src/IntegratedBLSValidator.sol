// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./G1PublicKeyAggregator.sol";
import "./G1PointNegation.sol";

/**
 * @title IntegratedBLSValidator
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
contract IntegratedBLSValidator {
    
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
    //                      COMPONENT CONTRACTS
    // =============================================================
    
    G1PublicKeyAggregator private immutable aggregator;
    G1PointNegation private immutable negation;
    
    // =============================================================
    //                           EVENTS
    // =============================================================
    
    event SignatureValidated(
        bytes32 indexed messageHash,
        uint256 publicKeysCount,
        bool isValid,
        uint256 gasUsed
    );
    
    event PublicKeysAggregated(
        bytes[] publicKeys,
        bytes aggregatedKey,
        bytes negatedKey
    );
    
    // =============================================================
    //                        CONSTRUCTOR
    // =============================================================
    
    constructor() {
        aggregator = new G1PublicKeyAggregator();
        negation = new G1PointNegation();
    }
    
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
        bytes memory aggregatedKey = aggregator.aggregatePublicKeys(publicKeys);
        
        // Step 2: 对聚合后的公钥取反
        bytes memory negatedAggregatedKey = negation.negateG1Point(aggregatedKey);
        
        emit PublicKeysAggregated(publicKeys, aggregatedKey, negatedAggregatedKey);
        
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
        bytes memory aggregatedKey = aggregator.aggregatePublicKeys(publicKeys);
        
        // Step 2: 对聚合后的公钥取反
        bytes memory negatedAggregatedKey = negation.negateG1Point(aggregatedKey);
        
        // Step 3: 验证签名
        isValid = _validateWithNegatedKey(negatedAggregatedKey, signature, messagePoint);
    }
    
    // =============================================================
    //                      LEGACY COMPATIBILITY
    // =============================================================
    
    /**
     * @dev 传统的validateComponents方法兼容性接口
     * 
     * 保持与原AggregateSignatureValidator的兼容性，但使用预聚合的公钥
     * 
     * @param aggregatedKey 预聚合并取反的公钥
     * @param signature 聚合签名
     * @param messagePoint 消息点
     * @return success 验证是否成功
     */
    function validateComponents(
        bytes calldata aggregatedKey,
        bytes calldata signature,
        bytes calldata messagePoint
    ) external view returns (bool success) {
        require(aggregatedKey.length == G1_POINT_LENGTH, "Invalid key length");
        require(signature.length == G2_POINT_LENGTH, "Invalid signature length");
        require(messagePoint.length == G2_POINT_LENGTH, "Invalid message length");
        
        success = _validateWithNegatedKey(aggregatedKey, signature, messagePoint);
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
    
    // =============================================================
    //                      UTILITY FUNCTIONS
    // =============================================================
    
    /**
     * @dev 获取组件合约地址
     * 
     * @return aggregatorAddr G1PublicKeyAggregator合约地址
     * @return negationAddr G1PointNegation合约地址
     */
    function getComponentAddresses() 
        external 
        view 
        returns (address aggregatorAddr, address negationAddr) 
    {
        return (address(aggregator), address(negation));
    }
    
    /**
     * @dev 验证组件合约是否正常工作
     * 
     * @return isValid 组件是否有效
     */
    function validateComponents() external view returns (bool isValid) {
        try aggregator.getPrecompileAddress() returns (address precompileAddr) {
            if (precompileAddr != 0x000000000000000000000000000000000000000b) {
                return false;
            }
            try negation.getFieldModulus() returns (uint256, uint256) {
                return true;
            } catch {
                return false;
            }
        } catch {
            return false;
        }
    }
    
    /**
     * @dev 测试用：直接获取聚合并取反后的公钥
     * 
     * @param publicKeys 公钥数组
     * @return aggregated 聚合后的公钥
     * @return negated 取反后的公钥
     */
    function getAggregatedAndNegatedKey(bytes[] calldata publicKeys)
        external
        view
        returns (bytes memory aggregated, bytes memory negated)
    {
        require(publicKeys.length > 0, "No public keys provided");
        
        aggregated = aggregator.aggregatePublicKeys(publicKeys);
        negated = negation.negateG1Point(aggregated);
    }
    
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