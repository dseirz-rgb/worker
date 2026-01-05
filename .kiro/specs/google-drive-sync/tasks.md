# Implementation Plan: Google Drive Sync

## Overview

实现 Google Drive 到投资知识库的自动同步功能。按照模块化方式逐步实现：先搭建基础设施，再实现核心同步逻辑，最后添加前端状态显示。

## Tasks

- [x] 1. 环境配置和数据库准备
  - [x] 1.1 添加环境变量配置
    - 在 .env.example 添加 GOOGLE_SERVICE_ACCOUNT_KEY 说明
    - 确认 GOOGLE_DRIVE_FOLDER_ID 已存在
    - _Requirements: 1.1, 1.3_
  - [x] 1.2 创建数据库迁移脚本
    - 创建 sync_state 表
    - 创建 file_sync_records 表
    - 添加 'financial_model' 到 source_type 枚举（如需要）
    - _Requirements: 2.5_

- [x] 2. Google Drive Client 实现
  - [x] 2.1 创建 GoogleDriveClient 类
    - 实现 Service Account 认证
    - 实现 getChanges() 方法
    - 实现 getFileContent() 方法
    - 实现 exportSheet() 方法
    - 文件路径: services/echo-server/lib/googleDriveClient.ts
    - _Requirements: 1.1, 1.2, 1.3, 2.1_
  - [x] 2.2 编写 GoogleDriveClient 单元测试
    - Mock googleapis 调用
    - 测试认证流程
    - 测试错误处理
    - _Requirements: 1.2, 7.4_

- [x] 3. 文件解析器实现
  - [x] 3.1 创建 FileParser 模块
    - 实现 TXT 解析
    - 实现 Markdown 解析
    - 实现 PDF 解析（使用 pdf-parse）
    - 实现 Excel 解析（使用 xlsx）
    - 实现 Google Sheets 文本转换
    - 文件路径: services/echo-server/lib/fileParser.ts
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 5.1_
  - [x] 3.2 编写 FileParser 属性测试
    - **Property 2: Text Chunking Consistency**
    - **Property 4: Filename to Title Mapping**
    - **Property 7: Table Structure Preservation**
    - **Property 8: Numerical Precision**
    - **Validates: Requirements 3.1, 3.3, 3.6, 4.2, 5.2, 5.4**

- [x] 4. 同步状态管理
  - [x] 4.1 创建 SyncStateManager 类
    - 实现 Change Token 读写
    - 实现文件同步记录 CRUD
    - 文件路径: services/echo-server/lib/syncStateManager.ts
    - _Requirements: 2.5_
  - [x] 4.2 编写 SyncStateManager 属性测试
    - **Property 3: Change Token Persistence Round-Trip**
    - **Validates: Requirements 2.1, 2.5**

- [x] 5. Checkpoint - 基础模块验证
  - 确保 GoogleDriveClient 能连接 Drive API
  - 确保 FileParser 能解析各种文件格式
  - 确保 SyncStateManager 能正确持久化状态

- [x] 6. 核心同步服务实现
  - [x] 6.1 创建 DriveSyncService 类
    - 实现 initialize() 方法
    - 实现 sync() 核心逻辑
    - 实现文件变更检测（新增/修改/删除）
    - 实现嵌入生成和数据库写入
    - 文件路径: services/echo-server/lib/driveSyncService.ts
    - _Requirements: 2.2, 2.3, 2.4, 3.4, 3.5, 4.3, 4.4, 5.3_
  - [x] 6.2 编写 DriveSyncService 属性测试
    - **Property 1: Source Type Assignment**
    - **Property 5: Concurrent Sync Prevention**
    - **Property 6: Graceful Error Handling**
    - **Validates: Requirements 3.5, 4.3, 5.3, 6.4, 7.2**

- [x] 7. 定时调度和 API 端点
  - [x] 7.1 实现定时同步调度
    - 使用 pg-boss 设置 5 分钟间隔
    - 服务启动时执行初始同步
    - 文件路径: services/echo-server/jobs/driveSyncJob.ts
    - _Requirements: 6.1, 6.2_
  - [x] 7.2 添加手动同步 API 端点
    - POST /api/trpc/driveSync.trigger
    - GET /api/trpc/driveSync.status
    - 添加到 tRPC router
    - 文件路径: services/echo-server/routerTrpc/driveSync.ts
    - _Requirements: 6.3, 6.4_
  - [x] 7.3 编写 API 端点测试
    - 测试手动触发同步
    - 测试状态查询
    - _Requirements: 6.3_

- [x] 8. Checkpoint - 后端功能验证
  - 确保定时同步正常运行
  - 确保 API 端点可用
  - 确保文件变更能被正确处理

- [x] 9. 前端状态显示
  - [x] 9.1 更新 KnowledgeBaseDialog 组件
    - 添加同步状态显示（idle/syncing/error）
    - 添加最后同步时间显示
    - 添加手动同步按钮
    - 同步完成后刷新文档列表
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 9.2 编写前端组件测试
    - 测试状态显示
    - 测试按钮交互
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 10. 日志和监控
  - [x] 10.1 添加同步日志
    - 记录同步开始/结束时间
    - 记录处理的文件数量
    - 记录错误详情
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 10.2 实现指数退避重试
    - 处理 Google API 429 错误
    - 实现 1s, 2s, 4s, 8s 退避策略
    - _Requirements: 7.4_

- [x] 11. Final Checkpoint - 完整功能验证
  - 确保所有测试通过
  - 确保端到端同步流程正常
  - 确保前端状态正确显示

## Notes

- 所有任务都必须完成，包括测试
- 使用 googleapis 库进行 Drive API 调用
- 使用 pdf-parse 解析 PDF 文件
- 使用 xlsx 库解析 Excel 文件
- 嵌入生成复用现有的 Gemini embedding API
- 数据存储到 Investment DB (Supabase)
