#!/usr/bin/env python3
"""
Echo SeekDB API 服务 v2

双数据库架构：PostgreSQL (主) + SeekDB (向量)

新特性：
- SearchRouter: alpha 参数路由搜索
- SyncService: PostgreSQL → SeekDB 同步
- 健康检查与监控端点
- 降级模式支持

启动方式: uvicorn server_v2:app --host 0.0.0.0 --port 8765
"""

import os
import logging
from typing import Optional, List
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# 导入新组件
from search_router import get_search_router, SearchResponse as RouterSearchResponse
from sync_service import get_sync_service
from health_metrics import get_health_metrics_service

# ============== 日志配置 ==============

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== 数据模型 ==============

class SearchRequest(BaseModel):
    """搜索请求"""
    query: str = Field(..., min_length=1, description="搜索查询")
    alpha: float = Field(default=0.5, ge=0.0, le=1.0, description="向量权重 (0=纯FTS, 1=纯向量)")
    source_type: Optional[str] = Field(default=None, description="来源类型过滤")
    limit: int = Field(default=20, ge=1, le=100, description="返回结果数量")


class SearchResultItem(BaseModel):
    """搜索结果项"""
    id: str
    content: str
    source_type: str
    source_path: str
    metadata: dict
    score: float
    text_score: Optional[float] = None
    vector_score: Optional[float] = None
    created_at: Optional[str] = None
    backend: str = ""


class SearchResponse(BaseModel):
    """搜索响应"""
    results: List[SearchResultItem]
    total: int
    query: str
    alpha: float
    backend_used: str
    embedding_available: bool
    postgres_latency_ms: Optional[float] = None
    seekdb_latency_ms: Optional[float] = None
    total_latency_ms: float
    degraded: bool = False
    degraded_reason: Optional[str] = None


class SyncRequest(BaseModel):
    """同步请求"""
    doc_id: int
    operation: str = Field(..., pattern="^(create|update|delete)$")
    content: Optional[str] = None
    source_type: str = ""
    source_path: str = ""
    metadata: dict = {}


class SyncResponse(BaseModel):
    """同步响应"""
    task_id: str
    status: str


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    timestamp: str
    services: dict
    degraded_reason: Optional[str] = None


class MetricsResponse(BaseModel):
    """指标响应"""
    timestamp: str
    uptime_seconds: float
    search: dict
    sync: dict
    cache: dict


# ============== 生命周期管理 ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    logger.info("启动 Echo SeekDB API v2...")
    
    # 启动同步服务
    sync_service = get_sync_service()
    sync_service.start()
    logger.info("同步服务已启动")
    
    yield
    
    # 关闭时
    logger.info("关闭 Echo SeekDB API v2...")
    sync_service.stop()
    logger.info("同步服务已停止")


# ============== FastAPI 应用 ==============

app = FastAPI(
    title="Echo SeekDB API v2",
    description="双数据库架构搜索 API (PostgreSQL + SeekDB)",
    version="2.0.0",
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


# ============== 健康检查端点 ==============

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    健康检查
    
    检查所有服务状态：PostgreSQL、SeekDB、Embedding、Sync
    """
    service = get_health_metrics_service()
    health = await service.health_check()
    
    return HealthResponse(
        status=health.status,
        timestamp=health.timestamp,
        services=health.services,
        degraded_reason=health.degraded_reason
    )


@app.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    """
    获取性能指标
    
    包括搜索延迟、缓存命中率、同步队列深度等
    """
    service = get_health_metrics_service()
    metrics = service.get_metrics()
    
    return MetricsResponse(
        timestamp=metrics.timestamp,
        uptime_seconds=metrics.uptime_seconds,
        search=metrics.search,
        sync=metrics.sync,
        cache=metrics.cache
    )


# ============== 搜索 API ==============

@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """
    混合搜索接口
    
    alpha 参数控制搜索策略：
    - alpha=0: 纯 PostgreSQL 全文搜索 (FTS)，响应 <100ms
    - alpha=1: 纯 SeekDB 向量搜索，响应 <500ms
    - 0<alpha<1: 混合搜索，结合两者结果
    
    当 SeekDB 不可用时，自动降级到 PostgreSQL FTS
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="查询不能为空")
    
    router = get_search_router()
    
    response = await router.search(
        query=request.query,
        alpha=request.alpha,
        limit=request.limit,
        source_type=request.source_type
    )
    
    # 转换结果
    results = [
        SearchResultItem(
            id=r.id,
            content=r.content,
            source_type=r.source_type,
            source_path=r.source_path,
            metadata=r.metadata,
            score=r.score,
            text_score=r.text_score,
            vector_score=r.vector_score,
            created_at=r.created_at,
            backend=r.backend
        )
        for r in response.results
    ]
    
    return SearchResponse(
        results=results,
        total=response.total,
        query=response.query,
        alpha=response.alpha,
        backend_used=response.backend_used,
        embedding_available=response.embedding_available,
        postgres_latency_ms=response.postgres_latency_ms,
        seekdb_latency_ms=response.seekdb_latency_ms,
        total_latency_ms=response.total_latency_ms,
        degraded=response.degraded,
        degraded_reason=response.degraded_reason
    )


@app.get("/search")
async def search_get(
    query: str = Query(..., min_length=1, description="搜索查询"),
    alpha: float = Query(0.5, ge=0.0, le=1.0, description="向量权重"),
    source_type: Optional[str] = Query(None, description="来源类型过滤"),
    limit: int = Query(20, ge=1, le=100, description="返回数量")
):
    """GET 方式搜索（便于测试）"""
    request = SearchRequest(
        query=query,
        alpha=alpha,
        source_type=source_type,
        limit=limit
    )
    return await search(request)


# ============== 同步 API ==============

@app.post("/sync", response_model=SyncResponse)
async def sync_document(request: SyncRequest):
    """
    同步文档到 SeekDB
    
    当 PostgreSQL 中的文档发生变更时，调用此接口同步到 SeekDB 向量索引
    """
    sync_service = get_sync_service()
    
    if request.operation == "create":
        if not request.content:
            raise HTTPException(status_code=400, detail="创建操作需要 content")
        task_id = sync_service.enqueue_create(
            doc_id=request.doc_id,
            content=request.content,
            source_type=request.source_type,
            source_path=request.source_path,
            metadata=request.metadata
        )
    elif request.operation == "update":
        if not request.content:
            raise HTTPException(status_code=400, detail="更新操作需要 content")
        task_id = sync_service.enqueue_update(
            doc_id=request.doc_id,
            content=request.content,
            source_type=request.source_type,
            source_path=request.source_path,
            metadata=request.metadata
        )
    elif request.operation == "delete":
        task_id = sync_service.enqueue_delete(doc_id=request.doc_id)
    else:
        raise HTTPException(status_code=400, detail="无效的操作类型")
    
    return SyncResponse(
        task_id=task_id,
        status="queued"
    )


@app.get("/sync/status")
async def sync_status():
    """获取同步服务状态"""
    sync_service = get_sync_service()
    return sync_service.stats


# ============== 降级模式 API ==============

@app.get("/degraded")
async def degraded_status():
    """
    获取降级模式状态
    
    当 SeekDB 不可用时，系统自动降级到 PostgreSQL FTS
    """
    service = get_health_metrics_service()
    return service.degraded_mode_info


# ============== 路由器状态 ==============

@app.get("/router/health")
async def router_health():
    """获取搜索路由器健康状态"""
    router = get_search_router()
    return await router.health_check()


# ============== 启动入口 ==============

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv('API_PORT', '8765'))
    logger.info(f"启动 Echo SeekDB API v2 on port {port}")
    
    uvicorn.run(
        "server_v2:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info"
    )
