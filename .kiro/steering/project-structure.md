# 项目结构规范

## Monorepo 架构

```
echoai/
├── packages/           # 前端模块
│   ├── echo/           # Echo 前端 (React, Bun)
│   ├── riskcontrol/    # RiskControl 前端 (React, npm)
│   └── shared/         # 共享代码 (类型、工具)
│
├── services/           # 后端服务
│   ├── echo-server/    # Echo 后端 (Express + tRPC)
│   ├── rc-api/         # RiskControl API (Vercel Functions)
│   ├── lightrag/       # RAG 知识库 (Python)
│   ├── voice-agent/    # 语音助手 (Python + LiveKit)
│   ├── janitor/        # 文件整理 (Python)
│   └── workers/        # Cloudflare Workers
│
├── infra/              # 基础设施配置
│   ├── docker/         # Docker 配置
│   ├── prisma/         # 数据库 schema
│   └── deploy/         # 部署脚本
│
├── docs/               # 项目文档
├── scripts/            # 工具脚本
└── .kiro/              # Kiro 配置
```

## 代码放置规则

### 前端代码 → packages/
- React 组件、页面、hooks
- 状态管理 (Zustand/MobX)
- UI 组件库
- Tauri 移动端配置

### 后端代码 → services/
- API 端点 (Express, Vercel Functions)
- Python 服务 (FastAPI, LiveKit)
- Cloudflare Workers
- 定时任务、后台作业

### 共享代码 → packages/shared/
- TypeScript 类型定义
- 工具函数
- 常量配置
- 验证 schema (Zod)

### 基础设施 → infra/
- Docker 配置
- 数据库 schema (Prisma/Drizzle)
- 部署脚本
- CI/CD 配置

## 待迁移项目

### Blinko (Echo 基础)

| 源路径 | 目标路径 | 说明 |
|--------|----------|------|
| `vendor/blinko-main/app/` | `packages/echo/` | 前端代码 |
| `vendor/blinko-main/server/` | `services/echo-server/` | 后端代码 |
| `vendor/blinko-main/shared/` | `packages/shared/echo/` | 共享类型 |
| `vendor/blinko-main/prisma/` | `infra/prisma/` | 数据库 schema |
| `echo/sidecar/` | `services/janitor/` | 文件整理服务 |
| `echo/docker/` | `infra/docker/` | Docker 配置 |

### RiskControl

| 源路径 | 目标路径 | 说明 |
|--------|----------|------|
| `riskcontrol/client/` | `packages/riskcontrol/` | 前端代码 |
| `riskcontrol/api/` | `services/rc-api/` | Vercel Functions |
| `riskcontrol/shared/` | `packages/shared/riskcontrol/` | 共享类型 |
| `riskcontrol/workers/` | `services/workers/` | Cloudflare Workers |
| `riskcontrol/drizzle/` | `infra/drizzle/` | 数据库 schema |
| `riskcontrol/lightrag-service/` | `services/lightrag/` | RAG 服务 |
| `riskcontrol/livekit-voice-service/` | `services/voice-agent/` | 语音服务 |

## 当前状态（软链接过渡）

整合期间使用软链接保持兼容：
- `packages/echo` → `vendor/blinko-main` (整体链接，待拆分)
- `packages/riskcontrol` → `riskcontrol` (整体链接，待拆分)
- `services/lightrag` → `riskcontrol/lightrag-service`
- `services/voice-agent` → `riskcontrol/livekit-voice-service`

## 包管理器

- **packages/echo**: Bun
- **packages/riskcontrol**: npm
- **services/echo-server**: Bun
- **services/rc-api**: npm
- **services/* (Python)**: pip + venv
- **根目录**: npm (workspace)

## 迁移原则

1. **渐进式迁移** - 先用软链接，逐步拆分
2. **保持可运行** - 每次迁移后确保项目可运行
3. **前后端分离** - 前端 packages/，后端 services/
4. **共享代码集中** - 类型和工具放 packages/shared/
