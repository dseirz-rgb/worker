#!/usr/bin/env python3
"""
视频处理模块

使用 faster-whisper 提取视频语音，转换为文字并分块。

使用方法:
    from video_processor import process_video
    chunks = process_video("path/to/video.mp4")

分块策略:
    - 每 30 秒一个块，或
    - 每 200 个字符一个块
    - 以先到者为准
"""

import os
from dataclasses import dataclass
from typing import List, Optional
from pathlib import Path

from loguru import logger


@dataclass
class VideoChunk:
    """视频分块数据结构"""
    start_time: float  # 开始时间（秒）
    end_time: float    # 结束时间（秒）
    text: str          # 转录文本
    
    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "start_time": self.start_time,
            "end_time": self.end_time,
            "text": self.text
        }


# 分块配置
CHUNK_MAX_SECONDS = int(os.getenv("VIDEO_CHUNK_SECONDS", "30"))
CHUNK_MAX_CHARS = int(os.getenv("VIDEO_CHUNK_CHARS", "200"))


def process_video(
    file_path: str,
    model: str = "base",
    language: Optional[str] = None,
    progress_callback: Optional[callable] = None
) -> List[VideoChunk]:
    """
    处理视频文件，返回分块后的转录结果
    
    Args:
        file_path: 视频文件路径
        model: Whisper 模型大小 (tiny, base, small, medium, large)
        language: 语言代码 (如 'zh', 'en')，None 表示自动检测
        progress_callback: 进度回调函数，接收 (current, total, message) 参数
    
    Returns:
        分块后的转录结果列表
    
    Raises:
        FileNotFoundError: 文件不存在
        RuntimeError: 处理失败
    """
    # 验证文件存在
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"视频文件不存在: {file_path}")
    
    if not path.suffix.lower() in ['.mp4', '.mkv', '.avi', '.mov', '.webm']:
        logger.warning(f"不支持的视频格式: {path.suffix}")
    
    logger.info(f"开始处理视频: {file_path}")
    logger.info(f"使用模型: {model}")
    
    # 进度回调辅助函数
    def report_progress(current: int, total: int, message: str):
        if progress_callback:
            try:
                progress_callback(current, total, message)
            except Exception as e:
                logger.warning(f"进度回调失败: {e}")
    
    try:
        # 导入 faster-whisper
        from faster_whisper import WhisperModel
        
        report_progress(0, 100, "正在加载模型...")
        
        # 加载模型
        # compute_type: int8 适合 CPU，float16 适合 GPU
        whisper_model = WhisperModel(
            model,
            device="cpu",
            compute_type="int8"
        )
        
        report_progress(10, 100, "模型加载完成，开始转录...")
        
        # 转录视频
        logger.info("正在转录...")
        segments, info = whisper_model.transcribe(
            file_path,
            language=language,
            beam_size=5,
            vad_filter=True,  # 启用语音活动检测
            vad_parameters=dict(
                min_silence_duration_ms=500,
            )
        )
        
        logger.info(f"检测到语言: {info.language} (概率: {info.language_probability:.2f})")
        report_progress(30, 100, f"检测到语言: {info.language}")
        
        # 收集所有片段
        raw_segments = []
        segment_count = 0
        for segment in segments:
            raw_segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            })
            segment_count += 1
            # 每 10 个片段报告一次进度
            if segment_count % 10 == 0:
                report_progress(30 + min(40, segment_count), 100, f"已转录 {segment_count} 个片段...")
        
        logger.info(f"转录完成，共 {len(raw_segments)} 个原始片段")
        report_progress(70, 100, f"转录完成，共 {len(raw_segments)} 个片段")
        
        # 分块处理
        chunks = _chunk_segments(raw_segments)
        logger.info(f"分块完成，共 {len(chunks)} 个块")
        report_progress(100, 100, f"处理完成，共 {len(chunks)} 个块")
        
        return chunks
        
    except ImportError:
        logger.error("faster-whisper 未安装，请运行: pip install faster-whisper")
        raise RuntimeError("faster-whisper 未安装")
    except Exception as e:
        logger.error(f"视频处理失败: {e}")
        raise RuntimeError(f"视频处理失败: {e}")


def _chunk_segments(segments: List[dict]) -> List[VideoChunk]:
    """
    将原始转录片段合并为符合约束的块
    
    分块策略:
    - 每块最多 CHUNK_MAX_SECONDS 秒
    - 每块最多 CHUNK_MAX_CHARS 字符
    - 以先到者为准
    - 尽量在句子边界分割
    
    Args:
        segments: 原始转录片段列表
    
    Returns:
        分块后的 VideoChunk 列表
    """
    if not segments:
        return []
    
    chunks = []
    current_texts = []
    current_start = segments[0]["start"]
    current_end = segments[0]["start"]
    current_char_count = 0
    
    for seg in segments:
        seg_text = seg["text"]
        seg_start = seg["start"]
        seg_end = seg["end"]
        seg_duration = seg_end - current_start
        seg_chars = len(seg_text)
        
        # 检查是否需要开始新块
        would_exceed_time = seg_duration > CHUNK_MAX_SECONDS
        would_exceed_chars = current_char_count + seg_chars > CHUNK_MAX_CHARS
        
        if current_texts and (would_exceed_time or would_exceed_chars):
            # 保存当前块
            chunk_text = " ".join(current_texts)
            chunks.append(VideoChunk(
                start_time=current_start,
                end_time=current_end,
                text=chunk_text
            ))
            
            # 开始新块
            current_texts = [seg_text]
            current_start = seg_start
            current_end = seg_end
            current_char_count = seg_chars
        else:
            # 继续累积
            current_texts.append(seg_text)
            current_end = seg_end
            current_char_count += seg_chars
    
    # 保存最后一个块
    if current_texts:
        chunk_text = " ".join(current_texts)
        chunks.append(VideoChunk(
            start_time=current_start,
            end_time=current_end,
            text=chunk_text
        ))
    
    return chunks


def chunk_transcription(text: str, duration: float) -> List[VideoChunk]:
    """
    将纯文本按时间和字符数分块（用于测试）
    
    Args:
        text: 转录文本
        duration: 总时长（秒）
    
    Returns:
        分块后的 VideoChunk 列表
    """
    if not text:
        return []
    
    # 估算每秒字符数
    chars_per_second = len(text) / duration if duration > 0 else 10
    
    chunks = []
    current_start = 0.0
    current_text = ""
    
    words = text.split()
    
    for word in words:
        test_text = f"{current_text} {word}".strip() if current_text else word
        test_duration = len(test_text) / chars_per_second
        
        # 检查约束
        if len(test_text) > CHUNK_MAX_CHARS or test_duration > CHUNK_MAX_SECONDS:
            if current_text:
                # 保存当前块
                chunk_duration = len(current_text) / chars_per_second
                chunks.append(VideoChunk(
                    start_time=current_start,
                    end_time=current_start + chunk_duration,
                    text=current_text
                ))
                current_start += chunk_duration
            
            # 开始新块
            current_text = word
        else:
            current_text = test_text
    
    # 保存最后一个块
    if current_text:
        chunk_duration = len(current_text) / chars_per_second
        chunks.append(VideoChunk(
            start_time=current_start,
            end_time=current_start + chunk_duration,
            text=current_text
        ))
    
    return chunks


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("用法: python video_processor.py <video_file>")
        sys.exit(1)
    
    video_file = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else "base"
    
    try:
        chunks = process_video(video_file, model=model)
        
        print(f"\n处理完成，共 {len(chunks)} 个块:\n")
        for i, chunk in enumerate(chunks):
            print(f"[{i+1}] {chunk.start_time:.1f}s - {chunk.end_time:.1f}s")
            print(f"    {chunk.text[:100]}{'...' if len(chunk.text) > 100 else ''}")
            print()
            
    except Exception as e:
        print(f"错误: {e}")
        sys.exit(1)
