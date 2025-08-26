# AAStar Frontend

基于 Passkey 的 Web3 账户抽象钱包前端应用。

## 功能特性

- 🔐 **Passkey 认证**: 使用生物识别或设备密码进行安全登录
- 📧 **邮箱验证**: 注册时通过邮箱验证码验证身份
- 💰 **钱包管理**: 查看钱包地址、余额和交易历史
- 👥 **联系人管理**: 添加和管理转账联系人
- 🔄 **转账功能**: 支持 ETH 转账操作
- 🛡️ **BLS 签名**: 支持 BLS 聚合签名功能

## 技术栈

- **框架**: Next.js 14
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **认证**: WebAuthn / Passkey
- **状态管理**: React Hooks
- **HTTP 客户端**: Fetch API

## 快速开始

### 环境要求

- Node.js 18+
- 支持 Passkey 的现代浏览器（Chrome、Safari、Edge）
- 后端服务运行在 `http://localhost:3000`

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:8080` 启动。

### 构建生产版本

```bash
npm run build
npm start
```

## 使用流程

### 1. 注册账户

1. 点击"立即注册"
2. 输入邮箱地址并发送验证码
3. 输入收到的 6 位验证码
4. 创建 Passkey（使用指纹、面容或设备密码）
5. 注册完成，自动登录

### 2. 登录账户

1. 输入注册时使用的邮箱地址
2. 使用 Passkey 进行身份验证
3. 登录成功，进入主界面

### 3. 钱包功能

- **查看钱包信息**: 显示钱包地址和余额
- **管理联系人**: 添加和管理转账联系人
- **转账记录**: 查看历史转账记录

## API 接口

### 认证相关

- `POST /auth/email/send-code` - 发送邮箱验证码
- `POST /auth/email/verify-code` - 验证邮箱验证码
- `POST /auth/passkey/register/begin` - 开始 Passkey 注册
- `POST /auth/passkey/register/complete` - 完成 Passkey 注册
- `POST /auth/passkey/login/begin` - 开始 Passkey 登录
- `POST /auth/passkey/login/complete` - 完成 Passkey 登录

### 用户相关

- `GET /user/me` - 获取当前用户信息

### 钱包相关

- `GET /wallet/info` - 获取钱包信息
- `GET /wallet/balance` - 获取钱包余额
- `GET /wallet/address` - 获取钱包地址
- `POST /wallet/export-private-key` - 导出私钥
- `GET /wallet/bls/signers` - 获取可用的 BLS 签名节点
- `POST /wallet/bls/sign` - 使用 BLS 签名消息
- `POST /wallet/bls/verify` - 验证 BLS 签名

## 项目结构

```
aastar-frontend/
├── app/                    # Next.js 应用目录
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 布局组件
│   └── page.tsx           # 主页面
├── components/            # React 组件
│   ├── AddContactModal.tsx
│   ├── ContactList.tsx
│   ├── Dashboard.tsx
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   ├── TransferHistory.tsx
│   └── TransferModal.tsx
├── lib/                   # 工具库
│   ├── api.ts            # API 接口
│   ├── passkey.ts        # Passkey 工具
│   ├── storage.ts        # 本地存储
│   ├── types.ts          # TypeScript 类型
│   └── demo-data.ts      # 演示数据
└── package.json
```

## 开发说明

### 适配后端

本前端已适配 AAStar 后端服务，主要变更包括：

1. **API 接口更新**: 适配后端的认证、用户和钱包接口
2. **数据结构调整**: 更新用户和钱包数据类型定义
3. **认证流程优化**: 支持邮箱验证 + Passkey 的双重认证
4. **钱包功能增强**: 添加钱包信息显示和 BLS 签名功能

### 环境配置

确保后端服务运行在正确的端口上，默认配置为 `http://localhost:3000`。

如需修改 API 地址，请编辑 `lib/api.ts` 文件中的 `API_BASE` 常量。

## 故障排除

### 常见问题

1. **Passkey 不可用**
   - 确保使用支持 Passkey 的现代浏览器
   - 检查是否在 HTTPS 环境下运行（本地开发除外）

2. **登录失败**
   - 检查后端服务是否正常运行
   - 确认邮箱地址正确
   - 验证 Passkey 是否已正确创建

3. **API 请求失败**
   - 检查网络连接
   - 确认后端服务地址配置正确
   - 查看浏览器控制台错误信息

### 调试模式

在浏览器开发者工具中查看控制台输出，获取详细的错误信息。

## 许可证

本项目采用 MIT 许可证。
