#!/usr/bin/env python3
"""
搜索路由器

根据 alpha 参数将搜索请求路由到不同的后端：
- alpha=0: PostgreSQL 全文搜索 (FTS)
- alpha=1: SeekDB 向量搜索
- 0<alpha<1: 混合搜索（并行查询两者）

功能：
- 智能路由
- 混合结果合并
- 超时降级
"""

import os
import asyncio
import logging
from typing import Optional, List, Tuple
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum

# ============== 日志配置 ==============

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== 配置 ==============

# 超时配置
POSTGRES_TIMEOUT = float(os.getenv('POSTGRES_TIMEOUT', '0.5'))  # 500ms
SEEKDB_TIMEOUT = float(os.getenv('SEEKDB_TIMEOUT', '2.0'))  # 2s
EMBEDDING_TIMEOUT = float(os.getenv('EMBEDDING_TIMEOUT', '2.0'))  # 2s


# ============== 数据模型 ==============

class SearchBackend(Enum):
    """搜索后端类型"""
    POSTGRES = "postgres"
    SEEKDB = "seekdb"
    HYBRID = "hybrid"


@dataclass
class SearchResult:
    """统一搜索结果"""
    id: str
    content: str
    source_type: str
    source_path: str
    metadata: dict
    score: float
    text_score: Optional[float] = None
    vector_score: Optional[float] = None
    created_at: Optional[str] = None
    backend: str = ""  # 来源后端


@dataclass
class SearchResponse:
    """搜索响应"""
    results: List[SearchResult]
    total: int
    query: str
    alpha: float
    backend_used: str
    embedding_available: bool
    postgres_latency_ms: Optional[float] = None
    seekdb_latency_ms: Optional[float] = None
    total_latency_ms: float = 0.0
    degraded: bool = False  # 是否降级模式
    degraded_reason: Optional[str] = None


@dataclass
class RouterMetrics:
    """路由器指标"""
    total_requests: int = 0
    postgres_requests: int = 0
    seekdb_requests: int = 0
    hybrid_requests: int = 0
    degraded_requests: int = 0
    avg_postgres_latency_ms: float = 0.0
    avg_seekdb_latency_ms: float = 0.0
    
    # 用于计算平均值
    _postgres_latency_sum: float = field(default=0.0, repr=False)
    _seekdb_latency_sum: float = field(default=0.0, repr=False)
    
    def record_request(
        self,
        backend: SearchBackend,
        postgres_latency: Optional[float] = None,
        seekdb_latency: Optional[float] = None,
        degraded: bool = False
    ):
        """记录请求指标"""
        self.total_requests += 1
        
        if backend == SearchBackend.POSTGRES:
            self.postgres_requests += 1
        elif backend == SearchBackend.SEEKDB:
            self.seekdb_requests += 1
        else:
            self.hybrid_requests += 1
        
        if degraded:
            self.degraded_requests += 1
        
        if postgres_latency is not None:
            self._postgres_latency_sum += postgres_latency
            self.avg_postgres_latency_ms = (
                self._postgres_latency_sum / 
                (self.postgres_requests + self.hybrid_requests)
            )
        
        if seekdb_latency is not None:
            self._seekdb_latency_sum += seekdb_latency
            self.avg_seekdb_latency_ms = (
                self._seekdb_latency_sum / 
                (self.seekdb_requests + self.hybrid_requests)
            )


# ============== PostgreSQL 搜索客户端 ==============

class PostgresSearchClient:
    """
    PostgreSQL 搜索客户端
    
    通过 HTTP 调用 Blinko 的 PostgreSQL 搜索服务
    """
    
    def __init__(self, base_url: Optional[str] = None):
        """
        初始化客户端
        
        Args:
            base_url: Blinko API 基础 URL
        """
        self.base_url = base_url or os.getenv('BLINKO_API_URL', 'http://localhost:1111')
        self._available = True
    
    async def search(
        self,
        query: str,
        limit: int = 20,
        source_type: Optional[str] = None
    ) -> Tuple[List[SearchResult], float]:
        """
        执行 PostgreSQL 全文搜索
        
        Args:
            query: 搜索查询
            limit: 返回数量
            source_type: 来源类型过滤
            
        Returns:
            (结果列表, 延迟毫秒)
        """
        import aiohttp
        
        start_time = datetime.now()
        
        try:
            params = {
                "query": query,
                "limit": limit,
            }
            if source_type:
                params["source_type"] = source_type
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/api/search/fts",
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=POSTGRES_TIMEOUT)
                ) as response:
                    if response.status != 200:
                        logger.warning(f"PostgreSQL 搜索失败: HTTP {response.status}")
                        return [], self._calc_latency(start_time)
                    
                    data = await response.json()
                    
                    results = [
                        SearchResult(
                            id=str(item['id']),
                            content=item.get('content', '')[:500],
                            source_type=item.get('source_type', ''),
                            source_path=item.get('source_path', ''),
                            metadata=item.get('metadata', {}),
                            score=float(item.get('score', 0)),
                            text_score=float(item.get('score', 0)),
                            vector_score=None,
                            created_at=item.get('created_at'),
                            backend='postgres'
                        )
                        for item in data.get('results', [])
                    ]
                    
                    return results, self._calc_latency(start_time)
                    
        except asyncio.TimeoutError:
            logger.warning(f"PostgreSQL 搜索超时 ({POSTGRES_TIMEOUT}s)")
            return [], self._calc_latency(start_time)
        except Exception as e:
            logger.error(f"PostgreSQL 搜索错误: {e}")
            return [], self._calc_latency(start_time)
    
    async def health_check(self) -> bool:
        """健康检查"""
        import aiohttp
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/api/health",
                    timeout=aiohttp.ClientTimeout(total=1.0)
                ) as response:
                    self._available = response.status == 200
                    return self._available
        except:
            self._available = False
            return False
    
    @property
    def is_available(self) -> bool:
        return self._available
    
    def _calc_latency(self, start_time: datetime) -> float:
        return (datetime.now() - start_time).total_seconds() * 1000


# ============== SeekDB 搜索客户端 ==============

class SeekDBSearchClient:
    """
    SeekDB 向量搜索客户端
    
    使用本地 SeekDBVectorService
    """
    
    def __init__(self):
        """初始化客户端"""
        from vector_service import get_vector_service
        self._service = get_vector_service()
    
    async def search(
        self,
        query: str,
        limit: int = 20,
        source_type: Optional[str] = None
    ) -> Tuple[List[SearchResult], float, bool]:
        """
        执行向量搜索
        
        Args:
            query: 搜索查询
            limit: 返回数量
            source_type: 来源类型过滤
            
        Returns:
            (结果列表, 延迟毫秒, embedding是否可用)
        """
        try:
            response = await asyncio.wait_for(
                self._service.semantic_search(query, limit, source_type),
                timeout=SEEKDB_TIMEOUT
            )
            
            results = [
                SearchResult(
                    id=item.id,
                    content=item.content,
                    source_type=item.source_type,
                    source_path=item.source_path,
                    metadata=item.metadata,
                    score=item.score,
                    text_score=None,
                    vector_score=item.score,
                    created_at=item.created_at,
                    backend='seekdb'
                )
                for item in response.results
            ]
            
            return results, response.latency_ms, response.embedding_available
            
        except asyncio.TimeoutError:
            logger.warning(f"SeekDB 搜索超时 ({SEEKDB_TIMEOUT}s)")
            return [], 0.0, False
        except Exception as e:
            logger.error(f"SeekDB 搜索错误: {e}")
            return [], 0.0, False
    
    def health_check(self) -> dict:
        """健康检查"""
        return self._service.health_check()
    
    @property
    def cache_stats(self) -> dict:
        """缓存统计"""
        return self._service.cache_stats


# ============== 搜索路由器 ==============

class SearchRouter:
    """
    搜索路由器
    
    根据 alpha 参数智能路由搜索请求
    """
    
    def __init__(self):
        """初始化路由器"""
        self.postgres_client = PostgresSearchClient()
        self.seekdb_client = SeekDBSearchClient()
        self.metrics = RouterMetrics()
        
        logger.info("SearchRouter 初始化完成")
    
    async def search(
        self,
        query: str,
        alpha: float = 0.5,
        limit: int = 20,
        source_type: Optional[str] = None
    ) -> SearchResponse:
        """
        执行搜索
        
        Args:
            query: 搜索查询
            alpha: 向量权重 (0=纯FTS, 1=纯向量, 0-1=混合)
            limit: 返回数量
            source_type: 来源类型过滤
            
        Returns:
            SearchResponse
        """
        start_time = datetime.now()
        
        # 确定路由策略
        if alpha == 0:
            return await self._postgres_search(query, limit, source_type, start_time)
        elif alpha == 1.0:
            return await self._seekdb_search(query, limit, source_type, start_time)
        else:
            return await self._hybrid_search(query, alpha, limit, source_type, start_time)
    
    async def _postgres_search(
        self,
        query: str,
        limit: int,
        source_type: Optional[str],
        start_time: datetime
    ) -> SearchResponse:
        """纯 PostgreSQL 搜索"""
        results, latency = await self.postgres_client.search(query, limit, source_type)
        
        self.metrics.record_request(
            SearchBackend.POSTGRES,
            postgres_latency=latency
        )
        
        return SearchResponse(
            results=results,
            total=len(results),
            query=query,
            alpha=0.0,
            backend_used='postgres',
            embedding_available=False,
            postgres_latency_ms=latency,
            total_latency_ms=self._calc_latency(start_time)
        )
    
    async def _seekdb_search(
        self,
        query: str,
        limit: int,
        source_type: Optional[str],
        start_time: datetime
    ) -> SearchResponse:
        """纯 SeekDB 向量搜索"""
        results, latency, embedding_available = await self.seekdb_client.search(
            query, limit, source_type
        )
        
        # 如果 embedding 不可用，降级到 PostgreSQL
        if not embedding_available:
            logger.warning("Embedding 不可用，降级到 PostgreSQL FTS")
            pg_results, pg_latency = await self.postgres_client.search(
                query, limit, source_type
            )
            
            self.metrics.record_request(
                SearchBackend.SEEKDB,
                postgres_latency=pg_latency,
                degraded=True
            )
            
            return SearchResponse(
                results=pg_results,
                total=len(pg_results),
                query=query,
                alpha=1.0,
                backend_used='postgres',
                embedding_available=False,
                postgres_latency_ms=pg_latency,
                total_latency_ms=self._calc_latency(start_time),
                degraded=True,
                degraded_reason="Embedding 服务不可用"
            )
        
        self.metrics.record_request(
            SearchBackend.SEEKDB,
            seekdb_latency=latency
        )
        
        return SearchResponse(
            results=results,
            total=len(results),
            query=query,
            alpha=1.0,
            backend_used='seekdb',
            embedding_available=True,
            seekdb_latency_ms=latency,
            total_latency_ms=self._calc_latency(start_time)
        )
    
    async def _hybrid_search(
        self,
        query: str,
        alpha: float,
        limit: int,
        source_type: Optional[str],
        start_time: datetime
    ) -> SearchResponse:
        """混合搜索（并行查询两个后端）"""
        # 并行执行两个搜索
        pg_task = asyncio.create_task(
            self.postgres_client.search(query, limit * 2, source_type)
        )
        seekdb_task = asyncio.create_task(
            self.seekdb_client.search(query, limit * 2, source_type)
        )
        
        # 等待两个任务完成
        pg_results, pg_latency = await pg_task
        seekdb_results, seekdb_latency, embedding_available = await seekdb_task
        
        # 如果 SeekDB 不可用，只使用 PostgreSQL 结果
        if not embedding_available or not seekdb_results:
            self.metrics.record_request(
                SearchBackend.HYBRID,
                postgres_latency=pg_latency,
                degraded=True
            )
            
            return SearchResponse(
                results=pg_results[:limit],
                total=len(pg_results[:limit]),
                query=query,
                alpha=alpha,
                backend_used='postgres',
                embedding_available=False,
                postgres_latency_ms=pg_latency,
                total_latency_ms=self._calc_latency(start_time),
                degraded=True,
                degraded_reason="SeekDB 不可用，仅使用 FTS"
            )
        
        # 合并结果
        merged = self._merge_results(pg_results, seekdb_results, alpha, limit)
        
        self.metrics.record_request(
            SearchBackend.HYBRID,
            postgres_latency=pg_latency,
            seekdb_latency=seekdb_latency
        )
        
        return SearchResponse(
            results=merged,
            total=len(merged),
            query=query,
            alpha=alpha,
            backend_used='hybrid',
            embedding_available=True,
            postgres_latency_ms=pg_latency,
            seekdb_latency_ms=seekdb_latency,
            total_latency_ms=self._calc_latency(start_time)
        )
    
    def _merge_results(
        self,
        pg_results: List[SearchResult],
        seekdb_results: List[SearchResult],
        alpha: float,
        limit: int
    ) -> List[SearchResult]:
        """
        合并两个后端的搜索结果
        
        混合分数 = (1-alpha) * text_score + alpha * vector_score
        """
        # 创建 ID 到结果的映射
        result_map: dict[str, SearchResult] = {}
        
        # 归一化 PostgreSQL 分数
        max_pg_score = max((r.score for r in pg_results), default=1.0) or 1.0
        for r in pg_results:
            normalized_score = r.score / max_pg_score
            result_map[r.id] = SearchResult(
                id=r.id,
                content=r.content,
                source_type=r.source_type,
                source_path=r.source_path,
                metadata=r.metadata,
                score=0.0,  # 稍后计算
                text_score=normalized_score,
                vector_score=None,
                created_at=r.created_at,
                backend='hybrid'
            )
        
        # 归一化 SeekDB 分数并合并
        max_seekdb_score = max((r.score for r in seekdb_results), default=1.0) or 1.0
        for r in seekdb_results:
            normalized_score = r.score / max_seekdb_score
            
            if r.id in result_map:
                # 已存在，更新向量分数
                result_map[r.id].vector_score = normalized_score
            else:
                # 新结果
                result_map[r.id] = SearchResult(
                    id=r.id,
                    content=r.content,
                    source_type=r.source_type,
                    source_path=r.source_path,
                    metadata=r.metadata,
                    score=0.0,
                    text_score=None,
                    vector_score=normalized_score,
                    created_at=r.created_at,
                    backend='hybrid'
                )
        
        # 计算混合分数
        for result in result_map.values():
            text_score = result.text_score or 0.0
            vector_score = result.vector_score or 0.0
            result.score = (1 - alpha) * text_score + alpha * vector_score
        
        # 按分数排序
        sorted_results = sorted(
            result_map.values(),
            key=lambda x: x.score,
            reverse=True
        )
        
        return sorted_results[:limit]
    
    def _calc_latency(self, start_time: datetime) -> float:
        return (datetime.now() - start_time).total_seconds() * 1000
    
    async def health_check(self) -> dict:
        """健康检查"""
        pg_healthy = await self.postgres_client.health_check()
        seekdb_health = self.seekdb_client.health_check()
        
        overall_status = "healthy"
        if not pg_healthy:
            overall_status = "degraded"
        if seekdb_health.get("status") != "healthy":
            overall_status = "degraded"
        
        return {
            "status": overall_status,
            "postgres": {
                "available": pg_healthy,
                "url": self.postgres_client.base_url
            },
            "seekdb": seekdb_health,
            "metrics": {
                "total_requests": self.metrics.total_requests,
                "postgres_requests": self.metrics.postgres_requests,
                "seekdb_requests": self.metrics.seekdb_requests,
                "hybrid_requests": self.metrics.hybrid_requests,
                "degraded_requests": self.metrics.degraded_requests,
                "avg_postgres_latency_ms": round(self.metrics.avg_postgres_latency_ms, 2),
                "avg_seekdb_latency_ms": round(self.metrics.avg_seekdb_latency_ms, 2)
            }
        }


# ============== 全局实例 ==============

_router: Optional[SearchRouter] = None


def get_search_router() -> SearchRouter:
    """获取全局搜索路由器实例"""
    global _router
    if _router is None:
        _router = SearchRouter()
    return _router


# ============== 测试入口 ==============

if __name__ == "__main__":
    async def test():
        print("=" * 50)
        print("SearchRouter 测试")
        print("=" * 50)
        
        router = get_search_router()
        
        # 健康检查
        print("\n1. 健康检查...")
        health = await router.health_check()
        print(f"   状态: {health['status']}")
        print(f"   PostgreSQL: {'可用' if health['postgres']['available'] else '不可用'}")
        print(f"   SeekDB: {health['seekdb']['status']}")
        
        # 测试不同 alpha 值
        test_query = "测试查询"
        
        print(f"\n2. 测试搜索 (query='{test_query}')...")
        
        # alpha=0 (纯 FTS)
        print("\n   alpha=0 (纯 PostgreSQL FTS):")
        response = await router.search(test_query, alpha=0, limit=5)
        print(f"   - 结果数: {response.total}")
        print(f"   - 后端: {response.backend_used}")
        print(f"   - 延迟: {response.total_latency_ms:.2f}ms")
        
        # alpha=0.5 (混合)
        print("\n   alpha=0.5 (混合搜索):")
        response = await router.search(test_query, alpha=0.5, limit=5)
        print(f"   - 结果数: {response.total}")
        print(f"   - 后端: {response.backend_used}")
        print(f"   - Embedding 可用: {response.embedding_available}")
        print(f"   - 延迟: {response.total_latency_ms:.2f}ms")
        
        # alpha=1 (纯向量)
        print("\n   alpha=1 (纯向量搜索):")
        response = await router.search(test_query, alpha=1.0, limit=5)
        print(f"   - 结果数: {response.total}")
        print(f"   - 后端: {response.backend_used}")
        print(f"   - Embedding 可用: {response.embedding_available}")
        print(f"   - 降级: {response.degraded}")
        print(f"   - 延迟: {response.total_latency_ms:.2f}ms")
        
        # 指标
        print("\n3. 路由器指标:")
        metrics = router.metrics
        print(f"   - 总请求: {metrics.total_requests}")
        print(f"   - PostgreSQL 请求: {metrics.postgres_requests}")
        print(f"   - SeekDB 请求: {metrics.seekdb_requests}")
        print(f"   - 混合请求: {metrics.hybrid_requests}")
        print(f"   - 降级请求: {metrics.degraded_requests}")
        
        print("\n测试完成!")
    
    asyncio.run(test())
