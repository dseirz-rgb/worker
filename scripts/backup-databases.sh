#!/bin/bash
# 数据库每日备份脚本
# 备份到本地和 Google Drive

set -e

# 配置
BACKUP_DIR="$HOME/Backups/echoai-db"
GDRIVE_DIR="$HOME/Google Drive/Backups/echoai-db"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 数据库配置 (注意: @ 符号需要 URL 编码为 %40)
INVESTMENT_DB_URL="postgresql://postgres:DIDIdache2025@db.lyqspnecudllmnajrrlm.supabase.co:5432/postgres"
ECHO_DB_URL="postgresql://postgres:DIDIdache2025%40@db.jwiocrwhqeomoybbwqcp.supabase.co:5432/postgres"

# 创建备份目录
mkdir -p "$BACKUP_DIR"
mkdir -p "$GDRIVE_DIR" 2>/dev/null || true

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

backup_database() {
  local name=$1
  local url=$2
  local filename="${name}_${TIMESTAMP}.sql.gz"
  local local_path="$BACKUP_DIR/$filename"
  
  log "📦 备份 $name..."
  
  # 使用 pg_dump 备份（如果可用）
  if command -v pg_dump &> /dev/null; then
    pg_dump "$url" 2>/dev/null | gzip > "$local_path"
  else
    # 使用 Node.js 脚本备份
    npx tsx "$(dirname "$0")/backup-db-node.ts" "$name" "$url" "$local_path"
  fi
  
  if [ -f "$local_path" ]; then
    local size=$(ls -lh "$local_path" | awk '{print $5}')
    log "   ✅ 本地备份完成: $local_path ($size)"
    
    # 复制到 Google Drive
    if [ -d "$GDRIVE_DIR" ]; then
      cp "$local_path" "$GDRIVE_DIR/"
      log "   ✅ 已同步到 Google Drive"
    else
      log "   ⚠️ Google Drive 目录不存在，跳过云端备份"
    fi
  else
    log "   ❌ 备份失败"
    return 1
  fi
}

cleanup_old_backups() {
  log "🧹 清理 $RETENTION_DAYS 天前的备份..."
  
  # 清理本地
  find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
  local local_count=$(find "$BACKUP_DIR" -name "*.sql.gz" | wc -l | tr -d ' ')
  log "   本地保留 $local_count 个备份文件"
  
  # 清理 Google Drive
  if [ -d "$GDRIVE_DIR" ]; then
    find "$GDRIVE_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    local gdrive_count=$(find "$GDRIVE_DIR" -name "*.sql.gz" | wc -l | tr -d ' ')
    log "   Google Drive 保留 $gdrive_count 个备份文件"
  fi
}

main() {
  log "🚀 开始数据库备份"
  log "   本地目录: $BACKUP_DIR"
  log "   云端目录: $GDRIVE_DIR"
  echo ""
  
  # 备份两个数据库
  backup_database "investment" "$INVESTMENT_DB_URL"
  backup_database "echo" "$ECHO_DB_URL"
  
  echo ""
  cleanup_old_backups
  
  echo ""
  log "✅ 备份完成！"
}

main "$@"
