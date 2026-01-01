# Echo 项目结构

> 本文档帮助 AI 快速理解项目结构，提高协作效率。

## 项目概述

Echo 是一个 AI 驱动的个人知识管理系统，基于 Blinko 开源项目扩展开发。

## 目录结构

```
worker/
├── .kiro/                    # Kiro IDE 配置
│   ├── settings/             # MCP 服务器配置
│   ├── specs/                # 功能规格文档
│   └── steering/             # AI 协作指南
│
├── echo/                     # Echo 核心服务
│   ├── docker/               # Docker 配置
│   ├── docs/                 # 项目文档
│   ├── scripts/              # 启动脚本
│   └── sidecar/              # Python 后端服务
│       └── janitor/          # 文件整理服务
│
├── get/                      # 第三方源码（参考用）
│   └── blinko-main/          # Blinko 主项目（核心开发区）
│       ├── app/              # 前端 React 应用
│       │   └── src/
│       │       ├── components/   # UI 组件
│       │       ├── hooks/        # React Hooks
│       │       ├── lib/          # 工具函数
│       │       ├── pages/        # 页面组件
│       │       └── store/        # 状态管理
│       ├── server/           # 后端 Node.js 服务
│       │   ├── aiServer/     # AI 服务模块
│       │   ├── jobs/         # 后台任务
│       │   ├── lib/          # 服务层
│       │   └── routerTrpc/   # tRPC API 路由
│       └── prisma/           # 数据库 Schema
│
├── preview/                  # 预览文件
├── scripts/                  # 工具脚本
└── inbox/                    # 待处理文件
```

## 核心模块说明

### 1. 前端 (get/blinko-main/app)

| 目录 | 说明 |
|------|------|
| `src/pages/` | 页面路由组件 |
| `src/components/echoai/` | EchoAI 聊天组件 |
| `src/components/Files/` | 文档管理组件 |
| `src/components/Layout/` | 布局组件 |
| `src/hooks/` | 自定义 Hooks |
| `src/lib/` | 工具函数和服务 |
| `src/store/` | MobX 状态管理 |

### 2. 后端 (get/blinko-main/server)

| 目录 | 说明 |
|------|------|
| `aiServer/` | AI 服务（Agent、建议引擎、日报生成） |
| `jobs/` | 定时任务（归档、OCR、日报） |
| `lib/` | 服务层（文档、搜索、存储） |
| `routerTrpc/` | tRPC API 路由 |
| `routerExpress/` | Express API 路由 |

### 3. Python 服务 (echo/sidecar)

| 目录 | 说明 |
|------|------|
| `janitor/` | 文件整理服务（AI 分类、重命名） |
| `scripts/` | 数据处理脚本 |

## 技术栈

### 前端
- React 19 + TypeScript
- Tailwind CSS + HeroUI
- MobX 状态管理
- tRPC 客户端

### 后端
- Node.js + Express
- tRPC API
- Prisma ORM
- PostgreSQL

### AI 服务
- 豆包 API (Doubao)
- Ollama (本地模型)
- LangChain

## 开发指南

### 启动开发环境

```bash
# 1. 启动数据库和后端服务
./dev.sh

# 2. 前端开发（在 get/blinko-main 目录）
cd get/blinko-main
bun run dev
```

### 常用命令

```bash
# 数据库迁移
cd get/blinko-main && bun run prisma:migrate

# 运行测试
cd get/blinko-main && bun run test

# 构建
cd get/blinko-main && bun run build
```

## 功能模块状态

| 模块 | 状态 | 说明 |
|------|------|------|
| EchoAI 聊天 | ✅ 完成 | AI 对话、建议、日报 |
| 文档管理 | ✅ 完成 | 上传、预览、搜索 |
| 文件整理 | ✅ 完成 | AI 分类、重命名 |
| 全文搜索 | ✅ 完成 | PostgreSQL FTS |
| 向量搜索 | 🚧 进行中 | ChromaDB 集成 |

## 规格文档

功能规格文档位于 `.kiro/specs/` 目录：

| 规格 | 说明 |
|------|------|
| `echo-ai/` | EchoAI 核心功能 |
| `file-management/` | 文档管理系统 |
| `navigation-restructure/` | 导航重构 |
| `ai-service-unification/` | AI 服务统一 |

## 注意事项

1. **不要修改** `get/khoj-main/` - 仅作参考
2. **主要开发区** 在 `get/blinko-main/`
3. **环境变量** 配置在 `.env` 和 `get/blinko-main/.env`
4. **数据库** 使用 PostgreSQL，Schema 在 `prisma/schema.prisma`
