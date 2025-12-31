#!/usr/bin/env python3
"""
健康检查与监控服务

提供统一的健康检查和指标收集接口。

功能：
- /health 端点：检查所有服务状态
- /metrics 端点：收集性能指标
- 降级模式检测
"""

import os
import logging
from typing import Optional
from datetime import datetime
from dataclasses import dataclass, field

# ============== 日志配置 ==============

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============== 数据模型 ==============

@dataclass
class ServiceStatus:
    """服务状态"""
    name: str
    status: str  # healthy, degraded, unhealthy
    latency_ms: Optional[float] = None
    error: Optional[str] = None
    details: dict = field(default_factory=dict)


@dataclass
class HealthResponse:
    """健康检查响应"""
    status: str  # healthy, degraded, unhealthy
    timestamp: str
    services: dict
    degraded_reason: Optional[str] = None


@dataclass
class MetricsResponse:
    """指标响应"""
    timestamp: str
    uptime_seconds: float
    search: dict
    sync: dict
    cache: dict


# ============== 健康检查服务 ==============

class HealthMetricsService:
    """
    健康检查与监控服务
    """
    
    def __init__(self):
        """初始化服务"""
        self._start_time = datetime.now()
        self._postgres_available = False
        self._seekdb_available = False
        
        logger.info("HealthMetricsService 初始化完成")
    
    async def health_check(self) -> HealthResponse:
        """
        执行健康检查
        
        Returns:
            HealthResponse
        """
        services = {}
        overall_status = "healthy"
        degraded_reason = None
        
        # 检查 PostgreSQL
        pg_status = await self._check_postgres()
        services["postgres"] = pg_status
        if pg_status["status"] != "healthy":
            overall_status = "degraded"
            degraded_reason = "PostgreSQL 不可用"
        
        # 检查 SeekDB
        seekdb_status = await self._check_seekdb()
        services["seekdb"] = seekdb_status
        if seekdb_status["status"] != "healthy":
            if overall_status == "healthy":
                overall_status = "degraded"
                degraded_reason = "SeekDB 不可用"
        
        # 检查 Embedding 服务
        embedding_status = await self._check_embedding()
        services["embedding"] = embedding_status
        if embedding_status["status"] != "healthy":
            if overall_status == "healthy":
                overall_status = "degraded"
                degraded_reason = "Embedding 服务不可用"
        
        # 检查同步服务
        sync_status = self._check_sync()
        services["sync"] = sync_status
        
        return HealthResponse(
            status=overall_status,
            timestamp=datetime.now().isoformat() + "Z",
            services=services,
            degraded_reason=degraded_reason
        )
    
    async def _check_postgres(self) -> dict:
        """检查 PostgreSQL 连接"""
        import aiohttp
        
        blinko_url = os.getenv('BLINKO_API_URL', 'http://localhost:1111')
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{blinko_url}/api/health",
                    timeout=aiohttp.ClientTimeout(total=1.0)
                ) as response:
                    self._postgres_available = response.status == 200
                    return {
                        "status": "healthy" if self._postgres_available else "unhealthy",
                        "url": blinko_url
                    }
        except Exception as e:
            self._postgres_available = False
            return {
                "status": "unhealthy",
                "url": blinko_url,
                "error": str(e)
            }
    
    async def _check_seekdb(self) -> dict:
        """检查 SeekDB 连接"""
        try:
            from connection_pool import get_pool
            pool = get_pool()
            health = pool.health_check()
            self._seekdb_available = health["status"] == "healthy"
            return health
        except Exception as e:
            self._seekdb_available = False
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    async def _check_embedding(self) -> dict:
        """检查 Embedding 服务"""
        try:
            from embedding_service import get_embedding_service
            service = get_embedding_service()
            available = service.is_available()
            return {
                "status": "healthy" if available else "unhealthy",
                "model": service.config.model,
                "host": service.config.ollama_host
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    def _check_sync(self) -> dict:
        """检查同步服务"""
        try:
            from sync_service import get_sync_service
            service = get_sync_service()
            return service.health_check()
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    def get_metrics(self) -> MetricsResponse:
        """
        获取性能指标
        
        Returns:
            MetricsResponse
        """
        uptime = (datetime.now() - self._start_time).total_seconds()
        
        # 搜索指标
        search_metrics = self._get_search_metrics()
        
        # 同步指标
        sync_metrics = self._get_sync_metrics()
        
        # 缓存指标
        cache_metrics = self._get_cache_metrics()
        
        return MetricsResponse(
            timestamp=datetime.now().isoformat() + "Z",
            uptime_seconds=uptime,
            search=search_metrics,
            sync=sync_metrics,
            cache=cache_metrics
        )
    
    def _get_search_metrics(self) -> dict:
        """获取搜索指标"""
        try:
            from search_router import get_search_router
            router = get_search_router()
            metrics = router.metrics
            return {
                "total_requests": metrics.total_requests,
                "postgres_requests": metrics.postgres_requests,
                "seekdb_requests": metrics.seekdb_requests,
                "hybrid_requests": metrics.hybrid_requests,
                "degraded_requests": metrics.degraded_requests,
                "avg_postgres_latency_ms": round(metrics.avg_postgres_latency_ms, 2),
                "avg_seekdb_latency_ms": round(metrics.avg_seekdb_latency_ms, 2)
            }
        except Exception as e:
            return {"error": str(e)}
    
    def _get_sync_metrics(self) -> dict:
        """获取同步指标"""
        try:
            from sync_service import get_sync_service
            service = get_sync_service()
            return service.stats
        except Exception as e:
            return {"error": str(e)}
    
    def _get_cache_metrics(self) -> dict:
        """获取缓存指标"""
        try:
            from embedding_cache import get_embedding_cache
            cache = get_embedding_cache()
            return cache.stats
        except Exception as e:
            return {"error": str(e)}
    
    @property
    def is_degraded(self) -> bool:
        """是否处于降级模式"""
        return not self._seekdb_available or not self._postgres_available
    
    @property
    def degraded_mode_info(self) -> dict:
        """降级模式信息"""
        if not self.is_degraded:
            return {"degraded": False}
        
        reasons = []
        if not self._postgres_available:
            reasons.append("PostgreSQL 不可用")
        if not self._seekdb_available:
            reasons.append("SeekDB 不可用")
        
        return {
            "degraded": True,
            "reasons": reasons,
            "fallback": "PostgreSQL FTS" if self._postgres_available else "无可用后端"
        }


# ============== 全局实例 ==============

_service: Optional[HealthMetricsService] = None


def get_health_metrics_service() -> HealthMetricsService:
    """获取全局健康检查服务实例"""
    global _service
    if _service is None:
        _service = HealthMetricsService()
    return _service


# ============== 测试入口 ==============

if __name__ == "__main__":
    import asyncio
    
    async def test():
        print("=" * 50)
        print("HealthMetricsService 测试")
        print("=" * 50)
        
        service = get_health_metrics_service()
        
        # 健康检查
        print("\n1. 健康检查...")
        health = await service.health_check()
        print(f"   状态: {health.status}")
        print(f"   时间: {health.timestamp}")
        print(f"   降级原因: {health.degraded_reason}")
        print("   服务状态:")
        for name, status in health.services.items():
            print(f"     - {name}: {status.get('status', 'unknown')}")
        
        # 指标
        print("\n2. 性能指标...")
        metrics = service.get_metrics()
        print(f"   运行时间: {metrics.uptime_seconds:.2f}s")
        print(f"   搜索指标: {metrics.search}")
        print(f"   同步指标: {metrics.sync}")
        print(f"   缓存指标: {metrics.cache}")
        
        # 降级模式
        print("\n3. 降级模式...")
        degraded_info = service.degraded_mode_info
        print(f"   降级: {degraded_info['degraded']}")
        if degraded_info['degraded']:
            print(f"   原因: {degraded_info['reasons']}")
            print(f"   回退: {degraded_info['fallback']}")
        
        print("\n测试完成!")
    
    asyncio.run(test())
