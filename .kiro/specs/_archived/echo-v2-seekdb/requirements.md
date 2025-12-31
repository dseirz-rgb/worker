# Requirements Document

## Introduction

本文档定义了 Echo v2.0 的核心需求，重点是引入 SeekDB 作为本地智能核心，实现多模态内容（笔记、视频、PPT）的统一检索能力。

Echo v2.0 采用"双核驱动"架构：
- **云端 Supabase**: 轻量级笔记同步
- **本地 SeekDB**: 向量搜索 + 全文搜索 + 结构化查询

参考文档:
- #[[file:echo/docs/ECHO_DEV_PLAN_V2.md]]
- #[[file:echo/docs/VISION_AND_ARCHITECTURE.md]]

## Glossary

- **SeekDB**: 本地向量数据库，支持向量搜索、全文搜索和结构化查询
- **Knowledge_Base**: SeekDB 中的核心表，存储所有可检索内容
- **Embedding**: 文本的向量表示，用于语义搜索
- **Chunking**: 将长文本切分为适合索引的小块
- **Sync_Worker**: 负责 Supabase → SeekDB 数据同步的 Python 脚本
- **File_Watcher**: 监听本地文件夹变化的服务
- **Video_Processor**: 使用 Whisper 提取视频语音的模块
- **PPT_Processor**: 使用 python-pptx 提取 PPT 文本的模块
- **Ingest_Manager**: 统一管理文件摄入的主控脚本
- **Hybrid_Search**: 结合向量相似度和全文匹配的混合搜索

## Requirements

### Requirement 1: SeekDB 基础设施

**User Story:** As a developer, I want to deploy SeekDB locally, so that I can store and search multi-modal content with vector and full-text capabilities.

#### Acceptance Criteria

1. THE Docker_Compose SHALL define SeekDB service with SQL port (3306) and HTTP port exposed
2. THE Docker_Compose SHALL define a Python worker container for running data processing scripts
3. THE Docker_Compose SHALL mount local data volume `./seekdb_data` for persistence
4. WHEN SeekDB starts, THE System SHALL create the knowledge_base table with required schema
5. THE Knowledge_Base table SHALL include fields: id, content, embedding (VECTOR 768), source_type, source_path, metadata (JSON), created_at, updated_at
6. THE Knowledge_Base table SHALL have fulltext index on content field

### Requirement 2: Supabase 笔记同步

**User Story:** As a user, I want my notes from Supabase to be automatically synced to local SeekDB, so that I can search them with vector capabilities.

#### Acceptance Criteria

1. WHEN Supabase notes table has INSERT event, THE Sync_Worker SHALL receive the new note via Realtime subscription
2. WHEN Supabase notes table has UPDATE event, THE Sync_Worker SHALL receive the updated note via Realtime subscription
3. WHEN Sync_Worker receives a note, THE Sync_Worker SHALL insert or update the content in SeekDB knowledge_base table
4. WHEN inserting content to SeekDB, THE System SHALL call AI_EMBED function to generate embedding vector
5. IF Supabase connection fails, THEN THE Sync_Worker SHALL retry with exponential backoff
6. IF Sync_Worker crashes, THEN THE System SHALL log the error and restart automatically
7. THE Sync_Worker SHALL store source_type as 'note' and source_path as Supabase note ID

### Requirement 3: 视频内容摄入

**User Story:** As a user, I want to drop video files into a folder and have the system automatically extract and index the speech content, so that I can search video content by keywords.

#### Acceptance Criteria

1. WHEN a .mp4 or .mkv file is added to import_folder, THE File_Watcher SHALL detect the new file
2. WHEN File_Watcher detects a video file, THE Video_Processor SHALL extract audio and transcribe using faster-whisper
3. THE Video_Processor SHALL use 'base' model for transcription
4. THE Video_Processor SHALL chunk transcription by 30 seconds or 200 characters, whichever comes first
5. WHEN Video_Processor completes, THE System SHALL return list of chunks with start_time, end_time, and text
6. WHEN chunks are ready, THE Ingest_Manager SHALL insert each chunk into SeekDB with source_type 'video'
7. THE metadata JSON SHALL include start_time, end_time, and original file path
8. IF video processing fails, THEN THE System SHALL log error and skip the file without crashing

### Requirement 4: PPT 内容摄入

**User Story:** As a user, I want to drop PPT files into a folder and have the system automatically extract and index the slide content, so that I can search presentation content.

#### Acceptance Criteria

1. WHEN a .pptx file is added to import_folder, THE File_Watcher SHALL detect the new file
2. WHEN File_Watcher detects a PPT file, THE PPT_Processor SHALL parse using python-pptx library
3. THE PPT_Processor SHALL extract title and body text from each slide
4. WHEN PPT_Processor completes, THE System SHALL return list of slides with page_number and text
5. WHEN slides are ready, THE Ingest_Manager SHALL insert each slide into SeekDB with source_type 'ppt'
6. THE metadata JSON SHALL include page_number, total_pages, and original file path
7. IF PPT processing fails, THEN THE System SHALL log error and skip the file without crashing

### Requirement 5: 统一文件监听

**User Story:** As a user, I want a single import folder that automatically processes any supported file type, so that I don't need to manually trigger imports.

#### Acceptance Criteria

1. THE File_Watcher SHALL use watchdog library to monitor ./import_folder directory
2. WHEN new file is detected, THE File_Watcher SHALL determine file type by extension
3. WHEN file is .mp4 or .mkv, THE File_Watcher SHALL route to Video_Processor
4. WHEN file is .pptx, THE File_Watcher SHALL route to PPT_Processor
5. WHEN file is .pdf, THE File_Watcher SHALL route to PDF_Processor (future)
6. THE File_Watcher SHALL run as a background daemon process
7. IF unsupported file type is detected, THEN THE System SHALL log warning and ignore the file

### Requirement 6: 混合搜索 API

**User Story:** As a user, I want to search all my content (notes, videos, PPTs) through a single API, so that I can find relevant information regardless of source type.

#### Acceptance Criteria

1. THE Search_API SHALL expose POST /search endpoint accepting JSON with query field
2. WHEN search request is received, THE Search_API SHALL execute hybrid search in SeekDB
3. THE Hybrid_Search SHALL combine vector similarity (<=>) and fulltext match (MATCH...AGAINST)
4. THE Hybrid_Search SHALL weight results by configurable alpha parameter (default 0.5)
5. THE Search_API SHALL return top 10 results sorted by weighted score
6. THE Search_API response SHALL include id, content snippet, source_type, metadata, and score
7. IF search query is empty, THEN THE Search_API SHALL return 400 error with message

### Requirement 7: 环境与配置管理

**User Story:** As a developer, I want clear environment configuration, so that I can easily set up and maintain the system.

#### Acceptance Criteria

1. THE System SHALL use .env file for all configuration (Supabase URL, API keys, SeekDB connection)
2. THE System SHALL provide .env.example with all required variables documented
3. THE Python scripts SHALL use venv for dependency isolation
4. THE System SHALL provide requirements.txt with all Python dependencies
5. THE Docker_Compose SHALL read environment variables from .env file
6. IF required environment variable is missing, THEN THE System SHALL fail fast with clear error message
