#!/bin/bash
# Paperless-ngx 启动脚本
# 用法: ./scripts/start-paperless.sh [start|stop|restart|logs|status]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.paperless.yml"
ENV_FILE="$PROJECT_DIR/.env.paperless"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker 服务未运行，请启动 Docker"
        exit 1
    fi
}

# 检查环境变量文件
check_env() {
    if [ ! -f "$ENV_FILE" ]; then
        log_warn "环境变量文件不存在，从示例文件创建..."
        cp "$PROJECT_DIR/.env.paperless.example" "$ENV_FILE"
        log_info "已创建 .env.paperless，请根据需要修改配置"
    fi
}

# 启动服务
start() {
    log_info "启动 Paperless-ngx 服务..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    
    log_info "等待服务启动..."
    sleep 5
    
    # 检查服务状态
    if docker compose -f "$COMPOSE_FILE" ps | grep -q "running"; then
        log_info "Paperless-ngx 启动成功!"
        log_info "访问地址: http://localhost:${PAPERLESS_PORT:-8000}"
        log_info "默认账户: admin / admin"
    else
        log_error "服务启动失败，请检查日志: ./scripts/start-paperless.sh logs"
    fi
}

# 停止服务
stop() {
    log_info "停止 Paperless-ngx 服务..."
    docker compose -f "$COMPOSE_FILE" down
    log_info "服务已停止"
}

# 重启服务
restart() {
    stop
    start
}

# 查看日志
logs() {
    docker compose -f "$COMPOSE_FILE" logs -f "${2:-paperless}"
}

# 查看状态
status() {
    docker compose -f "$COMPOSE_FILE" ps
}

# 获取 API Token
get_token() {
    log_info "获取 API Token..."
    docker exec -it echo-paperless python3 manage.py shell -c "
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
user = User.objects.get(username='admin')
token, created = Token.objects.get_or_create(user=user)
print(f'API Token: {token.key}')
"
}

# 主函数
main() {
    check_docker
    check_env
    
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
            logs "$@"
            ;;
        status)
            status
            ;;
        token)
            get_token
            ;;
        *)
            echo "用法: $0 {start|stop|restart|logs|status|token}"
            echo ""
            echo "命令说明:"
            echo "  start   - 启动 Paperless-ngx 服务"
            echo "  stop    - 停止服务"
            echo "  restart - 重启服务"
            echo "  logs    - 查看日志 (可选参数: paperless|paperless-db|paperless-broker)"
            echo "  status  - 查看服务状态"
            echo "  token   - 获取 API Token"
            exit 1
            ;;
    esac
}

main "$@"
