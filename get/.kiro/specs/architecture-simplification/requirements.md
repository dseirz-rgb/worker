# Requirements Document

## Introduction

本项目旨在简化当前的部署架构，从全 Cloud Run 方案迁移到 Vercel + Cloud Run 混合架构。通过删除冗余的 `api-service/` Express 服务，利用已有的 `api/` Vercel Serverless Functions，降低运维复杂度和成本，同时保持 Python 服务（lightrag-service、voice-service）在 Cloud Run 上运行。

## Glossary

- **Vercel**: 前端托管和 Serverless Functions 平台，提供全球 Edge CDN 和零配置部署
- **Cloud_Run**: Google Cloud 的容器化服务平台，适合运行 Docker 容器
- **Serverless_Functions**: Vercel 的无服务器函数，位于 `api/` 目录
- **api-service**: 当前为 Cloud Run 创建的 Express 服务，与 `api/` 功能重叠
- **lightrag-service**: Python RAG 服务，需要长连接和状态管理
- **voice-service**: Python 语音服务，需要 WebSocket 支持
- **Frontend**: React 前端应用，位于 `client/` 目录

## Requirements

### Requirement 1: 删除冗余的 api-service

**User Story:** As a developer, I want to remove the redundant api-service Express server, so that I can reduce code duplication and maintenance burden.

#### Acceptance Criteria

1. WHEN the migration is complete, THE System SHALL have removed the `api-service/` directory entirely
2. WHEN the migration is complete, THE System SHALL have removed all Cloud Run deployment configurations for api-service (cloudbuild.yaml, Dockerfile, GitHub workflows)
3. WHEN the migration is complete, THE System SHALL have updated all documentation to reflect the new architecture

### Requirement 2: 迁移前端到 Vercel

**User Story:** As a user, I want the frontend to be served from Vercel's Edge CDN, so that I can experience faster page loads globally.

#### Acceptance Criteria

1. WHEN a user visits the application, THE Frontend SHALL be served from Vercel's global Edge Network
2. WHEN the frontend is deployed, THE System SHALL use the existing `vercel.json` configuration
3. WHEN environment variables are needed, THE System SHALL configure them in Vercel Dashboard
4. WHEN a deployment occurs, THE System SHALL trigger automatically on git push to main branch

### Requirement 3: 使用 Vercel Serverless Functions 处理 API 请求

**User Story:** As a developer, I want to use Vercel Serverless Functions for API endpoints, so that I can benefit from automatic scaling and reduced cold start times.

#### Acceptance Criteria

1. WHEN an API request is made, THE Serverless_Functions SHALL handle requests at `/api/*` endpoints
2. WHEN the chat endpoint is called, THE Serverless_Functions SHALL process requests within Vercel's 30-second timeout
3. WHEN the embedding endpoint is called, THE Serverless_Functions SHALL connect to external AI services
4. WHEN the unified-intelligence endpoints are called, THE Serverless_Functions SHALL orchestrate multi-agent analysis
5. IF a request exceeds Vercel's timeout limit, THEN THE System SHALL return an appropriate error response

### Requirement 4: 保持 Python 服务在 Cloud Run

**User Story:** As a developer, I want to keep Python services on Cloud Run, so that I can support WebSocket connections and long-running processes.

#### Acceptance Criteria

1. WHILE lightrag-service is running, THE Cloud_Run SHALL maintain the service with persistent storage
2. WHILE voice-service is running, THE Cloud_Run SHALL support WebSocket connections for real-time audio
3. WHEN Serverless_Functions need RAG data, THE System SHALL call lightrag-service via HTTP
4. WHEN the frontend needs voice features, THE System SHALL connect to voice-service via WebSocket

### Requirement 5: 更新客户端 API 配置

**User Story:** As a developer, I want the client to correctly route API requests, so that the application works seamlessly in both development and production.

#### Acceptance Criteria

1. WHEN running in development, THE Frontend SHALL use Vite proxy for `/api/*` requests
2. WHEN running in production on Vercel, THE Frontend SHALL use relative paths for API requests
3. WHEN calling lightrag-service, THE Frontend SHALL use the configured `LIGHTRAG_SERVICE_URL` environment variable
4. WHEN calling voice-service, THE Frontend SHALL use the configured `VOICE_SERVICE_URL` environment variable

### Requirement 6: 清理 GCP 相关配置

**User Story:** As a developer, I want to clean up unused GCP configurations, so that the codebase remains maintainable.

#### Acceptance Criteria

1. WHEN the migration is complete, THE System SHALL have removed api-service related GCP scripts from `gcp/scripts/`
2. WHEN the migration is complete, THE System SHALL have updated `gcp/README.md` to reflect only lightrag and voice services
3. WHEN the migration is complete, THE System SHALL have removed api-service from GitHub Actions workflows
4. WHEN the migration is complete, THE System SHALL have updated Terraform configurations if applicable

### Requirement 7: 验证功能完整性

**User Story:** As a user, I want all existing features to work after the migration, so that my workflow is not disrupted.

#### Acceptance Criteria

1. WHEN the chat feature is used, THE System SHALL respond with AI-generated content
2. WHEN documents are searched, THE System SHALL return relevant results from lightrag-service
3. WHEN voice features are used, THE System SHALL establish WebSocket connection to voice-service
4. WHEN the health endpoint is called, THE System SHALL report status of all dependent services
5. WHEN articles are imported, THE System SHALL process and store them correctly
