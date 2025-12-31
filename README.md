# Echo

AI 驱动的个人知识管理系统。

## 功能

- 📚 **文档索引** - 全文搜索，支持多种文件格式
- 🧹 **AI 整理** - 自动分类和重命名文件
- 🔍 **智能搜索** - 向量 + 全文混合搜索
- ↩️ **撤销功能** - 随时回滚整理操作

## 快速开始

### 生产模式（Docker）

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 GROQ_API_KEY

# 2. 启动服务
./start.sh

# 3. 访问
open http://localhost:1111
```

### 开发模式（本地）

```bash
# 1. 配置 Janitor 环境变量
cp echo/sidecar/janitor/.env.example echo/sidecar/janitor/.env
# 编辑 .env，填入 GROQ_API_KEY

# 2. 启动开发服务
./dev.sh

# 3. 停止服务
./dev.sh stop
```

## 系统要求

- Docker & Docker Compose
- Groq API Key（[免费获取](https://console.groq.com/)）
- 开发模式额外需要：bun、Python 3.11+

## 文档

- [使用指南](echo/docs/DAILY_USAGE.md)
- [架构设计](echo/docs/ECHO_DEV_PLAN_V2.md)

## 许可证

MIT
