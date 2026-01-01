# 项目交接文档

> 最后更新: 2026-01-01

## 当前状态

项目已完成核心功能开发，进入稳定维护阶段。

## 已完成功能

### EchoAI 核心 ✅
- AI 对话界面、智能建议、每日报告
- 语义搜索、引用面板、思考过程
- 研究模式、斜杠命令、语音输入
- 文件上传、消息反馈、TTS

### 文档管理 ✅
- 文件上传和预览
- 全文搜索 (PostgreSQL FTS)
- 文档元数据管理、OCR 处理

### AI 服务统一 ✅
- Agent 管理、自动化任务
- 服务路由、功能开关

### 导航重构 ✅
- 新导航结构、工具箱折叠

## 活跃的 Spec 文档

| Spec | 状态 | 说明 |
|------|------|------|
| `echo-janitor/` | 🚧 进行中 | 文件整理服务，待完善 Docker 配置 |
| `deployment-architecture/` | 📋 待开始 | 多端部署架构 |

## 已归档的 Spec

位于 `.kiro/specs/_archived/`:
- auth-architecture (完成)
- ai-service-unification (完成)
- echo-ai (完成)
- echo-v3.2-completion (完成)
- file-management (完成)
- navigation-restructure (完成)
- khoj-cleanup (完成)
- khoj-deep-integration (废弃)
- seekdb-* (废弃)
- echo-on-blinko (完成)
- echo-v3-enhancements (完成)
- role-select-homepage (废弃)
- paperless-frontend-integration (完成)

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
| Blinko 前端/后端 | 1111 |
| Janitor | 8765 |
| PostgreSQL | 5432 |

## 下一步建议

1. 完善 Janitor Docker 配置
2. 实现多端部署架构
3. 优化向量搜索性能

## 注意事项

- 主要开发在 `get/blinko-main/` 目录
- 不要修改 `get/khoj-main/` (仅参考)
- 数据库 Schema 在 `prisma/schema.prisma`
