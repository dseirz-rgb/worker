# Echo on Blinko 迁移 - 参考项目研究笔记

> 本文档记录了 Task 1 研究阶段的发现，为后续实现提供参考。

---

## 1. SeekDB 研究 (Task 1.1)

### 项目概述
- **GitHub**: https://github.com/oceanbase/seekdb
- **定位**: AI 原生搜索数据库，统一向量、文本、结构化和半结构化数据
- **许可证**: Apache 2.0

### 核心特性
| 特性 | 支持情况 |
|------|---------|
| 嵌入式模式 | ✅ |
| 向量搜索 | ✅ |
| 全文搜索 | ✅ |
| 混合搜索 | ✅ |
| MySQL 兼容 | ✅ |
| OLTP/OLAP | ✅ |

### Python SDK (pyseekdb) API

```python
import pyseekdb
from pyseekdb import DefaultEmbeddingFunction

# 1. 创建客户端 - 嵌入式模式
client = pyseekdb.Client(
    path="./seekdb.db",
    database="test"
)

# 2. 创建 Collection (带嵌入函数)
collection = client.create_collection(
    name="my_collection",
    embedding_function=DefaultEmbeddingFunction()  # 384 维向量
)

# 3. 添加文档 (自动生成嵌入)
collection.add(
    documents=["doc1", "doc2"],
    metadatas=[{"key": "value"}, {"key": "value2"}],
    ids=["id1", "id2"]
)

# 4. 查询 (自动生成查询嵌入)
results = collection.query(
    query_texts=["search query"],
    n_results=10
)

# 5. 删除 Collection
client.delete_collection("my_collection")
```

### SQL 接口 (混合搜索)

```sql
-- 创建表
CREATE TABLE articles (
    id INT PRIMARY KEY,
    title TEXT,
    content TEXT,
    embedding VECTOR(384),
    FULLTEXT INDEX idx_fts(content) WITH PARSER ik,
    VECTOR INDEX idx_vec (embedding) WITH(DISTANCE=l2, TYPE=hnsw, LIB=vsag)
) ORGANIZATION = HEAP;

-- 混合搜索
SELECT
    title,
    content,
    l2_distance(embedding, '[query_embedding]') AS vector_distance,
    MATCH(content) AGAINST('keywords' IN NATURAL LANGUAGE MODE) AS text_score
FROM articles
WHERE MATCH(content) AGAINST('keywords' IN NATURAL LANGUAGE MODE)
ORDER BY vector_distance APPROXIMATE
LIMIT 10;
```

### 适配策略
1. 使用 Python SDK 的 Collection API (类似 Chroma)
2. 嵌入式模式，无需额外服务器
3. 默认嵌入函数使用 384 维向量 (与 fastembed all-MiniLM-L6-v2 兼容)

---

## 2. fastembed-rs 研究 (Task 1.2)

### 项目概述
- **GitHub**: https://github.com/Anush008/fastembed-rs
- **定位**: Rust 本地向量嵌入生成库
- **许可证**: Apache 2.0

### 核心 API

```rust
use fastembed::{TextEmbedding, InitOptions, EmbeddingModel};

// 1. 创建模型 (默认选项)
let mut model = TextEmbedding::try_new(Default::default())?;

// 2. 创建模型 (自定义选项)
let mut model = TextEmbedding::try_new(
    InitOptions::new(EmbeddingModel::AllMiniLML6V2)
        .with_show_download_progress(true),
)?;

// 3. 生成嵌入
let documents = vec![
    "passage: Hello, World!",
    "query: Hello, World!",
];
let embeddings = model.embed(documents, None)?;

// embeddings.len() = 2
// embeddings[0].len() = 384 (向量维度)
```

### 支持的模型
- `AllMiniLML6V2` - 384 维，推荐用于一般用途
- `BGESmallENV15` - 384 维
- `BGEBaseENV15` - 768 维
- 量化版本: 添加 `Q` 后缀，如 `BGESmallENV15Q`

### Tauri 集成策略

```rust
// app/tauri-plugin-blinko/src/embedding.rs

use fastembed::{TextEmbedding, InitOptions, EmbeddingModel};
use std::sync::Mutex;
use tauri::State;

pub struct EmbeddingState(pub Mutex<Option<TextEmbedding>>);

#[tauri::command]
pub async fn embed_text(
    text: String,
    state: State<'_, EmbeddingState>
) -> Result<Vec<f32>, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    
    // 懒加载模型
    if guard.is_none() {
        let model = TextEmbedding::try_new(
            InitOptions::new(EmbeddingModel::AllMiniLML6V2)
                .with_show_download_progress(true)
        ).map_err(|e| e.to_string())?;
        *guard = Some(model);
    }
    
    let model = guard.as_ref().unwrap();
    let embeddings = model.embed(vec![text.as_str()], None)
        .map_err(|e| e.to_string())?;
    
    Ok(embeddings.into_iter().next().unwrap_or_default())
}

#[tauri::command]
pub async fn embed_batch(
    texts: Vec<String>,
    state: State<'_, EmbeddingState>
) -> Result<Vec<Vec<f32>>, String> {
    // 类似实现...
}
```

### 关键点
- 首次运行自动下载模型 (~90MB)
- 模型缓存在本地，后续启动无需下载
- 完全离线工作
- 向量维度: 384 (all-MiniLM-L6-v2)

---

## 3. mem0 研究 (Task 1.3)

### 项目概述
- **GitHub**: https://github.com/mem0ai/mem0
- **定位**: AI 代理的通用记忆层
- **许可证**: Apache 2.0

### 核心概念

mem0 的记忆系统基于三层架构：

```
┌─────────────────────────────────────────┐
│           Memory Category               │
│  (偏好、事实、关系、事件等分类)           │
├─────────────────────────────────────────┤
│           Memory Item                   │
│  (从资源中提取的具体记忆项)              │
├─────────────────────────────────────────┤
│           Memory Resource               │
│  (原始对话、笔记等来源)                  │
└─────────────────────────────────────────┘
```

### 核心 API

```python
from mem0 import Memory

# 初始化
m = Memory()

# 添加记忆 (从对话中提取)
result = m.add(
    "I prefer dark mode and use Python for most projects",
    user_id="user123"
)

# 搜索记忆
memories = m.search(
    query="What programming language does the user prefer?",
    user_id="user123"
)

# 获取所有记忆
all_memories = m.get_all(user_id="user123")

# 更新记忆
m.update(memory_id="mem_id", data="Updated preference")

# 删除记忆
m.delete(memory_id="mem_id")
```

### 记忆提取算法

mem0 使用 LLM 从对话中自动提取记忆：

1. **输入**: 用户与 AI 的对话历史
2. **处理**: LLM 分析对话，识别关键信息
3. **输出**: 结构化的记忆项

```python
# 记忆提取 Prompt 示例
EXTRACTION_PROMPT = """
分析以下对话，提取用户的关键信息：
- 偏好 (喜好、习惯)
- 事实 (个人信息、工作等)
- 关系 (人际关系)
- 事件 (重要事件、计划)

对话:
{conversation}

返回 JSON 格式:
[
  {"type": "preference", "content": "...", "confidence": 0.9},
  {"type": "fact", "content": "...", "confidence": 0.8}
]
"""
```

### 适配策略

```typescript
// server/aiServer/memory.ts

interface MemoryItem {
  id: number;
  content: string;
  type: 'fact' | 'preference' | 'relationship' | 'event';
  confidence: number;
  resourceId: number;
  categoryId?: number;
}

interface MemoryService {
  // 从对话提取记忆
  extractFromConversation(messages: Message[]): Promise<MemoryItem[]>;
  
  // 语义搜索记忆
  searchMemories(query: string, limit?: number): Promise<MemoryItem[]>;
  
  // 获取 AI 上下文
  getContextForQuery(query: string): Promise<string>;
  
  // 更新记忆 (处理冲突)
  updateMemory(id: number, content: string): Promise<MemoryItem>;
}
```

---

## 4. notify crate 研究 (Task 1.4)

### 项目概述
- **Crates.io**: https://crates.io/crates/notify
- **定位**: 跨平台文件系统通知库
- **许可证**: CC0-1.0

### 核心 API

```rust
use notify::{Event, RecursiveMode, Result, Watcher};
use std::{path::Path, sync::mpsc};

fn main() -> Result<()> {
    let (tx, rx) = mpsc::channel::<Result<Event>>();

    // 创建推荐的 Watcher (自动选择最佳实现)
    let mut watcher = notify::recommended_watcher(tx)?;

    // 添加监控路径
    watcher.watch(Path::new("."), RecursiveMode::Recursive)?;

    // 处理事件
    for res in rx {
        match res {
            Ok(event) => println!("event: {:?}", event),
            Err(e) => println!("watch error: {:?}", e),
        }
    }

    Ok(())
}
```

### 事件类型

```rust
pub enum EventKind {
    Any,
    Access(AccessKind),
    Create(CreateKind),
    Modify(ModifyKind),
    Remove(RemoveKind),
    Other,
}

pub enum CreateKind {
    Any,
    File,
    Folder,
    Other,
}

pub enum ModifyKind {
    Any,
    Data(DataChange),
    Metadata(MetadataKind),
    Name(RenameMode),
    Other,
}

pub enum RemoveKind {
    Any,
    File,
    Folder,
    Other,
}
```

### 平台支持
| 平台 | 后端 |
|------|------|
| Linux | inotify |
| macOS | FSEvents |
| Windows | ReadDirectoryChangesW |
| 其他 | PollWatcher (轮询) |

### 已知问题
1. **网络文件系统**: NFS 等可能不触发事件，需使用 PollWatcher
2. **Docker on M1 Mac**: 需手动使用 PollWatcher
3. **编辑器行为**: 不同编辑器保存文件的方式不同，事件可能不一致

### Tauri 集成策略

```rust
// app/tauri-plugin-blinko/src/file_watcher.rs

use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc;
use tauri::{AppHandle, Emitter};

pub struct FileWatcherService {
    watcher: RecommendedWatcher,
    watched_paths: Vec<PathBuf>,
}

impl FileWatcherService {
    pub fn new(app: AppHandle) -> notify::Result<Self> {
        let (tx, rx) = mpsc::channel();
        
        let watcher = RecommendedWatcher::new(
            move |res: notify::Result<Event>| {
                tx.send(res).ok();
            },
            Config::default(),
        )?;
        
        // 在后台线程处理事件
        std::thread::spawn(move || {
            for res in rx {
                if let Ok(event) = res {
                    // 过滤隐藏文件和临时文件
                    if should_process_event(&event) {
                        app.emit("file-change", &event).ok();
                    }
                }
            }
        });
        
        Ok(Self {
            watcher,
            watched_paths: Vec::new(),
        })
    }
    
    pub fn add_watch(&mut self, path: PathBuf, recursive: bool) -> notify::Result<()> {
        let mode = if recursive {
            RecursiveMode::Recursive
        } else {
            RecursiveMode::NonRecursive
        };
        self.watcher.watch(&path, mode)?;
        self.watched_paths.push(path);
        Ok(())
    }
    
    pub fn remove_watch(&mut self, path: &PathBuf) -> notify::Result<()> {
        self.watcher.unwatch(path)?;
        self.watched_paths.retain(|p| p != path);
        Ok(())
    }
}

fn should_process_event(event: &Event) -> bool {
    event.paths.iter().all(|p| {
        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
        !name.starts_with('.') && !name.starts_with('~')
    })
}
```

---

## 总结

### 技术选型确认

| 组件 | 选择 | 理由 |
|------|------|------|
| 向量数据库 | SeekDB | 统一向量+全文+SQL，嵌入式模式 |
| 本地嵌入 | fastembed-rs | Rust 原生，完全离线，384 维向量 |
| AI 记忆 | mem0 架构 | 三层记忆模型，自动提取 |
| 文件监控 | notify crate | 跨平台，事件驱动 |

### 下一步

1. ✅ Task 1.1-1.4 研究完成
2. ⏳ Task 1.5 Checkpoint - 等待用户确认
3. ⏳ Task 2 开始实现 SeekDB 集成

---

*研究日期: 2025-12-30*

---

## 实现进度

### Task 2: SeekDB 向量存储服务 ✅

**完成日期**: 2025-12-30

**实现文件**:
- `echo/src/services/database/seekdbVectorStore.ts` - SeekDB 适配器
- `echo/src/services/database/seekdbService.ts` - Sidecar 客户端 (扩展)
- `echo/sidecar/main.py` - Python Sidecar (扩展 Blinko 兼容 API)
- `echo/src/services/database/seekdbVectorStore.test.ts` - 属性测试

**关键接口** (Blinko 兼容):
```typescript
interface SeekDBVectorStore {
  createIndex(params: CreateIndexParams): Promise<void>;
  deleteIndex(params: DeleteIndexParams): Promise<void>;
  truncateIndex(params: TruncateIndexParams): Promise<void>;
  upsert(params: UpsertParams): Promise<void>;
  query(params: QueryParams): Promise<QueryResult[]>;
  similaritySearch(indexName, queryText, topK, filter?): Promise<QueryResult[]>;
  hybridSearch(params): Promise<QueryResult[]>;
}
```

**属性测试** (5 个，全部通过):
- P1: 插入后可检索
- P2: 删除后不可检索
- P3: 相似度单调性
- P4: 向量维度一致
- P5: 批量操作等价性

---

### Task 3: fastembed-rs 本地嵌入服务 ✅

**完成日期**: 2025-12-30

**实现文件**:
- `echo/src-tauri/src/embedding.rs` - Rust 嵌入服务
- `echo/src/services/embedding/index.ts` - TypeScript 绑定
- `echo/src-tauri/Cargo.toml` - 添加 fastembed 依赖

**Tauri 命令**:
- `init_embedding_service` - 初始化服务 (首次下载模型)
- `embed_text` - 单条文本嵌入
- `embed_batch` - 批量文本嵌入
- `get_embedding_status` - 获取服务状态
- `get_embedding_dimension` - 获取向量维度

**TypeScript API**:
```typescript
// 便捷函数
embedText(text: string): Promise<number[]>
embedBatch(texts: string[]): Promise<number[][]>
cosineSimilarity(a: number[], b: number[]): number
findMostSimilar(query, vectors, topK): Array<{index, score}>

// 服务类
class EmbeddingService {
  initialize(): Promise<boolean>
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
  getStatus(): Promise<EmbeddingServiceStatus>
  getDimension(): number
}
```

---

### 下一步: Task 4 - mem0 记忆服务

待实现...
