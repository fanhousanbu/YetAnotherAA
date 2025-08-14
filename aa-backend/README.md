# AA Wallet Backend

中心化后端服务，支持 Passkey + Email 认证、EOA 钱包管理和 ERC-4337 转账功能。

## 功能特性

- 🔐 **Passkey 认证**: WebAuthn 标准的无密码认证
- 📧 **邮箱验证**: 安全的邮箱验证码系统
- 👛 **EOA 钱包**: 自动生成和管理以太坊外部账户
- 🔄 **ERC-4337**: 账户抽象转账功能
- 📁 **JSON 存储**: 基于文件的数据存储（可迁移至 MongoDB）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境

复制环境配置文件：
```bash
cp .env.example .env
```

编辑 `.env` 文件配置相关参数。

### 3. 启动开发服务

```bash
npm run start:dev
```

应用将在 http://localhost:3000 启动。

### 4. 查看 API 文档

访问 http://localhost:3000/api 查看 Swagger API 文档。

## API 接口

### 认证相关
- `POST /auth/email/send-code` - 发送邮箱验证码
- `POST /auth/email/verify-code` - 验证邮箱验证码
- `POST /auth/passkey/register/begin` - 开始 Passkey 注册
- `POST /auth/passkey/register/complete` - 完成 Passkey 注册
- `POST /auth/passkey/login/begin` - 开始 Passkey 登录
- `POST /auth/passkey/login/complete` - 完成 Passkey 登录

### 用户管理
- `GET /user/me` - 获取当前用户信息

### 钱包管理
- `GET /wallet/info` - 获取钱包信息
- `GET /wallet/balance` - 查询钱包余额
- `GET /wallet/address` - 获取钱包地址
- `POST /wallet/export-private-key` - 导出私钥（需邮箱验证）

## 数据存储

当前使用 JSON 文件存储，数据保存在 `data/` 目录：

```
data/
├── users/           # 用户数据
├── wallets/         # 钱包数据
├── sessions/        # 会话数据
├── challenges/      # Passkey 挑战数据
└── verifications/   # 邮箱验证数据
```

## 开发说明

### 项目结构

```
src/
├── modules/         # 业务模块
│   ├── auth/       # 认证模块
│   ├── user/       # 用户管理
│   ├── wallet/     # 钱包管理
│   └── storage/    # 数据存储
├── common/         # 通用组件
├── config/         # 配置文件
├── interfaces/     # 类型定义
└── utils/          # 工具函数
```

### 开发命令

- `npm run start:dev` - 开发模式启动
- `npm run build` - 构建项目
- `npm run test` - 运行测试
- `npm run lint` - 代码检查

## 环境配置

详细的环境变量说明请参考 `.env.example` 文件。

## 注意事项

1. **开发环境**: 邮箱验证码会输出到控制台，无需配置真实 SMTP
2. **生产环境**: 需要配置真实的 SMTP 服务和安全的 JWT 密钥
3. **Passkey 支持**: 需要 HTTPS 环境（本地开发可使用 localhost）

## 后续计划

- [ ] MongoDB 数据库集成
- [ ] ERC-4337 UserOperation 支持
- [ ] BLS 签名聚合集成
- [ ] 邮件转账功能
- [ ] 安全性增强