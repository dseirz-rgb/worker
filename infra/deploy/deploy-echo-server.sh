#!/bin/bash
# Echo Backend Server - GCP Cloud Run 部署脚本
# 构建自定义镜像并部署到 Cloud Run
# 用法: ./infra/deploy/deploy-echo-server.sh
#
# 前置条件:
# 1. 运行 ./infra/deploy/setup-gcp-secrets.sh 配置密钥
# 2. Docker Desktop 已启动
# 3. gcloud CLI 已安装并登录

set -e

# ============ 配置 ============
PROJECT_ID="${GCP_PROJECT_ID:-gen-lang-client-0596519904}"
REGION="${GCP_REGION:-asia-east1}"
SERVICE_NAME="echo-server"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 部署 Echo Backend Server 到 GCP Cloud Run${NC}"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Image: ${IMAGE_NAME}"

# ============ 切换到项目根目录 ============
cd "$(dirname "$0")/../.."
echo "Working directory: $(pwd)"

# ============ 检查 Docker ============
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker 未运行，请先启动 Docker Desktop${NC}"
    exit 1
fi

# ============ 检查 gcloud ============
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI 未安装${NC}"
    exit 1
fi

gcloud config set project ${PROJECT_ID}

# ============ 构建 Docker 镜像 ============
echo -e "\n${YELLOW}🔨 构建 Docker 镜像...${NC}"

docker build \
    -f infra/docker/Dockerfile.echo-server \
    -t ${IMAGE_NAME}:latest \
    .

# ============ 配置 Docker 认证 ============
echo -e "\n${YELLOW}🔑 配置 GCR 认证...${NC}"
gcloud auth configure-docker gcr.io --quiet

# ============ 推送镜像 ============
echo -e "\n${YELLOW}📤 推送镜像到 GCR...${NC}"
docker push ${IMAGE_NAME}:latest

# ============ 部署到 Cloud Run ============
echo -e "\n${YELLOW}☁️ 部署到 Cloud Run...${NC}"

# 使用 GCP Secret Manager 存储敏感信息
# 首次部署前运行: ./infra/deploy/setup-gcp-secrets.sh
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME}:latest \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 5 \
    --timeout 300 \
    --set-env-vars "NODE_ENV=production" \
    --set-env-vars "TRUST_PROXY=1" \
    --set-env-vars "PORT=8080" \
    --set-secrets "DATABASE_URL=echo-database-url:latest" \
    --set-secrets "NEXTAUTH_SECRET=echo-nextauth-secret:latest" \
    --set-secrets "GEMINI_API_KEY=echo-gemini-api-key:latest" \
    --set-secrets "LIVEKIT_URL=echo-livekit-url:latest" \
    --set-secrets "LIVEKIT_API_KEY=echo-livekit-api-key:latest" \
    --set-secrets "LIVEKIT_API_SECRET=echo-livekit-api-secret:latest" \
    --set-secrets "INVESTMENT_SUPABASE_URL=echo-investment-supabase-url:latest" \
    --set-secrets "INVESTMENT_SUPABASE_ANON_KEY=echo-investment-supabase-key:latest"

# ============ 获取服务 URL ============
echo -e "\n${YELLOW}🔗 获取服务 URL...${NC}"

SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --platform managed \
    --region ${REGION} \
    --format 'value(status.url)')

echo -e "\n${GREEN}✅ 部署完成!${NC}"
echo -e "服务 URL: ${GREEN}${SERVICE_URL}${NC}"
echo ""
echo "下一步:"
echo "1. 测试: curl ${SERVICE_URL}/health"
echo "2. 更新 iOS devUrl: ${SERVICE_URL}"
echo "3. 构建 iOS: cd packages/echo && npm run tauri ios build -- --release"
