# Echo 使用指南

## 一键启动

```bash
# 首次使用：配置环境变量
cp .env.example .env
# 编辑 .env，填入 GROQ_API_KEY（从 https://console.groq.com/ 免费获取）

# 启动所有服务
./start.sh
```

启动后访问 http://localhost:1111 即可使用。

## 常用命令

```bash
./start.sh          # 启动服务
./start.sh stop     # 停止服务
./start.sh status   # 查看状态
./start.sh logs     # 查看日志
./start.sh restart  # 重启服务
```

## 功能使用

### 文件管理

1. 侧边栏点击「文件」
2. 上传、搜索、预览文档
3. 使用标签分类管理

### AI 文件整理

1. 将文件放入 `inbox` 目录
2. 在文件页面点击「AI 整理」
3. 查看 AI 建议，确认执行
4. 文件自动分类并索引

### 撤销操作

在「整理历史」中可以撤销任何整理操作。

## 配置说明

编辑 `.env` 文件：

| 变量 | 说明 | 必填 |
|------|------|------|
| `GROQ_API_KEY` | Groq API 密钥 | ✅ |
| `DATABASE_URL` | 数据库连接 | ✅ |
| `INBOX_PATH` | 待整理目录 | 可选 |

## 故障排除

```bash
# 查看服务状态
./start.sh status

# 查看详细日志
./start.sh logs

# 重启服务
./start.sh restart
```
