# Khoj 清理计划

## 概述

Khoj AI 功能已整合到 Blinko 内部 (Mastra)，需要清理遗留的 Khoj 外部服务依赖。

## 已完成

### 后端清理 ✅

1. **删除的文件**:
   - `get/blinko-main/server/lib/khojClient.ts` - Khoj API 客户端
   - `get/blinko-main/server/routerTrpc/khoj.ts` - Khoj tRPC 路由
   - `get/blinko-main/server/routerExpress/khoj.ts` - Khoj Express 路由
   - `docker-compose.khoj.yml` - Khoj Docker 配置
   - `scripts/start-khoj.sh` - Khoj 启动脚本

2. **更新的文件**:
   - `get/blinko-main/server/routerTrpc/_app.ts` - 移除 khojRouter
   - `get/blinko-main/server/index.ts` - 移除 khoj Express 路由
   - `get/blinko-main/server/lib/serviceRegistry.ts` - 移除 Khoj 服务配置
   - `get/blinko-main/server/aiServer/serviceRouter.ts` - 移除 Khoj 降级逻辑
   - `docker-compose.dev.yml` - 移除 Khoj 服务和数据卷

### 前端迁移 ✅

1. **更新的页面**:
   - `echoai.tsx` - 移除 Khoj 状态检查，Mastra 始终可用
   - `echoai-home.tsx` - 使用 `api.agent.getAgents` 替代 `api.khoj.getAgents`
   - `echoai-search.tsx` - 使用 `api.research.quickResearch` 替代 `api.khoj.search`

2. **更新的组件**:
   - `ChatPage.tsx` - 使用新的 Mastra Agent API
   - `chatMessage.tsx` - 更新 `isKhoj` 为 `isAI`，支持多种 AI 标识
   - `index.ts` - 添加类型别名 `EchoAgent`, `EchoAutomation`

3. **更新的 Hooks**:
   - `useEchoAIChat.ts` - 使用本地对话管理 + Mastra Agent API

4. **API 映射**:
   ```typescript
   // 旧 API → 新 API
   api.khoj.getStatus.query()        → 移除 (Mastra 始终可用)
   api.khoj.getAgents.query()        → api.agent.getAgents.query()
   api.khoj.search.query()           → api.research.quickResearch.mutate()
   api.khoj.createConversation       → 本地生成 conversationId
   api.khoj.getConversations         → localStorage 管理
   api.khoj.deleteConversation       → localStorage 删除
   ```

## 待完成

### 类型清理 (可选)

旧的 `KhojAgent` 和 `KhojAutomation` 类型仍保留在组件中，已添加别名导出：
- `KhojAgent` → `EchoAgent`
- `KhojAutomation` → `EchoAutomation`

如需完全清理，可以：
1. 更新 `agentCard/AgentCard.tsx` 中的类型名
2. 更新 `automationCard/AutomationCard.tsx` 中的类型名

### 服务文件清理 (可选)

`echoaiService.ts` 中仍有 Khoj 相关的兼容性导出，可以在确认无引用后删除。

## 迁移总结

| 任务 | 状态 |
|------|------|
| 后端清理 | ✅ 已完成 |
| 前端迁移 | ✅ 已完成 |
| 类型清理 | ⏳ 可选 |
| 服务文件清理 | ⏳ 可选 |

## 注意事项

1. **不要删除 `get/khoj-main/`** - 这是 Khoj 的源代码参考，不是项目依赖
2. **保留注释中的 Khoj 引用** - 作为历史记录和来源说明
3. **对话数据存储在 localStorage** - 迁移后对话历史存储在浏览器本地
