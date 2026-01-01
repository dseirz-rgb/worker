# 项目交接文档

> 最后更新: 2026-01-01

## 当前状态

项目已完成 Khoj/Paperless/SeekDB 相关代码的清理，专注于 EchoAI 核心功能。

## 已完成功能

### EchoAI 核心
- ✅ AI 对话界面 (`app/src/pages/echoai.tsx`)
- ✅ 智能建议引擎 (`server/aiServer/suggestionEngine.ts`)
- ✅ 每日报告生成 (`server/aiServer/reportGenerator.ts`)
- ✅ 服务路由统一 (`server/aiServer/serviceRouter.ts`)

### 文档管理
- ✅ 文件上传和预览 (`app/src/components/Files/`)
- ✅ 全文搜索 (PostgreSQL FTS)
- ✅ 文档元数据管理
- ✅ OCR 处理 (`server/lib/ocrService.ts`)

### 文件整理 (Janitor)
- ✅ AI 分类和重命名
- ✅ 撤销功能
- ✅ 配置管理

## 进行中功能

### EchoAI 首页
- 🚧 `app/src/pages/echoai-home.tsx` - 需要完善 UI

### 向量搜索
- 🚧 ChromaDB 集成待完善

## 活跃的 Spec 文档

| Spec | 状态 | 说明 |
|------|------|------|
| `echo-ai/` | 进行中 | EchoAI 核心功能 |
| `file-management/` | 完成 | 文档管理系统 |
| `navigation-restructure/` | 进行中 | 导航重构 |
| `ai-service-unification/` | 完成 | AI 服务统一 |
| `echo-v3.2-completion/` | 进行中 | v3.2 功能完善 |

## 已归档的 Spec

位于 `.kiro/specs/_archived/`:
- khoj-cleanup (已完成)
- khoj-deep-integration (已废弃)
- seekdb-performance (已废弃)
- seekdb-removal (已完成)
- echo-on-blinko (已完成)
- echo-v3-enhancements (已完成)
- role-select-homepage (已废弃)

## 环境配置

### 必需的环境变量

```bash
# .env
DATABASE_URL=postgresql://...
DOUBAO_API_KEY=...  # 豆包 API
```

### 开发端口

| 服务 | 端口 |
|------|------|
| Blinko 前端 | 1111 |
| Blinko 后端 | 1111 |
| Janitor | 8765 |
| PostgreSQL | 5432 |

## 下一步建议

1. 完善 EchoAI 首页 UI
2. 优化向量搜索性能
3. 添加更多 AI 建议类型
4. 完善测试覆盖

## 注意事项

- 主要开发在 `get/blinko-main/` 目录
- 不要修改 `get/khoj-main/` (仅参考)
- 数据库 Schema 在 `prisma/schema.prisma`
- AI 服务配置在 `server/aiServer/`
