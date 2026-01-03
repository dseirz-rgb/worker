# Requirements Document

## Introduction

将 RiskControl 投资风控系统作为 Echo 知识管理系统的"投资模块"进行整合。两个系统共享基础设施（Supabase、LiveKit），但保持各自的业务逻辑独立。语音服务使用 RiskControl 更完善的 LiveKit 实现，但支持两个不同的语音 Agent（投资顾问 vs 日常助手）。

## Glossary

- **Echo**: 当前的 AI 驱动个人知识管理系统，基于 Blinko 扩展
- **RiskControl**: AI 投资风控系统，包含资产管理、风险监控、投资知识库
- **Voice_Agent**: LiveKit 语音助手，可根据上下文切换不同的对话角色
- **Investment_Agent**: 专注投资话题的语音 Agent，具备投资上下文和风控知识
- **Daily_Agent**: 日常助手语音 Agent，处理笔记、任务、日程等话题
- **Unified_Auth**: 统一认证系统，基于 Supabase Auth
- **Echo_Database**: Supabase 实例，存储笔记、日常知识、任务等非敏感数据
- **RiskControl_Database**: Supabase 实例，存储持仓、交易、风险指标等财务敏感数据
- **Investment_Knowledge**: 投资相关的 RAG 知识索引，与 Daily_Knowledge 完全隔离
- **Daily_Knowledge**: 日常笔记的 RAG 知识索引，与 Investment_Knowledge 完全隔离

## Requirements

### Requirement 1: 统一认证系统

**User Story:** As a user, I want to use a single account to access both Echo and RiskControl features, so that I don't need to manage multiple logins.

#### Acceptance Criteria

1. WHEN a user logs into Echo, THE Unified_Auth SHALL grant access to both Echo and RiskControl modules
2. WHEN a user's session expires, THE Unified_Auth SHALL require re-authentication for all modules
3. THE Unified_Auth SHALL use Supabase Auth as the single source of truth
4. WHEN migrating existing RiskControl users, THE System SHALL preserve their data associations

### Requirement 2: 模块化导航

**User Story:** As a user, I want to seamlessly switch between knowledge management and investment features, so that I can access all my tools from one interface.

#### Acceptance Criteria

1. THE System SHALL provide a unified navigation bar with module switching capability
2. WHEN a user switches to the Investment module, THE System SHALL load RiskControl dashboard
3. WHEN a user switches to the Notes module, THE System SHALL load Echo's note interface
4. THE Navigation SHALL preserve user's last visited module across sessions

### Requirement 3: 双数据库隔离架构

**User Story:** As a system architect, I want to keep financial data and notes data in separate databases, so that sensitive investment data is isolated and security is enhanced.

#### Acceptance Criteria

1. THE System SHALL maintain two separate Supabase instances: one for Echo (notes/knowledge) and one for RiskControl (financial data)
2. THE Echo_Database SHALL store notes, daily knowledge, tasks, and general user content
3. THE RiskControl_Database SHALL store positions, transactions, risk metrics, and investment documents
4. THE Frontend SHALL connect to both databases simultaneously using separate Supabase clients
5. WHEN user authentication is needed, THE System SHALL use RiskControl's Supabase Auth as the primary auth provider
6. THE System SHALL NOT migrate or merge financial data into the notes database

### Requirement 4: 双语音 Agent 架构（保留身份调教）

**User Story:** As a user, I want to talk to different AI assistants for different topics, so that I get specialized help for investment vs daily tasks, with each agent maintaining its unique personality and expertise.

#### Acceptance Criteria

1. THE Voice_Agent system SHALL support two distinct agent personas: Investment_Agent and Daily_Agent
2. WHEN a user initiates a voice session, THE System SHALL allow selection of agent type
3. THE Investment_Agent SHALL preserve all existing prompt engineering, personality traits, and investment expertise from RiskControl
4. THE Investment_Agent SHALL have access to investment context (positions, risk metrics, market data) from RiskControl_Database
5. THE Daily_Agent SHALL have access to notes, tasks, and calendar context from Echo_Database
6. THE Daily_Agent SHALL have its own distinct personality and prompt configuration
7. WHEN switching agents mid-conversation, THE System SHALL gracefully transition without losing session state
8. THE System SHALL use RiskControl's LiveKit implementation as the base for both agents
9. THE System SHALL NOT modify or dilute the Investment_Agent's existing system prompts and behavior

### Requirement 5: 上下文隔离的 RAG 知识库

**User Story:** As a user, I want the AI to clearly distinguish between investment topics and daily topics, so that responses are contextually appropriate and don't mix unrelated information.

#### Acceptance Criteria

1. THE System SHALL maintain two separate knowledge indices: Investment_Knowledge and Daily_Knowledge
2. WHEN chatting about investment topics, THE AI SHALL only retrieve from Investment_Knowledge
3. WHEN chatting about daily topics, THE AI SHALL only retrieve from Daily_Knowledge
4. THE System SHALL use topic detection to automatically route queries to the appropriate knowledge base
5. THE Investment_Agent SHALL NEVER access Daily_Knowledge during conversations
6. THE Daily_Agent SHALL NEVER access Investment_Knowledge during conversations
7. THE System SHALL use LightRAG service from RiskControl, extended to support namespace isolation
8. IF a user explicitly requests cross-domain search, THEN THE System SHALL require confirmation before mixing results

### Requirement 6: API 网关整合

**User Story:** As a developer, I want a unified API layer that routes requests to the appropriate module, so that the frontend has a consistent interface.

#### Acceptance Criteria

1. THE System SHALL expose a unified API gateway at `/api/*`
2. WHEN a request targets investment features, THE Gateway SHALL route to RiskControl handlers
3. WHEN a request targets note features, THE Gateway SHALL route to Echo handlers
4. THE Gateway SHALL handle authentication consistently across all routes
5. IF a service is unavailable, THEN THE Gateway SHALL return graceful degradation responses

### Requirement 7: 环境变量统一

**User Story:** As a developer, I want a single environment configuration, so that deployment and maintenance are simplified.

#### Acceptance Criteria

1. THE System SHALL consolidate environment variables from both projects
2. THE System SHALL use a single `.env` file with clear section markers
3. WHEN a variable is shared (like SUPABASE_URL), THE System SHALL use one definition
4. THE System SHALL document all required environment variables

### Requirement 8: 前端组件复用

**User Story:** As a developer, I want to reuse UI components across modules, so that the user experience is consistent and development is efficient.

#### Acceptance Criteria

1. THE System SHALL share shadcn/ui base components between modules
2. THE System SHALL maintain consistent styling (Tailwind config) across modules
3. WHEN RiskControl components are needed in Echo, THE System SHALL import them directly
4. THE System SHALL establish a shared component library path

