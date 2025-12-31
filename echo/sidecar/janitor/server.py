"""
Echo Janitor Server
基于 LlamaFS，添加 Echo 分类体系和 Undo 功能
支持整理后自动索引到 SeekDB
"""

import json
import os
import pathlib
import queue
from collections import defaultdict
from pathlib import Path
from typing import Optional, List
import time
import shutil
import httpx
import asyncio

import agentops
import colorama
import ollama
import threading
from asciitree import LeftAligned
from asciitree.drawing import BOX_LIGHT, BoxStyle
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from llama_index.core import SimpleDirectoryReader
from pydantic import BaseModel
from termcolor import colored
from watchdog.observers import Observer

from src.loader import get_dir_summaries
from src.tree_generator import create_file_tree
from src.watch_utils import Handler
from src.watch_utils import create_file_tree as create_watch_file_tree
from src.undo_logger import get_undo_logger, UndoRecord
from src.config_manager import (
    get_config_manager, 
    validate_path, 
    validate_paths,
    JanitorConfig,
    CategoryConfig,
    ConfigManager
)

from dotenv import load_dotenv
load_dotenv()

# SeekDB 配置
SEEKDB_API_URL = os.getenv('SEEKDB_API_URL', 'http://localhost:8765')
SEEKDB_AUTO_INDEX = os.getenv('SEEKDB_AUTO_INDEX', 'true').lower() == 'true'

agentops.init(tags=["llama-fs"],
              auto_start_session=False)


class Request(BaseModel):
    path: Optional[str] = None
    instruction: Optional[str] = None
    incognito: Optional[bool] = False


class CommitRequest(BaseModel):
    base_path: str
    src_path: str  # Relative to base_path
    dst_path: str  # Relative to base_path
    category: Optional[str] = ""
    confidence: Optional[float] = 1.0
    reason: Optional[str] = ""
    auto_index: Optional[bool] = True  # 是否自动索引到 SeekDB


class UndoRequest(BaseModel):
    count: Optional[int] = 1
    since: Optional[str] = None  # ISO timestamp


# ============== 配置管理请求模型 ==============

class PathValidateRequest(BaseModel):
    """路径验证请求"""
    path: str


class PathsValidateRequest(BaseModel):
    """批量路径验证请求"""
    paths: List[str]


class CategoryCreateRequest(BaseModel):
    """创建分类请求"""
    id: str  # 分类 ID，如 "01_Investment"
    name: Optional[str] = None  # 显示名称，默认使用 id
    path: str  # 输出路径
    keywords: Optional[List[str]] = []
    color: Optional[str] = "#808080"


class CategoryUpdateRequest(BaseModel):
    """更新分类请求"""
    name: Optional[str] = None
    path: Optional[str] = None
    keywords: Optional[List[str]] = None
    color: Optional[str] = None


class ConfigUpdateRequest(BaseModel):
    """配置更新请求"""
    inbox_dirs: Optional[List[str]] = None
    output_base: Optional[str] = None
    confidence_threshold: Optional[float] = None
    groq_model: Optional[str] = None
    ollama_host: Optional[str] = None
    ollama_model: Optional[str] = None
    seekdb_auto_index: Optional[bool] = None


app = FastAPI()

origins = [
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Or restrict to ['POST', 'GET', etc.]
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Hello World"}


async def index_to_seekdb(file_path: str, category: str = "", title: str = ""):
    """
    将文件索引到 SeekDB
    
    Args:
        file_path: 文件的完整路径
        category: 文件分类
        title: 文件标题（可选，默认使用文件名）
    """
    if not SEEKDB_AUTO_INDEX:
        return {"success": False, "reason": "auto_index_disabled"}
    
    try:
        file_path = Path(file_path)
        if not file_path.exists():
            return {"success": False, "reason": "file_not_found"}
        
        # 准备上传数据
        file_title = title or file_path.stem
        
        # 使用 httpx 异步上传文件到 SeekDB
        async with httpx.AsyncClient(timeout=60.0) as client:
            with open(file_path, 'rb') as f:
                files = {'document': (file_path.name, f, 'application/octet-stream')}
                data = {'title': file_title}
                
                # 如果有分类，尝试创建或获取对应的标签
                if category:
                    # 先获取现有标签
                    tags_response = await client.get(f"{SEEKDB_API_URL}/api/tags/")
                    if tags_response.status_code == 200:
                        tags_data = tags_response.json()
                        existing_tags = {t['name']: t['id'] for t in tags_data.get('results', [])}
                        
                        if category in existing_tags:
                            data['tags'] = str(existing_tags[category])
                        else:
                            # 创建新标签
                            create_tag_response = await client.post(
                                f"{SEEKDB_API_URL}/api/tags/",
                                json={"name": category, "color": "#ffc107"}
                            )
                            if create_tag_response.status_code == 200:
                                new_tag = create_tag_response.json()
                                data['tags'] = str(new_tag['id'])
                
                # 上传文档
                response = await client.post(
                    f"{SEEKDB_API_URL}/api/documents/post_document/",
                    files=files,
                    data=data
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"[SeekDB] 文件已索引: {file_path.name} -> task_id: {result.get('task_id')}")
                    return {"success": True, "task_id": result.get('task_id')}
                else:
                    print(f"[SeekDB] 索引失败: {response.status_code} - {response.text}")
                    return {"success": False, "reason": f"http_{response.status_code}"}
                    
    except Exception as e:
        print(f"[SeekDB] 索引异常: {e}")
        return {"success": False, "reason": str(e)}


@app.post("/batch")
async def batch(request: Request):
    session = agentops.start_session(tags=["LlamaFS"])
    path = request.path
    if not os.path.exists(path):
        raise HTTPException(
            status_code=400, detail="Path does not exist in filesystem")

    summaries = await get_dir_summaries(path)
    # Get file tree
    files = create_file_tree(summaries, session)

    # Recursively create dictionary from file paths
    tree = {}
    for file in files:
        parts = Path(file["dst_path"]).parts
        current = tree
        for part in parts:
            current = current.setdefault(part, {})

    tree = {path: tree}

    tr = LeftAligned(draw=BoxStyle(gfx=BOX_LIGHT, horiz_len=1))
    print(tr(tree))

    # Prepend base path to dst_path
    for file in files:
        # file["dst_path"] = os.path.join(path, file["dst_path"])
        file["summary"] = summaries[files.index(file)]["summary"]

    agentops.end_session(
        "Success", end_state_reason="Reorganized directory structure")
    return files


@app.post("/watch")
async def watch(request: Request):
    path = request.path
    if not os.path.exists(path):
        raise HTTPException(
            status_code=400, detail="Path does not exist in filesystem")

    response_queue = queue.Queue()

    observer = Observer()
    event_handler = Handler(path, create_watch_file_tree, response_queue)
    await event_handler.set_summaries()
    observer.schedule(event_handler, path, recursive=True)
    observer.start()

    # background_tasks.add_task(observer.start)

    def stream():
        while True:
            response = response_queue.get()
            yield json.dumps(response) + "\n"
            # yield json.dumps({"status": "watching"}) + "\n"
            # time.sleep(5)

    return StreamingResponse(stream())


@app.post("/commit")
async def commit(request: CommitRequest):
    """
    提交文件移动操作，并记录到 undo 日志
    成功后自动索引到 SeekDB（如果启用）
    """
    print('*'*80)
    print(request)
    print(request.base_path)
    print(request.src_path)
    print(request.dst_path)
    print('*'*80)

    src = os.path.join(request.base_path, request.src_path)
    dst = os.path.join(request.base_path, request.dst_path)

    if not os.path.exists(src):
        raise HTTPException(
            status_code=400, detail="Source path does not exist in filesystem"
        )

    # Ensure the destination directory exists
    dst_directory = os.path.dirname(dst)
    os.makedirs(dst_directory, exist_ok=True)

    # 获取 undo logger
    undo_logger = get_undo_logger()
    
    seekdb_result = None
    
    try:
        # 确定最终目标路径
        final_dst = dst
        if os.path.isfile(src) and os.path.isdir(dst):
            final_dst = os.path.join(dst, os.path.basename(src))
        
        # 移动文件
        if os.path.isfile(src) and os.path.isdir(dst):
            shutil.move(src, os.path.join(dst, os.path.basename(src)))
        else:
            shutil.move(src, dst)
        
        # 记录到 undo 日志
        undo_logger.log_move(
            src_path=src,
            dst_path=final_dst,
            category=request.category or "",
            confidence=request.confidence or 1.0,
            reason=request.reason or "",
            status="success"
        )
        
        # 自动索引到 SeekDB
        if request.auto_index and SEEKDB_AUTO_INDEX and os.path.isfile(final_dst):
            seekdb_result = await index_to_seekdb(
                file_path=final_dst,
                category=request.category or "",
                title=Path(final_dst).stem
            )
        
    except Exception as e:
        # 记录失败操作
        undo_logger.log_move(
            src_path=src,
            dst_path=dst,
            category=request.category or "",
            confidence=request.confidence or 1.0,
            reason=str(e),
            status="failed"
        )
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while moving the resource: {e}"
        )

    response = {"message": "Commit successful"}
    if seekdb_result:
        response["seekdb"] = seekdb_result
    
    return response


@app.get("/health")
async def health():
    """健康检查端点"""
    return {
        "status": "healthy",
        "service": "echo-janitor",
        "version": "1.0.0"
    }


@app.get("/history")
async def history(limit: int = Query(default=100, ge=1, le=1000)):
    """
    获取操作历史
    
    Args:
        limit: 返回记录数量限制，默认 100
    """
    undo_logger = get_undo_logger()
    records = undo_logger.get_history(limit=limit)
    
    return {
        "count": len(records),
        "records": [
            {
                "timestamp": r.timestamp,
                "src_path": r.src_path,
                "dst_path": r.dst_path,
                "original_name": r.original_name,
                "new_name": r.new_name,
                "category": r.category,
                "confidence": r.confidence,
                "reason": r.reason
            }
            for r in records
        ]
    }


@app.post("/undo")
async def undo(request: UndoRequest):
    """
    回滚操作
    
    Args:
        request.count: 回滚最近 N 条操作
        request.since: 回滚指定时间之后的所有操作 (ISO 格式)
    """
    undo_logger = get_undo_logger()
    
    if request.since:
        results = undo_logger.undo_by_timestamp(request.since)
    else:
        results = undo_logger.undo_last(count=request.count or 1)
    
    success_count = sum(1 for r in results if r["success"])
    
    return {
        "total": len(results),
        "success": success_count,
        "failed": len(results) - success_count,
        "results": results
    }


# ============== 配置管理 API ==============

@app.get("/config")
async def get_config():
    """
    获取完整配置
    
    Returns:
        完整的 Janitor 配置，包括：
        - groq: Groq API 配置
        - ollama: Ollama 本地模型配置
        - inbox_dirs: 监控目录列表
        - output_base: 输出根目录
        - confidence_threshold: 置信度阈值
        - categories: 分类配置
        - seekdb: SeekDB 配置
    """
    try:
        config_manager = get_config_manager()
        config = config_manager.get_config()
        
        # 转换为可序列化的格式
        categories_dict = {}
        for cat_id, cat in config.categories.items():
            categories_dict[cat_id] = {
                "id": cat.id or cat_id,
                "name": cat.name or cat_id,
                "path": cat.path,
                "keywords": cat.keywords,
                "color": cat.color or "#808080"
            }
        
        return {
            "groq": {
                "model": config.groq.model
            },
            "ollama": {
                "host": config.ollama.host,
                "model": config.ollama.model
            },
            "inbox_dirs": config.inbox_dirs,
            "output_base": config.output_base,
            "confidence_threshold": config.confidence_threshold,
            "categories": categories_dict,
            "seekdb": {
                "auto_index": config.seekdb.auto_index
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"读取配置失败: {str(e)}"
        )


@app.post("/config")
async def update_config(request: ConfigUpdateRequest):
    """
    更新配置（部分更新）
    
    Args:
        request: 要更新的配置字段，只需提供需要修改的字段
        
    Returns:
        更新后的完整配置
    """
    try:
        config_manager = get_config_manager()
        
        # 构建更新字典
        updates = {}
        
        if request.inbox_dirs is not None:
            updates['inbox_dirs'] = request.inbox_dirs
        
        if request.output_base is not None:
            updates['output_base'] = request.output_base
        
        if request.confidence_threshold is not None:
            if not 0 <= request.confidence_threshold <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="confidence_threshold 必须在 0 到 1 之间"
                )
            updates['confidence_threshold'] = request.confidence_threshold
        
        if request.groq_model is not None:
            updates['groq'] = {'model': request.groq_model}
        
        if request.ollama_host is not None or request.ollama_model is not None:
            ollama_updates = {}
            if request.ollama_host is not None:
                ollama_updates['host'] = request.ollama_host
            if request.ollama_model is not None:
                ollama_updates['model'] = request.ollama_model
            updates['ollama'] = ollama_updates
        
        if request.seekdb_auto_index is not None:
            updates['seekdb'] = {'auto_index': request.seekdb_auto_index}
        
        # 应用更新
        if updates:
            config_manager.update_config(updates)
            config_manager.save()
        
        # 返回更新后的配置
        return await get_config()
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"更新配置失败: {str(e)}"
        )


@app.post("/config/validate-path")
async def validate_single_path(request: PathValidateRequest):
    """
    验证单个路径是否存在
    
    Args:
        request.path: 要验证的路径（支持 ~ 展开）
        
    Returns:
        路径验证结果，包括：
        - path: 原始路径
        - expanded_path: 展开后的绝对路径
        - exists: 是否存在
        - is_dir: 是否是目录
        - is_file: 是否是文件
        - is_writable: 是否可写
        - parent_exists: 父目录是否存在
    """
    try:
        result = validate_path(request.path)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"路径验证失败: {str(e)}"
        )


@app.post("/config/validate-paths")
async def validate_multiple_paths(request: PathsValidateRequest):
    """
    批量验证路径
    
    Args:
        request.paths: 要验证的路径列表
        
    Returns:
        路径验证结果列表
    """
    try:
        results = validate_paths(request.paths)
        return {
            "count": len(results),
            "results": results,
            "all_exist": all(r["exists"] for r in results)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"路径验证失败: {str(e)}"
        )


# ============== 分类管理 API ==============

@app.get("/config/categories")
async def list_categories():
    """
    获取所有分类
    
    Returns:
        分类列表，每个分类包含 id, name, path, keywords, color
    """
    try:
        config_manager = get_config_manager()
        categories = config_manager.get_categories()
        
        result = []
        for cat_id, cat in categories.items():
            result.append({
                "id": cat.id or cat_id,
                "name": cat.name or cat_id,
                "path": cat.path,
                "keywords": cat.keywords,
                "color": cat.color or "#808080"
            })
        
        return {
            "count": len(result),
            "categories": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取分类列表失败: {str(e)}"
        )


@app.get("/config/categories/{category_id}")
async def get_category(category_id: str):
    """
    获取单个分类
    
    Args:
        category_id: 分类 ID
        
    Returns:
        分类配置
    """
    try:
        config_manager = get_config_manager()
        category = config_manager.get_category(category_id)
        
        if category is None:
            raise HTTPException(
                status_code=404,
                detail=f"分类 '{category_id}' 不存在"
            )
        
        return {
            "id": category.id or category_id,
            "name": category.name or category_id,
            "path": category.path,
            "keywords": category.keywords,
            "color": category.color or "#808080"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取分类失败: {str(e)}"
        )


@app.post("/config/categories")
async def create_category(request: CategoryCreateRequest):
    """
    创建新分类
    
    Args:
        request: 分类配置
        - id: 分类 ID（必填）
        - name: 显示名称（可选，默认使用 id）
        - path: 输出路径（必填）
        - keywords: 关键词列表（可选）
        - color: 颜色（可选，默认 #808080）
        
    Returns:
        创建的分类配置
    """
    try:
        config_manager = get_config_manager()
        
        # 检查是否已存在
        if config_manager.get_category(request.id):
            raise HTTPException(
                status_code=409,
                detail=f"分类 '{request.id}' 已存在"
            )
        
        # 创建分类配置
        category = CategoryConfig(
            id=request.id,
            name=request.name or request.id,
            path=request.path,
            keywords=request.keywords or [],
            color=request.color or "#808080"
        )
        
        # 添加分类
        success = config_manager.add_category(request.id, category)
        if not success:
            raise HTTPException(
                status_code=500,
                detail="添加分类失败"
            )
        
        # 保存配置
        config_manager.save()
        
        return {
            "message": "分类创建成功",
            "category": {
                "id": category.id,
                "name": category.name,
                "path": category.path,
                "keywords": category.keywords,
                "color": category.color
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"创建分类失败: {str(e)}"
        )


@app.put("/config/categories/{category_id}")
async def update_category(category_id: str, request: CategoryUpdateRequest):
    """
    更新分类（部分更新）
    
    Args:
        category_id: 分类 ID
        request: 要更新的字段
        
    Returns:
        更新后的分类配置
    """
    try:
        config_manager = get_config_manager()
        
        # 检查是否存在
        if not config_manager.get_category(category_id):
            raise HTTPException(
                status_code=404,
                detail=f"分类 '{category_id}' 不存在"
            )
        
        # 构建更新字典
        updates = {}
        if request.name is not None:
            updates['name'] = request.name
        if request.path is not None:
            updates['path'] = request.path
        if request.keywords is not None:
            updates['keywords'] = request.keywords
        if request.color is not None:
            updates['color'] = request.color
        
        # 更新分类
        updated = config_manager.update_category(category_id, updates)
        if updated is None:
            raise HTTPException(
                status_code=500,
                detail="更新分类失败"
            )
        
        # 保存配置
        config_manager.save()
        
        return {
            "message": "分类更新成功",
            "category": {
                "id": updated.id or category_id,
                "name": updated.name,
                "path": updated.path,
                "keywords": updated.keywords,
                "color": updated.color
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"更新分类失败: {str(e)}"
        )


@app.delete("/config/categories/{category_id}")
async def delete_category(category_id: str):
    """
    删除分类
    
    Args:
        category_id: 分类 ID
        
    Returns:
        删除结果
    """
    try:
        config_manager = get_config_manager()
        
        # 检查是否存在
        if not config_manager.get_category(category_id):
            raise HTTPException(
                status_code=404,
                detail=f"分类 '{category_id}' 不存在"
            )
        
        # 删除分类
        success = config_manager.delete_category(category_id)
        if not success:
            raise HTTPException(
                status_code=500,
                detail="删除分类失败"
            )
        
        # 保存配置
        config_manager.save()
        
        return {
            "message": f"分类 '{category_id}' 已删除",
            "success": True
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"删除分类失败: {str(e)}"
        )
