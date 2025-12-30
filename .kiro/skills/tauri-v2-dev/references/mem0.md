# mem0 AI 记忆框架参考

mem0 是一个为 AI 代理提供长期记忆的框架，支持 Gemini 等多种 LLM。

## 安装

```bash
pip install mem0ai
```

## 快速开始

### 基础使用 (OpenAI)

```python
from mem0 import Memory

# 初始化 (默认使用 OpenAI)
m = Memory()

# 添加记忆
messages = [
    {"role": "user", "content": "我叫 Alex，喜欢篮球和游戏"},
    {"role": "assistant", "content": "好的 Alex，我记住了你的爱好"}
]
m.add(messages, user_id="alex")

# 搜索记忆
results = m.search("你知道我什么?", filters={"user_id": "alex"})
print(results)
```

### 使用 Gemini

```python
import os
from mem0 import Memory

os.environ["OPENAI_API_KEY"] = "your-openai-api-key"  # 用于 embedding
os.environ["GOOGLE_API_KEY"] = "your-gemini-api-key"

config = {
    "llm": {
        "provider": "gemini",
        "config": {
            "model": "gemini-2.0-flash-001",
            "temperature": 0.2,
            "max_tokens": 2000,
            "top_p": 1.0
        }
    }
}

m = Memory.from_config(config)

# 添加记忆
messages = [
    {"role": "user", "content": "我正在开发一个 AI 助手应用"},
    {"role": "assistant", "content": "听起来很有趣！你用什么技术栈？"},
    {"role": "user", "content": "Tauri + React + SeekDB"}
]
m.add(messages, user_id="developer", metadata={"category": "project"})
```

## 完整配置

```python
config = {
    "llm": {
        "provider": "gemini",
        "config": {
            "model": "gemini-2.0-flash-001",
            "temperature": 0.2,
            "max_tokens": 2000
        }
    },
    "embedder": {
        "provider": "openai",
        "config": {
            "model": "text-embedding-3-small"
        }
    },
    "vector_store": {
        "provider": "qdrant",
        "config": {
            "collection_name": "echo_memories",
            "path": "./qdrant_data"  # 本地存储
        }
    },
    "history_db_path": "./mem0_history.db"
}

m = Memory.from_config(config)
```

## 核心 API

### 添加记忆

```python
# 从对话添加
m.add(messages, user_id="user123")

# 带元数据
m.add(messages, user_id="user123", metadata={
    "category": "work",
    "project": "echo"
})

# 指定 agent_id (多代理场景)
m.add(messages, user_id="user123", agent_id="assistant")
```

### 搜索记忆

```python
# 基础搜索
results = m.search("投资相关的记忆", filters={"user_id": "user123"})

# 带过滤器
results = m.search(
    "工作相关",
    filters={
        "user_id": "user123",
        "metadata": {"category": "work"}
    },
    limit=10
)
```

### 获取所有记忆

```python
# 获取用户所有记忆
all_memories = m.get_all(user_id="user123")

# 获取特定代理的记忆
agent_memories = m.get_all(agent_id="assistant")
```

### 更新记忆

```python
# 更新特定记忆
m.update(memory_id="mem_123", data="更新后的内容")
```

### 删除记忆

```python
# 删除特定记忆
m.delete(memory_id="mem_123")

# 删除用户所有记忆
m.delete_all(user_id="user123")
```

## 与 Echo 集成

### 记忆服务封装

```python
# ai_service/memory_service.py
import os
from mem0 import Memory

class EchoMemoryService:
    def __init__(self):
        os.environ["GOOGLE_API_KEY"] = os.getenv("GEMINI_API_KEY")
        
        config = {
            "llm": {
                "provider": "gemini",
                "config": {
                    "model": "gemini-2.0-flash-001",
                    "temperature": 0.2
                }
            },
            "vector_store": {
                "provider": "qdrant",
                "config": {
                    "path": "./data/memories"
                }
            }
        }
        self.memory = Memory.from_config(config)
    
    def memorize_note(self, note: dict, user_id: str):
        """将笔记存入记忆"""
        messages = [
            {"role": "user", "content": note["content"]}
        ]
        return self.memory.add(
            messages,
            user_id=user_id,
            metadata={
                "note_id": note["id"],
                "domain": note.get("domain", "general"),
                "type": "note"
            }
        )
    
    def retrieve(self, query: str, user_id: str, domain: str = None):
        """检索相关记忆"""
        filters = {"user_id": user_id}
        if domain:
            filters["metadata"] = {"domain": domain}
        
        return self.memory.search(query, filters=filters, limit=10)
    
    def get_context(self, user_id: str, limit: int = 20):
        """获取用户上下文"""
        return self.memory.get_all(user_id=user_id, limit=limit)
```

### HTTP API 服务

```python
# ai_service/server.py
from fastapi import FastAPI
from memory_service import EchoMemoryService

app = FastAPI()
memory_service = EchoMemoryService()

@app.post("/memorize")
async def memorize(note: dict, user_id: str):
    return memory_service.memorize_note(note, user_id)

@app.get("/retrieve")
async def retrieve(query: str, user_id: str, domain: str = None):
    return memory_service.retrieve(query, user_id, domain)

@app.get("/context")
async def get_context(user_id: str):
    return memory_service.get_context(user_id)
```

## 默认配置

Memory() 默认使用:
- LLM: OpenAI gpt-4.1-nano-2025-04-14
- Embeddings: OpenAI text-embedding-3-small (1536 维)
- Vector Store: Qdrant (本地存储 /tmp/qdrant)
- History: SQLite (~/.mem0/history.db)

## 注意事项

1. **API Key**: 即使使用 Gemini，也需要 OpenAI API Key 用于 embedding
2. **本地存储**: 使用 Qdrant 本地模式时，数据存储在指定路径
3. **记忆提取**: mem0 会自动从对话中提取关键信息
4. **去重**: mem0 会自动处理重复记忆
