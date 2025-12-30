# Design Document: GCP Migration

## Overview

本设计文档描述将现有多云架构迁移到 Google Cloud Platform 的技术方案。迁移采用分阶段策略，优先迁移 Voice Service 以解决语音通话稳定性问题，然后逐步迁移其他服务。

## Architecture

### 当前架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vercel        │     │    Zeabur       │     │   Cloudflare    │
│  ┌───────────┐  │     │  ┌───────────┐  │     │  ┌───────────┐  │
│  │ Frontend  │  │     │  │  Voice    │  │     │  │  Workers  │  │
│  │ + API     │  │     │  │  Service  │  │     │  │  (proxy)  │  │
│  └───────────┘  │     │  └───────────┘  │     │  └───────────┘  │
│                 │     │  ┌───────────┐  │     └─────────────────┘
│                 │     │  │ LightRAG  │  │
│                 │     │  └───────────┘  │
└─────────────────┘     └─────────────────┘
         │                      │
         └──────────┬───────────┘
                    ▼
            ┌───────────────┐
            │   Supabase    │
            │  (Database)   │
            └───────────────┘
```

### 目标架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Cloud Platform                     │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │ Firebase        │     │        Cloud Run             │   │
│  │ Hosting         │     │  ┌───────────────────────┐  │   │
│  │ ┌─────────────┐ │     │  │    Voice Service      │  │   │
│  │ │  Frontend   │ │     │  │  (WebSocket enabled)  │  │   │
│  │ │  (Static)   │ │     │  └───────────────────────┘  │   │
│  │ └─────────────┘ │     │  ┌───────────────────────┐  │   │
│  └─────────────────┘     │  │   LightRAG Service    │  │   │
│                          │  │  (with GCS storage)   │  │   │
│  ┌─────────────────┐     │  └───────────────────────┘  │   │
│  │ Secret Manager  │     │  ┌───────────────────────┐  │   │
│  │ (credentials)   │     │  │    API Service        │  │   │
│  └─────────────────┘     │  │  (Express/Fastify)    │  │   │
│                          │  └───────────────────────┘  │   │
│  ┌─────────────────┐     └─────────────────────────────┘   │
│  │ Cloud Logging   │                                        │
│  │ (unified logs)  │                                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      ┌───────────────┐
                      │   Supabase    │
                      │  (Database)   │
                      └───────────────┘
```

## Components and Interfaces

### 1. Voice Service (Cloud Run)

**配置要求：**
- Container port: 8080
- WebSocket support: 启用 HTTP/2 和 session affinity
- Memory: 512MB - 1GB
- CPU: 1 vCPU
- Min instances: 0 (成本优化)
- Max instances: 10
- Timeout: 3600s (支持长连接)

**Dockerfile 修改：**
```dockerfile
# 无需修改，现有 Dockerfile 兼容 Cloud Run
# 只需确保 PORT 环境变量正确使用
```

**Cloud Run 配置 (cloudbuild.yaml)：**
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/voice-service', './voice-service']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/voice-service']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'voice-service'
      - '--image=gcr.io/$PROJECT_ID/voice-service'
      - '--region=us-central1'
      - '--platform=managed'
      - '--allow-unauthenticated'
      - '--session-affinity'
      - '--timeout=3600'
      - '--memory=1Gi'
      - '--cpu=1'
      - '--min-instances=0'
      - '--max-instances=10'
```

### 2. LightRAG Service (Cloud Run)

**存储方案：**
- 使用 Google Cloud Storage (GCS) 存储知识图谱数据
- 或使用 Cloud Run 的 Volume Mounts (推荐用于小型数据)

**配置要求：**
- Container port: 8080
- Memory: 2GB (知识图谱需要更多内存)
- CPU: 2 vCPU
- Min instances: 0
- Max instances: 5

**服务间通信：**
- Voice Service → LightRAG: 使用 Cloud Run 内部 URL
- 格式: `https://lightrag-service-xxxxx-uc.a.run.app`

### 3. API Service (Cloud Run)

**架构转换：**
将 Vercel serverless functions 转换为统一的 Express 服务器。

**目录结构：**
```
api-service/
├── Dockerfile
├── package.json
├── src/
│   ├── index.ts          # Express 入口
│   ├── routes/
│   │   ├── chat.ts
│   │   ├── documents.ts
│   │   ├── embedding.ts
│   │   ├── health.ts
│   │   └── ...
│   └── middleware/
│       ├── cors.ts
│       └── auth.ts
```

**Express 服务器示例：**
```typescript
import express from 'express';
import cors from 'cors';

const app = express();

// CORS 配置
app.use(cors({
  origin: [
    'https://your-app.web.app',
    'https://your-custom-domain.com'
  ],
  credentials: true
}));

// 路由
app.use('/api/chat', chatRouter);
app.use('/api/documents', documentsRouter);
// ...

const PORT = process.env.PORT || 8080;
app.listen(PORT);
```

### 4. Firebase Hosting

**firebase.json 配置：**
```json
{
  "hosting": {
    "public": "dist/public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "api-service",
          "region": "us-central1"
        }
      },
      {
        "source": "/voice/**",
        "run": {
          "serviceId": "voice-service",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
```

### 5. Secret Manager

**需要存储的密钥：**
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
OPENAI_API_KEY (如果使用)
```

**Cloud Run 集成：**
```yaml
# 在 Cloud Run 部署时引用 Secret Manager
--set-secrets=SUPABASE_URL=supabase-url:latest,GEMINI_API_KEY=gemini-api-key:latest
```

## Data Models

### 服务配置模型

```typescript
interface CloudRunServiceConfig {
  name: string;
  region: string;
  memory: string;
  cpu: string;
  minInstances: number;
  maxInstances: number;
  timeout: number;
  env: Record<string, string>;
  secrets: string[];
}

interface FirebaseHostingConfig {
  public: string;
  rewrites: RewriteRule[];
  headers: HeaderRule[];
}
```

### 迁移状态模型

```typescript
interface MigrationStatus {
  phase: 'voice' | 'lightrag' | 'api' | 'frontend' | 'complete';
  services: {
    voice: ServiceStatus;
    lightrag: ServiceStatus;
    api: ServiceStatus;
    frontend: ServiceStatus;
  };
}

interface ServiceStatus {
  deployed: boolean;
  url: string | null;
  lastDeployment: Date | null;
  healthCheck: 'healthy' | 'unhealthy' | 'unknown';
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: WebSocket Connection Stability

*For any* WebSocket connection established to the Voice Service on Cloud Run, the connection SHALL remain active for at least 30 minutes without unexpected disconnection, given continuous activity.

**Validates: Requirements 1.2**

### Property 2: LightRAG API Compatibility

*For any* valid API request that worked on the Zeabur-hosted LightRAG service, the same request to the Cloud Run-hosted service SHALL return a response with the same structure and semantics.

**Validates: Requirements 2.3**

### Property 3: API Backward Compatibility

*For any* valid API endpoint call that worked on Vercel, the same call to the Cloud Run API service SHALL return a compatible response (same status codes, same response structure).

**Validates: Requirements 3.2**

## Error Handling

### 部署失败处理

1. **构建失败**: Cloud Build 会记录详细日志，可在 Cloud Console 查看
2. **启动失败**: Cloud Run 会自动回滚到上一个健康版本
3. **运行时错误**: 通过 Cloud Logging 收集，设置告警

### 服务间通信失败

1. **重试策略**: 使用指数退避重试
2. **熔断器**: 当下游服务不可用时快速失败
3. **降级**: Voice Service 在 LightRAG 不可用时使用缓存或简化响应

### 数据库连接失败

1. **连接池**: 使用连接池管理 Supabase 连接
2. **超时设置**: 设置合理的连接和查询超时
3. **重连机制**: 自动重连断开的连接

## Testing Strategy

### 单元测试

- 测试 API 路由转换的正确性
- 测试环境变量加载
- 测试 CORS 配置

### 集成测试

- 测试 Voice Service WebSocket 连接
- 测试 LightRAG 查询功能
- 测试 API 端点响应

### 端到端测试

- 测试完整的语音对话流程
- 测试前端到后端的完整链路
- 测试域名和 SSL 配置

### 性能测试

- 对比迁移前后的 WebSocket 延迟
- 对比 API 响应时间
- 测试冷启动时间

### Property-Based Testing

使用 fast-check 库进行属性测试：

```typescript
import fc from 'fast-check';

// Property 2: LightRAG API Compatibility
describe('LightRAG API Compatibility', () => {
  it('should return same structure for any valid query', () => {
    fc.assert(
      fc.property(fc.string(), async (query) => {
        const zeaburResponse = await fetchZeabur(query);
        const cloudRunResponse = await fetchCloudRun(query);
        expect(cloudRunResponse.structure).toEqual(zeaburResponse.structure);
      }),
      { numRuns: 100 }
    );
  });
});
```

## Migration Phases

### Phase 1: Voice Service (优先级最高)

1. 在 GCP 项目中启用必要的 API
2. 配置 Secret Manager
3. 部署 Voice Service 到 Cloud Run
4. 测试 WebSocket 连接稳定性
5. 更新前端 Voice Service URL
6. 验证语音对话功能

### Phase 2: LightRAG Service

1. 配置 GCS 存储桶（如需要）
2. 部署 LightRAG Service 到 Cloud Run
3. 迁移知识图谱数据
4. 更新 Voice Service 的 LightRAG URL
5. 验证 RAG 查询功能

### Phase 3: API Service

1. 创建 Express 服务器项目
2. 转换 Vercel serverless functions
3. 部署到 Cloud Run
4. 配置 Firebase Hosting 代理
5. 验证所有 API 端点

### Phase 4: Frontend

1. 配置 Firebase 项目
2. 设置 Firebase Hosting
3. 配置 GitHub Actions CI/CD
4. 部署前端
5. 配置自定义域名
6. 验证完整功能

## Cost Estimation

### Cloud Run (预估月费用)

| 服务 | 配置 | 预估费用 |
|------|------|----------|
| Voice Service | 1 vCPU, 1GB, ~100 小时/月 | ~$5-10 |
| LightRAG | 2 vCPU, 2GB, ~50 小时/月 | ~$5-10 |
| API Service | 1 vCPU, 512MB, ~200 小时/月 | ~$5-10 |

### Firebase Hosting

- 免费层: 10GB 存储, 360MB/天带宽
- 预估: $0 (在免费层内)

### Secret Manager

- 免费层: 6 个活跃密钥版本
- 预估: $0 (在免费层内)

### 总计

- 预估月费用: $15-30
- 学生额度可覆盖: 是
