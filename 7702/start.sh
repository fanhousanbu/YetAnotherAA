#!/bin/bash

# 7702 应用启动脚本
# 支持 Vite 前端和 Express 后端

set -e

echo "🚀 启动 EIP-7702 应用程序..."

# 清理可能冲突的端口
echo "🧹 清理端口冲突..."
PORTS=(3000 3001 3002 8008 8009 8080 8081 8082 8083)
for port in "${PORTS[@]}"; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "  🔴 终止端口 $port 的进程..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 1
    else
        echo "  🟢 端口 $port 可用"
    fi
done

# 检查 Node.js 版本
echo "🔍 检查环境..."
node --version
pnpm --version

# 确保环境文件存在
if [ ! -f backend/.env ]; then
    echo "❌ 错误：backend/.env 文件不存在！"
    echo "请创建 backend/.env 文件并配置正确的环境变量"
    exit 1
fi

echo "✅ 环境配置文件已存在"

# 启动后端服务
echo "🔧 启动后端服务..."
cd backend
pnpm start &
BACKEND_PID=$!
cd ..

# 等待后端启动
echo "⏳ 等待后端服务启动..."
sleep 3

# 启动前端开发服务器
echo "🎨 启动前端开发服务器..."
cd frontend
pnpm run dev &
FRONTEND_PID=$!
cd ..

echo "✅ 应用程序启动完成！"
echo "🌐 前端地址: http://localhost:8080"
echo "🔗 后端地址: http://localhost:3001"
echo "📊 测试接口: http://localhost:3001/api/test"
echo ""
echo "按 Ctrl+C 停止服务"

# 等待中断信号
trap "echo '🛑 正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT

# 保持脚本运行
wait
