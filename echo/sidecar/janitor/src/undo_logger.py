"""
Echo Janitor - Undo 日志模块
记录所有文件移动操作，支持回滚
"""

import csv
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass, asdict


@dataclass
class UndoRecord:
    """Undo 日志记录"""
    timestamp: str
    src_path: str  # 原始路径
    dst_path: str  # 目标路径
    original_name: str  # 原始文件名
    new_name: str  # 新文件名
    category: str  # 分类
    confidence: float  # 置信度
    reason: str  # AI 决策原因
    status: str  # success / failed / undone


class UndoLogger:
    """Undo 日志管理器"""
    
    CSV_HEADERS = [
        "timestamp", "src_path", "dst_path", "original_name", 
        "new_name", "category", "confidence", "reason", "status"
    ]
    
    def __init__(self, log_path: Optional[str] = None):
        """
        初始化 Undo 日志管理器
        
        Args:
            log_path: 日志文件路径，默认为 data/janitor_history.csv
        """
        if log_path is None:
            log_path = os.environ.get(
                "UNDO_LOG_PATH",
                "data/janitor_history.csv"
            )
        
        self.log_path = Path(log_path)
        self._ensure_log_file()
    
    def _ensure_log_file(self):
        """确保日志文件存在"""
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        
        if not self.log_path.exists():
            with open(self.log_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(self.CSV_HEADERS)
    
    def log_move(
        self,
        src_path: str,
        dst_path: str,
        category: str = "",
        confidence: float = 1.0,
        reason: str = "",
        status: str = "success"
    ) -> UndoRecord:
        """
        记录文件移动操作
        
        Args:
            src_path: 原始完整路径
            dst_path: 目标完整路径
            category: 分类名称
            confidence: AI 置信度
            reason: AI 决策原因
            status: 操作状态
        
        Returns:
            UndoRecord 记录对象
        """
        record = UndoRecord(
            timestamp=datetime.now().isoformat(),
            src_path=src_path,
            dst_path=dst_path,
            original_name=Path(src_path).name,
            new_name=Path(dst_path).name,
            category=category,
            confidence=confidence,
            reason=reason,
            status=status
        )
        
        with open(self.log_path, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                record.timestamp,
                record.src_path,
                record.dst_path,
                record.original_name,
                record.new_name,
                record.category,
                record.confidence,
                record.reason,
                record.status
            ])
        
        return record
    
    def get_history(self, limit: int = 100) -> List[UndoRecord]:
        """
        获取操作历史
        
        Args:
            limit: 返回记录数量限制
        
        Returns:
            UndoRecord 列表，按时间倒序
        """
        records = []
        
        if not self.log_path.exists():
            return records
        
        with open(self.log_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                records.append(UndoRecord(
                    timestamp=row["timestamp"],
                    src_path=row["src_path"],
                    dst_path=row["dst_path"],
                    original_name=row["original_name"],
                    new_name=row["new_name"],
                    category=row["category"],
                    confidence=float(row.get("confidence", 1.0)),
                    reason=row.get("reason", ""),
                    status=row.get("status", "success")
                ))
        
        # 按时间倒序，只返回成功的记录
        records = [r for r in records if r.status == "success"]
        records.reverse()
        return records[:limit]
    
    def undo_last(self, count: int = 1) -> List[dict]:
        """
        回滚最近的操作
        
        Args:
            count: 回滚操作数量
        
        Returns:
            回滚结果列表
        """
        history = self.get_history(limit=count)
        results = []
        
        for record in history:
            result = self._undo_record(record)
            results.append(result)
        
        return results
    
    def undo_by_timestamp(self, since: str) -> List[dict]:
        """
        回滚指定时间之后的所有操作
        
        Args:
            since: ISO 格式时间戳
        
        Returns:
            回滚结果列表
        """
        history = self.get_history(limit=1000)
        results = []
        
        for record in history:
            if record.timestamp >= since:
                result = self._undo_record(record)
                results.append(result)
        
        return results
    
    def _undo_record(self, record: UndoRecord) -> dict:
        """
        执行单条记录的回滚
        
        Args:
            record: UndoRecord 记录
        
        Returns:
            回滚结果字典
        """
        result = {
            "timestamp": record.timestamp,
            "src_path": record.src_path,
            "dst_path": record.dst_path,
            "success": False,
            "message": ""
        }
        
        # 检查目标文件是否存在
        if not os.path.exists(record.dst_path):
            result["message"] = f"File not found at destination: {record.dst_path}"
            return result
        
        # 检查原始位置是否已有文件
        if os.path.exists(record.src_path):
            result["message"] = f"File already exists at source: {record.src_path}"
            return result
        
        try:
            # 确保原始目录存在
            src_dir = os.path.dirname(record.src_path)
            os.makedirs(src_dir, exist_ok=True)
            
            # 移动文件回原位置
            shutil.move(record.dst_path, record.src_path)
            
            # 记录回滚操作
            self.log_move(
                src_path=record.dst_path,
                dst_path=record.src_path,
                category="UNDO",
                confidence=1.0,
                reason=f"Undo operation from {record.timestamp}",
                status="undone"
            )
            
            result["success"] = True
            result["message"] = "Undo successful"
            
        except Exception as e:
            result["message"] = f"Undo failed: {str(e)}"
        
        return result


# 全局单例
_undo_logger: Optional[UndoLogger] = None


def get_undo_logger() -> UndoLogger:
    """获取全局 UndoLogger 实例"""
    global _undo_logger
    if _undo_logger is None:
        _undo_logger = UndoLogger()
    return _undo_logger
