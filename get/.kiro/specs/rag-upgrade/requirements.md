ok# Requirements Document

## Introduction

本文档定义了投资组合管理系统 RAG（Retrieval-Augmented Generation）服务的全面升级需求。升级目标是解决当前系统的三个核心问题：
1. 知识库页面加载缓慢（书籍分块导致）
2. AI 对结构化数据（持仓、交易）的理解不准确
3. 知识库检索不完整、不可靠

升级将采用双轨架构：LightRAG 处理非结构化知识，优化的上下文格式处理结构化数据。

## Glossary

- **RAG_Service**: 负责从数据源检索相关信息并构建 AI 上下文的服务模块
- **LightRAG**: 基于知识图谱的开源 RAG 框架，支持实体关系抽取和双层检索
- **Knowledge_Base**: 存储非结构化文档（书籍、文章、笔记）的知识库
- **Structured_Data**: 结构化投资数据，包括持仓、交易、风险指标等
- **Context_Builder**: 将检索结果格式化为 AI 可理解上下文的组件
- **Document_Chunk**: 文档切片，将长文档分割成的小段落
- **Entity**: LightRAG 从文档中提取的实体（如公司名、概念、人物）
- **Relation**: LightRAG 提取的实体间关系

## Requirements

### Requirement 1: 知识库页面性能优化

**User Story:** As a user, I want the knowledge base page to load quickly, so that I can browse and manage my documents without waiting.

#### Acceptance Criteria

1. WHEN the Knowledge_Base page loads, THE System SHALL display document metadata within 500ms
2. WHEN displaying book collections, THE System SHALL show aggregated book entries instead of individual chunks
3. THE System SHALL NOT load embedding vectors when displaying document lists
4. WHEN a user clicks on a book, THE System SHALL load chunk details on demand
5. WHEN the Knowledge_Base contains more than 100 documents, THE System SHALL implement pagination with 20 items per page

### Requirement 2: LightRAG 服务集成

**User Story:** As a user, I want the AI to understand relationships between concepts in my knowledge base, so that I can get more comprehensive answers to complex questions.

#### Acceptance Criteria

1. THE System SHALL deploy a LightRAG Python service as the knowledge retrieval backend
2. WHEN a document is added to Knowledge_Base, THE LightRAG_Service SHALL extract entities and relations and update the knowledge graph
3. WHEN a user queries the AI, THE LightRAG_Service SHALL perform dual-level retrieval (low-level entities + high-level relations)
4. THE System SHALL support incremental updates to the knowledge graph without full reprocessing
5. WHEN LightRAG_Service is unavailable, THE System SHALL fallback to existing vector search

### Requirement 3: 结构化数据上下文优化

**User Story:** As a user, I want the AI to accurately understand my portfolio positions and transactions, so that I can get reliable investment insights.

#### Acceptance Criteria

1. WHEN building AI context, THE Context_Builder SHALL format Structured_Data using JSON with explicit field names
2. THE Context_Builder SHALL include a portfolio summary section with total net worth, position count, and cash ratio
3. WHEN presenting position data, THE Context_Builder SHALL clearly separate currency units (USD price vs CNY market value)
4. THE Context_Builder SHALL format each position as a structured object with labeled fields
5. WHEN the portfolio has more than 20 positions, THE Context_Builder SHALL include top 20 by market value plus a summary of remaining positions

### Requirement 4: 数据迁移与兼容

**User Story:** As a system administrator, I want existing knowledge base data to be migrated to the new system, so that no information is lost during the upgrade.

#### Acceptance Criteria

1. THE System SHALL provide a migration script to export existing documents from Supabase
2. THE Migration_Script SHALL re-index all documents into LightRAG knowledge graph
3. WHEN migration completes, THE System SHALL verify document count matches between old and new systems
4. THE System SHALL maintain backward compatibility with existing document upload workflows
5. IF migration fails for any document, THEN THE System SHALL log the error and continue with remaining documents

### Requirement 5: 混合检索架构

**User Story:** As a user, I want the AI to combine knowledge from both my documents and my portfolio data, so that I can get contextually relevant answers.

#### Acceptance Criteria

1. WHEN a user query is received, THE RAG_Service SHALL determine if it requires Structured_Data, Knowledge_Base, or both
2. THE RAG_Service SHALL merge results from LightRAG and Structured_Data into a unified context
3. WHEN merging results, THE Context_Builder SHALL clearly label the source of each piece of information
4. THE System SHALL prioritize Structured_Data for queries about specific positions or transactions
5. THE System SHALL prioritize Knowledge_Base for queries about investment concepts or strategies

### Requirement 6: 前端知识库管理优化

**User Story:** As a user, I want to manage my knowledge base with a clean interface that shows books as single entries, so that I can easily organize my documents.

#### Acceptance Criteria

1. WHEN displaying uploaded books, THE UI SHALL show one entry per book with chunk count
2. THE UI SHALL allow expanding a book to view its chapters/chunks
3. WHEN deleting a book, THE System SHALL remove all associated chunks in one operation
4. THE UI SHALL display document source type with appropriate icons (book, article, chat)
5. WHEN searching documents, THE System SHALL search across all chunks but display results grouped by parent document

### Requirement 7: 错误处理与监控

**User Story:** As a system administrator, I want to monitor RAG service health and errors, so that I can ensure reliable operation.

#### Acceptance Criteria

1. WHEN LightRAG_Service encounters an error, THE System SHALL log the error with query context
2. THE System SHALL expose a health check endpoint for LightRAG_Service
3. WHEN retrieval latency exceeds 3 seconds, THE System SHALL log a warning
4. IF LightRAG_Service fails, THEN THE System SHALL return a graceful error message to the user
5. THE System SHALL track and log retrieval accuracy metrics for future optimization
