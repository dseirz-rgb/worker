# Requirements Document

## Introduction

将 RiskControl 的 AI 功能完整移植到 Echo 投资模块，使用 Echo 现有的 AI 基建（Mastra Agent + tRPC），同时保留 RiskControl 原有的投资专用提示词和 AI 风格调教。

核心目标：
1. 复用 Echo 的 Mastra Agent 架构，不引入额外基建
2. 保留 RiskControl 的投资专用 System Prompt 和 AI 人格
3. 实现投资上下文构建（持仓、交易、笔记、风险指标）
4. 支持流式响应和引用来源

## Glossary

- **Investment_Mirror**: 投资镜像 AI 助手，作为用户的投资决策辩论伙伴
- **Investment_Agent**: Echo 中专门处理投资对话的 Mastra Agent
- **Context_Builder**: 投资上下文构建器，从 Investment DB 获取持仓、交易、笔记等数据
- **RAG_Service**: 检索增强生成服务，为 AI 提供相关知识库内容
- **Citation**: 引用来源，标识 AI 回答中引用的数据来源
- **Investment_DB**: 投资数据库 (Supabase)，存储持仓、交易、对话等数据
- **Echo_Server**: Echo 后端服务，提供 tRPC API

## Requirements

### Requirement 1: Investment Agent 创建

**User Story:** As a developer, I want to create a specialized Investment Agent in Echo's agent system, so that investment chat can use Echo's existing AI infrastructure.

#### Acceptance Criteria

1. THE Investment_Agent SHALL be created as a Mastra Agent with investment-specific system prompt
2. THE Investment_Agent SHALL use the "Investment Mirror" persona from RiskControl
3. THE Investment_Agent SHALL be configured as a public agent accessible to all users
4. WHEN the Investment_Agent is initialized, THE System SHALL register it with Echo's agent manager
5. THE Investment_Agent SHALL support the following tools: searchInvestmentNotes, getPortfolioContext, getRiskMetrics

### Requirement 2: Investment Context Builder

**User Story:** As a user, I want the AI to have access to my portfolio data, so that it can provide personalized investment advice.

#### Acceptance Criteria

1. WHEN a user sends a message, THE Context_Builder SHALL retrieve relevant portfolio data from Investment_DB
2. THE Context_Builder SHALL include the following data types:
   - Current positions (ticker, weight, P&L)
   - Dashboard snapshot (net worth, daily P&L, drawdown)
   - Recent transactions (last 10)
   - User profile (investment style, risk tolerance)
3. THE Context_Builder SHALL format data as structured context for the AI prompt
4. IF portfolio data is unavailable, THEN THE Context_Builder SHALL return a graceful fallback message
5. THE Context_Builder SHALL cache data for 5 minutes to reduce database queries

### Requirement 3: Investment RAG Service

**User Story:** As a user, I want the AI to reference my investment notes and knowledge base, so that it can provide advice aligned with my investment principles.

#### Acceptance Criteria

1. WHEN a user query contains knowledge-related keywords, THE RAG_Service SHALL search the investment notes
2. THE RAG_Service SHALL use Supabase full-text search for note retrieval
3. THE RAG_Service SHALL return up to 5 relevant notes with citations
4. WHEN notes are referenced, THE System SHALL include inline citations in the format `[Note Title]`
5. THE RAG_Service SHALL search historical AI conversations for relevant context
6. IF no relevant notes are found, THEN THE RAG_Service SHALL proceed without note context

### Requirement 4: Chat Window Integration

**User Story:** As a user, I want to chat with the Investment AI in the Echo interface, so that I can get investment advice without switching applications.

#### Acceptance Criteria

1. WHEN a user sends a message, THE ChatWindow SHALL call the Investment_Agent via tRPC
2. THE ChatWindow SHALL display streaming responses in real-time
3. THE ChatWindow SHALL show loading status during AI processing
4. THE ChatWindow SHALL support context selection (report, briefing, portfolio)
5. WHEN context is selected, THE System SHALL include relevant data in the AI prompt
6. THE ChatWindow SHALL save messages to Investment_DB for conversation history
7. IF an error occurs, THEN THE ChatWindow SHALL display a user-friendly error message

### Requirement 5: AI Persona and Style

**User Story:** As a user, I want the AI to act as a critical investment partner, so that it challenges my assumptions and provides data-driven analysis.

#### Acceptance Criteria

1. THE Investment_Agent SHALL use the "Investment Mirror" persona:
   - Act as a critical, data-driven debating partner
   - Challenge user assumptions based on portfolio data
   - Use inline citations when referencing notes
   - Keep responses under 500 words unless detailed report requested
2. THE Investment_Agent SHALL NOT provide specific financial advice (e.g., "Buy AAPL now")
3. THE Investment_Agent SHALL analyze implications rather than give direct recommendations
4. THE Investment_Agent SHALL use Markdown formatting with bold for key figures
5. THE Investment_Agent SHALL respond in Chinese by default

### Requirement 6: Daily Insight Generation

**User Story:** As a user, I want to receive daily investment insights, so that I can stay informed about my portfolio status.

#### Acceptance Criteria

1. WHEN requested, THE System SHALL generate a daily insight based on portfolio data
2. THE Daily_Insight SHALL be under 100 characters
3. THE Daily_Insight SHALL reference specific portfolio risks or recent trades
4. THE Daily_Insight SHALL compare user behavior with their stated investment principles
5. IF user behavior contradicts their principles, THEN THE Daily_Insight SHALL point it out
6. THE Daily_Insight SHALL use a strict but caring coach tone

### Requirement 7: Risk Report Generation

**User Story:** As a user, I want to generate deep risk analysis reports, so that I can understand my portfolio risks comprehensively.

#### Acceptance Criteria

1. WHEN requested, THE System SHALL generate a structured risk report
2. THE Risk_Report SHALL include:
   - Macro environment and principle mapping
   - Position structure diagnosis (concentration, correlation)
   - Watchlist opportunity analysis
   - Core risk alerts and action suggestions
3. THE Risk_Report SHALL return structured JSON with risk_level, summary, content, recommendation
4. THE Risk_Report SHALL be saved to ai_analyses table in Investment_DB
5. THE Risk_Report SHALL include portfolio snapshot at generation time

### Requirement 8: tRPC API Endpoints

**User Story:** As a developer, I want investment AI endpoints in Echo's tRPC router, so that the frontend can access AI features consistently.

#### Acceptance Criteria

1. THE System SHALL expose the following tRPC endpoints:
   - `investment.chat` - Send message to Investment Agent
   - `investment.streamChat` - Stream chat with Investment Agent
   - `investment.generateDailyInsight` - Generate daily insight
   - `investment.generateRiskReport` - Generate risk report
   - `investment.getConversations` - List user conversations
   - `investment.getMessages` - Get messages for a conversation
2. ALL endpoints SHALL require authentication
3. ALL endpoints SHALL use Investment_DB for data storage
4. WHEN an error occurs, THE endpoints SHALL return appropriate error codes

### Requirement 9: Citation and Source Tracking

**User Story:** As a user, I want to see where the AI's information comes from, so that I can verify and trust the advice.

#### Acceptance Criteria

1. WHEN the AI references portfolio data, THE System SHALL include a citation
2. WHEN the AI references notes, THE System SHALL include the note title as citation
3. THE Citation format SHALL be: `[Source Type: Title]`
4. THE ChatWindow SHALL display citations in a collapsible section
5. THE System SHALL track citation sources: structured data, notes, historical conversations
