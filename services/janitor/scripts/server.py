#!/usr/bin/env python3
"""
SeekDB 搜索 API 服务
FastAPI 实现的混合搜索接口（向量 + 全文）+ Paperless 兼容 API

启动方式: uvicorn server:app --host 0.0.0.0 --port 8765
"""

import os
import json
import uuid
import shutil
import logging
from typing import Optional, List
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
import mysql.connector
from mysql.connector import Error as MySQLError

# 导入 embedding 服务
from embedding_service import EmbeddingService, generate_embedding

# ============== 日志配置 ==============

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== 配置 ==============

SEEKDB_HOST = os.getenv('SEEKDB_HOST', 'localhost')
SEEKDB_PORT = int(os.getenv('SEEKDB_PORT', '2881'))
SEEKDB_USER = os.getenv('SEEKDB_USER', 'root')
SEEKDB_PASSWORD = os.getenv('SEEKDB_PASSWORD', '')
SEEKDB_DATABASE = os.getenv('SEEKDB_DATABASE', 'echo')

# 文件存储路径 (本地开发时使用相对路径)
_default_storage = Path(__file__).parent.parent / 'storage'
STORAGE_PATH = Path(os.getenv('STORAGE_PATH', str(_default_storage)))
STORAGE_PATH.mkdir(parents=True, exist_ok=True)
(STORAGE_PATH / 'documents').mkdir(exist_ok=True)
(STORAGE_PATH / 'thumbnails').mkdir(exist_ok=True)

# ============== 数据模型 ==============

# --- 搜索相关 ---
class SearchRequest(BaseModel):
    """搜索请求"""
    query: str = Field(..., min_length=1, description="搜索查询")
    alpha: float = Field(default=0.5, ge=0.0, le=1.0, description="向量权重 (0=纯文本, 1=纯向量)")
    source_type: Optional[str] = Field(default=None, description="来源类型过滤")
    limit: int = Field(default=20, ge=1, le=100, description="返回结果数量")

class SearchResultItem(BaseModel):
    """单条搜索结果"""
    id: str
    content: str
    source_type: str
    source_path: str
    metadata: dict
    score: float
    text_score: Optional[float] = None  # 全文搜索分数
    vector_score: Optional[float] = None  # 向量搜索分数
    created_at: Optional[str] = None

class SearchResponse(BaseModel):
    """搜索响应"""
    results: List[SearchResultItem]
    total: int
    query: str
    alpha: float
    embedding_available: bool = True  # 是否使用了向量搜索

class EmbeddingRequest(BaseModel):
    """Embedding 生成请求"""
    text: str = Field(..., min_length=1, description="要生成 embedding 的文本")

class EmbeddingResponse(BaseModel):
    """Embedding 生成响应"""
    embedding: Optional[List[float]] = None
    dimension: Optional[int] = None
    success: bool
    error: Optional[str] = None

# --- Paperless 兼容模型 ---
class PaperlessDocument(BaseModel):
    """Paperless 文档格式"""
    id: int
    title: str
    content: str = ""
    created: str
    modified: str
    added: str
    correspondent: Optional[int] = None
    document_type: Optional[int] = None
    tags: List[int] = []
    archive_serial_number: Optional[int] = None
    original_file_name: str = ""
    archived_file_name: str = ""

class PaperlessTag(BaseModel):
    """Paperless 标签格式"""
    id: int
    name: str
    color: str = "#a6cee3"
    match: str = ""
    matching_algorithm: int = 0
    is_insensitive: bool = True

class PaperlessDocumentType(BaseModel):
    """Paperless 文档类型格式"""
    id: int
    name: str
    match: str = ""
    matching_algorithm: int = 0
    is_insensitive: bool = True

class PaperlessCorrespondent(BaseModel):
    """Paperless 通讯者格式"""
    id: int
    name: str
    match: str = ""
    matching_algorithm: int = 0
    is_insensitive: bool = True

class PaginatedResponse(BaseModel):
    """分页响应"""
    count: int
    next: Optional[str] = None
    previous: Optional[str] = None
    results: List[dict]

class CreateTagRequest(BaseModel):
    """创建标签请求"""
    name: str
    color: str = "#a6cee3"

class CreateDocumentTypeRequest(BaseModel):
    """创建文档类型请求"""
    name: str

class UpdateDocumentRequest(BaseModel):
    """更新文档请求"""
    title: Optional[str] = None
    tags: Optional[List[int]] = None
    document_type: Optional[int] = None
    correspondent: Optional[int] = None

class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    database: str
    timestamp: str

# ============== 数据库连接 ==============

def get_db_connection():
    """获取 SeekDB 数据库连接"""
    try:
        conn = mysql.connector.connect(
            host=SEEKDB_HOST,
            port=SEEKDB_PORT,
            user=SEEKDB_USER,
            password=SEEKDB_PASSWORD,
            database=SEEKDB_DATABASE,
            charset='utf8mb4',
            collation='utf8mb4_unicode_ci',
            use_unicode=True
        )
        # 确保连接使用 UTF-8
        cursor = conn.cursor()
        cursor.execute("SET NAMES utf8mb4")
        cursor.execute("SET CHARACTER SET utf8mb4")
        cursor.execute("SET character_set_connection=utf8mb4")
        cursor.close()
        return conn
    except MySQLError as e:
        logger.error(f"数据库连接失败: {e}")
        raise HTTPException(status_code=503, detail=f"数据库连接失败: {e}")

# ============== 辅助函数 ==============

def format_datetime(dt) -> str:
    """格式化日期时间为 ISO 8601"""
    if dt is None:
        return datetime.now().isoformat() + "Z"
    if isinstance(dt, str):
        return dt
    return dt.isoformat() + "Z"

def get_document_tags(cursor, document_id: int) -> List[int]:
    """获取文档的标签 ID 列表"""
    cursor.execute(
        "SELECT tag_id FROM document_tags WHERE document_id = %s",
        (document_id,)
    )
    return [row['tag_id'] for row in cursor.fetchall()]

def row_to_paperless_document(row: dict, tags: List[int]) -> dict:
    """将数据库行转换为 Paperless 文档格式"""
    return {
        "id": row['id'],
        "title": row['title'] or "",
        "content": row['content'] or "",
        "created": format_datetime(row['created']),
        "modified": format_datetime(row['modified']),
        "added": format_datetime(row['added']),
        "correspondent": row.get('correspondent_id'),
        "document_type": row.get('document_type_id'),
        "tags": tags,
        "archive_serial_number": row.get('archive_serial_number'),
        "original_file_name": row.get('original_file_name') or "",
        "archived_file_name": row.get('archived_file_name') or "",
    }

# ============== FastAPI 应用 ==============

app = FastAPI(
    title="Echo SeekDB API",
    description="混合搜索 API + Paperless 兼容文档管理 API",
    version="2.0.0"
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
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        return HealthResponse(
            status="healthy",
            database="connected",
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        return HealthResponse(
            status="unhealthy",
            database=str(e),
            timestamp=datetime.now().isoformat()
        )

# ============== 搜索 API (混合搜索) ==============

# 全局 embedding 服务实例
_embedding_service: Optional[EmbeddingService] = None

def get_embedding_service() -> EmbeddingService:
    """获取 embedding 服务单例"""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service


@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """
    混合搜索接口
    
    alpha 参数控制搜索权重:
    - alpha = 0: 纯全文搜索
    - alpha = 1: 纯向量搜索
    - 0 < alpha < 1: 混合搜索，分数 = (1-alpha)*text_score + alpha*vector_score
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="查询不能为空")
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    embedding_service = get_embedding_service()
    
    try:
        # 生成查询向量（如果需要向量搜索）
        query_embedding = None
        embedding_available = False
        
        if request.alpha > 0:
            query_embedding = embedding_service.generate(request.query)
            embedding_available = query_embedding is not None
            
            if not embedding_available and request.alpha == 1.0:
                # 纯向量搜索但 embedding 不可用，回退到全文搜索
                logger.warning("Embedding 服务不可用，回退到全文搜索")
                request.alpha = 0.0
        
        # 构建搜索 SQL
        if request.alpha == 0 or not embedding_available:
            # 纯全文搜索
            results = await _text_search(cursor, request)
        elif request.alpha == 1.0 and embedding_available:
            # 纯向量搜索
            results = await _vector_search(cursor, request, query_embedding)
        else:
            # 混合搜索
            results = await _hybrid_search(cursor, request, query_embedding)
        
        return SearchResponse(
            results=results,
            total=len(results),
            query=request.query,
            alpha=request.alpha,
            embedding_available=embedding_available
        )
    finally:
        cursor.close()
        conn.close()


async def _text_search(cursor, request: SearchRequest) -> List[SearchResultItem]:
    """纯全文搜索"""
    sql = """
        SELECT 
            id, content, source_type, source_path, metadata, created_at,
            MATCH(content) AGAINST(%s IN NATURAL LANGUAGE MODE) AS text_score
        FROM knowledge_base
        WHERE MATCH(content) AGAINST(%s IN NATURAL LANGUAGE MODE)
    """
    params = [request.query, request.query]
    
    if request.source_type:
        sql += " AND source_type = %s"
        params.append(request.source_type)
    
    sql += f" ORDER BY text_score DESC LIMIT {request.limit}"
    
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    
    return _rows_to_results(rows, text_score_key='text_score')


async def _vector_search(cursor, request: SearchRequest, query_embedding: List[float]) -> List[SearchResultItem]:
    """纯向量搜索"""
    # 将 embedding 转换为 SeekDB 向量格式
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
    
    sql = """
        SELECT 
            id, content, source_type, source_path, metadata, created_at,
            l2_distance(embedding, %s) AS vector_distance
        FROM knowledge_base
        WHERE embedding IS NOT NULL
    """
    params = [embedding_str]
    
    if request.source_type:
        sql += " AND source_type = %s"
        params.append(request.source_type)
    
    sql += f" ORDER BY vector_distance ASC LIMIT {request.limit}"
    
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    
    # 将距离转换为相似度分数 (距离越小，分数越高)
    results = []
    for row in rows:
        distance = float(row.get('vector_distance', 0))
        # 使用 1/(1+distance) 将距离转换为 0-1 的相似度分数
        vector_score = 1.0 / (1.0 + distance)
        
        metadata = _parse_metadata(row.get('metadata'))
        results.append(SearchResultItem(
            id=str(row['id']),
            content=row['content'][:500] if row['content'] else '',
            source_type=row['source_type'],
            source_path=row['source_path'],
            metadata=metadata,
            score=vector_score,
            text_score=None,
            vector_score=vector_score,
            created_at=format_datetime(row['created_at'])
        ))
    
    return results


async def _hybrid_search(cursor, request: SearchRequest, query_embedding: List[float]) -> List[SearchResultItem]:
    """
    混合搜索
    
    分两步执行:
    1. 全文搜索获取候选结果
    2. 对候选结果计算向量相似度
    3. 按混合分数排序
    """
    # 第一步：全文搜索获取更多候选结果
    candidate_limit = min(request.limit * 3, 100)  # 获取 3 倍候选
    
    sql = """
        SELECT 
            id, content, source_type, source_path, metadata, created_at, embedding,
            MATCH(content) AGAINST(%s IN NATURAL LANGUAGE MODE) AS text_score
        FROM knowledge_base
        WHERE MATCH(content) AGAINST(%s IN NATURAL LANGUAGE MODE)
    """
    params = [request.query, request.query]
    
    if request.source_type:
        sql += " AND source_type = %s"
        params.append(request.source_type)
    
    sql += f" ORDER BY text_score DESC LIMIT {candidate_limit}"
    
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    
    if not rows:
        return []
    
    # 第二步：计算混合分数
    results = []
    max_text_score = max(float(row.get('text_score', 0)) for row in rows) or 1.0
    
    for row in rows:
        text_score = float(row.get('text_score', 0)) / max_text_score  # 归一化到 0-1
        
        # 计算向量相似度
        vector_score = 0.0
        if row.get('embedding'):
            try:
                # 从数据库获取的 embedding 可能是字符串格式
                doc_embedding = row['embedding']
                if isinstance(doc_embedding, str):
                    doc_embedding = json.loads(doc_embedding)
                
                # 计算余弦相似度
                vector_score = _cosine_similarity(query_embedding, doc_embedding)
            except Exception as e:
                logger.warning(f"计算向量相似度失败: {e}")
                vector_score = 0.0
        
        # 混合分数
        hybrid_score = (1 - request.alpha) * text_score + request.alpha * vector_score
        
        metadata = _parse_metadata(row.get('metadata'))
        results.append(SearchResultItem(
            id=str(row['id']),
            content=row['content'][:500] if row['content'] else '',
            source_type=row['source_type'],
            source_path=row['source_path'],
            metadata=metadata,
            score=hybrid_score,
            text_score=text_score,
            vector_score=vector_score,
            created_at=format_datetime(row['created_at'])
        ))
    
    # 按混合分数排序
    results.sort(key=lambda x: x.score, reverse=True)
    
    return results[:request.limit]


def _cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """计算余弦相似度"""
    if len(vec1) != len(vec2):
        return 0.0
    
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = sum(a * a for a in vec1) ** 0.5
    norm2 = sum(b * b for b in vec2) ** 0.5
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return dot_product / (norm1 * norm2)


def _parse_metadata(metadata) -> dict:
    """解析 metadata 字段"""
    if metadata is None:
        return {}
    if isinstance(metadata, dict):
        return metadata
    if isinstance(metadata, str):
        try:
            return json.loads(metadata)
        except:
            return {}
    return {}


def _rows_to_results(rows: List[dict], text_score_key: str = 'text_score') -> List[SearchResultItem]:
    """将数据库行转换为搜索结果"""
    results = []
    for row in rows:
        metadata = _parse_metadata(row.get('metadata'))
        text_score = float(row.get(text_score_key, 0))
        
        results.append(SearchResultItem(
            id=str(row['id']),
            content=row['content'][:500] if row['content'] else '',
            source_type=row['source_type'],
            source_path=row['source_path'],
            metadata=metadata,
            score=text_score,
            text_score=text_score,
            vector_score=None,
            created_at=format_datetime(row['created_at'])
        ))
    
    return results


# ============== Embedding API ==============

@app.post("/embedding", response_model=EmbeddingResponse)
async def generate_embedding_api(request: EmbeddingRequest):
    """生成文本的 embedding 向量"""
    embedding_service = get_embedding_service()
    
    if not embedding_service.is_available():
        return EmbeddingResponse(
            embedding=None,
            dimension=None,
            success=False,
            error="Ollama 服务不可用"
        )
    
    embedding = embedding_service.generate(request.text)
    
    if embedding is None:
        return EmbeddingResponse(
            embedding=None,
            dimension=None,
            success=False,
            error="生成 embedding 失败"
        )
    
    return EmbeddingResponse(
        embedding=embedding,
        dimension=len(embedding),
        success=True,
        error=None
    )


@app.get("/embedding/status")
async def embedding_status():
    """检查 embedding 服务状态"""
    embedding_service = get_embedding_service()
    available = embedding_service.is_available()
    
    return {
        "available": available,
        "model": embedding_service.config.model,
        "host": embedding_service.config.ollama_host
    }

# ============== Paperless 兼容 API: 文档 ==============

@app.get("/api/documents/")
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    ordering: str = Query("-added"),
    query: Optional[str] = None,
    tags__id__in: Optional[str] = None,
    document_type__id: Optional[int] = None,
):
    """获取文档列表 (Paperless 兼容)"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 构建查询
        where_clauses = []
        params = []
        
        # 搜索 - 使用 LIKE 模糊匹配（支持中文）
        if query:
            where_clauses.append("(title LIKE %s OR content LIKE %s)")
            search_pattern = f"%{query}%"
            params.extend([search_pattern, search_pattern])
        
        # 标签过滤
        if tags__id__in:
            tag_ids = [int(x) for x in tags__id__in.split(',')]
            placeholders = ','.join(['%s'] * len(tag_ids))
            where_clauses.append(f"id IN (SELECT document_id FROM document_tags WHERE tag_id IN ({placeholders}))")
            params.extend(tag_ids)
        
        # 文档类型过滤
        if document_type__id:
            where_clauses.append("document_type_id = %s")
            params.append(document_type__id)
        
        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
        
        # 排序
        order_map = {
            "-added": "added DESC",
            "added": "added ASC",
            "-created": "created DESC",
            "created": "created ASC",
            "title": "title ASC",
            "-title": "title DESC",
            "-modified": "modified DESC",
        }
        order_sql = order_map.get(ordering, "added DESC")
        
        # 计算总数
        count_sql = f"SELECT COUNT(*) as total FROM documents WHERE {where_sql}"
        cursor.execute(count_sql, params)
        total = cursor.fetchone()['total']
        
        # 分页查询
        offset = (page - 1) * page_size
        sql = f"""
            SELECT * FROM documents 
            WHERE {where_sql}
            ORDER BY {order_sql}
            LIMIT %s OFFSET %s
        """
        cursor.execute(sql, params + [page_size, offset])
        rows = cursor.fetchall()
        
        # 转换为 Paperless 格式
        results = []
        for row in rows:
            tags = get_document_tags(cursor, row['id'])
            results.append(row_to_paperless_document(row, tags))
        
        return {
            "count": total,
            "next": f"/api/documents/?page={page+1}" if offset + page_size < total else None,
            "previous": f"/api/documents/?page={page-1}" if page > 1 else None,
            "results": results
        }
    finally:
        cursor.close()
        conn.close()

@app.get("/api/documents/{document_id}/")
async def get_document(document_id: int):
    """获取单个文档详情"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("SELECT * FROM documents WHERE id = %s", (document_id,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        tags = get_document_tags(cursor, document_id)
        return row_to_paperless_document(row, tags)
    finally:
        cursor.close()
        conn.close()

@app.post("/api/documents/post_document/")
async def upload_document(
    document: UploadFile = File(...),
    title: Optional[str] = Form(None),
    document_type: Optional[int] = Form(None),
    tags: Optional[str] = Form(None),  # 逗号分隔的标签 ID
):
    """上传文档"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 保存文件
        file_id = str(uuid.uuid4())
        file_ext = Path(document.filename).suffix
        file_path = STORAGE_PATH / 'documents' / f"{file_id}{file_ext}"
        
        with open(file_path, 'wb') as f:
            content = await document.read()
            f.write(content)
        
        # 插入数据库
        doc_title = title or document.filename
        cursor.execute("""
            INSERT INTO documents (title, original_file_name, file_path, document_type_id)
            VALUES (%s, %s, %s, %s)
        """, (doc_title, document.filename, str(file_path), document_type))
        
        doc_id = cursor.lastrowid
        
        # 添加标签
        if tags:
            tag_ids = [int(x) for x in tags.split(',') if x.strip()]
            for tag_id in tag_ids:
                cursor.execute(
                    "INSERT IGNORE INTO document_tags (document_id, tag_id) VALUES (%s, %s)",
                    (doc_id, tag_id)
                )
        
        conn.commit()
        
        # 返回任务 ID (Paperless 兼容)
        return {"task_id": f"task-{doc_id}"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.patch("/api/documents/{document_id}/")
async def update_document(document_id: int, data: UpdateDocumentRequest):
    """更新文档"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 检查文档是否存在
        cursor.execute("SELECT id FROM documents WHERE id = %s", (document_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 更新字段
        updates = []
        params = []
        
        if data.title is not None:
            updates.append("title = %s")
            params.append(data.title)
        
        if data.document_type is not None:
            updates.append("document_type_id = %s")
            params.append(data.document_type)
        
        if data.correspondent is not None:
            updates.append("correspondent_id = %s")
            params.append(data.correspondent)
        
        if updates:
            sql = f"UPDATE documents SET {', '.join(updates)} WHERE id = %s"
            params.append(document_id)
            cursor.execute(sql, params)
        
        # 更新标签
        if data.tags is not None:
            cursor.execute("DELETE FROM document_tags WHERE document_id = %s", (document_id,))
            for tag_id in data.tags:
                cursor.execute(
                    "INSERT INTO document_tags (document_id, tag_id) VALUES (%s, %s)",
                    (document_id, tag_id)
                )
        
        conn.commit()
        
        # 返回更新后的文档
        cursor.execute("SELECT * FROM documents WHERE id = %s", (document_id,))
        row = cursor.fetchone()
        tags = get_document_tags(cursor, document_id)
        return row_to_paperless_document(row, tags)
    finally:
        cursor.close()
        conn.close()

@app.delete("/api/documents/{document_id}/")
async def delete_document(document_id: int):
    """删除文档"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 获取文件路径
        cursor.execute("SELECT file_path, thumbnail_path FROM documents WHERE id = %s", (document_id,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 删除文件
        if row['file_path'] and Path(row['file_path']).exists():
            Path(row['file_path']).unlink()
        if row['thumbnail_path'] and Path(row['thumbnail_path']).exists():
            Path(row['thumbnail_path']).unlink()
        
        # 删除数据库记录 (级联删除标签关联)
        cursor.execute("DELETE FROM documents WHERE id = %s", (document_id,))
        conn.commit()
        
        return {"success": True}
    finally:
        cursor.close()
        conn.close()


# ============== Paperless 兼容 API: 文件下载/预览 ==============

@app.get("/api/documents/{document_id}/download/")
async def download_document(document_id: int):
    """下载原始文档"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute(
            "SELECT file_path, original_file_name FROM documents WHERE id = %s",
            (document_id,)
        )
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        file_path = row['file_path']
        if not file_path or not Path(file_path).exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        
        return FileResponse(
            path=file_path,
            filename=row['original_file_name'],
            media_type='application/octet-stream'
        )
    finally:
        cursor.close()
        conn.close()

@app.get("/api/documents/{document_id}/preview/")
async def preview_document(document_id: int):
    """获取文档预览 (PDF)"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("SELECT file_path FROM documents WHERE id = %s", (document_id,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        file_path = row['file_path']
        if not file_path or not Path(file_path).exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        
        # 如果是 PDF，直接返回；否则返回占位符
        if file_path.lower().endswith('.pdf'):
            return FileResponse(path=file_path, media_type='application/pdf')
        else:
            # 返回一个简单的占位符响应
            return Response(
                content=b"Preview not available for this file type",
                media_type='text/plain'
            )
    finally:
        cursor.close()
        conn.close()

@app.get("/api/documents/{document_id}/thumb/")
async def get_thumbnail(document_id: int):
    """获取文档缩略图"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute(
            "SELECT thumbnail_path, file_path FROM documents WHERE id = %s",
            (document_id,)
        )
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 如果有缩略图，返回缩略图
        if row['thumbnail_path'] and Path(row['thumbnail_path']).exists():
            return FileResponse(path=row['thumbnail_path'], media_type='image/webp')
        
        # 否则返回默认占位图 (1x1 透明 PNG)
        placeholder = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
            0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
            0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
            0x42, 0x60, 0x82
        ])
        return Response(content=placeholder, media_type='image/png')
    finally:
        cursor.close()
        conn.close()

# ============== Paperless 兼容 API: 标签 ==============

@app.get("/api/tags/")
async def list_tags():
    """获取所有标签"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("SELECT * FROM tags ORDER BY name")
        rows = cursor.fetchall()
        
        results = [
            {
                "id": row['id'],
                "name": row['name'],
                "color": row['color'] or "#a6cee3",
                "match": row.get('match_text', ''),
                "matching_algorithm": row.get('matching_algorithm', 0),
                "is_insensitive": row.get('is_insensitive', True),
            }
            for row in rows
        ]
        
        return {"count": len(results), "results": results}
    finally:
        cursor.close()
        conn.close()

@app.post("/api/tags/")
async def create_tag(data: CreateTagRequest):
    """创建标签"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute(
            "INSERT INTO tags (name, color) VALUES (%s, %s)",
            (data.name, data.color)
        )
        conn.commit()
        
        tag_id = cursor.lastrowid
        return {
            "id": tag_id,
            "name": data.name,
            "color": data.color,
            "match": "",
            "matching_algorithm": 0,
            "is_insensitive": True,
        }
    except MySQLError as e:
        if "Duplicate entry" in str(e):
            raise HTTPException(status_code=400, detail="标签名称已存在")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.delete("/api/tags/{tag_id}/")
async def delete_tag(tag_id: int):
    """删除标签"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("DELETE FROM tags WHERE id = %s", (tag_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="标签不存在")
        conn.commit()
        return {"success": True}
    finally:
        cursor.close()
        conn.close()

# ============== Paperless 兼容 API: 文档类型 ==============

@app.get("/api/document_types/")
async def list_document_types():
    """获取所有文档类型"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("SELECT * FROM document_types ORDER BY name")
        rows = cursor.fetchall()
        
        results = [
            {
                "id": row['id'],
                "name": row['name'],
                "match": row.get('match_text', ''),
                "matching_algorithm": row.get('matching_algorithm', 0),
                "is_insensitive": row.get('is_insensitive', True),
            }
            for row in rows
        ]
        
        return {"count": len(results), "results": results}
    finally:
        cursor.close()
        conn.close()

@app.post("/api/document_types/")
async def create_document_type(data: CreateDocumentTypeRequest):
    """创建文档类型"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("INSERT INTO document_types (name) VALUES (%s)", (data.name,))
        conn.commit()
        
        type_id = cursor.lastrowid
        return {
            "id": type_id,
            "name": data.name,
            "match": "",
            "matching_algorithm": 0,
            "is_insensitive": True,
        }
    except MySQLError as e:
        if "Duplicate entry" in str(e):
            raise HTTPException(status_code=400, detail="文档类型名称已存在")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.delete("/api/document_types/{type_id}/")
async def delete_document_type(type_id: int):
    """删除文档类型"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("DELETE FROM document_types WHERE id = %s", (type_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="文档类型不存在")
        conn.commit()
        return {"success": True}
    finally:
        cursor.close()
        conn.close()

# ============== Paperless 兼容 API: 通讯者 ==============

@app.get("/api/correspondents/")
async def list_correspondents():
    """获取所有通讯者 (简化实现，返回空列表)"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("SELECT * FROM correspondents ORDER BY name")
        rows = cursor.fetchall()
        
        results = [
            {
                "id": row['id'],
                "name": row['name'],
                "match": row.get('match_text', ''),
                "matching_algorithm": row.get('matching_algorithm', 0),
                "is_insensitive": row.get('is_insensitive', True),
            }
            for row in rows
        ]
        
        return {"count": len(results), "results": results}
    finally:
        cursor.close()
        conn.close()

# ============== 统计 API ==============

@app.get("/api/stats/")
async def get_stats():
    """获取统计信息"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 文档总数
        cursor.execute("SELECT COUNT(*) as total FROM documents")
        doc_count = cursor.fetchone()['total']
        
        # 标签总数
        cursor.execute("SELECT COUNT(*) as total FROM tags")
        tag_count = cursor.fetchone()['total']
        
        # 文档类型总数
        cursor.execute("SELECT COUNT(*) as total FROM document_types")
        type_count = cursor.fetchone()['total']
        
        return {
            "documents": doc_count,
            "tags": tag_count,
            "document_types": type_count,
        }
    finally:
        cursor.close()
        conn.close()

# ============== 启动入口 ==============

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv('API_PORT', '8765'))
    logger.info(f"启动 SeekDB API on port {port}")
    
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info"
    )
