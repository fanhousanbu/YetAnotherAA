# 快速启动指南

## 一键启动所有服务

```bash
./start.sh
```

这个脚本会自动：
1. ✅ 清理端口 3001-3006 上的旧进程
2. ✅ 启动 Backend API (端口 3001)
3. ✅ 启动 Frontend Web (端口 8080)
4. ✅ 验证所有服务正常运行

## 一键停止所有服务

```bash
./stop.sh
```

## 访问系统

启动成功后，打开浏览器访问：

- **前端界面**: http://localhost:8080
- **测试页面**: http://localhost:8080/test.html
- **健康检查**: http://localhost:3001/health
- **API 测试**: http://localhost:3001/api/test

## 查看日志

```bash
# Backend 日志
tail -f logs/backend.log

# Frontend 日志
tail -f logs/frontend.log
```

## 常见问题

### Q: 端口被占用怎么办？
A: 运行 `./start.sh`，脚本会自动清理端口 3001-3006

### Q: 服务无法启动？
A: 查看日志文件 `logs/backend.log` 或 `logs/frontend.log` 获取详细错误信息

### Q: 如何重启服务？
A: 运行 `./stop.sh` 然后 `./start.sh`

## 合约地址

- **DelegationFactory**: `0xDcBDCcE3f4A1B59e7dA5fa1Cd6FD9E1C9f9b88C2`
- **SponsorPaymaster**: `0xf5023C131A8aD2506972B29D5F84310D5e754767`
- **网络**: Sepolia Testnet (Chain ID: 11155111)

## 下一步

1. 打开 http://localhost:8080
2. 连接 MetaMask（切换到 Sepolia 测试网）
3. 按照测试页面进行功能测试
4. 参考 `INTEGRATION_TEST_GUIDE.md` 进行完整测试

---

更多信息请查看：
- `SYSTEM_RUNNING.md` - 详细系统状态
- `DEPLOYMENT_SUCCESS.md` - 部署报告
- `INTEGRATION_TEST_GUIDE.md` - 测试指南
