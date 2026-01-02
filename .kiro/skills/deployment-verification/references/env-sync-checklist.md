# 环境变量同步验证清单

> 📋 确保本地 `.env` 和生产环境变量保持同步

## 🔴 同步检查流程

### Step 1: 导出本地环境变量

```bash
# 从 .env 文件提取变量名
grep -E "^[A-Z]" .env | cut -d= -f1 | sort > /tmp/local-env.txt

# 查看结果
cat /tmp/local-env.txt
```

### Step 2: 导出 Vercel 环境变量

```bash
# 列出 Vercel 环境变量
vercel env ls | grep -E "^[A-Z]" | awk '{print $1}' | sort > /tmp/vercel-env.txt

# 查看结果
cat /tmp/vercel-env.txt
```

### Step 3: 对比差异

```bash
# 只在本地存在的变量（需要添加到 Vercel）
comm -23 /tmp/local-env.txt /tmp/vercel-env.txt

# 只在 Vercel 存在的变量（可能需要添加到本地）
comm -13 /tmp/local-env.txt /tmp/vercel-env.txt

# 两边都有的变量
comm -12 /tmp/local-env.txt /tmp/vercel-env.txt
```

---

## 📋 常见环境变量清单

### 🔐 认证相关

| 变量名 | 用途 | 必需 |
|--------|------|------|
| `NEXTAUTH_SECRET` | NextAuth 加密密钥 | ✅ |
| `NEXTAUTH_URL` | NextAuth 回调 URL | ✅ |
| `AUTH_SECRET` | Auth.js 密钥 | ✅ |

### 🗄️ 数据库相关

| 变量名 | 用途 | 必需 |
|--------|------|------|
| `DATABASE_URL` | 数据库连接字符串 | ✅ |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ |
| `SUPABASE_ANON_KEY` | Supabase 匿名密钥 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务密钥 | ⚠️ |

### 🤖 AI 服务相关

| 变量名 | 用途 | 必需 |
|--------|------|------|
| `GEMINI_API_KEY` | Google Gemini API | ⚠️ |
| `OPENAI_API_KEY` | OpenAI API | ⚠️ |
| `ANTHROPIC_API_KEY` | Anthropic Claude API | ⚠️ |

### 🎙️ 实时通信相关

| 变量名 | 用途 | 必需 |
|--------|------|------|
| `LIVEKIT_URL` | LiveKit 服务器 URL | ⚠️ |
| `LIVEKIT_API_KEY` | LiveKit API 密钥 | ⚠️ |
| `LIVEKIT_API_SECRET` | LiveKit API 密钥 | ⚠️ |

### 💳 支付相关

| 变量名 | 用途 | 必需 |
|--------|------|------|
| `STRIPE_SECRET_KEY` | Stripe 密钥 | ⚠️ |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 密钥 | ⚠️ |
| `STRIPE_PUBLISHABLE_KEY` | Stripe 公开密钥 | ⚠️ |

### 📧 邮件服务相关

| 变量名 | 用途 | 必需 |
|--------|------|------|
| `RESEND_API_KEY` | Resend 邮件服务 | ⚠️ |
| `SENDGRID_API_KEY` | SendGrid 邮件服务 | ⚠️ |

### 🌐 应用配置

| 变量名 | 用途 | 必需 |
|--------|------|------|
| `NEXT_PUBLIC_APP_URL` | 应用公开 URL | ✅ |
| `NEXT_PUBLIC_API_URL` | API 公开 URL | ⚠️ |
| `NODE_ENV` | 运行环境 | ✅ |

---

## 🔧 同步操作命令

### 添加单个变量到 Vercel

```bash
# 交互式添加
vercel env add <VAR_NAME> production

# 从管道添加
echo "value" | vercel env add <VAR_NAME> production
```

### 批量添加变量

```bash
# 从 .env 文件批量添加
while IFS='=' read -r name value; do
    if [[ $name =~ ^[A-Z] ]]; then
        echo "$value" | vercel env add "$name" production
    fi
done < .env
```

### 更新已存在的变量

```bash
# 先删除再添加
vercel env rm <VAR_NAME> production
echo "new_value" | vercel env add <VAR_NAME> production
```

### 拉取 Vercel 变量到本地

```bash
# 拉取所有环境变量
vercel env pull .env.local
```

---

## ⚠️ 注意事项

### 1. 敏感信息处理

- **永远不要**将敏感密钥提交到 Git
- 使用 `.env.local` 存储本地敏感信息
- 确保 `.env.local` 在 `.gitignore` 中

### 2. 环境区分

Vercel 支持三种环境：
- `production` - 生产环境
- `preview` - 预览环境（PR 部署）
- `development` - 开发环境

```bash
# 为不同环境添加变量
vercel env add <VAR_NAME> production
vercel env add <VAR_NAME> preview
vercel env add <VAR_NAME> development
```

### 3. 公开变量 vs 私有变量

- `NEXT_PUBLIC_*` 前缀的变量会暴露给客户端
- 敏感信息**绝对不要**使用 `NEXT_PUBLIC_` 前缀

### 4. 变量值验证

添加变量后，验证是否正确：

```bash
# 在 Vercel 函数中打印（仅调试用）
console.log('VAR exists:', !!process.env.VAR_NAME);

# 或使用健康检查端点验证
curl https://your-app.vercel.app/api/health
```

---

## 🔄 自动化同步脚本

创建 `scripts/sync-env.sh`:

```bash
#!/bin/bash

# 检查本地和 Vercel 环境变量差异
echo "=== 环境变量同步检查 ==="

# 本地变量
LOCAL_VARS=$(grep -E "^[A-Z]" .env 2>/dev/null | cut -d= -f1 | sort)

# Vercel 变量
VERCEL_VARS=$(vercel env ls 2>/dev/null | grep -E "^[A-Z]" | awk '{print $1}' | sort)

# 只在本地
echo ""
echo "📍 只在本地 .env 中存在:"
comm -23 <(echo "$LOCAL_VARS") <(echo "$VERCEL_VARS") | while read var; do
    [ -n "$var" ] && echo "  - $var"
done

# 只在 Vercel
echo ""
echo "☁️  只在 Vercel 中存在:"
comm -13 <(echo "$LOCAL_VARS") <(echo "$VERCEL_VARS") | while read var; do
    [ -n "$var" ] && echo "  - $var"
done

# 两边都有
echo ""
echo "✅ 两边都存在:"
comm -12 <(echo "$LOCAL_VARS") <(echo "$VERCEL_VARS") | while read var; do
    [ -n "$var" ] && echo "  - $var"
done
```

---

## 📝 检查清单模板

部署前复制此清单并逐项确认：

```
[ ] 本地 .env 文件存在且完整
[ ] 运行 `npm run build` 无环境变量相关错误
[ ] 运行同步检查脚本，无遗漏变量
[ ] 敏感变量未使用 NEXT_PUBLIC_ 前缀
[ ] 新增变量已添加到 Vercel
[ ] 部署后健康检查通过
[ ] 核心功能测试通过
```
