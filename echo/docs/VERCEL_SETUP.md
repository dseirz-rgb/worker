# Vercel 部署配置指南

## ⚠️ 重要：部署顺序

Blinko 是全栈应用，**必须按以下顺序部署**：

1. ✅ **Supabase 数据库** - 先创建数据库
2. ✅ **GCP Cloud Run 后端** - 部署 API 服务
3. ✅ **Vercel 前端** - 最后部署前端（需要后端 URL）

如果只部署 Vercel 前端而没有后端，会出现 404 错误！

---

## 0. 前置条件检查

在部署 Vercel 之前，确保：

- [ ] Supabase 项目已创建，DATABASE_URL 已获取
- [ ] Cloud Run 后端已部署，获取到服务 URL（如 `https://blinko-xxxxx.run.app`）
- [ ] 后端健康检查通过：`curl https://blinko-xxxxx.run.app/api/health`

## 1. 连接 GitHub 仓库

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "Add New Project"
3. 选择 "Import Git Repository"
4. 选择你的 Echo 仓库
5. 配置项目：
   - **Root Directory**: `get/blinko-main`
   - **Framework Preset**: Other
   - **Build Command**: `bun run build:web`
   - **Output Directory**: `dist/public`

## 2. 配置 GitHub Secrets（关键！）

在 GitHub 仓库 → Settings → Secrets and variables → Actions 中添加：

| Secret 名称 | 值 | 说明 |
|-------------|-----|------|
| `VERCEL_TOKEN` | `xxx` | Vercel API Token |
| `VERCEL_ORG_ID` | `xxx` | Vercel 组织 ID |
| `VERCEL_PROJECT_ID` | `xxx` | Vercel 项目 ID |
| `BACKEND_URL` | `https://blinko-xxxxx.run.app` | **必填** Cloud Run 服务地址 |

> ⚠️ `BACKEND_URL` 是 API 代理的目标地址，必须设置为 Cloud Run 服务 URL！
> 
> GitHub Actions 会在构建时动态生成 vercel.json，将 BACKEND_URL 注入到 rewrites 配置中。

### 获取 Vercel Token 和 ID

1. **VERCEL_TOKEN**: 访问 https://vercel.com/account/tokens 创建
2. **VERCEL_ORG_ID** 和 **VERCEL_PROJECT_ID**: 
   - 在 Vercel 项目中运行 `vercel link`
   - 查看 `.vercel/project.json` 文件

## 3. 配置自动部署

Vercel 默认会在以下情况自动部署：
- 推送到 `main` 分支 → 生产环境
- 创建 Pull Request → 预览环境

## 4. 自定义域名（可选）

1. 进入 Project Settings → Domains
2. 添加你的域名
3. 按照提示配置 DNS 记录

## 5. 验证部署

部署完成后，按以下步骤验证：

### 5.1 检查前端加载
访问 Vercel 提供的 URL，确认页面加载正常（不是 404）

### 5.2 检查 API 代理
打开浏览器开发者工具 → Network，确认：
- `/api/*` 请求返回 200（不是 404 或 502）
- `/trpc/*` 请求正常工作

### 5.3 常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 404 错误 | 后端未部署 | 先部署 Cloud Run 后端 |
| 502 Bad Gateway | BACKEND_URL 错误 | 检查环境变量配置 |
| API 超时 | Cloud Run 冷启动 | 等待几秒后重试 |
| 数据库错误 | DATABASE_URL 错误 | 检查 Supabase 连接 |

## 6. 完整部署流程

```bash
# 1. 设置 GCP Secrets（首次部署）
./deploy.sh secrets

# 2. 部署后端到 Cloud Run
./deploy.sh backend

# 3. 获取 Cloud Run URL
./deploy.sh status
# 记录输出的服务 URL，如 https://blinko-xxxxx.run.app

# 4. 在 GitHub 设置 BACKEND_URL Secret
# 仓库 → Settings → Secrets → Actions → New repository secret
# Name: BACKEND_URL
# Value: https://blinko-xxxxx.run.app

# 5. 触发 GitHub Actions 部署
# 推送代码或手动触发 workflow
```

## 7. 本地测试（可选）

如果想在本地测试 vercel.json 配置：

```bash
cd get/blinko-main

# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 本地开发（会使用 vercel.json 配置）
vercel dev
```
