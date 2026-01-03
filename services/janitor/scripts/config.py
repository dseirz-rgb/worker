#!/usr/bin/env python3
"""
环境变量配置和验证模块

启动时验证必要的环境变量，缺少时快速失败
"""

import os
import sys
import logging
from dataclasses import dataclass
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============== 必要环境变量 ==============

REQUIRED_ENV_VARS = [
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'SEEKDB_HOST',
]

OPTIONAL_ENV_VARS = {
    'SEEKDB_PORT': '2881',
    'SEEKDB_USER': 'root',
    'SEEKDB_PASSWORD': '',
    'SEEKDB_DATABASE': 'echo',
    'API_PORT': '8765',
    'IMPORT_FOLDER': './import_folder',
    'WHISPER_MODEL': 'base',
}


# ============== 配置数据类 ==============

@dataclass
class SeekDBConfig:
    """SeekDB 数据库配置"""
    host: str
    port: int
    user: str
    password: str
    database: str


@dataclass
class SupabaseConfig:
    """Supabase 配置"""
    url: str
    key: str


@dataclass
class AppConfig:
    """应用配置"""
    seekdb: SeekDBConfig
    supabase: SupabaseConfig
    api_port: int
    import_folder: str
    whisper_model: str


# ============== 验证函数 ==============

def validate_env() -> list[str]:
    """
    验证必要的环境变量
    
    Returns:
        缺少的环境变量列表
    """
    missing = []
    for var in REQUIRED_ENV_VARS:
        if not os.getenv(var):
            missing.append(var)
    return missing


def validate_env_or_exit() -> None:
    """
    验证环境变量，缺少时退出程序
    """
    missing = validate_env()
    if missing:
        logger.error(f"❌ 缺少必要环境变量: {', '.join(missing)}")
        logger.error("请检查 .env 文件或环境变量设置")
        logger.error("参考 .env.example 文件")
        sys.exit(1)
    logger.info("✅ 环境变量验证通过")


def get_env(key: str, default: Optional[str] = None) -> str:
    """
    获取环境变量，支持默认值
    
    Args:
        key: 环境变量名
        default: 默认值
        
    Returns:
        环境变量值
    """
    value = os.getenv(key)
    if value is not None:
        return value
    if default is not None:
        return default
    if key in OPTIONAL_ENV_VARS:
        return OPTIONAL_ENV_VARS[key]
    raise ValueError(f"环境变量 {key} 未设置且无默认值")


# ============== 配置加载 ==============

def load_config() -> AppConfig:
    """
    加载应用配置
    
    Returns:
        AppConfig 实例
        
    Raises:
        SystemExit: 缺少必要环境变量时退出
    """
    # 先验证必要变量
    validate_env_or_exit()
    
    # 加载 SeekDB 配置
    seekdb = SeekDBConfig(
        host=get_env('SEEKDB_HOST'),
        port=int(get_env('SEEKDB_PORT', '2881')),
        user=get_env('SEEKDB_USER', 'root'),
        password=get_env('SEEKDB_PASSWORD', ''),
        database=get_env('SEEKDB_DATABASE', 'echo'),
    )
    
    # 加载 Supabase 配置
    supabase = SupabaseConfig(
        url=get_env('SUPABASE_URL'),
        key=get_env('SUPABASE_KEY'),
    )
    
    # 加载应用配置
    config = AppConfig(
        seekdb=seekdb,
        supabase=supabase,
        api_port=int(get_env('API_PORT', '8765')),
        import_folder=get_env('IMPORT_FOLDER', './import_folder'),
        whisper_model=get_env('WHISPER_MODEL', 'base'),
    )
    
    logger.info(f"配置加载完成:")
    logger.info(f"  - SeekDB: {seekdb.host}:{seekdb.port}/{seekdb.database}")
    logger.info(f"  - Supabase: {supabase.url[:30]}...")
    logger.info(f"  - API Port: {config.api_port}")
    logger.info(f"  - Import Folder: {config.import_folder}")
    
    return config


# ============== 单例配置 ==============

_config: Optional[AppConfig] = None


def get_config() -> AppConfig:
    """
    获取全局配置（单例模式）
    
    Returns:
        AppConfig 实例
    """
    global _config
    if _config is None:
        _config = load_config()
    return _config


# ============== 测试入口 ==============

if __name__ == "__main__":
    # 测试配置加载
    print("测试环境变量验证...")
    
    missing = validate_env()
    if missing:
        print(f"缺少环境变量: {missing}")
        print("请设置以下环境变量后重试:")
        for var in missing:
            print(f"  export {var}=<value>")
    else:
        config = load_config()
        print(f"配置加载成功: {config}")
