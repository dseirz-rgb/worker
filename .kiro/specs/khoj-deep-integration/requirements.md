# Requirements Document - Khoj 深度集成 (Blinko)

## Introduction

将 Khoj AI 功能深度集成到 Blinko 应用中，利用已完成的统一 API 网关架构，实现原生 Khoj 体验。
本 spec 整合了之前 `khoj-integration` 和 `khoj-page-integration` 的剩余工作，并适配到 Blinko 架构。

## Glossary

- **Blinko**: 主应用，基于 React + tRPC
- **Khoj**: AI 知识助手服务，提供对话、搜索、Agent、自动化功能
- **API_Gateway**: 统一 API 网关，已在 `unified-api-gateway` spec 中完成
- **KhojClient**: 后端 Khoj 客户端 (`server/lib/khojClient.ts`)
- **Agent**: Khoj 中的 AI 角色，可定制人格和能力
- **Automation**: Khoj 中的定时任务，可自动执行研究和通知

## Requirements

### Requirement 1: 原生对话页面

**User Story:** As a user, I want to use Khoj chat natively in Blinko, so that I don't need to use iframe or switch to another app.

#### Acceptance Criteria

1. WHEN user navigates to /khoj, THE System SHALL display a native chat interface (not iframe)
2. WHEN user sends a message, THE System SHALL call Khoj API through the unified gateway
3. WHEN Khoj returns a response, THE System SHALL render it with Markdown, code highlighting, and LaTeX support
4. WHEN user starts a new conversation, THE System SHALL create a new conversation in Khoj
5. WHEN user selects a previous conversation, THE System SHALL load and display the conversation history
6. IF Khoj service is unavailable, THEN THE System SHALL display a friendly error with retry option

### Requirement 2: Agent 管理

**User Story:** As a user, I want to manage Khoj Agents in Blinko, so that I can customize AI personalities for different tasks.

#### Acceptance Criteria

1. WHEN user navigates to /agents, THE System SHALL display a list of available Agents
2. WHEN user clicks "Create Agent", THE System SHALL show a form to create a new Agent
3. WHEN user edits an Agent, THE System SHALL allow modifying name, persona, tools, and model
4. WHEN user deletes an Agent, THE System SHALL remove it from Khoj
5. WHEN user selects an Agent in chat, THE System SHALL use that Agent for the conversation

### Requirement 3: 自动化任务

**User Story:** As a user, I want to create automated research tasks, so that Khoj can proactively gather information for me.

#### Acceptance Criteria

1. WHEN user navigates to /automations, THE System SHALL display a list of automation tasks
2. WHEN user creates an automation, THE System SHALL allow setting query, schedule (cron), and notification preferences
3. WHEN an automation runs, THE System SHALL store results and notify the user
4. WHEN user views automation results, THE System SHALL display them with source references
5. WHEN user deletes an automation, THE System SHALL remove it from Khoj

### Requirement 4: 通过网关调用 API

**User Story:** As a developer, I want all Khoj API calls to go through the unified gateway, so that we have consistent error handling and monitoring.

#### Acceptance Criteria

1. THE Frontend SHALL call Khoj APIs through tRPC (`api.khoj.*`)
2. THE Backend SHALL use `KhojClient` from `server/lib/khojClient.ts`
3. WHEN API call fails, THE System SHALL use `GatewayError` for consistent error format
4. THE System SHALL NOT make direct HTTP calls to Khoj from frontend

### Requirement 5: UI 组件复用

**User Story:** As a developer, I want to reuse existing Khoj components, so that we maintain consistency and reduce development time.

#### Acceptance Criteria

1. THE System SHALL use existing components from `components/khoj/` directory
2. WHEN new components are needed, THE System SHALL follow the same patterns
3. THE System SHALL use HeroUI components for consistency with Blinko
4. THE System SHALL support dark/light theme

### Requirement 6: 导航集成

**User Story:** As a user, I want easy access to Khoj features from Blinko navigation.

#### Acceptance Criteria

1. THE Sidebar SHALL include "Khoj AI" navigation item
2. THE Sidebar SHALL include "Agents" navigation item (under Khoj)
3. THE Sidebar SHALL include "Automations" navigation item (under Khoj)
4. WHEN Khoj service is offline, THE Navigation items SHALL show a warning indicator

