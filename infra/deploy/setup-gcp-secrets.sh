#!/bin/bash
# Echo Backend - GCP Secret Manager 配置脚本
# 用法: ./infra/deploy/setup-gcp-secrets.sh
#
# 此脚本配置 Cloud Run 部署所需的所有密钥
# 密钥名称格式: echo-{service}-{key}

set -e

PROJECT_ID="${GCP_PROJECT_ID:-gen-lang-client-0596519904}"

echo "🔐 配置 GCP Secret Manager 密钥"
echo "Project: ${PROJECT_ID}"

# 启用 Secret Manager API
gcloud services enable secretmanager.googleapis.com --project=${PROJECT_ID}

# 创建密钥函数
create_secret() {
    local name=$1
    local value=$2
    
    # 检查密钥是否存在
    if gcloud secrets describe ${name} --project=${PROJECT_ID} &>/dev/null; then
        echo "⚠️  密钥 ${name} 已存在，添加新版本..."
        echo -n "${value}" | gcloud secrets versions add ${name} --data-file=- --project=${PROJECT_ID}
    else
        echo "✅ 创建密钥 ${name}..."
        echo -n "${value}" | gcloud secrets create ${name} --data-file=- --project=${PROJECT_ID}
    fi
    
    # 授权 Cloud Run 服务账号访问密钥
    gcloud secrets add-iam-policy-binding ${name} \
        --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
        --role="roles/secretmanager.secretAccessor" \
        --project=${PROJECT_ID} 2>/dev/null || true
}

echo ""
echo "请输入以下密钥值 (或按 Enter 跳过):"
echo ""

# Echo DB (Supabase)
read -p "DATABASE_URL (Echo DB 连接字符串): " DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
    create_secret "echo-database-url" "$DATABASE_URL"
fi

# NextAuth
read -p "NEXTAUTH_SECRET (可留空自动生成): " NEXTAUTH_SECRET
if [ -z "$NEXTAUTH_SECRET" ]; then
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    echo "  自动生成: ${NEXTAUTH_SECRET:0:10}..."
fi
create_secret "echo-nextauth-secret" "$NEXTAUTH_SECRET"

# Gemini API
read -p "GEMINI_API_KEY: " GEMINI_API_KEY
if [ -n "$GEMINI_API_KEY" ]; then
    create_secret "echo-gemini-api-key" "$GEMINI_API_KEY"
fi

# LiveKit
read -p "LIVEKIT_URL: " LIVEKIT_URL
if [ -n "$LIVEKIT_URL" ]; then
    create_secret "echo-livekit-url" "$LIVEKIT_URL"
fi

read -p "LIVEKIT_API_KEY: " LIVEKIT_API_KEY
if [ -n "$LIVEKIT_API_KEY" ]; then
    create_secret "echo-livekit-api-key" "$LIVEKIT_API_KEY"
fi

read -p "LIVEKIT_API_SECRET: " LIVEKIT_API_SECRET
if [ -n "$LIVEKIT_API_SECRET" ]; then
    create_secret "echo-livekit-api-secret" "$LIVEKIT_API_SECRET"
fi

# Investment DB (Supabase)
read -p "INVESTMENT_SUPABASE_URL: " INVESTMENT_SUPABASE_URL
if [ -n "$INVESTMENT_SUPABASE_URL" ]; then
    create_secret "echo-investment-supabase-url" "$INVESTMENT_SUPABASE_URL"
fi

read -p "INVESTMENT_SUPABASE_ANON_KEY: " INVESTMENT_SUPABASE_ANON_KEY
if [ -n "$INVESTMENT_SUPABASE_ANON_KEY" ]; then
    create_secret "echo-investment-supabase-key" "$INVESTMENT_SUPABASE_ANON_KEY"
fi

echo ""
echo "✅ 密钥配置完成!"
echo ""
echo "查看所有密钥: gcloud secrets list --project=${PROJECT_ID}"
echo ""
echo "下一步: ./infra/deploy/deploy-echo-server.sh"
