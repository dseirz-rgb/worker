# Echo

AI 驱动的个人知识管理系统，基于 [Blinko](https://github.com/blinko-space/blinko) 扩展开发。

## ✨ 功能特性

- 🤖 **EchoAI 助手** - 智能对话、内容建议、每日报告
- 📚 **文档管理** - 上传、预览、全文搜索
- 🧹 **AI 整理** - 自动分类和重命名文件
- 🔍 **混合搜索** - 向量 + 全文搜索
- ↩️ **撤销功能** - 随时回滚整理操作

## 🚀 快速开始

### 生产模式（Docker）

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 API Key

# 2. 启动服务
./start.sh

# 3. 访问
open http://localhost:1111
```

### 开发模式

```bash
# 1. 配置环境变量
cp .env.example .env
cp echo/sidecar/janitor/.env.example echo/sidecar/janitor/.env

# 2. 启动开发服务
./dev.sh

# 3. 访问
open http://localhost:1111
```

## 📁 项目结构

```
worker/
├── echo/                 # Echo 核心服务
│   ├── sidecar/          # Python 后端
│   └── docs/             # 文档
├── get/blinko-main/      # 主开发区（Blinko 扩展）
│   ├── app/              # 前端 React
│   ├── server/           # 后端 Node.js
│   └── prisma/           # 数据库
└── .kiro/specs/          # 功能规格
```

详细结构见 [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19, TypeScript, Tailwind CSS, MobX |
| 后端 | Node.js, Express, tRPC, Prisma |
| 数据库 | PostgreSQL |
| AI | 豆包 API, Ollama |

## 📖 文档

- [项目结构](PROJECT_STRUCTURE.md)
- [使用指南](echo/docs/USER_GUIDE.md)
- [开发指南](echo/docs/DEV_STARTUP_GUIDE.md)
- [架构设计](echo/docs/VISION_AND_ARCHITECTURE.md)

## 📋 系统要求

- Docker & Docker Compose
- AI API Key（豆包/OpenAI/Groq）
- 开发模式：bun、Python 3.11+

## 📄 许可证

MIT
