# SeekDB 参考文档

SeekDB 是 OceanBase 在 2025年11月开源的 AI 原生搜索数据库。

## 核心特性

- **统一存储**: 向量、文本、结构化数据、JSON 在一个引擎
- **混合搜索**: 单条 SQL 同时做向量搜索 + 全文搜索 + 关系查询
- **内置 AI**: embedding、reranking、LLM 推理在数据库内完成
- **嵌入式模式**: 支持本地嵌入，适合桌面应用
- **MySQL 兼容**: 学习成本低

## 安装

```bash
pip install pyseekdb
```

## Python SDK 使用

### 嵌入式模式 (推荐用于桌面应用)

```python
import pyseekdb
from pyseekdb import DefaultEmbeddingFunction

# 创建嵌入式客户端
client = pyseekdb.Client(
    path="./echo.db",  # 本地数据库路径
    database="echo"
)

# 创建集合 (带自动 embedding)
collection = client.create_collection(
    name="notes",
    embedding_function=DefaultEmbeddingFunction()  # 384 维向量
)

# 添加文档 (自动生成向量)
collection.add(
    ids=["note1", "note2"],
    documents=[
        "今天学习了 SeekDB，很强大",
        "明天要完成项目报告"
    ],
    metadatas=[
        {"domain": "learning", "type": "note"},
        {"domain": "work", "type": "task"}
    ]
)

# 语义搜索
results = collection.query(
    query_texts="数据库学习",
    n_results=5
)

# 获取结果
for i, doc_id in enumerate(results['ids'][0]):
    print(f"ID: {doc_id}")
    print(f"Distance: {results['distances'][0][i]}")
    print(f"Document: {results['documents'][0][i]}")
```

### 服务器模式

```python
# 连接远程 SeekDB 服务器
client = pyseekdb.Client(
    host="127.0.0.1",
    port=2881,
    database="test",
    user="root",
    password=""
)
```

## SQL 使用

### 创建表

```sql
-- 创建带向量列的表
CREATE TABLE articles (
    id INT PRIMARY KEY,
    title TEXT,
    content TEXT,
    embedding VECTOR(384),
    FULLTEXT INDEX idx_fts(content) WITH PARSER ik,
    VECTOR INDEX idx_vec (embedding) WITH(DISTANCE=l2, TYPE=hnsw, LIB=vsag)
) ORGANIZATION = HEAP;
```

### 混合搜索

```sql
-- 向量搜索 + 全文搜索
SELECT
    title,
    content,
    l2_distance(embedding, '[query_embedding]') AS vector_distance,
    MATCH(content) AGAINST('关键词' IN NATURAL LANGUAGE MODE) AS text_score
FROM articles
WHERE MATCH(content) AGAINST('关键词' IN NATURAL LANGUAGE MODE)
ORDER BY vector_distance APPROXIMATE
LIMIT 10;
```

## 与 Tauri 集成

### 方案 1: Python Sidecar

```rust
// src-tauri/src/main.rs
use tauri::Manager;
use std::process::Command;

#[tauri::command]
async fn search_notes(query: String) -> Result<String, String> {
    let output = Command::new("python3")
        .args(["scripts/search.py", &query])
        .output()
        .map_err(|e| e.to_string())?;
    
    String::from_utf8(output.stdout)
        .map_err(|e| e.to_string())
}
```

### 方案 2: HTTP API

```python
# ai_service/server.py
from fastapi import FastAPI
import pyseekdb

app = FastAPI()
client = pyseekdb.Client(path="./echo.db", database="echo")

@app.post("/search")
async def search(query: str):
    collection = client.get_collection("notes")
    results = collection.query(query_texts=query, n_results=10)
    return results
```

```rust
// Tauri 调用 HTTP API
#[tauri::command]
async fn search_notes(query: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:8000/search")
        .json(&serde_json::json!({"query": query}))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    response.text().await.map_err(|e| e.to_string())
}
```

## 数据模型示例

```python
# 笔记集合
notes_collection = client.create_collection(
    name="notes",
    embedding_function=DefaultEmbeddingFunction(),
    metadata={"description": "用户笔记"}
)

# 任务集合
tasks_collection = client.create_collection(
    name="tasks",
    embedding_function=DefaultEmbeddingFunction(),
    metadata={"description": "待办任务"}
)

# 记忆集合 (用于 AI 记忆)
memories_collection = client.create_collection(
    name="memories",
    embedding_function=DefaultEmbeddingFunction(),
    metadata={"description": "AI 记忆"}
)
```

## 注意事项

1. **嵌入式模式限制**: 单进程访问，适合桌面应用
2. **向量维度**: DefaultEmbeddingFunction 使用 384 维
3. **数据持久化**: 数据存储在指定的 path 目录
4. **并发**: 嵌入式模式不支持多进程并发写入
