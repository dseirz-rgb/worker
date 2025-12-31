"""
Echo Janitor - 文件分类与重命名
基于 LlamaFS，支持 Groq 原生 API 或 OpenAI 兼容 API (Deno 中转)
"""

import json
import os
import yaml
from pathlib import Path
from typing import Optional

# Echo 分类体系 Prompt 模板
ECHO_CATEGORY_PROMPT = """
You are an intelligent file organizer for the Echo system.

## Your Task
Analyze each file's content summary and classify it into the appropriate category.
Then propose a new path and filename following the naming conventions.

## Available Categories
{categories_section}

## Naming Conventions
- Format: YYYY-MM-DD_Subject_Description.ext
- Use underscores instead of spaces
- Keep names concise but descriptive
- Preserve original file extension
- If file is already well-named, keep the original name

## Classification Rules
1. Match file content against category keywords
2. If confidence is low (< {confidence_threshold}), use 99_Inbox
3. For ambiguous files, prefer the most specific category

## Response Format
Your response must be a JSON object:
```json
{{
    "files": [
        {{
            "src_path": "original file path",
            "dst_path": "category/new_filename.ext",
            "category": "category_name",
            "confidence": 0.85,
            "reason": "brief explanation"
        }}
    ]
}}
```
""".strip()

# 默认 Prompt (无分类体系时使用)
DEFAULT_FILE_PROMPT = """
You will be provided with list of source files and a summary of their contents. For each file, propose a new path and filename, using a directory structure that optimally organizes the files using known conventions and best practices.
Follow good naming conventions. Here are a few guidelines
- Think about your files : What related files are you working with?
- Identify metadata (for example, date, sample, experiment) : What information is needed to easily locate a specific file?
- Abbreviate or encode metadata
- Use versioning : Are you maintaining different versions of the same file?
- Think about how you will search for your files : What comes first?
- Deliberately separate metadata elements : Avoid spaces or special characters in your file names
If the file is already named well or matches a known convention, set the destination path to the same as the source path.

Your response must be a JSON object with the following schema:
```json
{
    "files": [
        {
            "src_path": "original file path",
            "dst_path": "new file path under proposed directory structure with proposed file name"
        }
    ]
}
```
""".strip()


def load_echo_categories(config_path: Optional[str] = None) -> dict:
    """加载 Echo 分类配置"""
    if config_path is None:
        config_path = os.environ.get(
            "ECHO_CATEGORIES_PATH",
            "config/echo_categories.yaml"
        )
    
    # 尝试多个路径
    possible_paths = [
        Path(config_path),
        Path(__file__).parent.parent / config_path,
        Path(__file__).parent.parent / "config" / "echo_categories.yaml",
    ]
    
    for path in possible_paths:
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f)
    
    return {}


def build_categories_prompt(config: dict) -> str:
    """构建分类体系 Prompt 部分"""
    categories = config.get("categories", {})
    if not categories:
        return ""
    
    lines = []
    for cat_name, cat_info in categories.items():
        keywords = cat_info.get("keywords", [])
        path = cat_info.get("path", cat_name)
        keywords_str = ", ".join(keywords[:10]) if keywords else "general files"
        lines.append(f"- **{cat_name}** ({path}): {keywords_str}")
    
    return "\n".join(lines)


def get_system_prompt(config: Optional[dict] = None) -> str:
    """获取系统 Prompt，注入 Echo 分类体系"""
    if config is None:
        config = load_echo_categories()
    
    categories_section = build_categories_prompt(config)
    
    if not categories_section:
        return DEFAULT_FILE_PROMPT
    
    confidence_threshold = config.get("confidence_threshold", 0.6)
    
    return ECHO_CATEGORY_PROMPT.format(
        categories_section=categories_section,
        confidence_threshold=confidence_threshold
    )


def get_llm_client():
    """
    获取 LLM 客户端
    优先使用 OpenAI 兼容 API (Deno 中转)，否则使用 Groq 原生 API
    """
    openai_base_url = os.environ.get("OPENAI_BASE_URL")
    openai_api_key = os.environ.get("OPENAI_API_KEY")
    
    if openai_base_url and openai_api_key:
        # 使用 OpenAI 兼容 API (Deno 中转)
        from openai import OpenAI
        return OpenAI(
            base_url=openai_base_url,
            api_key=openai_api_key
        ), "openai"
    else:
        # 使用 Groq 原生 API
        from groq import Groq
        return Groq(api_key=os.environ.get("GROQ_API_KEY")), "groq"


def create_file_tree(summaries: list, session=None):
    """
    调用 LLM 生成文件分类和重命名建议
    
    Args:
        summaries: 文件摘要列表
        session: 可选的会话对象 (保留兼容性)
    
    Returns:
        文件树列表，包含 src_path, dst_path, category, confidence, reason
    """
    # 加载配置
    config = load_echo_categories()
    system_prompt = get_system_prompt(config)
    
    # 获取 LLM 客户端
    client, client_type = get_llm_client()
    
    # 获取模型名称
    if client_type == "openai":
        # OpenAI 兼容 API 使用的模型
        model = os.environ.get("OPENAI_MODEL", "llama-3.1-70b-versatile")
    else:
        # Groq 原生 API 使用的模型
        model = config.get("groq", {}).get("model", "llama-3.1-70b-versatile")
    
    # 调用 LLM
    chat_completion = client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(summaries, ensure_ascii=False)},
        ],
        model=model,
        response_format={"type": "json_object"},
        temperature=0,
    )
    
    # 解析响应
    response_content = chat_completion.choices[0].message.content
    result = json.loads(response_content)
    file_tree = result.get("files", [])
    
    # 处理置信度阈值
    confidence_threshold = config.get("confidence_threshold", 0.6)
    for file_info in file_tree:
        confidence = file_info.get("confidence", 1.0)
        if confidence < confidence_threshold:
            # 低置信度文件移动到 99_Inbox
            original_dst = file_info.get("dst_path", "")
            filename = Path(original_dst).name if original_dst else Path(file_info["src_path"]).name
            file_info["dst_path"] = f"99_Inbox/{filename}"
            file_info["category"] = "99_Inbox"
            file_info["reason"] = f"Low confidence ({confidence:.2f}), moved to Inbox"
    
    return file_tree
