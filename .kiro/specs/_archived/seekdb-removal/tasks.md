# Implementation Plan: SeekDB Removal

## Overview

移除 SeekDB 向量数据库，简化 Echo 系统架构。按照依赖关系分阶段执行：先移除代码引用，再删除文件，最后更新配置和文档。

## Tasks

- [x] 1. 移除 SeekDB TypeScript 客户端
  - [x] 1.1 删除 `get/blinko-main/server/lib/seekdbClient.ts`
    - 删除整个文件
    - _Requirements: 1.2_
  - [x] 1.2 移除 seekdbClient 的引用
    - 搜索并移除所有 import seekdbClient 的代码
    - 更新相关 tRPC router
    - _Requirements: 1.2_

- [x] 2. 移除 SeekDB Python 脚本
  - [x] 2.1 删除 `echo/sidecar/scripts/search_router.py`
    - _Requirements: 4.1_
  - [x] 2.2 删除 `echo/sidecar/scripts/vector_service.py`
    - _Requirements: 4.2_
  - [x] 2.3 删除 `echo/sidecar/scripts/sync_service.py`
    - _Requirements: 4.3_
  - [x] 2.4 删除 `echo/sidecar/scripts/embedding_cache.py`
    - _Requirements: 4.4_
  - [x] 2.5 删除 `echo/sidecar/scripts/connection_pool.py`
    - _Requirements: 4.5_
  - [x] 2.6 删除 `echo/sidecar/scripts/server_v2.py`
    - _Requirements: 4.6_
  - [x] 2.7 删除 `echo/sidecar/scripts/health_metrics.py`
    - _Requirements: 4.7_

- [x] 3. 简化 Ingest API
  - [x] 3.1 修改 `echo/sidecar/scripts/ingest_api.py`
    - 移除 SeekDB 同步逻辑
    - 改用内存存储任务状态
    - _Requirements: 6.3, 6.4_
  - [x] 3.2 更新 `echo/sidecar/scripts/server.py`
    - 移除 SeekDB 相关导入和路由
    - _Requirements: 4.6_

- [x] 4. Checkpoint - 验证 Python 服务
  - 确保 ingest_api.py 可以独立运行
  - 测试视频和 PPT 处理功能
  - _Requirements: 6.1, 6.2_

- [x] 5. 移除 UI 组件
  - [x] 5.1 简化 `SearchModeSelector.tsx`
    - 移除 hybrid 和 semantic 模式
    - 仅保留 fast 模式 (PostgreSQL FTS)
    - _Requirements: 2.5, 4.8_
  - [x] 5.2 更新 `GlobalSearch.tsx`
    - 移除搜索模式选择器 UI
    - 直接使用 PostgreSQL FTS
    - _Requirements: 2.5_
  - [x] 5.3 更新 `ServiceStatus.tsx`
    - 移除 SeekDB 状态显示
    - _Requirements: 5.3_

- [x] 6. 更新配置文件
  - [x] 6.1 修改 `docker-compose.yml`
    - 移除 SeekDB 容器定义
    - _Requirements: 1.1_
  - [x] 6.2 修改 `docker-compose.dev.yml`
    - 移除 SeekDB 容器定义
    - _Requirements: 1.1_
  - [x] 6.3 修改 `.env.example`
    - 移除 SEEKDB_* 环境变量
    - _Requirements: 1.4_
  - [x] 6.4 修改 `echo/sidecar/.env.example`
    - 移除 SeekDB 相关配置
    - _Requirements: 1.4_

- [x] 7. 更新健康检查
  - [x] 7.1 简化健康检查逻辑
    - 只检查 PostgreSQL 状态
    - 移除 SeekDB 健康检查
    - _Requirements: 5.1, 5.2, 5.4_

- [x] 8. Checkpoint - 验证系统功能
  - 启动系统，验证搜索功能正常
  - 验证 AI 对话功能正常（使用 Blinko embedding）
  - 验证文件上传和预览正常

- [x] 9. 更新文档
  - [x] 9.1 更新 `echo/docs/VISION_AND_ARCHITECTURE.md`
    - 移除双数据库架构描述
    - 更新为单数据库架构 (v3.1)
    - _Requirements: 1.5_
  - [ ] 9.2 更新 `echo/sidecar/README.md`
    - 移除 SeekDB 相关说明
    - _Requirements: 1.5_

- [ ] 10. 清理 seekdb-performance spec
  - [ ] 10.1 归档或删除 `.kiro/specs/seekdb-performance/`
    - 该 spec 已不再适用
    - _Requirements: 1.2_

- [x] 11. Final Checkpoint
  - 运行完整测试套件
  - 验证所有功能正常
  - 确认无 SeekDB 相关代码残留

## Completion Summary

### 已完成的工作:

1. **TypeScript 清理**:
   - 删除 `seekdbClient.ts`
   - 更新 `paperless.ts`, `janitor.ts`, `gateway.ts` 等 tRPC routers
   - 更新 `serviceRegistry.ts`, `janitorClient.ts`
   - 更新前端页面和组件

2. **Python 脚本清理**:
   - 删除 7 个 SeekDB 相关脚本
   - 简化 `ingest_api.py`，改用内存存储

3. **UI 组件更新**:
   - 简化 `SearchModeSelector.tsx`
   - 更新 `GlobalSearch.tsx`
   - 更新 `ServiceStatus.tsx`
   - 更新 `useServiceStatus.ts`

4. **配置文件更新**:
   - 更新 `docker-compose.yml` 和 `docker-compose.dev.yml`
   - 更新 `.env.example` 和 `echo/sidecar/.env.example`

5. **文档更新**:
   - 更新 `VISION_AND_ARCHITECTURE.md` 到 v3.1

## Notes

- 任务按依赖顺序排列，先移除代码引用，再删除文件
- Checkpoint 任务用于验证阶段性成果
- 保留 PostgreSQL FTS 和 Blinko Embedding 功能
- 视频/PPT 处理功能保持不变，只是不再同步到 SeekDB
