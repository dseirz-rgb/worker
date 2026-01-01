# Requirements Document

## Introduction

本文档定义 Echo 项目的多端部署架构需求，明确前端和后端分别部署在什么平台，以及各端的技术选型。

> 版本: v3.1 (单数据库架构)
> 最后更新: 2026-01-01

## Glossary

- **Frontend**: React 前端应用（Blinko Web UI）
- **Backend**: Node.js 后端服务（Blinko Server + tRPC + Mastra AI）
- **PostgreSQL**: 主数据库，包含 pgvector 扩展用于向量搜索
- **Janitor_Service**: Python 文件整理服务（AI 分类、重命名）
- **Paperless**: 文档管理服务（OCR、标签、搜索）
- **Tauri_App**: 基于 Tauri 框架的跨平台桌面/移动应用
- **Ollama**: 本地 LLM 服务（用于 Embedding 和 AI 推理）

## Requirements

### Requirement 1: 本地开发环境 (Docker Compose)

**User Story:** As a 开发者, I want 一键启动所有服务, so that 我可以快速开始开发和测试。

#### Acceptance Criteria

1. THE Echo_System SHALL 通过 `docker-compose.dev.yml` 一键启动所有服务
2. THE Echo_System SHALL 提供 `dev.sh` 脚本简化开发环境管理
3. WHEN 执行 `./dev.sh` THEN 所有后端服务 SHALL 自动启动并健康检查
4. THE Echo_System SHALL 支持 `./dev.sh status` 查看所有服务状态
5. THE Echo_System SHALL 支持 `./dev.sh logs` 查看服务日志

### Requirement 2: 单数据库架构 (PostgreSQL + pgvector)

**User Story:** As a 开发者, I want 使用单一数据库, so that 部署和维护更简单。

#### Acceptance Criteria

1. THE PostgreSQL SHALL 使用 pgvector 扩展支持向量搜索
2. THE PostgreSQL SHALL 使用 FTS (全文搜索) 支持文本检索
3. THE Blinko_Server SHALL 使用 Prisma ORM 访问数据库
4. WHEN 部署时 THEN PostgreSQL SHALL 自动初始化 pgvector 扩展
5. THE PostgreSQL SHALL 配置健康检查确保服务可用

### Requirement 3: Blinko 后端服务

**User Story:** As a 用户, I want 稳定的后端 API, so that 我可以正常使用所有功能。

#### Acceptance Criteria

1. THE Blinko_Server SHALL 运行在端口 1111
2. THE Blinko_Server SHALL 通过 tRPC 提供 API
3. THE Blinko_Server SHALL 集成 Mastra AI 服务
4. WHEN Blinko_Server 启动 THEN 它 SHALL 等待 PostgreSQL 健康检查通过
5. THE Blinko_Server SHALL 提供健康检查端点 `/api/health`

### Requirement 4: Janitor 文件整理服务

**User Story:** As a 用户, I want 自动整理混乱的文件, so that 我的文件夹保持有序。

#### Acceptance Criteria

1. THE Janitor_Service SHALL 运行在端口 8766 (开发环境) 或 8000 (生产环境)
2. THE Janitor_Service SHALL 监听配置的 inbox 文件夹
3. THE Janitor_Service SHALL 调用 Groq API 进行 AI 分类
4. WHEN 文件被放入 inbox THEN Janitor_Service SHALL 自动分类和重命名
5. THE Janitor_Service SHALL 提供健康检查端点 `/health`
6. THE Janitor_Service SHALL 支持通过 YAML 配置分类规则

### Requirement 5: Paperless 文档管理服务 (可选)

**User Story:** As a 用户, I want 管理和搜索文档, so that 我可以快速找到需要的文件。

#### Acceptance Criteria

1. THE Paperless_Service SHALL 运行在端口 8000
2. THE Paperless_Service SHALL 支持 OCR 文字识别
3. THE Paperless_Service SHALL 支持标签和类型管理
4. WHEN 文档上传 THEN Paperless_Service SHALL 自动 OCR 并索引
5. THE Paperless_Service SHALL 提供 REST API 供 Blinko 调用

### Requirement 6: 生产环境部署 (Docker Compose)

**User Story:** As a 运维人员, I want 简单的生产部署方式, so that 我可以快速上线服务。

#### Acceptance Criteria

1. THE Echo_System SHALL 通过 `docker-compose.yml` 部署生产环境
2. THE Echo_System SHALL 提供 `start.sh` 脚本简化生产环境管理
3. WHEN 执行 `./start.sh` THEN 所有服务 SHALL 自动启动
4. THE Echo_System SHALL 支持通过 `.env` 文件配置环境变量
5. THE Echo_System SHALL 提供 `.env.example` 作为配置模板

### Requirement 7: 桌面端分发 (Tauri)

**User Story:** As a 桌面用户, I want 下载安装 Echo 桌面应用, so that 我可以获得原生体验。

#### Acceptance Criteria

1. THE Tauri_App SHALL 通过 GitHub Releases 分发安装包
2. THE Tauri_App SHALL 支持 macOS (dmg/pkg) 分发
3. THE Tauri_App SHALL 支持 Windows (msi/exe) 分发
4. THE Tauri_App SHALL 支持 Linux (AppImage/deb) 分发
5. WHEN 用户启动桌面应用 THEN Tauri_App SHALL 连接到配置的后端服务器
6. THE Tauri_App SHALL 支持自动更新（通过 Tauri Updater）

### Requirement 8: 自托管支持

**User Story:** As a 高级用户, I want 在自己的服务器上运行 Echo, so that 我可以完全控制数据。

#### Acceptance Criteria

1. THE Echo_System SHALL 支持在 NAS/家庭服务器上自托管
2. THE Echo_System SHALL 提供详细的自托管文档
3. THE Echo_System SHALL 支持自定义数据存储路径
4. WHEN 自托管时 THEN 用户 SHALL 能够配置所有服务的端口和路径
