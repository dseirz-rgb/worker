# Requirements Document

## Introduction

移除 SeekDB 向量数据库，简化 Echo 系统架构。将搜索功能统一到 PostgreSQL 全文搜索 (FTS)，AI 相关的向量搜索交给 Blinko 原生的 embedding 功能处理。

## Glossary

- **PostgreSQL_FTS**: PostgreSQL 全文搜索功能，使用 tsvector 和 ts_rank 实现关键词搜索
- **Blinko_Embedding**: Blinko 原生的 embedding 服务，用于 AI 对话的知识库增强 (RAG)
- **Echo_API**: Echo 的统一 API 层，处理搜索和文件管理请求
- **Sidecar_Service**: echo/sidecar 目录下的 Python 服务，包含 SeekDB 相关代码

## Requirements

### Requirement 1: 移除 SeekDB 依赖

**User Story:** As a developer, I want to remove SeekDB from the system, so that the architecture is simpler and easier to maintain.

#### Acceptance Criteria

1. THE system SHALL remove all SeekDB-related Docker containers from docker-compose files
2. THE system SHALL remove SeekDBClient from the Blinko server codebase
3. THE system SHALL remove SeekDB-related Python scripts from echo/sidecar/scripts
4. THE system SHALL remove SeekDB-related environment variables from .env files
5. THE system SHALL update VISION_AND_ARCHITECTURE.md to reflect the simplified architecture

### Requirement 2: 统一使用 PostgreSQL FTS 搜索

**User Story:** As a user, I want fast keyword search, so that I can find documents quickly without waiting.

#### Acceptance Criteria

1. THE Echo_API SHALL use PostgreSQL_FTS for all document search operations
2. WHEN a user searches for documents, THE system SHALL query PostgreSQL using tsvector
3. THE search results SHALL be ranked using ts_rank function
4. THE search response time SHALL be under 100ms for datasets under 10,000 documents
5. THE system SHALL remove the alpha parameter and SearchRouter logic

### Requirement 3: AI 向量搜索使用 Blinko 原生功能

**User Story:** As a user, I want AI conversations to understand my knowledge base, so that I get relevant answers.

#### Acceptance Criteria

1. THE AI chat feature SHALL use Blinko_Embedding for knowledge retrieval (RAG)
2. WHEN AI needs context, THE system SHALL query Blinko's native embedding service
3. THE system SHALL NOT maintain a separate vector database for AI features
4. THE Blinko_Embedding service SHALL handle all embedding generation and similarity search

### Requirement 4: 清理冗余代码

**User Story:** As a developer, I want clean codebase, so that I can maintain and extend the system easily.

#### Acceptance Criteria

1. THE system SHALL remove search_router.py from echo/sidecar/scripts
2. THE system SHALL remove vector_service.py from echo/sidecar/scripts
3. THE system SHALL remove sync_service.py from echo/sidecar/scripts
4. THE system SHALL remove embedding_cache.py from echo/sidecar/scripts
5. THE system SHALL remove connection_pool.py from echo/sidecar/scripts
6. THE system SHALL remove server_v2.py from echo/sidecar/scripts
7. THE system SHALL remove health_metrics.py from echo/sidecar/scripts
8. THE system SHALL update or remove SearchModeSelector component from UI

### Requirement 5: 更新健康检查

**User Story:** As a developer, I want accurate health monitoring, so that I can identify issues quickly.

#### Acceptance Criteria

1. THE /health endpoint SHALL only check PostgreSQL status
2. THE /health endpoint SHALL NOT check SeekDB status
3. THE ServiceStatus component SHALL remove SeekDB status display
4. THE system SHALL simplify health check logic to single database

### Requirement 6: 保留多模态摄入功能

**User Story:** As a user, I want to upload videos and PPTs, so that their content is searchable.

#### Acceptance Criteria

1. THE Ingest API SHALL continue to process videos using faster-whisper
2. THE Ingest API SHALL continue to process PPTs using python-pptx
3. THE extracted content SHALL be stored in PostgreSQL with FTS indexing
4. THE system SHALL NOT sync extracted content to SeekDB
