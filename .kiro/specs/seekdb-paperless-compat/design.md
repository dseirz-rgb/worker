# Design Document: SeekDB Paperless 兼容层

## Overview

本设计将 SeekDB 扩展为 Paperless-ngx 的完全替代后端。通过在 SeekDB 上实现 Paperless 兼容的 API 接口，前端代码无需修改即可使用 SeekDB 作为文档管理后端。

### 核心设计原则

1. **API 兼容性**: SeekDB API 返回的数据格式与 Paperless-ngx 完全一致
2. **最小改动**: 只修改后端，前端代码保持不变
3. **渐进迁移**: 支持从 Mock 数据平滑过渡到 SeekDB

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (不变)                          │
│  files.tsx → FileSidebar → FileList → FilePreview           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   tRPC Router (paperless.ts)                 │
│  listDocuments, searchDocuments, getThumbnail, etc.         │
│                              │                               │
│                              ▼                               │
│                    SeekDBClient (新建)                       │
│  替换 PaperlessClient，实现相同接口                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   SeekDB API (server.py)                     │
│  /api/documents/  /api/tags/  /api/document_types/          │
│                              │                               │
│                              ▼                               │
│                    SeekDB Database                           │
│  documents, tags, document_types, document_tags             │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. SeekDB 数据库扩展 (init_db.sql)

```sql
-- 文档表 (Paperless 兼容)
CREATE TABLE documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    document_type_id INT,
    correspondent_id INT,
    archive_serial_number INT,
    original_file_name VARCHAR(255),
    archived_file_name VARCHAR(255),
    file_path VARCHAR(512),           -- 原始文件存储路径
    thumbnail_path VARCHAR(512),      -- 缩略图存储路径
    embedding VECTOR(384),            -- 向量嵌入
    FULLTEXT INDEX idx_content_fts (content) WITH PARSER ik
);

-- 标签表
CREATE TABLE tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#a6cee3',
    match_text VARCHAR(255) DEFAULT '',
    matching_algorithm INT DEFAULT 0,
    is_insensitive BOOLEAN DEFAULT TRUE
);

-- 文档类型表
CREATE TABLE document_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    match_text VARCHAR(255) DEFAULT '',
    matching_algorithm INT DEFAULT 0,
    is_insensitive BOOLEAN DEFAULT TRUE
);

-- 文档-标签关联表
CREATE TABLE document_tags (
    document_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (document_id, tag_id),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

### 2. SeekDB API 端点 (server.py)

```python
# Paperless 兼容的 API 端点

# 文档操作
GET  /api/documents/                    # 列表 (分页)
GET  /api/documents/{id}/               # 详情
POST /api/documents/post_document/      # 上传
GET  /api/documents/{id}/download/      # 下载原文件
GET  /api/documents/{id}/preview/       # 预览 (PDF)
GET  /api/documents/{id}/thumb/         # 缩略图
PATCH /api/documents/{id}/              # 更新
DELETE /api/documents/{id}/             # 删除

# 标签操作
GET  /api/tags/                         # 列表
POST /api/tags/                         # 创建
DELETE /api/tags/{id}/                  # 删除

# 文档类型操作
GET  /api/document_types/               # 列表
POST /api/document_types/               # 创建

# 通讯者操作 (简化实现)
GET  /api/correspondents/               # 列表 (返回空)
```

### 3. SeekDBClient (TypeScript)

```typescript
// get/blinko-main/server/lib/seekdbClient.ts

interface SeekDBConfig {
  baseUrl: string;  // 默认 http://localhost:8765
}

class SeekDBClient {
  // 实现与 PaperlessClient 相同的接口
  async listDocuments(params?: DocumentListParams): Promise<PaginatedResponse<PaperlessDocument>>
  async searchDocuments(query: string, params?: SearchParams): Promise<PaginatedResponse<PaperlessDocument>>
  async getDocument(id: number): Promise<PaperlessDocument>
  async uploadDocument(file: Buffer, filename: string, metadata?: UploadMetadata): Promise<{ task_id: string }>
  async downloadDocument(id: number): Promise<Buffer>
  async getDocumentPreview(id: number): Promise<Buffer>
  async getDocumentThumbnail(id: number): Promise<Buffer>
  async updateDocument(id: number, data: Partial<PaperlessDocument>): Promise<PaperlessDocument>
  async deleteDocument(id: number): Promise<void>
  async listTags(): Promise<PaperlessTag[]>
  async createTag(data: { name: string; color?: string }): Promise<PaperlessTag>
  async deleteTag(id: number): Promise<void>
  async listDocumentTypes(): Promise<PaperlessDocumentType[]>
  async createDocumentType(data: { name: string }): Promise<PaperlessDocumentType>
  async listCorrespondents(): Promise<PaperlessCorrespondent[]>
  async testConnection(): Promise<boolean>
}
```

## Data Models

### Paperless 文档格式 (API 响应)

```typescript
interface PaperlessDocument {
  id: number;
  title: string;
  content: string;
  created: string;           // ISO 8601
  modified: string;          // ISO 8601
  added: string;             // ISO 8601
  correspondent: number | null;
  document_type: number | null;
  tags: number[];            // 标签 ID 数组
  archive_serial_number: number | null;
  original_file_name: string;
  archived_file_name: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
```

### SeekDB 内部存储

```typescript
interface SeekDBDocument {
  id: number;
  title: string;
  content: string;
  created: Date;
  modified: Date;
  added: Date;
  document_type_id: number | null;
  correspondent_id: number | null;
  original_file_name: string;
  file_path: string;
  thumbnail_path: string;
  embedding: number[];  // 384 维向量
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 文档上传下载一致性 (Round-trip)

*For any* valid file uploaded to SeekDB, downloading the same document should return identical file content.

**Validates: Requirements 2.3, 2.5**

### Property 2: 文档列表格式兼容性

*For any* document stored in SeekDB, the API response format should match the Paperless document schema with all required fields present.

**Validates: Requirements 2.1, 2.2**

### Property 3: 标签 CRUD 一致性

*For any* tag created through the API, listing tags should include the new tag, and deleting it should remove it from the list.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 4: 文档类型 CRUD 一致性

*For any* document type created through the API, listing document types should include the new type.

**Validates: Requirements 4.1, 4.2**

### Property 5: 文档更新持久性

*For any* document, updating its metadata (title, tags, document_type) should persist the changes and be reflected in subsequent queries.

**Validates: Requirements 2.6**

### Property 6: 文档删除完整性

*For any* document, deleting it should make it unavailable through all API endpoints (list, get, download, thumbnail).

**Validates: Requirements 2.7**

### Property 7: 客户端接口兼容性

*For any* method in PaperlessClient, SeekDBClient should have a corresponding method with the same signature and return type.

**Validates: Requirements 5.1, 5.3**

## Error Handling

### API 错误响应格式

```python
class APIError(BaseModel):
    detail: str
    status_code: int

# HTTP 状态码映射
400 - Bad Request (参数错误)
401 - Unauthorized (认证失败)
404 - Not Found (资源不存在)
500 - Internal Server Error (服务器错误)
503 - Service Unavailable (数据库连接失败)
```

### 客户端错误处理

```typescript
class SeekDBError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SeekDBError';
  }
}
```

## Testing Strategy

### 单元测试

- SeekDB API 端点测试 (pytest + httpx)
- SeekDBClient 方法测试 (vitest)
- 数据格式转换测试

### 属性测试 (Property-Based Testing)

使用 `fast-check` (TypeScript) 和 `hypothesis` (Python) 进行属性测试：

- **Property 1**: 文件上传下载一致性
- **Property 2**: 文档列表格式验证
- **Property 3-4**: CRUD 操作一致性
- **Property 5-6**: 更新和删除操作验证
- **Property 7**: 接口兼容性验证

### 集成测试

- 前端 → tRPC → SeekDBClient → SeekDB API → Database 全链路测试
- Mock 数据初始化验证
