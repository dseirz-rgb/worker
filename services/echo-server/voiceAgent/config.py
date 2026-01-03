"""
环境变量配置验证模块

验证 LiveKit Voice Agent 所需的所有环境变量是否已正确配置。
"""

import os
from typing import List, Optional


class ConfigError(Exception):
    """配置错误异常类"""
    pass


# 必需的环境变量列表
REQUIRED_ENV_VARS = [
    ("LIVEKIT_URL", "LiveKit 服务器 WebSocket URL，例如: ws://localhost:7880"),
    ("LIVEKIT_API_KEY", "LiveKit API 密钥"),
    ("LIVEKIT_API_SECRET", "LiveKit API 密钥对应的 Secret"),
    ("GOOGLE_API_KEY", "Google API 密钥，用于 Gemini 模型"),
]


def validate_env() -> None:
    """验证所有必需的环境变量是否已设置
    
    检查每个必需的环境变量，如果有缺失则抛出详细的错误信息。
    
    Raises:
        ConfigError: 当有环境变量缺失时抛出，包含所有缺失变量的详细信息
    """
    missing_vars: List[tuple] = []
    
    for var_name, description in REQUIRED_ENV_VARS:
        value = os.getenv(var_name)
        if not value or value.strip() == "":
            missing_vars.append((var_name, description))
    
    if missing_vars:
        error_message = _build_error_message(missing_vars)
        raise ConfigError(error_message)


def _build_error_message(missing_vars: List[tuple]) -> str:
    """构建详细的错误信息
    
    Args:
        missing_vars: 缺失的环境变量列表，每项为 (变量名, 描述) 元组
        
    Returns:
        格式化的错误信息字符串
    """
    lines = [
        "",
        "=" * 60,
        "❌ 环境变量配置错误",
        "=" * 60,
        "",
        "以下必需的环境变量未设置或为空：",
        "",
    ]
    
    for var_name, description in missing_vars:
        lines.append(f"  • {var_name}")
        lines.append(f"    说明: {description}")
        lines.append("")
    
    lines.extend([
        "请按以下步骤配置：",
        "",
        "1. 复制 .env.example 为 .env 文件：",
        "   cp .env.example .env",
        "",
        "2. 编辑 .env 文件，填入正确的值",
        "",
        "3. 重新启动服务",
        "",
        "=" * 60,
    ])
    
    return "\n".join(lines)


def get_config() -> dict:
    """获取所有配置值
    
    Returns:
        包含所有配置值的字典
    """
    validate_env()
    
    return {
        "livekit_url": os.getenv("LIVEKIT_URL"),
        "livekit_api_key": os.getenv("LIVEKIT_API_KEY"),
        "livekit_api_secret": os.getenv("LIVEKIT_API_SECRET"),
        "google_api_key": os.getenv("GOOGLE_API_KEY"),
    }


def get_optional_config() -> dict:
    """获取可选配置值
    
    Returns:
        包含可选配置值的字典，未设置的值为 None
    """
    return {
        "log_level": os.getenv("LOG_LEVEL", "INFO"),
        "agent_name": os.getenv("AGENT_NAME", "VoiceAssistant"),
    }
