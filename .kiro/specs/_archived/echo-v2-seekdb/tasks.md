# Implementation Plan: Echo v2.0 SeekDB 本地智能核心

## Overview

本任务清单将 Echo v2.0 的设计分解为可执行的开发任务，按照三个阶段推进：
1. **Phase 1**: 基础设施搭建 - Docker 环境、数据库、同步脚本
2. **Phase 2**: 多模态摄入 - 视频处理、PPT 处理、文件监听
3. **Phase 3**: 搜索与交互 - FastAPI 服务、混合搜索

所有 Python 脚本位于 `echo/sidecar/scripts/` 目录。

## Tasks

- [x] 1. Phase 1: 基础设施搭建

- [x] 1.1 创建项目目录结构
  - 创建 `echo/sidecar/` 目录及子目录
  - 创建 `scripts/`, `tests/`, `seekdb_data/`, `import_folder/`
  - _Requirements: 7.1, 7.2_

- [x] 1.2 编写 Docker Compose 配置
  - 创建 `docker-compose.yml`，定义 SeekDB 和 Python worker 服务
  - SeekDB 映射端口 3306 和 8080
  - Python worker 挂载当前目录到 /app
  - 配置数据卷 `./seekdb_data`
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.3 创建环境变量配置
  - 创建 `.env.example` 模板文件
  - 包含 SUPABASE_URL, SUPABASE_KEY, SEEKDB_HOST, SEEKDB_PORT, SEEKDB_PASSWORD
  - _Requirements: 7.1, 7.2, 7.5_

- [x] 1.4 编写数据库初始化脚本
  - 创建 `scripts/init_db.sql`
  - 定义 knowledge_base 表结构
  - 创建全文索引
  - _Requirements: 1.4, 1.5, 1.6_

- [x] 1.5 创建 Python 依赖文件
  - 创建 `requirements.txt`
  - 包含 supabase, mysql-connector-python, fastapi, uvicorn, watchdog, faster-whisper, python-pptx, pytest, hypothesis
  - _Requirements: 7.3, 7.4_

- [x] 1.6 编写 Supabase 同步脚本
  - 创建 `scripts/sync_notes.py`
  - 实现 SyncWorker 类
  - 实现 Realtime 订阅 INSERT/UPDATE 事件
  - 实现同步到 SeekDB 逻辑
  - 实现指数退避重连机制
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ]* 1.7 编写同步脚本属性测试
  - **Property 1: 笔记同步 Round-Trip**
  - **Property 5: Embedding 非空性**
  - **Validates: Requirements 2.3, 2.4, 2.7**

- [x] 1.8 Checkpoint - Phase 1 验证
  - 启动 Docker 环境
  - 验证 SeekDB 连接
  - 验证笔记同步流程
  - Ensure all tests pass, ask the user if questions arise.

---

- [x] 2. Phase 2: 多模态摄入系统

- [x] 2.1 编写视频处理模块
  - 创建 `scripts/video_processor.py`
  - 实现 VideoChunk 数据类
  - 实现 process_video() 函数
  - 使用 faster-whisper 'base' 模型
  - 实现分块逻辑（30秒/200字符）
  - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [ ]* 2.2 编写视频处理属性测试
  - **Property 2: 视频分块约束**
  - 测试分块时长 ≤ 30 秒
  - 测试分块字符数 ≤ 200（允许容差）
  - **Validates: Requirements 3.4, 3.5**

- [x] 2.3 编写 PPT 处理模块
  - 创建 `scripts/ppt_processor.py`
  - 实现 SlideContent 数据类
  - 实现 process_ppt() 函数
  - 使用 python-pptx 提取标题和正文
  - _Requirements: 4.2, 4.3, 4.4_

- [ ]* 2.4 编写 PPT 处理属性测试
  - **Property 6: PPT 页面完整性**
  - 测试返回的 SlideContent 数量等于总页数
  - 测试 page_number 从 1 到 total_pages
  - **Validates: Requirements 4.3, 4.4, 4.6**

- [x] 2.5 编写文件摄入管理器
  - 创建 `scripts/ingest_manager.py`
  - 实现 IngestManager 类
  - 使用 watchdog 监听 import_folder
  - 实现文件类型路由逻辑
  - 实现 ingest_video() 和 ingest_ppt() 方法
  - 实现错误处理（不崩溃）
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 3.1, 3.6, 3.7, 3.8, 4.1, 4.5, 4.6, 4.7_

- [ ]* 2.6 编写文件路由属性测试
  - **Property 3: 文件路由正确性**
  - 测试 .mp4/.mkv 路由到 Video_Processor
  - 测试 .pptx 路由到 PPT_Processor
  - 测试其他类型被忽略
  - **Validates: Requirements 5.2, 5.3, 5.4**

- [x] 2.7 Checkpoint - Phase 2 验证
  - 测试视频文件处理流程
  - 测试 PPT 文件处理流程
  - 验证数据正确入库
  - Ensure all tests pass, ask the user if questions arise.

---

- [-] 3. Phase 3: 搜索与交互

- [x] 3.1 编写混合搜索 API
  - 创建 `scripts/server.py`
  - 实现 FastAPI 应用
  - 定义 SearchRequest 和 SearchResponse 模型
  - 实现 POST /search 端点
  - 实现混合搜索逻辑（向量 + 全文）
  - 实现加权排序
  - 实现空查询 400 错误
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ]* 3.2 编写搜索 API 属性测试
  - **Property 4: 混合搜索结果完整性**
  - 测试返回结果包含必要字段
  - 测试结果按分数降序排列
  - **Validates: Requirements 6.5, 6.6**

- [x] 3.3 编写环境变量验证模块
  - 创建 `scripts/config.py`
  - 实现 validate_env() 函数
  - 实现缺少变量时的快速失败
  - _Requirements: 7.6_

- [x] 3.4 编写启动脚本
  - 创建 `scripts/start.sh`
  - 启动 sync_notes.py（后台）
  - 启动 ingest_manager.py（后台）
  - 启动 server.py（前台）
  - _Requirements: 5.6_

- [ ] 3.5 Checkpoint - Phase 3 验证
  - 测试搜索 API 端点
  - 测试混合搜索结果
  - 验证完整流程
  - Ensure all tests pass, ask the user if questions arise.

---

- [ ] 4. 集成与文档

- [ ] 4.1 编写集成测试
  - 创建 `tests/test_integration.py`
  - 测试笔记同步 → 搜索流程
  - 测试视频摄入 → 搜索流程
  - 测试 PPT 摄入 → 搜索流程
  - _Requirements: 2.3, 3.6, 4.5, 6.2_

- [x] 4.2 编写 README 文档
  - 创建 `echo/sidecar/README.md`
  - 包含快速开始指南
  - 包含环境变量说明
  - 包含 API 文档
  - _Requirements: 7.2_

- [ ] 4.3 Final Checkpoint
  - 运行所有测试
  - 验证文档完整性
  - Ensure all tests pass, ask the user if questions arise.

---

- [ ] 5. Phase 4: 前端改造 (复用 Paperless UI)

- [x] 5.1 创建 SeekDB 客户端
  - 扩展 `echo/src/services/database/seekdbService.ts`
  - 添加 knowledgeSearch() 混合搜索方法
  - 添加 getKnowledgeStats() 统计方法
  - 添加 getSourceTypes() 方法
  - 更新 `echo/src/services/files/index.ts` 使用 SeekDB
  - 定义 TypeScript 类型
  - _Requirements: 6.1, 6.2_

- [ ] 5.2 创建 SeekDB tRPC 路由
  - 创建 `server/routerTrpc/seekdb.ts`
  - 实现 search 查询
  - 实现 getSourceTypes 查询
  - 实现 upload 文件上传
  - _Requirements: 6.1, 6.5_

- [ ] 5.3 改造 FileSidebar 组件
  - 修改 `components/Files/FileSidebar.tsx`
  - 从 SeekDB 获取 source_type 分类 (note, video, ppt)
  - 保留 tags 和 document-types 结构
  - _Requirements: 6.2_

- [ ] 5.4 改造 FileList 组件
  - 修改 `components/Files/FileList.tsx`
  - 调用 SeekDB 搜索 API
  - 展示搜索结果（支持 note/video/ppt 类型）
  - _Requirements: 6.5, 6.6_

- [ ] 5.5 改造 FileUpload 组件
  - 修改 `components/Files/FileUpload.tsx`
  - 上传文件到 import_folder
  - 支持视频和 PPT 文件类型
  - _Requirements: 3.1, 4.1_

- [ ] 5.6 改造 FilePreview 组件
  - 修改 `components/Files/FilePreview.tsx`
  - 展示搜索结果详情
  - 支持视频时间戳跳转
  - 支持 PPT 页码显示
  - _Requirements: 6.6_

- [ ] 5.7 Checkpoint - 前端改造验证
  - 测试搜索功能
  - 测试文件上传
  - 测试结果展示
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests, can be skipped for faster MVP
- All Python scripts should include Chinese comments for key logic
- Error handling should follow "graceful degradation" pattern - log and continue
- Use hypothesis library for property-based testing (Python equivalent of fast-check)
- Each checkpoint is a good stopping point for review
