#!/bin/bash
# Voice Agent 部署到 Google Cloud Run
# 使用方法: ./deploy-cloudrun.sh

set -e

# 配置
PROJECT_ID="your-gcp-project-id"  # 替换为你的 GCP 项目 ID
REGION="asia-east1"               # 与现有服务同区域
SERVICE_NAME="voice-agent"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 开始部署 Voice Agent 到 Cloud Run..."

# 1. 构建 Docker 镜像
echo "📦 构建 Docker 镜像..."
docker build -t ${IMAGE_NAME} .

# 2. 推送到 Container Registry
echo "⬆️ 推送镜像到 GCR..."
docker push ${IMAGE_NAME}

# 3. 部署到 Cloud Run
echo "🌐 部署到 Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --set-env-vars "LIVEKIT_URL=${LIVEKIT_URL}" \
  --set-env-vars "LIVEKIT_API_KEY=${LIVEKIT_API_KEY}" \
  --set-env-vars "LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}" \
  --set-env-vars "GOOGLE_API_KEY=${GOOGLE_API_KEY}"

echo "✅ 部署完成！"
echo ""
echo "⚠️ 注意事项："
echo "1. 首次请求会有 10-30 秒冷启动延迟"
echo "2. 确保环境变量已正确设置"
echo "3. 可在 Cloud Console 查看日志"
