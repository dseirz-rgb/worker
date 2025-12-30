# Design Document: Architecture Simplification

## Overview

本设计文档描述如何将项目从全 Cloud Run 架构简化为 Vercel + Cloud Run 混合架构。核心思路是：

1. **删除冗余的 `api-service/`** - 这是为 Cloud Run 创建的 Express 服务，与 `api/` 目录的 Vercel Serverless Functions 功能完全重叠
2. **使用 Vercel 托管前端和 API** - 利用 Vercel 的 Edge CDN 和 Serverless Functions
3. **保留 Cloud Run 运行 Python 服务** - lightrag-service 和 voice-service 需要长连接支持

### 目标架构

```
┌─────────────────────────────────────────────────────────────┐
│                         Vercel                               │
│  ┌──────────────────┐    ┌────────────────────────────────┐ │
│  │    client/       │    │           api/                 │ │
│  │   (React SPA)    │    │   - chat.ts                    │ │
│  │   Edge CDN       │    │   - documents.ts               │ │
│  │   自动部署       │    │   - embedding.ts               │ │
│  └──────────────────┘    │   - health.ts                  │ │
│                          │   - import-article.ts          │ │
│                          │   - unified-intelligence/*     │ │
│                          └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP / WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Cloud Run (GCP)                         │
│  ┌──────────────────────┐    ┌────────────────────────────┐ │
│  │  lightrag-service    │    │     voice-service          │ │
│  │  (Python FastAPI)    │    │     (Python FastAPI)       │ │
│  │  - RAG 查询          │    │     - WebSocket 语音       │ │
│  │  - 知识图谱          │    │     - Gemini Live API      │ │
│  └──────────────────────┘    └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Architecture

### 组件职责划分

| 组件 | 平台 | 职责 | 原因 |
|------|------|------|------|
| client/ | Vercel | React 前端 | Edge CDN 加速，自动部署 |
| api/ | Vercel | Serverless Functions | 无状态 API，冷启动快 |
| lightrag-service | Cloud Run | RAG 服务 | Python 环境，持久化存储 |
| voice-service | Cloud Run | 语音服务 | WebSocket 长连接 |

### 删除的组件

| 组件 | 原因 |
|------|------|
| api-service/ | 与 api/ 功能重叠，Express 服务冗余 |
| .github/workflows/deploy-api-service.yml | 不再需要 |
| gcp/scripts/deploy-api-service.sh | 不再需要 |
| api-service/cloudbuild.yaml | 不再需要 |
| api-service/Dockerfile | 不再需要 |

## Components and Interfaces

### 1. Vercel 前端配置

使用现有的 `vercel.json` 配置：

```json
{
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

### 2. API 端点映射

现有 `api/` 目录的 Serverless Functions：

| 端点 | 文件 | 功能 |
|------|------|------|
| `/api/chat` | api/chat.ts | AI 对话 |
| `/api/documents` | api/documents.ts | 文档管理 |
| `/api/documents/search` | api/documents/search.ts | 文档搜索 |
| `/api/embedding` | api/embedding.ts | 向量嵌入 |
| `/api/health` | api/health.ts | 健康检查 |
| `/api/import-article` | api/import-article.ts | 文章导入 |
| `/api/send-email` | api/send-email.ts | 邮件发送 |
| `/api/unified-intelligence/*` | api/unified-intelligence/*.ts | 统一智能分析 |

### 3. 客户端 API 配置

更新 `client/src/services/apiConfig.ts`：

```typescript
// 生产环境：Vercel 相对路径
// 开发环境：Vite 代理
export function getApiBaseUrl(): string {
  return ''; // 始终使用相对路径
}

// 外部服务 URL（Cloud Run）
export const EXTERNAL_SERVICES = {
  LIGHTRAG: import.meta.env.VITE_LIGHTRAG_SERVICE_URL || 'https://lightrag-service-xxx.run.app',
  VOICE: import.meta.env.VITE_VOICE_SERVICE_URL || 'https://voice-service-xxx.run.app',
};
```

### 4. 环境变量配置

Vercel Dashboard 需要配置的环境变量：

| 变量名 | 用途 |
|--------|------|
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_KEY` | Supabase 服务密钥 |
| `GEMINI_API_KEY` | Gemini API 密钥 |
| `LIGHTRAG_SERVICE_URL` | LightRAG Cloud Run URL |
| `VOICE_SERVICE_URL` | Voice Cloud Run URL |
| `VITE_SUPABASE_URL` | 前端 Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | 前端 Supabase 匿名密钥 |

## Data Models

本次迁移不涉及数据模型变更，所有数据仍存储在：

- **Supabase**: 用户数据、文档元数据、交易记录
- **LightRAG**: 知识图谱、向量索引

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API 路由正确性

*For any* API 请求路径 `/api/*`，在生产环境中，请求应该被 Vercel Serverless Functions 正确处理并返回有效响应。

**Validates: Requirements 3.1, 5.2**

### Property 2: 外部服务 URL 配置正确性

*For any* 对 lightrag-service 或 voice-service 的调用，系统应该使用环境变量中配置的 URL，而不是硬编码值。

**Validates: Requirements 5.3, 5.4**

### Property 3: 健康检查完整性

*For any* 对 `/api/health` 的调用，响应应该包含所有依赖服务（Supabase、LightRAG）的状态信息。

**Validates: Requirements 7.4**

## Error Handling

### Vercel 超时处理

Vercel Serverless Functions 有 30 秒超时限制。对于可能超时的操作：

1. **chat.ts**: 使用流式响应避免超时
2. **unified-intelligence**: 分解为多个小请求
3. **import-article**: 异步处理，返回任务 ID

### Cloud Run 服务不可用

当 lightrag-service 或 voice-service 不可用时：

1. **健康检查**: 返回 `degraded` 状态而非 `unhealthy`
2. **前端**: 显示降级提示，禁用相关功能
3. **重试**: 实现指数退避重试机制

## Testing Strategy

### 单元测试

- 验证 `apiConfig.ts` 返回正确的 URL
- 验证环境变量读取逻辑

### 集成测试

- 验证 `/api/health` 端点返回正确结构
- 验证 `/api/chat` 端点可以处理请求
- 验证 lightrag-service 连接

### 端到端测试

- 验证前端可以正常加载
- 验证聊天功能正常工作
- 验证文档搜索功能正常工作

### 迁移验证清单

- [ ] api-service/ 目录已删除
- [ ] deploy-api-service.yml 已删除
- [ ] gcp/scripts/deploy-api-service.sh 已删除
- [ ] Vercel 部署成功
- [ ] 所有 API 端点可访问
- [ ] lightrag-service 连接正常
- [ ] voice-service 连接正常
- [ ] 健康检查返回正确状态
