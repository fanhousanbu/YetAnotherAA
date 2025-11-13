#!/bin/bash

# EIP-7702 System Startup Script
# 启动 Backend 和 Frontend 服务

set -e

echo "🚀 Starting EIP-7702 System..."
echo ""

# Step 1: Kill existing processes on ports 3001-3006
echo "📋 Step 1: Cleaning up ports 3001-3006..."
for port in 3001 3002 3003 3004 3005 3006; do
    PID=$(lsof -ti:$port 2>/dev/null || echo "")
    if [ ! -z "$PID" ]; then
        echo "  Killing process on port $port (PID: $PID)"
        kill -9 $PID 2>/dev/null || true
        sleep 0.5
    fi
done
echo "✅ Ports cleaned"
echo ""

# Step 2: Create logs directory
echo "📋 Step 2: Creating logs directory..."
mkdir -p logs
echo "✅ Logs directory ready"
echo ""

# Step 3: Start Backend on port 3001
echo "📋 Step 3: Starting Backend API on port 3001..."
cd backend
PORT=3001 npm start > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"
cd ..

# Wait for backend to start
sleep 3

# Check if backend is running
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend API is running on http://localhost:3001"
else
    echo "❌ Backend failed to start. Check logs/backend.log"
    exit 1
fi
echo ""

# Step 4: Start Frontend on port 8080
echo "📋 Step 4: Starting Frontend on port 8080..."
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"
cd ..

# Wait for frontend to start
sleep 3

# Check if frontend is running
if curl -s http://localhost:8080 > /dev/null; then
    echo "✅ Frontend is running on http://localhost:8080"
else
    echo "❌ Frontend failed to start. Check logs/frontend.log"
    exit 1
fi
echo ""

echo "🎉 All services started successfully!"
echo ""
echo "📊 Service Status:"
echo "  Backend API:  http://localhost:3001"
echo "  Frontend Web: http://localhost:8080"
echo ""
echo "📋 Quick Links:"
echo "  Health Check: http://localhost:3001/health"
echo "  API Test:     http://localhost:3001/api/test"
echo "  Main Page:    http://localhost:8080"
echo ""
echo "📝 View Logs:"
echo "  Backend:  tail -f logs/backend.log"
echo "  Frontend: tail -f logs/frontend.log"
echo ""
echo "🛑 Stop Services:"
echo "  ./stop.sh"
echo ""
