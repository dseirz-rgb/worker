# Design Document: Google Drive Sync

## Overview

实现 Google Drive 到投资知识库的自动同步功能。使用 Service Account 认证，通过 Change Token 实现增量同步，支持多种文件类型（TXT/PDF/Markdown/Google Sheets/Excel）的解析和向量化。

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Echo Server                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  Scheduler      │───▶│ DriveSyncService │                    │
│  │  (node-schedule)│    │                  │                    │
│  └─────────────────┘    └────────┬─────────┘                    │
│                                  │                               │
│         ┌────────────────────────┼────────────────────────┐     │
│         ▼                        ▼                        ▼     │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │ FileParser  │    │ EmbeddingService │    │ Investment DB   │ │
│  │ (PDF/TXT/MD)│    │ (Gemini API)     │    │ (Supabase)      │ │
│  └─────────────┘    └─────────────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Google Drive   │
                    │  API            │
                    └─────────────────┘
```

## Components and Interfaces

### 1. DriveSyncService

核心同步服务，负责协调整个同步流程。

```typescript
interface DriveSyncService {
  // 初始化服务（认证、加载 change token）
  initialize(): Promise<void>;
  
  // 执行同步
  sync(): Promise<SyncResult>;
  
  // 获取同步状态
  getStatus(): SyncStatus;
  
  // 手动触发同步
  triggerSync(): Promise<SyncResult>;
}

interface SyncStatus {
  state: 'idle' | 'syncing' | 'error';
  lastSyncTime: Date | null;
  lastError: string | null;
  stats: SyncStats;
}

interface SyncStats {
  filesProcessed: number;
  filesAdded: number;
  filesUpdated: number;
  filesDeleted: number;
  errors: number;
  duration: number;
}

interface SyncResult {
  success: boolean;
  stats: SyncStats;
  errors: SyncError[];
}

interface SyncError {
  fileId: string;
  fileName: string;
  error: string;
}
```

### 2. GoogleDriveClient

封装 Google Drive API 调用。

```typescript
interface GoogleDriveClient {
  // 认证
  authenticate(): Promise<void>;
  
  // 获取文件变更列表
  getChanges(pageToken?: string): Promise<DriveChanges>;
  
  // 获取文件内容
  getFileContent(fileId: string): Promise<Buffer>;
  
  // 导出 Google Sheets 为文本
  exportSheet(fileId: string): Promise<string>;
  
  // 获取文件元数据
  getFileMetadata(fileId: string): Promise<DriveFile>;
}

interface DriveChanges {
  changes: DriveChange[];
  newStartPageToken: string;
}

interface DriveChange {
  type: 'file';
  fileId: string;
  removed: boolean;
  file?: DriveFile;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: number;
}
```

### 3. FileParser

文件解析器，支持多种格式。

```typescript
interface FileParser {
  // 解析文件内容为文本
  parse(content: Buffer, mimeType: string, fileName: string): Promise<ParsedContent>;
}

interface ParsedContent {
  text: string;
  metadata: Record<string, unknown>;
  sourceType: NoteSourceType;
}

// 支持的 MIME 类型
const SUPPORTED_MIME_TYPES = {
  'text/plain': 'txt',
  'text/markdown': 'markdown',
  'application/pdf': 'pdf',
  'application/vnd.google-apps.spreadsheet': 'google_sheets',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
};
```

### 4. SyncStateManager

管理同步状态和 Change Token 持久化。

```typescript
interface SyncStateManager {
  // 获取 change token
  getChangeToken(): Promise<string | null>;
  
  // 保存 change token
  saveChangeToken(token: string): Promise<void>;
  
  // 获取文件同步记录
  getFileSyncRecord(fileId: string): Promise<FileSyncRecord | null>;
  
  // 保存文件同步记录
  saveFileSyncRecord(record: FileSyncRecord): Promise<void>;
  
  // 删除文件同步记录
  deleteFileSyncRecord(fileId: string): Promise<void>;
}

interface FileSyncRecord {
  fileId: string;
  fileName: string;
  modifiedTime: string;
  documentIds: number[];  // 对应的 documents 表 ID
}
```

## Data Models

### documents 表扩展

```sql
-- 已有字段
id, user_id, title, content, tags, source_type, embedding, metadata, created_at, updated_at

-- 新增 source_type 值
-- 'uploaded_file' - 书籍文件 (TXT/PDF/Markdown)
-- 'strategy_sheet' - Google Sheets 投资策略
-- 'financial_model' - Excel 财务模型

-- metadata 字段存储
{
  "drive_file_id": "xxx",      -- Google Drive 文件 ID
  "original_filename": "xxx",   -- 原始文件名
  "mime_type": "xxx",          -- MIME 类型
  "modified_time": "xxx",      -- Drive 文件修改时间
  "part_index": 1,             -- 分片索引（书籍）
  "total_parts": 10            -- 总分片数（书籍）
}
```

### sync_state 表（新建）

```sql
CREATE TABLE IF NOT EXISTS sync_state (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 存储 change token
INSERT INTO sync_state (key, value) VALUES ('drive_change_token', 'xxx');
```

### file_sync_records 表（新建）

```sql
CREATE TABLE IF NOT EXISTS file_sync_records (
  id SERIAL PRIMARY KEY,
  file_id VARCHAR(255) UNIQUE NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  modified_time TIMESTAMP NOT NULL,
  document_ids INTEGER[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Source Type Assignment

*For any* file processed by the sync service, the resulting document(s) SHALL have the correct source_type based on file type:
- TXT/PDF/Markdown → 'uploaded_file'
- Google Sheets → 'strategy_sheet'
- Excel → 'financial_model'

**Validates: Requirements 3.5, 4.3, 5.3**

### Property 2: Text Chunking Consistency

*For any* text content, chunking then concatenating (with overlap removed) SHALL produce content equivalent to the original text.

**Validates: Requirements 3.1, 3.3**

### Property 3: Change Token Persistence Round-Trip

*For any* valid change token, saving then loading SHALL return the same token value.

**Validates: Requirements 2.1, 2.5**

### Property 4: Filename to Title Mapping

*For any* filename, the generated document title prefix SHALL equal the filename without extension.

**Validates: Requirements 3.6**

### Property 5: Concurrent Sync Prevention

*For any* sync operation in progress, subsequent sync requests SHALL be skipped (not queued or executed).

**Validates: Requirements 6.4**

### Property 6: Graceful Error Handling

*For any* batch of files where some fail to process, the sync SHALL continue processing remaining files and report all errors.

**Validates: Requirements 7.2**

### Property 7: Table Structure Preservation

*For any* spreadsheet data, the text conversion SHALL preserve row/column relationships in a parseable format.

**Validates: Requirements 4.2, 5.2**

### Property 8: Numerical Precision

*For any* numerical value in Excel files, the parsed value SHALL match the original within floating-point precision limits.

**Validates: Requirements 5.4**

## Error Handling

### 认证错误
- 缺少 Service Account 凭证 → 记录错误，禁用同步功能
- 凭证过期 → 自动刷新 token
- 权限不足 → 记录错误，通知管理员

### API 错误
- 429 Rate Limit → 指数退避重试（1s, 2s, 4s, 8s, max 60s）
- 500 Server Error → 重试 3 次后跳过
- 404 Not Found → 标记文件为已删除

### 文件处理错误
- 解析失败 → 记录错误，跳过该文件，继续处理其他文件
- 嵌入生成失败 → 重试 2 次后跳过
- 数据库写入失败 → 回滚该文件的所有更改

## Testing Strategy

### Unit Tests
- FileParser: 各种文件格式的解析
- SyncStateManager: Change Token 持久化
- GoogleDriveClient: API 调用 mock 测试

### Property-Based Tests
- 使用 fast-check 生成随机文本测试 chunking
- 使用 fast-check 生成随机文件名测试 title 映射
- 使用 fast-check 生成随机数值测试精度保持

### Integration Tests
- 完整同步流程（使用 mock Drive API）
- 数据库读写
- 前端状态更新

### 测试配置
- Property tests: 最少 100 次迭代
- 测试标签格式: **Feature: google-drive-sync, Property N: {property_text}**
