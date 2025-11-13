# 更新日志

## 2025-11-13 - 系统启动和问题修复

### 修复
- 修复 Backend mock 数据问题
  - 替换 `0xmockdata` 为真实的 `deployDelegation` 函数调用编码
  - 添加 DelegationFactory ABI 定义
  - 使用 ethers.Interface 正确编码 calldata
  - 修复签名错误: invalid BytesLike value

- 端口配置统一
  - 所有配置文件恢复默认端口 3001
  - 创建 start.sh 和 stop.sh 脚本自动管理端口冲突
  - 更新所有 HTML 文件中的 API 端点

### 新增
- 启动脚本 (start.sh)
  - 自动清理端口 3001-3006
  - 启动 Backend (3001) 和 Frontend (8080)
  - 验证服务健康状态

- 停止脚本 (stop.sh)
  - 一键停止所有服务

- 快速启动指南 (QUICK_START.md)
  - 简化的使用说明
  - 常见问题解答

### 改进
- 合并完整测试页面到主页
  - 将 test.html 功能集成到 index.html
  - 保留旧 index.html 为 index.old.html
  - 统一用户界面和功能入口

### 部署状态
- ✅ 智能合约已部署到 Sepolia 测试网
- ✅ Backend API 运行正常 (端口 3001)
- ✅ Frontend 运行正常 (端口 8080)
- ✅ Paymaster 已充值 0.1 ETH

### 下一步
- 开始集成测试
- 招募 Beta 测试用户
- 收集用户反馈
