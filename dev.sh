#!/bin/bash
# Echo 本地开发启动脚本 v4.0
#
# 使用方法：
#   ./dev.sh              # 启动所有服务 (PostgreSQL + Janitor + Blinko)
#   ./dev.sh docker       # 仅启动 Docker 服务 (PostgreSQL + Janitor)
#   ./dev.sh stop         # 停止所有服务
#   ./dev.sh logs         # 查看 Docker 服务日志
#   ./dev.sh status       # 查看服务状态
#   ./dev.sh janitor      # 仅启动 Janitor 服务

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
    
    if ! command -v docker &> /dev/null; then
        error "请先安装 Docker"
        exit 1
    fi
}

# 启动 PostgreSQL (本地开发数据库)
start_postgres() {
    info "启动 PostgreSQL 数据库..."
    
    docker-compose -f docker-compose.dev.yml up -d postgres
    
    # 等待数据库就绪
    info "等待 PostgreSQL 就绪..."
    for i in {1..60}; do
        if docker exec echo-postgres pg_isready -U postgres > /dev/null 2>&1; then
            success "PostgreSQL 已就绪"
            return 0
        fi
        sleep 1
    done
    warn "PostgreSQL 启动超时"
}

# 启动 Janitor
start_janitor() {
    info "启动 Janitor 文件整理服务..."
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

# 仅启动 Docker 服务（不启动本地 Blinko）
docker_only() {
    info "启动 Docker 服务..."
    
    start_postgres
    sleep 2
    start_janitor
    
    echo ""
    success "Docker 服务已启动！"
    echo ""
    echo "  🗄️  PostgreSQL:   localhost:5432"
    echo "  🧹 Janitor API:  http://localhost:8766"
    echo ""
    echo "使用 './dev.sh logs' 查看日志"
    echo "使用 './dev.sh stop' 停止所有服务"
}

# 查看服务状态
status() {
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "                Echo 服务状态 v4.0"
    echo "═══════════════════════════════════════════════════════"
    echo ""
    
    # PostgreSQL
    if docker exec echo-postgres pg_isready -U postgres > /dev/null 2>&1; then
        success "PostgreSQL:   ✅ 运行中 (localhost:5432)"
    else
        error "PostgreSQL:   ❌ 离线"
    fi
    
    # Janitor
    if curl -s http://localhost:8766/health > /dev/null 2>&1; then
        success "Janitor API:  ✅ 运行中 (http://localhost:8766)"
    else
        error "Janitor API:  ❌ 离线"
    fi
    
    # Blinko
    if curl -s http://localhost:1111 > /dev/null 2>&1; then
        success "Blinko UI:    ✅ 运行中 (http://localhost:1111)"
    else
        warn "Blinko UI:    ⚠️  未运行"
    fi
    
    echo ""
    echo "───────────────────────────────────────────────────────"
    echo "云端服务 (需要部署后才可用):"
    echo "───────────────────────────────────────────────────────"
    
    # 检查 Supabase 连接 (如果配置了)
    if [ -n "$SUPABASE_URL" ]; then
        if curl -s "$SUPABASE_URL/rest/v1/" > /dev/null 2>&1; then
            success "Supabase:     ✅ 已连接"
        else
            warn "Supabase:     ⚠️  无法连接"
        fi
    else
        info "Supabase:     ℹ️  未配置 (使用本地 PostgreSQL)"
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
    info "启动后端..."
    bun run dev:backend &
    echo $! > "../../$PID_DIR/blinko-backend.pid"
    
    sleep 3
    
    info "启动前端..."
    bun run dev:frontend &
    echo $! > "../../$PID_DIR/blinko-frontend.pid"
    
    cd ../..
    
    # 等待启动
    for i in {1..30}; do
        if curl -s http://localhost:1111 > /dev/null 2>&1; then
            success "Blinko 已启动"
            return 0
        fi
        sleep 1
    done
    warn "Blinko 启动超时，请检查日志"
}

# 启动所有服务
start() {
    check_deps
    
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "           启动 Echo 开发环境 v4.0"
    echo "═══════════════════════════════════════════════════════"
    echo ""
    
    # 启动后端服务
    start_postgres
    sleep 2
    
    start_janitor
    sleep 2
    
    start_blinko
    
    echo ""
    echo "═══════════════════════════════════════════════════════"
    success "所有服务已启动！"
    echo "═══════════════════════════════════════════════════════"
    echo ""
    echo "  🌐 Blinko UI:    http://localhost:1111"
    echo "  🗄️  PostgreSQL:   localhost:5432"
    echo "  🧹 Janitor API:  http://localhost:8766"
    echo ""
    echo "使用 './dev.sh stop' 停止所有服务"
    echo "使用 './dev.sh status' 查看服务状态"
    echo ""
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

# 仅启动 Janitor
janitor_only() {
    info "启动 Janitor 服务..."
    start_janitor
    
    echo ""
    success "Janitor 已启动！"
    echo ""
    echo "  🧹 Janitor API:  http://localhost:8766"
    echo "  📖 API 文档:     http://localhost:8766/docs"
    echo ""
}

# 主入口
case "${1:-start}" in
    start)
        start
        ;;
    docker)
        docker_only
        ;;
    janitor)
        janitor_only
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
        echo "Echo 本地开发脚本 v4.0"
        echo ""
        echo "用法: $0 {start|docker|janitor|stop|logs|status}"
        echo ""
        echo "命令:"
        echo "  start   - 启动所有服务 (PostgreSQL + Janitor + Blinko)"
        echo "  docker  - 仅启动 Docker 服务"
        echo "  janitor - 仅启动 Janitor 服务"
        echo "  stop    - 停止所有服务"
        echo "  logs    - 查看 Docker 日志"
        echo "  status  - 查看服务状态"
        exit 1
        ;;
esac
