# FrontDoor Demo - Web3 版本

这是一个基于 Next.js 的 Web3 钱包转账演示项目，展示了如何使用 Passkey 进行身份认证，并实现 ETH 生态系统中的转账功能。

## 主要特性

### 身份认证
- 使用 Passkey 作为主要认证方式
- 邮箱作为账号恢复和跨设备登录的辅助手段
- 支持平台原生的生物认证（指纹、Face ID等）

### 钱包管理
- 支持 ETH 生态系统的钱包地址
- 联系人管理（钱包地址 + 备注名）
- 转账历史记录
- 交易状态追踪

## 技术栈

- Next.js 14
- TypeScript
- Tailwind CSS
- WebAuthn API (Passkey)
- LocalStorage
- Web3 相关库（待集成）

## 开发环境设置

1. 克隆项目
```bash
git clone <repository-url>
cd frontdoor
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run dev
```

## 项目结构

```
frontdoor/
├── app/                 # Next.js 应用目录
├── components/         # React 组件
├── lib/               # 工具函数和类型定义
└── public/            # 静态资源
```

## 主要功能说明

### 1. 注册流程
- 用户提供邮箱和姓名
- 创建并关联 Passkey
- 生成钱包地址

### 2. 登录流程
- 主要使用 Passkey 登录
- 备用邮箱恢复方案

### 3. 联系人管理
- 添加/编辑钱包地址
- 设置备注名
- 查看转账历史

### 4. 转账功能
- ETH 生态系统转账
- 交易状态跟踪
- 转账历史记录

## 演示账号

```
邮箱: demo@example.com
钱包地址: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
```

## 待实现功能

- [ ] 集成 AA（Account Abstraction）钱包
- [ ] 实现真实的链上转账
- [ ] 多链支持
- [ ] 交易签名
- [ ] Gas 费用估算

## 安全说明

- 使用 Passkey 确保安全的身份认证
- 所有敏感操作都需要 Passkey 验证
- 当前版本仅作演示用途，请勿用于生产环境

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT 