# 服务依赖关系图

> 本文档描述项目的多服务架构、依赖关系、端口配置和端点清单。

## 🏗️ 架构概览

```
                              ┌─────────────────┐
                              │   用户浏览器     │
                              └────────┬────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Vercel Platform                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                         React SPA (client/)                             │  │
│  │  - 路由: React Router                                                   │  │
│  │  - 状态: React Query + Zustand                                          │  │
│  │  - UI: Tailwind + shadcn/ui                                             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                       │                                       │
│                                       ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    Serverless Functions (api/)                          │  │
│  │  - /api/health          健康检查                                        │  │
│  │  - /api/chat            AI 对话                                         │  │
│  │  - /api/documents       文档 CRUD                                       │  │
│  │  - /api/documents/search 文档搜索                                       │  │
│  │  - /api/embedding       向量嵌入                                        │  │
│  │  - /api/unified-intelligence/* 统一智能接口                             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
           ┌───────────────────────────┼───────────────────────────┐
           │                           │                           │
           ▼                           ▼                           ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│   LightRAG Service  │   │   Voice Service     │   │   Quant Service     │
│   (GCP Cloud Run)   │   │   (GCP Cloud Run)   │   │   (GCP Cloud Run)   │
│                     │   │                     │   │                     │
│   知识图谱 + RAG    │   │   语音对话 + AI     │   │   量化数据 + 分析   │
│                     │   │                     │   │                     │
│   Python/FastAPI    │   │   Python/LiveKit    │   │   Python/FastAPI    │
│   Port: 9621        │   │   Port: 8080        │   │   Port: 6900        │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
           │                           │                           │
           └───────────────────────────┼───────────────────────────┘
                                       │
                                       ▼
                          ┌─────────────────────┐
                          │      Supabase       │
                          │   (PostgreSQL)      │
                          │                     │
                          │   - 用户数据        │
                          │   - 文档存储        │
                          │   - 向量索引        │
                          └─────────────────────┘
```

---

## 📊 服务详情

### 1. Vercel (前端 + API)

| 属性 | 值 |
|------|-----|
| **类型** | 静态托管 + Serverless Functions |
| **框架** | React 19 + TypeScript |
| **本地端口** | 3000 (vercel dev) / 5173 (vite) |
| **生产 URL** | `https://your-app.vercel.app` |
| **部署方式** | Git Push 自动部署 |

**API 端点**:

| 端点 | 方法 | 描述 | 依赖服务 |
|------|------|------|----------|
| `/api/health` | GET | 健康检查 | Supabase, LightRAG |
| `/api/chat` | POST | AI 对话 | Gemini API |
| `/api/documents` | GET/POST/DELETE | 文档 CRUD | Supabase, LightRAG |
| `/api/documents/search` | POST | 文档搜索 | LightRAG |
| `/api/embedding` | POST | 向量嵌入 | Gemini API |
| `/api/unified-intelligence/query` | POST | 统一查询 | LightRAG, Gemini |
| `/api/unified-intelligence/deep-analyze` | POST | 深度分析 | LightRAG, Gemini |
| `/api/unified-intelligence/voice-context` | POST | 语音上下文 | LightRAG |

---

### 2. LightRAG Service

| 属性 | 值 |
|------|-----|
| **类型** | GCP Cloud Run |
| **框架** | Python + FastAPI |
| **本地端口** | 9621 |
| **生产 URL** | `https://lightrag-service-dpbimyzyja-uc.a.run.app` |
| **部署脚本** | `gcp/scripts/deploy-lightrag-service.sh` |
| **源码目录** | `lightrag-service/` |

**功能**:
- 知识图谱构建和查询
- RAG (检索增强生成)
- 文档索引和搜索

**API 端点**:

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/query` | POST | 知识查询 |
| `/index` | POST | 文档索引 |
| `/delete` | DELETE | 删除索引 |

**环境变量**:
```
GEMINI_API_KEY          # Gemini API 密钥
LIGHTRAG_LLM_MODEL      # LLM 模型名称
LIGHTRAG_EMBEDDING_MODEL # 嵌入模型名称
```

---

### 3. Voice Service (LiveKit)

| 属性 | 值 |
|------|-----|
| **类型** | GCP Cloud Run |
| **框架** | Python + LiveKit Agents |
| **本地端口** | 8080 |
| **生产 URL** | `https://voice-service-dpbimyzyja-uc.a.run.app` |
| **部署脚本** | `gcp/scripts/deploy-livekit-voice-service.sh` |
| **源码目录** | `livekit-voice-service/` |

**功能**:
- 实时语音对话
- AI 语音助手
- 投资组合上下文注入

**API 端点**:

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/ws` | WebSocket | 语音通信 |

**环境变量**:
```
LIVEKIT_URL             # LiveKit 服务器 URL
LIVEKIT_API_KEY         # LiveKit API 密钥
LIVEKIT_API_SECRET      # LiveKit API 密钥
GEMINI_API_KEY          # Gemini API 密钥
CONTEXT_API_URL         # 上下文 API URL
```

---

### 4. Quant Service

| 属性 | 值 |
|------|-----|
| **类型** | GCP Cloud Run |
| **框架** | Python + FastAPI |
| **本地端口** | 6900 |
| **生产 URL** | `https://quant-service-dpbimyzyja-uc.a.run.app` |
| **部署脚本** | `gcp/scripts/deploy-quant-service.sh` |
| **源码目录** | `quant-service/` |

**功能**:
- 量化数据获取
- 风险分析计算
- 投资组合优化

**API 端点**:

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/data` | GET | 获取市场数据 |
| `/analyze` | POST | 风险分析 |
| `/optimize` | POST | 组合优化 |

---

## 🔗 服务依赖关系

### 调用关系矩阵

| 调用方 ↓ / 被调用方 → | Vercel API | LightRAG | Voice | Quant | Supabase | Gemini |
|------------------------|------------|----------|-------|-------|----------|--------|
| **浏览器** | ✅ | ❌ | ✅ (WS) | ❌ | ❌ | ❌ |
| **Vercel API** | - | ✅ | ❌ | ✅ | ✅ | ✅ |
| **LightRAG** | ❌ | - | ❌ | ❌ | ❌ | ✅ |
| **Voice** | ✅ | ❌ | - | ❌ | ❌ | ✅ |
| **Quant** | ❌ | ❌ | ❌ | - | ❌ | ❌ |

### 关键调用链

**1. 文档搜索流程**:
```
浏览器 → Vercel /api/documents/search → LightRAG /query → Gemini API
```

**2. AI 对话流程**:
```
浏览器 → Vercel /api/chat → Gemini API
```

**3. 语音对话流程**:
```
浏览器 → Voice Service (WebSocket) → Gemini API
         ↓
         Vercel /api/unified-intelligence/voice-context → LightRAG
```

**4. 量化分析流程**:
```
浏览器 → Vercel /api/* → Quant Service /analyze
```

---

## 🔌 端口配置汇总

### 本地开发端口

| 服务 | 端口 | 启动命令 |
|------|------|----------|
| Vercel Dev | 3000 | `vercel dev` |
| Vite Dev | 5173 | `npm run dev` |
| LightRAG | 9621 | `python main.py` |
| Voice | 8080 | `python agent.py` |
| Quant | 6900 | `python main.py` |

### 生产环境 URL

| 服务 | URL 模式 |
|------|----------|
| Vercel | `https://<project>.vercel.app` |
| Cloud Run | `https://<service>-<hash>-uc.a.run.app` |

---

## 🔐 环境变量清单

### Vercel 环境变量

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI 服务
GEMINI_API_KEY=
GEMINI_MODEL=

# 外部服务 URL
LIGHTRAG_SERVICE_URL=
QUANT_SERVICE_URL=

# LiveKit (如果 Vercel 需要)
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

### Cloud Run 环境变量

**LightRAG Service**:
```bash
GEMINI_API_KEY=
LIGHTRAG_LLM_MODEL=
LIGHTRAG_EMBEDDING_MODEL=
```

**Voice Service**:
```bash
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
GEMINI_API_KEY=
CONTEXT_API_URL=
```

**Quant Service**:
```bash
# 根据具体实现配置
```

---

## 🚀 部署脚本位置

| 服务 | 脚本路径 |
|------|----------|
| LightRAG | `gcp/scripts/deploy-lightrag-service.sh` |
| Voice | `gcp/scripts/deploy-livekit-voice-service.sh` |
| Quant | `gcp/scripts/deploy-quant-service.sh` |
| 前端 (GCP) | `gcp/scripts/deploy-frontend.sh` |

---

## 📋 健康检查端点

### 快速检查脚本

```bash
#!/bin/bash
# check-all-services.sh

echo "=== 检查所有服务健康状态 ==="

# Vercel
echo -n "Vercel API: "
curl -s -o /dev/null -w "%{http_code}" https://your-app.vercel.app/api/health
echo ""

# LightRAG
echo -n "LightRAG: "
curl -s -o /dev/null -w "%{http_code}" https://lightrag-service-dpbimyzyja-uc.a.run.app/health
echo ""

# Voice
echo -n "Voice: "
curl -s -o /dev/null -w "%{http_code}" https://voice-service-dpbimyzyja-uc.a.run.app/health
echo ""

# Quant
echo -n "Quant: "
curl -s -o /dev/null -w "%{http_code}" https://quant-service-dpbimyzyja-uc.a.run.app/health
echo ""

echo "=== 检查完成 ==="
```

---

## 🔄 更新记录

| 日期 | 更新内容 |
|------|----------|
| 2025-01-01 | 初始版本，包含 Vercel + 3 个 Cloud Run 服务 |
