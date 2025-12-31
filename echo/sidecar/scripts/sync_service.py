#!/usr/bin/env python3
"""
数据同步服务

负责将 PostgreSQL 中的文档变更同步到 SeekDB 向量索引。

功能：
- 监听文档创建/更新/删除事件
- 异步生成 embedding 并存储
- 重试机制（指数退避）
- 同步队列管理
"""

import os
import asyncio
import logging
import hashlib
from typing import Optional, List, Dict, Any
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
from collections import deque

# ============== 日志配置 ==============

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== 配置 ==============

MAX_RETRIES = int(os.getenv('SYNC_MAX_RETRIES', '3'))
RETRY_DELAYS = [1, 2, 4]  # 指数退避: 1s, 2s, 4s
BATCH_SIZE = int(os.getenv('SYNC_BATCH_SIZE', '10'))
QUEUE_MAX_SIZE = int(os.getenv('SYNC_QUEUE_MAX_SIZE', '1000'))


# ============== 数据模型 ==============

class SyncOperation(Enum):
    """同步操作类型"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class SyncStatus(Enum):
    """同步状态"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class SyncTask:
    """同步任务"""
    id: str
    doc_id: int
    operation: SyncOperation
    content: Optional[str] = None
    content_hash: Optional[str] = None
    source_type: str = ""
    source_path: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    status: SyncStatus = SyncStatus.PENDING
    retries: int = 0
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    
    @staticmethod
    def create_id(doc_id: int, operation: SyncOperation) -> str:
        """生成任务 ID"""
        return f"{operation.value}_{doc_id}_{datetime.now().timestamp()}"


@dataclass
class SyncMetrics:
    """同步指标"""
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    pending_tasks: int = 0
    avg_sync_time_ms: float = 0.0
    
    # 内部计算
    _sync_time_sum: float = field(default=0.0, repr=False)
    
    def record_completion(self, sync_time_ms: float, success: bool):
        """记录任务完成"""
        self.total_tasks += 1
        if success:
            self.completed_tasks += 1
            self._sync_time_sum += sync_time_ms
            self.avg_sync_time_ms = self._sync_time_sum / self.completed_tasks
        else:
            self.failed_tasks += 1


# ============== 同步服务 ==============

class SyncService:
    """
    数据同步服务
    
    将 PostgreSQL 文档变更同步到 SeekDB 向量索引
    """
    
    def __init__(self):
        """初始化同步服务"""
        from vector_service import get_vector_service
        
        self.vector_service = get_vector_service()
        self.queue: deque[SyncTask] = deque(maxlen=QUEUE_MAX_SIZE)
        self.metrics = SyncMetrics()
        self._running = False
        self._worker_task: Optional[asyncio.Task] = None
        
        logger.info("SyncService 初始化完成")
        logger.info(f"  - 最大重试次数: {MAX_RETRIES}")
        logger.info(f"  - 批处理大小: {BATCH_SIZE}")
        logger.info(f"  - 队列最大容量: {QUEUE_MAX_SIZE}")
    
    def start(self):
        """启动同步服务"""
        if self._running:
            logger.warning("同步服务已在运行")
            return
        
        self._running = True
        self._worker_task = asyncio.create_task(self._worker_loop())
        logger.info("同步服务已启动")
    
    def stop(self):
        """停止同步服务"""
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
        logger.info("同步服务已停止")
    
    async def _worker_loop(self):
        """工作循环"""
        while self._running:
            try:
                # 处理队列中的任务
                if self.queue:
                    await self._process_batch()
                else:
                    # 队列为空，等待
                    await asyncio.sleep(0.5)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"工作循环错误: {e}")
                await asyncio.sleep(1)
    
    async def _process_batch(self):
        """处理一批任务"""
        batch: List[SyncTask] = []
        
        # 取出一批任务
        while self.queue and len(batch) < BATCH_SIZE:
            task = self.queue.popleft()
            batch.append(task)
        
        # 并行处理
        await asyncio.gather(
            *[self._process_task(task) for task in batch],
            return_exceptions=True
        )
    
    async def _process_task(self, task: SyncTask):
        """处理单个任务"""
        start_time = datetime.now()
        task.status = SyncStatus.PROCESSING
        
        try:
            if task.operation == SyncOperation.CREATE:
                success = await self._sync_create(task)
            elif task.operation == SyncOperation.UPDATE:
                success = await self._sync_update(task)
            elif task.operation == SyncOperation.DELETE:
                success = await self._sync_delete(task)
            else:
                logger.error(f"未知操作类型: {task.operation}")
                success = False
            
            if success:
                task.status = SyncStatus.COMPLETED
                task.completed_at = datetime.now()
                sync_time = (task.completed_at - start_time).total_seconds() * 1000
                self.metrics.record_completion(sync_time, True)
                logger.info(f"同步任务完成: {task.id}")
            else:
                await self._handle_failure(task)
                
        except Exception as e:
            task.error = str(e)
            await self._handle_failure(task)
    
    async def _handle_failure(self, task: SyncTask):
        """处理任务失败"""
        task.retries += 1
        
        if task.retries < MAX_RETRIES:
            # 重试
            delay = RETRY_DELAYS[min(task.retries - 1, len(RETRY_DELAYS) - 1)]
            logger.warning(f"任务 {task.id} 失败，{delay}s 后重试 ({task.retries}/{MAX_RETRIES})")
            
            await asyncio.sleep(delay)
            task.status = SyncStatus.PENDING
            self.queue.append(task)
        else:
            # 放弃
            task.status = SyncStatus.FAILED
            self.metrics.record_completion(0, False)
            logger.error(f"任务 {task.id} 最终失败: {task.error}")
    
    async def _sync_create(self, task: SyncTask) -> bool:
        """同步创建操作"""
        if not task.content:
            logger.warning(f"创建任务 {task.id} 缺少内容")
            return False
        
        return await self.vector_service.store_embedding(
            doc_id=task.doc_id,
            content=task.content,
            source_type=task.source_type,
            source_path=task.source_path,
            metadata=task.metadata
        )
    
    async def _sync_update(self, task: SyncTask) -> bool:
        """同步更新操作"""
        if not task.content:
            logger.warning(f"更新任务 {task.id} 缺少内容")
            return False
        
        # 更新就是重新存储（会覆盖）
        return await self.vector_service.store_embedding(
            doc_id=task.doc_id,
            content=task.content,
            source_type=task.source_type,
            source_path=task.source_path,
            metadata=task.metadata
        )
    
    async def _sync_delete(self, task: SyncTask) -> bool:
        """同步删除操作"""
        return await self.vector_service.delete_embedding(task.doc_id)
    
    # ============== 公共 API ==============
    
    def enqueue_create(
        self,
        doc_id: int,
        content: str,
        source_type: str = "",
        source_path: str = "",
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        入队创建任务
        
        Args:
            doc_id: 文档 ID
            content: 文档内容
            source_type: 来源类型
            source_path: 来源路径
            metadata: 元数据
            
        Returns:
            任务 ID
        """
        task = SyncTask(
            id=SyncTask.create_id(doc_id, SyncOperation.CREATE),
            doc_id=doc_id,
            operation=SyncOperation.CREATE,
            content=content,
            content_hash=self._hash_content(content),
            source_type=source_type,
            source_path=source_path,
            metadata=metadata or {}
        )
        
        self.queue.append(task)
        self.metrics.pending_tasks = len(self.queue)
        logger.debug(f"创建任务入队: {task.id}")
        
        return task.id
    
    def enqueue_update(
        self,
        doc_id: int,
        content: str,
        source_type: str = "",
        source_path: str = "",
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        入队更新任务
        
        Args:
            doc_id: 文档 ID
            content: 新内容
            source_type: 来源类型
            source_path: 来源路径
            metadata: 元数据
            
        Returns:
            任务 ID
        """
        task = SyncTask(
            id=SyncTask.create_id(doc_id, SyncOperation.UPDATE),
            doc_id=doc_id,
            operation=SyncOperation.UPDATE,
            content=content,
            content_hash=self._hash_content(content),
            source_type=source_type,
            source_path=source_path,
            metadata=metadata or {}
        )
        
        self.queue.append(task)
        self.metrics.pending_tasks = len(self.queue)
        logger.debug(f"更新任务入队: {task.id}")
        
        return task.id
    
    def enqueue_delete(self, doc_id: int) -> str:
        """
        入队删除任务
        
        Args:
            doc_id: 文档 ID
            
        Returns:
            任务 ID
        """
        task = SyncTask(
            id=SyncTask.create_id(doc_id, SyncOperation.DELETE),
            doc_id=doc_id,
            operation=SyncOperation.DELETE
        )
        
        self.queue.append(task)
        self.metrics.pending_tasks = len(self.queue)
        logger.debug(f"删除任务入队: {task.id}")
        
        return task.id
    
    def _hash_content(self, content: str) -> str:
        """计算内容哈希"""
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    @property
    def queue_depth(self) -> int:
        """队列深度"""
        return len(self.queue)
    
    @property
    def stats(self) -> dict:
        """获取统计信息"""
        return {
            "queue_depth": self.queue_depth,
            "total_tasks": self.metrics.total_tasks,
            "completed_tasks": self.metrics.completed_tasks,
            "failed_tasks": self.metrics.failed_tasks,
            "avg_sync_time_ms": round(self.metrics.avg_sync_time_ms, 2),
            "running": self._running
        }
    
    def health_check(self) -> dict:
        """健康检查"""
        vector_health = self.vector_service.health_check()
        
        status = "healthy"
        if not self._running:
            status = "stopped"
        elif self.queue_depth > QUEUE_MAX_SIZE * 0.8:
            status = "degraded"
        elif vector_health.get("status") != "healthy":
            status = "degraded"
        
        return {
            "status": status,
            "running": self._running,
            "queue_depth": self.queue_depth,
            "queue_max_size": QUEUE_MAX_SIZE,
            "metrics": self.stats,
            "vector_service": vector_health
        }


# ============== 全局实例 ==============

_service: Optional[SyncService] = None


def get_sync_service() -> SyncService:
    """获取全局同步服务实例"""
    global _service
    if _service is None:
        _service = SyncService()
    return _service


# ============== 测试入口 ==============

if __name__ == "__main__":
    async def test():
        print("=" * 50)
        print("SyncService 测试")
        print("=" * 50)
        
        service = get_sync_service()
        
        # 健康检查
        print("\n1. 健康检查...")
        health = service.health_check()
        print(f"   状态: {health['status']}")
        print(f"   运行中: {health['running']}")
        print(f"   队列深度: {health['queue_depth']}")
        
        # 启动服务
        print("\n2. 启动同步服务...")
        service.start()
        await asyncio.sleep(0.5)
        
        # 入队测试任务
        print("\n3. 入队测试任务...")
        task_id = service.enqueue_create(
            doc_id=9999,
            content="这是一个测试文档，用于验证同步服务功能。",
            source_type="test",
            source_path="/test/doc.txt",
            metadata={"test": True}
        )
        print(f"   任务 ID: {task_id}")
        print(f"   队列深度: {service.queue_depth}")
        
        # 等待处理
        print("\n4. 等待处理...")
        await asyncio.sleep(3)
        
        # 统计
        print("\n5. 统计信息:")
        stats = service.stats
        for key, value in stats.items():
            print(f"   {key}: {value}")
        
        # 停止服务
        print("\n6. 停止同步服务...")
        service.stop()
        
        print("\n测试完成!")
    
    asyncio.run(test())
