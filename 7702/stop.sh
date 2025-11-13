#!/bin/bash

# EIP-7702 System Stop Script
# 停止 Backend 和 Frontend 服务

echo "🛑 Stopping EIP-7702 System..."
echo ""

# Kill processes on ports 3001-3006
echo "Stopping services on ports 3001-3006..."
for port in 3001 3002 3003 3004 3005 3006; do
    PID=$(lsof -ti:$port 2>/dev/null || echo "")
    if [ ! -z "$PID" ]; then
        echo "  Stopping process on port $port (PID: $PID)"
        kill -9 $PID 2>/dev/null || true
    fi
done

# Kill frontend (port 8080)
echo "Stopping frontend on port 8080..."
PID=$(lsof -ti:8080 2>/dev/null || echo "")
if [ ! -z "$PID" ]; then
    echo "  Stopping process on port 8080 (PID: $PID)"
    kill -9 $PID 2>/dev/null || true
fi

echo ""
echo "✅ All services stopped"
