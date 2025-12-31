#!/usr/bin/env python3
"""
数据迁移脚本

将现有数据迁移到双数据库架构：
1. 从 SeekDB 导出文档元数据到 PostgreSQL
2. 为所有文档生成 embedding 并存入 SeekDB

使用方式:
  python migrate_data.py --export-to-postgres  # 导出到 PostgreSQL
  python migrate_data.py --sync-embeddings     # 同步 embeddings
  python migrate_data.py --full                # 完整迁移
"""

import os
import sys
import json
import asyncio
import logging
import argparse
from typing import Optional, List, Dict, Any
from datetime import datetime

# ============== 日志配置 ==============

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== 配置 ==============

BATCH_SIZE = int(os.getenv('MIGRATE_BATCH_SIZE', '50'))
SEEKDB_HOST = os.getenv('SEEKDB_HOST', 'localhost')
SEEKDB_PORT = int(os.getenv('SEEKDB_PORT', '2881'))
SEEKDB_USER = os.getenv('SEEKDB_USER', 'root')
SEEKDB_PASSWORD = os.getenv('SEEKDB_PASSWORD', '')
SEEKDB_DATABASE = os.getenv('SEEKDB_DATABASE', 'echo')

BLINKO_API_URL = os.getenv('BLINKO_API_URL', 'http://localhost:1111')


# ============== SeekDB 连接 ==============

def get_seekdb_connection():
    """获取 SeekDB 连接"""
    import mysql.connector
    return mysql.connector.connect(
        host=SEEKDB_HOST,
        port=SEEKDB_PORT,
        user=SEEKDB_USER,
        password=SEEKDB_PASSWORD,
        database=SEEKDB_DATABASE,
        charset='utf8mb4'
    )


# ============== 导出到 PostgreSQL ==============

async def export_to_postgres():
    """
    从 SeekDB 导出文档元数据到 PostgreSQL
    """
    import aiohttp
    
    logger.info("开始导出数据到 PostgreSQL...")
    
    conn = get_seekdb_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 获取所有文档
        cursor.execute("""
            SELECT id, content, source_type, source_path, metadata, created_at
            FROM knowledge_base
            ORDER BY id
        """)
        
        documents = cursor.fetchall()
        total = len(documents)
        logger.info(f"找到 {total} 个文档")
        
        if total == 0:
            logger.info("没有需要迁移的文档")
            return
        
        # 批量导入到 PostgreSQL
        success_count = 0
        error_count = 0
        
        async with aiohttp.ClientSession() as session:
            for i in range(0, total, BATCH_SIZE):
                batch = documents[i:i + BATCH_SIZE]
                
                for doc in batch:
                    try:
                        # 解析 metadata
                        metadata = doc.get('metadata')
                        if isinstance(metadata, str):
                            metadata = json.loads(metadata)
                        elif metadata is None:
                            metadata = {}
                        
                        # 调用 PostgreSQL API 创建文档
                        payload = {
                            "content": doc['content'] or '',
                            "source_type": doc['source_type'] or '',
                            "source_path": doc['source_path'] or '',
                            "metadata": metadata
                        }
                        
                        async with session.post(
                            f"{BLINKO_API_URL}/api/documents/import",
                            json=payload,
                            timeout=aiohttp.ClientTimeout(total=10)
                        ) as response:
                            if response.status == 200:
                                success_count += 1
                            else:
                                error_count += 1
                                logger.warning(f"导入文档 {doc['id']} 失败: HTTP {response.status}")
                                
                    except Exception as e:
                        error_count += 1
                        logger.error(f"导入文档 {doc['id']} 错误: {e}")
                
                logger.info(f"进度: {min(i + BATCH_SIZE, total)}/{total}")
        
        logger.info(f"导出完成: 成功 {success_count}, 失败 {error_count}")
        
    finally:
        cursor.close()
        conn.close()


# ============== 同步 Embeddings ==============

async def sync_embeddings():
    """
    为所有 PostgreSQL 文档生成 embedding 并同步到 SeekDB
    """
    import aiohttp
    
    logger.info("开始同步 embeddings...")
    
    try:
        async with aiohttp.ClientSession() as session:
            # 获取所有需要同步的文档
            async with session.get(
                f"{BLINKO_API_URL}/api/documents/pending-sync",
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
                    logger.error(f"获取待同步文档失败: HTTP {response.status}")
                    return
                
                data = await response.json()
                documents = data.get('documents', [])
        
        total = len(documents)
        logger.info(f"找到 {total} 个待同步文档")
        
        if total == 0:
            logger.info("没有需要同步的文档")
            return
        
        # 使用 SyncService 批量同步
        from sync_service import get_sync_service
        sync_service = get_sync_service()
        sync_service.start()
        
        for i, doc in enumerate(documents):
            sync_service.enqueue_create(
                doc_id=doc['id'],
                content=doc['content'],
                source_type=doc.get('source_type', ''),
                source_path=doc.get('source_path', ''),
                metadata=doc.get('metadata', {})
            )
            
            if (i + 1) % 100 == 0:
                logger.info(f"入队进度: {i + 1}/{total}")
        
        logger.info(f"已入队 {total} 个同步任务")
        
        # 等待同步完成
        logger.info("等待同步完成...")
        while sync_service.queue_depth > 0:
            stats = sync_service.stats
            logger.info(f"队列深度: {stats['queue_depth']}, 完成: {stats['completed_tasks']}, 失败: {stats['failed_tasks']}")
            await asyncio.sleep(5)
        
        # 停止服务
        sync_service.stop()
        
        stats = sync_service.stats
        logger.info(f"同步完成: 总计 {stats['total_tasks']}, 成功 {stats['completed_tasks']}, 失败 {stats['failed_tasks']}")
        
    except Exception as e:
        logger.error(f"同步 embeddings 错误: {e}")


# ============== 批量生成 Embeddings ==============

async def batch_generate_embeddings():
    """
    直接从 SeekDB 读取文档并生成 embeddings
    """
    logger.info("开始批量生成 embeddings...")
    
    conn = get_seekdb_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 获取没有 embedding 的文档
        cursor.execute("""
            SELECT id, content, source_type, source_path, metadata
            FROM knowledge_base
            WHERE embedding IS NULL AND content IS NOT NULL AND content != ''
            ORDER BY id
        """)
        
        documents = cursor.fetchall()
        total = len(documents)
        logger.info(f"找到 {total} 个需要生成 embedding 的文档")
        
        if total == 0:
            logger.info("所有文档都已有 embedding")
            return
        
        # 导入 embedding 服务
        from embedding_service import get_embedding_service
        embedding_service = get_embedding_service()
        
        if not embedding_service.is_available():
            logger.error("Embedding 服务不可用")
            return
        
        success_count = 0
        error_count = 0
        
        for i, doc in enumerate(documents):
            try:
                content = doc['content']
                if not content:
                    continue
                
                # 生成 embedding
                embedding = embedding_service.generate(content[:8000])  # 限制长度
                
                if embedding is None:
                    error_count += 1
                    continue
                
                # 存储到 SeekDB
                embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
                
                cursor.execute("""
                    UPDATE knowledge_base
                    SET embedding = %s
                    WHERE id = %s
                """, (embedding_str, doc['id']))
                
                conn.commit()
                success_count += 1
                
            except Exception as e:
                error_count += 1
                logger.error(f"处理文档 {doc['id']} 错误: {e}")
            
            if (i + 1) % 10 == 0:
                logger.info(f"进度: {i + 1}/{total}, 成功: {success_count}, 失败: {error_count}")
        
        logger.info(f"批量生成完成: 成功 {success_count}, 失败 {error_count}")
        
    finally:
        cursor.close()
        conn.close()


# ============== 验证迁移 ==============

async def verify_migration():
    """
    验证迁移结果
    """
    logger.info("验证迁移结果...")
    
    conn = get_seekdb_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # SeekDB 统计
        cursor.execute("SELECT COUNT(*) as total FROM knowledge_base")
        seekdb_total = cursor.fetchone()['total']
        
        cursor.execute("SELECT COUNT(*) as total FROM knowledge_base WHERE embedding IS NOT NULL")
        seekdb_with_embedding = cursor.fetchone()['total']
        
        logger.info(f"SeekDB 统计:")
        logger.info(f"  - 总文档数: {seekdb_total}")
        logger.info(f"  - 有 embedding: {seekdb_with_embedding}")
        logger.info(f"  - 无 embedding: {seekdb_total - seekdb_with_embedding}")
        
        # PostgreSQL 统计 (通过 API)
        import aiohttp
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(
                    f"{BLINKO_API_URL}/api/stats",
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    if response.status == 200:
                        stats = await response.json()
                        logger.info(f"PostgreSQL 统计:")
                        logger.info(f"  - 文档数: {stats.get('documents', 'N/A')}")
            except:
                logger.warning("无法获取 PostgreSQL 统计")
        
    finally:
        cursor.close()
        conn.close()


# ============== 主函数 ==============

async def main():
    parser = argparse.ArgumentParser(description='数据迁移脚本')
    parser.add_argument('--export-to-postgres', action='store_true', help='导出到 PostgreSQL')
    parser.add_argument('--sync-embeddings', action='store_true', help='同步 embeddings')
    parser.add_argument('--batch-embeddings', action='store_true', help='批量生成 embeddings')
    parser.add_argument('--verify', action='store_true', help='验证迁移结果')
    parser.add_argument('--full', action='store_true', help='完整迁移')
    
    args = parser.parse_args()
    
    if args.full:
        await export_to_postgres()
        await batch_generate_embeddings()
        await verify_migration()
    elif args.export_to_postgres:
        await export_to_postgres()
    elif args.sync_embeddings:
        await sync_embeddings()
    elif args.batch_embeddings:
        await batch_generate_embeddings()
    elif args.verify:
        await verify_migration()
    else:
        parser.print_help()


if __name__ == "__main__":
    asyncio.run(main())
