# Implementation Plan: AI 服务统一迁移

## Overview

将 Echo on Blinko 的 AI 能力从 Khoj (Python) 迁移到 Mastra (TypeScript)，分三阶段实现：短期优化、中期功能移植、长期完全迁移。

## Tasks

- [x] 1. 数据库 Schema 扩展
  - [x] 1.1 添加 agent 表
    - 创建 Prisma migration 添加 agent 模型
    - 字段: id, slug, name, persona, systemPrompt, tools, modelId, privacy, accountId
    - _Requirements: 3.2, 3.3_
  - [x] 1.2 添加 automationRun 表
    - 创建 migration 添加自动化运行记录表
    - 字段: id, automationId, status, result, error, startedAt, completedAt
    - _Requirements: 4.4_
  - [x] 1.3 添加 researchSession 表
    - 创建 migration 添加研究会话表
    - 字段: id, query, summary, iterations, sources, confidence, status, accountId
    - _Requirements: 2.3, 2.4_
  - [x] 1.4 添加 featureFlag 表
    - 创建 migration 添加功能开关表
    - 字段: id, key, value, accountId, metadata
    - _Requirements: 7.2, 7.3_

- [x] 2. 工具注册系统实现
  - [x] 2.1 创建 ToolRegistry 基础类
    - 实现 server/aiServer/tools/toolRegistry.ts
    - 包含 register, getTools, execute 方法
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 2.2 实现内置工具
    - searchNotes: 笔记语义搜索
    - webSearch: Tavily API 网络搜索
    - readWebpage: 网页内容提取
    - createNote: 创建笔记
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 2.3 实现工具权限控制
    - 添加权限检查逻辑
    - 实现工具执行日志
    - _Requirements: 5.5, 5.6_
  - [x] 2.4 编写工具权限隔离属性测试
    - **Property 4: 工具权限隔离**
    - **Validates: Requirements 5.5**

- [x] 3. Research Agent 实现
  - [x] 3.1 创建 ResearchAgent 核心类
    - 实现 server/aiServer/researchAgent.ts
    - 包含 research 异步生成器方法
    - _Requirements: 2.1, 2.2_
  - [x] 3.2 实现多轮迭代逻辑
    - searchNotes: RAG 搜索
    - searchWeb: Tavily 搜索
    - analyzeResults: 结果分析
    - planNextSteps: 下一步规划
    - _Requirements: 2.1, 2.2_
  - [x] 3.3 实现结果汇总和来源引用
    - generateSummary: 生成最终总结
    - deduplicateSources: 来源去重
    - calculateConfidence: 置信度计算
    - _Requirements: 2.3, 2.6_
  - [x] 3.4 实现流式输出和超时处理
    - 流式返回迭代进度
    - 超时返回部分结果
    - _Requirements: 2.4, 2.5_
  - [x] 3.5 编写 Research 迭代一致性属性测试
    - **Property 1: Research Agent 迭代一致性**
    - **Validates: Requirements 2.1, 2.2, 2.6**

- [x] 4. Checkpoint - Research Agent 完成
  - 所有测试已编写

- [x] 5. Agent 管理系统实现
  - [x] 5.1 创建 AgentManager 类
    - 实现 server/aiServer/agentManager.ts
    - 包含 createAgent, getAgents, updateAgent, deleteAgent 方法
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 5.2 实现 Agent 对话功能
    - chat 方法: 使用 Agent 配置生成响应
    - 集成 ToolRegistry 获取可用工具
    - _Requirements: 3.5_
  - [x] 5.3 创建默认 Agent
    - General Assistant: 通用助手
    - Research Expert: 研究专家
    - Writing Helper: 写作助手
    - _Requirements: 3.6_
  - [x] 5.4 编写 Agent 配置持久性属性测试
    - **Property 2: Agent 配置持久性**
    - **Validates: Requirements 3.2, 3.3**

- [x] 6. 自动化任务系统实现
  - [x] 6.1 创建 AutomationManager 类
    - 实现 server/aiServer/automationManager.ts
    - 包含 createAutomation, runAutomation, getHistory 方法
    - _Requirements: 4.1, 4.4_
  - [x] 6.2 实现自然语言调度解析
    - parseNaturalSchedule: 自然语言转 cron
    - 使用 AI 解析时间描述
    - _Requirements: 4.2_
  - [x] 6.3 实现任务执行和结果存储
    - 支持存储到 note, memory, 或两者
    - 实现重试逻辑 (最多 3 次)
    - _Requirements: 4.3, 4.5, 4.6_
  - [x] 6.4 编写自动化调度准确性属性测试
    - **Property 3: 自动化调度准确性**
    - **Validates: Requirements 4.1, 4.2**

- [x] 7. Checkpoint - 核心功能完成
  - 所有核心功能和测试已完成

- [x] 8. tRPC 路由实现
  - [x] 8.1 创建 research 路由
    - server/routerTrpc/research.ts
    - 端点: startResearch, getResearchSession, listResearchSessions
    - _Requirements: 2.1, 2.3, 2.4_
  - [x] 8.2 创建 agent 路由
    - server/routerTrpc/agent.ts
    - 端点: createAgent, getAgents, updateAgent, deleteAgent, chatWithAgent
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 8.3 创建 automation 路由
    - server/routerTrpc/automation.ts
    - 端点: createAutomation, runAutomation, getHistory, toggleAutomation
    - _Requirements: 4.1, 4.3, 4.4_
  - [x] 8.4 创建 featureFlag 路由
    - server/routerTrpc/featureFlag.ts
    - 端点: getFlags, setFlag, getUserFlags
    - _Requirements: 7.2, 7.3_

- [x] 9. 前端页面实现
  - [x] 9.1 实现 Research UI
    - app/src/pages/research.tsx
    - 研究查询输入、迭代进度显示、来源引用
    - _Requirements: 2.4, 2.6_
  - [x] 9.2 实现 Agent 管理 UI
    - app/src/pages/agents.tsx
    - Agent 列表、创建/编辑表单、对话界面
    - _Requirements: 3.1, 3.2, 3.5_
  - [x] 9.3 实现 Automation UI
    - app/src/pages/automations.tsx
    - 任务列表、创建表单、运行历史
    - _Requirements: 4.1, 4.4_

- [x] 10. Checkpoint - 中期功能完成
  - 所有前端页面和 tRPC 路由已实现

- [x] 11. 数据迁移实现
  - [x] 11.1 创建迁移脚本
    - scripts/migrate-khoj-data.ts
    - 备份 Khoj 数据
    - 迁移对话历史
    - _Requirements: 6.1, 6.2_
  - [x] 11.2 实现 Agent 配置迁移
    - 映射 Khoj agent 到新 schema
    - 保留调度和查询内容
    - _Requirements: 6.3, 6.4_
  - [x] 11.3 实现回滚机制
    - 迁移失败时恢复备份
    - 生成验证报告
    - _Requirements: 6.5, 6.6_
  - [x] 11.4 编写数据迁移完整性属性测试
    - **Property 5: 数据迁移完整性**
    - **Validates: Requirements 6.2, 6.3**

- [x] 12. 渐进式切换实现
  - [x] 12.1 实现 AIServiceRouter
    - server/aiServer/serviceRouter.ts
    - 根据 feature flag 路由请求
    - _Requirements: 7.1, 7.2_
  - [x] 12.2 实现服务降级
    - Mastra 失败时降级到 Khoj
    - Khoj 失败时降级到 Mastra
    - _Requirements: 7.4_
  - [x] 12.3 实现使用指标追踪
    - 记录两个系统的使用情况
    - 支持禁用 Khoj 服务
    - _Requirements: 7.5, 7.6_
  - [x] 12.4 编写功能开关路由属性测试
    - **Property 6: 功能开关路由正确性**
    - **Validates: Requirements 7.2, 7.4**

- [x] 13. 清理和文档
  - [ ] 13.1 移除 Khoj 相关代码 (延后 - 保留作为降级方案)
    - 删除 khojClient.ts
    - 删除 Khoj 相关路由
    - 更新 docker-compose 移除 Khoj 服务
    - _Requirements: 8.1_
  - [x] 13.2 更新文档
    - 创建 docs/AI_MIGRATION_GUIDE.md
    - 更新 API 文档
    - 归档 Khoj 集成文档
    - _Requirements: 8.2, 8.3, 8.4_
  - [x] 13.3 创建迁移指南
    - 自托管用户迁移步骤
    - 常见问题解答
    - _Requirements: 8.5_

- [x] 14. Final Checkpoint - 迁移完成
  - 所有核心功能已实现
  - 属性测试已编写 (Property 1-6)
  - 迁移脚本和文档已完成
  - Khoj 保留作为降级方案，待完全验证后移除

## Notes

- 所有任务均为必做，包括属性测试
- 每个任务引用具体的需求条款以便追溯
- Checkpoint 确保增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
