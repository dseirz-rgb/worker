#!/usr/bin/env python3
"""
SeekDB 向量搜索服务

专注于向量搜索功能，不再处理 Paperless 兼容 API。
使用连接池和 embedding 缓存优化性能。

功能：
- 语义搜索 (向量相似度)
- Embedding 生成和缓存
- 批量向量操作
"""

import os
import json
import asyncio
import logging
from typing import Optional, List
from datetime import datetime
from dataclasses import dataclass

from connection_pool import get_pool, cursor
from embedding_cache import get_embedding_cache, EmbeddingCache
from embedding_service import EmbeddingService, get_embedding_service

# ============== 日志配置 ==============

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== 配置 ==============

EMBEDDING_TIMEOUT = float(os.getenv('EMBEDDING_TIMEOUT', '2.0'))  # 秒
VECTOR_DIMENSION = int(os.getenv('VECTOR_DIMENSION', '768'))  # nomic-embed-text 维度


# ============== 数据模型 ==============

@dataclass
class VectorSearchResult:
    """向量搜索结果"""
    id: str
    content: str
    source_type: str
    source_path: str
    metadata: dict
    score: float  # 相似度分数 (0-1)
    created_at: Optional[str] = None


@dataclass
class VectorSearchResponse:
    """向量搜索响应"""
    results: List[VectorSearchResult]
    total: int
    query: str
    embedding_available: bool
    cache_hit: bool
    latency_ms: float


# ============== SeekDBVectorService ==============

class SeekDBVectorService:
    """
    SeekDB 向量搜索服务
    
    专注于向量搜索，使用连接池和缓存优化性能。
    """
    
    def __init__(
        self,
        cache_size: int = 100,
        embedding_timeout: float = EMBEDDING_TIMEOUT
    ):
        """
        初始化向量服务
        
        Args:
            cache_size: embedding 缓存大小
            embedding_timeout: embedding 生成超时时间（秒）
        """
        self.cache = get_embedding_cache(maxsize=cache_size)
        self.embedding_service = get_embedding_service()
        self.embedding_timeout = embedding_timeout
        
        logger.info(f"SeekDBVectorService 初始化完成")
        logger.info(f"  - 缓存大小: {cache_size}")
        logger.info(f"  - Embedding 超时: {embedding_timeout}s")
    
    async def get_embedding(self, text: str) -> Optional[List[float]]:
        """
        获取文本的 embedding，带缓存和超时
        
        Args:
            text: 查询文本
            
        Returns:
            embedding 向量，如果失败或超时返回 None
        """
        # 检查缓存
        cached = self.cache.get(text)
        if cached is not None:
            logger.debug(f"Embedding 缓存命中")
            return cached
        
        # 生成 embedding（带超时）
        try:
            # 使用 asyncio.wait_for 实现超时
            loop = asyncio.get_event_loop()
            embedding = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    self.embedding_service.generate,
                    text
                ),
                timeout=self.embedding_timeout
            )
            
            if embedding is not None:
                # 存入缓存
                self.cache.put(text, embedding)
                logger.debug(f"Embedding 生成成功，已缓存")
            
            return embedding
            
        except asyncio.TimeoutError:
            logger.warning(f"Embedding 生成超时 ({self.embedding_timeout}s)")
            return None
        except Exception as e:
            logger.error(f"Embedding 生成失败: {e}")
            return None
    
    async def semantic_search(
        self,
        query: str,
        limit: int = 20,
        source_type: Optional[str] = None
    ) -> VectorSearchResponse:
        """
        语义搜索
        
        Args:
            query: 查询文本
            limit: 返回结果数量
            source_type: 来源类型过滤
            
        Returns:
            VectorSearchResponse
        """
        start_time = datetime.now()
        cache_hit = self.cache.contains(query)
        
        # 获取查询 embedding
        query_embedding = await self.get_embedding(query)
        
        if query_embedding is None:
            # Embedding 不可用，返回空结果
            return VectorSearchResponse(
                results=[],
                total=0,
                query=query,
                embedding_available=False,
                cache_hit=cache_hit,
                latency_ms=self._calc_latency(start_time)
            )
        
        # 执行向量搜索
        results = await self._vector_search(query_embedding, limit, source_type)
        
        return VectorSearchResponse(
            results=results,
            total=len(results),
            query=query,
            embedding_available=True,
            cache_hit=cache_hit,
            latency_ms=self._calc_latency(start_time)
        )
    
    async def _vector_search(
        self,
        query_embedding: List[float],
        limit: int,
        source_type: Optional[str] = None
    ) -> List[VectorSearchResult]:
        """
        执行向量搜索
        
        Args:
            query_embedding: 查询向量
            limit: 返回数量
            source_type: 来源类型过滤
            
        Returns:
            搜索结果列表
        """
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
        
        if source_type:
            sql += " AND source_type = %s"
            params.append(source_type)
        
        sql += f" ORDER BY vector_distance ASC LIMIT {limit}"
        
        try:
            with cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
            
            results = []
            for row in rows:
                distance = float(row.get('vector_distance', 0))
                # 将距离转换为相似度分数 (距离越小，分数越高)
                score = 1.0 / (1.0 + distance)
                
                metadata = self._parse_metadata(row.get('metadata'))
                
                results.append(VectorSearchResult(
                    id=str(row['id']),
                    content=row['content'][:500] if row['content'] else '',
                    source_type=row['source_type'],
                    source_path=row['source_path'],
                    metadata=metadata,
                    score=score,
                    created_at=self._format_datetime(row['created_at'])
                ))
            
            return results
            
        except Exception as e:
            logger.error(f"向量搜索失败: {e}")
            return []
    
    async def store_embedding(
        self,
        doc_id: int,
        content: str,
        source_type: str,
        source_path: str,
        metadata: Optional[dict] = None
    ) -> bool:
        """
        存储文档 embedding
        
        Args:
            doc_id: 文档 ID
            content: 文档内容
            source_type: 来源类型
            source_path: 来源路径
            metadata: 元数据
            
        Returns:
            是否成功
        """
        # 生成 embedding
        embedding = await self.get_embedding(content)
        if embedding is None:
            logger.warning(f"无法为文档 {doc_id} 生成 embedding")
            return False
        
        # 计算内容哈希
        import hashlib
        content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()
        
        # 存储到 SeekDB
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
        metadata_json = json.dumps(metadata or {})
        
        sql = """
            INSERT INTO document_embeddings 
                (id, embedding, content_hash, source_type, metadata)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                embedding = VALUES(embedding),
                content_hash = VALUES(content_hash),
                metadata = VALUES(metadata),
                updated_at = CURRENT_TIMESTAMP
        """
        
        try:
            with cursor() as cur:
                cur.execute(sql, (doc_id, embedding_str, content_hash, source_type, metadata_json))
            logger.info(f"文档 {doc_id} embedding 已存储")
            return True
        except Exception as e:
            logger.error(f"存储 embedding 失败: {e}")
            return False
    
    async def delete_embedding(self, doc_id: int) -> bool:
        """
        删除文档 embedding
        
        Args:
            doc_id: 文档 ID
            
        Returns:
            是否成功
        """
        sql = "DELETE FROM document_embeddings WHERE id = %s"
        
        try:
            with cursor() as cur:
                cur.execute(sql, (doc_id,))
            logger.info(f"文档 {doc_id} embedding 已删除")
            return True
        except Exception as e:
            logger.error(f"删除 embedding 失败: {e}")
            return False
    
    def _parse_metadata(self, metadata) -> dict:
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
    
    def _format_datetime(self, dt) -> Optional[str]:
        """格式化日期时间"""
        if dt is None:
            return None
        if isinstance(dt, str):
            return dt
        return dt.isoformat() + "Z"
    
    def _calc_latency(self, start_time: datetime) -> float:
        """计算延迟（毫秒）"""
        delta = datetime.now() - start_time
        return delta.total_seconds() * 1000
    
    @property
    def cache_stats(self) -> dict:
        """获取缓存统计"""
        return self.cache.stats
    
    def health_check(self) -> dict:
        """健康检查"""
        pool_health = get_pool().health_check()
        embedding_available = self.embedding_service.is_available()
        
        return {
            "status": "healthy" if pool_health["status"] == "healthy" else "degraded",
            "database": pool_health,
            "embedding": {
                "available": embedding_available,
                "model": self.embedding_service.config.model,
                "host": self.embedding_service.config.ollama_host
            },
            "cache": self.cache_stats
        }


# ============== 全局实例 ==============

_service: Optional[SeekDBVectorService] = None


def get_vector_service() -> SeekDBVectorService:
    """获取全局向量服务实例"""
    global _service
    if _service is None:
        _service = SeekDBVectorService()
    return _service


# ============== 测试入口 ==============

if __name__ == "__main__":
    import asyncio
    
    async def test():
        print("=" * 50)
        print("SeekDB Vector Service 测试")
        print("=" * 50)
        
        service = get_vector_service()
        
        # 健康检查
        print("\n1. 健康检查...")
        health = service.health_check()
        print(f"   状态: {health['status']}")
        print(f"   数据库: {health['database']['status']}")
        print(f"   Embedding: {'可用' if health['embedding']['available'] else '不可用'}")
        
        # 测试语义搜索
        print("\n2. 测试语义搜索...")
        response = await service.semantic_search("测试查询", limit=5)
        print(f"   结果数: {response.total}")
        print(f"   Embedding 可用: {response.embedding_available}")
        print(f"   缓存命中: {response.cache_hit}")
        print(f"   延迟: {response.latency_ms:.2f}ms")
        
        # 缓存统计
        print("\n3. 缓存统计...")
        stats = service.cache_stats
        for key, value in stats.items():
            print(f"   {key}: {value}")
        
        print("\n测试完成!")
    
    asyncio.run(test())
