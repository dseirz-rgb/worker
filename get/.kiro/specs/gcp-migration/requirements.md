# Requirements Document

## Introduction

将现有的多云架构（Vercel + Zeabur + Cloudflare Workers）整合迁移到 Google Cloud Platform，以减少跨云服务商的网络延迟和复杂性，特别是优化语音服务与 Gemini API 的通信稳定性。数据库继续使用 Supabase。

## Glossary

- **Cloud_Run**: Google Cloud 的无服务器容器运行平台
- **Firebase_Hosting**: Google 的静态网站托管服务
- **Voice_Service**: 基于 Gemini Live API 的语音对话服务
- **LightRAG_Service**: 知识图谱增强的 RAG 检索服务
- **API_Service**: 后端 API 服务（原 Vercel API routes）
- **Migration_System**: 负责执行迁移的系统和流程

## Requirements

### Requirement 1: Voice Service 迁移到 Cloud Run

**User Story:** As a developer, I want to migrate the Voice Service to Cloud Run, so that it can communicate with Gemini API within the same Google network for better stability.

#### Acceptance Criteria

1. WHEN the Voice_Service container is deployed to Cloud Run, THE Migration_System SHALL configure it with WebSocket support enabled
2. WHEN the Voice_Service receives a connection request, THE Cloud_Run instance SHALL maintain persistent WebSocket connections without timeout issues
3. WHEN the Voice_Service calls Gemini Live API, THE network latency SHALL be reduced compared to the current Zeabur deployment
4. IF the Voice_Service deployment fails, THEN THE Migration_System SHALL provide clear error logs for debugging
5. THE Voice_Service SHALL use the same Dockerfile with minimal modifications for Cloud Run compatibility

### Requirement 2: LightRAG Service 迁移到 Cloud Run

**User Story:** As a developer, I want to migrate the LightRAG Service to Cloud Run, so that all backend services are in the same GCP project.

#### Acceptance Criteria

1. WHEN the LightRAG_Service is deployed to Cloud Run, THE Migration_System SHALL configure persistent storage for the knowledge graph data
2. WHEN the Voice_Service queries LightRAG for context, THE internal network communication SHALL use Cloud Run service-to-service authentication
3. THE LightRAG_Service SHALL maintain the same API interface after migration
4. IF the knowledge graph data needs to be migrated, THEN THE Migration_System SHALL provide a data migration script

### Requirement 3: API Service 迁移到 Cloud Run

**User Story:** As a developer, I want to migrate the Vercel API routes to Cloud Run, so that all backend logic is consolidated in GCP.

#### Acceptance Criteria

1. WHEN the API_Service is deployed, THE Migration_System SHALL convert Vercel serverless functions to a unified Express/Fastify server
2. THE API_Service SHALL maintain backward compatibility with all existing API endpoints
3. WHEN the API_Service connects to Supabase, THE connection SHALL work correctly from GCP network
4. THE API_Service SHALL handle CORS properly for the new Firebase Hosting domain

### Requirement 4: 前端迁移到 Firebase Hosting

**User Story:** As a developer, I want to migrate the frontend to Firebase Hosting, so that the entire application is hosted on Google infrastructure.

#### Acceptance Criteria

1. WHEN the frontend is deployed to Firebase Hosting, THE build output SHALL be served with proper caching headers
2. THE Firebase_Hosting SHALL configure rewrites to support SPA routing
3. WHEN the frontend calls backend APIs, THE requests SHALL be routed to the Cloud Run API service
4. THE frontend deployment SHALL integrate with GitHub Actions for CI/CD

### Requirement 5: 环境变量和密钥管理

**User Story:** As a developer, I want to manage environment variables securely in GCP, so that sensitive credentials are protected.

#### Acceptance Criteria

1. THE Migration_System SHALL use Google Secret Manager for storing sensitive credentials
2. WHEN a Cloud Run service starts, THE service SHALL automatically load secrets from Secret Manager
3. THE Migration_System SHALL document all required environment variables for each service

### Requirement 6: 域名和 SSL 配置

**User Story:** As a developer, I want to configure custom domains with SSL, so that the migrated services are accessible via the existing domain.

#### Acceptance Criteria

1. WHEN the migration is complete, THE services SHALL be accessible via the existing custom domain
2. THE Firebase_Hosting SHALL automatically provision SSL certificates
3. THE Cloud_Run services SHALL be accessible via custom domains or Firebase Hosting proxy

### Requirement 7: 监控和日志

**User Story:** As a developer, I want unified logging and monitoring, so that I can debug issues across all services.

#### Acceptance Criteria

1. THE Migration_System SHALL configure Cloud Logging for all services
2. WHEN an error occurs in any service, THE logs SHALL be searchable in Cloud Console
3. THE Migration_System SHALL set up basic alerting for service health

### Requirement 8: 成本优化

**User Story:** As a student developer, I want to optimize costs using GCP free tier and student credits, so that the migration doesn't increase expenses.

#### Acceptance Criteria

1. THE Migration_System SHALL configure Cloud Run with minimum instances set to 0 for cost savings
2. THE Migration_System SHALL use the free tier limits where possible
3. THE Migration_System SHALL document estimated monthly costs after migration
