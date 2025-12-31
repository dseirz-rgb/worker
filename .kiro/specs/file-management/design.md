# Design Document - File Management

## Overview

文件管理功能通过集成 Paperless-ngx 开源项目，为 Echo 提供文件存储、OCR 识别、全文搜索和 AI 分类能力。

### 设计原则

1. **独立部署** - Paperless-ngx 作为独立 Docker 服务运行
2. **API 代理** - Echo 后端代理所有 Paperless-ngx API 调用
3. **统一体验** - 前端使用 Echo 现有 UI 组件，保持视觉一致
4. **渐进增强** - 先实现核心功能，再添加 AI 增强

### 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Echo 应用                                │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React)                                               │
│  ├── /files - 文件管理页面                                       │
│  │   ├── FileUpload - 文件上传组件                               │
│  │   ├── FileList - 文件列表组件                                 │
│  │   ├── FilePreview - 文件预览组件                              │
│  │   └── FileSearch - 搜索组件                                   │
│  └── /settings - 配置页面 (Paperless 连接设置)                   │
├─────────────────────────────────────────────────────────────────┤
│  Backend (tRPC)                                                 │
│  └── server/routerTrpc/paperless.ts                             │
│      ├── documents.list - 获取文档列表                           │
│      ├── documents.search - 搜索文档                             │
│      ├── documents.upload - 上传文档                             │
│      ├── documents.get - 获取文档详情                            │
│      ├── documents.download - 下载文档                           │
│      ├── documents.preview - 获取预览                            │
│      ├── tags.list - 获取标签列表                                │
│      ├── tags.create - 创建标签                                  │
│      ├── documentTypes.list - 获取文档类型                       │
│      └── config.test - 测试连接                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Paperless-ngx (Docker)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Web UI   │  │ REST API │  │ Consumer │  │ Scheduler│       │
│  │ (可选)   │  │ :8000    │  │ (OCR)    │  │ (任务)   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │   PostgreSQL     │  │      Redis       │                    │
│  │   (文档数据)     │  │   (任务队列)     │                    │
│  └──────────────────┘  └──────────────────┘                    │
├─────────────────────────────────────────────────────────────────┤
│  Volumes:                                                       │
│  ├── /data - 原始文档存储                                        │
│  ├── /media - 处理后的文档                                       │
│  └── /export - 导出目录                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Designs

### Component 1: Docker Compose 配置

**对应需求**: Requirement 1 (Paperless-ngx 部署)

#### 配置文件

```yaml
# echo/docker-compose.paperless.yml

version: '3.8'

services:
  paperless-broker:
    image: redis:7
    container_name: echo-paperless-broker
    restart: unless-stopped
    volumes:
      - paperless_redis:/data
    networks:
      - echo-network

  paperless-db:
    image: postgres:15
    container_name: echo-paperless-db
    restart: unless-stopped
    volumes:
      - paperless_pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: paperless
      POSTGRES_USER: paperless
      POSTGRES_PASSWORD: ${PAPERLESS_DB_PASSWORD:-paperless}
    networks:
      - echo-network

  paperless:
    image: ghcr.io/paperless-ngx/paperless-ngx:latest
    container_name: echo-paperless
    restart: unless-stopped
    depends_on:
      - paperless-db
      - paperless-broker
    ports:
      - "${PAPERLESS_PORT:-8000}:8000"
    volumes:
      - paperless_data:/usr/src/paperless/data
      - paperless_media:/usr/src/paperless/media
      - paperless_export:/usr/src/paperless/export
      - paperless_consume:/usr/src/paperless/consume
    environment:
      PAPERLESS_REDIS: redis://paperless-broker:6379
      PAPERLESS_DBHOST: paperless-db
      PAPERLESS_DBNAME: paperless
      PAPERLESS_DBUSER: paperless
      PAPERLESS_DBPASS: ${PAPERLESS_DB_PASSWORD:-paperless}
      PAPERLESS_SECRET_KEY: ${PAPERLESS_SECRET_KEY:-change-me-in-production}
      PAPERLESS_TIME_ZONE: Asia/Shanghai
      PAPERLESS_OCR_LANGUAGE: chi_sim+eng
      PAPERLESS_ADMIN_USER: ${PAPERLESS_ADMIN_USER:-admin}
      PAPERLESS_ADMIN_PASSWORD: ${PAPERLESS_ADMIN_PASSWORD:-admin}
      PAPERLESS_URL: ${PAPERLESS_URL:-http://localhost:8000}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000"]
      interval: 30s
      timeout: 10s
      retries: 5
    networks:
      - echo-network

volumes:
  paperless_redis:
  paperless_pgdata:
  paperless_data:
  paperless_media:
  paperless_export:
  paperless_consume:

networks:
  echo-network:
    external: true
```

---

### Component 2: Paperless API 代理服务

**对应需求**: Requirement 8 (API 代理服务)

#### 接口设计

```typescript
// server/lib/paperlessClient.ts

export interface PaperlessConfig {
  baseUrl: string;
  apiToken: string;
}

export interface PaperlessDocument {
  id: number;
  title: string;
  content: string;
  created: string;
  modified: string;
  added: string;
  correspondent: number | null;
  document_type: number | null;
  tags: number[];
  archive_serial_number: number | null;
  original_file_name: string;
  archived_file_name: string;
}

export interface PaperlessTag {
  id: number;
  name: string;
  color: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
}

export interface PaperlessDocumentType {
  id: number;
  name: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
}

export interface SearchResult {
  count: number;
  next: string | null;
  previous: string | null;
  results: PaperlessDocument[];
}

export class PaperlessClient {
  constructor(private config: PaperlessConfig) {}

  // 文档操作
  async listDocuments(params?: {
    page?: number;
    page_size?: number;
    ordering?: string;
    tags__id__in?: number[];
    document_type__id?: number;
  }): Promise<SearchResult>;

  async searchDocuments(query: string, params?: {
    page?: number;
    page_size?: number;
  }): Promise<SearchResult>;

  async getDocument(id: number): Promise<PaperlessDocument>;

  async uploadDocument(file: Buffer, filename: string, metadata?: {
    title?: string;
    correspondent?: number;
    document_type?: number;
    tags?: number[];
  }): Promise<{ task_id: string }>;

  async downloadDocument(id: number): Promise<Buffer>;

  async getDocumentPreview(id: number): Promise<Buffer>;

  async updateDocument(id: number, data: Partial<PaperlessDocument>): Promise<PaperlessDocument>;

  async deleteDocument(id: number): Promise<void>;

  // 标签操作
  async listTags(): Promise<PaperlessTag[]>;

  async createTag(data: { name: string; color?: string }): Promise<PaperlessTag>;

  async deleteTag(id: number): Promise<void>;

  // 文档类型操作
  async listDocumentTypes(): Promise<PaperlessDocumentType[]>;

  async createDocumentType(data: { name: string }): Promise<PaperlessDocumentType>;

  // 连接测试
  async testConnection(): Promise<boolean>;
}
```

---

### Component 3: tRPC 路由

**对应需求**: Requirement 2-7, 8

#### 路由设计

```typescript
// server/routerTrpc/paperless.ts

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { PaperlessClient } from '../lib/paperlessClient';

export const paperlessRouter = router({
  // 文档列表
  listDocuments: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      ordering: z.string().optional(),
      tagIds: z.array(z.number()).optional(),
      documentTypeId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const client = await getPaperlessClient(ctx.id);
      return client.listDocuments({
        page: input.page,
        page_size: input.pageSize,
        ordering: input.ordering,
        tags__id__in: input.tagIds,
        document_type__id: input.documentTypeId,
      });
    }),

  // 搜索文档
  searchDocuments: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const client = await getPaperlessClient(ctx.id);
      return client.searchDocuments(input.query, {
        page: input.page,
        page_size: input.pageSize,
      });
    }),

  // 获取文档详情
  getDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const client = await getPaperlessClient(ctx.id);
      return client.getDocument(input.id);
    }),

  // 上传文档
  uploadDocument: protectedProcedure
    .input(z.object({
      fileBase64: z.string(),
      filename: z.string(),
      title: z.string().optional(),
      documentTypeId: z.number().optional(),
      tagIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await getPaperlessClient(ctx.id);
      const buffer = Buffer.from(input.fileBase64, 'base64');
      return client.uploadDocument(buffer, input.filename, {
        title: input.title,
        document_type: input.documentTypeId,
        tags: input.tagIds,
      });
    }),

  // 下载文档
  downloadDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const client = await getPaperlessClient(ctx.id);
      const buffer = await client.downloadDocument(input.id);
      return buffer.toString('base64');
    }),

  // 获取预览
  getPreview: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const client = await getPaperlessClient(ctx.id);
      const buffer = await client.getDocumentPreview(input.id);
      return buffer.toString('base64');
    }),

  // 更新文档
  updateDocument: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      tagIds: z.array(z.number()).optional(),
      documentTypeId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await getPaperlessClient(ctx.id);
      return client.updateDocument(input.id, {
        title: input.title,
        tags: input.tagIds,
        document_type: input.documentTypeId,
      });
    }),

  // 删除文档
  deleteDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const client = await getPaperlessClient(ctx.id);
      await client.deleteDocument(input.id);
      return { success: true };
    }),

  // 标签列表
  listTags: protectedProcedure
    .query(async ({ ctx }) => {
      const client = await getPaperlessClient(ctx.id);
      return client.listTags();
    }),

  // 创建标签
  createTag: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      color: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await getPaperlessClient(ctx.id);
      return client.createTag(input);
    }),

  // 文档类型列表
  listDocumentTypes: protectedProcedure
    .query(async ({ ctx }) => {
      const client = await getPaperlessClient(ctx.id);
      return client.listDocumentTypes();
    }),

  // 测试连接
  testConnection: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const client = await getPaperlessClient(ctx.id);
        const result = await client.testConnection();
        return { success: result, error: null };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }),
});

// 辅助函数：获取用户的 Paperless 客户端
async function getPaperlessClient(accountId: number): Promise<PaperlessClient> {
  const config = await prisma.config.findFirst({
    where: { accountId, key: 'paperless' },
  });
  
  if (!config?.value) {
    throw new Error('Paperless-ngx not configured. Please configure in Settings.');
  }
  
  const { baseUrl, apiToken } = config.value as { baseUrl: string; apiToken: string };
  return new PaperlessClient({ baseUrl, apiToken });
}
```

---

### Component 4: 文件管理页面

**对应需求**: Requirement 2-7, 9

#### 页面结构

```typescript
// app/src/pages/files.tsx

export default function FilesPage() {
  return (
    <div className="flex h-full">
      {/* 左侧边栏：标签和文档类型过滤 */}
      <FileSidebar />
      
      {/* 主内容区 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部：搜索和上传 */}
        <FileToolbar />
        
        {/* 文档列表 */}
        <FileList />
      </div>
      
      {/* 预览模态框 */}
      <FilePreviewModal />
    </div>
  );
}
```

#### 组件设计

```typescript
// app/src/components/Files/FileSidebar.tsx
interface FileSidebarProps {
  tags: PaperlessTag[];
  documentTypes: PaperlessDocumentType[];
  selectedTagIds: number[];
  selectedDocumentTypeId?: number;
  onTagSelect: (tagIds: number[]) => void;
  onDocumentTypeSelect: (typeId?: number) => void;
}

// app/src/components/Files/FileToolbar.tsx
interface FileToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onUploadClick: () => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
}

// app/src/components/Files/FileList.tsx
interface FileListProps {
  documents: PaperlessDocument[];
  isLoading: boolean;
  onDocumentClick: (doc: PaperlessDocument) => void;
  onDocumentDelete: (id: number) => void;
}

// app/src/components/Files/FileUpload.tsx
interface FileUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

// app/src/components/Files/FilePreview.tsx
interface FilePreviewProps {
  document: PaperlessDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
  onTagsChange: (tagIds: number[]) => void;
}
```

---

### Component 5: 配置存储

**对应需求**: Requirement 10 (配置管理)

#### 数据模型

Blinko 已有 `config` 表，我们复用它存储 Paperless 配置：

```typescript
// 配置 key: 'paperless'
// 配置 value 结构:
interface PaperlessConfigValue {
  baseUrl: string;      // e.g., 'http://localhost:8000'
  apiToken: string;     // Paperless-ngx API token
  enabled: boolean;     // 是否启用
}
```

#### 设置页面扩展

```typescript
// 在 Blinko 设置页面添加 Paperless 配置区域
// app/src/pages/settings.tsx 中添加

<SettingsSection title="文件管理">
  <Input
    label="Paperless-ngx URL"
    placeholder="http://localhost:8000"
    value={paperlessUrl}
    onChange={setPaperlessUrl}
  />
  <Input
    label="API Token"
    type="password"
    placeholder="Enter your API token"
    value={paperlessToken}
    onChange={setPaperlessToken}
  />
  <Button onClick={testConnection}>
    测试连接
  </Button>
</SettingsSection>
```

---

## Data Models

### Paperless 配置 (复用 Blinko config 表)

```typescript
// 存储在 config 表中
// key: 'paperless'
// value: JSON
{
  baseUrl: string;
  apiToken: string;
  enabled: boolean;
}
```

### 本地缓存 (可选)

```typescript
// 缓存标签和文档类型，减少 API 调用
// 使用 React Query 的缓存机制
const CACHE_TIME = 5 * 60 * 1000; // 5 分钟
```

---



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do.*

### Property 1: API Proxy Correctness

*For any* API request to the File_Proxy, the proxy SHALL include the correct authentication header and forward the request to Paperless-ngx, transforming the response to Echo data format.

**Validates: Requirements 2.2, 3.2, 8.2, 8.3**

### Property 2: File Type Validation

*For any* file upload, if the file extension is in the allowed list (PDF, PNG, JPG, JPEG, TIFF, GIF, TXT, MD, DOC, DOCX), the upload SHALL be accepted; otherwise, it SHALL be rejected with an error message.

**Validates: Requirements 2.3, 2.5**

### Property 3: Document Display Completeness

*For any* document in the list or search results, the rendered component SHALL display the document's title, date added, correspondent (if any), and tags.

**Validates: Requirements 3.3, 4.2**

### Property 4: List Filtering and Sorting

*For any* combination of tag filters, document type filters, and sort options, the document list SHALL only contain documents matching all filters and be ordered according to the sort option.

**Validates: Requirements 3.4, 3.6, 4.3, 4.4, 6.5, 7.4**

### Property 5: Metadata Management

*For any* tag or document type creation with a valid name, the operation SHALL succeed and the new item SHALL be synced to Paperless-ngx. For any tag addition/removal on a document, the change SHALL be persisted.

**Validates: Requirements 6.2, 6.3, 6.6, 7.5**

### Property 6: Error Handling

*For any* Paperless-ngx connection failure or API error, the system SHALL return a user-friendly error message without exposing internal details.

**Validates: Requirements 8.4, 10.4, 10.5**

### Property 7: Settings Persistence

*For any* settings change (Paperless URL, API token), the change SHALL be persisted to the database and available after page reload.

**Validates: Requirements 10.6**

---

## Error Handling

| 错误场景 | 处理方式 |
|---------|---------|
| Paperless-ngx 未配置 | 显示配置引导，链接到设置页面 |
| Paperless-ngx 连接失败 | 显示 "无法连接到文件服务" 错误 |
| API Token 无效 | 显示 "认证失败，请检查 API Token" |
| 文件类型不支持 | 显示 "不支持的文件类型" 并列出支持的类型 |
| 上传失败 | 显示具体错误原因，提供重试按钮 |
| 搜索无结果 | 显示 "未找到匹配的文档" 提示 |
| 预览不可用 | 提供下载原文件选项 |

---

## Testing Strategy

### 单元测试

- PaperlessClient: 测试 API 调用和响应转换
- tRPC 路由: 测试输入验证和错误处理
- React 组件: 测试渲染和交互

### 属性测试 (fast-check)

使用 `fast-check` 进行属性测试，每个属性至少 100 次迭代。

```typescript
// Property 2: File Type Validation
import fc from 'fast-check';

const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'gif', 'txt', 'md', 'doc', 'docx'];

test('Property 2: File Type Validation', () => {
  fc.assert(
    fc.property(fc.string(), (filename) => {
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      const isAllowed = allowedExtensions.includes(ext);
      const result = validateFileType(filename);
      
      return result.valid === isAllowed;
    }),
    { numRuns: 100 }
  );
});

// Property 4: List Filtering and Sorting
test('Property 4: List Filtering and Sorting', () => {
  fc.assert(
    fc.property(
      fc.array(documentArbitrary),
      fc.array(fc.nat()),
      fc.option(fc.nat()),
      (documents, tagIds, documentTypeId) => {
        const filtered = filterDocuments(documents, { tagIds, documentTypeId });
        
        // 所有结果都应该匹配过滤条件
        return filtered.every(doc => {
          const matchesTags = tagIds.length === 0 || tagIds.some(id => doc.tags.includes(id));
          const matchesType = !documentTypeId || doc.document_type === documentTypeId;
          return matchesTags && matchesType;
        });
      }
    ),
    { numRuns: 100 }
  );
});
```

### 集成测试

- Docker Compose 启动测试
- 完整上传 → OCR → 搜索流程
- 设置保存和加载

