---
inclusion: fileMatch
fileMatchPattern: "**/{deploy,gcp,vercel,workflow,service,Dockerfile,echo-server}*"
---

# 🏗️ 架构部署清单

> **⚠️ 修改服务前，先确认部署位置！**

## 🔴 重要提醒

**修改 `services/echo-server/` 后，必须部署到 GCP Cloud Run！**

```bash
# Echo 后端部署命令
./infra/deploy/deploy-echo-server.sh
```

本地开发的代码不会自动同步到云端，需要手动构建镜像并部署。

---

## 当前部署状态 ✅

### Echo 后端 (已部署)

| 项目 | 值 |
|------|-----|
| 平台 | GCP Cloud Run |
| 区域 | asia-east1 |
| 服务名 | echo-server |
| 镜像 | gcr.io/gen-lang-client-0596519904/echo-server |
| 端口 | 8080 |
| 内存 | 1Gi |
| CPU | 1 |
| 实例 | 0-5 (自动伸缩) |

**包含功能：**
- 投资模块 (Investment Agent, Multi-Agent Orchestrator)
- AI Agent (Gemini, RAG)
- Google Drive 同步
- LiveKit 语音集成
- tRPC API

### 部署文件

| 文件 | 用途 |
|------|------|
| `infra/docker/Dockerfile.echo-server` | Docker 镜像构建 |
| `infra/deploy/deploy-echo-server.sh` | 部署脚本 |
| `infra/deploy/setup-gcp-secrets.sh` | 密钥配置 |
| `infra/prisma/schema.prisma` | 数据库 Schema |

---

## 线上地址

| 服务 | URL |
|------|-----|
| RiskControl 前端 | https://provip.vercel.app/ |
| Echo 后端 | https://echo-server-xxxxx-de.a.run.app (Cloud Run) |
| GitHub | https://github.com/dseirz-rgb/riskcontrol |

---

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    用户浏览器 / iOS App                      │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│        Vercel           │     │      GCP Cloud Run          │
│  RiskControl 前端       │     │  ┌─────────────────────┐    │
│  + API Functions        │────▶│  │   echo-server       │    │
│  (packages/riskcontrol) │     │  │   - 投资模块        │    │
└─────────────────────────┘     │  │   - AI Agent        │    │
                                │  │   - Drive 同步      │    │
                                │  └─────────────────────┘    │
                                │  ┌─────────────────────┐    │
                                │  │   voice-agent       │    │
                                │  │   (LiveKit)         │    │
                                │  └─────────────────────┘    │
                                │  ┌─────────────────────┐    │
                                │  │   lightrag          │    │
                                │  │   (RAG 知识库)      │    │
                                │  └─────────────────────┘    │
                                └─────────────────────────────┘
                                              │
              ┌───────────────────────────────┴───────────────┐
              ▼                                               ▼
┌─────────────────────────┐                 ┌─────────────────────────┐
│   Supabase (Echo DB)    │                 │ Supabase (Investment DB)│
│   - 笔记、标签          │                 │   - 持仓、交易          │
│   - 用户、AI 对话       │                 │   - NAV、资产快照       │
│   - 文件管理            │                 │   - 投资笔记            │
└─────────────────────────┘                 └─────────────────────────┘
```

---

## 服务部署总览

| 服务 | 平台 | 目录 | CI/CD | 部署命令 |
|------|------|------|-------|----------|
| RiskControl 前端 + API | Vercel | `packages/riskcontrol/`, `api/` | ✅ Git Push 自动 | `git push` |
| **Echo 后端** | **GCP** | `services/echo-server/` | ❌ **手动** | `./infra/deploy/deploy-echo-server.sh` |
| LiveKit 语音 | GCP | `services/voice-agent/` | ✅ GitHub Actions | - |
| LightRAG | GCP | `services/lightrag/` | ✅ GitHub Actions | - |
| 数据库 | Supabase | `infra/prisma/`, `infra/drizzle/` | ❌ 手动迁移 | `npm run db:push` |

---

## Echo 后端更新流程

### 1. 修改代码后部署

```bash
# 确保 Docker Desktop 已启动
# 确保 gcloud 已登录

./infra/deploy/deploy-echo-server.sh
```

脚本会自动：
1. 构建 Docker 镜像
2. 推送到 GCR
3. 部署到 Cloud Run
4. 输出服务 URL

### 2. 首次部署 (配置密钥)

```bash
# 配置 GCP Secret Manager 密钥
./infra/deploy/setup-gcp-secrets.sh

# 然后部署
./infra/deploy/deploy-echo-server.sh
```

### 3. 查看日志

```bash
# 查看 Cloud Run 日志
gcloud run services logs read echo-server --region=asia-east1 --limit=50

# 或在 GCP Console 查看
# https://console.cloud.google.com/run/detail/asia-east1/echo-server/logs
```

### 4. 回滚

```bash
# 查看历史版本
gcloud run revisions list --service=echo-server --region=asia-east1

# 回滚到指定版本
gcloud run services update-traffic echo-server \
  --to-revisions=echo-server-00001-xxx=100 \
  --region=asia-east1
```

---

## 环境变量 (GCP Secret Manager)

| 密钥名 | 用途 |
|--------|------|
| `echo-database-url` | Echo DB (Supabase) 连接字符串 |
| `echo-nextauth-secret` | NextAuth 密钥 |
| `echo-gemini-api-key` | Gemini API Key |
| `echo-livekit-url` | LiveKit 服务地址 |
| `echo-livekit-api-key` | LiveKit API Key |
| `echo-livekit-api-secret` | LiveKit API Secret |
| `echo-investment-supabase-url` | Investment DB URL |
| `echo-investment-supabase-key` | Investment DB Key |

---

## ⚠️ 已废弃服务

| 服务 | 状态 | 说明 |
|------|------|------|
| `openbb-service/` | 已合并 | 合并到 quant-service |
| `qlib-service/` | 已合并 | 合并到 quant-service |
| Zeabur | 已弃用 | 所有服务迁移到 GCP |

---

## 问题排查

| 问题 | 检查方法 |
|------|----------|
| Echo 后端不工作 | `gcloud run services logs read echo-server` |
| 语音服务不工作 | GCP Cloud Run 日志 |
| API 500 | Vercel Functions 日志 |
| 数据库连接失败 | Supabase Dashboard |
| 前端异常 | Vercel 部署日志 + 环境变量 |
| Docker 构建失败 | 检查 Dockerfile 和依赖 |
