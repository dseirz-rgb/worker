#!/bin/bash
# Khoj AI 服务启动脚本
# 用于启动和检查 Khoj 服务状态

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.khoj.yml"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否运行
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo_error "Docker 未运行，请先启动 Docker"
        exit 1
    fi
    echo_info "Docker 运行正常"
}

# 检查 docker-compose 文件
check_compose_file() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        echo_error "找不到 docker-compose.khoj.yml 文件"
        echo_error "请确保在项目根目录运行此脚本"
        exit 1
    fi
}

# 启动 Khoj 服务
start_khoj() {
    echo_info "正在启动 Khoj 服务..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    echo_info "等待 Khoj 服务启动..."
    
    # 等待服务启动，最多等待 120 秒
    for i in {1..120}; do
        if curl -s http://localhost:42110/api/health > /dev/null 2>&1; then
            echo ""
            echo_info "✓ Khoj 服务已启动"
            echo_info "访问地址: http://localhost:42110"
            echo_info "管理后台: http://localhost:42110/admin"
            return 0
        fi
        printf "."
        sleep 1
    done
    
    echo ""
    echo_error "Khoj 服务启动超时"
    echo_warn "请检查日志: docker-compose -f docker-compose.khoj.yml logs"
    exit 1
}

# 停止 Khoj 服务
stop_khoj() {
    echo_info "正在停止 Khoj 服务..."
    docker-compose -f "$COMPOSE_FILE" down
    echo_info "Khoj 服务已停止"
}

# 查看状态
status_khoj() {
    if curl -s http://localhost:42110/api/health > /dev/null 2>&1; then
        echo_info "Khoj 服务运行中"
        echo_info "访问地址: http://localhost:42110"
    else
        echo_warn "Khoj 服务未运行"
    fi
}

# 查看日志
logs_khoj() {
    docker-compose -f "$COMPOSE_FILE" logs -f
}

# 主函数
main() {
    check_docker
    check_compose_file
    
    case "${1:-start}" in
        start)
            start_khoj
            ;;
        stop)
            stop_khoj
            ;;
        restart)
            stop_khoj
            start_khoj
            ;;
        status)
            status_khoj
            ;;
        logs)
            logs_khoj
            ;;
        *)
            echo "用法: $0 {start|stop|restart|status|logs}"
            echo ""
            echo "命令说明:"
            echo "  start   - 启动 Khoj 服务"
            echo "  stop    - 停止 Khoj 服务"
            echo "  restart - 重启 Khoj 服务"
            echo "  status  - 查看服务状态"
            echo "  logs    - 查看服务日志"
            exit 1
            ;;
    esac
}

main "$@"
