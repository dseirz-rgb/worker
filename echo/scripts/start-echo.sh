#!/bin/bash
# Echo 2.0 一键启动脚本
# 启动所有服务: SeekDB + Janitor + Ingest Manager

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECHO_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 启动 Echo 2.0 服务..."
echo "================================"

# 1. 启动 SeekDB (Docker)
echo "📦 启动 SeekDB 数据库..."
cd "$ECHO_DIR/sidecar"
docker compose up -d seekdb

# 等待 SeekDB 启动
echo "⏳ 等待 SeekDB 启动 (约 30 秒)..."
sleep 30

# 2. 启动 SeekDB API 服务
echo "🔍 启动 SeekDB API 服务 (端口 8765)..."
cd "$ECHO_DIR/sidecar/scripts"
uvicorn server:app --host 0.0.0.0 --port 8765 &
SEEKDB_PID=$!
echo "SeekDB API PID: $SEEKDB_PID"

# 3. 启动 Janitor 服务
echo "🧹 启动 Janitor 服务 (端口 8000)..."
cd "$ECHO_DIR/sidecar/janitor"
fastapi dev server.py --port 8000 &
JANITOR_PID=$!
echo "Janitor PID: $JANITOR_PID"

echo ""
echo "================================"
echo "✅ Echo 2.0 服务已启动!"
echo ""
echo "📍 服务地址:"
echo "   - Janitor API:  http://localhost:8000"
echo "   - SeekDB API:   http://localhost:8765"
echo "   - SeekDB 数据库: localhost:2881"
echo ""
echo "📖 使用方法:"
echo "   1. 整理文件: curl -X POST http://localhost:8000/batch -d '{\"path\": \"~/Downloads/Inbox\"}'"
echo "   2. 搜索文档: curl -X POST http://localhost:8765/search -d '{\"query\": \"PDD 财报\"}'"
echo ""
echo "🛑 停止服务: kill $SEEKDB_PID $JANITOR_PID && docker compose -f $ECHO_DIR/sidecar/docker-compose.yml down"
