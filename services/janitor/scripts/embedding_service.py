#!/usr/bin/env python3
"""
Embedding 生成服务

使用 Ollama 的 nomic-embed-text 模型生成文本向量嵌入。
支持单文本和批量生成，当 Ollama 不可用时优雅降级（返回 None）。

使用方法:
    from embedding_service import EmbeddingService
    
    service = EmbeddingService()
    
    # 单文本 embedding
    embedding = service.generate("Hello, world!")
    
    # 批量 embedding
    embeddings = service.generate_batch(["text1", "text2", "text3"])
    
    # 检查服务可用性
    if service.is_available():
        print("Ollama 服务可用")
"""

import os
import logging
from typing import Optional, List
from dataclasses import dataclass

import httpx

# ============== 日志配置 ==============

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============== 配置数据类 ==============

@dataclass
class EmbeddingConfig:
    """Embedding 服务配置"""
    ollama_host: str
    model: str
    timeout: float  # 请求超时时间（秒）
    batch_size: int  # 批量处理时的分批大小


# ============== 默认配置 ==============

DEFAULT_OLLAMA_HOST = "http://localhost:11434"
DEFAULT_MODEL = "nomic-embed-text"
DEFAULT_TIMEOUT = 30.0
DEFAULT_BATCH_SIZE = 10


# ============== Embedding 服务类 ==============

class EmbeddingService:
    """
    Embedding 生成服务
    
    使用 Ollama API 生成文本向量嵌入。
    当 Ollama 服务不可用时，所有方法返回 None，允许调用方回退到纯文本搜索。
    
    Attributes:
        config: 服务配置
        client: HTTP 客户端
    """
    
    def __init__(
        self,
        ollama_host: str = DEFAULT_OLLAMA_HOST,
        model: str = DEFAULT_MODEL,
        timeout: float = DEFAULT_TIMEOUT,
        batch_size: int = DEFAULT_BATCH_SIZE
    ):
        """
        初始化 Embedding 服务
        
        Args:
            ollama_host: Ollama 服务地址，默认 http://localhost:11434
            model: 使用的 embedding 模型，默认 nomic-embed-text
            timeout: 请求超时时间（秒），默认 30 秒
            batch_size: 批量处理时的分批大小，默认 10
        """
        # 支持从环境变量读取配置
        self.config = EmbeddingConfig(
            ollama_host=os.getenv("OLLAMA_HOST", ollama_host),
            model=os.getenv("OLLAMA_EMBEDDING_MODEL", model),
            timeout=float(os.getenv("OLLAMA_TIMEOUT", str(timeout))),
            batch_size=int(os.getenv("OLLAMA_BATCH_SIZE", str(batch_size)))
        )
        
        # 创建 HTTP 客户端
        self.client = httpx.Client(
            base_url=self.config.ollama_host,
            timeout=self.config.timeout
        )
        
        # 缓存服务可用性状态
        self._available: Optional[bool] = None
        
        logger.info(f"EmbeddingService 初始化完成")
        logger.info(f"  - Ollama Host: {self.config.ollama_host}")
        logger.info(f"  - Model: {self.config.model}")
        logger.info(f"  - Timeout: {self.config.timeout}s")
    
    def is_available(self) -> bool:
        """
        检查 Ollama 服务是否可用
        
        通过调用 Ollama 的健康检查端点来验证服务状态。
        结果会被缓存，避免频繁检查。
        
        Returns:
            True 如果服务可用，否则 False
        """
        # 如果已经检查过，返回缓存结果
        if self._available is not None:
            return self._available
        
        try:
            # 调用 Ollama 的根端点检查服务状态
            response = self.client.get("/")
            self._available = response.status_code == 200
            
            if self._available:
                logger.info("✅ Ollama 服务可用")
            else:
                logger.warning(f"⚠️ Ollama 服务返回异常状态码: {response.status_code}")
                
        except httpx.ConnectError:
            logger.warning(f"⚠️ 无法连接到 Ollama 服务: {self.config.ollama_host}")
            self._available = False
        except httpx.TimeoutException:
            logger.warning(f"⚠️ 连接 Ollama 服务超时")
            self._available = False
        except Exception as e:
            logger.warning(f"⚠️ 检查 Ollama 服务时发生错误: {e}")
            self._available = False
        
        return self._available
    
    def reset_availability_cache(self) -> None:
        """
        重置服务可用性缓存
        
        下次调用 is_available() 时会重新检查服务状态。
        """
        self._available = None
        logger.debug("已重置 Ollama 可用性缓存")
    
    def generate(self, text: str) -> Optional[List[float]]:
        """
        生成单个文本的 embedding
        
        Args:
            text: 要生成 embedding 的文本
            
        Returns:
            embedding 向量（浮点数列表），如果生成失败返回 None
        """
        # 检查服务可用性
        if not self.is_available():
            logger.debug("Ollama 服务不可用，跳过 embedding 生成")
            return None
        
        # 空文本检查
        if not text or not text.strip():
            logger.warning("输入文本为空，跳过 embedding 生成")
            return None
        
        try:
            # 调用 Ollama embedding API
            # API 文档: https://github.com/ollama/ollama/blob/main/docs/api.md#generate-embeddings
            response = self.client.post(
                "/api/embeddings",
                json={
                    "model": self.config.model,
                    "prompt": text
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Ollama API 返回错误: {response.status_code} - {response.text}")
                return None
            
            data = response.json()
            embedding = data.get("embedding")
            
            if embedding is None:
                logger.error(f"Ollama 响应中没有 embedding 字段: {data}")
                return None
            
            logger.debug(f"生成 embedding 成功，维度: {len(embedding)}")
            return embedding
            
        except httpx.TimeoutException:
            logger.error(f"生成 embedding 超时: {text[:50]}...")
            # 超时可能是临时问题，重置缓存以便下次重试
            self.reset_availability_cache()
            return None
        except httpx.ConnectError:
            logger.error(f"无法连接到 Ollama 服务")
            self._available = False
            return None
        except Exception as e:
            logger.error(f"生成 embedding 时发生错误: {e}")
            return None
    
    def generate_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """
        批量生成 embedding
        
        对于大量文本，会分批处理以避免超时。
        每个文本独立处理，单个失败不影响其他文本。
        
        Args:
            texts: 要生成 embedding 的文本列表
            
        Returns:
            embedding 向量列表，与输入文本一一对应。
            如果某个文本生成失败，对应位置为 None。
        """
        if not texts:
            return []
        
        # 检查服务可用性
        if not self.is_available():
            logger.debug("Ollama 服务不可用，返回空 embedding 列表")
            return [None] * len(texts)
        
        results: List[Optional[List[float]]] = []
        total = len(texts)
        
        logger.info(f"开始批量生成 embedding，共 {total} 个文本")
        
        # 分批处理
        for i in range(0, total, self.config.batch_size):
            batch = texts[i:i + self.config.batch_size]
            batch_num = i // self.config.batch_size + 1
            total_batches = (total + self.config.batch_size - 1) // self.config.batch_size
            
            logger.debug(f"处理批次 {batch_num}/{total_batches}")
            
            # 逐个处理批次中的文本
            for text in batch:
                embedding = self.generate(text)
                results.append(embedding)
                
                # 如果服务变得不可用，剩余的都返回 None
                if not self.is_available():
                    remaining = total - len(results)
                    results.extend([None] * remaining)
                    logger.warning(f"Ollama 服务不可用，剩余 {remaining} 个文本跳过")
                    return results
        
        # 统计成功率
        success_count = sum(1 for r in results if r is not None)
        logger.info(f"批量 embedding 完成: {success_count}/{total} 成功")
        
        return results
    
    def close(self) -> None:
        """
        关闭 HTTP 客户端
        
        释放连接资源。建议在服务不再使用时调用。
        """
        self.client.close()
        logger.debug("EmbeddingService 已关闭")
    
    def __enter__(self) -> "EmbeddingService":
        """支持 with 语句"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """退出 with 语句时关闭客户端"""
        self.close()


# ============== 便捷函数 ==============

# 全局单例实例
_default_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """
    获取全局 EmbeddingService 单例
    
    Returns:
        EmbeddingService 实例
    """
    global _default_service
    if _default_service is None:
        _default_service = EmbeddingService()
    return _default_service


def generate_embedding(text: str) -> Optional[List[float]]:
    """
    便捷函数：生成单个文本的 embedding
    
    使用全局单例服务。
    
    Args:
        text: 要生成 embedding 的文本
        
    Returns:
        embedding 向量，如果失败返回 None
    """
    return get_embedding_service().generate(text)


def generate_embeddings_batch(texts: List[str]) -> List[Optional[List[float]]]:
    """
    便捷函数：批量生成 embedding
    
    使用全局单例服务。
    
    Args:
        texts: 要生成 embedding 的文本列表
        
    Returns:
        embedding 向量列表
    """
    return get_embedding_service().generate_batch(texts)


# ============== 测试入口 ==============

if __name__ == "__main__":
    print("=" * 50)
    print("Embedding Service 测试")
    print("=" * 50)
    
    # 创建服务实例
    service = EmbeddingService()
    
    # 检查服务可用性
    print(f"\n1. 检查 Ollama 服务可用性...")
    available = service.is_available()
    print(f"   服务可用: {available}")
    
    if not available:
        print("\n⚠️ Ollama 服务不可用，请确保:")
        print("   1. Ollama 已安装并运行")
        print("   2. nomic-embed-text 模型已下载: ollama pull nomic-embed-text")
        print("   3. 服务地址正确 (默认 http://localhost:11434)")
    else:
        # 测试单文本 embedding
        print(f"\n2. 测试单文本 embedding...")
        test_text = "这是一个测试文本，用于验证 embedding 生成功能。"
        embedding = service.generate(test_text)
        
        if embedding:
            print(f"   ✅ 生成成功!")
            print(f"   维度: {len(embedding)}")
            print(f"   前 5 个值: {embedding[:5]}")
        else:
            print("   ❌ 生成失败")
        
        # 测试批量 embedding
        print(f"\n3. 测试批量 embedding...")
        test_texts = [
            "第一个测试文本",
            "第二个测试文本",
            "第三个测试文本",
        ]
        embeddings = service.generate_batch(test_texts)
        
        success_count = sum(1 for e in embeddings if e is not None)
        print(f"   成功: {success_count}/{len(test_texts)}")
        
        for i, emb in enumerate(embeddings):
            if emb:
                print(f"   文本 {i+1}: 维度 {len(emb)}")
            else:
                print(f"   文本 {i+1}: 失败")
    
    # 关闭服务
    service.close()
    print("\n测试完成!")
