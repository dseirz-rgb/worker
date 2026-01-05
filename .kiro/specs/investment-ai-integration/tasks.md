# Implementation Plan: Investment AI Integration

## Overview

将 RiskControl 的 AI 功能完整移植到 Echo 投资模块，复用 Echo 现有的 Mastra Agent + tRPC 基建，保留投资专用提示词和多 Agent 编排系统。

## Tasks

- [x] 1. 创建 Investment DB 客户端和基础设施
  - [x] 1.1 创建 Investment DB Supabase 客户端
    - 在 `services/echo-server/lib/investmentDb.ts` 创建客户端
    - 使用 `INVESTMENT_SUPABASE_URL` 和 `INVESTMENT_SUPABASE_ANON_KEY` 环境变量
    - 实现连接池和错误处理
    - _Requirements: 2.1, 8.3_

  - [x] 1.2 创建投资数据类型定义
    - 在 `services/echo-server/aiServer/investment/types.ts` 定义类型
    - 包含 Position, Transaction, DashboardSnapshot, Message, Citation, RiskReport
    - _Requirements: 2.2, 7.3, 9.3_

- [x] 2. 实现 Context Builder (上下文构建器)
  - [x] 2.1 创建 Context Builder 核心模块
    - 在 `services/echo-server/aiServer/investment/contextBuilder.ts` 实现
    - 从 `packages/riskcontrol/src/services/contextBuilder.ts` 移植核心逻辑
    - 实现 `buildContext()`, `getPositions()`, `getDashboardSnapshot()`, `getRecentTransactions()`
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.2 实现上下文缓存机制
    - 使用内存缓存，5 分钟过期
    - 实现缓存键生成和失效逻辑
    - _Requirements: 2.5_

  - [x] 2.3 实现优雅降级处理
    - 数据库连接失败时返回友好提示
    - 部分数据缺失时继续处理
    - _Requirements: 2.4_

  - [x] 2.4 编写 Context Builder 属性测试
    - **Property 2: Context Builder Data Completeness**
    - **Property 3: Context Builder Graceful Degradation**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 3. 实现 Adaptive RAG Service (智能检索增强服务)
  - [x] 3.1 创建查询分类器
    - 在 `services/echo-server/aiServer/investment/adaptiveRagService.ts` 实现
    - 从 `packages/riskcontrol/src/services/ragService.ts` 移植分类逻辑
    - 实现 `classifyQuery()` 方法
    - _Requirements: 3.1_

  - [x] 3.2 实现 LightRAG 集成
    - 创建 LightRAG 客户端
    - 实现 `queryLightRAG()` 方法
    - 配置 hybrid 查询模式
    - _Requirements: 3.1, 3.2_

  - [x] 3.3 实现向量搜索降级
    - 使用 Supabase pgvector `match_documents` RPC
    - 实现 `vectorSearch()` 方法
    - _Requirements: 3.2, 3.3_

  - [x] 3.4 实现全文搜索降级
    - 使用 PostgreSQL FTS
    - 实现 `fullTextSearch()` 方法
    - _Requirements: 3.2, 3.6_

  - [x] 3.5 实现历史对话搜索
    - 搜索 messages 表中的历史回答
    - 限制返回 3 条相关历史
    - _Requirements: 3.5_

  - [x] 3.6 实现引用格式化
    - 格式: `[Source Type: Title]`
    - 支持三种来源: 结构化数据、投资笔记、历史对话
    - _Requirements: 3.4, 9.1, 9.2, 9.3_

  - [x] 3.7 编写 RAG Service 属性测试
    - **Property 4: RAG Service Result Limiting**
    - **Property 5: Citation Format Consistency**
    - **Property 6: RAG Service Graceful Degradation**
    - **Validates: Requirements 3.3, 3.4, 3.5, 3.6, 9.3**

- [x] 4. Checkpoint - 确保基础服务测试通过
  - 运行 Context Builder 和 RAG Service 测试
  - 确保所有属性测试通过
  - 如有问题请询问用户

- [x] 5. 实现 Investment Agent (投资对话 Agent)
  - [x] 5.1 创建 Investment Agent 配置
    - 在 `services/echo-server/aiServer/investment/investmentAgent.ts` 实现
    - 配置 "Investment Mirror" 人格
    - 从 `packages/riskcontrol/src/services/aiService.ts` 移植 System Prompt
    - _Requirements: 1.1, 1.2, 5.1_

  - [x] 5.2 注册 Agent 到 Echo Agent Manager
    - 使用 Mastra Agent 架构
    - 配置为公开 Agent
    - _Requirements: 1.3, 1.4_

  - [x] 5.3 实现 Agent Tools
    - 集成 Context Builder 获取持仓上下文
    - 集成 Adaptive RAG 获取知识库
    - _Requirements: 1.5_

  - [x] 5.4 实现对话方法
    - `chat()` - 同步对话
    - `streamChat()` - 流式对话
    - 集成 Context Builder 和 RAG Service
    - _Requirements: 4.1, 4.2_

  - [x] 5.5 编写 Investment Agent 属性测试
    - **Property 1: Agent Initialization Consistency**
    - **Validates: Requirements 1.1, 1.2, 1.4**

- [x] 6. 实现 Multi-Agent Orchestrator (多 Agent 编排器)
  - [x] 6.1 创建 Orchestrator 核心模块
    - 在 `services/echo-server/aiServer/investment/orchestrator.ts` 实现
    - 从 `packages/riskcontrol/src/services/agents/multiAgentService.ts` 移植
    - 支持 Sequential, Respond Directly, Selector 三种模式
    - _Requirements: 7.1_

  - [x] 6.2 实现 Position Analyst Agent
    - 在 `services/echo-server/aiServer/investment/agents/positionAnalyst.ts` 实现
    - 分析持仓集中度、绩效归因
    - _Requirements: 7.2_

  - [x] 6.3 实现 Risk Analyst Agent
    - 在 `services/echo-server/aiServer/investment/agents/riskAnalyst.ts` 实现
    - 压力测试、回撤分析、杠杆评估
    - _Requirements: 7.2_

  - [x] 6.4 实现 Market Analyst Agent
    - 在 `services/echo-server/aiServer/investment/agents/marketAnalyst.ts` 实现
    - 市场情绪、个股情绪、市场事件
    - _Requirements: 7.2_

  - [x] 6.5 实现 Advisor Agent
    - 在 `services/echo-server/aiServer/investment/agents/advisorAgent.ts` 实现
    - 综合分析结果，生成建议
    - _Requirements: 7.2_

- [x] 7. 实现报告生成功能
  - [x] 7.1 实现每日洞察生成
    - 在 Investment Agent 中添加 `generateDailyInsight()` 方法
    - 限制 100 字符
    - 使用严格但关怀的教练语气
    - _Requirements: 6.1, 6.2, 6.6_

  - [x] 7.2 实现风控研报生成
    - 在 Investment Agent 中添加 `generateRiskReport()` 方法
    - 使用 Multi-Agent Orchestrator 的 Sequential 模式
    - 返回结构化 JSON
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 7.3 实现报告持久化
    - 保存到 ai_analyses 表
    - 包含 portfolio snapshot
    - _Requirements: 7.4, 7.5_

  - [x] 7.4 编写报告生成属性测试
    - **Property 9: Risk Report Structure Completeness**
    - **Property 10: Risk Report Persistence**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5**

- [x] 8. Checkpoint - 确保 Agent 和报告功能测试通过
  - 运行 Investment Agent 测试
  - 运行报告生成测试
  - 如有问题请询问用户

- [x] 9. 实现 tRPC Investment Router
  - [x] 9.1 创建 Investment Router
    - 在 `services/echo-server/routerTrpc/investment.ts` 创建路由
    - 实现认证中间件
    - _Requirements: 8.1, 8.2_

  - [x] 9.2 实现对话端点
    - `investment.chat` - 发送消息
    - `investment.streamChat` - 流式对话
    - _Requirements: 8.1_

  - [x] 9.3 实现报告端点
    - `investment.generateDailyInsight` - 生成每日洞察
    - `investment.getLatestAnalysis` - 获取最新分析
    - _Requirements: 8.1_

  - [x] 9.4 实现对话管理端点
    - `investment.getConversations` - 获取对话列表
    - `investment.getMessages` - 获取对话消息
    - `investment.createConversation` - 创建对话
    - `investment.deleteConversation` - 删除对话
    - _Requirements: 8.1_

  - [x] 9.5 实现错误处理
    - 统一错误码格式
    - 返回用户友好的错误消息
    - _Requirements: 8.4_

  - [x] 9.6 编写 Router 属性测试
    - **Property 11: Authentication Enforcement**
    - **Property 12: Error Response Format**
    - **Validates: Requirements 8.2, 8.4**

- [x] 10. 更新前端 ChatWindow 组件
  - [x] 10.1 替换 Mock 响应为真实 API 调用
    - 修改 `packages/echo/src/components/InvestmentChat/ChatWindow.tsx`
    - 使用 tRPC `api.investment.chat` 调用
    - _Requirements: 4.1_

  - [x] 10.2 实现流式响应显示
    - 使用 tRPC mutation 接收响应
    - 实时更新消息内容
    - _Requirements: 4.2_

  - [x] 10.3 实现加载状态显示
    - 显示 "AI 正在思考..." 状态
    - 显示 Spinner 动画
    - _Requirements: 4.3_

  - [x] 10.4 实现上下文选择功能
    - 添加上下文选择器 (report, briefing, portfolio)
    - 传递上下文参数到 API
    - _Requirements: 4.4, 4.5_

  - [x] 10.5 实现引用显示
    - 在消息下方显示可折叠的引用区域
    - 显示引用来源和内容片段
    - _Requirements: 9.4_

  - [x] 10.6 实现错误处理 UI
    - 显示用户友好的错误消息
    - 提供重试按钮
    - _Requirements: 4.7_

  - [x] 10.7 编写消息持久化属性测试
    - **Property 7: Context Selection Prompt Inclusion**
    - **Property 8: Message Persistence Round-Trip**
    - **Validates: Requirements 4.5, 4.6**

- [x] 11. 更新 ChatSidebar 组件
  - [x] 11.1 实现对话列表加载
    - 使用 tRPC `api.investment.getConversations` 获取列表
    - 显示对话标题和时间
    - _Requirements: 8.1_

  - [x] 11.2 实现对话切换
    - 点击对话项加载历史消息
    - 使用 tRPC `api.investment.getMessages`
    - _Requirements: 8.1_

  - [x] 11.3 实现新建对话
    - 添加新建对话按钮
    - 使用 tRPC `api.investment.createConversation`
    - _Requirements: 8.1_

  - [x] 11.4 实现删除对话
    - 添加删除确认对话框
    - 使用 tRPC `api.investment.deleteConversation`
    - _Requirements: 8.1_

- [x] 12. Final Checkpoint - 完整功能验证
  - 运行所有属性测试
  - 手动测试对话流程
  - 验证流式响应
  - 验证引用显示
  - 如有问题请询问用户

## Notes

- All tasks are required (no optional tasks)
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- 使用 TypeScript，遵循项目现有代码风格
- 中文注释，英文变量名
