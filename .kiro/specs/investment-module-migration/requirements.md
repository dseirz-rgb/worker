# Requirements Document

## Introduction

本文档定义了将 RiskControl 独立应用 (`packages/riskcontrol`) 中的投资功能完整移植到 Echo 前端投资模块 (`packages/echo/src/pages/investment/`) 的需求。

### 背景
- Echo 投资模块已有基础架构（InvestmentStore、路由、数据库连接）
- 部分页面已完成移植（仪表盘、持仓、风险中心入口）
- 部分页面有基本 UI 但缺少完整功能（年度回顾、市场分析、决策中心）
- 部分页面只有占位符（投资镜像、语音通话）
- 投资笔记功能已通过独立 spec 完成（investment-notes-integration）

### 核心原则
- **复用优先**：最大化复用 Echo 现有组件和 RiskControl 已验证的逻辑
- **数据隔离**：投资数据使用 Investment DB，不混入 Echo DB
- **渐进移植**：按优先级逐步移植，每个功能独立可用
- **UI 统一**：使用 HeroUI + MobX，保持 Echo 风格一致性

## Glossary

- **Echo_Frontend**: Echo 主前端应用，位于 `packages/echo/`，使用 MobX + HeroUI
- **RiskControl_App**: 独立的风控应用，位于 `packages/riskcontrol/`，使用 Zustand + shadcn/ui
- **Investment_Module**: Echo 前端中的投资模块，路由前缀为 `/investment`
- **InvestmentStore**: Echo 前端中管理投资状态的 MobX Store
- **Investment_DB**: 投资数据库 (`lyqspnecudllmnajrrlm`)，存储持仓、交易、快照等
- **Echo_DB**: Echo 主数据库 (`jwiocrwhqeomoybbwqcp`)，存储笔记、AI 对话等

## Requirements

### Requirement 1: 投资镜像页面移植

**User Story:** As a user, I want to access the AI investment chat interface in Echo, so that I can get investment advice without switching applications.

#### Acceptance Criteria

1. WHEN a user navigates to `/investment/mirror`, THE Investment_Module SHALL display a chat interface with conversation sidebar
2. WHEN the page loads, THE Investment_Module SHALL fetch and display existing conversations from the database
3. WHEN a user selects a conversation, THE Investment_Module SHALL load and display the conversation history
4. WHEN a user sends a message, THE Investment_Module SHALL call the AI service and stream the response
5. WHEN a user creates a new conversation, THE Investment_Module SHALL initialize a new chat session
6. IF the AI service is unavailable, THEN THE Investment_Module SHALL display an error message with retry option

### Requirement 2: 语音通话页面移植

**User Story:** As a user, I want to interact with the AI investment advisor through voice in Echo, so that I can get hands-free investment guidance.

#### Acceptance Criteria

1. WHEN a user navigates to `/investment/voice`, THE Investment_Module SHALL display the voice call interface with connection controls
2. WHEN a user initiates a voice call, THE Investment_Module SHALL connect to the LiveKit voice service
3. WHILE a voice call is active, THE Investment_Module SHALL display real-time transcription and AI responses
4. WHEN a user ends the call, THE Investment_Module SHALL properly disconnect and save the conversation summary
5. IF the voice service is unavailable, THEN THE Investment_Module SHALL display an appropriate error message
6. WHEN displaying the voice interface, THE Investment_Module SHALL show a Siri-style animated orb

### Requirement 3: 风险引擎页面完善

**User Story:** As a user, I want to access the full risk engine functionality in Echo, so that I can configure and monitor risk controls.

#### Acceptance Criteria

1. WHEN a user navigates to `/investment/risk/engine`, THE Investment_Module SHALL display the complete risk engine interface with 4 tabs
2. WHEN the dashboard tab is active, THE Investment_Module SHALL show real-time risk status and circuit breaker states
3. WHEN the forecast tab is active, THE Investment_Module SHALL display AI-driven risk predictions with charts
4. WHEN the history tab is active, THE Investment_Module SHALL show risk trend history and decision records
5. WHEN the config tab is active, THE Investment_Module SHALL allow users to configure risk parameters
6. WHEN a user modifies risk thresholds, THE Investment_Module SHALL validate and save the new settings
7. IF a circuit breaker is triggered, THEN THE Investment_Module SHALL display prominent alerts

### Requirement 4: 年度回顾页面完善

**User Story:** As a user, I want to view my complete annual investment review in Echo, so that I can analyze my yearly performance comprehensively.

#### Acceptance Criteria

1. WHEN a user navigates to `/investment/annual-review`, THE Investment_Module SHALL display the complete annual review page
2. WHEN the page loads, THE Investment_Module SHALL fetch yearly data from dashboard_snapshots table
3. WHEN displaying performance data, THE Investment_Module SHALL show net value curve, monthly returns, and quarterly breakdown
4. WHEN displaying analysis, THE Investment_Module SHALL show best/worst days, drawdown periods, and volatility metrics
5. WHEN a user requests AI analysis, THE Investment_Module SHALL generate and stream AI insights
6. THE Investment_Module SHALL include a "年度反思" section with key insights, improvements needed, and next year goals
7. IF the data fetch fails, THEN THE Investment_Module SHALL display an error message with retry option

### Requirement 5: 市场分析页面完善

**User Story:** As a user, I want to access real market data and analysis in Echo, so that I can make informed investment decisions.

#### Acceptance Criteria

1. WHEN a user navigates to `/investment/market`, THE Investment_Module SHALL display real-time market indices
2. WHEN the page loads, THE Investment_Module SHALL fetch market data from the data source
3. WHEN displaying indices, THE Investment_Module SHALL show price, change, and change percentage
4. WHEN displaying hot stocks, THE Investment_Module SHALL show top gainers and losers
5. WHEN a user searches for a stock, THE Investment_Module SHALL filter and display matching results
6. IF the market data fetch fails, THEN THE Investment_Module SHALL display cached data or error message

### Requirement 6: 决策中心页面完善

**User Story:** As a user, I want to access AI-driven investment analysis in Echo, so that I can get intelligent decision support.

#### Acceptance Criteria

1. WHEN a user navigates to `/investment/decision`, THE Investment_Module SHALL display the AI decision center
2. WHEN the suggestions tab is active, THE Investment_Module SHALL show AI-generated investment suggestions
3. WHEN the analysis tab is active, THE Investment_Module SHALL allow users to ask investment questions
4. WHEN a user submits a question, THE Investment_Module SHALL call the AI service and stream the response
5. WHEN displaying suggestions, THE Investment_Module SHALL show confidence level and risk assessment
6. IF the AI service is unavailable, THEN THE Investment_Module SHALL display an error message

### Requirement 7: 智能风控页面完善

**User Story:** As a user, I want to access AI-driven risk analysis in Echo, so that I can get intelligent risk insights.

#### Acceptance Criteria

1. WHEN a user navigates to `/investment/risk/intelligent`, THE Investment_Module SHALL display the intelligent risk analysis interface
2. WHEN the page loads, THE Investment_Module SHALL fetch and display AI-generated risk assessments
3. WHEN displaying risk analysis, THE Investment_Module SHALL show risk factors, recommendations, and confidence levels
4. WHEN a user requests a new analysis, THE Investment_Module SHALL trigger the AI analysis and display results
5. THE Investment_Module SHALL integrate the UnifiedAIAnalysisPanel component

### Requirement 8: 组件适配与样式统一

**User Story:** As a developer, I want all migrated components to use Echo's design system, so that the UI is consistent across the application.

#### Acceptance Criteria

1. WHEN migrating components, THE Developer SHALL convert shadcn/ui components to HeroUI equivalents
2. WHEN migrating state management, THE Developer SHALL convert Zustand hooks to MobX store patterns
3. WHEN migrating styles, THE Developer SHALL use Echo's Tailwind configuration and color tokens
4. THE migrated pages SHALL maintain responsive design for mobile and desktop views
5. THE migrated pages SHALL use GradientBackground wrapper for visual consistency

### Requirement 9: 共享组件移植

**User Story:** As a developer, I want to migrate reusable components from RiskControl, so that they can be used across the investment module.

#### Acceptance Criteria

1. WHEN migrating chat components, THE Developer SHALL create Echo-compatible versions in `components/InvestmentChat/`
2. WHEN migrating voice components, THE Developer SHALL create Echo-compatible versions in `components/InvestmentVoice/`
3. WHEN migrating risk components, THE Developer SHALL create Echo-compatible versions in `components/InvestmentRisk/`
4. THE migrated components SHALL follow Echo's component patterns and naming conventions
5. THE migrated components SHALL be properly typed with TypeScript

