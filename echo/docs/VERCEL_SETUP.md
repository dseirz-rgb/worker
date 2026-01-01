# Vercel 部署配置指南

## 1. 连接 GitHub 仓库

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "Add New Project"
3. 选择 "Import Git Repository"
4. 选择你的 Echo 仓库
5. 配置项目：
   - **Root Directory**: `get/blinko-main`
   - **Framework Preset**: Other
   - **Build Command**: `bun run build:web`
   - **Output Directory**: `dist`

## 2. 配置环境变量

在 Vercel Dashboard → Project Settings → Environment Variables 中添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NEXT_PUBLIC_API_URL` | `https://blinko-xxxxx.run.app` | Cloud Run 服务地址 |
| `BACKEND_URL` | `https://blinko-xxxxx.run.app` | 后端 API 地址 |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jwiocrwhqeomoybbwqcp.supabase.co` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` | Supabase 公开 Key |
| `NEXTAUTH_SECRET` | `your_secret` | NextAuth 密钥 |

## 3. 配置自动部署

Vercel 默认会在以下情况自动部署：
- 推送到 `main` 分支 → 生产环境
- 创建 Pull Request → 预览环境

## 4. 自定义域名（可选）

1. 进入 Project Settings → Domains
2. 添加你的域名
3. 按照提示配置 DNS 记录

## 5. 验证部署

部署完成后，访问 Vercel 提供的 URL 验证：
- 首页加载正常
- API 请求能够到达 Cloud Run 后端
- 登录功能正常
