#!/usr/bin/env python3
"""
文件摄入管理器

监听 import_folder 目录，自动处理新增的视频和 PPT 文件，
并将提取的内容写入 SeekDB。

使用方法:
    python ingest_manager.py

支持的文件类型:
    - 视频: .mp4, .mkv, .avi, .mov, .webm
    - PPT: .pptx
    - PDF: .pdf (未来支持)
"""

import os
import sys
import time
import json
import uuid
from pathlib import Path
from typing import Optional, Dict, Any, List

from dotenv import load_dotenv
from loguru import logger
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent

# 加载环境变量
load_dotenv()

# 导入处理器
from video_processor import process_video, VideoChunk
from ppt_processor import process_ppt, SlideContent, get_ppt_metadata


# 支持的文件类型
VIDEO_EXTENSIONS = {'.mp4', '.mkv', '.avi', '.mov', '.webm'}
PPT_EXTENSIONS = {'.pptx'}
PDF_EXTENSIONS = {'.pdf'}  # 未来支持


class IngestManager:
    """文件摄入管理器"""
    
    def __init__(
        self,
        import_folder: Optional[str] = None,
        seekdb_config: Optional[Dict[str, Any]] = None
    ):
        """
        初始化摄入管理器
        
        Args:
            import_folder: 监听的文件夹路径
            seekdb_config: SeekDB 连接配置
        """
        # 导入文件夹
        self.import_folder = import_folder or os.getenv(
            "IMPORT_FOLDER",
            "./import_folder"
        )
        
        # SeekDB 配置
        self.seekdb_config = seekdb_config or {
            "host": os.getenv("SEEKDB_HOST", "seekdb"),
            "port": int(os.getenv("SEEKDB_PORT", "2881")),
            "user": os.getenv("SEEKDB_USER", "root"),
            "password": os.getenv("SEEKDB_PASSWORD", "echo123"),
            "database": os.getenv("SEEKDB_DATABASE", "echo"),
        }
        
        # Whisper 模型配置
        self.whisper_model = os.getenv("WHISPER_MODEL", "base")
        
        # 连接状态
        self.seekdb_client = None
        self.observer = None
        self.is_running = False
        
        logger.info(f"IngestManager 初始化完成")
        logger.info(f"监听目录: {self.import_folder}")
    
    def _connect_seekdb(self) -> None:
        """连接 SeekDB"""
        try:
            # 优先使用 pyseekdb SDK
            import pyseekdb
            
            self.seekdb_client = pyseekdb.Client(
                host=self.seekdb_config["host"],
                port=self.seekdb_config["port"],
                database=self.seekdb_config["database"],
                user=self.seekdb_config["user"],
                password=self.seekdb_config["password"]
            )
            logger.info("SeekDB 连接成功 (pyseekdb)")
            
        except ImportError:
            # 回退到 MySQL 连接器
            logger.info("pyseekdb 不可用，使用 PyMySQL")
            import pymysql
            
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
    
    def start_watching(self) -> None:
        """启动文件监听"""
        logger.info("启动文件监听...")
        
        # 确保目录存在
        Path(self.import_folder).mkdir(parents=True, exist_ok=True)
        
        # 连接 SeekDB
        self._connect_seekdb()
        
        # 创建事件处理器
        event_handler = FileEventHandler(self)
        
        # 创建观察者
        self.observer = Observer()
        self.observer.schedule(
            event_handler,
            self.import_folder,
            recursive=False
        )
        
        # 启动观察者
        self.observer.start()
        self.is_running = True
        
        logger.info(f"文件监听已启动，监听目录: {self.import_folder}")
        
        try:
            while self.is_running:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("收到中断信号，停止监听...")
            self.stop()
    
    def stop(self) -> None:
        """停止文件监听"""
        self.is_running = False
        if self.observer:
            self.observer.stop()
            self.observer.join()
        logger.info("文件监听已停止")
    
    def on_file_created(self, file_path: str) -> None:
        """
        处理新文件
        
        Args:
            file_path: 新文件路径
        """
        logger.info(f"检测到新文件: {file_path}")
        
        # 等待文件写入完成
        time.sleep(1)
        
        # 路由到对应处理器
        processor = self.route_file(file_path)
        
        if processor == "video":
            self.ingest_video(file_path)
        elif processor == "ppt":
            self.ingest_ppt(file_path)
        elif processor == "pdf":
            logger.info(f"PDF 处理暂未实现: {file_path}")
        else:
            logger.warning(f"不支持的文件类型: {file_path}")
    
    def route_file(self, file_path: str) -> Optional[str]:
        """
        根据扩展名路由到处理器
        
        Args:
            file_path: 文件路径
        
        Returns:
            处理器名称: 'video', 'ppt', 'pdf', 或 None
        """
        ext = Path(file_path).suffix.lower()
        
        if ext in VIDEO_EXTENSIONS:
            return "video"
        elif ext in PPT_EXTENSIONS:
            return "ppt"
        elif ext in PDF_EXTENSIONS:
            return "pdf"
        else:
            return None
    
    def ingest_video(self, file_path: str) -> None:
        """
        摄入视频文件
        
        Args:
            file_path: 视频文件路径
        """
        logger.info(f"开始处理视频: {file_path}")
        
        try:
            # 处理视频
            chunks = process_video(file_path, model=self.whisper_model)
            
            if not chunks:
                logger.warning(f"视频无内容: {file_path}")
                return
            
            # 获取文件信息
            abs_path = str(Path(file_path).absolute())
            file_name = Path(file_path).name
            
            # 写入 SeekDB
            for i, chunk in enumerate(chunks):
                chunk_id = f"video-{uuid.uuid4().hex[:12]}-{i}"
                
                metadata = {
                    "start_time": chunk.start_time,
                    "end_time": chunk.end_time,
                    "file_path": abs_path,
                    "file_name": file_name,
                    "chunk_index": i,
                    "total_chunks": len(chunks)
                }
                
                self._write_to_seekdb(
                    id=chunk_id,
                    content=chunk.text,
                    source_type="video",
                    source_path=abs_path,
                    metadata=metadata
                )
            
            logger.info(f"视频处理完成: {file_path}，共 {len(chunks)} 个块")
            
        except Exception as e:
            # 错误处理：记录日志但不崩溃
            logger.error(f"视频处理失败 {file_path}: {e}")
    
    def ingest_ppt(self, file_path: str) -> None:
        """
        摄入 PPT 文件
        
        Args:
            file_path: PPT 文件路径
        """
        logger.info(f"开始处理 PPT: {file_path}")
        
        try:
            # 处理 PPT
            slides = process_ppt(file_path)
            
            if not slides:
                logger.warning(f"PPT 无内容: {file_path}")
                return
            
            # 获取元数据
            ppt_meta = get_ppt_metadata(file_path)
            abs_path = str(Path(file_path).absolute())
            file_name = Path(file_path).name
            
            # 写入 SeekDB
            for slide in slides:
                if not slide.text.strip():
                    continue  # 跳过空白页
                
                slide_id = f"ppt-{uuid.uuid4().hex[:12]}-p{slide.page_number}"
                
                metadata = {
                    "page_number": slide.page_number,
                    "total_pages": ppt_meta.get("total_pages", len(slides)),
                    "file_path": abs_path,
                    "file_name": file_name,
                    "title": slide.title
                }
                
                self._write_to_seekdb(
                    id=slide_id,
                    content=slide.text,
                    source_type="ppt",
                    source_path=abs_path,
                    metadata=metadata
                )
            
            logger.info(f"PPT 处理完成: {file_path}，共 {len(slides)} 页")
            
        except Exception as e:
            # 错误处理：记录日志但不崩溃
            logger.error(f"PPT 处理失败 {file_path}: {e}")
    
    def _write_to_seekdb(
        self,
        id: str,
        content: str,
        source_type: str,
        source_path: str,
        metadata: Dict[str, Any]
    ) -> None:
        """
        写入记录到 SeekDB
        
        Args:
            id: 记录 ID
            content: 内容文本
            source_type: 来源类型
            source_path: 来源路径
            metadata: 元数据
        """
        try:
            # 检查是否使用 pyseekdb SDK
            if hasattr(self.seekdb_client, 'get_or_create_collection'):
                # 使用 pyseekdb Collection API
                collection = self.seekdb_client.get_or_create_collection(
                    name="knowledge_base"
                )
                
                collection.add(
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
                
            logger.debug(f"写入 SeekDB: {id}")
            
        except Exception as e:
            logger.error(f"写入 SeekDB 失败: {e}")
            raise


class FileEventHandler(FileSystemEventHandler):
    """文件系统事件处理器"""
    
    def __init__(self, manager: IngestManager):
        self.manager = manager
        super().__init__()
    
    def on_created(self, event: FileCreatedEvent) -> None:
        """处理文件创建事件"""
        if event.is_directory:
            return
        
        self.manager.on_file_created(event.src_path)


def main():
    """主函数"""
    logger.info("=" * 50)
    logger.info("Echo Sidecar - 文件摄入管理器")
    logger.info("=" * 50)
    
    try:
        manager = IngestManager()
        manager.start_watching()
    except Exception as e:
        logger.error(f"启动失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
