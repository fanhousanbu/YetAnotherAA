# Paymaster Admin Panel

A React-based frontend interface for managing ERC-4337 v0.6 paymaster contracts.
This application provides a comprehensive dashboard to monitor and manage your
paymaster contract's deposits, stakes, and operations.

## Features

- **钱包连接**: 支持 MetaMask 等 Web3 钱包连接
- **合约管理**: 监控和管理 paymaster 合约的存款和质押
- **EntryPoint 集成**: 直接与 ERC-4337 EntryPoint 合约交互
- **实时数据**: 实时更新 paymaster 统计和余额信息
- **质押管理**: 添加、解锁和提取质押
- **存取款操作**: 管理 EntryPoint 存款和提取

## ERC-4337 v0.6 兼容性

此界面专为 ERC-4337 版本 0.6 合约设计：

- **EntryPoint 地址**: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`
- **Paymaster 接口**: 兼容标准 paymaster 实现
- **User Operations**: 支持 v0.6 UserOperation 结构

## 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn
- MetaMask 或兼容的 Web3 钱包

### 安装

```bash
cd paymaster/admin
npm install
```

### 开发

```bash
npm start
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建

```bash
npm run build
```

## 使用说明

1. **连接钱包**: 点击 "Connect Wallet" 并在 Web3 钱包中确认连接
2. **输入合约地址**: 输入您的 paymaster 合约地址
3. **监控和管理**: 使用仪表板进行以下操作：
   - 查看 paymaster 配置和统计
   - 监控存款和质押状态
   - 向 EntryPoint 存入 ETH
   - 从 EntryPoint 提取资金
   - 为 paymaster 验证添加质押
   - 解锁和提取质押

## 项目结构

```
src/
├── components/          # React 组件
│   ├── PaymasterDashboard.tsx  # 主仪表板
│   └── WalletConnect.tsx       # 钱包连接
├── hooks/              # 自定义 React hooks
│   └── usePaymaster.ts         # Paymaster 合约交互
├── types/              # TypeScript 类型定义
│   └── paymaster.ts
├── constants/          # 合约 ABI 和地址
│   └── contracts.ts
├── App.tsx            # 主应用组件
├── App.css            # 样式文件
└── index.tsx          # 应用入口
```

## 功能详解

### 合约管理

- 显示 paymaster 合约地址、所有者和当前存款
- 实时更新合约状态和余额

### EntryPoint 操作

- **存款**: 向 EntryPoint 存入 ETH 以支付 gas 费用
- **提取**: 从 EntryPoint 提取资金到指定地址
- **余额监控**: 实时显示 EntryPoint 中的可用余额

### 质押管理

- **添加质押**: 质押 ETH 以获得 paymaster 验证权限
- **解锁质押**: 开始质押解锁流程
- **提取质押**: 解锁期结束后提取质押的 ETH
- **质押状态**: 显示当前质押金额和解锁时间

### 网络支持

- 主要支持以太坊主网
- 可在测试网络（Goerli、Sepolia）上使用
- 自动网络检测和切换提示

## 安全提示

- 始终在进行交易前验证合约地址
- 建议在测试网进行开发和测试
- 保护好您的私钥安全
- 在签名前仔细检查所有交易

## 开发环境

此项目使用以下技术栈：

- React 19 + TypeScript
- Ethers.js v5 用于 Web3 集成
- CSS3 响应式设计
- ERC-4337 v0.6 标准

## 故障排除

### 常见问题

1. **钱包连接失败**
   - 确保已安装 MetaMask 或其他 Web3 钱包
   - 检查钱包是否已解锁

2. **合约交互错误**
   - 验证 paymaster 合约地址是否正确
   - 确保钱包连接到正确的网络
   - 检查是否有足够的 ETH 支付 gas 费用

3. **网络问题**
   - 切换到以太坊主网或测试网
   - 检查网络连接状态

## 贡献

1. Fork 此仓库
2. 创建功能分支
3. 提交您的更改
4. 添加测试（如适用）
5. 提交 Pull Request

## 许可证

MIT License - 详见 LICENSE 文件

---

**注意**: 这是一个用于管理 ERC-4337
paymaster 合约的管理工具。请确保您了解相关风险并在生产环境中谨慎使用。
