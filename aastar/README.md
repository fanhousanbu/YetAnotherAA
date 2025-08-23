# AAstar ERC-4337 后端服务

基于NestJS开发的ERC-4337账户抽象和聚合签名转账服务，支持Enhanced Account和AAStarValidator两种验证模式。

## 🌟 主要特性

- 🔐 **ERC-4337账户抽象**: 完整支持ERC-4337标准
- 🛡️ **多重验证模式**: 支持ECDSA和AAStarValidator(BLS聚合签名)
- 📖 **Swagger文档**: 完整的API文档和在线调试
- ⚡ **高性能**: 基于NestJS框架，支持高并发
- 🔧 **模块化设计**: 清晰的模块结构，易于扩展

## 🚀 快速开始

### 环境要求

- Node.js >= 16
- npm >= 8

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env` 文件并配置相关参数：

```bash
# RPC配置
ETH_RPC_URL=https://sepolia.infura.io/v3/your_project_id
ETH_PRIVATE_KEY=0x...
BUNDLER_RPC_URL=https://api.pimlico.io/v2/11155111/rpc?apikey=your_api_key
ENTRY_POINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789

# 验证器地址
VALIDATOR_CONTRACT_ADDRESS=0x1E0c95946801ef4Fc294eA1F8214faB2357bFF9C
ENHANCED_FACTORY_ADDRESS=0x22403667e5511eed545396d22655C89e53e67529
AASTAR_ACCOUNT_FACTORY_ADDRESS=0x...
ECDSA_VALIDATOR_ADDRESS=0x08922A87fAd7E85F75095c583B56cee011949F13

# BLS签名服务配置
BLS_SEED_NODE_HOST=localhost
BLS_SEED_NODE_PORT=3001

# 服务端口
PORT=3000
```

### 启动服务

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

## 📖 API文档

启动服务后访问: http://localhost:3000/api

### 主要接口

#### 1. 账户管理

- `POST /accounts` - 创建新账户
- `GET /accounts` - 获取账户信息
- `POST /accounts/update-validator` - 更新验证器配置

#### 2. 转账服务

- `POST /transfer` - 执行转账
- `POST /transfer/estimate` - 预估转账费用

#### 3. BLS签名服务

- `GET /bls/health` - 检查BLS服务健康状态
- `GET /bls/nodes` - 获取活跃的BLS节点列表
- `POST /bls/sign` - BLS签名测试

## 🔧 使用示例

### 创建Enhanced Account

```bash
curl -X POST "http://localhost:3000/accounts" \
  -H "Content-Type: application/json" \
  -d '{
    "privateKey": "0x...",
    "useAAStarValidator": false,
    "salt": "12345"
  }'
```

### 创建AAStarValidator Account

```bash
curl -X POST "http://localhost:3000/accounts" \
  -H "Content-Type: application/json" \
  -d '{
    "privateKey": "0x...",
    "useAAStarValidator": true,
    "salt": "12345"
  }'
```

### 执行转账

```bash
curl -X POST "http://localhost:3000/transfer" \
  -H "Content-Type: application/json" \
  -d '{
    "fromPrivateKey": "0x...",
    "toAddress": "0x742D35CC7aB8E3e5F8B7D1E8F4a3e7b1a9B2C3D4",
    "amount": "0.001",
    "useAAStarValidator": false
  }'
```

### 使用AAStarValidator转账

```bash
curl -X POST "http://localhost:3000/transfer" \
  -H "Content-Type: application/json" \
  -d '{
    "fromPrivateKey": "0x...",
    "toAddress": "0x742D35CC7aB8E3e5F8B7D1E8F4a3e7b1a9B2C3D4",
    "amount": "0.001",
    "useAAStarValidator": true,
    "nodeIds": ["0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d"]
  }'
```

### 检查BLS服务状态

```bash
# 检查BLS服务健康状态
curl -X GET "http://localhost:3000/bls/health"

# 获取活跃的BLS节点列表
curl -X GET "http://localhost:3000/bls/nodes"

# 测试BLS签名
curl -X POST "http://localhost:3000/bls/sign" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "0x1234567890abcdef",
    "nodeIds": ["node1", "node2"]
  }'
```

## 🏗️ 项目结构

```
src/
├── account/              # 账户管理模块
│   ├── account.controller.ts
│   ├── account.service.ts
│   ├── account.module.ts
│   └── dto/
├── transfer/             # 转账服务模块
│   ├── transfer.controller.ts
│   ├── transfer.service.ts
│   ├── transfer.module.ts
│   └── dto/
├── bls/                  # BLS签名服务模块
│   ├── bls.controller.ts
│   ├── bls.service.ts
│   └── bls.module.ts
├── ethereum/             # 以太坊服务
│   └── ethereum.service.ts
├── common/               # 通用模块
│   ├── dto/
│   └── interfaces/
├── app.module.ts
├── app.controller.ts
├── app.service.ts
└── main.ts
```

## 🔐 验证器说明

### ECDSA验证器 (Enhanced Account)
- 标准的ECDSA签名验证
- 兼容传统的以太坊签名方案
- Gas消耗相对较低

### AAStarValidator (BLS聚合签名)
- 支持BLS聚合签名验证
- 多节点参与签名验证
- 更高的安全性，但Gas消耗较高

## ⚠️ 注意事项

1. **测试环境**: 当前配置为Sepolia测试网
2. **私钥安全**: 请勿在生产环境中硬编码私钥
3. **AAStarValidator**: BLS签名功能需要配合链上的AAStarValidator合约
4. **Gas费用**: AAStarValidator验证消耗的Gas更多，请确保账户有足够余额
5. **BLS签名服务依赖**: 
   - 使用AAStarValidator前，请确保signer服务已启动 (默认端口3001)
   - 种子节点必须可用才能进行节点发现和签名聚合
   - BLS签名需要多个节点协作，请确保有足够的活跃节点

## 🛠️ 开发命令

```bash
# 安装依赖
npm install

# 开发模式启动
npm run start:dev

# 构建
npm run build

# 生产模式启动
npm run start:prod

# 代码格式化
npm run format

# 代码检查
npm run lint

# 运行测试
npm run test
```

## 📄 License

MIT License