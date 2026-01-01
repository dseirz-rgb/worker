#!/usr/bin/env python3
"""
Ingest API 服务

提供文件上传和处理状态查询的 REST API。
支持视频和 PPT 文件的异步处理。

注意: SeekDB 已移除，此服务现在仅处理文件并生成内容。
处理结果通过 Blinko 原生 embedding 功能进行向量化。

启动方式: uvicorn ingest_api:app --host 0.0.0.0 --port 8766
"""

import os
import uuid
import json
import logging
from typing import Optional, List
from datetime import datetime
from pathlib import Path
from enum import Enum
from threading import Thread
from queue import Queue, Empty

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# 导入处理器
from video_processor import process_video
from ppt_processor import process_ppt

# ============== 日志配置 ==============

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== 配置 ==============

# 文件存储路径
_default_storage = Path(__file__).parent.parent / 'storage'
STORAGE_PATH = Path(os.getenv('STORAGE_PATH', str(_default_storage)))
IMPORT_FOLDER = Path(os.getenv('IMPORT_FOLDER', str(STORAGE_PATH / 'import')))
STORAGE_PATH.mkdir(parents=True, exist_ok=True)
IMPORT_FOLDER.mkdir(parents=True, exist_ok=True)

# Whisper 模型配置
WHISPER_MODEL = os.getenv('WHISPER_MODEL', 'base')

# 任务存储 (内存存储，重启后丢失)
_tasks_store: dict = {}

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
    # 处理结果 (用于返回给调用方)
    chunks: Optional[List[dict]] = None


class IngestResponse(BaseModel):
    """处理响应"""
    task_id: str
    status: TaskStatus
    message: str


class TaskListResponse(BaseModel):
    """任务列表响应"""
    tasks: List[IngestTask]
    total: int


# ============== 任务队列管理 ==============

class TaskQueue:
    """任务队列管理器"""
    
    def __init__(self):
        self._queue: Queue = Queue()
        self._worker_thread: Optional[Thread] = None
        self._running = False
    
    def start(self):
        """启动工作线程"""
        if self._running:
            return
        
        self._running = True
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
            
            # 更新状态为完成，保存处理结果
            self._update_task_status(
                task_id, 
                TaskStatus.COMPLETED, 
                progress=100,
                chunks_count=len(chunks),
                chunks=chunks
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
        self._update_task_status(task_id, TaskStatus.PROCESSING, progress=80)
        
        # 转换为字典格式
        result = []
        for i, chunk in enumerate(chunks):
            chunk_dict = {
                "content": chunk.text,
                "metadata": {
                    "start_time": chunk.start_time,
                    "end_time": chunk.end_time,
                    "chunk_index": i,
                    "source_file": file_path,
                    "source_type": "video"
                }
            }
            result.append(chunk_dict)
        
        return result
    
    def _process_ppt(self, task_id: str, file_path: str, options: dict) -> List[dict]:
        """处理 PPT 文件"""
        # 更新进度: 开始解析
        self._update_task_status(task_id, TaskStatus.PROCESSING, progress=10)
        
        slides = process_ppt(file_path)
        
        # 更新进度: 解析完成
        self._update_task_status(task_id, TaskStatus.PROCESSING, progress=80)
        
        # 转换为字典格式
        result = []
        for i, slide in enumerate(slides):
            slide_dict = {
                "content": slide.text,
                "metadata": {
                    "page_number": slide.page_number,
                    "title": slide.title,
                    "chunk_index": i,
                    "source_file": file_path,
                    "source_type": "ppt"
                }
            }
            result.append(slide_dict)
        
        return result
    
    def _update_task_status(
        self, 
        task_id: str, 
        status: TaskStatus, 
        progress: int = None,
        chunks_count: int = None,
        error: str = None,
        chunks: List[dict] = None
    ):
        """更新任务状态 (内存存储)"""
        if task_id not in _tasks_store:
            return
        
        task = _tasks_store[task_id]
        task["status"] = status.value
        task["updated_at"] = datetime.now().isoformat()
        
        if progress is not None:
            task["progress"] = progress
        
        if chunks_count is not None:
            task["chunks_count"] = chunks_count
        
        if error is not None:
            task["error"] = error
        
        if chunks is not None:
            task["chunks"] = chunks
        
        if status == TaskStatus.COMPLETED:
            task["completed_at"] = datetime.now().isoformat()


# 全局任务队列
task_queue = TaskQueue()


# ============== FastAPI 应用 ==============

app = FastAPI(
    title="Echo Ingest API",
    description="文件处理和摄入 API - 支持视频和 PPT 文件 (SeekDB 已移除)",
    version="2.0.0"
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
    task_queue.start()
    logger.info("Ingest API 已启动 (SeekDB 已移除，使用内存存储)")


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
        "version": "2.0.0",
        "note": "SeekDB removed, using in-memory storage",
        "timestamp": datetime.now().isoformat()
    }


# ============== 文件上传 ==============

@app.post("/upload", response_model=IngestResponse)
async def upload_file(
    file: UploadFile = File(...),
    whisper_model: str = Form(WHISPER_MODEL)
):
    """
    上传文件并开始处理
    
    支持的文件类型:
    - 视频: .mp4, .mkv, .avi, .mov, .webm
    - PPT: .pptx
    
    处理结果保存在内存中，可通过 /tasks/{task_id} 获取
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
    
    # 创建任务记录 (内存存储)
    now = datetime.now().isoformat()
    _tasks_store[task_id] = {
        "task_id": task_id,
        "file_path": str(save_path),
        "file_type": file_type,
        "status": "pending",
        "progress": 0,
        "chunks_count": 0,
        "error": None,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
        "chunks": None
    }
    
    # 加入处理队列
    task_queue.add_task(
        task_id=task_id,
        file_path=str(save_path),
        file_type=file_type,
        options={
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
    now = datetime.now().isoformat()
    
    _tasks_store[task_id] = {
        "task_id": task_id,
        "file_path": str(file_path),
        "file_type": request.file_type,
        "status": "pending",
        "progress": 0,
        "chunks_count": 0,
        "error": None,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
        "chunks": None
    }
    
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
    """获取任务状态和处理结果"""
    if task_id not in _tasks_store:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = _tasks_store[task_id]
    return IngestTask(
        task_id=task['task_id'],
        file_path=task['file_path'],
        file_type=task['file_type'],
        status=TaskStatus(task['status']),
        progress=task['progress'] or 0,
        chunks_count=task['chunks_count'] or 0,
        error=task['error'],
        created_at=task['created_at'],
        updated_at=task['updated_at'],
        completed_at=task['completed_at'],
        chunks=task.get('chunks')
    )


@app.get("/tasks", response_model=TaskListResponse)
async def list_tasks(
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    """获取任务列表"""
    # 过滤任务
    tasks = list(_tasks_store.values())
    if status:
        tasks = [t for t in tasks if t['status'] == status]
    
    # 排序 (按创建时间倒序)
    tasks.sort(key=lambda x: x['created_at'], reverse=True)
    
    # 分页
    total = len(tasks)
    tasks = tasks[offset:offset + limit]
    
    return TaskListResponse(
        tasks=[
            IngestTask(
                task_id=t['task_id'],
                file_path=t['file_path'],
                file_type=t['file_type'],
                status=TaskStatus(t['status']),
                progress=t['progress'] or 0,
                chunks_count=t['chunks_count'] or 0,
                error=t['error'],
                created_at=t['created_at'],
                updated_at=t['updated_at'],
                completed_at=t['completed_at']
            )
            for t in tasks
        ],
        total=total
    )


@app.post("/tasks/{task_id}/retry", response_model=IngestResponse)
async def retry_task(task_id: str):
    """重试失败的任务"""
    if task_id not in _tasks_store:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = _tasks_store[task_id]
    
    if task['status'] != 'failed':
        raise HTTPException(status_code=400, detail="只能重试失败的任务")
    
    # 重置状态
    task['status'] = 'pending'
    task['progress'] = 0
    task['error'] = None
    task['updated_at'] = datetime.now().isoformat()
    
    # 重新加入队列
    task_queue.add_task(
        task_id=task_id,
        file_path=task['file_path'],
        file_type=task['file_type']
    )
    
    return IngestResponse(
        task_id=task_id,
        status=TaskStatus.PENDING,
        message="任务已重新加入队列"
    )


@app.delete("/tasks/{task_id}")
async def cancel_task(task_id: str):
    """取消/删除任务"""
    if task_id not in _tasks_store:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = _tasks_store[task_id]
    
    # 只能取消 pending 状态的任务
    if task['status'] == 'processing':
        raise HTTPException(status_code=400, detail="无法取消正在处理的任务")
    
    # 删除任务记录
    del _tasks_store[task_id]
    
    return {"success": True, "message": "任务已删除"}


# ============== 队列状态 ==============

@app.get("/queue/status")
async def queue_status():
    """获取队列状态"""
    tasks = list(_tasks_store.values())
    
    status_counts = {}
    for t in tasks:
        s = t['status']
        status_counts[s] = status_counts.get(s, 0) + 1
    
    return {
        "pending": status_counts.get('pending', 0),
        "processing": status_counts.get('processing', 0),
        "completed": status_counts.get('completed', 0),
        "failed": status_counts.get('failed', 0),
        "queue_running": task_queue._running
    }


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
