#!/bin/bash
# 电商模板DIY设计系统 - 启动脚本
# 用法: bash start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================="
echo "  电商模板DIY设计系统 - 启动中..."
echo "========================================="

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 python3，请先安装 Python 3.10+"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 node，请先安装 Node.js 18+"
    exit 1
fi

# ========== 后端 ==========
echo ""
echo "📦 安装后端依赖..."
cd "$SCRIPT_DIR/backend"
pip install -r requirements.txt -q 2>/dev/null || pip install -r requirements.txt -q --break-system-packages 2>/dev/null

# 创建必要目录
mkdir -p uploads/images uploads/fonts uploads/rembg uploads/thumbnails fonts

echo "🚀 启动后端 (端口 8000)..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# ========== 前端 ==========
echo ""
echo "📦 安装前端依赖..."
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    npm install --silent
fi

echo "🚀 启动前端 (端口 5173)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================="
echo "  ✅ 系统已启动！"
echo ""
echo "  前端地址: http://localhost:5173"
echo "  后端地址: http://localhost:8000"
echo "  API文档:  http://localhost:8000/docs"
echo ""
echo "  默认管理员: admin@example.com / admin123"
echo ""
echo "  按 Ctrl+C 停止服务"
echo "========================================="

# 捕获退出信号
cleanup() {
    echo ""
    echo "正在停止服务..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "已停止"
}
trap cleanup EXIT INT TERM

wait
