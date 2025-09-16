# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 重要说明

**所有对话使用中文，程序代码使用英文。**

## 项目概述

YetAnotherAA 是一个 BLS 聚合签名 +
ERC-4337 账户抽象系统。这是一个包含多个工作区的 monorepo：

- `validator/` - 实现 ERC-4337 的 Foundry 智能合约
- `signer/` - 带有 WebSocket gossip 网络的 NestJS BLS 签名服务
- `aastar/` - 带有 TypeORM 和 JWT 认证的 NestJS 后端 API
- `aastar-frontend/` - 支持 WebAuthn 的 Next.js 15 前端
- `paymaster/` - Paymaster 合约和管理界面
  - `paymaster/contracts/` - Foundry 智能合约
  - `paymaster/admin/` - React 管理界面

## 必要命令

### 开发

```bash
# 以开发模式启动所有服务
npm run start:dev -w aastar        # 后端 API，端口 3000
npm run start:dev -w signer        # 签名服务，端口 3001
npm run dev -w aastar-frontend     # 前端，端口 8080
npm start -w paymaster/admin       # Paymaster 管理界面，端口 8081

# 构建所有工作区
npm run build

# 在所有工作区运行测试
npm run test

# 代码检查和格式化
npm run lint           # 检查代码规范
npm run lint:fix       # 修复代码规范问题
npm run format         # 使用 Prettier 格式化代码
npm run format:check   # 检查格式化
```

### 智能合约开发

```bash
cd validator
forge build                                           # 编译合约
forge test -vvv                                      # 运行测试（详细输出）
forge script script/DeployValidator.s.sol --broadcast # 部署合约
```

### 数据库管理 (aastar)

```bash
npm run db:clear -w aastar      # 清空 PostgreSQL 数据库
npm run db:clear:json -w aastar # 清空 JSON 数据存储
```

### CI 流水线

```bash
npm run ci  # 依次运行 format:check、lint、build 和 test:ci
```

## 架构模式

### 服务通信

- **前端 → 后端**: 使用 JWT 认证的 REST API
- **后端 → 签名服务**: 用于 BLS 操作的 HTTP/WebSocket
- **签名服务网络**: 用于分布式签名的 WebSocket gossip 协议
- **智能合约**: 符合 ERC-4337 标准，带自定义 BLS 验证器

### 核心技术

- **TypeScript**: 主要语言（签名服务使用 ES2022，后端使用 CommonJS）
- **NestJS**: 两个后端服务都使用模块化架构
- **Next.js 15**: 使用服务器组件的 App Router
- **Foundry**: 智能合约开发和测试
- **TypeORM**: 支持 PostgreSQL 和 JSON 适配器的数据库抽象

### 认证流程

1. 前端使用 WebAuthn 进行生物识别认证
2. 后端验证凭证并签发 JWT token
3. Token 服务管理会话持久化
4. 智能合约验证 BLS 聚合签名

### 数据库策略

后端支持双数据库模式：

- **PostgreSQL**: 生产数据库，带 TypeORM 迁移
- **JSON 适配器**: 用于开发/测试的文件存储

## 代码规范

### 导入组织

- 导入分组：先外部包，后内部模块
- Next.js 前端使用绝对导入（`@/components`、`@/lib`）
- NestJS 服务在模块内使用相对导入

### TypeScript 配置

- 所有服务启用严格模式
- 签名服务使用 ESNext 模块
- NestJS 后端兼容 CommonJS
- Next.js 使用 bundler 模块解析

### 测试方法

- 后端服务使用 Jest 单元测试
- 智能合约使用 Foundry 测试
- CI 模式启用覆盖率报告
- 测试中模拟外部依赖

## 环境配置

### 所需 Node 版本

Node.js 20.19.0（在 .nvmrc 中指定）

### 服务端口

- 后端 API: 3000
- 签名服务: 3001
- 前端开发: 8080
- 前端生产: 80
- Paymaster 管理界面: 8081

### 环境变量

每个服务都有自己的 `.env` 配置：

- 数据库连接
- JWT 密钥
- API 端点
- 网络配置

## 部署

### Docker 设置

单个 Dockerfile 构建所有服务，使用 PM2 进程管理：

```bash
docker build -t yetanotheraa .
docker run -p 80:80 -p 3000:3000 -p 3001:3001 yetanotheraa
```

### 智能合约部署

通过 Foundry 脚本将合约部署到指定网络。查看 `validator/script/` 了解部署配置。

## 常见开发任务

### 添加新的 API 端点

1. 在 `aastar/src/dto/` 创建 DTO
2. 添加带有适当装饰器的控制器方法
3. 实现服务逻辑
4. 更新 Swagger 文档注解

### 修改智能合约

1. 在 `validator/src/` 编辑合约
2. 运行 `forge test` 验证更改
3. 如需要，更新部署脚本
4. 在主网部署前使用本地 Anvil 节点测试

### 前端组件开发

1. 在 `aastar-frontend/components/` 创建组件
2. 使用 Tailwind CSS 进行样式设计
3. 使用 TypeScript 实现类型安全
4. 在支持的浏览器中测试 WebAuthn 流程
