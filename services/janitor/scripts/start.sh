#!/bin/bash
#
# Echo SeekDB Sidecar 启动脚本
# 启动所有后台服务：同步、摄入、API
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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

# ============== 环境检查 ==============

log_info "检查环境变量..."

# 加载 .env 文件（如果存在）
if [ -f "../.env" ]; then
    log_info "加载 ../.env 文件"
    export $(grep -v '^#' ../.env | xargs)
fi

# 检查必要环境变量
REQUIRED_VARS=("SUPABASE_URL" "SUPABASE_KEY" "SEEKDB_HOST")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    log_error "缺少必要环境变量: ${MISSING_VARS[*]}"
    log_error "请检查 .env 文件或设置环境变量"
    exit 1
fi

log_info "环境变量检查通过 ✓"

# ============== 创建必要目录 ==============

IMPORT_FOLDER="${IMPORT_FOLDER:-../import_folder}"
log_info "创建导入目录: $IMPORT_FOLDER"
mkdir -p "$IMPORT_FOLDER"

# ============== PID 文件管理 ==============

PID_DIR="../.pids"
mkdir -p "$PID_DIR"

cleanup() {
    log_info "正在停止所有服务..."
    
    # 停止同步服务
    if [ -f "$PID_DIR/sync.pid" ]; then
        kill $(cat "$PID_DIR/sync.pid") 2>/dev/null || true
        rm -f "$PID_DIR/sync.pid"
    fi
    
    # 停止摄入服务
    if [ -f "$PID_DIR/ingest.pid" ]; then
        kill $(cat "$PID_DIR/ingest.pid") 2>/dev/null || true
        rm -f "$PID_DIR/ingest.pid"
    fi
    
    log_info "所有服务已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ============== 启动服务 ==============

# 1. 启动 Supabase 同步服务（后台）
log_info "启动 Supabase 同步服务..."
python3 sync_notes.py &
SYNC_PID=$!
echo $SYNC_PID > "$PID_DIR/sync.pid"
log_info "同步服务已启动 (PID: $SYNC_PID)"

# 等待一下让同步服务初始化
sleep 2

# 2. 启动文件摄入服务（后台）
log_info "启动文件摄入服务..."
python3 ingest_manager.py &
INGEST_PID=$!
echo $INGEST_PID > "$PID_DIR/ingest.pid"
log_info "摄入服务已启动 (PID: $INGEST_PID)"

# 等待一下让摄入服务初始化
sleep 1

# 3. 启动 API 服务（前台）
log_info "启动 API 服务..."
log_info "API 地址: http://localhost:${API_PORT:-8765}"
log_info "健康检查: http://localhost:${API_PORT:-8765}/health"
log_info "API 文档: http://localhost:${API_PORT:-8765}/docs"
log_info ""
log_info "按 Ctrl+C 停止所有服务"
log_info "================================"

# 前台运行 API 服务
python3 server.py

# 如果 API 服务退出，清理其他服务
cleanup
