# Implementation Tasks - 统一 API 网关

## Task 1: 创建服务注册表 ✅

**Requirements:** 1.1, 1.2, 1.3, 1.4, 1.5

**Files to create/modify:**
- `get/blinko-main/server/lib/serviceRegistry.ts` (已创建)

**Implementation:**
1. ✅ 创建 `ServiceConfig` 和 `ServiceStatus` 接口
2. ✅ 实现 `ServiceRegistry` 类
3. ✅ 从环境变量初始化 Khoj、Janitor、Paperless、SeekDB 配置
4. ✅ 导出单例 `serviceRegistry`

**Acceptance Criteria:**
- [x] 服务注册表可以注册和查询服务配置
- [x] 服务状态可以更新和查询
- [x] 支持从环境变量读取配置

---

## Task 2: 创建健康监控器 ✅

**Requirements:** 2.1, 2.2, 2.3, 2.4, 2.5

**Files to create/modify:**
- `get/blinko-main/server/lib/healthMonitor.ts` (已创建)

**Implementation:**
1. ✅ 实现 `HealthMonitor` 类
2. ✅ 实现定时健康检查逻辑
3. ✅ 实现单个服务检查方法
4. ✅ 集成 `serviceRegistry` 更新状态

**Acceptance Criteria:**
- [x] 健康监控器可以启动和停止
- [x] 定期检查所有服务健康状态
- [x] 服务状态变化时正确更新注册表

---

## Task 3: 创建统一错误处理 ✅

**Requirements:** 7.1, 7.2, 7.3, 7.4, 7.5

**Files to create/modify:**
- `get/blinko-main/server/lib/gatewayError.ts` (已创建)

**Implementation:**
1. ✅ 定义 `GatewayErrorCode` 类型
2. ✅ 实现 `GatewayError` 类
3. ✅ 实现 `createErrorResponse` 函数
4. ✅ 实现 `toTRPCError` 转换函数
5. ✅ 实现 `withErrorHandling` 装饰器

**Acceptance Criteria:**
- [x] 所有服务错误使用统一格式
- [x] 错误可以正确转换为 tRPC 错误
- [x] 错误包含服务名称和时间戳

---

## Task 4: 创建 Khoj 客户端 ✅

**Requirements:** 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

**Files to create/modify:**
- `get/blinko-main/server/lib/khojClient.ts` (已创建)

**Implementation:**
1. ✅ 定义 Khoj 相关类型 (KhojChatMessage, KhojSearchResult, KhojAgent, KhojAutomation)
2. ✅ 实现 `KhojClient` 类
3. ✅ 实现聊天 API (chat, getConversations, getConversation, deleteConversation)
4. ✅ 实现搜索 API (search)
5. ✅ 实现 Agent API (getAgents, getAgent, createAgent, updateAgent, deleteAgent)
6. ✅ 实现自动化 API (getAutomations, createAutomation, deleteAutomation)
7. ✅ 实现索引 API (indexDocument, getIndexStatus)

**Acceptance Criteria:**
- [x] 客户端可以发送聊天消息
- [x] 客户端可以执行语义搜索
- [x] 客户端可以管理 Agent
- [x] 客户端可以管理自动化任务
- [x] 服务不可用时返回友好错误

---

## Task 5: 重构 Khoj tRPC Router ✅

**Requirements:** 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

**Files to create/modify:**
- `get/blinko-main/server/routerTrpc/khoj.ts` (已重构)

**Implementation:**
1. ✅ 导入 `KhojClient` 和 `serviceRegistry`
2. ✅ 添加服务可用性检查
3. ✅ 实现聊天相关 procedures (chat, getConversations, getConversation, deleteConversation)
4. ✅ 实现搜索 procedure (search)
5. ✅ 实现 Agent 相关 procedures
6. ✅ 实现自动化相关 procedures
7. ✅ 实现索引相关 procedures

**Acceptance Criteria:**
- [x] 所有 Khoj API 通过 tRPC 暴露
- [x] 服务不可用时返回 SERVICE_UNAVAILABLE
- [x] 错误使用统一格式

---

## Task 6: 创建 Gateway Router ✅

**Requirements:** 2.3, 10.1, 10.4

**Files to create/modify:**
- `get/blinko-main/server/routerTrpc/gateway.ts` (已创建)
- `get/blinko-main/server/routerTrpc/_app.ts` (已修改)

**Implementation:**
1. ✅ 创建 `gatewayRouter`
2. ✅ 实现 `getAllStatuses` procedure
3. ✅ 实现 `getServiceStatus` procedure
4. ✅ 实现 `refreshStatus` procedure
5. ✅ 在 `_app.ts` 中注册 gateway router

**Acceptance Criteria:**
- [x] 可以查询所有服务状态
- [x] 可以查询单个服务状态
- [x] 可以手动刷新服务状态

---

## Task 7: 创建前端服务层 ✅

**Requirements:** 8.1, 8.2, 8.3, 8.4

**Files to create/modify:**
- `get/blinko-main/app/src/lib/gateway.ts` (已创建)

**Implementation:**
1. ✅ 创建 `gatewayService` 对象
2. ✅ 实现 `getAllStatuses`, `getServiceStatus`, `refreshStatus`, `isServiceAvailable`
3. ✅ 创建 `khojService` 对象
4. ✅ 实现 Khoj 相关方法 (chat, search, getAgents 等)

**Acceptance Criteria:**
- [x] 前端可以通过统一接口调用所有服务
- [x] 服务调用自动通过 API 网关
- [x] TypeScript 类型完整

---

## Task 8: 创建服务状态 Hook ✅

**Requirements:** 10.2, 10.3, 10.5

**Files to create/modify:**
- `get/blinko-main/app/src/hooks/useServiceStatus.ts` (已创建)

**Implementation:**
1. ✅ 实现 `useAllServiceStatuses` hook
2. ✅ 实现 `useServiceStatus` hook
3. ✅ 实现 `useRefreshServiceStatus` hook
4. ✅ 实现 `useIsServiceAvailable` hook

**Acceptance Criteria:**
- [x] Hook 自动刷新服务状态
- [x] 支持手动刷新
- [x] 状态变化时自动更新 UI

---

## Task 9: 更新服务状态 UI ✅

**Requirements:** 10.1, 10.2, 10.3, 10.4, 10.5

**Files to create/modify:**
- `get/blinko-main/app/src/components/Layout/ServiceStatus.tsx` (已修改)

**Implementation:**
1. ✅ 使用 `useAllServiceStatuses` hook
2. ✅ 显示所有服务状态
3. ✅ 添加刷新按钮
4. ✅ 显示延迟和错误信息
5. ✅ 服务不可用时显示警告

**Acceptance Criteria:**
- [x] 显示所有服务状态
- [x] 状态实时更新
- [x] 可以手动刷新
- [x] 服务不可用时有明显提示

---

## Task 10: 启动健康监控 ✅

**Requirements:** 2.1, 9.4

**Files to create/modify:**
- `get/blinko-main/server/index.ts` (已修改)

**Implementation:**
1. ✅ 导入 `healthMonitor`
2. ✅ 在服务器启动时启动 `healthMonitor`
3. ✅ 添加优雅关闭逻辑 (SIGTERM/SIGINT)

**Acceptance Criteria:**
- [x] 服务器启动时自动开始健康检查
- [x] 服务器关闭时停止健康检查
- [x] 启动日志显示配置信息

---

## Task 11: 更新环境变量配置 ✅

**Requirements:** 9.1, 9.2, 9.3, 9.5

**Files to create/modify:**
- `.env.example` (已修改)

**Implementation:**
1. ✅ 添加 `KHOJ_API_URL` 环境变量
2. ✅ 添加 `JANITOR_API_URL` 环境变量
3. ✅ 添加 `PAPERLESS_API_URL` 环境变量
4. ✅ 添加 `SEEKDB_API_URL` 环境变量
5. ✅ 添加文档说明

**Acceptance Criteria:**
- [x] 所有服务 URL 可通过环境变量配置
- [x] 有合理的默认值
- [x] 文档清晰

---

## Task 12: 编写单元测试

**Requirements:** 所有

**Files to create/modify:**
- `get/blinko-main/server/lib/__tests__/serviceRegistry.test.ts` (待创建)
- `get/blinko-main/server/lib/__tests__/healthMonitor.test.ts` (待创建)
- `get/blinko-main/server/lib/__tests__/khojClient.test.ts` (待创建)

**Implementation:**
1. 测试 ServiceRegistry 的注册和查询
2. 测试 HealthMonitor 的检查逻辑
3. 测试 KhojClient 的错误处理

**Acceptance Criteria:**
- [ ] 核心逻辑有单元测试覆盖
- [ ] 测试通过

---

## 实现顺序

```
Task 1 (ServiceRegistry) ✅
    ↓
Task 2 (HealthMonitor) ✅
    ↓
Task 3 (GatewayError) ✅
    ↓
Task 4 (KhojClient) ✅
    ↓
Task 5 (Khoj Router) ✅
    ↓
Task 6 (Gateway Router) ✅
    ↓
Task 7 (Frontend Service) ✅
    ↓
Task 8 (Service Status Hook) ✅
    ↓
Task 9 (Service Status UI) ✅
    ↓
Task 10 (启动健康监控) ✅
    ↓
Task 11 (环境变量) ✅
    ↓
Task 12 (单元测试) ⏳ 可选
```

---

## 完成进度

| Task | 状态 | 预估时间 |
|------|------|----------|
| Task 1-3 | ✅ 完成 | 1 小时 |
| Task 4-5 | ✅ 完成 | 2 小时 |
| Task 6 | ✅ 完成 | 30 分钟 |
| Task 7-8 | ✅ 完成 | 1 小时 |
| Task 9 | ✅ 完成 | 1 小时 |
| Task 10 | ✅ 完成 | 30 分钟 |
| Task 11 | ✅ 完成 | - |
| Task 12 | ⏳ 可选 | 1 小时 |
| **总计** | **11/12 完成** | **~7 小时** |
