#!/usr/bin/env python3
"""
Ingest API 服务

提供文件上传和处理状态查询的 REST API。
支持视频和 PPT 文件的异步处理。

启动方式: uvicorn ingest_api:app --host 0.0.0.0 --port 8766
"""

import os
import uuid
import json
import asyncio
import logging
from typing import Optional, List, Dict
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, asdict
from enum import Enum
from threading import Thread
from queue import Queue, Empty

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import mysql.connector
from mysql.connector import Error as MySQLError

# 导入处理器
from video_processor import process_video, VideoChunk
from ppt_processor import process_ppt, SlideContent
from embedding_service import EmbeddingService

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

# 文件存储路径
_default_storage = Path(__file__).parent.parent / 'storage'
STORAGE_PATH = Path(os.getenv('STORAGE_PATH', str(_default_storage)))
IMPORT_FOLDER = Path(os.getenv('IMPORT_FOLDER', str(STORAGE_PATH / 'import')))
STORAGE_PATH.mkdir(parents=True, exist_ok=True)
IMPORT_FOLDER.mkdir(parents=True, exist_ok=True)

# Whisper 模型配置
WHISPER_MODEL = os.getenv('WHISPER_MODEL', 'base')

# ============== 数据模型 ==============

class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class IngestRequest(BaseModel):
    """文件处理请求"""
    file_path: str = Field(..., description="文件路径")
    file_type: str = Field(..., description="文件类型: video, ppt")
    options: Optional[dict] = Field(default=None, description="处理选项")


class IngestTask(BaseModel):
    """处理任务"""
    task_id: str
    file_path: str
    file_type: str
    status: TaskStatus
    progress: int = 0
    chunks_count: int = 0
    error: Optional[str] = None
    created_at: str
    updated_at: str
    completed_at: Optional[str] = None


class IngestResponse(BaseModel):
    """处理响应"""
    task_id: str
    status: TaskStatus
    message: str


class TaskListResponse(BaseModel):
    """任务列表响应"""
    tasks: List[IngestTask]
    total: int


# ============== 数据库连接 ==============

def get_db_connection():
    """获取 SeekDB 数据库连接"""
    try:
        conn = mysql.connector.connect(
            host=SEEKDB_HOST,
            port=SEEKDB_PORT,
            user=SEEKDB_USER,
            password=SEEKDB_PASSWORD,
            database=SEEKDB_DATABASE,
            charset='utf8mb4',
            collation='utf8mb4_unicode_ci',
            use_unicode=True
        )
        return conn
    except MySQLError as e:
        logger.error(f"数据库连接失败: {e}")
        raise HTTPException(status_code=503, detail=f"数据库连接失败: {e}")


def init_ingest_tables():
    """初始化 ingest 相关表"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 创建任务表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ingest_tasks (
                id VARCHAR(36) PRIMARY KEY,
                file_path VARCHAR(500) NOT NULL,
                file_type VARCHAR(20) NOT NULL,
                status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
                progress INT DEFAULT 0,
                chunks_count INT DEFAULT 0,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                completed_at TIMESTAMP NULL
            )
        """)
        conn.commit()
        logger.info("Ingest 表初始化完成")
    except Exception as e:
        logger.error(f"初始化表失败: {e}")
    finally:
        cursor.close()
        conn.close()



# ============== 任务队列管理 ==============

class TaskQueue:
    """任务队列管理器"""
    
    def __init__(self):
        self._queue: Queue = Queue()
        self._worker_thread: Optional[Thread] = None
        self._running = False
        self._embedding_service: Optional[EmbeddingService] = None
    
    def start(self):
        """启动工作线程"""
        if self._running:
            return
        
        self._running = True
        self._embedding_service = EmbeddingService()
        self._worker_thread = Thread(target=self._worker_loop, daemon=True)
        self._worker_thread.start()
        logger.info("任务队列工作线程已启动")
    
    def stop(self):
        """停止工作线程"""
        self._running = False
        if self._worker_thread:
            self._worker_thread.join(timeout=5)
        logger.info("任务队列工作线程已停止")
    
    def add_task(self, task_id: str, file_path: str, file_type: str, options: dict = None):
        """添加任务到队列"""
        self._queue.put({
            "task_id": task_id,
            "file_path": file_path,
            "file_type": file_type,
            "options": options or {}
        })
        logger.info(f"任务已加入队列: {task_id}")
    
    def _worker_loop(self):
        """工作线程主循环"""
        while self._running:
            try:
                task = self._queue.get(timeout=1)
                self._process_task(task)
            except Empty:
                continue
            except Exception as e:
                logger.error(f"工作线程异常: {e}")
    
    def _process_task(self, task: dict):
        """处理单个任务"""
        task_id = task["task_id"]
        file_path = task["file_path"]
        file_type = task["file_type"]
        options = task.get("options", {})
        
        logger.info(f"开始处理任务: {task_id}, 文件: {file_path}")
        
        # 更新状态为处理中
        self._update_task_status(task_id, TaskStatus.PROCESSING, progress=0)
        
        try:
            if file_type == "video":
                chunks = self._process_video(task_id, file_path, options)
            elif file_type == "ppt":
                chunks = self._process_ppt(task_id, file_path, options)
            else:
                raise ValueError(f"不支持的文件类型: {file_type}")
            
            # 保存到 knowledge_base
            self._save_chunks(task_id, file_path, file_type, chunks)
            
            # 更新状态为完成
            self._update_task_status(
                task_id, 
                TaskStatus.COMPLETED, 
                progress=100,
                chunks_count=len(chunks)
            )
            logger.info(f"任务完成: {task_id}, 生成 {len(chunks)} 个块")
            
        except Exception as e:
            logger.error(f"任务失败: {task_id}, 错误: {e}")
            self._update_task_status(task_id, TaskStatus.FAILED, error=str(e))
    
    def _process_video(self, task_id: str, file_path: str, options: dict) -> List[dict]:
        """处理视频文件"""
        model = options.get("whisper_model", WHISPER_MODEL)
        
        # 更新进度: 开始转录
        self._update_task_status(task_id, TaskStatus.PROCESSING, progress=10)
        
        chunks = process_video(file_path, model=model)
        
        # 更新进度: 转录完成
        self._update_task_status(task_id, TaskStatus.PROCESSING, progress=50)
        
        # 转换为字典格式
        result = []
        for i, chunk in enumerate(chunks):
            chunk_dict = {
                "content": chunk.text,
                "metadata": {
                    "start_time": chunk.start_time,
                    "end_time": chunk.end_time,
                    "chunk_index": i
                }
            }
            
            # 生成 embedding (如果启用)
            if options.get("generate_embedding", True) and self._embedding_service:
                embedding = self._embedding_service.generate(chunk.text)
                if embedding:
                    chunk_dict["embedding"] = embedding
            
            result.append(chunk_dict)
            
            # 更新进度
            progress = 50 + int(40 * (i + 1) / len(chunks))
            self._update_task_status(task_id, TaskStatus.PROCESSING, progress=progress)
        
        return result
    
    def _process_ppt(self, task_id: str, file_path: str, options: dict) -> List[dict]:
        """处理 PPT 文件"""
        # 更新进度: 开始解析
        self._update_task_status(task_id, TaskStatus.PROCESSING, progress=10)
        
        slides = process_ppt(file_path)
        
        # 更新进度: 解析完成
        self._update_task_status(task_id, TaskStatus.PROCESSING, progress=50)
        
        # 转换为字典格式
        result = []
        for i, slide in enumerate(slides):
            slide_dict = {
                "content": slide.text,
                "metadata": {
                    "page_number": slide.page_number,
                    "title": slide.title
                }
            }
            
            # 生成 embedding (如果启用)
            if options.get("generate_embedding", True) and self._embedding_service:
                embedding = self._embedding_service.generate(slide.text)
                if embedding:
                    slide_dict["embedding"] = embedding
            
            result.append(slide_dict)
            
            # 更新进度
            progress = 50 + int(40 * (i + 1) / len(slides))
            self._update_task_status(task_id, TaskStatus.PROCESSING, progress=progress)
        
        return result
    
    def _save_chunks(self, task_id: str, file_path: str, file_type: str, chunks: List[dict]):
        """保存处理结果到 knowledge_base"""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            for chunk in chunks:
                chunk_id = str(uuid.uuid4())
                content = chunk["content"]
                metadata = json.dumps(chunk.get("metadata", {}), ensure_ascii=False)
                embedding = chunk.get("embedding")
                
                # 构建 SQL
                if embedding:
                    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
                    cursor.execute("""
                        INSERT INTO knowledge_base 
                        (id, content, source_type, source_path, metadata, embedding)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (chunk_id, content, file_type, file_path, metadata, embedding_str))
                else:
                    cursor.execute("""
                        INSERT INTO knowledge_base 
                        (id, content, source_type, source_path, metadata)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (chunk_id, content, file_type, file_path, metadata))
            
            conn.commit()
            logger.info(f"保存 {len(chunks)} 个块到 knowledge_base")
        except Exception as e:
            conn.rollback()
            logger.error(f"保存块失败: {e}")
            raise
        finally:
            cursor.close()
            conn.close()
    
    def _update_task_status(
        self, 
        task_id: str, 
        status: TaskStatus, 
        progress: int = None,
        chunks_count: int = None,
        error: str = None
    ):
        """更新任务状态"""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            updates = ["status = %s"]
            params = [status.value]
            
            if progress is not None:
                updates.append("progress = %s")
                params.append(progress)
            
            if chunks_count is not None:
                updates.append("chunks_count = %s")
                params.append(chunks_count)
            
            if error is not None:
                updates.append("error_message = %s")
                params.append(error)
            
            if status == TaskStatus.COMPLETED:
                updates.append("completed_at = NOW()")
            
            sql = f"UPDATE ingest_tasks SET {', '.join(updates)} WHERE id = %s"
            params.append(task_id)
            
            cursor.execute(sql, params)
            conn.commit()
        except Exception as e:
            logger.error(f"更新任务状态失败: {e}")
        finally:
            cursor.close()
            conn.close()


# 全局任务队列
task_queue = TaskQueue()


# ============== FastAPI 应用 ==============

app = FastAPI(
    title="Echo Ingest API",
    description="文件处理和摄入 API - 支持视频和 PPT 文件",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """应用启动时初始化"""
    init_ingest_tables()
    task_queue.start()


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时清理"""
    task_queue.stop()


# ============== 健康检查 ==============

@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "service": "ingest-api",
        "timestamp": datetime.now().isoformat()
    }


# ============== 文件上传 ==============

@app.post("/upload", response_model=IngestResponse)
async def upload_file(
    file: UploadFile = File(...),
    generate_embedding: bool = Form(True),
    whisper_model: str = Form(WHISPER_MODEL)
):
    """
    上传文件并开始处理
    
    支持的文件类型:
    - 视频: .mp4, .mkv, .avi, .mov, .webm
    - PPT: .pptx
    """
    # 检查文件类型
    filename = file.filename.lower()
    if filename.endswith(('.mp4', '.mkv', '.avi', '.mov', '.webm')):
        file_type = "video"
    elif filename.endswith('.pptx'):
        file_type = "ppt"
    else:
        raise HTTPException(
            status_code=400, 
            detail=f"不支持的文件类型: {Path(filename).suffix}"
        )
    
    # 保存文件
    task_id = str(uuid.uuid4())
    file_ext = Path(filename).suffix
    save_path = IMPORT_FOLDER / f"{task_id}{file_ext}"
    
    try:
        content = await file.read()
        with open(save_path, 'wb') as f:
            f.write(content)
        logger.info(f"文件已保存: {save_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件保存失败: {e}")
    
    # 创建任务记录
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO ingest_tasks (id, file_path, file_type, status)
            VALUES (%s, %s, %s, 'pending')
        """, (task_id, str(save_path), file_type))
        conn.commit()
    except Exception as e:
        # 删除已保存的文件
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"创建任务失败: {e}")
    finally:
        cursor.close()
        conn.close()
    
    # 加入处理队列
    task_queue.add_task(
        task_id=task_id,
        file_path=str(save_path),
        file_type=file_type,
        options={
            "generate_embedding": generate_embedding,
            "whisper_model": whisper_model
        }
    )
    
    return IngestResponse(
        task_id=task_id,
        status=TaskStatus.PENDING,
        message="文件已上传，正在排队处理"
    )


@app.post("/process", response_model=IngestResponse)
async def process_file(request: IngestRequest):
    """
    处理已存在的文件
    
    用于处理 import_folder 中的文件或指定路径的文件
    """
    file_path = Path(request.file_path)
    
    # 验证文件存在
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"文件不存在: {request.file_path}")
    
    # 验证文件类型
    if request.file_type not in ["video", "ppt"]:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {request.file_type}")
    
    # 创建任务
    task_id = str(uuid.uuid4())
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO ingest_tasks (id, file_path, file_type, status)
            VALUES (%s, %s, %s, 'pending')
        """, (task_id, str(file_path), request.file_type))
        conn.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建任务失败: {e}")
    finally:
        cursor.close()
        conn.close()
    
    # 加入处理队列
    task_queue.add_task(
        task_id=task_id,
        file_path=str(file_path),
        file_type=request.file_type,
        options=request.options or {}
    )
    
    return IngestResponse(
        task_id=task_id,
        status=TaskStatus.PENDING,
        message="任务已创建，正在排队处理"
    )


# ============== 任务状态查询 ==============

@app.get("/tasks/{task_id}", response_model=IngestTask)
async def get_task_status(task_id: str):
    """获取任务状态"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("SELECT * FROM ingest_tasks WHERE id = %s", (task_id,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        return IngestTask(
            task_id=row['id'],
            file_path=row['file_path'],
            file_type=row['file_type'],
            status=TaskStatus(row['status']),
            progress=row['progress'] or 0,
            chunks_count=row['chunks_count'] or 0,
            error=row['error_message'],
            created_at=row['created_at'].isoformat() if row['created_at'] else "",
            updated_at=row['updated_at'].isoformat() if row['updated_at'] else "",
            completed_at=row['completed_at'].isoformat() if row['completed_at'] else None
        )
    finally:
        cursor.close()
        conn.close()


@app.get("/tasks", response_model=TaskListResponse)
async def list_tasks(
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    """获取任务列表"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 构建查询
        where_clause = ""
        params = []
        
        if status:
            where_clause = "WHERE status = %s"
            params.append(status)
        
        # 获取总数
        count_sql = f"SELECT COUNT(*) as total FROM ingest_tasks {where_clause}"
        cursor.execute(count_sql, params)
        total = cursor.fetchone()['total']
        
        # 获取列表
        sql = f"""
            SELECT * FROM ingest_tasks 
            {where_clause}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """
        cursor.execute(sql, params + [limit, offset])
        rows = cursor.fetchall()
        
        tasks = [
            IngestTask(
                task_id=row['id'],
                file_path=row['file_path'],
                file_type=row['file_type'],
                status=TaskStatus(row['status']),
                progress=row['progress'] or 0,
                chunks_count=row['chunks_count'] or 0,
                error=row['error_message'],
                created_at=row['created_at'].isoformat() if row['created_at'] else "",
                updated_at=row['updated_at'].isoformat() if row['updated_at'] else "",
                completed_at=row['completed_at'].isoformat() if row['completed_at'] else None
            )
            for row in rows
        ]
        
        return TaskListResponse(tasks=tasks, total=total)
    finally:
        cursor.close()
        conn.close()


@app.post("/tasks/{task_id}/retry", response_model=IngestResponse)
async def retry_task(task_id: str):
    """重试失败的任务"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("SELECT * FROM ingest_tasks WHERE id = %s", (task_id,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        if row['status'] != 'failed':
            raise HTTPException(status_code=400, detail="只能重试失败的任务")
        
        # 重置状态
        cursor.execute("""
            UPDATE ingest_tasks 
            SET status = 'pending', progress = 0, error_message = NULL
            WHERE id = %s
        """, (task_id,))
        conn.commit()
        
        # 重新加入队列
        task_queue.add_task(
            task_id=task_id,
            file_path=row['file_path'],
            file_type=row['file_type']
        )
        
        return IngestResponse(
            task_id=task_id,
            status=TaskStatus.PENDING,
            message="任务已重新加入队列"
        )
    finally:
        cursor.close()
        conn.close()


@app.delete("/tasks/{task_id}")
async def cancel_task(task_id: str):
    """取消/删除任务"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("SELECT * FROM ingest_tasks WHERE id = %s", (task_id,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        # 只能取消 pending 状态的任务
        if row['status'] == 'processing':
            raise HTTPException(status_code=400, detail="无法取消正在处理的任务")
        
        # 删除任务记录
        cursor.execute("DELETE FROM ingest_tasks WHERE id = %s", (task_id,))
        conn.commit()
        
        return {"success": True, "message": "任务已删除"}
    finally:
        cursor.close()
        conn.close()


# ============== 队列状态 ==============

@app.get("/queue/status")
async def queue_status():
    """获取队列状态"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 统计各状态任务数
        cursor.execute("""
            SELECT status, COUNT(*) as count 
            FROM ingest_tasks 
            GROUP BY status
        """)
        rows = cursor.fetchall()
        
        status_counts = {row['status']: row['count'] for row in rows}
        
        return {
            "pending": status_counts.get('pending', 0),
            "processing": status_counts.get('processing', 0),
            "completed": status_counts.get('completed', 0),
            "failed": status_counts.get('failed', 0),
            "queue_running": task_queue._running
        }
    finally:
        cursor.close()
        conn.close()


# ============== 启动入口 ==============

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv('INGEST_API_PORT', '8766'))
    logger.info(f"启动 Ingest API on port {port}")
    
    uvicorn.run(
        "ingest_api:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info"
    )
