#!/bin/bash
# Echo 本地开发启动脚本
#
# 使用方法：
#   ./dev.sh              # 启动所有后端服务 (Docker) + Blinko 前端 (本地)
#   ./dev.sh docker       # 仅启动所有 Docker 服务
#   ./dev.sh stop         # 停止所有服务
#   ./dev.sh logs         # 查看 Docker 服务日志
#   ./dev.sh status       # 查看服务状态

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# PID 文件目录
PID_DIR=".pids"
mkdir -p "$PID_DIR"

# 检查依赖
check_deps() {
    if ! command -v bun &> /dev/null; then
        error "请先安装 bun: https://bun.sh/"
        exit 1
    fi
    
    if ! command -v python3 &> /dev/null; then
        error "请先安装 Python 3"
        exit 1
    fi
}

# 启动 SeekDB（仅数据库，使用 Docker）
start_seekdb() {
    info "启动 SeekDB 数据库..."
    
    # 使用统一的 docker-compose.dev.yml
    docker-compose -f docker-compose.dev.yml up -d seekdb
    
    # 等待数据库就绪
    info "等待 SeekDB 数据库就绪 (可能需要 2 分钟)..."
    for i in {1..120}; do
        if docker exec echo-seekdb mysql -h 127.0.0.1 -P 2881 -u root -e "SELECT 1" > /dev/null 2>&1; then
            success "SeekDB 数据库已就绪"
            break
        fi
        sleep 1
    done
    
    # 启动 SeekDB API
    info "启动 SeekDB API..."
    docker-compose -f docker-compose.dev.yml up -d seekdb-api
    
    # 等待 API 就绪
    for i in {1..30}; do
        if curl -s http://localhost:8765/health > /dev/null 2>&1; then
            success "SeekDB API 已启动"
            return 0
        fi
        sleep 1
    done
    warn "SeekDB API 启动超时"
}

# 启动 Janitor
start_janitor() {
    info "启动 Janitor..."
    docker-compose -f docker-compose.dev.yml up -d janitor
    
    # 等待启动
    for i in {1..30}; do
        if curl -s http://localhost:8766/health > /dev/null 2>&1; then
            success "Janitor 已启动"
            return 0
        fi
        sleep 1
    done
    warn "Janitor 启动超时"
}

# 启动 Khoj AI
start_khoj() {
    info "启动 Khoj AI..."
    
    # 检查 Khoj 是否已运行
    if curl -s http://localhost:42110/api/health > /dev/null 2>&1; then
        success "Khoj 已在运行"
        return 0
    fi
    
    # 启动 Khoj Docker
    docker-compose -f docker-compose.dev.yml up -d khoj-postgres khoj
    
    # 等待启动
    info "等待 Khoj 启动 (首次可能需要 2-3 分钟下载模型)..."
    for i in {1..180}; do
        if curl -s http://localhost:42110/api/health > /dev/null 2>&1; then
            success "Khoj 已启动"
            return 0
        fi
        sleep 1
    done
    
    warn "Khoj 启动超时，请检查日志: docker logs blinko-khoj"
}

# 启动 Paperless
start_paperless() {
    info "启动 Paperless..."
    docker-compose -f docker-compose.dev.yml up -d paperless-broker paperless-db paperless
    
    # 等待启动
    info "等待 Paperless 启动..."
    for i in {1..60}; do
        if curl -s http://localhost:8000 > /dev/null 2>&1; then
            success "Paperless 已启动"
            return 0
        fi
        sleep 1
    done
    warn "Paperless 启动超时"
}

# 停止 Khoj AI
stop_khoj() {
    info "停止 Khoj AI..."
    docker-compose -f docker-compose.dev.yml stop khoj khoj-postgres 2>/dev/null || true
}

# 仅启动 Docker 服务（不启动本地 Blinko）
docker_only() {
    info "启动所有 Docker 服务..."
    docker-compose -f docker-compose.dev.yml up -d
    
    echo ""
    success "所有 Docker 服务已启动！"
    echo ""
    echo "  📚 SeekDB API:   http://localhost:8765"
    echo "  🧹 Janitor API:  http://localhost:8766"
    echo "  🤖 Khoj AI:      http://localhost:42110"
    echo "  📄 Paperless:    http://localhost:8000"
    echo ""
    echo "使用 './dev.sh logs' 查看日志"
    echo "使用 './dev.sh stop' 停止所有服务"
}

# 查看服务状态
status() {
    echo ""
    info "服务状态:"
    echo ""
    
    # SeekDB
    if curl -s http://localhost:8765/health > /dev/null 2>&1; then
        success "SeekDB API:   ✅ 运行中 (http://localhost:8765)"
    else
        error "SeekDB API:   ❌ 离线"
    fi
    
    # Janitor
    if curl -s http://localhost:8766/health > /dev/null 2>&1; then
        success "Janitor API:  ✅ 运行中 (http://localhost:8766)"
    else
        error "Janitor API:  ❌ 离线"
    fi
    
    # Khoj
    if curl -s http://localhost:42110/api/health > /dev/null 2>&1; then
        success "Khoj AI:      ✅ 运行中 (http://localhost:42110)"
    else
        error "Khoj AI:      ❌ 离线"
    fi
    
    # Paperless
    if curl -s http://localhost:8000 > /dev/null 2>&1; then
        success "Paperless:    ✅ 运行中 (http://localhost:8000)"
    else
        error "Paperless:    ❌ 离线"
    fi
    
    # Blinko
    if curl -s http://localhost:1111 > /dev/null 2>&1; then
        success "Blinko UI:    ✅ 运行中 (http://localhost:1111)"
    else
        warn "Blinko UI:    ⚠️  未运行 (需要手动启动前端)"
    fi
    
    echo ""
}

# 启动 Blinko
start_blinko() {
    info "启动 Blinko..."
    cd get/blinko-main
    
    # 安装依赖（如果需要）
    if [ ! -d "node_modules" ]; then
        info "安装依赖..."
        bun install
    fi
    
    # 启动开发服务器
    bun run dev:backend &
    echo $! > "../../$PID_DIR/blinko-backend.pid"
    
    sleep 3
    
    bun run dev:frontend &
    echo $! > "../../$PID_DIR/blinko-frontend.pid"
    
    cd ../..
    success "Blinko 已启动"
}

# 启动所有服务
start() {
    check_deps
    
    info "启动 Echo 开发环境..."
    echo ""
    
    # 启动所有后端服务
    start_seekdb
    sleep 2
    
    start_janitor
    sleep 2
    
    start_khoj
    sleep 2
    
    start_paperless
    sleep 2
    
    start_blinko
    
    echo ""
    success "所有服务已启动！"
    echo ""
    echo "  🌐 Blinko UI:    http://localhost:1111"
    echo "  📚 SeekDB API:   http://localhost:8765"
    echo "  🧹 Janitor API:  http://localhost:8766"
    echo "  🤖 Khoj AI:      http://localhost:42110"
    echo "  📄 Paperless:    http://localhost:8000"
    echo ""
    echo "使用 './dev.sh stop' 停止所有服务"
    echo "使用 './dev.sh status' 查看服务状态"
}

# 停止所有服务
stop() {
    info "停止 Echo 开发环境..."
    
    # 停止 PID 文件中的进程（本地 Blinko）
    for pid_file in $PID_DIR/*.pid; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null || true
                info "已停止进程 $pid"
            fi
            rm "$pid_file"
        fi
    done
    
    # 停止所有 Docker 服务
    docker-compose -f docker-compose.dev.yml down
    
    success "所有服务已停止"
}

# 主入口
case "${1:-start}" in
    start)
        start
        ;;
    docker)
        docker_only
        ;;
    stop)
        stop
        ;;
    logs)
        docker-compose -f docker-compose.dev.yml logs -f
        ;;
    status)
        status
        ;;
    *)
        echo "用法: $0 {start|docker|stop|logs|status}"
        exit 1
        ;;
esac
