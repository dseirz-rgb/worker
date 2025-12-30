# Requirements Document

## Introduction

本功能将 Echo 应用的本地数据库从 SQLite 升级为 SeekDB，实现 AI 原生搜索能力。SeekDB 是 OceanBase 开源的 AI 原生搜索数据库，统一支持向量搜索、全文搜索和关系型查询，可以在单条查询中同时完成语义搜索和关键词匹配，大幅提升 AI 助手的记忆检索能力。

## Glossary

- **SeekDB**: OceanBase 开源的 AI 原生搜索数据库，支持向量+全文+关系型统一存储
- **Collection**: SeekDB 中的数据集合，类似于数据库表
- **Embedding**: 将文本转换为向量表示的过程
- **Vector_Search**: 基于向量相似度的语义搜索
- **Fulltext_Search**: 基于关键词的全文搜索
- **Hybrid_Search**: 同时使用向量搜索和全文搜索的混合查询
- **Database_Service**: 封装数据库操作的服务层
- **Memory_Service**: AI 记忆管理服务，负责记忆的存储和检索
- **Sidecar**: Tauri 应用中运行的独立进程，用于执行 Python 脚本

## Requirements

### Requirement 1: SeekDB 集成架构

**User Story:** As a developer, I want to integrate SeekDB into the Echo application, so that I can leverage AI-native search capabilities for better memory retrieval.

#### Acceptance Criteria

1. THE Database_Service SHALL support SeekDB as the primary storage engine through Python Sidecar
2. WHEN the application starts, THE Database_Service SHALL initialize SeekDB connection in embedded mode
3. THE Database_Service SHALL create collections for notes, tasks, reminders, and memories
4. IF SeekDB initialization fails, THEN THE Database_Service SHALL log the error and provide fallback behavior
5. WHEN the application closes, THE Database_Service SHALL properly close SeekDB connections

### Requirement 2: 数据模型迁移

**User Story:** As a user, I want my existing data to be preserved when upgrading to SeekDB, so that I don't lose any notes, tasks, or memories.

#### Acceptance Criteria

1. THE Database_Service SHALL define SeekDB collections matching existing data models (Note, Task, Reminder, Memory)
2. WHEN migrating data, THE Database_Service SHALL preserve all existing records with their original IDs
3. THE Database_Service SHALL automatically generate embeddings for text content during migration
4. IF migration encounters an error, THEN THE Database_Service SHALL rollback changes and report the error
5. WHEN migration completes, THE Database_Service SHALL verify data integrity by comparing record counts

### Requirement 3: 向量搜索能力

**User Story:** As a user, I want to search my notes and memories using natural language, so that I can find relevant information even when I don't remember exact keywords.

#### Acceptance Criteria

1. WHEN a user performs a search query, THE Search_Service SHALL generate an embedding for the query text
2. THE Search_Service SHALL perform vector similarity search across relevant collections
3. WHEN returning search results, THE Search_Service SHALL include relevance scores (distances)
4. THE Search_Service SHALL support filtering results by domain, type, or date range
5. WHEN no results match the query, THE Search_Service SHALL return an empty result set

### Requirement 4: 混合搜索能力

**User Story:** As a user, I want search to combine semantic understanding with keyword matching, so that I get the most relevant results.

#### Acceptance Criteria

1. THE Search_Service SHALL support hybrid search combining vector and fulltext search
2. WHEN performing hybrid search, THE Search_Service SHALL merge results from both search methods
3. THE Search_Service SHALL rank results by combined relevance score
4. WHEN a search query contains specific keywords, THE Search_Service SHALL boost exact matches
5. THE Search_Service SHALL allow configuring the balance between vector and fulltext search weights

### Requirement 5: 自动 Embedding 生成

**User Story:** As a user, I want my content to be automatically indexed for semantic search, so that I don't need to manually tag or categorize everything.

#### Acceptance Criteria

1. WHEN a new note is created, THE Database_Service SHALL automatically generate and store its embedding
2. WHEN a note is updated, THE Database_Service SHALL regenerate its embedding
3. WHEN a task is created or updated, THE Database_Service SHALL generate embedding from title and description
4. THE Database_Service SHALL use SeekDB's DefaultEmbeddingFunction for consistent 384-dimensional vectors
5. IF embedding generation fails, THEN THE Database_Service SHALL store the record without embedding and log a warning

### Requirement 6: Memory 服务升级

**User Story:** As a user, I want the AI assistant to have better memory recall, so that it can provide more contextually relevant responses.

#### Acceptance Criteria

1. THE Memory_Service SHALL use SeekDB for storing and retrieving AI memories
2. WHEN searching memories, THE Memory_Service SHALL use vector search for semantic matching
3. THE Memory_Service SHALL support retrieving memories by relevance to a given context
4. WHEN the AI assistant needs context, THE Memory_Service SHALL return the top N most relevant memories
5. THE Memory_Service SHALL support memory categorization and domain filtering

### Requirement 7: Python Sidecar 服务

**User Story:** As a developer, I want a reliable Python sidecar service for SeekDB operations, so that the Tauri frontend can access SeekDB functionality.

#### Acceptance Criteria

1. THE Sidecar_Service SHALL run as a FastAPI server on a local port
2. WHEN the Tauri application starts, THE Sidecar_Service SHALL be automatically launched
3. THE Sidecar_Service SHALL expose REST endpoints for all database operations
4. IF the Sidecar_Service crashes, THEN THE Tauri application SHALL attempt to restart it
5. WHEN the Tauri application closes, THE Sidecar_Service SHALL be gracefully terminated
6. THE Sidecar_Service SHALL handle concurrent requests safely

### Requirement 8: 数据持久化与备份

**User Story:** As a user, I want my data to be safely stored and recoverable, so that I don't lose important information.

#### Acceptance Criteria

1. THE Database_Service SHALL store all data in a local SeekDB database file
2. WHEN data is modified, THE Database_Service SHALL persist changes immediately
3. THE Database_Service SHALL support exporting data to JSON format for backup
4. THE Database_Service SHALL support importing data from JSON backup files
5. IF data corruption is detected, THEN THE Database_Service SHALL attempt recovery from the last valid state
