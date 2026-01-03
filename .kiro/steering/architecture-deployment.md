---
inclusion: fileMatch
fileMatchPattern: "**/{deploy,gcp,vercel,workflow,service,Dockerfile}*"
---

# 🏗️ 架构部署清单

> **⚠️ 修改服务前，先确认部署位置！**

## 线上地址

- **前端**: https://provip.vercel.app/
- **GitHub**: https://github.com/dseirz-rgb/riskcontrol

## 架构图

```
用户浏览器
    │
    ▼
┌─────────────────────────────────────┐
│           Vercel                    │
│  前端 (client/)  +  API (api/)      │
└─────────────────────────────────────┘
    │                │
    │                ▼
    │         ┌─────────────┐
    │         │  Supabase   │
    │         │  (数据库)    │
    │         └─────────────┘
    ▼
┌─────────────────────────────────────┐
│        GCP Cloud Run                │
│  LiveKit语音 │ LightRAG │ Quant    │
└─────────────────────────────────────┘
```

## 服务部署总览

| 服务 | 平台 | 目录 | CI/CD |
|------|------|------|-------|
| 前端 + API | Vercel | `client/`, `api/` | ✅ Git Push 自动 |
| LiveKit 语音 | GCP | `livekit-voice-service/` | ✅ GitHub Actions |
| LightRAG | GCP | `lightrag-service/` | ✅ GitHub Actions |
| Quant Service | GCP | `quant-service/` | ❌ 手动脚本 |
| 数据库 | Supabase | `drizzle/` | ❌ 手动迁移 |

## ⚠️ 已废弃服务

| 服务 | 状态 | 说明 |
|------|------|------|
| `openbb-service/` | 已合并 | 合并到 quant-service |
| `qlib-service/` | 已合并 | 合并到 quant-service |
| Zeabur | 已弃用 | 所有服务迁移到 GCP |

## 部署命令

```bash
# Vercel (自动)
git push origin main

# GCP 服务
./gcp/scripts/deploy-livekit-voice-service.sh
./gcp/scripts/deploy-lightrag-service.sh
./gcp/scripts/deploy-quant-service.sh

# 数据库
npm run db:push
```

## GitHub Actions

| Workflow | 触发 | 作用 |
|----------|------|------|
| `deploy-voice-service.yml` | Push livekit-voice-service/ | 部署语音到 GCP |
| `deploy-lightrag-service.yml` | Push lightrag-service/ | 部署 LightRAG 到 GCP |

## 服务依赖关系

```
前端 → API Functions → Supabase (数据)
                    → Gemini (AI)
                    → LightRAG (RAG)
                    → Quant Service (数据+分析)

LiveKit 语音 → Gemini Realtime
            → Supabase (上下文)
```

## 问题排查

| 问题 | 检查 |
|------|------|
| 语音服务不工作 | GCP Cloud Run 日志 |
| API 500 | Vercel Functions 日志 |
| 数据库连接失败 | Supabase Dashboard |
| 前端异常 | Vercel 部署日志 + 环境变量 |
