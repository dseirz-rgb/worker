"""
Echo Janitor 配置管理模块
负责配置的读取、验证、更新和持久化
"""

import os
from pathlib import Path
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
import yaml


# 默认配置文件路径
DEFAULT_CONFIG_PATH = Path(__file__).parent.parent / "config" / "echo_categories.yaml"


# ============== Pydantic 模型定义 ==============

class GroqConfig(BaseModel):
    """Groq API 配置"""
    model: str = "llama-3.1-70b-versatile"


class OllamaConfig(BaseModel):
    """Ollama 本地模型配置"""
    host: str = "http://localhost:11434"
    model: str = "moondream"


class SeekDBConfig(BaseModel):
    """SeekDB 配置"""
    auto_index: bool = True


class CategoryConfig(BaseModel):
    """单个分类配置"""
    id: Optional[str] = None  # 分类 ID，如 "01_Investment"
    name: Optional[str] = None  # 显示名称
    path: str  # 输出路径
    keywords: List[str] = Field(default_factory=list)
    color: Optional[str] = "#808080"  # 默认灰色
    
    @field_validator('keywords', mode='before')
    @classmethod
    def ensure_keywords_list(cls, v):
        """确保 keywords 是列表"""
        if v is None:
            return []
        return v


class JanitorConfig(BaseModel):
    """Janitor 完整配置"""
    groq: GroqConfig = Field(default_factory=GroqConfig)
    ollama: OllamaConfig = Field(default_factory=OllamaConfig)
    inbox_dirs: List[str] = Field(default_factory=list)
    output_base: str = "~/Echo"
    confidence_threshold: float = 0.6
    categories: Dict[str, CategoryConfig] = Field(default_factory=dict)
    seekdb: SeekDBConfig = Field(default_factory=SeekDBConfig)
    
    @field_validator('confidence_threshold')
    @classmethod
    def validate_threshold(cls, v):
        """验证置信度阈值在 0-1 之间"""
        if not 0 <= v <= 1:
            raise ValueError('confidence_threshold 必须在 0 到 1 之间')
        return v


# ============== 配置管理器 ==============

class ConfigManager:
    """
    配置管理器
    负责配置的加载、验证、更新和持久化
    """
    
    def __init__(self, config_path: Optional[Path] = None):
        """
        初始化配置管理器
        
        Args:
            config_path: 配置文件路径，默认使用 config/echo_categories.yaml
        """
        self.config_path = config_path or DEFAULT_CONFIG_PATH
        self._config: Optional[JanitorConfig] = None
        self._raw_config: Dict[str, Any] = {}
    
    def load(self) -> JanitorConfig:
        """
        加载配置文件
        
        Returns:
            JanitorConfig: 解析后的配置对象
        """
        if not self.config_path.exists():
            # 如果配置文件不存在，返回默认配置
            self._config = JanitorConfig()
            return self._config
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            self._raw_config = yaml.safe_load(f) or {}
        
        # 转换 categories 格式
        categories_raw = self._raw_config.get('categories', {})
        categories = {}
        for cat_id, cat_data in categories_raw.items():
            if isinstance(cat_data, dict):
                cat_config = CategoryConfig(
                    id=cat_id,
                    name=cat_data.get('name', cat_id),
                    path=cat_data.get('path', cat_id),
                    keywords=cat_data.get('keywords', []),
                    color=cat_data.get('color', '#808080')
                )
                categories[cat_id] = cat_config
        
        # 构建配置对象
        config_data = {
            'groq': self._raw_config.get('groq', {}),
            'ollama': self._raw_config.get('ollama', {}),
            'inbox_dirs': self._raw_config.get('inbox_dirs', []),
            'output_base': self._raw_config.get('output_base', '~/Echo'),
            'confidence_threshold': self._raw_config.get('confidence_threshold', 0.6),
            'categories': categories,
            'seekdb': self._raw_config.get('seekdb', {'auto_index': True})
        }
        
        self._config = JanitorConfig(**config_data)
        return self._config
    
    def get_config(self) -> JanitorConfig:
        """
        获取当前配置（如果未加载则先加载）
        
        Returns:
            JanitorConfig: 配置对象
        """
        if self._config is None:
            self.load()
        return self._config
    
    def save(self, config: Optional[JanitorConfig] = None) -> bool:
        """
        保存配置到文件
        
        Args:
            config: 要保存的配置，如果为 None 则保存当前配置
            
        Returns:
            bool: 是否保存成功
        """
        if config is not None:
            self._config = config
        
        if self._config is None:
            return False
        
        # 转换为 YAML 格式
        yaml_data = self._config_to_yaml_dict(self._config)
        
        # 确保目录存在
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 写入文件
        with open(self.config_path, 'w', encoding='utf-8') as f:
            # 添加文件头注释
            f.write("# Echo Janitor 分类配置\n")
            f.write("# 基于 LlamaFS，使用 Groq (云端) + Ollama (图片) 混合方案\n\n")
            yaml.dump(yaml_data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        
        return True
    
    def _config_to_yaml_dict(self, config: JanitorConfig) -> Dict[str, Any]:
        """
        将配置对象转换为 YAML 字典格式
        
        Args:
            config: 配置对象
            
        Returns:
            Dict: YAML 格式的字典
        """
        # 转换 categories
        categories_yaml = {}
        for cat_id, cat_config in config.categories.items():
            categories_yaml[cat_id] = {
                'path': cat_config.path,
                'keywords': cat_config.keywords
            }
            if cat_config.color and cat_config.color != '#808080':
                categories_yaml[cat_id]['color'] = cat_config.color
            if cat_config.name and cat_config.name != cat_id:
                categories_yaml[cat_id]['name'] = cat_config.name
        
        return {
            'groq': {
                'model': config.groq.model
            },
            'ollama': {
                'host': config.ollama.host,
                'model': config.ollama.model
            },
            'inbox_dirs': config.inbox_dirs,
            'output_base': config.output_base,
            'confidence_threshold': config.confidence_threshold,
            'categories': categories_yaml,
            'seekdb': {
                'auto_index': config.seekdb.auto_index
            }
        }
    
    def update_config(self, updates: Dict[str, Any]) -> JanitorConfig:
        """
        部分更新配置
        
        Args:
            updates: 要更新的字段
            
        Returns:
            JanitorConfig: 更新后的配置
        """
        config = self.get_config()
        config_dict = config.model_dump()
        
        # 递归合并更新
        self._deep_merge(config_dict, updates)
        
        # 重新验证并创建配置对象
        self._config = JanitorConfig(**config_dict)
        return self._config
    
    def _deep_merge(self, base: Dict, updates: Dict) -> None:
        """
        递归合并字典
        
        Args:
            base: 基础字典（会被修改）
            updates: 更新内容
        """
        for key, value in updates.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_merge(base[key], value)
            else:
                base[key] = value
    
    # ============== 分类管理方法 ==============
    
    def get_categories(self) -> Dict[str, CategoryConfig]:
        """获取所有分类"""
        return self.get_config().categories
    
    def get_category(self, category_id: str) -> Optional[CategoryConfig]:
        """获取单个分类"""
        return self.get_config().categories.get(category_id)
    
    def add_category(self, category_id: str, category: CategoryConfig) -> bool:
        """
        添加新分类
        
        Args:
            category_id: 分类 ID
            category: 分类配置
            
        Returns:
            bool: 是否添加成功
        """
        config = self.get_config()
        if category_id in config.categories:
            return False  # 已存在
        
        category.id = category_id
        if not category.name:
            category.name = category_id
        
        config.categories[category_id] = category
        return True
    
    def update_category(self, category_id: str, updates: Dict[str, Any]) -> Optional[CategoryConfig]:
        """
        更新分类
        
        Args:
            category_id: 分类 ID
            updates: 更新内容
            
        Returns:
            CategoryConfig: 更新后的分类，如果不存在返回 None
        """
        config = self.get_config()
        if category_id not in config.categories:
            return None
        
        existing = config.categories[category_id]
        existing_dict = existing.model_dump()
        existing_dict.update(updates)
        existing_dict['id'] = category_id  # 保持 ID 不变
        
        config.categories[category_id] = CategoryConfig(**existing_dict)
        return config.categories[category_id]
    
    def delete_category(self, category_id: str) -> bool:
        """
        删除分类
        
        Args:
            category_id: 分类 ID
            
        Returns:
            bool: 是否删除成功
        """
        config = self.get_config()
        if category_id not in config.categories:
            return False
        
        del config.categories[category_id]
        return True


# ============== 路径验证工具 ==============

def validate_path(path: str) -> Dict[str, Any]:
    """
    验证路径是否存在
    
    Args:
        path: 要验证的路径（支持 ~ 展开）
        
    Returns:
        Dict: 验证结果，包含 exists, is_dir, is_file, expanded_path
    """
    # 展开 ~ 为用户目录
    expanded = os.path.expanduser(path)
    expanded_path = Path(expanded)
    
    return {
        'path': path,
        'expanded_path': str(expanded_path.absolute()),
        'exists': expanded_path.exists(),
        'is_dir': expanded_path.is_dir() if expanded_path.exists() else False,
        'is_file': expanded_path.is_file() if expanded_path.exists() else False,
        'is_writable': os.access(expanded, os.W_OK) if expanded_path.exists() else False,
        'parent_exists': expanded_path.parent.exists()
    }


def validate_paths(paths: List[str]) -> List[Dict[str, Any]]:
    """
    批量验证路径
    
    Args:
        paths: 路径列表
        
    Returns:
        List[Dict]: 验证结果列表
    """
    return [validate_path(p) for p in paths]


# ============== 单例实例 ==============

_config_manager: Optional[ConfigManager] = None


def get_config_manager(config_path: Optional[Path] = None) -> ConfigManager:
    """
    获取配置管理器单例
    
    Args:
        config_path: 配置文件路径（仅首次调用时有效）
        
    Returns:
        ConfigManager: 配置管理器实例
    """
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager(config_path)
    return _config_manager
