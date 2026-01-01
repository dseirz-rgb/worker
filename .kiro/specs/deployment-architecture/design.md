# Design Document: Echo 部署架构 v4.0

## Overview

本文档定义 Echo 项目的云端 + 多端分发架构，采用经济高效的混合方案。

> 版本: v4.0 (云端 + 多端分发)
> 最后更新: 2026-01-01

### 核心设计原则

1. **经济优先** - 使用免费层和学生额度，最小化成本
2. **多端覆盖** - Web、macOS、Windows、iOS 全平台支持
3. **功能分层** - 桌面端含文件整理，移动端仅核心功能
4. **容器化** - 后端服务通过 Docker 部署

## Architecture

### 整体架构图

```mermaid
graph TB
    subgraph "客户端层"
        WebUI[🌐 Web UI<br/>Vercel]
        MacApp[🍎 macOS App<br/>Tauri + Janitor]
        WinApp[🪟 Windows App<br/>Tauri + Janitor]
        iOSApp[📱 iOS App<br/>Tauri (无 Janitor)]
    end
    
    subgraph "云端服务 (GCP + Supabase)"
        CloudRun[☁️ GCP Cloud Run<br/>Blinko Server<br/>Node.js + tRPC]
        Supabase[(🗄️ Supabase<br/>PostgreSQL + pgvector)]
    end
    
    subgraph "桌面端本地服务"
        Janitor[🧹 Janitor Sidecar<br/>Python + Groq API]
        LocalFiles[� P本地文件系统]
    end
    
    subgraph "外部服务"
        Groq[☁️ Groq API<br/>AI 分类]
        Vercel[▲ Vercel<br/>前端托管]
    end
    
    WebUI --> CloudRun
    MacApp --> CloudRun
    WinApp --> CloudRun
    iOSApp --> CloudRun
    
    CloudRun --> Supabase
    
    MacApp --> Janitor
    WinApp --> Janitor
    Janitor --> LocalFiles
    Janitor --> Groq
```

### 服务职责划分

| 服务 | 部署位置 | 职责 | 费用 |
|------|----------|------|------|
| Vercel | 云端 | 前端托管、CDN | 免费 |
| Cloud Run | GCP | 后端 API、业务逻辑 | 学生额度 |
| Supabase | 云端 | PostgreSQL + pgvector | 免费层 |
| Janitor | 桌面本地 | 文件整理、AI 分类 | - |

### 平台功能矩阵

| 功能 | Web | macOS | Windows | iOS |
|------|-----|-------|---------|-----|
| 笔记管理 | ✅ | ✅ | ✅ | ✅ |
| AI 对话 | ✅ | ✅ | ✅ | ✅ |
| 向量搜索 | ✅ | ✅ | ✅ | ✅ |
| 文件整理 (Janitor) | ❌ | ✅ | ✅ | ❌ |
| 本地文件访问 | ❌ | ✅ | ✅ | ❌ |

## Components and Interfaces

### 1. 云端部署结构

```
云端服务/
├── Vercel (前端)
│   ├── 自动部署 (GitHub 集成)
│   ├── 环境变量配置
│   └── API 代理 → Cloud Run
│
├── GCP Cloud Run (后端)
│   ├── Blinko Server 容器
│   ├── 自动扩缩容 (0-2 实例)
│   └── 连接 Supabase
│
└── Supabase (数据库)
    ├── PostgreSQL 15
    ├── pgvector 扩展
    └── Row Level Security
```

### 2. 桌面端结构

```
Tauri App/
├── 前端 (WebView)
│   └── 加载云端或本地 Web UI
│
├── Rust 后端
│   ├── 系统 API 调用
│   ├── Sidecar 管理
│   └── 自动更新
│
└── Sidecar (仅桌面端)
    └── Janitor (Python 打包)
        ├── 文件监听
        ├── AI 分类
        └── 重命名
```

### 3. 部署配置文件

```
项目根目录/
├── vercel.json                 # Vercel 配置
├── cloudbuild.yaml             # GCP Cloud Build 配置
├── Dockerfile.cloudrun         # Cloud Run 镜像
├── .env.production             # 生产环境变量
├── deploy.sh                   # 部署脚本
│
├── docker-compose.dev.yml      # 本地开发环境
├── dev.sh                      # 开发启动脚本
│
└── src-tauri/
    ├── tauri.conf.json         # Tauri 配置
    ├── Cargo.toml              # Rust 依赖
    └── binaries/               # Sidecar 二进制
        ├── janitor-aarch64-apple-darwin
        ├── janitor-x86_64-apple-darwin
        └── janitor-x86_64-pc-windows-msvc.exe
```

## Data Models

### 环境变量配置

**Vercel 环境变量:**
```env
NEXT_PUBLIC_API_URL=https://echo-api-xxxxx.run.app
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
```

**Cloud Run 环境变量:**
```env
DATABASE_URL=postgresql://postgres:xxx@db.xxxxx.supabase.co:5432/postgres
NEXTAUTH_SECRET=xxxxx
GROQ_API_KEY=xxxxx
```

**本地开发环境变量 (.env):**
```env
# 数据库
DATABASE_URL=postgresql://postgres:mysecretpassword@localhost:5432/blinko

# API Keys
GROQ_API_KEY=your_groq_api_key

# 服务 URL
JANITOR_API_URL=http://localhost:8766
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: 云端服务可用性

*For any* 用户请求，Cloud Run 服务应在 10 秒内响应（包括冷启动）。

**Validates: Requirements 2.4, 2.5**

### Property 2: 数据库连接稳定性

*For any* 数据库操作，Supabase 连接应使用连接池，避免连接耗尽。

**Validates: Requirements 3.4**

### Property 3: 桌面端 Sidecar 隔离

*For any* 桌面应用启动，Janitor Sidecar 应独立运行，崩溃不影响主应用。

**Validates: Requirements 5.2, 6.5**

### Property 4: iOS 功能限制

*For any* iOS 应用实例，不应包含或尝试启动 Janitor 服务。

**Validates: Requirements 8.2**

## Error Handling

### 云端服务错误处理

| 错误场景 | 处理策略 |
|---------|---------|
| Cloud Run 冷启动超时 | 前端显示加载状态，重试 |
| Supabase 连接失败 | 显示错误提示，建议稍后重试 |
| API 请求超时 | 自动重试 3 次 |

### 桌面端错误处理

| 错误场景 | 处理策略 |
|---------|---------|
| Janitor Sidecar 启动失败 | 主应用继续运行，文件整理功能不可用 |
| Groq API 不可用 | Janitor 暂停分类，等待恢复 |
| 本地文件权限不足 | 提示用户授权 |

## Testing Strategy

### 单元测试

- 环境变量读取逻辑
- API 路由处理
- Sidecar 通信协议

### 集成测试

- Vercel → Cloud Run API 调用
- Cloud Run → Supabase 数据库操作
- Tauri → Janitor Sidecar 通信

### E2E 测试

- 完整的用户登录流程
- 笔记创建和搜索
- 桌面端文件整理流程

### 属性测试

使用 `fast-check` 进行属性测试：
- API 响应格式一致性
- 数据库查询结果正确性
- Sidecar 状态管理

