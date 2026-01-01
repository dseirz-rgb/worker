#!/bin/bash
# Echo 云端部署脚本
#
# 使用方法：
#   ./deploy.sh backend    # 部署后端到 Cloud Run
#   ./deploy.sh secrets    # 设置 GCP Secrets
#   ./deploy.sh status     # 查看部署状态

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

# 配置
PROJECT_ID=${GCP_PROJECT_ID:-""}
REGION=${GCP_REGION:-"asia-east1"}
SERVICE_NAME="blinko"

# 检查 gcloud 是否已安装和配置
check_gcloud() {
    if ! command -v gcloud &> /dev/null; then
        error "请先安装 Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    if [ -z "$PROJECT_ID" ]; then
        PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
        if [ -z "$PROJECT_ID" ]; then
            error "请设置 GCP_PROJECT_ID 环境变量或运行 'gcloud config set project PROJECT_ID'"
            exit 1
        fi
    fi
    
    info "使用项目: $PROJECT_ID"
}

# 设置 GCP Secrets
setup_secrets() {
    check_gcloud
    
    info "设置 GCP Secrets..."
    
    # 从 .env 文件读取配置
    if [ -f ".env" ]; then
        source .env
    fi
    
    # DATABASE_URL
    if [ -n "$DATABASE_URL" ]; then
        echo -n "$DATABASE_URL" | gcloud secrets create DATABASE_URL --data-file=- 2>/dev/null || \
        echo -n "$DATABASE_URL" | gcloud secrets versions add DATABASE_URL --data-file=-
        success "DATABASE_URL secret 已设置"
    else
        warn "DATABASE_URL 未设置"
    fi
    
    # NEXTAUTH_SECRET
    if [ -n "$NEXTAUTH_SECRET" ]; then
        echo -n "$NEXTAUTH_SECRET" | gcloud secrets create NEXTAUTH_SECRET --data-file=- 2>/dev/null || \
        echo -n "$NEXTAUTH_SECRET" | gcloud secrets versions add NEXTAUTH_SECRET --data-file=-
        success "NEXTAUTH_SECRET secret 已设置"
    else
        warn "NEXTAUTH_SECRET 未设置"
    fi
    
    # GROQ_API_KEY
    if [ -n "$GROQ_API_KEY" ]; then
        echo -n "$GROQ_API_KEY" | gcloud secrets create GROQ_API_KEY --data-file=- 2>/dev/null || \
        echo -n "$GROQ_API_KEY" | gcloud secrets versions add GROQ_API_KEY --data-file=-
        success "GROQ_API_KEY secret 已设置"
    else
        warn "GROQ_API_KEY 未设置"
    fi
    
    # 授权 Cloud Run 访问 secrets
    info "授权 Cloud Run 访问 secrets..."
    PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
    
    for secret in DATABASE_URL NEXTAUTH_SECRET GROQ_API_KEY; do
        gcloud secrets add-iam-policy-binding $secret \
            --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
            --role="roles/secretmanager.secretAccessor" 2>/dev/null || true
    done
    
    success "Secrets 设置完成"
}

# 部署后端到 Cloud Run
deploy_backend() {
    check_gcloud
    
    info "部署后端到 Cloud Run..."
    
    # 进入 Blinko 目录
    cd get/blinko-main
    
    # 构建并推送镜像
    info "构建 Docker 镜像..."
    gcloud builds submit --config=cloudbuild.yaml .
    
    cd ../..
    
    success "后端部署完成！"
    
    # 获取服务 URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)' 2>/dev/null)
    if [ -n "$SERVICE_URL" ]; then
        echo ""
        success "服务 URL: $SERVICE_URL"
    fi
}

# 快速部署（不使用 Cloud Build）
deploy_quick() {
    check_gcloud
    
    info "快速部署到 Cloud Run..."
    
    cd get/blinko-main
    
    # 直接从源码部署
    gcloud run deploy $SERVICE_NAME \
        --source . \
        --region $REGION \
        --platform managed \
        --allow-unauthenticated \
        --memory 512Mi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 2 \
        --port 1111 \
        --set-env-vars "NODE_ENV=production,TRUST_PROXY=1"
    
    cd ../..
    
    success "部署完成！"
}

# 查看部署状态
status() {
    check_gcloud
    
    info "Cloud Run 服务状态:"
    echo ""
    
    gcloud run services describe $SERVICE_NAME --region=$REGION --format='yaml(status)' 2>/dev/null || \
        warn "服务 $SERVICE_NAME 不存在"
    
    echo ""
    info "最近的修订版本:"
    gcloud run revisions list --service=$SERVICE_NAME --region=$REGION --limit=5 2>/dev/null || true
}

# 查看日志
logs() {
    check_gcloud
    
    info "查看 Cloud Run 日志..."
    gcloud run services logs read $SERVICE_NAME --region=$REGION --limit=100
}

# 主入口
case "${1:-help}" in
    backend)
        deploy_backend
        ;;
    quick)
        deploy_quick
        ;;
    secrets)
        setup_secrets
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    *)
        echo "Echo 云端部署脚本"
        echo ""
        echo "用法: $0 {backend|quick|secrets|status|logs}"
        echo ""
        echo "命令:"
        echo "  backend  - 使用 Cloud Build 构建并部署后端"
        echo "  quick    - 快速部署（直接从源码）"
        echo "  secrets  - 设置 GCP Secrets"
        echo "  status   - 查看部署状态"
        echo "  logs     - 查看服务日志"
        exit 1
        ;;
esac
