# Implementation Plan: SeekDB 本地数据库

## Overview

将 Echo 应用的本地数据库从 SQLite 升级为 SeekDB，实现 AI 原生搜索能力。
采用 Python Sidecar 架构，通过 FastAPI 提供 REST API。

### 开发原则

⚠️ **用户不懂代码开发**，开发过程遵循以下原则：

1. **全自动执行** - 所有命令我直接运行，不给用户命令
2. **自动化测试** - 测试自动运行，不需要用户手动测试
3. **问题自行解决** - 遇到 bug 先自己修复
4. **Checkpoint 确认** - 只在关键节点让用户确认
5. **简洁汇报** - 告诉用户"做完了，可以试用了"

---

## Tasks

### Phase 1: Python Sidecar 基础设施

- [x] 1. 创建 Python Sidecar 项目
  - [x] 1.1 初始化 Python 项目结构
    - 创建 `echo/sidecar/` 目录
    - 创建 `pyproject.toml` 配置文件
    - 安装依赖: fastapi, uvicorn, pyseekdb
    - _Requirements: 7.1_

  - [x] 1.2 实现 FastAPI 基础服务
    - 创建 `main.py` 入口文件
    - 实现健康检查端点 `/health`
    - 配置 CORS 和错误处理
    - _Requirements: 7.1, 7.3_

  - [x] 1.3 集成 SeekDB 客户端
    - 初始化 SeekDB 连接
    - 创建数据库文件 `./data/echo.seekdb`
    - 实现连接管理和关闭
    - _Requirements: 1.2, 1.5_

- [x] 2. 实现 Collection 管理
  - [x] 2.1 创建 Collection 初始化逻辑
    - 定义 notes, tasks, reminders, memories 集合
    - 配置 DefaultEmbeddingFunction
    - 实现集合存在性检查
    - _Requirements: 1.3, 5.4_

  - [x] 2.2 实现 Collection CRUD API
    - 创建 `/collections` 端点
    - 实现集合列表、创建、删除
    - _Requirements: 1.3_

- [x] 3. Checkpoint - Sidecar 基础验证
  - 确保 Sidecar 可以启动
  - 确保 SeekDB 连接正常
  - 确保 Collection 创建成功
  - 如有问题请询问用户

---

### Phase 2: 数据操作 API

- [x] 4. 实现 Notes API
  - [x] 4.1 创建 Notes CRUD 端点
    - POST `/notes` - 创建笔记
    - GET `/notes/{id}` - 获取笔记
    - PUT `/notes/{id}` - 更新笔记
    - DELETE `/notes/{id}` - 删除笔记
    - GET `/notes` - 列出所有笔记
    - _Requirements: 1.3, 5.1, 5.2_

  - [ ]* 4.2 编写 Notes API 属性测试
    - **Property 4: Auto Embedding Generation**
    - **Validates: Requirements 5.1, 5.2**

- [x] 5. 实现 Tasks API
  - [x] 5.1 创建 Tasks CRUD 端点
    - POST `/tasks` - 创建任务
    - GET `/tasks/{id}` - 获取任务
    - PUT `/tasks/{id}` - 更新任务
    - DELETE `/tasks/{id}` - 删除任务
    - _Requirements: 1.3, 5.3_

- [x] 6. 实现 Memories API
  - [x] 6.1 创建 Memories CRUD 端点
    - POST `/memories` - 创建记忆
    - GET `/memories/{id}` - 获取记忆
    - DELETE `/memories/{id}` - 删除记忆
    - GET `/memories` - 列出用户记忆
    - _Requirements: 6.1_

- [x] 7. Checkpoint - CRUD API 验证
  - 确保所有 CRUD 操作正常
  - 确保 Embedding 自动生成
  - 如有问题请询问用户

---

### Phase 3: 搜索功能

- [x] 8. 实现向量搜索
  - [x] 8.1 创建向量搜索端点
    - POST `/search/vector` - 向量搜索
    - 实现 query embedding 生成
    - 返回相似度分数
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 8.2 编写向量搜索属性测试
    - **Property 2: Vector Search Relevance**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 9. 实现全文搜索
  - [x] 9.1 创建全文搜索端点
    - POST `/search/fulltext` - 全文搜索
    - 实现关键词匹配
    - _Requirements: 4.1_

- [x] 10. 实现混合搜索
  - [x] 10.1 创建混合搜索端点
    - POST `/search` - 混合搜索
    - 合并向量和全文结果
    - 实现权重配置
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 10.2 编写混合搜索属性测试
    - **Property 3: Hybrid Search Combination**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 11. 实现搜索过滤
  - [x] 11.1 添加搜索过滤功能
    - 支持 domain 过滤
    - 支持 type 过滤
    - 支持日期范围过滤
    - _Requirements: 3.4_

- [x] 12. Checkpoint - 搜索功能验证
  - 确保向量搜索返回相关结果
  - 确保混合搜索正常工作
  - 确保过滤功能正常
  - 如有问题请询问用户

---

### Phase 4: TypeScript 集成

- [x] 13. 创建 TypeScript Database Service
  - [x] 13.1 实现 SeekDB Service 客户端
    - 创建 `seekdbService.ts`
    - 封装所有 HTTP 调用
    - 实现错误处理
    - _Requirements: 1.1_

  - [x] 13.2 实现健康检查和重连
    - 实现 `healthCheck()` 方法
    - 实现连接状态监控
    - _Requirements: 7.4_

- [x] 14. 升级 Memory Service
  - [x] 14.1 创建 SeekDB Memory Service
    - 实现 `add()` 方法
    - 实现 `search()` 方法
    - 实现 `getContext()` 方法
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 14.2 编写 Memory Service 属性测试
    - **Property 5: Memory Retrieval Relevance**
    - **Validates: Requirements 6.2, 6.3, 6.4**

- [x] 15. 集成到现有服务
  - [x] 15.1 更新 Note Service
    - 使用 SeekDB Service 替换 SQLite
    - 保持 API 兼容
    - _Requirements: 1.1_

  - [x] 15.2 更新 Task Service
    - 使用 SeekDB Service 替换 SQLite
    - 保持 API 兼容
    - _Requirements: 1.1_

- [x] 16. Checkpoint - TypeScript 集成验证
  - 确保前端可以调用 SeekDB
  - 确保现有功能正常工作
  - 如有问题请询问用户

---

### Phase 5: 数据迁移

- [x] 17. 实现数据迁移工具
  - [x] 17.1 创建迁移脚本
    - 读取 SQLite 数据
    - 转换为 SeekDB 格式
    - 批量导入到 SeekDB
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 17.2 实现迁移验证
    - 比较记录数量
    - 验证数据完整性
    - _Requirements: 2.5_

  - [ ]* 17.3 编写迁移属性测试
    - **Property 1: Data Migration Integrity**
    - **Validates: Requirements 2.2, 2.3, 2.5**

- [x] 18. 实现回滚机制
  - [x] 18.1 创建回滚功能
    - 保留 SQLite 备份
    - 实现迁移失败回滚
    - _Requirements: 2.4_

- [x] 19. Checkpoint - 数据迁移验证
  - 确保迁移成功完成
  - 确保数据完整性
  - 如有问题请询问用户

---

### Phase 6: 数据持久化与备份

- [x] 20. 实现导出功能
  - [x] 20.1 创建导出端点
    - GET `/export` - 导出所有数据
    - 生成 JSON 格式
    - _Requirements: 8.3_

- [x] 21. 实现导入功能
  - [x] 21.1 创建导入端点
    - POST `/import` - 导入数据
    - 合并现有数据
    - _Requirements: 8.4_

  - [ ]* 21.2 编写导入导出属性测试
    - **Property 6: Export/Import Round-Trip**
    - **Validates: Requirements 8.3, 8.4**

- [x] 22. 实现即时持久化
  - [x] 22.1 确保数据即时写入
    - 验证写入后立即可查询
    - _Requirements: 8.2_

  - [ ]* 22.2 编写持久化属性测试
    - **Property 7: Immediate Persistence**
    - **Validates: Requirements 8.2**

- [x] 23. Checkpoint - 持久化验证
  - 确保导出导入正常
  - 确保数据即时持久化
  - 如有问题请询问用户

---

### Phase 7: Tauri 集成

- [x] 24. 实现 Sidecar 管理
  - [x] 24.1 创建 Sidecar 启动逻辑
    - 在 Tauri 启动时启动 Sidecar
    - 实现启动超时处理
    - _Requirements: 7.2_

  - [x] 24.2 实现 Sidecar 关闭逻辑
    - 在 Tauri 关闭时停止 Sidecar
    - 实现优雅关闭
    - _Requirements: 7.5_

  - [x] 24.3 实现 Sidecar 重启逻辑
    - 检测 Sidecar 崩溃
    - 自动重启
    - _Requirements: 7.4_

- [x] 25. 实现并发安全
  - [x] 25.1 测试并发请求
    - 验证并发安全性
    - _Requirements: 7.6_

  - [ ]* 25.2 编写并发安全属性测试
    - **Property 8: Concurrent Request Safety**
    - **Validates: Requirements 7.6**

- [x] 26. 最终验收
  - 确保所有功能正常工作
  - 确保所有测试通过
  - 确保 Sidecar 管理正常
  - 如有问题请询问用户

---

## Notes

- Tasks marked with `*` are optional property-based tests
- Each checkpoint ensures incremental validation
- Property tests validate universal correctness properties
- 建议先完成 Phase 1-4 形成可用版本，再进行数据迁移
