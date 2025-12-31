# Implementation Plan: Echo V3 Enhancements

## Overview

分三个阶段实现 Echo V3 增强功能：
1. Janitor 目录配置（优先级最高，用户直接需要）
2. 向量搜索支持
3. 视频/PPT 处理集成

## Tasks

- [x] 1. Janitor 目录配置功能
  - [x] 1.1 扩展 Janitor 后端 API
    - 在 `echo/sidecar/janitor/server.py` 添加配置管理端点
    - 实现 `/config` GET/POST 端点
    - 实现 `/config/validate-path` 端点
    - 实现 `/config/categories` CRUD 端点
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7_

  - [x] 1.2 扩展 Blinko Janitor tRPC 路由
    - 在 `get/blinko-main/server/routerTrpc/janitor.ts` 添加配置端点
    - 添加 `getFullConfig`, `updateConfig`, `validatePath` 端点
    - 添加分类管理端点
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.3 创建 Janitor 配置 UI 组件
    - 创建 `JanitorConfigPanel.tsx` 组件
    - 实现目录列表管理（添加/删除 inbox 目录）
    - 实现输出目录配置
    - 实现分类管理（添加/编辑/删除分类）
    - 实现关键词编辑
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [x] 1.4 创建数据处理流程说明页面
    - 创建 `DataFlowGuide.tsx` 组件
    - 使用 Mermaid 或 SVG 绘制数据流图
    - 显示 Janitor → SeekDB → Search 流程
    - 显示各服务状态
    - 提供配置入口链接
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 1.5 编写配置持久化属性测试
    - **Property 4: Configuration Persistence**
    - **Validates: Requirements 3.4**

- [ ] 2. Checkpoint - Janitor 配置功能验收
  - 确保配置 UI 可以正常保存和加载
  - 确保 Janitor 服务使用新配置
  - 询问用户是否有问题

- [ ] 3. 向量搜索支持
  - [x] 3.1 扩展 SeekDB 数据库 Schema
    - 添加 `embedding` 向量字段到 `knowledge_base` 表
    - 创建向量索引
    - _Requirements: 2.1_
    - **已完成**: Schema 已包含 VECTOR(384) 字段和 HNSW 索引

  - [x] 3.2 实现 Embedding 生成服务
    - 在 `echo/sidecar/scripts/` 创建 `embedding_service.py`
    - 集成 Ollama `nomic-embed-text` 模型
    - 实现批量 embedding 生成
    - _Requirements: 2.1_

  - [x] 3.3 扩展 SeekDB API 支持混合搜索
    - 修改 `echo/sidecar/scripts/server.py`
    - 实现向量相似度搜索
    - 实现混合搜索（alpha 参数）
    - 添加 /embedding 和 /embedding/status 端点
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 3.4 扩展 Blinko 搜索功能
    - 修改 `paperless.ts` 添加混合搜索端点
    - 添加 `hybridSearch`, `getEmbeddingStatus`, `generateEmbedding` 端点
    - 修改 `seekdbClient.ts` 添加混合搜索方法
    - _Requirements: 2.2, 2.3, 5.4_
    - 修改搜索 UI 添加 alpha 滑块
    - 添加来源类型过滤
    - _Requirements: 2.2, 2.3, 5.4_

  - [ ] 3.5 编写混合搜索属性测试
    - **Property 2: Hybrid Search Alpha Parameter**
    - **Validates: Requirements 2.2, 2.3**

  - [ ] 3.6 编写 Embedding 回退测试
    - **Property 3: Embedding Fallback**
    - **Validates: Requirements 2.5**

- [ ] 4. Checkpoint - 向量搜索功能验收
  - 确保混合搜索正常工作
  - 确保 alpha 参数影响结果排序
  - 询问用户是否有问题

- [ ] 5. 视频/PPT 处理集成
  - [x] 5.1 创建 Ingest API 服务
    - 在 `echo/sidecar/scripts/` 创建 `ingest_api.py`
    - 实现文件上传端点
    - 实现处理状态查询端点
    - 实现任务队列管理
    - _Requirements: 1.1, 1.2, 4.1, 4.5_

  - [x] 5.2 集成 Whisper 视频处理
    - 确保 `video_processor.py` 正常工作
    - 添加进度回调支持
    - 添加 embedding 生成
    - _Requirements: 1.1, 1.3_

  - [x] 5.3 集成 PPT 处理
    - 确保 `ppt_processor.py` 正常工作
    - 添加缩略图生成
    - 添加 embedding 生成
    - _Requirements: 1.2, 1.3_

  - [x] 5.4 创建 Blinko Ingest tRPC 路由
    - 创建 `get/blinko-main/server/routerTrpc/ingest.ts`
    - 实现文件上传、状态查询、重试等端点
    - _Requirements: 1.1, 1.2, 4.1, 4.2, 4.4_

  - [x] 5.5 创建处理状态 UI 组件
    - 创建 `IngestStatus.tsx` 组件
    - 显示处理队列和进度
    - 显示最近处理的文件列表
    - 实现重试功能
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 5.6 编写媒体处理属性测试
    - **Property 1: Media Processing Round-Trip**
    - **Validates: Requirements 1.1, 1.2, 1.3**

- [-] 6. 搜索结果增强
  - [x] 6.1 创建视频预览组件
    - 创建 `VideoPreview.tsx` 组件
    - 实现从指定时间戳播放
    - _Requirements: 5.1_

  - [x] 6.2 创建 PPT 预览组件
    - 创建 `PPTPreview.tsx` 组件
    - 显示指定页面缩略图
    - _Requirements: 5.2_

  - [x] 6.3 增强搜索结果显示
    - 添加来源类型图标
    - 添加高亮摘要
    - 集成预览组件
    - _Requirements: 5.3, 5.4, 5.5_

  - [ ] 6.4 编写搜索结果元数据测试
    - **Property 6: Search Results Metadata**
    - **Validates: Requirements 1.4, 5.3, 5.4, 5.5**

- [ ] 7. Final Checkpoint - 全功能验收
  - 确保所有功能正常工作
  - 确保错误处理正确
  - 询问用户是否有问题

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- 优先实现 Janitor 配置，因为这是用户最直接的需求
- 向量搜索依赖 Ollama embedding 模型，需要确保环境配置正确
- 视频处理依赖 faster-whisper，需要确保 Python 环境配置正确
