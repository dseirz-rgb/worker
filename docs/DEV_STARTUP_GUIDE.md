# Echo 开发环境启动指南

> 最后更新: 2025-12-31

## 快速启动

```bash
# 一键启动所有服务
./dev.sh
```

## 服务访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 🌐 Blinko UI | http://localhost:1111 | 主界面 |
| 📚 SeekDB API | http://localhost:8765 | 向量搜索服务 |
| 🧹 Janitor API | http://localhost:8766 | AI 文件整理服务 |
| 🤖 Khoj AI | http://localhost:42110 | AI 知识助手（直接访问） |

> **注意**：Khoj 在 Blinko 内嵌页面 (`/khoj`) 存在 CORS 问题，建议直接访问 http://localhost:42110 使用完整功能。

## 环境要求

- Docker Desktop (已安装并运行)
- bun (安装路径: `~/.bun/bin/bun`)
- Node.js 18+

### bun 安装

如果 bun 未安装或找不到命令：

```bash
# 安装 bun
curl -fsSL https://bun.sh/install | bash

# 添加到 PATH (zsh)
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## 启动流程详解

### 1. Docker 服务

```bash
# 启动所有 Docker 服务
docker-compose -f docker-compose.dev.yml up -d

# 查看服务状态
docker-compose -f docker-compose.dev.yml ps
```

包含的服务：
- `blinko-postgres` - Blinko 数据库 (pgvector)
- `khoj-postgres` - Khoj 数据库 (pgvector)
- `seekdb` - SeekDB 向量数据库
- `seekdb-api` - SeekDB API 服务
- `janitor` - Janitor AI 整理服务
- `khoj` - Khoj AI 助手 (匿名模式)

### 2. Blinko 前端

```bash
cd get/blinko-main
bun install
bun run dev
```

## Khoj 配置说明

Khoj 已配置为匿名模式，无需登录即可使用。

关键配置 (`docker-compose.dev.yml`):
```yaml
khoj:
  environment:
    - KHOJ_ANONYMOUS_MODE=true
  command: --host="0.0.0.0" --port=42110 --non-interactive --anonymous-mode
```

### 配置 AI 模型

在 `.env` 文件中设置 API Key：

```bash
# Gemini (推荐)
GEMINI_API_KEY=your_gemini_api_key

# 或 OpenAI
OPENAI_API_KEY=your_openai_api_key

# 或本地 Ollama
OLLAMA_HOST=http://host.docker.internal:11434
```

## 常见问题

### bun: command not found

```bash
# 确保 PATH 包含 bun
export PATH="$HOME/.bun/bin:$PATH"

# 或重新加载 shell 配置
source ~/.zshrc
```

### Docker 服务启动失败

```bash
# 查看日志
docker-compose -f docker-compose.dev.yml logs -f [服务名]

# 重启单个服务
docker-compose -f docker-compose.dev.yml restart [服务名]

# 完全重建
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d --build
```

### Khoj 连接问题

1. 检查服务状态：
```bash
curl http://localhost:42110/api/health
```

2. 检查匿名模式：
```bash
curl http://localhost:42110/api/v1/user
# 应返回 default@example.com
```

3. 通过后端代理检查（推荐）：
```bash
curl "http://localhost:1111/api/trpc/khoj.getStatus"
# 应返回 {"result":{"data":{"success":true,...}}}
```

#### 已知问题：Blinko 内嵌 Khoj 页面 CORS 错误

**问题描述**：在 Blinko 的 `/khoj` 页面中，浏览器从 `localhost:1111` 访问 `localhost:42110` 时会被 CORS 策略阻止。

**当前状态**：
- ✅ Khoj 服务本身运行正常
- ✅ 后端代理 (`/api/trpc/khoj.getStatus`) 工作正常
- ❌ 前端直接访问 Khoj API 被 CORS 阻止
- ❌ iframe 嵌入 Khoj 界面可能受限

**临时解决方案**：
- 直接访问 Khoj 原生界面：http://localhost:42110
- Khoj 原生界面功能完整，但不支持中文

**技术说明**：
- 前端健康检查已改为优先使用后端代理
- 但 iframe 嵌入和部分 API 调用仍需跨域访问
- 完整解决需要配置 Khoj 的 CORS 或使用反向代理

### Tauri 桌面应用空白问题

**问题描述**：Blinko Tauri 桌面应用窗口显示空白，点击无反应。

**解决方案**：删除窗口状态缓存文件后重启应用：

```bash
rm -f ~/Library/Application\ Support/com.blinko.app/window_state.json
```

然后重新打开 Blinko 桌面应用。

### SeekDB 启动慢

SeekDB 首次启动需要 2-3 分钟初始化，请耐心等待。

## 停止服务

```bash
# 停止所有 Docker 服务
docker-compose -f docker-compose.dev.yml down

# 停止 Blinko 前端
# 在运行 bun run dev 的终端按 Ctrl+C
```

## 数据持久化

所有数据存储在 Docker volumes 中：

| Volume | 说明 |
|--------|------|
| `echo_blinko_postgres_data` | Blinko 数据库 |
| `echo_khoj_postgres_data` | Khoj 数据库 |
| `echo_khoj_data` | Khoj 配置和索引 |
| `echo_seekdb_data` | SeekDB 数据 |

清理数据：
```bash
docker-compose -f docker-compose.dev.yml down -v
```
