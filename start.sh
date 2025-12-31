#!/bin/bash
# Echo 一键启动脚本
# 
# 使用方法：
#   ./start.sh        # 启动所有服务
#   ./start.sh stop   # 停止所有服务
#   ./start.sh logs   # 查看日志
#   ./start.sh status # 查看状态

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查 .env 文件
check_env() {
    if [ ! -f .env ]; then
        warn ".env 文件不存在，正在从模板创建..."
        cp .env.example .env
        error "请编辑 .env 文件，填写必要的配置（如 GROQ_API_KEY）"
        exit 1
    fi
    
    # 检查必要的环境变量
    source .env
    if [ -z "$GROQ_API_KEY" ] || [ "$GROQ_API_KEY" = "your_groq_api_key_here" ]; then
        error "请在 .env 文件中设置 GROQ_API_KEY"
        echo "获取地址: https://console.groq.com/"
        exit 1
    fi
}

# 创建 inbox 目录
create_inbox() {
    source .env
    INBOX=${INBOX_PATH:-./inbox}
    if [ ! -d "$INBOX" ]; then
        info "创建 inbox 目录: $INBOX"
        mkdir -p "$INBOX"
    fi
}

# 启动服务
start() {
    info "正在启动 Echo 服务..."
    check_env
    create_inbox
    
    docker-compose up -d
    
    echo ""
    success "Echo 服务已启动！"
    echo ""
    echo "  🌐 Blinko UI:    http://localhost:1111"
    echo "  📚 SeekDB API:   http://localhost:8765"
    echo "  🧹 Janitor API:  http://localhost:8000"
    echo ""
    echo "使用 './start.sh logs' 查看日志"
    echo "使用 './start.sh stop' 停止服务"
}

# 停止服务
stop() {
    info "正在停止 Echo 服务..."
    docker-compose down
    success "服务已停止"
}

# 查看日志
logs() {
    docker-compose logs -f
}

# 查看状态
status() {
    echo ""
    info "Echo 服务状态："
    echo ""
    docker-compose ps
    echo ""
    
    # 检查各服务健康状态
    echo "健康检查："
    
    if curl -s http://localhost:8765/health > /dev/null 2>&1; then
        success "SeekDB API: 正常"
    else
        error "SeekDB API: 无法连接"
    fi
    
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        success "Janitor API: 正常"
    else
        error "Janitor API: 无法连接"
    fi
    
    if curl -s http://localhost:1111 > /dev/null 2>&1; then
        success "Blinko UI: 正常"
    else
        error "Blinko UI: 无法连接"
    fi
}

# 重启服务
restart() {
    stop
    start
}

# 主入口
case "${1:-start}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    *)
        echo "用法: $0 {start|stop|restart|logs|status}"
        exit 1
        ;;
esac
