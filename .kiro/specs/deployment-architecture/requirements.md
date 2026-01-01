# Requirements Document

## Introduction

本文档定义 Echo 项目的多端部署架构需求，包括云端部署、本地开发环境、桌面端和移动端分发。

> 版本: v4.0 (云端 + 多端分发)
> 最后更新: 2026-01-01

## Glossary

- **Frontend**: React 前端应用（Blinko Web UI）
- **Backend**: Node.js 后端服务（Blinko Server + tRPC + Mastra AI）
- **Supabase**: 云端 PostgreSQL 数据库（含 pgvector 扩展）
- **Cloud_Run**: GCP 容器运行服务
- **Janitor_Service**: Python 文件整理服务（AI 分类、重命名）
- **Tauri_App**: 基于 Tauri 框架的跨平台桌面/移动应用
- **TestFlight**: Apple iOS 测试分发平台

## Requirements

### Requirement 1: 云端前端部署 (Vercel)

**User Story:** As a 用户, I want 通过网页访问 Echo, so that 我可以在任何设备上使用。

#### Acceptance Criteria

1. THE Frontend SHALL 部署在 Vercel 平台
2. THE Frontend SHALL 通过自定义域名访问
3. WHEN 代码推送到 main 分支 THEN Vercel SHALL 自动部署
4. THE Frontend SHALL 配置环境变量指向云端后端
5. THE Frontend SHALL 配置 API 代理规则

### Requirement 2: 云端后端部署 (GCP Cloud Run)

**User Story:** As a 用户, I want 稳定的云端后端服务, so that 我可以随时访问我的数据。

#### Acceptance Criteria

1. THE Blinko_Server SHALL 部署在 GCP Cloud Run
2. THE Blinko_Server SHALL 配置自动扩缩容（最小 0，最大 2 实例）
3. THE Blinko_Server SHALL 连接 Supabase 数据库
4. WHEN 请求到达 THEN Cloud_Run SHALL 在 5 秒内冷启动
5. THE Blinko_Server SHALL 提供健康检查端点 `/api/health`

### Requirement 3: 云端数据库 (Supabase)

**User Story:** As a 用户, I want 可靠的数据存储, so that 我的笔记和文件不会丢失。

#### Acceptance Criteria

1. THE Supabase SHALL 提供 PostgreSQL 数据库
2. THE Supabase SHALL 启用 pgvector 扩展支持向量搜索
3. THE Supabase SHALL 使用免费层（500MB 存储）
4. WHEN 数据库连接时 THEN 应用 SHALL 使用连接池
5. THE Supabase SHALL 配置 Row Level Security (RLS)

### Requirement 4: 本地开发环境 (Docker Compose)

**User Story:** As a 开发者, I want 一键启动所有服务, so that 我可以快速开始开发和测试。

#### Acceptance Criteria

1. THE Echo_System SHALL 通过 `docker-compose.dev.yml` 一键启动所有服务
2. THE Echo_System SHALL 提供 `dev.sh` 脚本简化开发环境管理
3. WHEN 执行 `./dev.sh` THEN 所有后端服务 SHALL 自动启动并健康检查
4. THE Echo_System SHALL 支持 `./dev.sh status` 查看所有服务状态
5. THE Echo_System SHALL 支持本地 PostgreSQL + pgvector

### Requirement 5: Janitor 文件整理服务

**User Story:** As a 用户, I want 自动整理混乱的文件, so that 我的文件夹保持有序。

#### Acceptance Criteria

1. THE Janitor_Service SHALL 仅在桌面端（macOS/Windows）运行
2. THE Janitor_Service SHALL 作为 Tauri Sidecar 打包
3. THE Janitor_Service SHALL 监听配置的 inbox 文件夹
4. THE Janitor_Service SHALL 调用 Groq API 进行 AI 分类
5. WHEN 文件被放入 inbox THEN Janitor_Service SHALL 自动分类和重命名
6. THE Janitor_Service SHALL 提供健康检查端点 `/health`

### Requirement 6: macOS 桌面端分发

**User Story:** As a macOS 用户, I want 下载安装 Echo 桌面应用, so that 我可以获得原生体验和文件整理功能。

#### Acceptance Criteria

1. THE Tauri_App SHALL 通过 GitHub Releases 分发 macOS 安装包
2. THE Tauri_App SHALL 支持 dmg 格式分发
3. THE Tauri_App SHALL 支持 Apple Silicon (arm64)
4. THE Tauri_App SHALL 包含 Janitor Sidecar
5. WHEN 用户启动桌面应用 THEN Tauri_App SHALL 自动启动 Janitor 服务
6. THE Tauri_App SHALL 支持自动更新（通过 Tauri Updater）

### Requirement 7: Windows 桌面端分发

**User Story:** As a Windows 用户, I want 下载安装 Echo 桌面应用, so that 我可以获得原生体验和文件整理功能。

#### Acceptance Criteria

1. THE Tauri_App SHALL 通过 GitHub Releases 分发 Windows 安装包
2. THE Tauri_App SHALL 支持 msi 和 exe 格式分发
3. THE Tauri_App SHALL 支持 x64 架构
4. THE Tauri_App SHALL 包含 Janitor Sidecar
5. WHEN 用户启动桌面应用 THEN Tauri_App SHALL 自动启动 Janitor 服务

### Requirement 8: iOS TestFlight 分发

**User Story:** As a iOS 用户, I want 通过 TestFlight 安装 Echo, so that 我可以在手机上使用。

#### Acceptance Criteria

1. THE Tauri_App SHALL 通过 TestFlight 分发 iOS 版本
2. THE iOS_App SHALL 不包含 Janitor 文件整理服务
3. THE iOS_App SHALL 连接云端后端服务
4. THE iOS_App SHALL 支持 iPhone 和 iPad
5. WHEN 用户打开应用 THEN iOS_App SHALL 显示登录/配置界面

### Requirement 9: 生产环境部署脚本

**User Story:** As a 运维人员, I want 简单的部署方式, so that 我可以快速上线服务。

#### Acceptance Criteria

1. THE Echo_System SHALL 提供 `deploy.sh` 脚本部署云端服务
2. THE Echo_System SHALL 支持通过 `.env.production` 配置生产环境变量
3. WHEN 执行部署脚本 THEN 系统 SHALL 自动构建并推送 Docker 镜像
4. THE Echo_System SHALL 提供部署状态检查命令

