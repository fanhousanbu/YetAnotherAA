# AAStar 部署说明

## 端口配置与API代理

### 新的配置方式

前端应用现在运行在 **端口 8080** 上，并使用 Next.js 的 `rewrites` 功能来代理后端API请求，完全避免了跨域问题。

### 配置详情

#### 1. 端口设置
- **前端**: http://localhost:8080
- **后端**: http://localhost:3000 (内部使用)
- **API访问**: http://localhost:8080/api/* (通过代理)

#### 2. Next.js 配置 (`next.config.ts`)
```typescript
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
    ];
  },
};
```

#### 3. 环境变量 (`.env.local`)
```env
NEXT_PUBLIC_API_URL=/api/v1
```

### 优势

1. **无跨域问题**: 前端和API在同一个域下
2. **简化配置**: 无需设置CORS策略
3. **统一入口**: 所有请求通过前端代理
4. **更好的安全性**: 后端API不直接暴露给外部

### API 端点映射

| 前端请求                    | 后端实际地址                           |
|---------------------------|-------------------------------------|
| GET /api/v1/health        | http://localhost:3000/api/v1/health |
| POST /api/v1/auth/login   | http://localhost:3000/api/v1/auth/login |
| GET /api/v1/account       | http://localhost:3000/api/v1/account |
| POST /api/v1/transfer/execute | http://localhost:3000/api/v1/transfer/execute |

### 启动指令

#### 开发环境
```bash
# 终端 1: 启动后端
cd aastar
npm run start:dev

# 终端 2: 启动前端 (端口 8080)
cd aastar-frontend
npm run dev
```

#### 生产环境
```bash
# 构建前端
npm run build

# 启动前端 (端口 8080)
npm run start
```

### 测试验证

```bash
# 测试前端页面
curl http://localhost:8080

# 测试API代理
curl http://localhost:8080/api/v1/health
curl http://localhost:8080/api/v1/info

# 测试完整流程
# 访问 http://localhost:8080
# 注册 -> 登录 -> 创建账户 -> 转账
```

### 生产部署注意事项

1. **反向代理**: 在生产环境中，建议使用 Nginx 或类似的反向代理
2. **SSL证书**: 确保使用HTTPS
3. **环境变量**: 根据生产环境调整API地址
4. **缓存策略**: 配置适当的缓存头
5. **监控**: 添加日志和监控

### 故障排除

#### 常见问题

1. **API请求失败**
   - 检查后端是否在端口3000运行
   - 验证 `next.config.ts` 中的rewrite配置

2. **404错误**
   - 确保API路径正确 (`/api/v1/*`)
   - 检查后端路由是否正确配置

3. **开发模式下的热重载**
   - Next.js会自动检测配置变化
   - 如修改`next.config.ts`需要重启开发服务器