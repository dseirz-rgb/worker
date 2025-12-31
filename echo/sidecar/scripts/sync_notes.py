#!/usr/bin/env python3
"""
Supabase 笔记同步脚本

监听 Supabase notes 表的 INSERT/UPDATE 事件，
自动同步到本地 SeekDB 数据库。

使用方法:
    python sync_notes.py

环境变量:
    SUPABASE_URL - Supabase 项目 URL
    SUPABASE_KEY - Supabase API Key
    SEEKDB_HOST - SeekDB 主机地址
    SEEKDB_PORT - SeekDB 端口
    SEEKDB_USER - SeekDB 用户名
    SEEKDB_PASSWORD - SeekDB 密码
    SEEKDB_DATABASE - SeekDB 数据库名
"""

import os
import sys
import time
import json
import uuid
from datetime import datetime
from typing import Optional, Dict, Any

from dotenv import load_dotenv
from loguru import logger

# 加载环境变量
load_dotenv()


class SyncWorker:
    """Supabase → SeekDB 同步器"""
    
    def __init__(self):
        """初始化同步器，连接 Supabase 和 SeekDB"""
        # 验证环境变量
        self._validate_env()
        
        # Supabase 配置
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_KEY")
        
        # SeekDB 配置
        self.seekdb_config = {
            "host": os.getenv("SEEKDB_HOST", "seekdb"),
            "port": int(os.getenv("SEEKDB_PORT", "2881")),
            "user": os.getenv("SEEKDB_USER", "root"),
            "password": os.getenv("SEEKDB_PASSWORD", "echo123"),
            "database": os.getenv("SEEKDB_DATABASE", "echo"),
        }
        
        # 连接状态
        self.supabase_client = None
        self.seekdb_client = None
        self.is_running = False
        
        # 重试配置
        self.max_retries = 5
        self.initial_backoff = 1  # 秒
        
        logger.info("SyncWorker 初始化完成")
    
    def _validate_env(self) -> None:
        """验证必要的环境变量"""
        required_vars = [
            "SUPABASE_URL",
            "SUPABASE_KEY",
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise EnvironmentError(f"缺少必要环境变量: {', '.join(missing)}")
    
    def _connect_supabase(self) -> None:
        """连接 Supabase，支持指数退避重试"""
        from supabase import create_client
        
        for attempt in range(self.max_retries):
            try:
                self.supabase_client = create_client(
                    self.supabase_url,
                    self.supabase_key
                )
                logger.info("Supabase 连接成功")
                return
            except Exception as e:
                wait_time = self.initial_backoff * (2 ** attempt)
                logger.warning(f"Supabase 连接失败 (尝试 {attempt + 1}/{self.max_retries}): {e}")
                logger.info(f"{wait_time} 秒后重试...")
                time.sleep(wait_time)
        
        raise ConnectionError("无法连接到 Supabase，已达到最大重试次数")
    
    def _connect_seekdb(self) -> None:
        """连接 SeekDB，支持指数退避重试"""
        try:
            # 优先使用 pyseekdb SDK
            import pyseekdb
            
            for attempt in range(self.max_retries):
                try:
                    self.seekdb_client = pyseekdb.Client(
                        host=self.seekdb_config["host"],
                        port=self.seekdb_config["port"],
                        database=self.seekdb_config["database"],
                        user=self.seekdb_config["user"],
                        password=self.seekdb_config["password"]
                    )
                    logger.info("SeekDB 连接成功 (pyseekdb)")
                    return
                except Exception as e:
                    wait_time = self.initial_backoff * (2 ** attempt)
                    logger.warning(f"SeekDB 连接失败 (尝试 {attempt + 1}/{self.max_retries}): {e}")
                    time.sleep(wait_time)
                    
        except ImportError:
            # 回退到 MySQL 连接器
            logger.info("pyseekdb 不可用，使用 MySQL 连接器")
            import pymysql
            
            for attempt in range(self.max_retries):
                try:
                    self.seekdb_client = pymysql.connect(
                        host=self.seekdb_config["host"],
                        port=self.seekdb_config["port"],
                        user=self.seekdb_config["user"],
                        password=self.seekdb_config["password"],
                        database=self.seekdb_config["database"],
                        charset="utf8mb4",
                        cursorclass=pymysql.cursors.DictCursor
                    )
                    logger.info("SeekDB 连接成功 (pymysql)")
                    return
                except Exception as e:
                    wait_time = self.initial_backoff * (2 ** attempt)
                    logger.warning(f"SeekDB 连接失败 (尝试 {attempt + 1}/{self.max_retries}): {e}")
                    time.sleep(wait_time)
        
        raise ConnectionError("无法连接到 SeekDB，已达到最大重试次数")
    
    def start(self) -> None:
        """启动同步服务，订阅 Supabase Realtime"""
        logger.info("启动 SyncWorker...")
        
        # 建立连接
        self._connect_supabase()
        self._connect_seekdb()
        
        # 订阅 notes 表变更
        self.is_running = True
        
        try:
            # Supabase Realtime 订阅
            channel = self.supabase_client.channel("notes-changes")
            
            channel.on_postgres_changes(
                event="INSERT",
                schema="public",
                table="notes",
                callback=self._on_insert
            ).on_postgres_changes(
                event="UPDATE",
                schema="public",
                table="notes",
                callback=self._on_update
            ).subscribe()
            
            logger.info("已订阅 Supabase notes 表变更")
            
            # 保持运行
            while self.is_running:
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("收到中断信号，停止同步...")
            self.stop()
        except Exception as e:
            logger.error(f"同步服务异常: {e}")
            raise
    
    def stop(self) -> None:
        """停止同步服务"""
        self.is_running = False
        logger.info("SyncWorker 已停止")
    
    def _on_insert(self, payload: Dict[str, Any]) -> None:
        """处理 INSERT 事件"""
        try:
            record = payload.get("record", {})
            logger.info(f"收到 INSERT 事件: {record.get('id', 'unknown')}")
            self._sync_to_seekdb(record)
        except Exception as e:
            logger.error(f"处理 INSERT 事件失败: {e}")
    
    def _on_update(self, payload: Dict[str, Any]) -> None:
        """处理 UPDATE 事件"""
        try:
            record = payload.get("record", {})
            logger.info(f"收到 UPDATE 事件: {record.get('id', 'unknown')}")
            self._sync_to_seekdb(record)
        except Exception as e:
            logger.error(f"处理 UPDATE 事件失败: {e}")
    
    def _sync_to_seekdb(self, note: Dict[str, Any]) -> None:
        """
        同步单条笔记到 SeekDB
        
        Args:
            note: Supabase 笔记记录
        """
        try:
            # 提取笔记内容
            note_id = note.get("id", str(uuid.uuid4()))
            content = note.get("content", "")
            tags = note.get("tags", [])
            is_todo = note.get("is_todo", False)
            created_at = note.get("created_at", datetime.now().isoformat())
            
            if not content:
                logger.warning(f"笔记 {note_id} 内容为空，跳过")
                return
            
            # 构建元数据
            metadata = {
                "supabase_id": note_id,
                "tags": tags if isinstance(tags, list) else [],
                "is_todo": is_todo,
            }
            
            # 生成唯一 ID (基于 Supabase ID)
            kb_id = f"note-{note_id}"
            
            # 插入或更新到 SeekDB
            self._upsert_to_seekdb(
                id=kb_id,
                content=content,
                source_type="note",
                source_path=f"supabase:{note_id}",
                metadata=metadata
            )
            
            logger.info(f"笔记 {note_id} 同步成功")
            
        except Exception as e:
            logger.error(f"同步笔记到 SeekDB 失败: {e}")
            raise
    
    def _upsert_to_seekdb(
        self,
        id: str,
        content: str,
        source_type: str,
        source_path: str,
        metadata: Dict[str, Any]
    ) -> None:
        """
        插入或更新记录到 SeekDB
        
        SeekDB 会自动调用 AI_EMBED 生成向量嵌入
        """
        try:
            # 检查是否使用 pyseekdb SDK
            if hasattr(self.seekdb_client, 'get_or_create_collection'):
                # 使用 pyseekdb Collection API
                collection = self.seekdb_client.get_or_create_collection(
                    name="knowledge_base"
                )
                
                # 使用 upsert 操作
                collection.upsert(
                    ids=[id],
                    documents=[content],
                    metadatas=[{
                        "source_type": source_type,
                        "source_path": source_path,
                        **metadata
                    }]
                )
            else:
                # 使用 SQL 方式 (pymysql)
                cursor = self.seekdb_client.cursor()
                
                # UPSERT 语句 (INSERT ... ON DUPLICATE KEY UPDATE)
                sql = """
                INSERT INTO knowledge_base (id, content, source_type, source_path, metadata)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    content = VALUES(content),
                    source_type = VALUES(source_type),
                    source_path = VALUES(source_path),
                    metadata = VALUES(metadata),
                    updated_at = CURRENT_TIMESTAMP
                """
                
                cursor.execute(sql, (
                    id,
                    content,
                    source_type,
                    source_path,
                    json.dumps(metadata, ensure_ascii=False)
                ))
                
                self.seekdb_client.commit()
                cursor.close()
                
        except Exception as e:
            logger.error(f"写入 SeekDB 失败: {e}")
            raise


def main():
    """主函数"""
    logger.info("=" * 50)
    logger.info("Echo Sidecar - Supabase 同步服务")
    logger.info("=" * 50)
    
    try:
        worker = SyncWorker()
        worker.start()
    except EnvironmentError as e:
        logger.error(f"环境配置错误: {e}")
        sys.exit(1)
    except ConnectionError as e:
        logger.error(f"连接错误: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"未知错误: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
