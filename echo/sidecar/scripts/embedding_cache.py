#!/usr/bin/env python3
"""
Embedding 缓存 (LRU)

缓存查询的 embedding 向量，避免重复调用 Ollama API。
使用 LRU (Least Recently Used) 策略淘汰旧条目。

配置：
- maxsize: 100 (最大缓存条目数)
"""

import logging
import hashlib
from collections import OrderedDict
from typing import Optional, List
from dataclasses import dataclass
from datetime import datetime

# ============== 日志配置 ==============

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============== 缓存条目 ==============

@dataclass
class CacheEntry:
    """缓存条目"""
    embedding: List[float]
    created_at: datetime
    access_count: int = 0


# ============== LRU 缓存 ==============

class EmbeddingCache:
    """
    LRU Embedding 缓存
    
    使用 OrderedDict 实现 LRU 淘汰策略。
    当缓存满时，淘汰最久未使用的条目。
    
    Attributes:
        maxsize: 最大缓存条目数
        _cache: 缓存存储 (OrderedDict)
        _hits: 缓存命中次数
        _misses: 缓存未命中次数
    """
    
    def __init__(self, maxsize: int = 100):
        """
        初始化缓存
        
        Args:
            maxsize: 最大缓存条目数，默认 100
        """
        self.maxsize = maxsize
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._hits = 0
        self._misses = 0
        
        logger.info(f"EmbeddingCache 初始化完成，容量: {maxsize}")
    
    def _make_key(self, text: str) -> str:
        """
        生成缓存键
        
        使用 MD5 哈希文本，避免长文本作为键
        
        Args:
            text: 原始文本
            
        Returns:
            缓存键 (MD5 哈希)
        """
        return hashlib.md5(text.encode('utf-8')).hexdigest()
    
    def get(self, text: str) -> Optional[List[float]]:
        """
        获取缓存的 embedding
        
        如果命中，将条目移到最近使用位置。
        
        Args:
            text: 查询文本
            
        Returns:
            embedding 向量，如果未命中返回 None
        """
        key = self._make_key(text)
        
        if key in self._cache:
            # 命中：移到最后（最近使用）
            self._cache.move_to_end(key)
            entry = self._cache[key]
            entry.access_count += 1
            self._hits += 1
            logger.debug(f"缓存命中: {key[:8]}...")
            return entry.embedding
        
        self._misses += 1
        logger.debug(f"缓存未命中: {key[:8]}...")
        return None
    
    def put(self, text: str, embedding: List[float]) -> None:
        """
        存入缓存
        
        如果缓存已满，淘汰最久未使用的条目。
        
        Args:
            text: 查询文本
            embedding: embedding 向量
        """
        key = self._make_key(text)
        
        # 如果已存在，更新并移到最后
        if key in self._cache:
            self._cache.move_to_end(key)
            self._cache[key].embedding = embedding
            logger.debug(f"缓存更新: {key[:8]}...")
            return
        
        # 如果缓存已满，淘汰最旧的条目
        if len(self._cache) >= self.maxsize:
            oldest_key, _ = self._cache.popitem(last=False)
            logger.debug(f"缓存淘汰: {oldest_key[:8]}...")
        
        # 添加新条目
        self._cache[key] = CacheEntry(
            embedding=embedding,
            created_at=datetime.now(),
            access_count=0
        )
        logger.debug(f"缓存添加: {key[:8]}...")
    
    def contains(self, text: str) -> bool:
        """
        检查是否存在缓存
        
        Args:
            text: 查询文本
            
        Returns:
            是否存在
        """
        key = self._make_key(text)
        return key in self._cache
    
    def remove(self, text: str) -> bool:
        """
        移除缓存条目
        
        Args:
            text: 查询文本
            
        Returns:
            是否成功移除
        """
        key = self._make_key(text)
        if key in self._cache:
            del self._cache[key]
            return True
        return False
    
    def clear(self) -> None:
        """清空缓存"""
        self._cache.clear()
        logger.info("缓存已清空")
    
    @property
    def size(self) -> int:
        """当前缓存大小"""
        return len(self._cache)
    
    @property
    def hit_rate(self) -> float:
        """
        缓存命中率
        
        Returns:
            命中率 (0.0 - 1.0)
        """
        total = self._hits + self._misses
        if total == 0:
            return 0.0
        return self._hits / total
    
    @property
    def stats(self) -> dict:
        """
        缓存统计信息
        
        Returns:
            统计字典
        """
        return {
            "size": self.size,
            "maxsize": self.maxsize,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self.hit_rate, 4),
            "utilization": round(self.size / self.maxsize, 4) if self.maxsize > 0 else 0
        }
    
    def reset_stats(self) -> None:
        """重置统计计数"""
        self._hits = 0
        self._misses = 0
        logger.info("缓存统计已重置")


# ============== 全局实例 ==============

_cache: Optional[EmbeddingCache] = None


def get_embedding_cache(maxsize: int = 100) -> EmbeddingCache:
    """
    获取全局缓存实例
    
    Args:
        maxsize: 最大缓存条目数
        
    Returns:
        EmbeddingCache 实例
    """
    global _cache
    if _cache is None:
        _cache = EmbeddingCache(maxsize=maxsize)
    return _cache


# ============== 测试入口 ==============

if __name__ == "__main__":
    print("=" * 50)
    print("Embedding Cache 测试")
    print("=" * 50)
    
    cache = EmbeddingCache(maxsize=5)
    
    # 测试添加
    print("\n1. 测试添加...")
    for i in range(7):
        text = f"测试文本 {i}"
        embedding = [float(i)] * 10
        cache.put(text, embedding)
        print(f"   添加: {text}, 缓存大小: {cache.size}")
    
    # 测试获取
    print("\n2. 测试获取...")
    for i in range(7):
        text = f"测试文本 {i}"
        result = cache.get(text)
        status = "命中" if result else "未命中"
        print(f"   {text}: {status}")
    
    # 测试 LRU 淘汰
    print("\n3. 测试 LRU 淘汰...")
    # 访问 "测试文本 2" 使其变为最近使用
    cache.get("测试文本 2")
    # 添加新条目，应该淘汰 "测试文本 3"（最久未使用）
    cache.put("新文本", [0.0] * 10)
    print(f"   添加新文本后，'测试文本 2' 存在: {cache.contains('测试文本 2')}")
    print(f"   添加新文本后，'测试文本 3' 存在: {cache.contains('测试文本 3')}")
    
    # 统计信息
    print("\n4. 缓存统计...")
    stats = cache.stats
    for key, value in stats.items():
        print(f"   {key}: {value}")
    
    print("\n测试完成!")
