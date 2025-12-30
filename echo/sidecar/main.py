"""
Echo SeekDB Sidecar - AI 原生搜索数据库服务

基于 ChromaDB 实现向量搜索、全文搜索和混合搜索功能。
为 Echo Tauri 应用提供 REST API 接口。
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Optional, List
from datetime import datetime
import numpy as np

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import chromadb
from chromadb.config import Settings

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 数据库路径配置
DATA_DIR = os.environ.get("ECHO_DATA_DIR", "./data")
DB_PATH = os.path.join(DATA_DIR, "echo.chromadb")

# ChromaDB 客户端
client: Optional[chromadb.PersistentClient] = None

# Collection 名称
COLLECTIONS = ["notes", "tasks", "reminders", "memories"]


# ============== Pydantic 数据模型 ==============

class NoteCreate(BaseModel):
    """创建笔记请求"""
    id: str
    content: str
    domain: str = "general"
    tags: List[str] = Field(default_factory=list)
    created_at: Optional[str] = None


class NoteUpdate(BaseModel):
    """更新笔记请求"""
    content: Optional[str] = None
    domain: Optional[str] = None
    tags: Optional[List[str]] = None


class NoteResponse(BaseModel):
    """笔记响应"""
    id: str
    content: str
    metadata: dict


class TaskCreate(BaseModel):
    """创建任务请求"""
    id: str
    title: str
    description: str = ""
    priority: str = "medium"
    status: str = "pending"
    deadline: Optional[str] = None
    domain: str = "general"
    created_at: Optional[str] = None


class TaskUpdate(BaseModel):
    """更新任务请求"""
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    deadline: Optional[str] = None
    domain: Optional[str] = None
    completed_at: Optional[str] = None


class MemoryCreate(BaseModel):
    """创建记忆请求"""
    id: str
    content: str
    user_id: str = "default"
    source: str = "chat"
    source_id: Optional[str] = None
    category: str = "general"
    domain: str = "general"
    created_at: Optional[str] = None


class SearchQuery(BaseModel):
    """搜索请求"""
    query: str
    collection: str = "notes"
    limit: int = 10
    domain: Optional[str] = None
    search_type: str = "hybrid"  # vector, fulltext, hybrid


class VectorSearchQuery(BaseModel):
    """向量搜索请求 (Blinko 兼容)"""
    index_name: str = "blinko"
    query_vector: List[float]
    top_k: int = 10
    filter: Optional[dict] = None


class VectorUpsertRequest(BaseModel):
    """向量 Upsert 请求 (Blinko 兼容)"""
    index_name: str = "blinko"
    vectors: List[List[float]]
    metadata: List[dict]
    ids: Optional[List[str]] = None


class CreateIndexRequest(BaseModel):
    """创建索引请求"""
    index_name: str
    dimension: int = 384
    metric: str = "cosine"


class DeleteIndexRequest(BaseModel):
    """删除索引请求"""
    index_name: str


class TruncateIndexRequest(BaseModel):
    """清空索引请求"""
    index_name: str


class SearchResult(BaseModel):
    """搜索结果"""
    id: str
    content: str
    score: float
    metadata: dict


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    database: str
    collections: List[str]


# ============== 生命周期管理 ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    global client
    
    # 启动时初始化数据库
    logger.info(f"初始化 ChromaDB，数据目录: {DB_PATH}")
    os.makedirs(DATA_DIR, exist_ok=True)
    
    client = chromadb.PersistentClient(
        path=DB_PATH,
        settings=Settings(
            anonymized_telemetry=False,
            allow_reset=True
        )
    )
    
    # 初始化 collections
    init_collections()
    logger.info("ChromaDB 初始化完成")
    
    yield
    
    # 关闭时清理
    logger.info("关闭 ChromaDB 连接")


def init_collections():
    """初始化所有数据集合"""
    for name in COLLECTIONS:
        try:
            client.get_or_create_collection(
                name=name,
                metadata={"hnsw:space": "cosine"}
            )
            logger.info(f"Collection '{name}' 已就绪")
        except Exception as e:
            logger.error(f"创建 Collection '{name}' 失败: {e}")


# ============== FastAPI 应用 ==============

app = FastAPI(
    title="Echo SeekDB Sidecar",
    description="AI 原生搜索数据库服务",
    version="0.1.0",
    lifespan=lifespan
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== 健康检查 ==============

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """健康检查端点"""
    try:
        collections = [c.name for c in client.list_collections()]
        return HealthResponse(
            status="healthy",
            database="chromadb",
            collections=collections
        )
    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        raise HTTPException(status_code=503, detail=str(e))


# ============== Notes API ==============

@app.post("/notes", response_model=dict)
async def create_note(note: NoteCreate):
    """创建笔记，自动生成 embedding"""
    try:
        collection = client.get_collection("notes")
        created_at = note.created_at or datetime.now().isoformat()
        
        collection.add(
            ids=[note.id],
            documents=[note.content],
            metadatas=[{
                "domain": note.domain,
                "tags": ",".join(note.tags),
                "created_at": created_at,
                "updated_at": created_at
            }]
        )
        return {"id": note.id, "status": "created"}
    except Exception as e:
        logger.error(f"创建笔记失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/notes/{note_id}", response_model=NoteResponse)
async def get_note(note_id: str):
    """获取单条笔记"""
    try:
        collection = client.get_collection("notes")
        result = collection.get(ids=[note_id])
        
        if not result["ids"]:
            raise HTTPException(status_code=404, detail="笔记不存在")
        
        return NoteResponse(
            id=result["ids"][0],
            content=result["documents"][0],
            metadata=result["metadatas"][0]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取笔记失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/notes", response_model=List[NoteResponse])
async def list_notes(limit: int = 100, domain: Optional[str] = None):
    """列出所有笔记"""
    try:
        collection = client.get_collection("notes")
        
        where = {"domain": domain} if domain else None
        result = collection.get(limit=limit, where=where)
        
        notes = []
        for i, doc_id in enumerate(result["ids"]):
            notes.append(NoteResponse(
                id=doc_id,
                content=result["documents"][i],
                metadata=result["metadatas"][i]
            ))
        return notes
    except Exception as e:
        logger.error(f"列出笔记失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/notes/{note_id}", response_model=dict)
async def update_note(note_id: str, note: NoteUpdate):
    """更新笔记，重新生成 embedding"""
    try:
        collection = client.get_collection("notes")
        
        # 获取现有数据
        existing = collection.get(ids=[note_id])
        if not existing["ids"]:
            raise HTTPException(status_code=404, detail="笔记不存在")
        
        # 准备更新数据
        current_metadata = existing["metadatas"][0]
        new_content = note.content or existing["documents"][0]
        
        new_metadata = {
            "domain": note.domain or current_metadata.get("domain", "general"),
            "tags": ",".join(note.tags) if note.tags else current_metadata.get("tags", ""),
            "created_at": current_metadata.get("created_at", datetime.now().isoformat()),
            "updated_at": datetime.now().isoformat()
        }
        
        collection.update(
            ids=[note_id],
            documents=[new_content],
            metadatas=[new_metadata]
        )
        return {"id": note_id, "status": "updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新笔记失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/notes/{note_id}", response_model=dict)
async def delete_note(note_id: str):
    """删除笔记"""
    try:
        collection = client.get_collection("notes")
        collection.delete(ids=[note_id])
        return {"id": note_id, "status": "deleted"}
    except Exception as e:
        logger.error(f"删除笔记失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Tasks API ==============

@app.post("/tasks", response_model=dict)
async def create_task(task: TaskCreate):
    """创建任务"""
    try:
        collection = client.get_collection("tasks")
        created_at = task.created_at or datetime.now().isoformat()
        
        # 合并 title 和 description 作为文档内容（用于 embedding）
        content = f"{task.title}\n{task.description}"
        
        collection.add(
            ids=[task.id],
            documents=[content],
            metadatas=[{
                "title": task.title,
                "description": task.description,
                "priority": task.priority,
                "status": task.status,
                "deadline": task.deadline or "",
                "domain": task.domain,
                "created_at": created_at,
                "completed_at": ""
            }]
        )
        return {"id": task.id, "status": "created"}
    except Exception as e:
        logger.error(f"创建任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tasks/{task_id}", response_model=NoteResponse)
async def get_task(task_id: str):
    """获取单个任务"""
    try:
        collection = client.get_collection("tasks")
        result = collection.get(ids=[task_id])
        
        if not result["ids"]:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        return NoteResponse(
            id=result["ids"][0],
            content=result["documents"][0],
            metadata=result["metadatas"][0]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tasks", response_model=List[NoteResponse])
async def list_tasks(limit: int = 100, status: Optional[str] = None):
    """列出所有任务"""
    try:
        collection = client.get_collection("tasks")
        
        where = {"status": status} if status else None
        result = collection.get(limit=limit, where=where)
        
        tasks = []
        for i, doc_id in enumerate(result["ids"]):
            tasks.append(NoteResponse(
                id=doc_id,
                content=result["documents"][i],
                metadata=result["metadatas"][i]
            ))
        return tasks
    except Exception as e:
        logger.error(f"列出任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/tasks/{task_id}", response_model=dict)
async def update_task(task_id: str, task: TaskUpdate):
    """更新任务"""
    try:
        collection = client.get_collection("tasks")
        
        existing = collection.get(ids=[task_id])
        if not existing["ids"]:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        current_metadata = existing["metadatas"][0]
        
        new_title = task.title or current_metadata.get("title", "")
        new_description = task.description or current_metadata.get("description", "")
        new_content = f"{new_title}\n{new_description}"
        
        new_metadata = {
            "title": new_title,
            "description": new_description,
            "priority": task.priority or current_metadata.get("priority", "medium"),
            "status": task.status or current_metadata.get("status", "pending"),
            "deadline": task.deadline or current_metadata.get("deadline", ""),
            "domain": task.domain or current_metadata.get("domain", "general"),
            "created_at": current_metadata.get("created_at", ""),
            "completed_at": task.completed_at or current_metadata.get("completed_at", "")
        }
        
        collection.update(
            ids=[task_id],
            documents=[new_content],
            metadatas=[new_metadata]
        )
        return {"id": task_id, "status": "updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/tasks/{task_id}", response_model=dict)
async def delete_task(task_id: str):
    """删除任务"""
    try:
        collection = client.get_collection("tasks")
        collection.delete(ids=[task_id])
        return {"id": task_id, "status": "deleted"}
    except Exception as e:
        logger.error(f"删除任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Memories API ==============

@app.post("/memories", response_model=dict)
async def create_memory(memory: MemoryCreate):
    """创建记忆"""
    try:
        collection = client.get_collection("memories")
        created_at = memory.created_at or datetime.now().isoformat()
        
        collection.add(
            ids=[memory.id],
            documents=[memory.content],
            metadatas=[{
                "user_id": memory.user_id,
                "source": memory.source,
                "source_id": memory.source_id or "",
                "category": memory.category,
                "domain": memory.domain,
                "created_at": created_at
            }]
        )
        return {"id": memory.id, "status": "created"}
    except Exception as e:
        logger.error(f"创建记忆失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/memories/{memory_id}", response_model=NoteResponse)
async def get_memory(memory_id: str):
    """获取单条记忆"""
    try:
        collection = client.get_collection("memories")
        result = collection.get(ids=[memory_id])
        
        if not result["ids"]:
            raise HTTPException(status_code=404, detail="记忆不存在")
        
        return NoteResponse(
            id=result["ids"][0],
            content=result["documents"][0],
            metadata=result["metadatas"][0]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取记忆失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/memories", response_model=List[NoteResponse])
async def list_memories(limit: int = 100, user_id: Optional[str] = None, domain: Optional[str] = None):
    """列出记忆"""
    try:
        collection = client.get_collection("memories")
        
        where = {}
        if user_id:
            where["user_id"] = user_id
        if domain:
            where["domain"] = domain
        
        result = collection.get(limit=limit, where=where if where else None)
        
        memories = []
        for i, doc_id in enumerate(result["ids"]):
            memories.append(NoteResponse(
                id=doc_id,
                content=result["documents"][i],
                metadata=result["metadatas"][i]
            ))
        return memories
    except Exception as e:
        logger.error(f"列出记忆失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/memories/{memory_id}", response_model=dict)
async def delete_memory(memory_id: str):
    """删除记忆"""
    try:
        collection = client.get_collection("memories")
        collection.delete(ids=[memory_id])
        return {"id": memory_id, "status": "deleted"}
    except Exception as e:
        logger.error(f"删除记忆失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== 搜索 API ==============

@app.post("/search", response_model=List[SearchResult])
async def search(query: SearchQuery):
    """执行搜索（向量/全文/混合）"""
    try:
        collection = client.get_collection(query.collection)
        
        # 构建过滤条件
        where = {"domain": query.domain} if query.domain else None
        
        # 执行向量搜索
        results = collection.query(
            query_texts=[query.query],
            n_results=query.limit,
            where=where
        )
        
        # 格式化结果
        search_results = []
        if results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                # 计算相似度分数（距离转换为相似度）
                distance = results["distances"][0][i] if results.get("distances") else 0
                score = 1.0 - min(distance, 1.0)  # 余弦距离转相似度
                
                search_results.append(SearchResult(
                    id=doc_id,
                    content=results["documents"][0][i],
                    score=score,
                    metadata=results["metadatas"][0][i]
                ))
        
        return search_results
    except Exception as e:
        logger.error(f"搜索失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search/vector", response_model=List[SearchResult])
async def vector_search(query: SearchQuery):
    """向量搜索"""
    query.search_type = "vector"
    return await search(query)


@app.post("/search/fulltext", response_model=List[SearchResult])
async def fulltext_search(query: SearchQuery):
    """全文搜索（基于向量近似）"""
    query.search_type = "fulltext"
    return await search(query)


# ============== 导入导出 API ==============

@app.get("/export")
async def export_data():
    """导出所有数据为 JSON"""
    try:
        export_data = {}
        
        for collection_name in COLLECTIONS:
            collection = client.get_collection(collection_name)
            result = collection.get()
            
            items = []
            for i, doc_id in enumerate(result["ids"]):
                items.append({
                    "id": doc_id,
                    "content": result["documents"][i],
                    "metadata": result["metadatas"][i]
                })
            export_data[collection_name] = items
        
        return export_data
    except Exception as e:
        logger.error(f"导出数据失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/import")
async def import_data(data: dict):
    """导入 JSON 数据"""
    try:
        imported_count = 0
        
        for collection_name, items in data.items():
            if collection_name not in COLLECTIONS:
                continue
            
            collection = client.get_collection(collection_name)
            
            for item in items:
                try:
                    collection.add(
                        ids=[item["id"]],
                        documents=[item["content"]],
                        metadatas=[item["metadata"]]
                    )
                    imported_count += 1
                except Exception as e:
                    # 可能是重复 ID，尝试更新
                    try:
                        collection.update(
                            ids=[item["id"]],
                            documents=[item["content"]],
                            metadatas=[item["metadata"]]
                        )
                        imported_count += 1
                    except:
                        logger.warning(f"导入项目失败: {item['id']}")
        
        return {"imported": imported_count}
    except Exception as e:
        logger.error(f"导入数据失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Collections API ==============

@app.get("/collections")
async def list_collections():
    """列出所有集合"""
    try:
        collections = client.list_collections()
        return [{"name": c.name, "count": c.count()} for c in collections]
    except Exception as e:
        logger.error(f"列出集合失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Blinko 兼容向量 API ==============

# 索引配置存储
index_configs: dict = {}


def map_index_to_collection(index_name: str) -> str:
    """将索引名称映射到 collection 名称"""
    mapping = {
        "blinko": "notes",
        "memories": "memories",
        "tasks": "tasks",
    }
    return mapping.get(index_name, index_name)


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """计算余弦相似度"""
    a_arr = np.array(a)
    b_arr = np.array(b)
    dot_product = np.dot(a_arr, b_arr)
    norm_a = np.linalg.norm(a_arr)
    norm_b = np.linalg.norm(b_arr)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot_product / (norm_a * norm_b))


@app.post("/vector/index/create", response_model=dict)
async def create_vector_index(request: CreateIndexRequest):
    """创建向量索引 (Blinko 兼容)"""
    try:
        collection_name = map_index_to_collection(request.index_name)
        
        # 确保 collection 存在
        client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": request.metric}
        )
        
        # 保存索引配置
        index_configs[request.index_name] = {
            "dimension": request.dimension,
            "metric": request.metric,
            "collection": collection_name
        }
        
        logger.info(f"创建索引 '{request.index_name}' (维度: {request.dimension}, 度量: {request.metric})")
        return {"status": "created", "index_name": request.index_name}
    except Exception as e:
        logger.error(f"创建索引失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/vector/index/delete", response_model=dict)
async def delete_vector_index(request: DeleteIndexRequest):
    """删除向量索引 (Blinko 兼容)"""
    try:
        collection_name = map_index_to_collection(request.index_name)
        
        # 删除 collection
        try:
            client.delete_collection(collection_name)
        except Exception:
            pass  # collection 可能不存在
        
        # 移除索引配置
        index_configs.pop(request.index_name, None)
        
        logger.info(f"删除索引 '{request.index_name}'")
        return {"status": "deleted", "index_name": request.index_name}
    except Exception as e:
        logger.error(f"删除索引失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/vector/index/truncate", response_model=dict)
async def truncate_vector_index(request: TruncateIndexRequest):
    """清空向量索引 (Blinko 兼容)"""
    try:
        collection_name = map_index_to_collection(request.index_name)
        collection = client.get_collection(collection_name)
        
        # 获取所有 ID 并删除
        result = collection.get()
        if result["ids"]:
            collection.delete(ids=result["ids"])
        
        logger.info(f"清空索引 '{request.index_name}'")
        return {"status": "truncated", "index_name": request.index_name, "deleted_count": len(result["ids"])}
    except Exception as e:
        logger.error(f"清空索引失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/vector/upsert", response_model=dict)
async def vector_upsert(request: VectorUpsertRequest):
    """插入或更新向量 (Blinko 兼容)"""
    try:
        collection_name = map_index_to_collection(request.index_name)
        collection = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        
        # 生成 ID（如果未提供）
        ids = request.ids or [f"{request.index_name}_{datetime.now().timestamp()}_{i}" for i in range(len(request.vectors))]
        
        # 准备文档和元数据
        documents = []
        metadatas = []
        embeddings = []
        
        for i, (vector, meta) in enumerate(zip(request.vectors, request.metadata)):
            doc_id = ids[i] if i < len(ids) else f"{request.index_name}_{datetime.now().timestamp()}_{i}"
            text = meta.get("text", "")
            documents.append(text)
            metadatas.append({
                **meta,
                "updated_at": datetime.now().isoformat()
            })
            embeddings.append(vector)
        
        # 检查哪些 ID 已存在
        existing = collection.get(ids=ids)
        existing_ids = set(existing["ids"]) if existing["ids"] else set()
        
        # 分离新增和更新
        new_ids, new_docs, new_metas, new_embeds = [], [], [], []
        update_ids, update_docs, update_metas, update_embeds = [], [], [], []
        
        for i, doc_id in enumerate(ids):
            if doc_id in existing_ids:
                update_ids.append(doc_id)
                update_docs.append(documents[i])
                update_metas.append(metadatas[i])
                update_embeds.append(embeddings[i])
            else:
                new_ids.append(doc_id)
                new_docs.append(documents[i])
                new_metas.append(metadatas[i])
                new_embeds.append(embeddings[i])
        
        # 执行新增
        if new_ids:
            collection.add(
                ids=new_ids,
                documents=new_docs,
                metadatas=new_metas,
                embeddings=new_embeds
            )
        
        # 执行更新
        if update_ids:
            collection.update(
                ids=update_ids,
                documents=update_docs,
                metadatas=update_metas,
                embeddings=update_embeds
            )
        
        logger.info(f"Upsert 完成: 新增 {len(new_ids)}, 更新 {len(update_ids)}")
        return {
            "status": "success",
            "inserted": len(new_ids),
            "updated": len(update_ids)
        }
    except Exception as e:
        logger.error(f"Upsert 失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/vector/query", response_model=List[SearchResult])
async def vector_query(request: VectorSearchQuery):
    """向量相似度查询 (Blinko 兼容)"""
    try:
        collection_name = map_index_to_collection(request.index_name)
        collection = client.get_collection(collection_name)
        
        # 构建过滤条件
        where = None
        if request.filter:
            where = request.filter
        
        # 执行向量查询
        results = collection.query(
            query_embeddings=[request.query_vector],
            n_results=request.top_k,
            where=where,
            include=["documents", "metadatas", "distances"]
        )
        
        # 格式化结果
        search_results = []
        if results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                # 距离转换为相似度分数
                distance = results["distances"][0][i] if results.get("distances") else 0
                # 余弦距离转相似度: similarity = 1 - distance (对于归一化向量)
                score = max(0.0, 1.0 - distance)
                
                search_results.append(SearchResult(
                    id=doc_id,
                    content=results["documents"][0][i] if results.get("documents") else "",
                    score=score,
                    metadata=results["metadatas"][0][i] if results.get("metadatas") else {}
                ))
        
        return search_results
    except Exception as e:
        logger.error(f"向量查询失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/vector/delete/{index_name}")
async def vector_delete(index_name: str, ids: List[str]):
    """删除向量 (Blinko 兼容)"""
    try:
        collection_name = map_index_to_collection(index_name)
        collection = client.get_collection(collection_name)
        
        collection.delete(ids=ids)
        
        logger.info(f"删除向量: {len(ids)} 条")
        return {"status": "deleted", "count": len(ids)}
    except Exception as e:
        logger.error(f"删除向量失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/vector/delete")
async def vector_delete_post(index_name: str, ids: List[str]):
    """删除向量 (POST 方式)"""
    return await vector_delete(index_name, ids)


# ============== 主入口 ==============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
