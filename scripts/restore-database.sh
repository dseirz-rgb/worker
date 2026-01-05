#!/bin/bash
# 数据库恢复脚本
# 从备份文件恢复数据库

set -e

# 配置
BACKUP_DIR="$HOME/Backups/echoai-db"
GDRIVE_DIR="$HOME/Google Drive/Backups/echoai-db"

# 数据库配置
INVESTMENT_DB_URL="postgresql://postgres:DIDIdache2025@db.lyqspnecudllmnajrrlm.supabase.co:5432/postgres"
ECHO_DB_URL="postgresql://postgres:DIDIdache2025%40@db.jwiocrwhqeomoybbwqcp.supabase.co:5432/postgres"

usage() {
  echo "用法: $0 <database> [backup_file] [--force]"
  echo ""
  echo "参数:"
  echo "  database    数据库名称: investment 或 echo"
  echo "  backup_file 备份文件路径 (可选，默认使用最新备份)"
  echo "  --force     跳过确认提示"
  echo ""
  echo "示例:"
  echo "  $0 investment                    # 恢复 investment 到最新备份"
  echo "  $0 echo backup.sql.gz            # 恢复 echo 到指定备份"
  echo "  $0 investment --force            # 跳过确认"
  exit 1
}

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

get_latest_backup() {
  local db_name=$1
  local latest=$(ls -t "$BACKUP_DIR"/${db_name}_*.sql.gz 2>/dev/null | head -1)
  
  if [ -z "$latest" ]; then
    # 尝试 Google Drive
    latest=$(ls -t "$GDRIVE_DIR"/${db_name}_*.sql.gz 2>/dev/null | head -1)
  fi
  
  echo "$latest"
}

verify_backup() {
  local file=$1
  
  if [ ! -f "$file" ]; then
    log "❌ 备份文件不存在: $file"
    return 1
  fi
  
  # 检查是否为有效的 gzip 文件
  if ! gzip -t "$file" 2>/dev/null; then
    log "❌ 备份文件损坏: $file"
    return 1
  fi
  
  local size=$(ls -lh "$file" | awk '{print $5}')
  log "✅ 备份文件验证通过: $file ($size)"
  return 0
}

restore_database() {
  local db_name=$1
  local backup_file=$2
  local db_url=$3
  
  log "🔄 开始恢复 $db_name..."
  log "   备份文件: $backup_file"
  
  # 解压并恢复
  if command -v psql &> /dev/null; then
    gunzip -c "$backup_file" | psql "$db_url" 2>&1
  else
    # 使用 Node.js 恢复
    log "⚠️ psql 不可用，使用 Node.js 恢复..."
    npx tsx "$(dirname "$0")/restore-db-node.ts" "$db_name" "$db_url" "$backup_file"
  fi
  
  log "✅ 恢复完成！"
}

main() {
  local db_name=""
  local backup_file=""
  local force=false
  
  # 解析参数
  while [[ $# -gt 0 ]]; do
    case $1 in
      --force)
        force=true
        shift
        ;;
      investment|echo)
        db_name=$1
        shift
        ;;
      *)
        if [ -f "$1" ]; then
          backup_file=$1
        fi
        shift
        ;;
    esac
  done
  
  if [ -z "$db_name" ]; then
    usage
  fi
  
  # 获取数据库 URL
  local db_url=""
  if [ "$db_name" = "investment" ]; then
    db_url="$INVESTMENT_DB_URL"
  else
    db_url="$ECHO_DB_URL"
  fi
  
  # 获取备份文件
  if [ -z "$backup_file" ]; then
    backup_file=$(get_latest_backup "$db_name")
    if [ -z "$backup_file" ]; then
      log "❌ 找不到 $db_name 的备份文件"
      exit 1
    fi
    log "📁 使用最新备份: $backup_file"
  fi
  
  # 验证备份文件
  if ! verify_backup "$backup_file"; then
    exit 1
  fi
  
  # 确认提示
  if [ "$force" != true ]; then
    echo ""
    echo "⚠️  警告: 此操作将覆盖 $db_name 数据库中的现有数据！"
    echo ""
    echo "   数据库: $db_name"
    echo "   备份文件: $backup_file"
    echo ""
    read -p "确定要继续吗？(输入 yes 确认): " confirm
    
    if [ "$confirm" != "yes" ]; then
      log "❌ 操作已取消"
      exit 0
    fi
  fi
  
  # 执行恢复
  restore_database "$db_name" "$backup_file" "$db_url"
}

main "$@"
