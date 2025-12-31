# Requirements Document

## Introduction

将 SeekDB 作为 Paperless-ngx 的后端替代，保持前端 UI 不变。SeekDB 需要提供与 Paperless API 兼容的接口，支持文档管理、标签、文档类型等功能。

## Glossary

- **SeekDB**: OceanBase 的 AI 原生搜索数据库，支持向量搜索和全文搜索
- **Paperless_API**: 原 Paperless-ngx 的 REST API 接口格式
- **Document**: 文档实体，包含标题、内容、标签、文档类型等
- **Tag**: 标签实体，用于分类文档
- **Document_Type**: 文档类型实体，用于分类文档
- **tRPC_Router**: Blinko 的 tRPC 路由层，连接前端和后端

## Requirements

### Requirement 1: SeekDB 数据库结构扩展

**User Story:** As a developer, I want SeekDB to store documents with Paperless-compatible fields, so that the frontend can display documents correctly.

#### Acceptance Criteria

1. THE SeekDB_Database SHALL store documents with fields: id, title, content, created, modified, added, tags, document_type, original_file_name
2. THE SeekDB_Database SHALL store tags with fields: id, name, color
3. THE SeekDB_Database SHALL store document_types with fields: id, name
4. THE SeekDB_Database SHALL maintain foreign key relationships between documents and tags/document_types
5. THE SeekDB_Database SHALL support file storage for original documents and thumbnails

### Requirement 2: Paperless 兼容 API 端点

**User Story:** As a frontend developer, I want SeekDB to provide Paperless-compatible API endpoints, so that the existing frontend code works without modification.

#### Acceptance Criteria

1. WHEN a client requests GET /documents/ THEN THE SeekDB_API SHALL return paginated documents in Paperless format
2. WHEN a client requests GET /documents/{id}/ THEN THE SeekDB_API SHALL return a single document in Paperless format
3. WHEN a client requests POST /documents/post_document/ THEN THE SeekDB_API SHALL accept file upload and create a document
4. WHEN a client requests GET /documents/{id}/thumb/ THEN THE SeekDB_API SHALL return the document thumbnail
5. WHEN a client requests GET /documents/{id}/download/ THEN THE SeekDB_API SHALL return the original file
6. WHEN a client requests PATCH /documents/{id}/ THEN THE SeekDB_API SHALL update document metadata
7. WHEN a client requests DELETE /documents/{id}/ THEN THE SeekDB_API SHALL delete the document

### Requirement 3: 标签管理 API

**User Story:** As a user, I want to manage tags through the API, so that I can organize my documents.

#### Acceptance Criteria

1. WHEN a client requests GET /tags/ THEN THE SeekDB_API SHALL return all tags
2. WHEN a client requests POST /tags/ THEN THE SeekDB_API SHALL create a new tag
3. WHEN a client requests DELETE /tags/{id}/ THEN THE SeekDB_API SHALL delete the tag

### Requirement 4: 文档类型管理 API

**User Story:** As a user, I want to manage document types through the API, so that I can categorize my documents.

#### Acceptance Criteria

1. WHEN a client requests GET /document_types/ THEN THE SeekDB_API SHALL return all document types
2. WHEN a client requests POST /document_types/ THEN THE SeekDB_API SHALL create a new document type

### Requirement 5: SeekDB 客户端替换

**User Story:** As a developer, I want a SeekDB client that mimics the Paperless client interface, so that the tRPC router can switch backends easily.

#### Acceptance Criteria

1. THE SeekDB_Client SHALL implement the same interface as PaperlessClient
2. THE SeekDB_Client SHALL connect to SeekDB API instead of Paperless-ngx
3. THE SeekDB_Client SHALL handle errors in the same format as PaperlessClient

### Requirement 6: tRPC 路由切换

**User Story:** As a developer, I want the tRPC router to use SeekDB instead of Paperless, so that the frontend works with the new backend.

#### Acceptance Criteria

1. THE tRPC_Router SHALL use SeekDB_Client instead of PaperlessClient
2. THE tRPC_Router SHALL maintain the same API contract for the frontend
3. WHEN SeekDB is not available THEN THE tRPC_Router SHALL return appropriate error messages

### Requirement 7: 示例数据迁移

**User Story:** As a user, I want the existing mock data to be available in SeekDB, so that I can test the system immediately.

#### Acceptance Criteria

1. THE SeekDB_Database SHALL be initialized with sample tags matching MOCK_TAGS
2. THE SeekDB_Database SHALL be initialized with sample document_types matching MOCK_DOCUMENT_TYPES
3. THE SeekDB_Database SHALL be initialized with sample documents matching MOCK_DOCUMENTS
