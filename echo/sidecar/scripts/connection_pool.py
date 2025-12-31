#!/usr/bin/env python3
"""
SeekDB 连接池管理

使用 mysql.connector.pooling 实现连接池，
减少连接创建开销，提高响应速度。

配置：
- min_size: 3 (最小空闲连接)
- max_size: 5 (最大连接数)
"""

import os
import logging
from typing import Optional
from contextlib import contextmanager

from mysql.connector import pooling, Error as MySQLError

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

# 连接池配置
POOL_MIN_SIZE = int(os.getenv('SEEKDB_POOL_MIN', '3'))
POOL_MAX_SIZE = int(os.getenv('SEEKDB_POOL_MAX', '5'))
POOL_NAME = 'seekdb_pool'


# ============== 连接池类 ==============

class SeekDBConnectionPool:
    """
    SeekDB 连接池管理器
    
    使用单例模式，确保全局只有一个连接池实例。
    """
    
    _instance: Optional['SeekDBConnectionPool'] = None
    _pool: Optional[pooling.MySQLConnectionPool] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._pool is None:
            self._initialize_pool()
    
    def _initialize_pool(self):
        """初始化连接池"""
        try:
            self._pool = pooling.MySQLConnectionPool(
                pool_name=POOL_NAME,
                pool_size=POOL_MAX_SIZE,
                pool_reset_session=True,
                host=SEEKDB_HOST,
                port=SEEKDB_PORT,
                user=SEEKDB_USER,
                password=SEEKDB_PASSWORD,
                database=SEEKDB_DATABASE,
                charset='utf8mb4',
                collation='utf8mb4_unicode_ci',
                use_unicode=True,
                autocommit=True,
                connection_timeout=10,
            )
            logger.info(f"✅ SeekDB 连接池初始化成功")
            logger.info(f"   - Host: {SEEKDB_HOST}:{SEEKDB_PORT}")
            logger.info(f"   - Database: {SEEKDB_DATABASE}")
            logger.info(f"   - Pool Size: {POOL_MAX_SIZE}")
        except MySQLError as e:
            logger.error(f"❌ SeekDB 连接池初始化失败: {e}")
            raise
    
    def get_connection(self):
        """
        从连接池获取连接
        
        Returns:
            MySQL 连接对象
            
        Raises:
            MySQLError: 获取连接失败
        """
        if self._pool is None:
            self._initialize_pool()
        
        try:
            conn = self._pool.get_connection()
            # 确保连接使用 UTF-8
            cursor = conn.cursor()
            cursor.execute("SET NAMES utf8mb4")
            cursor.close()
            return conn
        except MySQLError as e:
            logger.error(f"获取连接失败: {e}")
            raise
    
    @contextmanager
    def connection(self):
        """
        连接上下文管理器
        
        使用方法:
            with pool.connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
        """
        conn = None
        try:
            conn = self.get_connection()
            yield conn
        finally:
            if conn:
                conn.close()
    
    @contextmanager
    def cursor(self, dictionary: bool = True):
        """
        游标上下文管理器
        
        使用方法:
            with pool.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
        
        Args:
            dictionary: 是否返回字典格式结果
        """
        conn = None
        cursor = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor(dictionary=dictionary)
            yield cursor
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            raise
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
    
    def close_all(self):
        """关闭所有连接"""
        # mysql.connector.pooling 没有显式的 close_all 方法
        # 连接会在程序退出时自动关闭
        logger.info("连接池关闭")
    
    @property
    def pool_size(self) -> int:
        """当前连接池大小"""
        return POOL_MAX_SIZE
    
    def health_check(self) -> dict:
        """
        健康检查
        
        Returns:
            健康状态字典
        """
        try:
            with self.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            return {
                "status": "healthy",
                "pool_size": self.pool_size,
                "host": f"{SEEKDB_HOST}:{SEEKDB_PORT}",
                "database": SEEKDB_DATABASE
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "host": f"{SEEKDB_HOST}:{SEEKDB_PORT}",
                "database": SEEKDB_DATABASE
            }


# ============== 全局实例 ==============

_pool: Optional[SeekDBConnectionPool] = None


def get_pool() -> SeekDBConnectionPool:
    """获取全局连接池实例"""
    global _pool
    if _pool is None:
        _pool = SeekDBConnectionPool()
    return _pool


def get_connection():
    """便捷函数：获取连接"""
    return get_pool().get_connection()


def connection():
    """便捷函数：连接上下文管理器"""
    return get_pool().connection()


def cursor(dictionary: bool = True):
    """便捷函数：游标上下文管理器"""
    return get_pool().cursor(dictionary=dictionary)


# ============== 测试入口 ==============

if __name__ == "__main__":
    print("=" * 50)
    print("SeekDB 连接池测试")
    print("=" * 50)
    
    pool = get_pool()
    
    # 健康检查
    print("\n1. 健康检查...")
    health = pool.health_check()
    print(f"   状态: {health['status']}")
    
    if health['status'] == 'healthy':
        # 测试查询
        print("\n2. 测试查询...")
        with cursor() as cur:
            cur.execute("SELECT VERSION()")
            version = cur.fetchone()
            print(f"   数据库版本: {version}")
        
        # 测试多次获取连接
        print("\n3. 测试连接复用...")
        for i in range(5):
            with connection() as conn:
                print(f"   连接 {i+1}: {conn.connection_id}")
    else:
        print(f"   错误: {health.get('error', '未知错误')}")
    
    print("\n测试完成!")
