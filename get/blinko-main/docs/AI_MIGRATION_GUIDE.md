# AI 服务迁移指南

> 从 Khoj 迁移到 Mastra 的完整指南

## 概述

Echo on Blinko 正在将 AI 能力从 Khoj (Python) 迁移到 Mastra (TypeScript)。本指南帮助自托管用户完成迁移。

## 迁移时间线

| 阶段 | 状态 | 说明 |
|------|------|------|
| 阶段 1: 并行运行 | ✅ 当前 | Mastra 和 Khoj 同时运行，可通过 Feature Flag 切换 |
| 阶段 2: Mastra 优先 | 🔜 计划中 | Mastra 为默认，Khoj 作为降级方案 |
| 阶段 3: 完全迁移 | 📅 未来 | 移除 Khoj 依赖 |

## 功能对照表

| 功能 | Khoj | Mastra | 状态 |
|------|------|--------|------|
| 基础对话 | ✅ | ✅ | 已迁移 |
| RAG 搜索 | ✅ | ✅ | 已迁移 |
| 多轮研究 | ✅ | ✅ | 已迁移 |
| Agent 管理 | ✅ | ✅ | 已迁移 |
| 自动化任务 | ✅ | ✅ | 已迁移 |
| 网络搜索 | ✅ | ✅ | 已迁移 (Tavily) |
| 文档索引 | ✅ | ⏳ | 使用 PostgreSQL FTS |

## 迁移步骤

### 1. 更新数据库

```bash
cd get/blinko-main

# 生成 Prisma 客户端
npx prisma generate

# 应用迁移
npx prisma migrate deploy
```

### 2. 备份 Khoj 数据

```bash
# 仅备份，不迁移
npx ts-node scripts/migrate-khoj-data.ts --backup-only
```

备份文件保存在 `backups/khoj-migration/` 目录。

### 3. 执行数据迁移

```bash
# 试运行（不实际写入）
npx ts-node scripts/migrate-khoj-data.ts --dry-run

# 正式迁移
npx ts-node scripts/migrate-khoj-data.ts
```

### 4. 配置 Feature Flags

通过设置页面或 API 配置功能开关：

| Flag | 说明 | 默认值 |
|------|------|--------|
| `use_mastra_research` | 使用 Mastra Research Agent | `false` |
| `use_mastra_agents` | 使用 Mastra Agent 系统 | `true` |
| `use_mastra_automation` | 使用 Mastra 自动化系统 | `true` |
| `khoj_fallback_enabled` | 启用 Khoj 降级回退 | `true` |

### 5. 验证迁移

1. 检查对话历史是否完整
2. 测试 Agent 功能
3. 验证自动化任务运行

### 6. (可选) 禁用 Khoj

确认迁移成功后，可以禁用 Khoj 服务：

```bash
# 停止 Khoj 容器
docker-compose stop khoj

# 或在 docker-compose.yml 中注释掉 khoj 服务
```

## 回滚

如果迁移出现问题：

```bash
# 回滚迁移
npx ts-node scripts/migrate-khoj-data.ts --rollback

# 重新启用 Khoj
docker-compose up -d khoj
```

## 常见问题

### Q: 迁移后对话历史丢失？

A: 检查备份文件是否存在，使用 `--rollback` 恢复后重新迁移。

### Q: Agent 工具不工作？

A: Khoj 和 Mastra 的工具名称不同，迁移脚本会自动映射：
- `online` → `webSearch`
- `notes` → `searchNotes`
- `webpage` → `readWebpage`

### Q: 自动化任务没有执行？

A: 检查 cron 表达式是否正确，确认 `isEnabled` 为 `true`。

### Q: 如何完全移除 Khoj？

A: 等待阶段 3 完成后，我们会提供完整的移除指南。目前建议保留 Khoj 作为降级方案。

## 技术支持

- GitHub Issues: [项目地址]
- 文档: [文档地址]

## 相关文件

- 迁移脚本: `scripts/migrate-khoj-data.ts`
- Feature Flag 路由: `server/routerTrpc/featureFlag.ts`
- 服务路由器: `server/aiServer/serviceRouter.ts`
- 数据库迁移: `prisma/migrations/20260101000000_ai_service_unification/`
