# Requirements Document

## Introduction

本功能将现有的单次 AI 调用风控研报生成系统升级为多 Agent 协作架构。借鉴 AutoGen 和 CrewAI 的设计模式，在 TypeScript 中实现专业化的 Agent 分工，支持多种编排模式（Sequential、Selector、Handoff），并增强外部数据源集成（SEC 财报、实时新闻、网页抓取），以生成更深入、更专业的投资分析报告。

## Glossary

- **Agent**: 具有特定角色、目标和工具的 AI 实体，负责完成特定类型的分析任务
- **Orchestrator**: 协调多个 Agent 执行顺序和数据传递的控制器
- **Sequential_Mode**: 按顺序执行的任务链，后续任务依赖前序任务的输出
- **Selector_Mode**: LLM 动态选择下一个最合适的 Agent 执行
- **Handoff_Message**: Agent 主动将任务交接给特定 Agent 的消息
- **Respond_Directly_Mode**: 简单查询由 Advisor 直接响应，无需调用其他 Agent（借鉴 Agno Team）
- **Agent_State**: Agent 的可序列化状态，支持保存和恢复
- **Agent_Personality**: Agent 的性格配置，影响决策风格和风险偏好（借鉴 Stockagent）
- **Agent_Memory**: Agent 的长期记忆系统，支持跨会话学习（借鉴 Agno agentic_memory）
- **Extended_Thinking**: 深度推理模式，为复杂决策提供逐步推理（借鉴 Agno + Claude）
- **SEC_API**: 美国证券交易委员会 EDGAR 数据库 API，提供上市公司财报
- **Serper_API**: Google 搜索 API，用于获取实时新闻和市场信息
- **Jina_Reader**: 网页内容提取服务，用于解析新闻文章内容
- **Position_Analyst**: 持仓分析 Agent，专注于投资组合结构和个股分析
- **Risk_Analyst**: 风险分析 Agent，专注于风险指标和压力测试
- **Market_Analyst**: 市场分析 Agent，专注于宏观环境和新闻情绪
- **Web_Surfer_Agent**: 网页浏览 Agent，专注于抓取和解析网页内容
- **Advisor_Agent**: 投资顾问 Agent，综合所有分析给出最终建议
- **TransformMessages**: 消息转换器，用于处理长上下文问题（借鉴 AutoGen）
- **MessageHistoryLimiter**: 限制消息历史数量的转换器
- **MessageTokenLimiter**: 限制消息 token 数量的转换器
- **AI_Triggered_Alert**: 由 AI 分析结果触发的风险警报
- **Memory_Entry**: 长期记忆条目，包含洞察、模式、决策或结果
- **Memory_Retrieval_Strategy**: 记忆检索策略，支持 recency、relevance、hybrid 三种模式

## Requirements

### Requirement 1: Multi-Agent Orchestration Framework

**User Story:** As a developer, I want a TypeScript-based multi-agent orchestration framework, so that I can coordinate multiple specialized AI agents to work together on complex analysis tasks.

#### Acceptance Criteria

1. THE Orchestrator SHALL define a standard Agent interface with role, goal, tools, and execute method
2. THE Orchestrator SHALL support sequential task execution where each agent's output becomes the next agent's input
3. THE Orchestrator SHALL provide a context object that accumulates results from all agents
4. WHEN an agent execution fails, THEN THE Orchestrator SHALL log the error and continue with fallback data
5. THE Orchestrator SHALL emit progress events for UI status updates during multi-agent execution
6. THE Orchestrator SHALL support Selector mode where LLM dynamically chooses the next agent based on conversation context
7. THE Orchestrator SHALL support Handoff mode where agents can explicitly transfer control to specific agents via HandoffMessage
8. WHEN using Selector mode, THE Orchestrator SHALL provide agent descriptions to LLM for informed selection
9. THE Orchestrator SHALL support configurable orchestration modes: 'sequential', 'selector', 'handoff'

### Requirement 1.1: Agent State Persistence

**User Story:** As a developer, I want to save and restore agent execution state, so that I can resume interrupted analyses and debug issues.

#### Acceptance Criteria

1. THE System SHALL define an AgentState interface that captures agent's internal state
2. WHEN saveState() is called, THE Agent SHALL return a serializable state object
3. WHEN loadState() is called with a valid state object, THE Agent SHALL restore its internal state
4. THE Orchestrator SHALL support saving complete execution state including all agent states
5. THE Orchestrator SHALL support resuming execution from a saved state

### Requirement 1.2: Agent Personality System (Inspired by Stockagent)

**User Story:** As an investor, I want agents to have configurable personalities, so that recommendations match my risk tolerance and investment style.

#### Acceptance Criteria

1. THE Agent interface SHALL include an optional personality property with riskTolerance and decisionStyle fields
2. WHEN personality.riskTolerance is 'conservative', THE Agent SHALL prioritize capital preservation in recommendations
3. WHEN personality.riskTolerance is 'aggressive', THE Agent SHALL prioritize growth opportunities in recommendations
4. THE Advisor_Agent SHALL adjust recommendation language and action priorities based on configured personality
5. THE System SHALL support runtime personality override via ExecutionOptions

### Requirement 1.3: Agent Memory System (Inspired by Agno)

**User Story:** As an investor, I want the system to remember insights from past analyses, so that recommendations improve over time and consider historical context.

#### Acceptance Criteria

1. THE System SHALL implement an AgentMemoryManager with store, retrieve, and prune methods
2. WHEN an agent generates important insights, THE System SHALL store them as MemoryEntry objects
3. THE System SHALL support three memory retrieval strategies: recency, relevance, and hybrid
4. WHEN retrieving memories, THE System SHALL rank by configured strategy and return top N entries
5. THE System SHALL automatically prune low-importance memories when maxLongTermEntries is exceeded
6. THE Advisor_Agent SHALL incorporate relevant past memories into recommendation generation

### Requirement 1.4: Extended Thinking Mode (Inspired by Agno + Claude)

**User Story:** As an investor, I want deeper analysis for critical decisions, so that complex scenarios receive thorough reasoning.

#### Acceptance Criteria

1. THE System SHALL support ExtendedThinkingConfig with enabled, budgetTokens, and triggers fields
2. WHEN risk_level is CRITICAL and triggers.criticalRisk is true, THE Advisor_Agent SHALL use extended thinking
3. WHEN user query contains complexity keywords and triggers.complexDecision is true, THE System SHALL enable extended thinking
4. THE extended thinking mode SHALL provide step-by-step reasoning before final recommendations
5. THE System SHALL log when extended thinking is activated for debugging

### Requirement 1.5: Respond Directly Mode (Inspired by Agno Team)

**User Story:** As a user, I want simple queries answered quickly without full multi-agent analysis, so that I get fast responses for basic questions.

#### Acceptance Criteria

1. THE Orchestrator SHALL support 'respond_directly' as a fourth orchestration mode
2. WHEN in respond_directly mode, THE System SHALL assess query complexity before execution
3. WHEN query is classified as 'simple', THE Advisor_Agent SHALL respond directly without calling other agents
4. WHEN query is classified as 'complex', THE System SHALL fall back to sequential mode
5. THE System SHALL use pattern matching and heuristics to classify query complexity

### Requirement 2: Position Analyst Agent

**User Story:** As an investor, I want detailed analysis of my portfolio positions, so that I can understand the structure, concentration, and performance attribution of my holdings.

#### Acceptance Criteria

1. WHEN the Position_Analyst executes, THE Agent SHALL analyze portfolio concentration by calculating top 3 position weights
2. WHEN the Position_Analyst executes, THE Agent SHALL identify sector/market correlation risks among holdings
3. WHEN the Position_Analyst executes, THE Agent SHALL calculate performance attribution for recent gains/losses
4. THE Position_Analyst SHALL output a structured JSON with concentration_analysis, correlation_risks, and performance_attribution fields
5. WHEN a position exceeds 30% weight, THE Position_Analyst SHALL flag it as high_concentration_risk

### Requirement 3: Risk Analyst Agent

**User Story:** As an investor, I want quantitative risk analysis of my portfolio, so that I can understand potential downside scenarios and take protective measures.

#### Acceptance Criteria

1. WHEN the Risk_Analyst executes, THE Agent SHALL calculate current drawdown from high water mark
2. WHEN the Risk_Analyst executes, THE Agent SHALL perform stress test scenarios (market -10%, -20%, -30%)
3. WHEN the Risk_Analyst executes, THE Agent SHALL analyze leverage ratio and margin safety
4. THE Risk_Analyst SHALL output a structured JSON with drawdown_analysis, stress_tests, and leverage_assessment fields
5. IF drawdown exceeds 15%, THEN THE Risk_Analyst SHALL set risk_level to CRITICAL

### Requirement 4: Market Analyst Agent with External Data

**User Story:** As an investor, I want real-time market context and news analysis, so that I can make decisions based on current market conditions.

#### Acceptance Criteria

1. WHEN the Market_Analyst executes, THE Agent SHALL fetch recent news for top holdings using Serper API
2. WHEN the Market_Analyst executes, THE Agent SHALL analyze news sentiment (positive/negative/neutral)
3. WHEN the Market_Analyst executes, THE Agent SHALL identify market cycle position (bull/bear/consolidation)
4. WHERE SEC_API is configured, THE Market_Analyst SHALL fetch latest 10-K/10-Q filings for US holdings
5. THE Market_Analyst SHALL output a structured JSON with news_summary, sentiment_score, market_cycle, and sec_highlights fields
6. IF Serper API fails, THEN THE Market_Analyst SHALL fallback to cached news from knowledge base
7. WHEN deeper web research is needed, THE Market_Analyst SHALL emit a HandoffMessage to Web_Surfer_Agent

### Requirement 4.1: Web Surfer Agent

**User Story:** As an investor, I want the system to browse and extract information from financial websites, so that I can get detailed analysis from specific sources.

#### Acceptance Criteria

1. THE Web_Surfer_Agent SHALL accept URLs and extract main content using Jina Reader
2. WHEN extracting content, THE Web_Surfer_Agent SHALL preserve key financial data and tables
3. THE Web_Surfer_Agent SHALL support extracting content from SEC EDGAR filing pages
4. THE Web_Surfer_Agent SHALL support extracting content from financial news sites
5. THE Web_Surfer_Agent SHALL output a structured JSON with url, title, content, and extracted_data fields
6. IF content extraction fails, THEN THE Web_Surfer_Agent SHALL return partial content with error details
7. THE Web_Surfer_Agent SHALL cache extracted content for 1 hour to avoid repeated fetches

### Requirement 5: Advisor Agent Synthesis

**User Story:** As an investor, I want a comprehensive investment recommendation that synthesizes all analysis, so that I can take informed action.

#### Acceptance Criteria

1. WHEN the Advisor_Agent executes, THE Agent SHALL receive outputs from Position_Analyst, Risk_Analyst, Market_Analyst, and optionally Web_Surfer_Agent
2. THE Advisor_Agent SHALL cross-reference user's investment principles from notes with current portfolio state
3. THE Advisor_Agent SHALL generate a prioritized action plan with specific tickers and quantities
4. THE Advisor_Agent SHALL output a final report with risk_level, summary, detailed_analysis, and action_items fields
5. WHEN generating recommendations, THE Advisor_Agent SHALL cite specific data points from other agents' analyses
6. WHEN in Selector mode, THE Advisor_Agent MAY request additional analysis by returning a HandoffMessage to a specific agent

### Requirement 6: External Data Source Integration

**User Story:** As a developer, I want modular data source adapters, so that I can easily add or replace external data providers.

#### Acceptance Criteria

1. THE System SHALL define a DataSource interface with fetch, isAvailable, and getCache methods
2. THE System SHALL implement SerperDataSource for news search with rate limiting
3. THE System SHALL implement SECDataSource for EDGAR filings with ticker-to-CIK mapping
4. THE System SHALL implement JinaDataSource for article content extraction
5. WHEN a DataSource is unavailable, THE System SHALL return cached data or empty result without throwing
6. THE System SHALL store API keys in environment variables (SERPER_API_KEY, SEC_API_KEY)

### Requirement 7: Enhanced Risk Report Generation

**User Story:** As an investor, I want the new multi-agent analysis to replace the existing single-call report generation, so that I get more comprehensive insights.

#### Acceptance Criteria

1. THE aiService.generateRiskReport SHALL be refactored to use the multi-agent orchestrator
2. THE new report format SHALL maintain backward compatibility with existing UI components
3. WHEN generating a report, THE System SHALL show progress status for each agent phase
4. THE System SHALL store the full agent execution trace in the database for debugging
5. THE new report generation SHALL complete within 60 seconds for typical portfolios

### Requirement 8: Caching and Performance

**User Story:** As a user, I want fast report generation with intelligent caching, so that I don't wait too long for repeated analyses.

#### Acceptance Criteria

1. THE System SHALL cache external API responses (news, SEC filings) for 1 hour
2. THE System SHALL cache agent intermediate results for 15 minutes
3. WHEN cached data is available and fresh, THE System SHALL skip the corresponding API call
4. THE System SHALL provide a force_refresh option to bypass all caches
5. THE System SHALL log cache hit/miss statistics for monitoring

### Requirement 9: Context Management (TransformMessages)

**User Story:** As a developer, I want automatic context management for multi-agent conversations, so that long-running analyses don't exceed LLM token limits.

#### Acceptance Criteria

1. THE System SHALL define a MessageTransform interface with apply_transform method
2. THE System SHALL implement MessageHistoryLimiter to limit the number of messages in context
3. THE System SHALL implement MessageTokenLimiter to limit total tokens in message history
4. WHEN message history exceeds the configured max_messages limit, THE MessageHistoryLimiter SHALL retain only the most recent N messages
5. WHEN total tokens exceed max_tokens limit, THE MessageTokenLimiter SHALL truncate older messages while preserving the most recent content
6. THE MessageTokenLimiter SHALL support a min_tokens threshold below which no transformation is applied
7. THE MessageTokenLimiter SHALL support max_tokens_per_message to truncate individual long messages
8. THE Orchestrator SHALL apply configured transforms before each LLM call in Selector mode
9. THE System SHALL support chaining multiple transforms in sequence
10. WHEN transforms are applied, THE System SHALL log the before/after message counts for debugging

### Requirement 10: AI-Triggered Risk Alerts

**User Story:** As an investor, I want the multi-agent analysis to automatically trigger alerts when it detects significant risks, so that I can be notified even without manually checking reports.

#### Acceptance Criteria

1. WHEN the Advisor_Agent determines risk_level is CRITICAL, THE System SHALL automatically trigger a risk alert
2. WHEN the Risk_Analyst detects drawdown > 15% or leverage > 2.5x, THE System SHALL emit an alert event
3. WHEN the Market_Analyst detects strongly negative sentiment (score < -0.5) for major holdings, THE System SHALL emit a market alert event
4. THE System SHALL integrate with existing riskAlertService to send notifications (toast, browser notification, email)
5. THE System SHALL include AI analysis summary in the alert message for context
6. THE System SHALL respect the existing 30-minute alert cooldown to avoid spam
7. WHEN generating alerts, THE System SHALL cite the specific agent findings that triggered the alert
8. THE Orchestrator SHALL emit an 'alert' event that UI components can subscribe to for real-time display
9. IF alert severity is CRITICAL, THEN THE System SHALL send an email notification with the full analysis summary
