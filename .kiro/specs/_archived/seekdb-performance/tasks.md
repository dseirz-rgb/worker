# Implementation Plan: 双数据库架构优化

## Overview

将 Echo 系统从单一 SeekDB 架构迁移到 PostgreSQL + SeekDB 双数据库架构，实现高频操作的快速响应和语义搜索的分离。

## Tasks

- [x] 1. PostgreSQL 全文搜索扩展
  - [x] 1.1 安装中文分词扩展 (pg_jieba 或 zhparser)
    - 在 docker-compose 中配置 PostgreSQL 扩展
    - 验证中文分词功能
    - _Requirements: 2.3_

  - [x] 1.2 扩展 attachments 表 schema
    - 添加 content 字段存储文档内容
    - 添加 search_vector 字段 (tsvector)
    - 创建 GIN 索引
    - _Requirements: 2.1_

  - [x] 1.3 实现 PostgresSearchService
    - 使用 Prisma 原生查询执行 FTS
    - 实现 ts_rank 排序
    - 支持标签和类型过滤
    - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.5_

  - [ ]* 1.4 编写 PostgreSQL 搜索属性测试
    - **Property 2: 搜索结果排序**
    - **Validates: Requirements 2.5**

- [x] 2. SeekDB 向量服务重构
  - [x] 2.1 创建 SeekDB 连接池
    - 使用 mysql.connector.pooling
    - 配置 min_size=3, max_size=5
    - _Requirements: 6.1_

  - [x] 2.2 实现 EmbeddingCache (LRU)
    - 使用 OrderedDict 实现 LRU
    - 容量 100 entries
    - 提供 hit_rate 统计
    - _Requirements: 6.2_

  - [ ]* 2.3 编写缓存 LRU 属性测试
    - **Property 6: 缓存 LRU 行为**
    - **Validates: Requirements 6.2**

  - [x] 2.4 重构 SeekDBVectorService
    - 只保留向量搜索功能
    - 移除 Paperless 兼容 API
    - 集成 EmbeddingCache
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 2.5 编写缓存命中属性测试
    - **Property 7: 缓存命中跳过 Ollama**
    - **Validates: Requirements 6.3**

- [x] 3. 搜索路由器实现
  - [x] 3.1 实现 SearchRouter
    - alpha=0: 路由到 PostgreSQL
    - alpha=1: 路由到 SeekDB
    - 0<alpha<1: 并行查询两者
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 3.2 编写路由属性测试
    - **Property 3: Alpha 路由正确性**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 3.3 实现混合搜索结果合并
    - 计算 hybrid_score = (1-alpha)*text + alpha*vector
    - 去重和排序
    - _Requirements: 5.3_

  - [x] 3.4 实现超时降级逻辑
    - 2 秒 embedding 超时
    - 自动回退到 PostgreSQL FTS
    - 返回 embedding_available=false 标志
    - _Requirements: 6.4, 6.5_

  - [ ]* 3.5 编写超时降级属性测试
    - **Property 8: 超时降级**
    - **Validates: Requirements 6.5**

- [-] 4. Checkpoint - 搜索功能验证
  - 确保所有测试通过
  - 验证 alpha=0 响应时间 <100ms
  - 验证 alpha=1 响应时间 <500ms
  - 如有问题请询问用户

- [x] 5. 数据同步服务
  - [x] 5.1 实现 SyncService 基础结构
    - 定义同步任务数据模型
    - 实现异步任务队列
    - _Requirements: 4.4_

  - [x] 5.2 实现文档创建同步
    - 监听 PostgreSQL 文档创建
    - 生成 embedding 并存入 SeekDB
    - _Requirements: 4.1_

  - [x] 5.3 实现文档更新同步
    - 检测内容变更 (content_hash)
    - 更新 SeekDB embedding
    - _Requirements: 4.2_

  - [x] 5.4 实现文档删除同步
    - 监听 PostgreSQL 文档删除
    - 移除 SeekDB embedding
    - _Requirements: 4.3_

  - [ ]* 5.5 编写同步一致性属性测试
    - **Property 4: CRUD 同步一致性**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [x] 5.6 实现重试机制
    - 指数退避: 1s, 2s, 4s
    - 最多 3 次重试
    - 失败记录到日志
    - _Requirements: 4.5_

  - [ ]* 5.7 编写重试机制属性测试
    - **Property 5: 重试机制**
    - **Validates: Requirements 4.5**

- [x] 6. 健康检查与监控
  - [x] 6.1 实现 /health 端点
    - 检查 PostgreSQL 连接
    - 检查 SeekDB 连接
    - 返回各自状态
    - _Requirements: 8.1, 8.2_

  - [ ]* 6.2 编写健康检查属性测试
    - **Property 9: 健康检查状态**
    - **Validates: Requirements 8.2**

  - [x] 6.3 实现 /metrics 端点
    - 响应时间统计
    - 缓存命中率
    - 同步队列深度
    - _Requirements: 8.3, 8.4_

  - [x] 6.4 实现降级模式
    - SeekDB 不可用时降级到 FTS
    - 返回 degraded 状态
    - _Requirements: 8.5_

  - [ ]* 6.5 编写降级模式属性测试
    - **Property 10: 降级模式**
    - **Validates: Requirements 8.5**

- [x] 7. API 层更新
  - [x] 7.1 更新 server.py 主入口
    - 集成 SearchRouter
    - 更新 /search 端点使用新路由
    - 保持 API 兼容性
    - _Requirements: 1.1, 3.2, 3.5_

  - [x] 7.2 更新文档 CRUD 端点
    - 使用 PostgreSQL (Prisma) 处理 CRUD
    - 触发同步服务
    - _Requirements: 1.1, 1.2_

  - [x] 7.3 更新 TypeScript 客户端
    - 添加 alpha 参数支持
    - 更新类型定义
    - _Requirements: 5.4_

- [x] 8. 数据迁移
  - [x] 8.1 编写迁移脚本
    - 从 SeekDB 导出现有文档元数据
    - 导入到 PostgreSQL attachments 表
    - 生成 search_vector
    - _Requirements: 1.2, 2.1_

  - [x] 8.2 编写批量同步脚本
    - 为所有现有文档生成 embedding
    - 批量插入 SeekDB
    - _Requirements: 7.3_

- [ ] 9. Final Checkpoint - 完整验证
  - 确保所有测试通过
  - 运行性能基准测试
  - 验证数据迁移完整性
  - 如有问题请询问用户

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 优先实现 PostgreSQL 搜索 (Task 1)，这是解决延迟问题的关键
- SeekDB 重构 (Task 2) 可以并行进行
- 数据迁移 (Task 8) 应在功能完成后执行
- 属性测试使用 `hypothesis` 库，每个测试至少 100 次迭代
