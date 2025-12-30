# Requirements: Unified Intelligence System

## Overview

将四个已实现的智能系统深度整合为统一的投资分析平台：
1. **Multi-Agent System** - 多专家协作分析（大脑）
2. **Adaptive RAG** - 智能检索与质量控制（知识获取）
3. **LightRAG** - 知识图谱检索（记忆）
4. **Voice Service** - 实时语音交互（交互层）

## Glossary

- **Unified_Intelligence_Service**: 统一智能服务，整合所有子系统的入口
- **Query_Classifier**: 查询分类器，决定使用哪种处理模式
- **Agent_Orchestrator**: Agent 编排器，协调多个专业 Agent
- **Adaptive_RAG**: 自适应检索增强生成系统
- **LightRAG**: 知识图谱检索系统
- **Voice_Service**: 实时语音交互服务

## Background

### 系统一：Multi-Agent System (已完成)

- **5 个专业 Agent**: Position Analyst, Risk Analyst, Market Analyst, Web Surfer, Advisor
- **4 种编排模式**: sequential, selector, handoff, respond_directly
- **增强功能**: Personality System, Memory System, Extended Thinking, AI-Triggered Alerts
- **数据源**: Serper (新闻), SEC (财报), Jina (网页内容)
- **入口**: `client/src/services/agents/multiAgentService.ts`

### 系统二：Adaptive RAG (已完成)

- **智能路由**: LLM-based Query Router (vectorstore/structured_data/websearch)
- **质量控制**: Document Grader → Hallucination Grader → Answer Grader
- **自适应重试**: 最多 3 次重试，自动切换策略
- **消息管理**: MessageTransformer 处理长对话
- **入口**: `client/src/services/adaptiveRag/adaptiveRagService.ts`

### 系统三：LightRAG (已完成)

- **知识图谱**: 实体提取 + 关系构建
- **混合检索**: naive/local/global/hybrid 四种模式
- **增量更新**: 支持文档增删改
- **入口**: `client/src/services/lightragClient.ts`

### 系统四：Voice Service (已完成)

- **实时语音**: FastRTC WebRTC 连接
- **STT/TTS**: Moonshine + Kokoro 模型
- **上下文获取**: 从 Supabase + LightRAG 获取投资数据
- **入口**: `voice-service/main.py`

### 当前集成状态

| 组件 | Multi-Agent | Adaptive RAG | LightRAG | Voice |
|------|-------------|--------------|----------|-------|
| RiskCenter AI Panel | ❌ | ❌ | ❌ | ❌ |
| DecisionCenter Chat | ❌ | ❌ | ✅ (部分) | ❌ |
| Daily Briefing | ❌ | ❌ | ❌ | ❌ |
| Voice Service | ❌ | ❌ | ✅ (部分) | ✅ |
| Risk Report | ✅ | ❌ | ❌ | ❌ |

## Requirements

### Requirement 1: Unified Retrieval Layer

**User Story:** As a developer, I want a unified retrieval layer that combines Adaptive RAG and LightRAG, so that all components can access knowledge through a single interface.

#### Acceptance Criteria

1. WHEN the Adaptive_RAG routes to vectorstore, THE Unified_Intelligence_Service SHALL query LightRAG first
2. IF LightRAG is unavailable, THEN THE Unified_Intelligence_Service SHALL fallback to Supabase vector search
3. THE Unified_Intelligence_Service SHALL preserve Adaptive RAG's quality control flow (Document Grader → Hallucination Grader → Answer Grader)
4. WHEN retrieving documents, THE Unified_Intelligence_Service SHALL return citations with source attribution

### Requirement 2: Agent + Adaptive RAG Integration

**User Story:** As a system architect, I want Agents to use Adaptive RAG for knowledge retrieval, so that agent responses are grounded in verified information.

#### Acceptance Criteria

1. WHEN Position_Analyst needs portfolio data, THE Agent SHALL use Adaptive_RAG with structured_data route
2. WHEN Risk_Analyst needs risk knowledge, THE Agent SHALL use Adaptive_RAG with vectorstore route
3. WHEN Market_Analyst needs current news, THE Agent SHALL use Adaptive_RAG with websearch route
4. WHEN any Agent generates a response, THE Hallucination_Grader SHALL verify it against retrieved documents
5. IF hallucination is detected, THEN THE Agent_Orchestrator SHALL trigger re-analysis

### Requirement 3: Query Classification and Routing

**User Story:** As a user, I want the system to automatically choose the right analysis depth based on my question complexity, so that simple questions get fast answers and complex questions get thorough analysis.

#### Acceptance Criteria

1. WHEN a query has confidence > 0.8 from Query_Router, THE Query_Classifier SHALL route directly to Adaptive_RAG
2. WHEN a query has confidence < 0.8 from Query_Router, THE Query_Classifier SHALL escalate to Multi-Agent analysis
3. THE Query_Classifier SHALL allow users to manually override the analysis depth
4. WHEN using Adaptive_RAG only, THE Unified_Intelligence_Service SHALL respond within 2 seconds
5. WHEN using Multi-Agent analysis, THE Unified_Intelligence_Service SHALL complete within 30 seconds

### Requirement 4: RiskCenter Integration

**User Story:** As a risk manager, I want the RiskCenter AI panel to use the unified intelligence system, so that I get comprehensive multi-agent analysis with quality-controlled responses.

#### Acceptance Criteria

1. WHEN user clicks "开始分析", THE RiskCenter SHALL call Unified_Intelligence_Service.deepAnalyze()
2. WHILE analysis is running, THE RiskCenter SHALL display progress for each Agent (Position → Risk → Market → Advisor)
3. WHEN analysis completes, THE RiskCenter SHALL show each Agent's summary in expandable sections
4. WHEN user asks follow-up questions, THE Unified_Intelligence_Service SHALL use respond_directly mode for fast response
5. WHEN an Agent triggers an alert, THE RiskCenter SHALL display it in the risk log with Agent name and reasoning

### Requirement 5: DecisionCenter Chat Integration

**User Story:** As an investor, I want the chat to intelligently route my questions to the appropriate analysis mode, so that I get fast answers for simple questions and deep analysis for complex ones.

#### Acceptance Criteria

1. WHEN user asks a simple question, THE Chat SHALL use Adaptive_RAG and respond within 2 seconds
2. WHEN user asks a complex analysis question, THE Chat SHALL automatically escalate to Multi-Agent mode
3. WHILE Multi-Agent analysis runs, THE Chat SHALL show Agent thinking process in a collapsible section
4. THE Chat SHALL preserve RAG citation functionality with source links
5. THE Chat SHALL use MessageTransformer to manage long conversation context

### Requirement 6: Daily Briefing Integration

**User Story:** As an investor, I want daily insights generated by multiple specialized agents, so that I get comprehensive analysis covering positions, risks, and market conditions.

#### Acceptance Criteria

1. WHEN generating daily insight, THE Unified_Intelligence_Service SHALL use Position_Analyst for position changes
2. WHEN generating daily insight, THE Unified_Intelligence_Service SHALL use Risk_Analyst for risk assessment
3. WHEN generating daily insight, THE Unified_Intelligence_Service SHALL use Market_Analyst with websearch route for market news
4. WHEN generating daily insight, THE Unified_Intelligence_Service SHALL use Advisor for final recommendations
5. THE Daily_Briefing SHALL display each Agent's key findings with expandable details

### Requirement 7: Voice Service Integration

**User Story:** As a user, I want voice interactions to leverage the unified intelligence system, so that voice responses include agent insights and quality-controlled information.

#### Acceptance Criteria

1. WHEN user speaks a query, THE Voice_Service SHALL route it through Query_Classifier
2. WHEN query is simple, THE Voice_Service SHALL respond directly using Adaptive_RAG
3. WHEN query is complex, THE Voice_Service SHALL inform user to check detailed analysis in app
4. THE Voice_Service SHALL include latest Agent analysis results in context
5. WHEN user says "帮我分析风险", THE Voice_Service SHALL trigger deep analysis and provide summary

### Requirement 8: Performance Requirements

**User Story:** As a user, I want fast and responsive interactions, so that the system feels snappy and doesn't block my workflow.

#### Acceptance Criteria

1. THE Adaptive_RAG direct response SHALL complete within 2 seconds
2. THE Multi-Agent sequential analysis SHALL complete within 30 seconds
3. THE LightRAG query SHALL return within 1 second
4. WHILE analysis runs, THE system SHALL provide progress updates at least every 3 seconds
5. THE system SHALL cache Agent analysis results for 5 minutes
6. THE system SHALL cache LightRAG query results for 10 minutes

### Requirement 9: Error Handling and Fallback

**User Story:** As a user, I want the system to gracefully handle failures, so that I always get some useful response even when components fail.

#### Acceptance Criteria

1. IF a single Agent fails, THEN THE Agent_Orchestrator SHALL continue with remaining Agents
2. IF Adaptive_RAG fails, THEN THE Unified_Intelligence_Service SHALL fallback to simple RAG
3. IF LightRAG is unavailable, THEN THE system SHALL use Supabase vector search
4. THE system SHALL display friendly error messages with retry options
5. THE system SHALL log all errors for debugging

### Requirement 10: Backward Compatibility

**User Story:** As a developer, I want the new unified system to be backward compatible, so that existing integrations continue to work.

#### Acceptance Criteria

1. THE existing API endpoints SHALL continue to function unchanged
2. THE system SHALL support disabling unified intelligence via environment variable
3. THE database schema changes SHALL be backward compatible
4. THE existing ragService.getInvestmentContext() API SHALL remain functional

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         User Interface Layer                             │
├─────────────────────────────────────────────────────────────────────────┤
│  RiskCenter    │  DecisionCenter  │  DailyBriefing  │  VoiceWidget      │
│  (AI Panel)    │  (Chat/Analysis) │  (Modal)        │  (WebRTC)         │
└───────┬────────┴────────┬─────────┴────────┬────────┴────────┬──────────┘
        │                 │                  │                 │
        └─────────────────┼──────────────────┼─────────────────┘
                          ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Unified Intelligence Service                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      Query Classifier                               │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │ │
│  │  │   Simple    │    │   Complex   │    │   Analysis  │             │ │
│  │  │  (RAG only) │    │ (RAG+Agent) │    │ (Full Agent)│             │ │
│  │  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘             │ │
│  └─────────┼──────────────────┼──────────────────┼────────────────────┘ │
│            │                  │                  │                      │
│            ▼                  ▼                  ▼                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Adaptive RAG Layer                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │   │
│  │  │ Query Router │→ │Doc Grader   │→ │Hallucination │           │   │
│  │  │ (LLM-based)  │  │(Relevance)  │  │   Grader     │           │   │
│  │  └──────┬───────┘  └──────────────┘  └──────────────┘           │   │
│  │         │                                                        │   │
│  │    ┌────┴────┬────────────┐                                      │   │
│  │    ▼         ▼            ▼                                      │   │
│  │ vectorstore  structured   websearch                              │   │
│  │    │         data         │                                      │   │
│  │    ▼         │            │                                      │   │
│  │ ┌────────┐   │            │                                      │   │
│  │ │LightRAG│   │            │                                      │   │
│  │ │(Graph) │   │            │                                      │   │
│  │ └────────┘   │            │                                      │   │
│  └──────────────┼────────────┼──────────────────────────────────────┘   │
│                 │            │                                          │
│  ┌──────────────┼────────────┼──────────────────────────────────────┐   │
│  │              ▼            ▼         Multi-Agent Orchestrator      │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │   │
│  │  │Position │→│  Risk   │→│ Market  │→│  Web    │→│ Advisor │    │   │
│  │  │Analyst  │ │ Analyst │ │ Analyst │ │ Surfer  │ │         │    │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘    │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │   │
│  │  │MemoryManager │ │ AlertManager │ │ StateManager │              │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      Voice Service (Python)                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │   │
│  │  │ FastRTC  │  │   STT    │  │   TTS    │  │ Context  │         │   │
│  │  │ Stream   │  │Moonshine │  │  Kokoro  │  │ Fetcher  │         │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Integration Points Summary

| 组件 | 当前实现 | 目标集成 | 优先级 |
|------|----------|----------|--------|
| Adaptive RAG + LightRAG | 独立运行 | 统一检索层 | P0 |
| Multi-Agent + Adaptive RAG | 独立运行 | Agent 使用 RAG 质量控制 | P0 |
| RiskCenter AI Panel | 原始 API | UnifiedIntelligenceService | P0 |
| InvestmentMirror Chat | RAG + API | 统一智能系统 | P0 |
| Daily Briefing | aiService | Multi-Agent + RAG | P1 |
| Voice Service | context_fetcher | Agent 结果 + Adaptive RAG | P2 |
| AgentDemo | 基础展示 | 完整测试平台 | P1 |

## Success Criteria

1. Adaptive RAG 的 vectorstore 路由优先使用 LightRAG
2. Agent 生成的回答经过 Hallucination Grader 检验
3. RiskCenter AI 分析使用统一智能系统，显示各 Agent 进度
4. 聊天支持快速响应（简单问题）和深度分析（复杂问题）
5. 每日洞察包含多 Agent 的综合分析
6. 语音服务获取 Agent 分析结果作为上下文
7. 所有集成点的响应时间符合要求
8. 原有功能不受影响（向后兼容）
