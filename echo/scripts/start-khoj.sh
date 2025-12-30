#!/bin/bash

# Khoj 服务启动脚本
# 用于启动和管理 Khoj Docker 容器

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
COMPOSE_FILE="docker-compose.khoj.yml"
CONTAINER_NAME="echo-khoj"
KHOJ_URL="http://localhost:42110"
MAX_WAIT_TIME=120  # 最大等待时间（秒）

# 打印带颜色的消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        echo "安装指南: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_error "Docker 服务未运行，请启动 Docker"
        exit 1
    fi

    print_info "Docker 检查通过"
}

# 检查 docker-compose 是否可用
check_compose() {
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        print_error "docker-compose 未安装"
        exit 1
    fi

    print_info "使用 $COMPOSE_CMD"
}

# 启动 Khoj 服务
start_khoj() {
    print_info "启动 Khoj 服务..."
    
    cd "$(dirname "$0")/.."
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        print_error "找不到 $COMPOSE_FILE"
        exit 1
    fi

    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d

    print_info "等待 Khoj 服务启动..."
    wait_for_khoj
}

# 等待 Khoj 服务就绪
wait_for_khoj() {
    local elapsed=0
    local interval=5

    while [ $elapsed -lt $MAX_WAIT_TIME ]; do
        if curl -s "$KHOJ_URL/api/health" > /dev/null 2>&1; then
            print_info "Khoj 服务已就绪！"
            print_info "访问地址: $KHOJ_URL"
            return 0
        fi

        echo -n "."
        sleep $interval
        elapsed=$((elapsed + interval))
    done

    print_error "Khoj 服务启动超时"
    print_warn "请检查日志: $COMPOSE_CMD -f $COMPOSE_FILE logs"
    exit 1
}

# 停止 Khoj 服务
stop_khoj() {
    print_info "停止 Khoj 服务..."
    
    cd "$(dirname "$0")/.."
    
    $COMPOSE_CMD -f "$COMPOSE_FILE" down

    print_info "Khoj 服务已停止"
}

# 重启 Khoj 服务
restart_khoj() {
    stop_khoj
    start_khoj
}

# 查看状态
status_khoj() {
    cd "$(dirname "$0")/.."
    
    echo "=== 容器状态 ==="
    $COMPOSE_CMD -f "$COMPOSE_FILE" ps

    echo ""
    echo "=== 健康检查 ==="
    if curl -s "$KHOJ_URL/api/health" > /dev/null 2>&1; then
        print_info "Khoj 服务运行正常"
    else
        print_warn "Khoj 服务不可用"
    fi
}

# 查看日志
logs_khoj() {
    cd "$(dirname "$0")/.."
    $COMPOSE_CMD -f "$COMPOSE_FILE" logs -f
}

# 显示帮助
show_help() {
    echo "Khoj 服务管理脚本"
    echo ""
    echo "用法: $0 <命令>"
    echo ""
    echo "命令:"
    echo "  start    启动 Khoj 服务"
    echo "  stop     停止 Khoj 服务"
    echo "  restart  重启 Khoj 服务"
    echo "  status   查看服务状态"
    echo "  logs     查看服务日志"
    echo "  help     显示帮助信息"
}

# 主函数
main() {
    check_docker
    check_compose

    case "${1:-start}" in
        start)
            start_khoj
            ;;
        stop)
            stop_khoj
            ;;
        restart)
            restart_khoj
            ;;
        status)
            status_khoj
            ;;
        logs)
            logs_khoj
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
