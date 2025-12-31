# Requirements Document - AI 服务统一迁移

## Introduction

将 Echo on Blinko 的 AI 能力从 Khoj (Python) 迁移统一到 Mastra (TypeScript)，实现单一技术栈、简化部署、降低维护成本。本 spec 涵盖短期优化、中期功能移植、长期完全迁移三个阶段。

## Glossary

- **Mastra**: TypeScript AI 框架，Blinko 当前使用的 AI 核心
- **Khoj**: Python AI 知识助手，当前作为独立服务运行
- **Research_Agent**: 多轮自主研究能力，类似 Khoj Research Mode
- **Agent_System**: AI 角色管理系统，支持自定义人格和工具
- **Automation_System**: 定时任务系统，自动执行 AI 任务
- **Memory_System**: 三层记忆架构 (短期/长期/工作记忆)
- **Tool_Registry**: 工具注册和管理系统

## Requirements

### Requirement 1: 短期 - Khoj 集成优化

**User Story:** As a user, I want a stable and responsive Khoj experience within Blinko, so that I can use AI features without switching apps.

#### Acceptance Criteria

1. WHEN user navigates to /echoai, THE System SHALL display a native chat interface instead of iframe
2. WHEN Khoj service is unavailable, THE System SHALL display a friendly error with retry option and fallback to Mastra
3. WHEN user creates or updates a note, THE System SHALL automatically sync it to Khoj index within 5 seconds
4. WHEN API calls to Khoj fail repeatedly, THE System SHALL activate circuit breaker and use cached responses
5. WHEN Khoj service recovers, THE System SHALL automatically reconnect and resume normal operation

### Requirement 2: 中期 - Research Agent 实现

**User Story:** As a user, I want to conduct deep research on topics, so that I can get comprehensive answers with sources.

#### Acceptance Criteria

1. WHEN user initiates a research query, THE Research_Agent SHALL perform multi-iteration research (default 5 iterations)
2. WHEN Research_Agent searches, THE System SHALL use both local notes (RAG) and web search (Tavily)
3. WHEN Research_Agent completes, THE System SHALL return a summary with cited sources and confidence score
4. WHEN research is in progress, THE System SHALL stream intermediate results and show iteration progress
5. IF research exceeds timeout, THEN THE System SHALL return partial results with explanation
6. WHEN user views research results, THE System SHALL display sources with clickable references

### Requirement 3: 中期 - Agent 管理系统

**User Story:** As a user, I want to create and manage AI agents with different personalities, so that I can have specialized assistants for different tasks.

#### Acceptance Criteria

1. WHEN user navigates to /agents, THE System SHALL display a list of available agents
2. WHEN user creates an agent, THE System SHALL allow setting name, persona, system prompt, and available tools
3. WHEN user edits an agent, THE System SHALL persist changes to database
4. WHEN user deletes an agent, THE System SHALL remove it and update all references
5. WHEN user selects an agent in chat, THE System SHALL use that agent's configuration for responses
6. THE System SHALL provide default agents: General Assistant, Research Expert, Writing Helper

### Requirement 4: 中期 - 自动化任务增强

**User Story:** As a user, I want to schedule AI tasks to run automatically, so that I can receive proactive insights.

#### Acceptance Criteria

1. WHEN user creates an automation, THE System SHALL allow setting query, schedule, and notification preferences
2. WHEN user sets schedule using natural language, THE System SHALL parse it to cron expression
3. WHEN automation runs, THE System SHALL store results and notify user via configured channels
4. WHEN user views automation history, THE System SHALL display past runs with results
5. WHEN automation fails, THE System SHALL retry up to 3 times and notify user of failure
6. THE System SHALL support result storage to: note, memory, or both

### Requirement 5: 中期 - 工具系统扩展

**User Story:** As a developer, I want to extend AI capabilities with new tools, so that agents can perform more actions.

#### Acceptance Criteria

1. THE System SHALL provide web search tool using Tavily API
2. THE System SHALL provide webpage content extraction tool
3. THE System SHALL provide file search tool for semantic search across attachments
4. WHEN tool execution fails, THE System SHALL return error with fallback suggestion
5. THE System SHALL support tool permission control per agent
6. THE System SHALL log all tool executions for debugging

### Requirement 6: 长期 - 数据迁移

**User Story:** As a user, I want my Khoj data migrated to the new system, so that I don't lose my conversation history.

#### Acceptance Criteria

1. WHEN migration starts, THE System SHALL backup all Khoj data first
2. WHEN migrating conversations, THE System SHALL preserve message order and timestamps
3. WHEN migrating agents, THE System SHALL map Khoj agent config to new schema
4. WHEN migrating automations, THE System SHALL preserve schedules and query content
5. IF migration fails, THEN THE System SHALL rollback and restore from backup
6. WHEN migration completes, THE System SHALL generate validation report

### Requirement 7: 长期 - 渐进式切换

**User Story:** As an admin, I want to gradually switch users from Khoj to Mastra, so that I can minimize disruption.

#### Acceptance Criteria

1. THE System SHALL support hybrid mode where both Khoj and Mastra are available
2. WHEN in hybrid mode, THE System SHALL route requests based on feature flags
3. THE System SHALL allow per-user opt-in to new Mastra features
4. WHEN Mastra feature fails, THE System SHALL fallback to Khoj if available
5. THE System SHALL track usage metrics for both systems during transition
6. WHEN all users are migrated, THE System SHALL allow disabling Khoj service

### Requirement 8: 长期 - 清理和文档

**User Story:** As a developer, I want clean codebase after migration, so that maintenance is easier.

#### Acceptance Criteria

1. WHEN Khoj is fully deprecated, THE System SHALL remove all Khoj-related code
2. THE System SHALL update deployment documentation to reflect single-service architecture
3. THE System SHALL archive Khoj integration documentation for reference
4. THE System SHALL update API documentation with new endpoints
5. THE System SHALL provide migration guide for self-hosted users
