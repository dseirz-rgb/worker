# Requirements Document

## Introduction

Echo V3 功能增强，包括三个主要部分：
1. 视频/PPT 多模态处理集成到 UI
2. 向量搜索支持（Embedding）
3. Janitor 目录配置可视化

## Glossary

- **Janitor**: AI 驱动的文件整理服务，基于 LlamaFS
- **SeekDB**: 向量数据库，用于文档索引和搜索
- **Ingest_Manager**: 文件摄入管理器，处理视频/PPT 并写入 SeekDB
- **Embedding**: 文本向量化，用于语义搜索
- **Inbox_Directory**: Janitor 监控的源目录
- **Output_Directory**: Janitor 整理后的目标目录

## Requirements

### Requirement 1: 视频/PPT 处理集成

**User Story:** As a user, I want to upload videos and PPT files through the UI, so that they can be automatically processed and indexed for search.

#### Acceptance Criteria

1. WHEN a user uploads a video file (.mp4, .mkv, .avi, .mov, .webm), THE System SHALL extract audio and transcribe it using Whisper
2. WHEN a user uploads a PPT file (.pptx), THE System SHALL extract text content from each slide with page numbers
3. WHEN processing completes, THE System SHALL store the extracted content in SeekDB with timestamps (video) or page numbers (PPT)
4. WHEN a user searches for content, THE System SHALL return results with source type, file path, and position metadata
5. IF video processing fails, THEN THE System SHALL log the error and notify the user without crashing

### Requirement 2: 向量搜索支持

**User Story:** As a user, I want to search documents using semantic similarity, so that I can find relevant content even with different wording.

#### Acceptance Criteria

1. WHEN a document is indexed, THE System SHALL generate embedding vectors using a local model (Ollama) or API
2. WHEN a user performs a search, THE System SHALL combine full-text search with vector similarity search (hybrid search)
3. THE System SHALL allow configuring the alpha parameter (0-1) to balance text vs vector search weight
4. WHEN displaying search results, THE System SHALL show relevance scores and highlight matching content
5. IF embedding generation fails, THEN THE System SHALL fall back to full-text search only

### Requirement 3: Janitor 目录配置

**User Story:** As a user, I want to configure which directories Janitor monitors and where files are organized to, so that I can customize the file organization workflow.

#### Acceptance Criteria

1. THE System SHALL provide a UI to configure inbox directories (source folders to monitor)
2. THE System SHALL provide a UI to configure output base directory (where organized files go)
3. THE System SHALL provide a UI to configure category folders and their keywords
4. WHEN configuration is saved, THE System SHALL persist it and apply to Janitor service
5. THE System SHALL display current configuration status in the settings page
6. WHEN a user adds a new inbox directory, THE System SHALL validate the path exists
7. THE System SHALL support multiple inbox directories

### Requirement 4: 处理状态可视化

**User Story:** As a user, I want to see the processing status of my files, so that I know when they are ready for search.

#### Acceptance Criteria

1. WHEN a file is being processed, THE System SHALL show a progress indicator
2. THE System SHALL display a list of recently processed files with their status
3. WHEN processing completes, THE System SHALL show success notification
4. IF processing fails, THEN THE System SHALL show error details and retry option
5. THE System SHALL show processing queue length when multiple files are pending

### Requirement 6: 数据处理流程说明页面

**User Story:** As a user, I want to see a visual explanation of how my data is processed, so that I understand the system workflow and trust the process.

#### Acceptance Criteria

1. THE System SHALL display a data flow diagram showing the processing pipeline
2. THE System SHALL explain each processing stage (Janitor → SeekDB → Search)
3. THE System SHALL show the current status of each service component
4. THE System SHALL provide links to configure each component
5. THE System SHALL use visual icons and colors to make the flow easy to understand

### Requirement 5: 搜索结果增强

**User Story:** As a user, I want to preview video/PPT content directly from search results, so that I can quickly verify relevance.

#### Acceptance Criteria

1. WHEN a video search result is selected, THE System SHALL show a preview player starting at the matched timestamp
2. WHEN a PPT search result is selected, THE System SHALL show the matched slide thumbnail
3. THE System SHALL display source type icons (video/PPT/document) in search results
4. THE System SHALL allow filtering search results by source type
5. THE System SHALL show the matched text snippet with context
