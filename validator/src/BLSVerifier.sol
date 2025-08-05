// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title BLSVerifier
 * @dev BLS12-381签名验证合约，使用正确的EIP-2537预编译合约地址
 * @notice 支持EIP-2537已激活的网络（主网和Sepolia）
 */
contract BLSVerifier {
    
    // EIP-2537 预编译合约地址 (正确的地址)
    address constant BLS12_G1ADD = address(0x0b);
    address constant BLS12_G1MUL = address(0x0c);
    address constant BLS12_G2ADD = address(0x0d);
    address constant BLS12_G2MUL = address(0x0e);
    address constant BLS12_PAIRING_CHECK = address(0x0f);
    address constant BLS12_MAP_FP_TO_G1 = address(0x10);
    address constant BLS12_MAP_FP2_TO_G2 = address(0x11);
    
    // BLS12-381 常量
    bytes internal constant G1_GENERATOR = hex"0000000000000000000000000000000017f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb0000000000000000000000000000000008b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1";
    
    bytes internal constant G2_GENERATOR = hex"00000000000000000000000000000000024aa2b2f08f0a91260805272dc51051c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb80000000000000000000000000000000013e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7e000000000000000000000000000000000ce5d527727d6e118cc9cdc6da2e351aadfd9baa8cbdd3a76d429a695160d12c923ac9cc3baca289e193548608b82801000000000000000000000000000000000606c4a02ea734cc32acd2b02bc28b99cb3e287e85a763af267492ab572e99ab3f370d275cec1da1aaa9075ff05f79be";
    
    bytes internal constant G2_NEG_GENERATOR = hex"00000000000000000000000000000000024aa2b2f08f0a91260805272dc51051c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb80000000000000000000000000000000013e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7e000000000000000000000000000000000d1b3cc2c7027888be51d9ef691d77bcb679afda66c73f17f9ee3837a55024f78c71363275a75d75d86bab79f74782aa0000000000000000000000000000000013fa4d4a0ad8b1ce186ed5061789213d993923066dddaf1040bc3ff59f825c78df74f2d75467e25e0f55f8a00fa030ed";
    
    // 事件定义
    event BLSSignatureVerified(bytes32 indexed messageHash, bool result);
    event BLSAggregatedSignatureVerified(bytes32 indexed messageHash, uint256 numKeys, bool result);
    
    /**
     * @dev 验证BLS签名
     * @param signature BLS签名 (G2点，256字节)
     * @param pubkey 公钥 (G1点，128字节)
     * @param message 原始消息
     * @return 验证结果
     */
    function verifySignature(
        bytes memory signature,
        bytes memory pubkey,
        bytes memory message
    ) public returns (bool) {
        require(signature.length == 256, "Invalid signature length");
        require(pubkey.length == 128, "Invalid pubkey length");
        
        // 将消息哈希映射到G2
        bytes32 messageHash = keccak256(message);
        bytes memory messageG2 = hashToG2(message);
        
        // BLS验证: e(G1, signature) = e(pubkey, messageG2)
        // 转换为配对检查: e(G1, signature) * e(-pubkey, messageG2) = 1
        bytes memory negPubkey = g1Negate(pubkey);
        
        bytes memory pairingInput = abi.encodePacked(
            G1_GENERATOR,   // G1生成元 (128字节)
            signature,      // G2签名 (256字节)
            negPubkey,      // -公钥G1点 (128字节)
            messageG2       // messageG2 (256字节)
        );
        
        bool result = checkPairing(pairingInput);
        
        emit BLSSignatureVerified(messageHash, result);
        return result;
    }
    
    /**
     * @dev 验证聚合BLS签名
     * @param aggregatedSignature 聚合签名 (G2点，256字节)
     * @param pubkeys 公钥数组 (每个G1点128字节)
     * @param message 原始消息
     * @return 验证结果
     */
    function verifyAggregatedSignature(
        bytes memory aggregatedSignature,
        bytes[] memory pubkeys,
        bytes memory message
    ) public returns (bool) {
        require(aggregatedSignature.length == 256, "Invalid signature length");
        require(pubkeys.length > 0, "No public keys provided");
        
        // 验证所有公钥长度
        for (uint i = 0; i < pubkeys.length; i++) {
            require(pubkeys[i].length == 128, "Invalid pubkey length");
        }
        
        // 聚合公钥
        bytes memory aggregatedPubkey = aggregateG1Points(pubkeys);
        
        // 将消息哈希映射到G2
        bytes32 messageHash = keccak256(message);
        bytes memory messageG2 = hashToG2(message);
        
        // BLS验证: e(G1, aggregatedSignature) = e(aggregatedPubkey, messageG2)
        // 转换为配对检查: e(G1, aggregatedSignature) * e(-aggregatedPubkey, messageG2) = 1
        bytes memory negAggregatedPubkey = g1Negate(aggregatedPubkey);
        
        bytes memory pairingInput = abi.encodePacked(
            G1_GENERATOR,           // G1生成元 (128字节)
            aggregatedSignature,    // G2聚合签名 (256字节)
            negAggregatedPubkey,    // -聚合公钥G1点 (128字节)
            messageG2               // messageG2 (256字节)
        );
        
        bool result = checkPairing(pairingInput);
        
        emit BLSAggregatedSignatureVerified(messageHash, pubkeys.length, result);
        return result;
    }
    
    /**
     * @dev G1点加法 (使用预编译合约0x0b)
     */
    function g1Add(bytes memory a, bytes memory b) public view returns (bytes memory c) {
        require(a.length == 128, "Invalid point a length");
        require(b.length == 128, "Invalid point b length");
        
        bytes memory input = abi.encodePacked(a, b);
        require(input.length == 256, "g1Add malformed input");
        
        bool success;
        c = new bytes(128);
        assembly {
            success := staticcall(sub(gas(), 2000), 0x0b, add(input, 32), 256, add(c, 32), 128)
        }
        
        require(success, "G1 point addition failed");
    }
    
    /**
     * @dev G1点标量乘法 (使用预编译合约0x0c)
     */
    function g1Mul(bytes memory point, uint256 scalar) public view returns (bytes memory c) {
        require(point.length == 128, "Invalid point length");
        
        bytes memory input = abi.encodePacked(point, scalar);
        require(input.length == 160, "g1Mul malformed input");
        
        bool success;
        c = new bytes(128);
        assembly {
            success := staticcall(sub(gas(), 2000), 0x0c, add(input, 32), 160, add(c, 32), 128)
        }
        
        require(success, "G1 scalar multiplication failed");
    }
    
    /**
     * @dev G2点加法 (使用预编译合约0x0d)
     */
    function g2Add(bytes memory a, bytes memory b) public view returns (bytes memory c) {
        require(a.length == 256, "Invalid point a length");
        require(b.length == 256, "Invalid point b length");
        
        bytes memory input = abi.encodePacked(a, b);
        require(input.length == 512, "g2Add malformed input");
        
        bool success;
        c = new bytes(256);
        assembly {
            success := staticcall(sub(gas(), 2000), 0x0d, add(input, 32), 512, add(c, 32), 256)
        }
        
        require(success, "G2 point addition failed");
    }
    
    /**
     * @dev G2点标量乘法 (使用预编译合约0x0e)
     */
    function g2Mul(bytes memory point, uint256 scalar) public view returns (bytes memory c) {
        require(point.length == 256, "Invalid point length");
        
        bytes memory input = abi.encodePacked(point, scalar);
        require(input.length == 288, "g2Mul malformed input");
        
        bool success;
        c = new bytes(256);
        assembly {
            success := staticcall(sub(gas(), 2000), 0x0e, add(input, 32), 288, add(c, 32), 256)
        }
        
        require(success, "G2 scalar multiplication failed");
    }
    
    /**
     * @dev 配对检查 (使用预编译合约0x0f)
     */
    function checkPairing(bytes memory input) public view returns (bool) {
        require(input.length % 384 == 0, "checkPairing malformed input");
        
        bytes memory res = new bytes(32);
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x0f, add(input, 32), mload(input), add(res, 32), 32)
        }
        
        require(success, "Pairing check failed");
        return res[31] != 0;
    }
    
    /**
     * @dev 映射到G1点 (使用预编译合约0x10)
     */
    function mapToG1(uint256 x, uint256 y) public view returns (bytes memory ret) {
        bytes memory input = abi.encodePacked(x, y);
        ret = new bytes(128);
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x10, add(input, 32), 64, add(ret, 32), 128)
        }
        
        require(success, "Map to G1 failed");
    }
    
    /**
     * @dev 映射到G2点 (使用预编译合约0x11)
     */
    function mapToG2(uint256 c00, uint256 c01, uint256 c10, uint256 c11) public view returns (bytes memory ret) {
        bytes memory input = abi.encodePacked(c00, c01, c10, c11);
        ret = new bytes(256);
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x11, add(input, 32), 128, add(ret, 32), 256)
        }
        
        require(success, "Map to G2 failed");
    }
    
    /**
     * @dev 聚合多个G1点 (公钥聚合)
     */
    function aggregateG1Points(bytes[] memory points) public view returns (bytes memory) {
        require(points.length > 0, "Empty points array");
        
        bytes memory result = points[0];
        
        for (uint i = 1; i < points.length; i++) {
            result = g1Add(result, points[i]);
        }
        
        return result;
    }
    
    /**
     * @dev 聚合多个G2点 (向后兼容)
     */
    function aggregateG2Points(bytes[] memory points) public view returns (bytes memory) {
        require(points.length > 0, "Empty points array");
        
        bytes memory result = points[0];
        
        for (uint i = 1; i < points.length; i++) {
            result = g2Add(result, points[i]);
        }
        
        return result;
    }
    
    /**
     * @dev 计算G1点的负数
     * 使用 G1 + (-G1) = O 的性质，通过标量乘法实现
     */
    function g1Negate(bytes memory point) public view returns (bytes memory) {
        require(point.length == 128, "Invalid point length");
        
        // 使用 -1 * point 来计算负数点
        // BLS12-381标量域的模数-1
        uint256 negativeOne = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000000;
        
        return g1Mul(point, negativeOne);
    }
    
    /**
     * @dev 将消息哈希映射到G1点
     * 使用简化的hash-to-curve实现
     */
    function hashToG1(bytes memory message) public view returns (bytes memory) {
        // 使用消息的keccak256哈希作为输入
        bytes32 hash = keccak256(message);
        
        // 将哈希分解为两个uint256用于映射
        uint256 x = uint256(hash);
        uint256 y = uint256(keccak256(abi.encodePacked(hash, "suffix")));
        
        return mapToG1(x, y);
    }
    
    /**
     * @dev 将消息哈希映射到G2点
     * 使用简化的hash-to-curve实现
     */
    function hashToG2(bytes memory message) public view returns (bytes memory) {
        // 使用消息的keccak256哈希作为输入
        bytes32 hash = keccak256(message);
        
        // 将哈希分解为四个uint256用于G2映射
        uint256 c00 = uint256(hash);
        uint256 c01 = uint256(keccak256(abi.encodePacked(hash, "c01")));
        uint256 c10 = uint256(keccak256(abi.encodePacked(hash, "c10")));
        uint256 c11 = uint256(keccak256(abi.encodePacked(hash, "c11")));
        
        return mapToG2(c00, c01, c10, c11);
    }
    
    /**
     * @dev 获取G1生成元
     */
    function getG1Generator() public pure returns (bytes memory) {
        return G1_GENERATOR;
    }
    
    /**
     * @dev 获取G2生成元
     */
    function getG2Generator() public pure returns (bytes memory) {
        return G2_GENERATOR;
    }
    
    /**
     * @dev 获取G2负生成元
     */
    function getG2NegGenerator() public pure returns (bytes memory) {
        return G2_NEG_GENERATOR;
    }
    
    /**
     * @dev 测试基础配对功能
     * e(G1, G2) * e(G1, -G2) = 1
     */
    function testBasicPairing() public view returns (bool) {
        bytes memory pairingInput = abi.encodePacked(
            G1_GENERATOR,     // G1 (128字节)
            G2_GENERATOR,     // G2 (256字节)
            G1_GENERATOR,     // G1 (128字节)
            G2_NEG_GENERATOR  // -G2 (256字节)
        );
        
        return checkPairing(pairingInput);
    }
    
    /**
     * @dev 获取合约信息
     */
    function getInfo() external pure returns (string memory) {
        return "BLS12-381 Signature Verifier v1.0 - EIP-2537 Compatible (0x0b-0x11)";
    }
}