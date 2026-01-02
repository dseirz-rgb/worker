# Echo 项目结构

> 本文档帮助 AI 快速理解项目结构，提高协作效率。

## 项目概述

Echo 是一个 AI 驱动的个人知识管理系统，基于 Blinko 开源项目扩展开发。

## 目录结构

```
worker/
├── .kiro/                    # Kiro IDE 配置
│   ├── settings/             # MCP 服务器配置
│   ├── specs/                # 功能规格文档（当前活跃）
│   │   ├── realtime-voice-assistant/  # 实时语音助手
│   │   └── _archived/        # 已完成/废弃的规格
│   ├── steering/             # AI 协作指南
│   └── skills/               # 自定义技能
│
├── get/blinko-main/          # 🎯 主开发区（Blinko 扩展）
│   ├── app/                  # 前端 React 应用
│   │   └── src/
│   │       ├── components/   # UI 组件
│   │       ├── hooks/        # React Hooks
│   │       ├── lib/          # 工具函数
│   │       ├── pages/        # 页面组件
│   │       └── store/        # 状态管理
│   ├── server/               # 后端 Node.js 服务
│   │   ├── aiServer/         # AI 服务模块
│   │   ├── voiceAgent/       # 语音助手 Python 服务
│   │   ├── jobs/             # 后台任务
│   │   ├── lib/              # 服务层
│   │   └── routerTrpc/       # tRPC API 路由
│   └── prisma/               # 数据库 Schema
│
├── echo/                     # Echo 辅助服务
│   ├── docker/               # Docker 配置
│   ├── docs/                 # 项目文档
│   └── sidecar/              # Python 后端服务
│       └── janitor/          # 文件整理服务
│
├── scripts/                  # 工具脚本
└── inbox/                    # 待处理文件
```

## 核心模块

### 前端 (get/blinko-main/app/src)

| 目录 | 说明 |
|------|------|
| `components/echoai/` | EchoAI 聊天组件 |
| `components/VoiceAssistant/` | 语音助手组件 |
| `components/Files/` | 文档管理组件 |
| `pages/` | 页面路由 |
| `store/` | MobX 状态管理 |

### 后端 (get/blinko-main/server)

| 目录 | 说明 |
|------|------|
| `aiServer/` | AI 服务（Agent、建议、日报） |
| `voiceAgent/` | 语音助手 Python 服务 |
| `jobs/` | 定时任务 |
| `routerTrpc/` | tRPC API |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19, TypeScript, Tailwind CSS, MobX |
| 后端 | Node.js, Express, tRPC, Prisma |
| 数据库 | PostgreSQL |
| AI | 豆包 API, LiveKit (语音) |

## 开发命令

```bash
# 启动开发环境
./dev.sh

# 前端开发
cd get/blinko-main && bun run dev

# 数据库迁移
cd get/blinko-main && bun run prisma:migrate
```

## 注意事项

1. **主要开发区** 在 `get/blinko-main/`
2. **不要修改** `get/khoj-main/` - 仅作参考
3. **环境变量** 配置在根目录 `.env` 和 `get/blinko-main/.env`
