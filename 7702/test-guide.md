# EIP-7702 Delegation System Test Guide | EIP-7702 委托系统测试指南

## 🎯 Quick Start | 快速启动

### 1. Start Services | 启动服务
```bash
# Enter project directory | 进入项目目录
cd /Users/jason/Dev/mycelium/my-exploration/projects/YetAnotherAA/7702

# Start backend service | 启动后端服务
cd backend && npm start &

# Start frontend service | 启动前端服务
cd ../frontend && npm run dev &
```

### 2. Access Test Pages | 访问测试页面
- **Simple Test | 简单测试**: http://localhost:8080/simple-test.html
- **Full Test | 完整测试**: http://localhost:8080/test.html
- **Frontend Interface | 前端界面**: http://localhost:8083

### 3. Verify Service Status | 验证服务状态
- **Backend API | 后端API**: http://localhost:3001/health
- **Test Interface | 测试接口**: http://localhost:3001/api/test

## 🧪 Test Flow | 测试流程

### Step 1: Check System Status | 步骤 1: 检查系统状态
1. Open test page | 打开测试页面
2. Click "Check Health Status" button | 点击"检查健康状态"按钮
3. Verify backend connection is normal | 验证后端连接正常

### Step 2: Verify Zero ETH Experience | 步骤 2: 验证零 ETH 体验
1. **No ETH Required | 无需 ETH**: User doesn't need to hold any ETH
2. **Connect Wallet | 连接钱包**: Only need MetaMask connected to Sepolia network
3. **Auto Selection | 自动选择**: System automatically selects optimal solution

### Step 3: Test Delegation Functionality | 步骤 3: 测试委托功能
1. Use default test address | 使用默认测试地址: `0xc8d1Ae1063176BEBC750D9aD5D057BA4A65daf3d`
2. Click "Check Delegation Status" | 点击"检查委托状态"
3. Click "Enable Delegation" | 点击"启用委托"
4. Observe hybrid solution selection result | 观察混合方案选择结果

### Step 4: Verify Solutions | 步骤 4: 验证方案
#### Paymaster Solution | Paymaster 方案
- Priority use of ERC-4337 Paymaster | 优先使用 ERC-4337 Paymaster
- User cost | 用户费用: 0 ETH
- Requires UserOperation signature | 需要签名 UserOperation

#### Relayer Solution | Relayer 方案
- Used when Paymaster unavailable | 当 Paymaster 不可用时使用
- User cost | 用户费用: 0 ETH
- Relayer pays gas fees on behalf | Relayer 代付 gas 费

## 📊 Contract Information | 合约信息

### Deployed Contracts (Sepolia Testnet) | 已部署合约 (Sepolia Testnet)
- **DelegationFactory**: `0x91Cb993E50e959C10b4600CB825A93740b79FeA9`
- **SponsorPaymaster**: `0x91Cb993E50e959C10b4600CB825A93740b79FeA9`

### Test Configuration | 测试配置
- **Network | 网络**: Sepolia Testnet
- **RPC | RPC**: https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N
- **Relayer**: 0x411BD567E46C0781248dbB6a9211891C032885e5
- **Test User | 测试用户**: 0xc8d1Ae1063176BEBC750D9aD5D057BA4A65daf3d

## 🔧 Troubleshooting | 故障排除

### Common Issues | 常见问题

1. **Backend Connection Failed | 后端连接失败**
   - Check if port 3001 is occupied | 检查端口 3001 是否被占用
   - Confirm backend service is running | 确认后端服务正在运行

2. **Frontend Cannot Load | 前端无法加载**
   - Confirm frontend service is running | 确认前端服务正在运行
   - Check browser console errors | 检查浏览器控制台错误

3. **MetaMask Connection Issues | MetaMask 连接问题**
   - Ensure connected to Sepolia testnet | 确保连接到 Sepolia 测试网络
   - Confirm MetaMask version supports Web3 | 确认 MetaMask 版本支持 Web3

4. **Transaction Failed | 交易失败**
   - Check network connection | 检查网络连接
   - Confirm account balance (prepare some ETH for Relayer solution) | 确认账户余额 (为 Relayer 方案准备少量 ETH)

## 📝 Expected Results | 预期结果

### Successful Delegation Enablement | 成功的委托启用
1. **Status Check | 状态检查**: Shows current delegation status | 显示当前委托状态
2. **Solution Selection | 方案选择**: System automatically selects Paymaster or Relayer | 系统自动选择 Paymaster 或 Relayer
3. **Transaction Signature | 交易签名**: User signs in MetaMask | 用户在 MetaMask 中签名
4. **Delegation Complete | 委托完成**: Shows success message and transaction hash | 显示成功消息和交易哈希

### Zero ETH Verification | 零 ETH 验证
1. **No Balance Required | 无需余额**: User account balance can be 0 | 用户账户余额可以为 0
2. **Auto Selection | 自动选择**: System selects optimal solution based on resources | 系统根据资源状况选择最优方案
3. **Free Experience | 免费体验**: User pays no fees | 用户无需支付任何费用

## 🎉 Test Completion Criteria | 测试完成标志

When you see the following results, test is successful | 当您看到以下结果时，表示测试成功：
- ✅ Backend service running normally | 后端服务正常运行
- ✅ Frontend interface loading normally | 前端界面正常加载
- ✅ Delegation status query successful | 委托状态查询成功
- ✅ Delegation enablement process complete | 委托启用流程完整
- ✅ User zero ETH experience verified | 用户零 ETH 体验验证

## 📞 Technical Support | 技术支持

For issues, please check | 如遇问题，请检查：
1. Service log output | 服务日志输出
2. Browser developer tools | 浏览器开发者工具
3. MetaMask network settings | MetaMask 网络设置
4. Network connection status | 网络连接状态

## 🚀 Additional Test Cases | 额外测试场景

### Community Token Integration | 社区代币集成
- **MYSBT Tokens**: 100 balance → Community voting rights | 100余额 → 社区投票权限
- **XPNTS Tokens**: 500 balance → Governance rights | 500余额 → 治理权限
- **Gasless Transactions**: Based on token holdings | 无Gas交易：基于代币持有

### Hybrid Solution Testing | 混合方案测试
- **Paymaster Priority**: When sufficient balance available | Paymaster优先：余额充足时
- **Relayer Fallback**: When Paymaster unavailable | Relayer备用：Paymaster不可用时
- **Automatic Switching**: Seamless fallback mechanism | 自动切换：无缝备用机制

### WebAuthn Authentication (Future) | WebAuthn认证(未来)
- **Biometric Login**: Face ID/Touch ID support | 生物识别登录：Face ID/Touch ID支持
- **Device Binding**: Hardware security key integration | 设备绑定：硬件安全密钥集成
- **Session Management**: Token refresh and security | 会话管理：令牌刷新和安全

---

**Test System Status**: ✅ Running | **测试系统状态**: ✅ 运行中
**Last Updated**: November 2025 | **最后更新**: 2025年11月