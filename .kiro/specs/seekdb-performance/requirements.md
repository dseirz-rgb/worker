# Requirements Document

## Introduction

当前 Echo 系统将 SeekDB (OceanBase) 同时用于文档管理和向量搜索，导致日常操作响应缓慢。本需求文档定义了双数据库架构的优化方案：PostgreSQL 作为主数据库处理高频 CRUD 操作，SeekDB 专注于向量搜索和 RAG 检索。

## Glossary

- **PostgreSQL_Primary**: Blinko 已有的 PostgreSQL 数据库，用于文档元数据、标签、全文搜索等高频操作
- **SeekDB_Vector**: SeekDB (OceanBase) 向量数据库，专用于 embedding 存储和语义搜索
- **Echo_API**: 统一的 API 层，根据操作类型路由到不同数据库
- **Sync_Service**: 数据同步服务，将 PostgreSQL 的文档内容同步到 SeekDB 的向量索引
- **Hybrid_Search**: 混合搜索，结合 PostgreSQL 全文搜索和 SeekDB 向量搜索
- **Embedding_Cache**: 查询向量缓存，避免重复生成相同查询的 embedding

## Requirements

### Requirement 1: PostgreSQL 作为主数据库

**User Story:** As a user, I want file browsing and management to be instant, so that I can work efficiently without waiting.

#### Acceptance Criteria

1. THE Echo_API SHALL use PostgreSQL_Primary for all document CRUD operations
2. WHEN listing documents, THE Echo_API SHALL query PostgreSQL_Primary directly
3. WHEN filtering by tags or document types, THE Echo_API SHALL use PostgreSQL_Primary indexes
4. THE PostgreSQL_Primary SHALL respond to list/filter queries within 100ms
5. THE Echo_API SHALL use Prisma ORM to interact with PostgreSQL_Primary

### Requirement 2: PostgreSQL 全文搜索

**User Story:** As a user, I want to search documents by keywords quickly, so that I can find what I need without delay.

#### Acceptance Criteria

1. THE PostgreSQL_Primary SHALL use tsvector for full-text search indexing
2. WHEN a user performs keyword search, THE Echo_API SHALL use PostgreSQL full-text search
3. THE full-text search SHALL support Chinese text via pg_jieba or zhparser extension
4. THE full-text search SHALL respond within 100ms for datasets under 10,000 documents
5. THE Echo_API SHALL provide search result ranking based on ts_rank

### Requirement 3: SeekDB 专用于向量搜索

**User Story:** As a user, I want semantic search to find related documents even when keywords don't match, so that I can discover relevant content.

#### Acceptance Criteria

1. THE SeekDB_Vector SHALL store document embeddings and metadata only
2. WHEN a user requests semantic search (alpha > 0), THE Echo_API SHALL query SeekDB_Vector
3. THE SeekDB_Vector SHALL support l2_distance and cosine_similarity functions
4. THE semantic search MAY take up to 500ms for complex queries
5. THE Echo_API SHALL clearly indicate when semantic search is being used

### Requirement 4: 数据同步机制

**User Story:** As a user, I want my documents to be searchable semantically without manual intervention, so that the system stays in sync automatically.

#### Acceptance Criteria

1. WHEN a document is created in PostgreSQL_Primary, THE Sync_Service SHALL generate and store its embedding in SeekDB_Vector
2. WHEN a document is updated in PostgreSQL_Primary, THE Sync_Service SHALL update its embedding in SeekDB_Vector
3. WHEN a document is deleted from PostgreSQL_Primary, THE Sync_Service SHALL remove its embedding from SeekDB_Vector
4. THE Sync_Service SHALL process sync tasks asynchronously via a job queue
5. IF embedding generation fails, THEN THE Sync_Service SHALL retry up to 3 times with exponential backoff

### Requirement 5: 混合搜索路由

**User Story:** As a user, I want to choose between fast keyword search and semantic search, so that I can balance speed and relevance.

#### Acceptance Criteria

1. WHEN alpha = 0, THE Echo_API SHALL use PostgreSQL_Primary full-text search only
2. WHEN alpha = 1, THE Echo_API SHALL use SeekDB_Vector semantic search only
3. WHEN 0 < alpha < 1, THE Echo_API SHALL combine results from both databases
4. THE Echo_API SHALL default to alpha = 0 for fastest response
5. THE UI SHALL provide a toggle to enable semantic search mode

### Requirement 6: SeekDB 性能优化

**User Story:** As a user, I want semantic search to be as fast as possible, so that I don't have to wait too long.

#### Acceptance Criteria

1. THE SeekDB_Vector SHALL use connection pooling with minimum 3 idle connections
2. THE Echo_API SHALL cache query embeddings using LRU cache with 100 entry capacity
3. WHEN a cached query is received, THE Echo_API SHALL skip embedding generation
4. THE Echo_API SHALL set a 2-second timeout for embedding generation
5. IF embedding times out, THEN THE Echo_API SHALL fall back to PostgreSQL full-text search

### Requirement 7: 向量索引优化

**User Story:** As a user, I want semantic search to scale well as my document collection grows, so that performance remains acceptable.

#### Acceptance Criteria

1. THE SeekDB_Vector SHALL use HNSW index for approximate nearest neighbor search
2. THE HNSW index SHALL be configured with ef_construction = 128 and M = 16
3. THE SeekDB_Vector SHALL support batch embedding insertion for bulk imports
4. THE SeekDB_Vector SHALL provide index statistics via /metrics endpoint
5. WHEN document count exceeds 10,000, THE SeekDB_Vector SHALL still respond within 1 second

### Requirement 8: 健康检查与监控

**User Story:** As a developer, I want to monitor both databases, so that I can identify and fix issues quickly.

#### Acceptance Criteria

1. THE Echo_API SHALL expose /health endpoint checking both PostgreSQL_Primary and SeekDB_Vector
2. THE /health endpoint SHALL report individual status for each database
3. THE Echo_API SHALL expose /metrics endpoint with response times for both databases
4. THE /metrics endpoint SHALL include cache hit rate and sync queue depth
5. WHEN either database is unhealthy, THE Echo_API SHALL continue operating in degraded mode
