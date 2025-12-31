# Design Document - SeekDB 本地数据库

## Overview

本设计文档描述将 Echo 应用的本地数据库从 SQLite 升级为 SeekDB 的技术方案。SeekDB 是 OceanBase 开源的 AI 原生搜索数据库，统一支持向量搜索、全文搜索和关系型查询。

### 设计原则

1. **统一存储** - 向量、文本、结构化数据都在 SeekDB 一个引擎中
2. **混合搜索** - 单条查询同时做向量搜索 + 全文搜索
3. **自动索引** - 内容自动生成 embedding，无需手动标记
4. **渐进迁移** - 保持与现有代码兼容，逐步迁移

### 技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| 数据库 | SeekDB | AI 原生，统一向量+全文+关系型 |
| Sidecar | FastAPI (Python) | SeekDB Python SDK，高性能 |
| 通信 | HTTP REST | 简单可靠，易于调试 |
| Embedding | text-embedding-004 | Google 最新模型，384 维 |

---

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Echo Application                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Tauri Frontend (React)                    │    │
│  │                                                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │    │
│  │  │  Notes UI    │  │  Tasks UI    │  │  Chat UI     │       │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │    │
│  │         │                 │                 │                │    │
│  │         └─────────────────┼─────────────────┘                │    │
│  │                           │                                  │    │
│  │  ┌────────────────────────▼────────────────────────────┐    │    │
│  │  │              Database Service (TypeScript)           │    │    │
│  │  │                                                      │    │    │
│  │  │  - CRUD 操作封装                                     │    │    │
│  │  │  - 搜索接口                                          │    │    │
│  │  │  - 缓存管理                                          │    │    │
│  │  └────────────────────────┬────────────────────────────┘    │    │
│  │                           │ HTTP                             │    │
│  └───────────────────────────┼──────────────────────────────────┘    │
│                              │                                       │
│  ┌───────────────────────────▼───────────────────────────────────┐  │
│  │                  Python Sidecar (FastAPI)                      │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │  │
│  │  │  /notes      │  │  /tasks      │  │  /memories   │         │  │
│  │  │  CRUD API    │  │  CRUD API    │  │  CRUD API    │         │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │  │
│  │         │                 │                 │                  │  │
│  │         └─────────────────┼─────────────────┘                  │  │
│  │                           │                                    │  │
│  │  ┌────────────────────────▼────────────────────────────┐      │  │
│  │  │              SeekDB Client                           │      │  │
│  │  │                                                      │      │  │
│  │  │  - Collection 管理                                   │      │  │
│  │  │  - 向量搜索                                          │      │  │
│  │  │  - 全文搜索                                          │      │  │
│  │  │  - 混合搜索                                          │      │  │
│  │  └────────────────────────┬────────────────────────────┘      │  │
│  │                           │                                    │  │
│  └───────────────────────────┼────────────────────────────────────┘  │
│                              │                                       │
│  ┌───────────────────────────▼───────────────────────────────────┐  │
│  │                      SeekDB (Embedded)                         │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │  │
│  │  │  notes       │  │  tasks       │  │  memories    │         │  │
│  │  │  collection  │  │  collection  │  │  collection  │         │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘         │  │
│  │                                                                │  │
│  │  ./data/echo.seekdb                                           │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```


### 数据流

```
用户操作 (创建笔记/任务/搜索)
         │
         ▼
┌─────────────────┐
│  React Frontend │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Database Service│ ──► 本地缓存 (可选)
│  (TypeScript)   │
└────────┬────────┘
         │ HTTP POST/GET
         ▼
┌─────────────────┐
│ FastAPI Sidecar │
│  (Python)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    SeekDB       │
│                 │
│  1. 存储数据    │
│  2. 生成向量    │
│  3. 建立索引    │
│  4. 执行搜索    │
└─────────────────┘
```

---

## Components and Interfaces

### 1. Python Sidecar 服务

```python
# sidecar/main.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import pyseekdb

app = FastAPI(title="Echo SeekDB Sidecar")

# SeekDB 客户端
client: pyseekdb.Client = None

@app.on_event("startup")
async def startup():
    global client
    client = pyseekdb.Client(
        path="./data/echo.seekdb",
        database="echo"
    )
    # 初始化 collections
    init_collections()

def init_collections():
    """初始化所有数据集合"""
    collections = ["notes", "tasks", "reminders", "memories"]
    for name in collections:
        if not client.has_collection(name):
            client.create_collection(
                name=name,
                embedding_function=pyseekdb.DefaultEmbeddingFunction()
            )

# 数据模型
class NoteCreate(BaseModel):
    id: str
    content: str
    domain: str
    tags: List[str] = []
    created_at: str

class NoteUpdate(BaseModel):
    content: Optional[str] = None
    domain: Optional[str] = None
    tags: Optional[List[str]] = None

class SearchQuery(BaseModel):
    query: str
    collection: str = "notes"
    limit: int = 10
    domain: Optional[str] = None
    search_type: str = "hybrid"  # vector, fulltext, hybrid

class SearchResult(BaseModel):
    id: str
    content: str
    score: float
    metadata: dict

# API 端点
@app.post("/notes")
async def create_note(note: NoteCreate):
    """创建笔记，自动生成 embedding"""
    collection = client.get_collection("notes")
    collection.add(
        ids=[note.id],
        documents=[note.content],
        metadatas=[{
            "domain": note.domain,
            "tags": ",".join(note.tags),
            "created_at": note.created_at
        }]
    )
    return {"id": note.id, "status": "created"}

@app.get("/notes/{note_id}")
async def get_note(note_id: str):
    """获取单条笔记"""
    collection = client.get_collection("notes")
    result = collection.get(ids=[note_id])
    if not result["ids"]:
        raise HTTPException(status_code=404, detail="Note not found")
    return {
        "id": result["ids"][0],
        "content": result["documents"][0],
        "metadata": result["metadatas"][0]
    }

@app.put("/notes/{note_id}")
async def update_note(note_id: str, note: NoteUpdate):
    """更新笔记，重新生成 embedding"""
    collection = client.get_collection("notes")
    update_data = {}
    if note.content:
        update_data["documents"] = [note.content]
    if note.domain or note.tags:
        metadata = {}
        if note.domain:
            metadata["domain"] = note.domain
        if note.tags:
            metadata["tags"] = ",".join(note.tags)
        update_data["metadatas"] = [metadata]
    
    collection.update(ids=[note_id], **update_data)
    return {"id": note_id, "status": "updated"}

@app.delete("/notes/{note_id}")
async def delete_note(note_id: str):
    """删除笔记"""
    collection = client.get_collection("notes")
    collection.delete(ids=[note_id])
    return {"id": note_id, "status": "deleted"}

@app.post("/search")
async def search(query: SearchQuery) -> List[SearchResult]:
    """执行搜索（向量/全文/混合）"""
    collection = client.get_collection(query.collection)
    
    # 构建过滤条件
    where = None
    if query.domain:
        where = {"domain": query.domain}
    
    # 执行搜索
    if query.search_type == "vector":
        results = collection.query(
            query_texts=[query.query],
            n_results=query.limit,
            where=where
        )
    elif query.search_type == "fulltext":
        results = collection.query(
            query_texts=[query.query],
            n_results=query.limit,
            where=where,
            include_embeddings=False
        )
    else:  # hybrid
        results = collection.query(
            query_texts=[query.query],
            n_results=query.limit,
            where=where
        )
    
    # 格式化结果
    search_results = []
    for i, doc_id in enumerate(results["ids"][0]):
        search_results.append(SearchResult(
            id=doc_id,
            content=results["documents"][0][i],
            score=1.0 - results["distances"][0][i] if results.get("distances") else 1.0,
            metadata=results["metadatas"][0][i]
        ))
    
    return search_results

@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "database": "seekdb"}
```


### 2. TypeScript Database Service

```typescript
// services/database/seekdbService.ts

const SIDECAR_URL = 'http://localhost:8765';

/**
 * SeekDB 服务客户端
 * 封装与 Python Sidecar 的通信
 */
export class SeekDBService {
  private baseUrl: string;

  constructor(baseUrl: string = SIDECAR_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 创建笔记
   */
  async createNote(note: {
    id: string;
    content: string;
    domain: string;
    tags: string[];
    createdAt: string;
  }): Promise<{ id: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: note.id,
        content: note.content,
        domain: note.domain,
        tags: note.tags,
        created_at: note.createdAt,
      }),
    });
    return response.json();
  }

  /**
   * 获取笔记
   */
  async getNote(noteId: string): Promise<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
  } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/notes/${noteId}`);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  /**
   * 更新笔记
   */
  async updateNote(
    noteId: string,
    updates: { content?: string; domain?: string; tags?: string[] }
  ): Promise<{ id: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return response.json();
  }

  /**
   * 删除笔记
   */
  async deleteNote(noteId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/notes/${noteId}`, {
      method: 'DELETE',
    });
    return response.ok;
  }

  /**
   * 搜索
   */
  async search(params: {
    query: string;
    collection?: string;
    limit?: number;
    domain?: string;
    searchType?: 'vector' | 'fulltext' | 'hybrid';
  }): Promise<Array<{
    id: string;
    content: string;
    score: number;
    metadata: Record<string, unknown>;
  }>> {
    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: params.query,
        collection: params.collection || 'notes',
        limit: params.limit || 10,
        domain: params.domain,
        search_type: params.searchType || 'hybrid',
      }),
    });
    return response.json();
  }

  /**
   * 导出数据
   */
  async exportData(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/export`);
    return response.text();
  }

  /**
   * 导入数据
   */
  async importData(jsonData: string): Promise<{ imported: number }> {
    const response = await fetch(`${this.baseUrl}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonData,
    });
    return response.json();
  }
}

// 单例导出
export const seekdbService = new SeekDBService();
```

### 3. Memory Service 升级

```typescript
// services/memory/seekdbMemoryService.ts

import { seekdbService } from '../database/seekdbService';
import type { MemoryItem, MemorySearchResult } from '../../types/memory';

/**
 * 基于 SeekDB 的记忆服务
 */
export class SeekDBMemoryService {
  /**
   * 添加记忆
   */
  async add(
    content: string,
    userId: string,
    metadata?: { source?: string; sourceId?: string; domain?: string }
  ): Promise<MemoryItem> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await seekdbService.createNote({
      id,
      content,
      domain: metadata?.domain || 'general',
      tags: [metadata?.source || 'memory', userId],
      createdAt: now,
    });

    return {
      id,
      content,
      userId,
      metadata: metadata || {},
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * 搜索记忆
   */
  async search(
    query: string,
    userId: string,
    options?: { limit?: number; domain?: string }
  ): Promise<MemorySearchResult[]> {
    const results = await seekdbService.search({
      query,
      collection: 'memories',
      limit: options?.limit || 10,
      domain: options?.domain,
      searchType: 'hybrid',
    });

    return results.map(r => ({
      memory: {
        id: r.id,
        content: r.content,
        userId,
        metadata: r.metadata,
        createdAt: r.metadata.created_at as string,
        updatedAt: r.metadata.created_at as string,
      },
      score: r.score,
    }));
  }

  /**
   * 获取 AI 上下文
   */
  async getContext(query: string, userId: string, maxItems = 5): Promise<string> {
    const results = await this.search(query, userId, { limit: maxItems });

    if (results.length === 0) {
      return '';
    }

    const contextLines = results.map(r => `- ${r.memory.content}`);
    return `相关记忆：\n${contextLines.join('\n')}`;
  }

  /**
   * 删除记忆
   */
  async delete(memoryId: string): Promise<boolean> {
    return seekdbService.deleteNote(memoryId);
  }
}

export const seekdbMemoryService = new SeekDBMemoryService();
```


---

## Data Models

### SeekDB Collections

```python
# SeekDB 集合定义

# notes 集合
notes_collection = {
    "name": "notes",
    "embedding_function": "DefaultEmbeddingFunction",  # 384 维向量
    "schema": {
        "id": "string (primary key)",
        "content": "string (indexed for fulltext + vector)",
        "domain": "string",
        "tags": "string (comma-separated)",
        "created_at": "string (ISO datetime)",
        "updated_at": "string (ISO datetime)"
    }
}

# tasks 集合
tasks_collection = {
    "name": "tasks",
    "embedding_function": "DefaultEmbeddingFunction",
    "schema": {
        "id": "string (primary key)",
        "title": "string",
        "description": "string",
        "content": "string (title + description, for embedding)",
        "priority": "string",
        "status": "string",
        "deadline": "string (ISO datetime)",
        "domain": "string",
        "created_at": "string (ISO datetime)",
        "completed_at": "string (ISO datetime, nullable)"
    }
}

# reminders 集合
reminders_collection = {
    "name": "reminders",
    "embedding_function": "DefaultEmbeddingFunction",
    "schema": {
        "id": "string (primary key)",
        "type": "string",
        "title": "string",
        "message": "string",
        "content": "string (title + message, for embedding)",
        "priority": "string",
        "scheduled_at": "string (ISO datetime)",
        "status": "string",
        "created_at": "string (ISO datetime)"
    }
}

# memories 集合
memories_collection = {
    "name": "memories",
    "embedding_function": "DefaultEmbeddingFunction",
    "schema": {
        "id": "string (primary key)",
        "content": "string (indexed for fulltext + vector)",
        "user_id": "string",
        "source": "string",
        "source_id": "string (nullable)",
        "category": "string",
        "domain": "string",
        "created_at": "string (ISO datetime)"
    }
}
```

### 数据迁移脚本

```python
# sidecar/migrate.py

import sqlite3
import pyseekdb
from datetime import datetime

def migrate_from_sqlite(sqlite_path: str, seekdb_path: str):
    """从 SQLite 迁移数据到 SeekDB"""
    
    # 连接 SQLite
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    
    # 连接 SeekDB
    seekdb_client = pyseekdb.Client(path=seekdb_path, database="echo")
    
    # 迁移笔记
    migrate_notes(sqlite_conn, seekdb_client)
    
    # 迁移任务
    migrate_tasks(sqlite_conn, seekdb_client)
    
    # 迁移提醒
    migrate_reminders(sqlite_conn, seekdb_client)
    
    # 迁移记忆
    migrate_memories(sqlite_conn, seekdb_client)
    
    # 验证数据完整性
    verify_migration(sqlite_conn, seekdb_client)
    
    sqlite_conn.close()
    print("迁移完成!")

def migrate_notes(sqlite_conn, seekdb_client):
    """迁移笔记数据"""
    cursor = sqlite_conn.execute("SELECT * FROM notes")
    rows = cursor.fetchall()
    
    if not rows:
        return
    
    collection = seekdb_client.get_or_create_collection(
        name="notes",
        embedding_function=pyseekdb.DefaultEmbeddingFunction()
    )
    
    ids = []
    documents = []
    metadatas = []
    
    for row in rows:
        ids.append(row["id"])
        documents.append(row["content"])
        metadatas.append({
            "domain": row["domain"],
            "tags": row["tags"] or "",
            "created_at": row["created_at"],
            "updated_at": row["updated_at"] or row["created_at"]
        })
    
    collection.add(ids=ids, documents=documents, metadatas=metadatas)
    print(f"迁移了 {len(ids)} 条笔记")

def verify_migration(sqlite_conn, seekdb_client):
    """验证迁移数据完整性"""
    tables = ["notes", "tasks", "reminders", "memories"]
    
    for table in tables:
        # SQLite 计数
        cursor = sqlite_conn.execute(f"SELECT COUNT(*) FROM {table}")
        sqlite_count = cursor.fetchone()[0]
        
        # SeekDB 计数
        try:
            collection = seekdb_client.get_collection(table)
            seekdb_count = collection.count()
        except:
            seekdb_count = 0
        
        if sqlite_count != seekdb_count:
            raise Exception(f"{table} 数据不一致: SQLite={sqlite_count}, SeekDB={seekdb_count}")
        
        print(f"{table}: {sqlite_count} 条记录验证通过")
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Data Migration Integrity
*For any* set of records in the SQLite database, after migration to SeekDB, all records SHALL be preserved with their original IDs, and embeddings SHALL be generated for all text content.
**Validates: Requirements 2.2, 2.3, 2.5**

### Property 2: Vector Search Relevance
*For any* search query, the Search_Service SHALL return results ranked by semantic similarity, where results containing semantically similar content to the query SHALL have higher scores than unrelated content.
**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 3: Hybrid Search Combination
*For any* hybrid search query, the Search_Service SHALL combine results from both vector search and fulltext search, with exact keyword matches receiving boosted scores.
**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

### Property 4: Auto Embedding Generation
*For any* content that is created or updated, the Database_Service SHALL automatically generate a 384-dimensional embedding vector and store it with the record.
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 5: Memory Retrieval Relevance
*For any* memory search query, the Memory_Service SHALL return the top N most relevant memories based on semantic similarity, with support for domain filtering.
**Validates: Requirements 6.2, 6.3, 6.4, 6.5**

### Property 6: Export/Import Round-Trip
*For any* dataset exported to JSON, importing that JSON back SHALL result in an equivalent dataset with all records accessible.
**Validates: Requirements 8.3, 8.4**

### Property 7: Immediate Persistence
*For any* data modification (create, update, delete), the change SHALL be persisted to the SeekDB database file immediately and be visible in subsequent queries.
**Validates: Requirements 8.2**

### Property 8: Concurrent Request Safety
*For any* set of concurrent requests to the Sidecar_Service, all requests SHALL be processed correctly without data corruption or race conditions.
**Validates: Requirements 7.6**

---

## Error Handling

### 错误处理策略

```typescript
// 错误类型定义
export class SeekDBError extends Error {
  constructor(
    message: string,
    public readonly code: SeekDBErrorCode,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'SeekDBError';
  }
}

export enum SeekDBErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  SIDECAR_NOT_RUNNING = 'SIDECAR_NOT_RUNNING',
  COLLECTION_NOT_FOUND = 'COLLECTION_NOT_FOUND',
  EMBEDDING_FAILED = 'EMBEDDING_FAILED',
  SEARCH_FAILED = 'SEARCH_FAILED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
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
    console.error(`[SeekDB] ${context} 失败:`, error);
    return fallback;
  }
}

// Sidecar 重启逻辑
async function ensureSidecarRunning(): Promise<boolean> {
  const isHealthy = await seekdbService.healthCheck();
  if (!isHealthy) {
    console.log('Sidecar 未运行，尝试启动...');
    await startSidecar();
    // 等待启动
    await new Promise(resolve => setTimeout(resolve, 2000));
    return seekdbService.healthCheck();
  }
  return true;
}
```

---

## Testing Strategy

### 测试框架

| 类型 | 框架 | 用途 |
|------|------|------|
| 单元测试 | Vitest | TypeScript 服务测试 |
| 属性测试 | fast-check | 正确性属性验证 |
| Python 测试 | pytest | Sidecar 测试 |
| 集成测试 | Vitest | 端到端测试 |

### 属性测试配置

```typescript
import fc from 'fast-check';

const FC_CONFIG = { numRuns: 100 };

// 生成器
const arbitraryNoteContent = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength: 1000 })
    .filter(s => s.trim().length > 0);

const arbitraryDomain = (): fc.Arbitrary<string> =>
  fc.constantFrom('work', 'investment', 'development', 'learning', 'family', 'health', 'entertainment');
```

### 属性测试示例

```typescript
// **Feature: seekdb-local-database, Property 6: Export/Import Round-Trip**
describe('Property 6: Export/Import Round-Trip', () => {
  it('should preserve data after export and import', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryNoteContent(), { minLength: 1, maxLength: 10 }),
        async (contents) => {
          // 创建笔记
          for (const content of contents) {
            await seekdbService.createNote({
              id: crypto.randomUUID(),
              content,
              domain: 'test',
              tags: [],
              createdAt: new Date().toISOString(),
            });
          }
          
          // 导出
          const exported = await seekdbService.exportData();
          
          // 清空并导入
          // ... 清空逻辑
          await seekdbService.importData(exported);
          
          // 验证
          const results = await seekdbService.search({
            query: '',
            collection: 'notes',
            limit: 100,
          });
          
          expect(results.length).toBe(contents.length);
        }
      ),
      FC_CONFIG
    );
  });
});
```

---

## Sidecar 管理

### Tauri 集成

```rust
// src-tauri/src/sidecar.rs

use std::process::{Child, Command};
use std::sync::Mutex;

static SIDECAR_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

pub fn start_sidecar() -> Result<(), String> {
    let mut process = SIDECAR_PROCESS.lock().unwrap();
    
    if process.is_some() {
        return Ok(());
    }
    
    let child = Command::new("python")
        .args(&["-m", "uvicorn", "sidecar.main:app", "--port", "8765"])
        .spawn()
        .map_err(|e| format!("Failed to start sidecar: {}", e))?;
    
    *process = Some(child);
    Ok(())
}

pub fn stop_sidecar() -> Result<(), String> {
    let mut process = SIDECAR_PROCESS.lock().unwrap();
    
    if let Some(mut child) = process.take() {
        child.kill().map_err(|e| format!("Failed to stop sidecar: {}", e))?;
    }
    
    Ok(())
}
```

### 配置

```typescript
// config/seekdb.ts
export const seekdbConfig = {
  sidecar: {
    port: 8765,
    host: 'localhost',
    startupTimeout: 5000,
    healthCheckInterval: 30000,
  },
  database: {
    path: './data/echo.seekdb',
    collections: ['notes', 'tasks', 'reminders', 'memories'],
  },
  embedding: {
    model: 'DefaultEmbeddingFunction',
    dimensions: 384,
  },
};
```
