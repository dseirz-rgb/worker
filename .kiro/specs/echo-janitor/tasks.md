# Implementation Plan: Echo Janitor

## Overview

基于 LlamaFS 开源项目 Fork 改造，保留原版 Groq (云端) + Ollama (图片) 混合方案，添加 Echo 特定的分类体系和回滚功能。

**源项目**: https://github.com/iyaja/llama-fs
**AI 方案**: Groq (免费云端 Llama3) + Ollama (本地图片理解)

## Tasks

- [x] 1. 项目初始化与基础设施
  - [x] 1.1 Fork LlamaFS 源码
    - `git clone` 下载 LlamaFS 到 `echo/sidecar/janitor/`
    - 删除 `.git` 目录
    - _Requirements: 1.1_
  
  - [x] 1.2 分析 LlamaFS 架构
    - 阅读 `server.py`, `src/loader.py`, `src/tree_generator.py`
    - 理解 Groq API 调用方式 (文本摘要)
    - 理解 Ollama moondream 调用方式 (图片理解)
    - _Requirements: 1.1, 2.1_
  
  - [x] 1.3 创建 Echo 配置文件
    - 创建 `config/echo_categories.yaml` 定义分类体系
    - 更新 `.env.example` 说明 Groq API Key
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 2. Echo 分类体系集成
  - [x] 2.1 修改 Prompt 注入分类体系
    - 修改 `src/tree_generator.py` 的 `FILE_PROMPT`
    - 注入 Echo 分类和关键词
    - _Requirements: 4.5, 5.1_
  
  - [x] 2.2 添加置信度阈值处理
    - 修改 AI 返回格式，包含 confidence
    - 低置信度文件进入 99_Inbox
    - _Requirements: 5.5_

- [x] 3. 操作日志与回滚功能 (Echo 扩展)
  - [x] 3.1 添加 undo 日志记录
    - 修改 `server.py` 的 `/commit` 端点
    - 每次移动文件时记录到 CSV
    - _Requirements: 6.1, 6.2_
  
  - [x] 3.2 实现 undo API
    - 添加 `/history` 和 `/undo` 端点
    - 支持回滚最近操作
    - _Requirements: 6.3, 6.4_
  
  - [x] 3.3 添加健康检查端点
    - 添加 `/health` 端点
    - _Requirements: 7.5_

- [ ] 4. Checkpoint - 功能验证
  - 获取 Groq API Key
  - 运行 `python main.py sample_data/ output/` 测试
  - 确认文件分类和重命名正常工作

- [ ] 5. Docker 部署配置
  - [ ] 5.1 创建 Dockerfile
    - 基于 Python 3.11
    - 安装依赖
    - _Requirements: 1.1_
  
  - [x] 5.2 创建 docker-compose.yml
    - 配置 Janitor 服务
    - 配置卷挂载
    - _Requirements: 1.2, 1.3, 1.4_

- [ ] 6. SeekDB 集成 (可选)
  - [ ] 6.1 添加 SeekDB 通知
    - 文件归档后调用 SeekDB API
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 7. 文档更新
  - [ ] 7.1 更新 README.md
    - 说明这是 LlamaFS 的 Echo 改造版
    - 记录改动点
    - 使用说明

## Notes

- 这是基于 LlamaFS 的 Fork 改造，不是重写
- **保留原版 Groq + Ollama 混合方案**
  - Groq: 免费云端 Llama3，用于文本摘要和分类
  - Ollama moondream: 本地图片理解
- 核心改动：添加 Echo 分类体系、undo 功能
- 保留 LlamaFS 原有的 batch/watch 模式
