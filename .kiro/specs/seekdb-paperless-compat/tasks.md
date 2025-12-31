# Implementation Plan: SeekDB Paperless 兼容层

## Overview

将 SeekDB 扩展为 Paperless-ngx 的完全替代后端，分 4 个阶段实现：数据库扩展、API 实现、客户端创建、路由切换。

## Tasks

- [x] 1. 扩展 SeekDB 数据库结构
  - [x] 1.1 更新 init_db.sql，添加 documents, tags, document_types, document_tags 表
    - 创建 Paperless 兼容的表结构
    - 添加外键约束和索引
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.2 创建示例数据初始化脚本 seed_data.sql
    - 插入 MOCK_TAGS 数据
    - 插入 MOCK_DOCUMENT_TYPES 数据
    - 插入 MOCK_DOCUMENTS 数据
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 2. 实现 SeekDB Paperless 兼容 API
  - [x] 2.1 添加文档 CRUD 端点到 server.py
    - GET /api/documents/ (列表，分页)
    - GET /api/documents/{id}/ (详情)
    - POST /api/documents/post_document/ (上传)
    - PATCH /api/documents/{id}/ (更新)
    - DELETE /api/documents/{id}/ (删除)
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7_
  - [x] 2.2 添加文件下载和预览端点
    - GET /api/documents/{id}/download/ (下载原文件)
    - GET /api/documents/{id}/preview/ (预览 PDF)
    - GET /api/documents/{id}/thumb/ (缩略图)
    - _Requirements: 2.4, 2.5_
  - [x] 2.3 添加标签和文档类型端点
    - GET/POST/DELETE /api/tags/
    - GET/POST /api/document_types/
    - GET /api/correspondents/ (返回空列表)
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2_

- [x] 3. 创建 SeekDB TypeScript 客户端
  - [x] 3.1 创建 seekdbClient.ts
    - 实现与 PaperlessClient 相同的接口
    - 连接 SeekDB API (http://localhost:8765)
    - 处理错误和超时
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. 切换 tRPC 路由到 SeekDB
  - [x] 4.1 修改 paperless.ts 使用 SeekDBClient
    - 替换 getPaperlessClient 为 getSeekDBClient
    - 保持 API 契约不变
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 4.2 更新配置逻辑
    - 简化配置（SeekDB 不需要 API Token）
    - 添加 SeekDB 连接测试
    - _Requirements: 6.3_

- [x] 5. Checkpoint - 测试验证
  - 启动 SeekDB 和 API 服务
  - 验证前端文件管理页面正常工作
  - 确保所有 Mock 数据正确显示

## Notes

- 前端代码 (files.tsx, FileSidebar, FileList 等) 完全不需要修改
- SeekDB API 端口默认 8765，与原有搜索 API 共用
- 文件存储使用本地文件系统 (echo/sidecar/storage/)
