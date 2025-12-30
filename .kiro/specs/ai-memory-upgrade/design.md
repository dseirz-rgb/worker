# Design Document - AI 记忆系统升级

## Overview

本设计文档描述将 Echo 应用的 AI 记忆系统升级为 mem0 框架的技术方案。mem0 是一个成熟的 AI 记忆层框架，提供智能记忆提取、组织和检索能力。

### 设计原则

1. **渐进式升级** - 保持与现有 API 兼容，逐步迁移
2. **优雅降级** - mem0 不可用时自动回退到简单实现
3. **本地优先** - 默认使用自托管模式，数据存储在本地
4. **性能优先** - 利用 mem0 的高性能特性

### 技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| 记忆框架 | mem0 v1.0.0 | 成熟稳定，性能优异，支持 Gemini |
| 向量数据库 | **SeekDB** | 统一向量+全文+关系型，AI 原生，与原设计一致 |
| LLM | Gemini API | 与现有系统一致 |
| 存储 | SeekDB (统一存储) | 一个数据库搞定所有存储需求 |

### 为什么选择 SeekDB

SeekDB 是蚂蚁 OceanBase 在 2025年11月开源的 AI 原生数据库：

1. **统一存储** - 向量、文本、结构化数据、JSON 都在一个引擎
2. **混合搜索** - 单条 SQL 同时做向量搜索 + 全文搜索 + 关系查询
3. **内置 AI** - embedding、reranking、LLM 推理在数据库内完成
4. **嵌入式模式** - 支持本地嵌入，适合桌面应用
5. **与原设计一致** - Echo 原设计已选择 SeekDB 作为本地数据库

---

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Echo Application                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Memory Service Layer                      │    │
│  │                                                              │    │
│  │  ┌──────────────────┐    ┌──────────────────┐               │    │
│  │  │  Mem0 Adapter    │    │  Fallback Adapter │               │    │
│  │  │  (Primary)       │    │  (Simple Impl)    │               │    │
│  │  └────────┬─────────┘    └────────┬─────────┘               │    │
│  │           │                       │                          │    │
│  │           └───────────┬───────────┘                          │    │
│  │                       │                                      │    │
│  │  ┌────────────────────▼────────────────────┐                │    │
│  │  │         Unified Memory API              │                │    │
│  │  │                                         │                │    │
│  │  │  - add(content, userId, metadata)       │                │    │
│  │  │  - search(query, userId, filters)       │                │    │
│  │  │  - get(memoryId)                        │                │    │
│  │  │  - update(memoryId, content)            │                │    │
│  │  │  - delete(memoryId)                     │                │    │
│  │  │  - getAll(userId)                       │                │    │
│  │  │  - getContext(query, userId)            │                │    │
│  │  └─────────────────────────────────────────┘                │    │
│  │                                                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│  ┌───────────────────────────┴───────────────────────────┐          │
│  │                                                        │          │
│  │  ┌─────────────────┐          ┌─────────────────┐     │          │
│  │  │   mem0 SDK      │          │   SeekDB        │     │          │
│  │  │   (Python/TS)   │◄────────►│   (统一存储)    │     │          │
│  │  │                 │          │   向量+全文+SQL │     │          │
│  │  └────────┬────────┘          └─────────────────┘     │          │
│  │           │                                           │          │
│  │           ▼                                           │          │
│  │  ┌─────────────────┐                                  │          │
│  │  │   Gemini API    │                                  │          │
│  │  │   (LLM)         │                                  │          │
│  │  └─────────────────┘                                  │          │
│  │                                                        │          │
│  └────────────────────────────────────────────────────────┘          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 数据流

```
用户输入 (聊天/笔记/任务)
         │
         ▼
┌─────────────────┐
│  Input Handler  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Memory Service │
│                 │
│  1. 提取记忆    │ ──► mem0.add()
│  2. 存储记忆    │
│  3. 更新图谱    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Response    │
│                 │
│  1. 检索记忆    │ ◄── mem0.search()
│  2. 构建上下文  │
│  3. 生成回复    │
└─────────────────┘
```

---

## Components and Interfaces

### 1. 核心接口定义

```typescript
// types/memory.ts

/**
 * 记忆项接口
 */
export interface MemoryItem {
  id: string;
  content: string;
  userId: string;
  metadata: MemoryMetadata;
  createdAt: string;
  updatedAt: string;
}

/**
 * 记忆元数据
 */
export interface MemoryMetadata {
  source: 'chat' | 'note' | 'task' | 'activity' | 'import';
  sourceId?: string;
  category?: string;
  entities?: string[];
  importance?: number;
  domain?: LifeDomain;
}

/**
 * 搜索过滤器
 */
export interface MemorySearchFilters {
  category?: string;
  source?: MemoryMetadata['source'];
  domain?: LifeDomain;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * 搜索结果
 */
export interface MemorySearchResult {
  memory: MemoryItem;
  score: number;
}

/**
 * 记忆服务协议
 */
export interface MemoryServiceProtocol {
  // 初始化
  initialize(): Promise<void>;
  
  // 添加记忆
  add(content: string, userId: string, metadata?: Partial<MemoryMetadata>): Promise<MemoryItem>;
  
  // 搜索记忆
  search(query: string, userId: string, filters?: MemorySearchFilters): Promise<MemorySearchResult[]>;
  
  // 获取单条记忆
  get(memoryId: string): Promise<MemoryItem | null>;
  
  // 更新记忆
  update(memoryId: string, content: string): Promise<MemoryItem>;
  
  // 删除记忆
  delete(memoryId: string): Promise<boolean>;
  
  // 获取用户所有记忆
  getAll(userId: string, filters?: MemorySearchFilters): Promise<MemoryItem[]>;
  
  // 获取 AI 上下文
  getContext(query: string, userId: string, maxItems?: number): Promise<string>;
  
  // 导出记忆
  export(userId: string): Promise<string>;
  
  // 导入记忆
  import(userId: string, data: string): Promise<number>;
  
  // 删除用户所有记忆
  deleteAllForUser(userId: string): Promise<boolean>;
}
```

### 2. Mem0 适配器

```typescript
// services/memory/mem0Adapter.ts

import { Memory } from 'mem0ai';
import type { 
  MemoryServiceProtocol, 
  MemoryItem, 
  MemoryMetadata,
  MemorySearchFilters,
  MemorySearchResult 
} from '../../types/memory';

/**
 * Mem0 适配器配置
 */
export interface Mem0Config {
  // LLM 配置
  llm: {
    provider: 'google' | 'openai';
    model: string;
    apiKey: string;
  };
  // 向量数据库配置 (使用 SeekDB)
  vectorStore: {
    provider: 'seekdb';
    path: string;  // SeekDB 数据库路径
    collection: string;  // 记忆集合名称
  };
  // 图记忆配置
  graphStore?: {
    enabled: boolean;
  };
}

/**
 * Mem0 适配器实现
 * 使用 SeekDB 作为向量存储后端
 */
export class Mem0Adapter implements MemoryServiceProtocol {
  private client: Memory | null = null;
  private config: Mem0Config;
  private initialized = false;

  constructor(config: Mem0Config) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // 配置 mem0 使用 SeekDB
      const mem0Config = {
        llm: {
          provider: this.config.llm.provider === 'google' ? 'google_genai' : 'openai',
          config: {
            model: this.config.llm.model,
            api_key: this.config.llm.apiKey,
          },
        },
        // SeekDB 作为向量存储
        // mem0 支持自定义向量存储，我们通过 SeekDB 的向量功能实现
        vector_store: {
          provider: 'custom',
          config: {
            // SeekDB 配置
            path: this.config.vectorStore.path,
            collection: this.config.vectorStore.collection,
          },
        },
        // 使用 SeekDB 的内置 embedding 功能
        embedder: {
          provider: 'google',
          config: {
            model: 'models/text-embedding-004',
            api_key: this.config.llm.apiKey,
          },
        },
      };

      this.client = new Memory(mem0Config);
      this.initialized = true;
      console.log('Mem0 + SeekDB 初始化成功');
    } catch (error) {
      console.error('Mem0 初始化失败:', error);
      throw error;
    }
  }

  async add(
    content: string, 
    userId: string, 
    metadata?: Partial<MemoryMetadata>
  ): Promise<MemoryItem> {
    if (!this.client) throw new Error('Mem0 未初始化');

    const result = await this.client.add(content, {
      user_id: userId,
      metadata: metadata,
    });

    return this.toMemoryItem(result, userId, metadata);
  }

  async search(
    query: string, 
    userId: string, 
    filters?: MemorySearchFilters
  ): Promise<MemorySearchResult[]> {
    if (!this.client) throw new Error('Mem0 未初始化');

    const results = await this.client.search(query, {
      user_id: userId,
      limit: filters?.limit || 10,
    });

    return results.map((r: any) => ({
      memory: this.toMemoryItem(r, userId),
      score: r.score || 1.0,
    }));
  }

  async get(memoryId: string): Promise<MemoryItem | null> {
    if (!this.client) throw new Error('Mem0 未初始化');

    try {
      const result = await this.client.get(memoryId);
      return result ? this.toMemoryItem(result, result.user_id) : null;
    } catch {
      return null;
    }
  }

  async update(memoryId: string, content: string): Promise<MemoryItem> {
    if (!this.client) throw new Error('Mem0 未初始化');

    const result = await this.client.update(memoryId, content);
    return this.toMemoryItem(result, result.user_id);
  }

  async delete(memoryId: string): Promise<boolean> {
    if (!this.client) throw new Error('Mem0 未初始化');

    try {
      await this.client.delete(memoryId);
      return true;
    } catch {
      return false;
    }
  }

  async getAll(userId: string, filters?: MemorySearchFilters): Promise<MemoryItem[]> {
    if (!this.client) throw new Error('Mem0 未初始化');

    const results = await this.client.getAll({ user_id: userId });
    return results.map((r: any) => this.toMemoryItem(r, userId));
  }

  async getContext(query: string, userId: string, maxItems = 5): Promise<string> {
    const results = await this.search(query, userId, { limit: maxItems });
    
    if (results.length === 0) {
      return '';
    }

    const contextLines = results.map(r => `- ${r.memory.content}`);
    return `相关记忆：\n${contextLines.join('\n')}`;
  }

  async export(userId: string): Promise<string> {
    const memories = await this.getAll(userId);
    return JSON.stringify(memories, null, 2);
  }

  async import(userId: string, data: string): Promise<number> {
    const memories: MemoryItem[] = JSON.parse(data);
    let count = 0;

    for (const memory of memories) {
      await this.add(memory.content, userId, memory.metadata);
      count++;
    }

    return count;
  }

  async deleteAllForUser(userId: string): Promise<boolean> {
    if (!this.client) throw new Error('Mem0 未初始化');

    try {
      await this.client.deleteAll({ user_id: userId });
      return true;
    } catch {
      return false;
    }
  }

  private toMemoryItem(raw: any, userId: string, metadata?: Partial<MemoryMetadata>): MemoryItem {
    return {
      id: raw.id || raw.memory_id,
      content: raw.memory || raw.content,
      userId: userId,
      metadata: {
        source: metadata?.source || 'chat',
        sourceId: metadata?.sourceId,
        category: raw.category || metadata?.category,
        entities: raw.entities || metadata?.entities,
        importance: raw.importance || metadata?.importance,
        domain: metadata?.domain,
      },
      createdAt: raw.created_at || new Date().toISOString(),
      updatedAt: raw.updated_at || new Date().toISOString(),
    };
  }
}
```

### 3. 统一记忆服务

```typescript
// services/memory/memoryService.ts

import type { 
  MemoryServiceProtocol, 
  MemoryItem, 
  MemoryMetadata,
  MemorySearchFilters,
  MemorySearchResult 
} from '../../types/memory';
import { Mem0Adapter, Mem0Config } from './mem0Adapter';
import { FallbackAdapter } from './fallbackAdapter';

/**
 * 统一记忆服务
 * 封装 mem0 和降级实现，提供统一 API
 */
export class MemoryService implements MemoryServiceProtocol {
  private primaryAdapter: Mem0Adapter | null = null;
  private fallbackAdapter: FallbackAdapter;
  private useFallback = false;

  constructor(config: Mem0Config) {
    this.primaryAdapter = new Mem0Adapter(config);
    this.fallbackAdapter = new FallbackAdapter();
  }

  async initialize(): Promise<void> {
    try {
      await this.primaryAdapter?.initialize();
      this.useFallback = false;
      console.log('使用 mem0 记忆服务');
    } catch (error) {
      console.warn('mem0 初始化失败，使用降级实现:', error);
      await this.fallbackAdapter.initialize();
      this.useFallback = true;
    }
  }

  private get adapter(): MemoryServiceProtocol {
    return this.useFallback ? this.fallbackAdapter : this.primaryAdapter!;
  }

  async add(content: string, userId: string, metadata?: Partial<MemoryMetadata>): Promise<MemoryItem> {
    return this.adapter.add(content, userId, metadata);
  }

  async search(query: string, userId: string, filters?: MemorySearchFilters): Promise<MemorySearchResult[]> {
    return this.adapter.search(query, userId, filters);
  }

  async get(memoryId: string): Promise<MemoryItem | null> {
    return this.adapter.get(memoryId);
  }

  async update(memoryId: string, content: string): Promise<MemoryItem> {
    return this.adapter.update(memoryId, content);
  }

  async delete(memoryId: string): Promise<boolean> {
    return this.adapter.delete(memoryId);
  }

  async getAll(userId: string, filters?: MemorySearchFilters): Promise<MemoryItem[]> {
    return this.adapter.getAll(userId, filters);
  }

  async getContext(query: string, userId: string, maxItems?: number): Promise<string> {
    return this.adapter.getContext(query, userId, maxItems);
  }

  async export(userId: string): Promise<string> {
    return this.adapter.export(userId);
  }

  async import(userId: string, data: string): Promise<number> {
    return this.adapter.import(userId, data);
  }

  async deleteAllForUser(userId: string): Promise<boolean> {
    return this.adapter.deleteAllForUser(userId);
  }

  /**
   * 检查是否使用降级模式
   */
  isUsingFallback(): boolean {
    return this.useFallback;
  }
}
```

### 4. 降级适配器

```typescript
// services/memory/fallbackAdapter.ts

/**
 * 降级适配器
 * 当 mem0 不可用时使用现有的简单实现
 */
export class FallbackAdapter implements MemoryServiceProtocol {
  // 复用现有的 memory/index.ts 实现
  // 保持 API 兼容
}
```

---

## Data Models

### 数据库 Schema

```sql
-- 记忆表 (SQLite，用于元数据和备份)
CREATE TABLE IF NOT EXISTS memories_meta (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'chat',
  source_id TEXT,
  category TEXT,
  entities TEXT DEFAULT '[]',
  importance REAL DEFAULT 0.5,
  domain TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memories_user ON memories_meta(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_source ON memories_meta(source, source_id);
CREATE INDEX IF NOT EXISTS idx_memories_category ON memories_meta(category);

-- 记忆同步状态表
CREATE TABLE IF NOT EXISTS memories_sync (
  id TEXT PRIMARY KEY NOT NULL,
  memory_id TEXT NOT NULL,
  action TEXT NOT NULL,
  synced BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (memory_id) REFERENCES memories_meta(id)
);
```

### mem0 存储结构

mem0 使用 Qdrant 向量数据库存储记忆向量：

```
./data/qdrant/
├── collections/
│   └── memories/
│       ├── vectors/      # 向量数据
│       └── payload/      # 元数据
└── snapshots/            # 快照备份
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API Compatibility
*For any* existing code that uses the old Memory_Service API, calling the same methods on the new unified Memory_Service SHALL produce equivalent results.
**Validates: Requirements 1.6**

### Property 2: Fallback Behavior
*For any* initialization failure of mem0, the Memory_Service SHALL automatically switch to the fallback adapter and continue to function correctly.
**Validates: Requirements 1.5**

### Property 3: Memory Extraction
*For any* valid user input (chat message, note, or task), the Memory_Service SHALL extract and store at least one memory item with the correct user association.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 4: Deduplication
*For any* content that is added twice with the same user ID, the Memory_Service SHALL not create duplicate memories; instead, it SHALL update the existing memory or merge the information.
**Validates: Requirements 2.6**

### Property 5: Memory Search and Ranking
*For any* search query that matches known memory content, the Memory_Service SHALL return relevant memories ranked by relevance score in descending order.
**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 6: Memory CRUD Consistency
*For any* memory that is created, the Memory_Service SHALL be able to retrieve it by ID; after update, the content SHALL reflect the new value; after delete, the memory SHALL no longer be retrievable.
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 7: Export/Import Round-Trip
*For any* set of memories exported to JSON, importing that JSON back SHALL result in an equivalent set of memories being accessible.
**Validates: Requirements 4.4, 4.5**

### Property 8: Graph Memory Relationships
*For any* entities mentioned in conversations, the Memory_Service SHALL extract relationships; querying for an entity SHALL return its related entities.
**Validates: Requirements 5.1, 5.2, 5.3**

### Property 9: Error Resilience
*For any* error that occurs during memory operations, the Memory_Service SHALL log the error and continue operation without crashing.
**Validates: Requirements 7.5**

### Property 10: Memory Decay
*For any* memory storage that exceeds the configured limit, the Memory_Service SHALL remove the oldest or least important memories to stay within limits.
**Validates: Requirements 7.6**

### Property 11: User Data Deletion
*For any* user who requests data deletion, the Memory_Service SHALL remove all memories associated with that user ID, and subsequent queries SHALL return no results.
**Validates: Requirements 8.4**

---

## Error Handling

### 错误处理策略

遵循用户偏好的"优雅降级"模式：

```typescript
// 错误类型定义
export class MemoryError extends Error {
  constructor(
    message: string,
    public readonly code: MemoryErrorCode,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'MemoryError';
  }
}

export enum MemoryErrorCode {
  INITIALIZATION_FAILED = 'INIT_FAILED',
  STORAGE_ERROR = 'STORAGE_ERROR',
  SEARCH_ERROR = 'SEARCH_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
}

// 错误处理包装器
async function withErrorHandling<T>(
  operation: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[Memory] ${context} 失败:`, error);
    return fallback;
  }
}
```

### 重试策略

```typescript
// 指数退避重试
async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  }
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const delay = Math.min(
        options.baseDelay * Math.pow(2, attempt),
        options.maxDelay
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}
```

---

## Testing Strategy

### 测试框架

| 类型 | 框架 | 用途 |
|------|------|------|
| 单元测试 | Vitest | 组件和服务测试 |
| 属性测试 | fast-check | 正确性属性验证 |
| 集成测试 | Vitest | mem0 集成测试 |

### 属性测试配置

```typescript
import fc from 'fast-check';

// 配置：每个属性测试至少 100 次迭代
const FC_CONFIG = { numRuns: 100 };

// 生成器
const arbitraryMemoryContent = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength: 500 })
    .filter(s => s.trim().length > 0);

const arbitraryUserId = (): fc.Arbitrary<string> =>
  fc.uuid();

const arbitraryMemoryMetadata = (): fc.Arbitrary<Partial<MemoryMetadata>> =>
  fc.record({
    source: fc.constantFrom('chat', 'note', 'task', 'activity'),
    category: fc.option(fc.string()),
    domain: fc.option(fc.constantFrom('work', 'investment', 'development', 'learning', 'family', 'health', 'entertainment')),
  });
```

### 测试文件组织

```
echo/src/services/memory/
├── index.ts                    # 导出
├── memoryService.ts            # 统一服务
├── memoryService.test.ts       # 单元测试
├── memoryService.property.test.ts  # 属性测试
├── mem0Adapter.ts              # mem0 适配器
├── mem0Adapter.test.ts         # 适配器测试
├── fallbackAdapter.ts          # 降级适配器
└── types.ts                    # 类型定义
```

### 属性测试示例

```typescript
// **Feature: ai-memory-upgrade, Property 7: Export/Import Round-Trip**
describe('Property 7: Export/Import Round-Trip', () => {
  it('should preserve memories after export and import', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryMemoryContent(), { minLength: 1, maxLength: 10 }),
        arbitraryUserId(),
        async (contents, userId) => {
          // 添加记忆
          for (const content of contents) {
            await memoryService.add(content, userId);
          }
          
          // 导出
          const exported = await memoryService.export(userId);
          
          // 清空并导入
          await memoryService.deleteAllForUser(userId);
          await memoryService.import(userId, exported);
          
          // 验证
          const memories = await memoryService.getAll(userId);
          expect(memories.length).toBe(contents.length);
          
          for (const content of contents) {
            const found = memories.some(m => m.content === content);
            expect(found).toBe(true);
          }
        }
      ),
      FC_CONFIG
    );
  });
});
```

---

## 集成方案

### 与现有功能集成

```typescript
// 在 Chat 服务中使用记忆
async function generateChatResponse(message: string, userId: string): Promise<string> {
  // 获取记忆上下文
  const memoryContext = await memoryService.getContext(message, userId);
  
  // 构建 prompt
  const prompt = `
${memoryContext}

用户消息: ${message}

请根据上下文回复用户。
`;

  // 调用 AI
  const response = await geminiClient.generateContent(prompt);
  
  // 提取并存储新记忆
  await memoryService.add(message, userId, { source: 'chat' });
  
  return response;
}

// 在笔记服务中使用记忆
async function createNote(content: string, userId: string): Promise<Note> {
  const note = await noteService.create(content, userId);
  
  // 提取记忆
  await memoryService.add(content, userId, {
    source: 'note',
    sourceId: note.id,
  });
  
  return note;
}
```

### 配置示例

```typescript
// config/memory.ts
export const memoryConfig: Mem0Config = {
  llm: {
    provider: 'google',
    model: 'gemini-2.0-flash',
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  vectorStore: {
    provider: 'qdrant',
    path: './data/qdrant',
  },
  graphStore: {
    enabled: false, // 可选启用图记忆
  },
};
```
