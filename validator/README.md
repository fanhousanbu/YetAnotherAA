# ValidatorBLS - BLS12-381 聚合签名验证合约

## 概述

ValidatorBLS是一个基于EIP-2537的BLS12-381聚合签名验证合约，**在链上进行公钥聚合**，防止链下聚合被伪造。

## 核心特性

### 🔒 安全性
- **链上聚合**: 在链上进行公钥聚合，防止攻击者伪造聚合公钥
- **输入验证**: 严格验证所有输入数据的长度和格式
- **EIP-2537兼容**: 使用标准预编译合约进行配对检查

### ⚡ 性能
- **Gas优化**: 根据EIP-2537规范优化gas消耗
- **批量验证**: 支持多个公钥的聚合验证
- **高效配对**: 使用预编译合约进行配对检查

## 合约接口

### 主要函数

```solidity
function verifyAggregatedSignature(
    bytes[] calldata publicKeys,        // 多个单独的公钥数组 (每个G1点，128字节)
    bytes calldata aggregatedSignature, // 聚合签名 (G2点，256字节)
    bytes calldata messageG2           // 消息哈希映射到G2 (G2点，256字节)
) external view returns (bool)
```

### 辅助函数

```solidity
function getVerificationGasCost(uint256 publicKeyCount) external pure returns (uint256)
function getPairingGasCost(uint256 pairCount) public pure returns (uint256)
function getG1AddGasCost() public pure returns (uint256)
function getAggregatedPubKey(bytes[] calldata publicKeys) external view returns (bytes memory)
```

## 验证公式

验证公式: `e(G1, aggregatedSignature) = e(aggregatedPubKey, msgG2)`

转换为配对检查: `e(G1, aggregatedSignature) * e(-aggregatedPubKey, msgG2) = 1`

其中 `aggregatedPubKey = pk1 + pk2 + ... + pkn` (在链上计算)

## 输入格式

### G1点编码 (128字节)
- 前64字节: X坐标
- 后64字节: Y坐标

### G2点编码 (256字节)
- 前128字节: X坐标 (两个Fp元素)
- 后128字节: Y坐标 (两个Fp元素)

## Gas消耗

根据EIP-2537规范:
- **配对检查**: `32600 * k + 37700` (k为配对数量)
- **G1点加法**: `375` gas每次
- **验证操作**: `(n-1) * 375 + 102900` gas (n为公钥数量)

### 示例Gas消耗
- 1个公钥: 102,900 gas
- 2个公钥: 103,275 gas
- 3个公钥: 103,650 gas

## 使用示例

### 1. 编译合约

```bash
forge build
```

### 2. 运行测试

```bash
forge test -vv
```

### 3. 部署合约

```bash
# 设置环境变量
export PRIVATE_KEY=your_private_key

# 部署
forge script script/Deploy.s.sol --rpc-url your_rpc_url --broadcast
```

### 4. 调用验证函数

```solidity
// 假设合约已部署在 validatorAddress
ValidatorBLS validator = ValidatorBLS(validatorAddress);

// 准备多个公钥
bytes[] memory publicKeys = new bytes[](3);
publicKeys[0] = /* 第一个公钥 (128字节) */;
publicKeys[1] = /* 第二个公钥 (128字节) */;
publicKeys[2] = /* 第三个公钥 (128字节) */;

// 验证签名
bool isValid = validator.verifyAggregatedSignature(
    publicKeys,           // 多个单独的公钥
    aggregatedSignature,  // 从signer生成的聚合签名
    messageG2            // 从signer生成的消息G2
);
```

## 与Signer的集成

### 数据流程

1. **Signer生成数据**:
   ```bash
   cd ../signer
   go run main.go -message "Hello World" -m 5 -n 3
   ```

2. **获取输出**:
   - 多个单独的公钥 (每个128字节)
   - 聚合签名 (256字节)
   - 消息G2 (256字节)

3. **Validator验证**:
   - 接收多个单独的公钥
   - 在链上聚合公钥
   - 验证聚合签名

## 安全优势

### 与链下聚合的对比

| 特性 | 链下聚合 | ValidatorBLS (链上聚合) |
|------|----------|------------------------|
| 安全性 | ❌ 可能被伪造 | ✅ 在链上验证 |
| 透明度 | ❌ 不透明 | ✅ 完全透明 |
| 可验证性 | ❌ 难以验证 | ✅ 可验证 |
| Gas成本 | 较低 | 稍高但安全 |

## 技术实现

### EIP-2537预编译合约
- **配对检查**: `0x0f` - BLS12-381配对检查
- **G1点加法**: `0x0b` - G1点加法
- **G1多标量乘法**: `0x0c` - G1多标量乘法

### 聚合算法
```solidity
// 链上聚合公钥
bytes memory aggregated = publicKeys[0];
for (uint i = 1; i < publicKeys.length; i++) {
    aggregated = addG1Points(aggregated, publicKeys[i]);
}
```

## 测试

### 运行所有测试
```bash
forge test -vv
```

### 运行特定测试
```bash
forge test --match-contract ValidatorBLSTest -vv
```

### Gas报告
```bash
forge test --gas-report
```

## 网络支持

### 支持的网络
- ✅ Ethereum Mainnet (需要EIP-2537支持)
- ✅ 测试网络 (Goerli, Sepolia)
- ✅ 本地开发网络

### 检查EIP-2537支持
```solidity
// 检查预编译合约是否存在
(bool success,) = address(0x0f).staticcall("");
require(success, "EIP-2537 not supported");
```

## 故障排除

### 常见问题

1. **"No public keys provided"**
   - 解决：确保传入至少一个公钥

2. **"Invalid public key length"**
   - 解决：确保每个公钥都是128字节

3. **"Invalid aggregatedSignature length"**
   - 解决：确保聚合签名是256字节

4. **"Invalid messageG2 length"**
   - 解决：确保消息G2是256字节

5. **"G1ADD failed"**
   - 解决：检查网络是否支持EIP-2537

## 贡献

欢迎提交Issue和Pull Request来改进这个合约。

## 许可证

MIT License
