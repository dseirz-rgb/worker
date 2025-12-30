# Design Document: Multi-Agent Investment Analysis System

## Overview

本设计将现有的单次 AI 调用风控研报系统升级为多 Agent 协作架构。采用 TypeScript 实现，借鉴 AutoGen 和 CrewAI 的设计模式，支持多种编排模式（Sequential、Selector、Handoff），在前端服务中协调多个专业化 Agent 完成深度投资分析。

### 设计目标

1. **专业化分工**：每个 Agent 专注一个领域，产出更深入的分析
2. **灵活编排**：支持顺序执行、LLM 选择、Agent 交接三种模式
3. **数据增强**：集成 SEC 财报、实时新闻、网页抓取等外部数据源
4. **状态持久化**：支持保存和恢复执行状态
5. **可扩展性**：模块化设计，便于添加新 Agent 或数据源
6. **向后兼容**：新报告格式兼容现有 UI 组件
7. **上下文管理**：借鉴 AutoGen TransformMessages，自动处理长上下文问题
8. **智能警报**：AI 分析发现风险时自动触发通知，集成现有 riskAlertService

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (React)                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   RiskCenter.tsx                         │   │
│  │  - 触发报告生成                                          │   │
│  │  - 显示进度状态                                          │   │
│  │  - 渲染最终报告                                          │   │
│  │  - 订阅 Alert 事件                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              multiAgentService.ts (NEW)                  │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │              AgentOrchestrator                   │    │   │
│  │  │  - Sequential / Selector / Handoff modes         │    │   │
│  │  │  - Context accumulation                          │    │   │
│  │  │  - State persistence                             │    │   │
│  │  │  - Progress events                               │    │   │
│  │  │  - Alert event emission                          │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                          │                               │   │
│  │  ┌───────────────────────┴───────────────────────┐      │   │
│  │  │           TransformMessages (NEW)              │      │   │
│  │  │  - MessageHistoryLimiter                       │      │   │
│  │  │  - MessageTokenLimiter                         │      │   │
│  │  │  - TransformChain                              │      │   │
│  │  └────────────────────────────────────────────────┘      │   │
│  │                          │                               │   │
│  │    ┌─────────┬───────────┼───────────┬─────────┐        │   │
│  │    ▼         ▼           ▼           ▼         ▼        │   │
│  │ ┌──────┐ ┌──────┐   ┌──────┐   ┌──────┐  ┌──────┐      │   │
│  │ │Pos.  │ │Risk  │   │Market│   │Web   │  │Advisor│     │   │
│  │ │Agent │ │Agent │   │Agent │   │Surfer│  │Agent │      │   │
│  │ └──────┘ └──────┘   └──────┘   └──────┘  └──────┘      │   │
│  │                          │                               │   │
│  │  ┌───────────────────────┴───────────────────────┐      │   │
│  │  │           AgentAlertManager (NEW)              │      │   │
│  │  │  - Check thresholds after each agent           │      │   │
│  │  │  - Emit alerts to riskAlertService             │      │   │
│  │  │  - Cooldown management                         │      │   │
│  │  └────────────────────────────────────────────────┘      │   │
│  │                          │                               │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │              StateManager / CacheManager          │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              dataSourceAdapters.ts (NEW)                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ Serper   │  │ SEC API  │  │ Jina     │              │   │
│  │  │ Adapter  │  │ Adapter  │  │ Adapter  │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              riskAlertService.ts (EXISTING)              │   │
│  │  - Toast notifications                                   │   │
│  │  - Browser notifications                                 │   │
│  │  - Email notifications (critical)                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     External Services                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Gemini   │  │ Serper   │  │ SEC      │  │ Jina     │       │
│  │ API      │  │ API      │  │ EDGAR    │  │ Reader   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Agent Interface

```typescript
/**
 * Base interface for all analysis agents (inspired by AutoGen + Agno + Stockagent)
 */
interface Agent {
  /** Unique identifier for the agent */
  id: string;
  
  /** Human-readable role description */
  role: string;
  
  /** Agent's primary goal */
  goal: string;
  
  /** Description for LLM selector mode */
  description: string;
  
  /** List of tools/data sources this agent can use */
  tools: string[];
  
  /** Agent personality configuration (inspired by Stockagent) */
  personality?: AgentPersonality;
  
  /** Memory configuration (inspired by Agno agentic_memory) */
  memory?: AgentMemoryConfig;
  
  /**
   * Execute the agent's analysis task
   * @param context - Accumulated context from previous agents
   * @param portfolio - Current portfolio state
   * @returns Agent's analysis result or HandoffMessage
   */
  execute(context: AgentContext, portfolio: PortfolioState): Promise<AgentResult | HandoffMessage>;
  
  /**
   * Save agent's internal state for persistence
   */
  saveState(): AgentState;
  
  /**
   * Restore agent's internal state
   */
  loadState(state: AgentState): void;
}

/**
 * Agent personality types (inspired by Stockagent character system)
 * Affects decision-making style and risk tolerance
 */
interface AgentPersonality {
  /** Risk tolerance level affects recommendation aggressiveness */
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  
  /** Decision style affects analysis depth vs speed tradeoff */
  decisionStyle: 'data-driven' | 'intuitive' | 'balanced';
  
  /** Custom personality traits for prompt engineering */
  traits?: string[];
}

/**
 * Memory configuration for agents (inspired by Agno enable_agentic_memory)
 */
interface AgentMemoryConfig {
  /** Enable short-term memory within session */
  shortTermEnabled: boolean;
  
  /** Enable long-term memory across sessions */
  longTermEnabled: boolean;
  
  /** Maximum entries in long-term memory */
  maxLongTermEntries: number;
  
  /** Memory retrieval strategy */
  retrievalStrategy: 'recency' | 'relevance' | 'hybrid';
}

/**
 * Long-term memory entry for cross-session learning
 */
interface MemoryEntry {
  id: string;
  agentId: string;
  type: 'insight' | 'pattern' | 'decision' | 'outcome';
  content: string;
  context: Record<string, any>;
  importance: number; // 0-1 score
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

/**
 * Message for agent-to-agent handoff (inspired by AutoGen Swarm)
 */
interface HandoffMessage {
  type: 'handoff';
  /** Source agent ID */
  from: string;
  /** Target agent ID */
  to: string;
  /** Reason for handoff */
  reason: string;
  /** Additional context for target agent */
  context?: Record<string, any>;
}

/**
 * Agent state for persistence
 */
interface AgentState {
  agentId: string;
  timestamp: number;
  internalState: Record<string, any>;
  messageHistory: AgentMessage[];
}

/**
 * Context object passed between agents
 */
interface AgentContext {
  /** User's query or analysis request */
  query: string;
  
  /** Results from previously executed agents */
  previousResults: Map<string, AgentResult>;
  
  /** User's investment notes and principles */
  userNotes: string;
  
  /** Cached external data */
  externalData: ExternalDataCache;
  
  /** Message thread for selector/handoff modes */
  messageThread: AgentMessage[];
  
  /** Current orchestration mode */
  mode: 'sequential' | 'selector' | 'handoff';
}

/**
 * Standard result format for all agents
 */
interface AgentResult {
  /** Agent ID that produced this result */
  agentId: string;
  
  /** Execution status */
  status: 'success' | 'partial' | 'failed';
  
  /** Structured analysis data */
  data: Record<string, any>;
  
  /** Human-readable summary */
  summary: string;
  
  /** Execution metadata */
  metadata: {
    executionTimeMs: number;
    tokensUsed: number;
    dataSources: string[];
  };
}
```

### 2. Agent Orchestrator (Multi-Mode)

```typescript
/**
 * Orchestration mode configuration
 * Extended with 'respond_directly' mode inspired by Agno Team delegation
 */
type OrchestrationMode = 'sequential' | 'selector' | 'handoff' | 'respond_directly';

/**
 * Extended thinking configuration (inspired by Agno + Claude)
 * Enables deeper reasoning for complex analysis scenarios
 */
interface ExtendedThinkingConfig {
  /** Enable extended thinking mode */
  enabled: boolean;
  /** Token budget for thinking (default: 1024) */
  budgetTokens: number;
  /** Trigger conditions for extended thinking */
  triggers: {
    /** Enable for CRITICAL risk scenarios */
    criticalRisk: boolean;
    /** Enable for complex multi-factor decisions */
    complexDecision: boolean;
    /** Enable when user explicitly requests deep analysis */
    userRequested: boolean;
  };
}

/**
 * Coordinates execution of multiple agents with different modes
 * Inspired by AutoGen's RoundRobinGroupChat, SelectorGroupChat, Swarm, and Agno Team
 */
class AgentOrchestrator {
  private agents: Map<string, Agent>;
  private cacheManager: CacheManager;
  private stateManager: StateManager;
  private memoryManager: AgentMemoryManager;
  private mode: OrchestrationMode;
  private extendedThinking: ExtendedThinkingConfig;
  
  constructor(
    agents: Agent[], 
    cacheManager: CacheManager,
    options: { 
      mode?: OrchestrationMode;
      extendedThinking?: ExtendedThinkingConfig;
    } = {}
  ) {
    this.agents = new Map(agents.map(a => [a.id, a]));
    this.cacheManager = cacheManager;
    this.stateManager = new StateManager();
    this.memoryManager = new AgentMemoryManager();
    this.mode = options.mode || 'sequential';
    this.extendedThinking = options.extendedThinking || {
      enabled: true,
      budgetTokens: 1024,
      triggers: { criticalRisk: true, complexDecision: true, userRequested: true }
    };
  }
  
  /**
   * Execute agents based on configured mode
   */
  async execute(
    portfolio: PortfolioState,
    options: ExecutionOptions,
    onProgress?: (status: ProgressStatus) => void
  ): Promise<OrchestratorResult> {
    const context = await this.buildContext(options);
    
    // Load long-term memories for relevant agents
    await this.loadAgentMemories(context);
    
    switch (this.mode) {
      case 'sequential':
        return this.executeSequential(context, portfolio, onProgress);
      case 'selector':
        return this.executeSelector(context, portfolio, onProgress);
      case 'handoff':
        return this.executeHandoff(context, portfolio, onProgress);
      case 'respond_directly':
        return this.executeRespondDirectly(context, portfolio, onProgress);
    }
  }
  
  /**
   * Respond Directly mode: Advisor handles simple queries without delegation
   * Inspired by Agno Team's "respond_directly" delegation strategy
   */
  private async executeRespondDirectly(
    context: AgentContext,
    portfolio: PortfolioState,
    onProgress?: (status: ProgressStatus) => void
  ): Promise<OrchestratorResult> {
    // First, check if query is simple enough for direct response
    const complexity = await this.assessQueryComplexity(context.query, portfolio);
    
    if (complexity === 'simple') {
      // Advisor responds directly without calling other agents
      onProgress?.({
        currentAgent: 'advisor',
        phase: 'Direct Response',
        progress: 50,
        message: 'Simple query - responding directly'
      });
      
      const advisor = this.agents.get('advisor')!;
      const result = await advisor.execute(context, portfolio);
      
      return this.buildOrchestratorResult([result as AgentResult]);
    }
    
    // For complex queries, fall back to sequential mode
    return this.executeSequential(context, portfolio, onProgress);
  }
  
  /**
   * Assess query complexity to determine if direct response is appropriate
   */
  private async assessQueryComplexity(
    query: string,
    portfolio: PortfolioState
  ): Promise<'simple' | 'moderate' | 'complex'> {
    // Simple heuristics + optional LLM classification
    const simplePatterns = [
      /what is my (total|current) (value|balance)/i,
      /how many (positions|stocks)/i,
      /list my (holdings|positions)/i,
      /what('s| is) my (largest|biggest) position/i,
    ];
    
    if (simplePatterns.some(p => p.test(query))) {
      return 'simple';
    }
    
    // Complex indicators
    const complexIndicators = [
      portfolio.positions.length > 20,
      query.includes('stress test'),
      query.includes('scenario'),
      query.includes('recommendation'),
      query.includes('should I'),
    ];
    
    if (complexIndicators.filter(Boolean).length >= 2) {
      return 'complex';
    }
    
    return 'moderate';
  }
  
  /**
   * Sequential mode: Execute agents in predefined order
   */
  private async executeSequential(
    context: AgentContext,
    portfolio: PortfolioState,
    onProgress?: (status: ProgressStatus) => void
  ): Promise<OrchestratorResult> {
    const agentOrder = ['position_analyst', 'risk_analyst', 'market_analyst', 'advisor'];
    const results: AgentResult[] = [];
    
    for (const agentId of agentOrder) {
      const agent = this.agents.get(agentId);
      if (!agent) continue;
      
      onProgress?.({
        currentAgent: agent.id,
        phase: agent.role,
        progress: (results.length / agentOrder.length) * 100
      });
      
      try {
        const result = await agent.execute(context, portfolio);
        if (this.isHandoffMessage(result)) {
          // In sequential mode, ignore handoffs
          continue;
        }
        results.push(result);
        context.previousResults.set(agent.id, result);
      } catch (error) {
        results.push(this.createFallbackResult(agent, error));
      }
    }
    
    return this.buildOrchestratorResult(results);
  }
  
  /**
   * Selector mode: LLM chooses next agent based on context
   * Inspired by AutoGen's SelectorGroupChat
   */
  private async executeSelector(
    context: AgentContext,
    portfolio: PortfolioState,
    onProgress?: (status: ProgressStatus) => void
  ): Promise<OrchestratorResult> {
    const results: AgentResult[] = [];
    const maxIterations = 10;
    let currentAgent = this.agents.get('position_analyst')!;
    
    for (let i = 0; i < maxIterations; i++) {
      onProgress?.({
        currentAgent: currentAgent.id,
        phase: currentAgent.role,
        progress: (i / maxIterations) * 100,
        message: `LLM selected: ${currentAgent.role}`
      });
      
      const result = await currentAgent.execute(context, portfolio);
      
      if (this.isHandoffMessage(result)) {
        // Agent requested specific handoff
        currentAgent = this.agents.get(result.to)!;
        continue;
      }
      
      results.push(result);
      context.previousResults.set(currentAgent.id, result);
      context.messageThread.push({
        agentId: currentAgent.id,
        content: result.summary,
        timestamp: Date.now()
      });
      
      // Check if advisor has completed (termination condition)
      if (currentAgent.id === 'advisor') break;
      
      // LLM selects next agent
      currentAgent = await this.selectNextAgent(context, portfolio);
    }
    
    return this.buildOrchestratorResult(results);
  }
  
  /**
   * Use LLM to select the most appropriate next agent
   */
  private async selectNextAgent(
    context: AgentContext,
    portfolio: PortfolioState
  ): Promise<Agent> {
    const agentDescriptions = Array.from(this.agents.values())
      .map(a => `- ${a.id}: ${a.description}`)
      .join('\n');
    
    const prompt = `Based on the current analysis progress, select the next agent to execute.

Available agents:
${agentDescriptions}

Current progress:
${context.messageThread.map(m => `[${m.agentId}]: ${m.content}`).join('\n')}

Respond with just the agent ID.`;

    const response = await this.callLLM(prompt);
    const agentId = response.trim();
    
    return this.agents.get(agentId) || this.agents.get('advisor')!;
  }
  
  /**
   * Handoff mode: Agents explicitly transfer control
   * Inspired by AutoGen's Swarm
   */
  private async executeHandoff(
    context: AgentContext,
    portfolio: PortfolioState,
    onProgress?: (status: ProgressStatus) => void
  ): Promise<OrchestratorResult> {
    const results: AgentResult[] = [];
    const maxIterations = 15;
    let currentAgent = this.agents.get('position_analyst')!;
    
    for (let i = 0; i < maxIterations; i++) {
      onProgress?.({
        currentAgent: currentAgent.id,
        phase: currentAgent.role,
        progress: (i / maxIterations) * 100
      });
      
      const result = await currentAgent.execute(context, portfolio);
      
      if (this.isHandoffMessage(result)) {
        // Process handoff
        const targetAgent = this.agents.get(result.to);
        if (targetAgent) {
          context.messageThread.push({
            agentId: currentAgent.id,
            content: `Handoff to ${result.to}: ${result.reason}`,
            timestamp: Date.now()
          });
          currentAgent = targetAgent;
        }
        continue;
      }
      
      results.push(result);
      context.previousResults.set(currentAgent.id, result);
      
      // Termination: advisor completed without handoff
      if (currentAgent.id === 'advisor') break;
      
      // Default progression if no handoff
      currentAgent = this.getDefaultNextAgent(currentAgent.id);
    }
    
    return this.buildOrchestratorResult(results);
  }
  
  /**
   * Save complete orchestrator state
   */
  async saveState(): Promise<OrchestratorState> {
    const agentStates = new Map<string, AgentState>();
    for (const [id, agent] of this.agents) {
      agentStates.set(id, agent.saveState());
    }
    
    return {
      mode: this.mode,
      agentStates,
      cacheState: this.cacheManager.getState(),
      timestamp: Date.now()
    };
  }
  
  /**
   * Restore orchestrator from saved state
   */
  async loadState(state: OrchestratorState): Promise<void> {
    this.mode = state.mode;
    for (const [id, agentState] of state.agentStates) {
      const agent = this.agents.get(id);
      if (agent) {
        agent.loadState(agentState);
      }
    }
    this.cacheManager.setState(state.cacheState);
  }
}
```

### 3. Position Analyst Agent

```typescript
/**
 * Analyzes portfolio structure, concentration, and performance attribution
 */
class PositionAnalystAgent implements Agent {
  id = 'position_analyst';
  role = 'Portfolio Structure Analyst';
  goal = 'Analyze portfolio concentration, correlation risks, and performance attribution';
  tools = ['portfolio_data', 'rag_knowledge'];
  
  async execute(context: AgentContext, portfolio: PortfolioState): Promise<AgentResult> {
    // 1. Calculate concentration metrics
    const concentrationAnalysis = this.analyzeConcentration(portfolio.positions);
    
    // 2. Identify correlation risks
    const correlationRisks = this.analyzeCorrelations(portfolio.positions);
    
    // 3. Calculate performance attribution
    const performanceAttribution = this.analyzePerformance(portfolio);
    
    // 4. Generate AI summary using Gemini
    const summary = await this.generateSummary({
      concentrationAnalysis,
      correlationRisks,
      performanceAttribution,
      userNotes: context.userNotes
    });
    
    return {
      agentId: this.id,
      status: 'success',
      data: {
        concentration_analysis: concentrationAnalysis,
        correlation_risks: correlationRisks,
        performance_attribution: performanceAttribution
      },
      summary,
      metadata: { /* ... */ }
    };
  }
  
  private analyzeConcentration(positions: Position[]): ConcentrationAnalysis {
    const sorted = [...positions].sort((a, b) => b.weight - a.weight);
    const top3 = sorted.slice(0, 3);
    const top3Weight = top3.reduce((sum, p) => sum + p.weight, 0);
    
    return {
      top3_positions: top3.map(p => ({ ticker: p.ticker, weight: p.weight })),
      top3_total_weight: top3Weight,
      high_concentration_flags: positions
        .filter(p => p.weight > 30)
        .map(p => p.ticker),
      herfindahl_index: this.calculateHHI(positions)
    };
  }
}
```

### 4. Risk Analyst Agent

```typescript
/**
 * Performs quantitative risk analysis and stress testing
 */
class RiskAnalystAgent implements Agent {
  id = 'risk_analyst';
  role = 'Quantitative Risk Analyst';
  goal = 'Analyze drawdown, perform stress tests, and assess leverage safety';
  tools = ['portfolio_data', 'risk_metrics'];
  
  async execute(context: AgentContext, portfolio: PortfolioState): Promise<AgentResult> {
    // 1. Drawdown analysis
    const drawdownAnalysis = this.analyzeDrawdown(portfolio);
    
    // 2. Stress test scenarios
    const stressTests = this.performStressTests(portfolio);
    
    // 3. Leverage assessment
    const leverageAssessment = this.assessLeverage(portfolio);
    
    // 4. Determine risk level
    const riskLevel = this.determineRiskLevel(drawdownAnalysis, leverageAssessment);
    
    // 5. Generate AI summary
    const summary = await this.generateSummary({
      drawdownAnalysis,
      stressTests,
      leverageAssessment,
      riskLevel,
      positionAnalysis: context.previousResults.get('position_analyst')
    });
    
    return {
      agentId: this.id,
      status: 'success',
      data: {
        drawdown_analysis: drawdownAnalysis,
        stress_tests: stressTests,
        leverage_assessment: leverageAssessment,
        risk_level: riskLevel
      },
      summary,
      metadata: { /* ... */ }
    };
  }
  
  private performStressTests(portfolio: PortfolioState): StressTestResult[] {
    const scenarios = [-10, -20, -30];
    return scenarios.map(drop => ({
      scenario: `Market ${drop}%`,
      portfolio_impact: this.calculateImpact(portfolio, drop / 100),
      margin_call_risk: this.assessMarginCallRisk(portfolio, drop / 100),
      recovery_needed: this.calculateRecoveryNeeded(drop)
    }));
  }
}
```

### 5. Market Analyst Agent

```typescript
/**
 * Analyzes market conditions using external data sources
 */
class MarketAnalystAgent implements Agent {
  id = 'market_analyst';
  role = 'Market Research Analyst';
  goal = 'Gather and analyze market news, SEC filings, and market cycle';
  description = 'Fetches and analyzes real-time news, SEC filings, and market sentiment. Can request web surfing for deeper research.';
  tools = ['serper_api', 'sec_api', 'jina_reader', 'rag_knowledge'];
  
  private serperAdapter: SerperDataSource;
  private secAdapter: SECDataSource;
  private jinaAdapter: JinaDataSource;
  private state: AgentState | null = null;
  
  async execute(context: AgentContext, portfolio: PortfolioState): Promise<AgentResult | HandoffMessage> {
    // 1. Fetch news for top holdings
    const topTickers = this.getTopTickers(portfolio, 5);
    const newsResults = await this.fetchNews(topTickers, context.externalData);
    
    // 2. Analyze sentiment
    const sentimentAnalysis = await this.analyzeSentiment(newsResults);
    
    // 3. Fetch SEC filings for US stocks
    const usStocks = portfolio.positions.filter(p => p.market === 'US');
    const secFilings = await this.fetchSECFilings(usStocks, context.externalData);
    
    // 4. Determine market cycle
    const marketCycle = await this.analyzeMarketCycle(newsResults, context.userNotes);
    
    // 5. Check if deeper web research is needed
    if (this.needsDeeperResearch(newsResults, secFilings)) {
      return {
        type: 'handoff',
        from: this.id,
        to: 'web_surfer',
        reason: 'Need to extract detailed content from SEC filings or news articles',
        context: {
          urls: this.getUrlsForDeepResearch(newsResults, secFilings),
          tickers: topTickers
        }
      };
    }
    
    // 6. Generate AI summary
    const summary = await this.generateSummary({
      newsResults,
      sentimentAnalysis,
      secFilings,
      marketCycle
    });
    
    return {
      agentId: this.id,
      status: newsResults.length > 0 ? 'success' : 'partial',
      data: {
        news_summary: newsResults,
        sentiment_score: sentimentAnalysis,
        market_cycle: marketCycle,
        sec_highlights: secFilings
      },
      summary,
      metadata: { /* ... */ }
    };
  }
  
  saveState(): AgentState {
    return {
      agentId: this.id,
      timestamp: Date.now(),
      internalState: { /* cached data */ },
      messageHistory: []
    };
  }
  
  loadState(state: AgentState): void {
    this.state = state;
  }
  
  private async fetchNews(tickers: string[], cache: ExternalDataCache): Promise<NewsItem[]> {
    const results: NewsItem[] = [];
    
    for (const ticker of tickers) {
      // Check cache first
      const cached = cache.news.get(ticker);
      if (cached && !this.isExpired(cached.timestamp, 3600000)) {
        results.push(...cached.items);
        continue;
      }
      
      // Fetch from Serper
      try {
        const news = await this.serperAdapter.searchNews(`${ticker} stock news`);
        results.push(...news);
        cache.news.set(ticker, { items: news, timestamp: Date.now() });
      } catch (error) {
        console.warn(`Failed to fetch news for ${ticker}:`, error);
      }
    }
    
    return results;
  }
}
```

### 5.1 Web Surfer Agent

```typescript
/**
 * Browses and extracts content from web pages
 * Inspired by AutoGen's MultimodalWebSurfer
 */
class WebSurferAgent implements Agent {
  id = 'web_surfer';
  role = 'Web Content Extractor';
  goal = 'Extract and analyze content from financial websites and SEC filings';
  description = 'Browses web pages and extracts structured content. Useful for detailed SEC filing analysis or news article extraction.';
  tools = ['jina_reader', 'content_parser'];
  
  private jinaAdapter: JinaDataSource;
  private cache: Map<string, CachedContent> = new Map();
  
  async execute(context: AgentContext, portfolio: PortfolioState): Promise<AgentResult> {
    // Get URLs from handoff context or default to SEC filings
    const urls = context.messageThread
      .filter(m => m.agentId === 'market_analyst')
      .flatMap(m => (m as any).context?.urls || []);
    
    const extractedContent: ExtractedContent[] = [];
    
    for (const url of urls) {
      // Check cache first (1 hour TTL)
      const cached = this.cache.get(url);
      if (cached && Date.now() - cached.timestamp < 3600000) {
        extractedContent.push(cached.content);
        continue;
      }
      
      try {
        const content = await this.extractContent(url);
        extractedContent.push(content);
        this.cache.set(url, { content, timestamp: Date.now() });
      } catch (error) {
        extractedContent.push({
          url,
          title: 'Extraction Failed',
          content: '',
          error: error.message,
          extracted_data: {}
        });
      }
    }
    
    // Analyze extracted content
    const analysis = await this.analyzeContent(extractedContent, context);
    
    return {
      agentId: this.id,
      status: extractedContent.some(c => !c.error) ? 'success' : 'partial',
      data: {
        extracted_content: extractedContent,
        analysis,
        urls_processed: urls.length
      },
      summary: this.generateSummary(extractedContent, analysis),
      metadata: {
        executionTimeMs: 0,
        tokensUsed: 0,
        dataSources: ['jina_reader']
      }
    };
  }
  
  private async extractContent(url: string): Promise<ExtractedContent> {
    // Use Jina Reader for content extraction
    const rawContent = await this.jinaAdapter.fetchArticleContent(url);
    
    // Parse and structure the content
    const parsed = this.parseContent(rawContent, url);
    
    return {
      url,
      title: parsed.title,
      content: parsed.mainContent,
      extracted_data: {
        tables: parsed.tables,
        financialData: parsed.financialData,
        keyPoints: parsed.keyPoints
      }
    };
  }
  
  private parseContent(raw: string, url: string): ParsedContent {
    // Detect content type and parse accordingly
    if (url.includes('sec.gov')) {
      return this.parseSECFiling(raw);
    } else {
      return this.parseNewsArticle(raw);
    }
  }
  
  private parseSECFiling(raw: string): ParsedContent {
    // Extract key sections from SEC filings
    return {
      title: this.extractTitle(raw),
      mainContent: this.extractMainContent(raw),
      tables: this.extractTables(raw),
      financialData: this.extractFinancialData(raw),
      keyPoints: this.extractKeyPoints(raw)
    };
  }
  
  saveState(): AgentState {
    return {
      agentId: this.id,
      timestamp: Date.now(),
      internalState: {
        cacheKeys: Array.from(this.cache.keys())
      },
      messageHistory: []
    };
  }
  
  loadState(state: AgentState): void {
    // Restore cache keys (actual content would need to be refetched)
  }
}

interface ExtractedContent {
  url: string;
  title: string;
  content: string;
  error?: string;
  extracted_data: {
    tables?: any[];
    financialData?: Record<string, any>;
    keyPoints?: string[];
  };
}
```

### 6. Advisor Agent

```typescript
/**
 * Synthesizes all analyses into final recommendations
 * Enhanced with Extended Thinking for complex scenarios (inspired by Agno + Claude)
 */
class AdvisorAgent implements Agent {
  id = 'advisor';
  role = 'Investment Advisor';
  goal = 'Synthesize all analyses and generate actionable recommendations';
  tools = ['all_agent_results', 'rag_knowledge'];
  
  /** Personality affects recommendation style */
  personality: AgentPersonality = {
    riskTolerance: 'moderate',
    decisionStyle: 'data-driven',
    traits: ['thorough', 'cautious', 'principle-aligned']
  };
  
  /** Memory for learning from past recommendations */
  memory: AgentMemoryConfig = {
    shortTermEnabled: true,
    longTermEnabled: true,
    maxLongTermEntries: 100,
    retrievalStrategy: 'relevance'
  };
  
  private extendedThinkingConfig: ExtendedThinkingConfig;
  
  async execute(context: AgentContext, portfolio: PortfolioState): Promise<AgentResult> {
    // 1. Gather all previous results
    const positionAnalysis = context.previousResults.get('position_analyst');
    const riskAnalysis = context.previousResults.get('risk_analyst');
    const marketAnalysis = context.previousResults.get('market_analyst');
    
    // 2. Retrieve relevant long-term memories
    const relevantMemories = await this.retrieveRelevantMemories(context, portfolio);
    
    // 3. Determine if extended thinking is needed
    const useExtendedThinking = this.shouldUseExtendedThinking(
      riskAnalysis,
      context.query
    );
    
    // 4. Cross-reference with user principles
    const principleAlignment = await this.checkPrincipleAlignment(
      portfolio,
      context.userNotes,
      { positionAnalysis, riskAnalysis, marketAnalysis }
    );
    
    // 5. Generate prioritized action plan (with optional extended thinking)
    const actionPlan = await this.generateActionPlan({
      portfolio,
      positionAnalysis,
      riskAnalysis,
      marketAnalysis,
      principleAlignment,
      relevantMemories,
      useExtendedThinking
    });
    
    // 6. Generate comprehensive report
    const report = await this.generateFinalReport({
      positionAnalysis,
      riskAnalysis,
      marketAnalysis,
      principleAlignment,
      actionPlan,
      useExtendedThinking
    });
    
    // 7. Store important insights to long-term memory
    await this.storeInsightsToMemory(report, portfolio);
    
    return {
      agentId: this.id,
      status: 'success',
      data: {
        risk_level: this.determineOverallRiskLevel(riskAnalysis),
        summary: report.summary,
        detailed_analysis: report.content,
        action_items: actionPlan,
        principle_alignment: principleAlignment,
        extended_thinking_used: useExtendedThinking
      },
      summary: report.summary,
      metadata: { /* ... */ }
    };
  }
  
  /**
   * Determine if extended thinking should be used
   * Based on risk level and query complexity
   */
  private shouldUseExtendedThinking(
    riskAnalysis: AgentResult | undefined,
    query: string
  ): boolean {
    if (!this.extendedThinkingConfig?.enabled) return false;
    
    const triggers = this.extendedThinkingConfig.triggers;
    
    // Trigger on CRITICAL risk
    if (triggers.criticalRisk && riskAnalysis?.data?.risk_level === 'CRITICAL') {
      return true;
    }
    
    // Trigger on complex decision keywords
    if (triggers.complexDecision) {
      const complexKeywords = ['rebalance', 'strategy', 'long-term', 'scenario'];
      if (complexKeywords.some(k => query.toLowerCase().includes(k))) {
        return true;
      }
    }
    
    // Trigger on user request
    if (triggers.userRequested) {
      const requestKeywords = ['think carefully', 'deep analysis', 'thorough'];
      if (requestKeywords.some(k => query.toLowerCase().includes(k))) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Generate action plan with optional extended thinking
   * Extended thinking provides step-by-step reasoning for complex decisions
   */
  private async generateActionPlan(params: {
    portfolio: PortfolioState;
    positionAnalysis: AgentResult | undefined;
    riskAnalysis: AgentResult | undefined;
    marketAnalysis: AgentResult | undefined;
    principleAlignment: PrincipleAlignment;
    relevantMemories: MemoryEntry[];
    useExtendedThinking: boolean;
  }): Promise<ActionItem[]> {
    const { useExtendedThinking, relevantMemories, ...analysisData } = params;
    
    // Build prompt with memory context
    const memoryContext = relevantMemories.length > 0
      ? `\n\nRelevant past insights:\n${relevantMemories.map(m => `- ${m.content}`).join('\n')}`
      : '';
    
    if (useExtendedThinking) {
      // Use Claude's extended thinking for complex scenarios
      const response = await this.callLLMWithExtendedThinking({
        prompt: this.buildActionPlanPrompt(analysisData) + memoryContext,
        thinkingBudget: this.extendedThinkingConfig.budgetTokens
      });
      
      return this.parseActionPlan(response);
    }
    
    // Standard generation
    const response = await this.callLLM(
      this.buildActionPlanPrompt(analysisData) + memoryContext
    );
    return this.parseActionPlan(response);
  }
  
  /**
   * Call LLM with extended thinking enabled
   * Inspired by Agno's Claude integration with thinking parameter
   */
  private async callLLMWithExtendedThinking(params: {
    prompt: string;
    thinkingBudget: number;
  }): Promise<string> {
    // For Gemini, use structured prompting to simulate extended thinking
    // For Claude, would use: thinking: { type: "enabled", budget_tokens: params.thinkingBudget }
    const extendedPrompt = `
You are performing deep analysis. Think step by step before providing your final answer.

<thinking>
Consider the following aspects carefully:
1. What are the key risk factors?
2. What historical patterns are relevant?
3. What are the potential outcomes of each action?
4. How do the recommendations align with stated principles?
</thinking>

${params.prompt}

Provide your reasoning process followed by concrete recommendations.
`;
    
    return this.callLLM(extendedPrompt);
  }
}
```

### 6.1 Agent Memory Manager

```typescript
/**
 * Manages long-term memory for agents across sessions
 * Inspired by Agno's enable_agentic_memory feature
 */
class AgentMemoryManager {
  private storage: MemoryStorage;
  
  constructor(storage?: MemoryStorage) {
    this.storage = storage || new LocalStorageMemory();
  }
  
  /**
   * Store a new memory entry
   */
  async store(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>): Promise<MemoryEntry> {
    const fullEntry: MemoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0
    };
    
    await this.storage.save(fullEntry);
    return fullEntry;
  }
  
  /**
   * Retrieve relevant memories for a given context
   */
  async retrieve(
    agentId: string,
    context: AgentContext,
    options: {
      strategy: 'recency' | 'relevance' | 'hybrid';
      limit: number;
    }
  ): Promise<MemoryEntry[]> {
    const allMemories = await this.storage.getByAgent(agentId);
    
    switch (options.strategy) {
      case 'recency':
        return this.retrieveByRecency(allMemories, options.limit);
      case 'relevance':
        return this.retrieveByRelevance(allMemories, context, options.limit);
      case 'hybrid':
        return this.retrieveHybrid(allMemories, context, options.limit);
    }
  }
  
  /**
   * Retrieve memories by recency (most recent first)
   */
  private retrieveByRecency(memories: MemoryEntry[], limit: number): MemoryEntry[] {
    return memories
      .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
      .slice(0, limit);
  }
  
  /**
   * Retrieve memories by relevance to current context
   * Uses simple keyword matching (could be enhanced with embeddings)
   */
  private async retrieveByRelevance(
    memories: MemoryEntry[],
    context: AgentContext,
    limit: number
  ): Promise<MemoryEntry[]> {
    const queryTerms = this.extractKeyTerms(context.query);
    
    const scored = memories.map(m => ({
      memory: m,
      score: this.calculateRelevanceScore(m, queryTerms, context)
    }));
    
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.memory);
  }
  
  /**
   * Hybrid retrieval: combine recency and relevance
   */
  private async retrieveHybrid(
    memories: MemoryEntry[],
    context: AgentContext,
    limit: number
  ): Promise<MemoryEntry[]> {
    const queryTerms = this.extractKeyTerms(context.query);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    const scored = memories.map(m => {
      const relevanceScore = this.calculateRelevanceScore(m, queryTerms, context);
      const recencyScore = Math.exp(-(now - m.lastAccessedAt) / (7 * dayMs)); // Decay over 7 days
      const importanceScore = m.importance;
      
      // Weighted combination
      const finalScore = 0.5 * relevanceScore + 0.3 * recencyScore + 0.2 * importanceScore;
      
      return { memory: m, score: finalScore };
    });
    
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.memory);
  }
  
  /**
   * Calculate relevance score for a memory
   */
  private calculateRelevanceScore(
    memory: MemoryEntry,
    queryTerms: string[],
    context: AgentContext
  ): number {
    const contentLower = memory.content.toLowerCase();
    const matchCount = queryTerms.filter(term => 
      contentLower.includes(term.toLowerCase())
    ).length;
    
    return matchCount / Math.max(queryTerms.length, 1);
  }
  
  /**
   * Extract key terms from query for relevance matching
   */
  private extractKeyTerms(query: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'my', 'i', 'what', 'how']);
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }
  
  /**
   * Prune old/low-importance memories to stay within limits
   */
  async prune(agentId: string, maxEntries: number): Promise<number> {
    const memories = await this.storage.getByAgent(agentId);
    
    if (memories.length <= maxEntries) return 0;
    
    // Sort by importance * recency, keep top N
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    const scored = memories.map(m => ({
      memory: m,
      score: m.importance * Math.exp(-(now - m.lastAccessedAt) / (30 * dayMs))
    }));
    
    scored.sort((a, b) => b.score - a.score);
    
    const toDelete = scored.slice(maxEntries).map(s => s.memory.id);
    await this.storage.deleteMany(toDelete);
    
    return toDelete.length;
  }
}

/**
 * Memory storage interface
 */
interface MemoryStorage {
  save(entry: MemoryEntry): Promise<void>;
  getByAgent(agentId: string): Promise<MemoryEntry[]>;
  deleteMany(ids: string[]): Promise<void>;
}

/**
 * LocalStorage-based memory storage for browser
 */
class LocalStorageMemory implements MemoryStorage {
  private readonly KEY_PREFIX = 'agent_memory_';
  
  async save(entry: MemoryEntry): Promise<void> {
    const key = `${this.KEY_PREFIX}${entry.agentId}`;
    const existing = this.getAll(entry.agentId);
    existing.push(entry);
    localStorage.setItem(key, JSON.stringify(existing));
  }
  
  async getByAgent(agentId: string): Promise<MemoryEntry[]> {
    return this.getAll(agentId);
  }
  
  async deleteMany(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    // Get all agent IDs and filter their memories
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.KEY_PREFIX)) {
        const agentId = key.replace(this.KEY_PREFIX, '');
        const memories = this.getAll(agentId).filter(m => !idSet.has(m.id));
        localStorage.setItem(key, JSON.stringify(memories));
      }
    }
  }
  
  private getAll(agentId: string): MemoryEntry[] {
    const key = `${this.KEY_PREFIX}${agentId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }
}
```

### 7. Data Source Adapters

```typescript
/**
 * Base interface for external data sources
 */
interface DataSource {
  /** Check if the data source is available */
  isAvailable(): Promise<boolean>;
  
  /** Get cached data if available */
  getCache(key: string): any | null;
  
  /** Set cache with TTL */
  setCache(key: string, data: any, ttlMs: number): void;
}

/**
 * Serper API adapter for news search
 */
class SerperDataSource implements DataSource {
  private apiKey: string;
  private cache: Map<string, CacheEntry>;
  private rateLimiter: RateLimiter;
  
  async searchNews(query: string, limit: number = 5): Promise<NewsItem[]> {
    if (!this.apiKey) return [];
    
    await this.rateLimiter.acquire();
    
    const response = await fetch('https://google.serper.dev/news', {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: query, num: limit })
    });
    
    if (!response.ok) throw new Error(`Serper API error: ${response.status}`);
    
    const data = await response.json();
    return data.news.map((item: any) => ({
      title: item.title,
      snippet: item.snippet,
      source: item.source,
      date: item.date,
      link: item.link
    }));
  }
}

/**
 * SEC EDGAR API adapter for financial filings
 */
class SECDataSource implements DataSource {
  private tickerToCIK: Map<string, string>;
  
  async getLatestFilings(ticker: string, formTypes: string[] = ['10-K', '10-Q']): Promise<SECFiling[]> {
    const cik = await this.getCIK(ticker);
    if (!cik) return [];
    
    const response = await fetch(
      `https://data.sec.gov/submissions/CIK${cik.padStart(10, '0')}.json`,
      { headers: { 'User-Agent': 'InvestmentMirror/1.0' } }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const filings = data.filings.recent;
    
    return formTypes.flatMap(formType => {
      const indices = filings.form
        .map((f: string, i: number) => f === formType ? i : -1)
        .filter((i: number) => i >= 0)
        .slice(0, 2);
      
      return indices.map((i: number) => ({
        form: filings.form[i],
        filingDate: filings.filingDate[i],
        accessionNumber: filings.accessionNumber[i],
        primaryDocument: filings.primaryDocument[i]
      }));
    });
  }
}
```

## Data Models

### Agent Execution Context

```typescript
interface ExecutionOptions {
  query?: string;
  forceRefresh?: boolean;
  includeAgents?: string[];
  excludeAgents?: string[];
  timeout?: number;
  mode?: OrchestrationMode;
  maxIterations?: number;
  /** Extended thinking configuration override */
  extendedThinking?: Partial<ExtendedThinkingConfig>;
  /** Personality override for agents */
  personalityOverride?: Partial<AgentPersonality>;
}

interface ProgressStatus {
  currentAgent: string;
  phase: string;
  progress: number;
  message?: string;
  mode?: OrchestrationMode;
  /** Indicates if extended thinking is active */
  extendedThinkingActive?: boolean;
}

interface OrchestratorResult {
  results: AgentResult[];
  finalReport: FinalReport;
  executionTrace: ExecutionTrace;
  mode: OrchestrationMode;
  /** Memories created during this execution */
  newMemories?: MemoryEntry[];
}

interface OrchestratorState {
  mode: OrchestrationMode;
  agentStates: Map<string, AgentState>;
  cacheState: CacheState;
  timestamp: number;
  /** Memory state for restoration */
  memoryState?: Map<string, MemoryEntry[]>;
}

interface FinalReport {
  title: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  content: string;
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'REBALANCE' | 'WARNING';
  action_plan: string;
  primary_ticker: string;
}

interface ExecutionTrace {
  startTime: number;
  endTime: number;
  totalDurationMs: number;
  mode: OrchestrationMode;
  agentTraces: AgentTrace[];
  handoffs: HandoffTrace[];
}

interface AgentTrace {
  agentId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: string;
  tokensUsed: number;
  dataSources: string[];
  error?: string;
}

interface HandoffTrace {
  from: string;
  to: string;
  reason: string;
  timestamp: number;
}

interface AgentMessage {
  agentId: string;
  content: string;
  timestamp: number;
  type?: 'result' | 'handoff' | 'error';
}
```

### External Data Cache

```typescript
interface ExternalDataCache {
  news: Map<string, { items: NewsItem[]; timestamp: number }>;
  secFilings: Map<string, { filings: SECFiling[]; timestamp: number }>;
  articleContent: Map<string, { content: string; timestamp: number }>;
}

interface NewsItem {
  title: string;
  snippet: string;
  source: string;
  date: string;
  link: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

interface SECFiling {
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string;
  highlights?: string[];
}
```

### Context Management (TransformMessages)

```typescript
/**
 * Message transform interface (inspired by AutoGen's TransformMessages)
 * Transforms are applied to message history before LLM calls
 */
interface MessageTransform {
  /** Transform name for logging */
  name: string;
  
  /**
   * Apply transformation to message array
   * @param messages - Input message array
   * @returns Transformed message array
   */
  applyTransform(messages: AgentMessage[]): AgentMessage[];
}

/**
 * Limits the number of messages in history
 * Keeps only the most recent N messages
 */
class MessageHistoryLimiter implements MessageTransform {
  name = 'MessageHistoryLimiter';
  
  constructor(private maxMessages: number = 10) {}
  
  applyTransform(messages: AgentMessage[]): AgentMessage[] {
    if (messages.length <= this.maxMessages) {
      return messages;
    }
    
    // Keep only the most recent messages
    const trimmed = messages.slice(-this.maxMessages);
    console.log(`[${this.name}] Trimmed ${messages.length} -> ${trimmed.length} messages`);
    return trimmed;
  }
}

/**
 * Limits total tokens in message history
 * Truncates older messages when limit exceeded
 */
class MessageTokenLimiter implements MessageTransform {
  name = 'MessageTokenLimiter';
  
  constructor(
    private maxTokens: number = 4000,
    private maxTokensPerMessage: number = 500,
    private minTokens: number = 1000
  ) {}
  
  applyTransform(messages: AgentMessage[]): AgentMessage[] {
    const totalTokens = this.countTotalTokens(messages);
    
    // Don't transform if below minimum threshold
    if (totalTokens < this.minTokens) {
      return messages;
    }
    
    // First, truncate individual long messages
    let processed = messages.map(msg => this.truncateMessage(msg));
    
    // Then, remove older messages if still over limit
    while (this.countTotalTokens(processed) > this.maxTokens && processed.length > 1) {
      processed = processed.slice(1); // Remove oldest message
    }
    
    console.log(`[${this.name}] Tokens: ${totalTokens} -> ${this.countTotalTokens(processed)}`);
    return processed;
  }
  
  private truncateMessage(msg: AgentMessage): AgentMessage {
    const tokens = this.estimateTokens(msg.content);
    if (tokens <= this.maxTokensPerMessage) {
      return msg;
    }
    
    // Truncate content to fit within limit (rough estimate: 4 chars per token)
    const maxChars = this.maxTokensPerMessage * 4;
    return {
      ...msg,
      content: msg.content.slice(0, maxChars) + '... [truncated]'
    };
  }
  
  private countTotalTokens(messages: AgentMessage[]): number {
    return messages.reduce((sum, msg) => sum + this.estimateTokens(msg.content), 0);
  }
  
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English/code
    // For Chinese: ~1.5 characters per token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }
}

/**
 * Chains multiple transforms together
 */
class TransformChain implements MessageTransform {
  name = 'TransformChain';
  
  constructor(private transforms: MessageTransform[]) {}
  
  applyTransform(messages: AgentMessage[]): AgentMessage[] {
    let result = messages;
    for (const transform of this.transforms) {
      const before = result.length;
      result = transform.applyTransform(result);
      console.log(`[${transform.name}] ${before} -> ${result.length} messages`);
    }
    return result;
  }
}

/**
 * Transform configuration for orchestrator
 */
interface TransformConfig {
  /** Enable transforms (default: true for selector mode) */
  enabled: boolean;
  /** Maximum messages to keep */
  maxMessages?: number;
  /** Maximum total tokens */
  maxTokens?: number;
  /** Maximum tokens per message */
  maxTokensPerMessage?: number;
  /** Minimum tokens before applying transforms */
  minTokens?: number;
}
```

### AI-Triggered Alert System

```typescript
/**
 * Alert event emitted by agents when risks are detected
 */
interface AgentAlertEvent {
  /** Source agent that detected the risk */
  sourceAgent: string;
  /** Alert severity level */
  severity: 'info' | 'warning' | 'critical';
  /** Alert type for categorization */
  alertType: 'RISK_LEVEL' | 'DRAWDOWN' | 'LEVERAGE' | 'SENTIMENT' | 'CONCENTRATION';
  /** Alert title */
  title: string;
  /** Detailed message */
  message: string;
  /** Recommended action */
  recommendation: string;
  /** Supporting data from agent analysis */
  data: Record<string, any>;
  /** Timestamp */
  timestamp: string;
}

/**
 * Alert trigger conditions for each agent
 */
interface AlertTriggerConfig {
  /** Risk Analyst triggers */
  riskAnalyst: {
    drawdownThreshold: number;      // Default: 15%
    leverageThreshold: number;      // Default: 2.5x
  };
  /** Market Analyst triggers */
  marketAnalyst: {
    negativeSentimentThreshold: number;  // Default: -0.5
  };
  /** Advisor triggers */
  advisor: {
    criticalRiskLevel: boolean;     // Default: true
  };
}

const DEFAULT_ALERT_TRIGGERS: AlertTriggerConfig = {
  riskAnalyst: {
    drawdownThreshold: 15,
    leverageThreshold: 2.5,
  },
  marketAnalyst: {
    negativeSentimentThreshold: -0.5,
  },
  advisor: {
    criticalRiskLevel: true,
  },
};

/**
 * Alert manager that integrates with existing riskAlertService
 */
class AgentAlertManager {
  private alertCooldown: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
  
  constructor(
    private config: AlertTriggerConfig = DEFAULT_ALERT_TRIGGERS,
    private onAlert?: (alert: AgentAlertEvent) => void
  ) {}
  
  /**
   * Check agent result and emit alerts if thresholds exceeded
   */
  checkAndEmitAlerts(agentId: string, result: AgentResult): AgentAlertEvent[] {
    const alerts: AgentAlertEvent[] = [];
    
    switch (agentId) {
      case 'risk_analyst':
        alerts.push(...this.checkRiskAnalystAlerts(result));
        break;
      case 'market_analyst':
        alerts.push(...this.checkMarketAnalystAlerts(result));
        break;
      case 'advisor':
        alerts.push(...this.checkAdvisorAlerts(result));
        break;
    }
    
    // Filter by cooldown and emit
    const filteredAlerts = alerts.filter(alert => this.shouldEmit(alert));
    filteredAlerts.forEach(alert => {
      this.updateCooldown(alert);
      this.onAlert?.(alert);
    });
    
    return filteredAlerts;
  }
  
  private checkRiskAnalystAlerts(result: AgentResult): AgentAlertEvent[] {
    const alerts: AgentAlertEvent[] = [];
    const { drawdown_analysis, leverage_assessment } = result.data;
    
    // Check drawdown
    if (drawdown_analysis?.current_drawdown > this.config.riskAnalyst.drawdownThreshold) {
      alerts.push({
        sourceAgent: 'risk_analyst',
        severity: 'critical',
        alertType: 'DRAWDOWN',
        title: '🚨 AI 检测到高回撤风险',
        message: `当前回撤 ${drawdown_analysis.current_drawdown.toFixed(1)}% 超过阈值 ${this.config.riskAnalyst.drawdownThreshold}%`,
        recommendation: '建议减仓或对冲风险敞口',
        data: { drawdown: drawdown_analysis },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Check leverage
    if (leverage_assessment?.current_leverage > this.config.riskAnalyst.leverageThreshold) {
      alerts.push({
        sourceAgent: 'risk_analyst',
        severity: 'critical',
        alertType: 'LEVERAGE',
        title: '🚨 AI 检测到杠杆过高',
        message: `当前杠杆 ${leverage_assessment.current_leverage.toFixed(2)}x 超过阈值 ${this.config.riskAnalyst.leverageThreshold}x`,
        recommendation: '建议立即降低杠杆，减少保证金风险',
        data: { leverage: leverage_assessment },
        timestamp: new Date().toISOString(),
      });
    }
    
    return alerts;
  }
  
  private checkMarketAnalystAlerts(result: AgentResult): AgentAlertEvent[] {
    const alerts: AgentAlertEvent[] = [];
    const { sentiment_score, news_summary } = result.data;
    
    if (sentiment_score < this.config.marketAnalyst.negativeSentimentThreshold) {
      alerts.push({
        sourceAgent: 'market_analyst',
        severity: 'warning',
        alertType: 'SENTIMENT',
        title: '⚠️ AI 检测到负面市场情绪',
        message: `市场情绪评分 ${sentiment_score.toFixed(2)} 低于阈值，主要持仓面临负面新闻`,
        recommendation: '建议关注相关新闻，评估是否需要调整仓位',
        data: { sentiment_score, news_summary },
        timestamp: new Date().toISOString(),
      });
    }
    
    return alerts;
  }
  
  private checkAdvisorAlerts(result: AgentResult): AgentAlertEvent[] {
    const alerts: AgentAlertEvent[] = [];
    const { risk_level, summary, action_items } = result.data;
    
    if (this.config.advisor.criticalRiskLevel && risk_level === 'CRITICAL') {
      alerts.push({
        sourceAgent: 'advisor',
        severity: 'critical',
        alertType: 'RISK_LEVEL',
        title: '🚨 AI 综合分析：风险等级 CRITICAL',
        message: summary,
        recommendation: action_items?.[0]?.action || '请立即查看完整分析报告',
        data: { risk_level, action_items },
        timestamp: new Date().toISOString(),
      });
    }
    
    return alerts;
  }
  
  private shouldEmit(alert: AgentAlertEvent): boolean {
    const key = `${alert.alertType}_${alert.severity}`;
    const lastTime = this.alertCooldown.get(key) || 0;
    return Date.now() - lastTime >= this.COOLDOWN_MS;
  }
  
  private updateCooldown(alert: AgentAlertEvent): void {
    const key = `${alert.alertType}_${alert.severity}`;
    this.alertCooldown.set(key, Date.now());
  }
}

/**
 * Integration with existing riskAlertService
 */
async function sendAgentAlert(alert: AgentAlertEvent): Promise<void> {
  // Convert to existing RiskAlert format
  const riskAlert = {
    id: `AI_${alert.alertType}_${Date.now()}`,
    type: `AI_${alert.alertType}` as any,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    recommendation: alert.recommendation,
    timestamp: alert.timestamp,
    acknowledged: false,
    metrics: alert.data,
  };
  
  // Use existing triggerRiskAlerts function
  await triggerRiskAlerts([riskAlert], 1, {
    sendEmail: alert.severity === 'critical',
    showToast: true,
    browserNotify: true,
  });
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Sequential Context Accumulation

*For any* sequence of N agents executed by the Orchestrator in sequential mode, after execution completes, the context.previousResults map SHALL contain exactly N entries, one for each agent.

**Validates: Requirements 1.2, 1.3**

### Property 2: Agent Interface Compliance

*For any* object implementing the Agent interface, it SHALL have non-empty `id`, `role`, `goal`, `description` string properties, a callable `execute` method that returns a Promise<AgentResult | HandoffMessage>, and `saveState`/`loadState` methods.

**Validates: Requirements 1.1, 1.1.1, 1.1.2, 1.1.3**

### Property 3: Error Resilience

*For any* agent that throws an error during execution, the Orchestrator SHALL continue executing remaining agents and include a fallback result with status='failed' for the failing agent.

**Validates: Requirements 1.4**

### Property 4: Progress Event Emission

*For any* orchestrator execution with N agents and a progress callback, the callback SHALL be invoked at least N times with increasing progress values from 0 to 100.

**Validates: Requirements 1.5, 7.3**

### Property 5: Position Analyst Output Schema

*For any* valid portfolio input, the Position Analyst SHALL return an AgentResult where `data` contains `concentration_analysis`, `correlation_risks`, and `performance_attribution` fields with valid structures.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 6: High Concentration Detection

*For any* portfolio containing a position with weight > 30%, the Position Analyst's `concentration_analysis.high_concentration_flags` array SHALL include that position's ticker.

**Validates: Requirements 2.5**

### Property 7: Risk Analyst Output Schema

*For any* valid portfolio input, the Risk Analyst SHALL return an AgentResult where `data` contains `drawdown_analysis`, `stress_tests` (array of 3 scenarios), and `leverage_assessment` fields.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 8: Critical Risk Level Threshold

*For any* portfolio with drawdown percentage > 15%, the Risk Analyst SHALL set `data.risk_level` to 'CRITICAL'.

**Validates: Requirements 3.5**

### Property 9: Market Analyst Output Schema

*For any* execution of Market Analyst, the result SHALL contain `news_summary`, `sentiment_score`, `market_cycle`, and `sec_highlights` fields, regardless of external API availability.

**Validates: Requirements 4.2, 4.3, 4.5**

### Property 10: External API Fallback

*For any* Market Analyst execution where Serper API fails, the agent SHALL return status='partial' and populate news_summary from cached knowledge base data without throwing an exception.

**Validates: Requirements 4.6, 6.5**

### Property 11: Advisor Agent Context Completeness

*For any* Advisor Agent execution, the context.previousResults map SHALL contain entries for 'position_analyst', 'risk_analyst', and 'market_analyst' before the advisor's execute method is called.

**Validates: Requirements 5.1**

### Property 12: Action Plan Structure

*For any* Advisor Agent output, the `data.action_items` array SHALL contain objects with at least `action`, `ticker`, and `priority` fields.

**Validates: Requirements 5.3, 5.4**

### Property 13: DataSource Interface Compliance

*For any* class implementing DataSource (SerperDataSource, SECDataSource, JinaDataSource), it SHALL have `isAvailable`, `getCache`, and `setCache` methods.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 14: Cache TTL Enforcement

*For any* cached external API response, the cache entry SHALL be considered stale after 3600000ms (1 hour). For agent intermediate results, the TTL SHALL be 900000ms (15 minutes).

**Validates: Requirements 8.1, 8.2**

### Property 15: Cache Bypass with Force Refresh

*For any* orchestrator execution with `options.forceRefresh = true`, all cache lookups SHALL return null/miss, forcing fresh data fetches.

**Validates: Requirements 8.4**

### Property 16: Backward Compatible Report Format

*For any* final report generated by the multi-agent system, it SHALL contain `title`, `risk_level`, `summary`, `content`, `recommendation`, `action_plan`, and `primary_ticker` fields matching the existing FinalReport interface.

**Validates: Requirements 7.2**

### Property 17: Selector Mode Agent Selection

*For any* orchestrator execution in selector mode, the LLM-selected next agent SHALL be one of the registered agents, and the selection SHALL be based on agent descriptions and current context.

**Validates: Requirements 1.6, 1.8**

### Property 18: Handoff Message Routing

*For any* HandoffMessage returned by an agent, the Orchestrator SHALL route execution to the agent specified in the `to` field if that agent exists.

**Validates: Requirements 1.7**

### Property 19: State Persistence Round-Trip

*For any* agent, calling `saveState()` followed by `loadState()` with the returned state SHALL restore the agent to an equivalent internal state.

**Validates: Requirements 1.1.1, 1.1.2, 1.1.3, 1.1.4**

### Property 20: Web Surfer Content Extraction

*For any* valid URL provided to Web_Surfer_Agent, the result SHALL contain `url`, `title`, `content`, and `extracted_data` fields, with `error` field populated if extraction fails.

**Validates: Requirements 4.1.1, 4.1.5, 4.1.6**

### Property 21: Web Surfer Cache Behavior

*For any* URL fetched by Web_Surfer_Agent, subsequent requests within 1 hour SHALL return cached content without making a new HTTP request.

**Validates: Requirements 4.1.7**

### Property 22: Orchestration Mode Configuration

*For any* orchestrator instantiation with a valid mode option ('sequential', 'selector', 'handoff'), the orchestrator SHALL execute using that mode's logic.

**Validates: Requirements 1.9**

### Property 23: MessageHistoryLimiter Correctness

*For any* message array with length > maxMessages, applying MessageHistoryLimiter SHALL return an array with exactly maxMessages elements, containing only the most recent messages in their original order.

**Validates: Requirements 9.2, 9.4**

### Property 24: MessageTokenLimiter Correctness

*For any* message array where total tokens exceed maxTokens, applying MessageTokenLimiter SHALL return an array where total tokens <= maxTokens, with the most recent messages preserved and older messages truncated or removed.

**Validates: Requirements 9.3, 9.5**

### Property 25: MessageTokenLimiter Min Threshold

*For any* message array where total tokens < minTokens, applying MessageTokenLimiter SHALL return the original array unchanged.

**Validates: Requirements 9.6**

### Property 26: MessageTokenLimiter Per-Message Truncation

*For any* message with tokens > maxTokensPerMessage, applying MessageTokenLimiter SHALL truncate that message's content to fit within maxTokensPerMessage.

**Validates: Requirements 9.7**

### Property 27: Transform Chain Composition

*For any* sequence of N transforms in a TransformChain, applying the chain to a message array SHALL be equivalent to applying each transform in sequence, with each transform receiving the output of the previous one.

**Validates: Requirements 9.9**

### Property 28: Selector Mode Transform Application

*For any* orchestrator execution in selector mode with transforms configured, the transforms SHALL be applied to the message thread before each LLM call for agent selection.

**Validates: Requirements 9.8**

### Property 29: Alert Trigger Thresholds

*For any* Risk_Analyst result with drawdown > 15% OR leverage > 2.5x, OR Market_Analyst result with sentiment_score < -0.5, OR Advisor result with risk_level = 'CRITICAL', the AgentAlertManager SHALL emit at least one alert event.

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 30: Alert Content Completeness

*For any* emitted AgentAlertEvent, it SHALL contain non-empty sourceAgent, alertType, title, message, recommendation fields, and the data field SHALL contain relevant metrics from the triggering agent's analysis.

**Validates: Requirements 10.5, 10.7**

### Property 31: Alert Cooldown Enforcement

*For any* two alerts of the same type and severity emitted within 30 minutes, only the first alert SHALL be delivered to notification channels.

**Validates: Requirements 10.6**

### Property 32: Orchestrator Alert Event Emission

*For any* orchestrator execution where agents detect risks exceeding thresholds, the orchestrator SHALL emit 'alert' events that can be subscribed to by UI components.

**Validates: Requirements 10.8**

### Property 33: Respond Directly Mode Query Classification

*For any* orchestrator execution in 'respond_directly' mode with a simple query (matching simple patterns), the orchestrator SHALL execute only the Advisor agent without calling Position, Risk, or Market analysts.

**Validates: Requirements 1.9 (extended)**

### Property 34: Extended Thinking Trigger on Critical Risk

*For any* Advisor Agent execution where Risk Analyst reports risk_level='CRITICAL' and extendedThinking.triggers.criticalRisk is true, the Advisor SHALL use extended thinking mode for generating recommendations.

**Validates: Requirements 5.3, 5.4 (enhanced)**

### Property 35: Agent Personality Influence

*For any* Agent with personality.riskTolerance='conservative', the generated recommendations SHALL prioritize capital preservation over growth opportunities.

**Validates: Requirements 5.2, 5.3 (enhanced)**

### Property 36: Memory Storage Round-Trip

*For any* MemoryEntry stored via AgentMemoryManager.store(), calling retrieve() with the same agentId SHALL return an array containing that entry (assuming no pruning occurred).

**Validates: Requirements 1.1.4, 1.1.5 (extended)**

### Property 37: Memory Retrieval Strategy Compliance

*For any* memory retrieval with strategy='recency', the returned entries SHALL be ordered by lastAccessedAt descending. For strategy='relevance', entries SHALL be ordered by relevance score to the query.

**Validates: Requirements 1.1.4 (extended)**

### Property 38: Memory Pruning Limit Enforcement

*For any* AgentMemoryManager.prune() call with maxEntries=N, the resulting memory count for that agent SHALL be <= N, with lowest importance*recency entries removed first.

**Validates: Requirements 1.1.4 (extended)**

### Property 39: Extended Thinking Budget Compliance

*For any* LLM call with extended thinking enabled, the thinking token budget SHALL not exceed the configured budgetTokens value.

**Validates: Requirements 5.3 (enhanced)**

### Property 40: Orchestration Mode Configuration

*For any* orchestrator instantiation with mode='respond_directly', simple queries SHALL be handled by Advisor alone, while complex queries SHALL fall back to sequential mode.

**Validates: Requirements 1.9 (extended)**

## Error Handling

### Agent Execution Errors

```typescript
class AgentExecutionError extends Error {
  constructor(
    public agentId: string,
    public originalError: Error,
    public context: Partial<AgentContext>
  ) {
    super(`Agent ${agentId} failed: ${originalError.message}`);
  }
}

// Orchestrator error handling
async executeAgent(agent: Agent, context: AgentContext): Promise<AgentResult> {
  try {
    const result = await Promise.race([
      agent.execute(context, this.portfolio),
      this.createTimeout(30000) // 30s per agent
    ]);
    return result;
  } catch (error) {
    console.error(`Agent ${agent.id} failed:`, error);
    
    // Return fallback result
    return {
      agentId: agent.id,
      status: 'failed',
      data: {},
      summary: `Analysis unavailable due to error: ${error.message}`,
      metadata: {
        executionTimeMs: 0,
        tokensUsed: 0,
        dataSources: [],
        error: error.message
      }
    };
  }
}
```

### External API Errors

```typescript
// Data source error handling with fallback
async fetchWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  cacheKey: string
): Promise<T> {
  try {
    const result = await primary();
    this.setCache(cacheKey, result, 3600000);
    return result;
  } catch (error) {
    console.warn(`Primary fetch failed, trying fallback:`, error);
    
    // Try cache first
    const cached = this.getCache(cacheKey);
    if (cached) return cached;
    
    // Then try fallback
    return fallback();
  }
}
```

### Rate Limiting

```typescript
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  
  async acquire(): Promise<void> {
    this.refill();
    
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.refill();
    }
    
    this.tokens -= 1;
  }
}
```

## Testing Strategy

### Unit Tests

Unit tests focus on specific examples and edge cases:

1. **Agent Interface Tests**
   - Verify each agent implements required interface
   - Test agent construction with valid/invalid config

2. **Calculation Tests**
   - Test concentration calculation with known portfolios
   - Test drawdown calculation with known values
   - Test stress test impact calculations

3. **Edge Cases**
   - Empty portfolio handling
   - Single position portfolio
   - All positions below threshold
   - Missing external data

### Property-Based Tests

Property tests verify universal properties across many generated inputs using `fast-check`:

```typescript
import * as fc from 'fast-check';

// Property 1: Sequential Context Accumulation
describe('AgentOrchestrator', () => {
  it('should accumulate results for all agents', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ id: fc.string(), role: fc.string() }), { minLength: 1, maxLength: 5 }),
        async (agentConfigs) => {
          const agents = agentConfigs.map(c => createMockAgent(c));
          const orchestrator = new AgentOrchestrator(agents);
          const result = await orchestrator.execute(mockPortfolio, {});
          
          expect(result.results.length).toBe(agents.length);
          // Each agent's result should be in context
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 6: High Concentration Detection
describe('PositionAnalystAgent', () => {
  it('should flag positions over 30% weight', async () => {
    await fc.assert(
      fc.asyncProperty(
        generatePortfolioWithHighConcentration(),
        async (portfolio) => {
          const agent = new PositionAnalystAgent();
          const result = await agent.execute(mockContext, portfolio);
          
          const highWeightTickers = portfolio.positions
            .filter(p => p.weight > 30)
            .map(p => p.ticker);
          
          const flaggedTickers = result.data.concentration_analysis.high_concentration_flags;
          
          // All high weight tickers should be flagged
          highWeightTickers.forEach(ticker => {
            expect(flaggedTickers).toContain(ticker);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 8: Critical Risk Level Threshold
describe('RiskAnalystAgent', () => {
  it('should set CRITICAL risk level when drawdown > 15%', async () => {
    await fc.assert(
      fc.asyncProperty(
        generatePortfolioWithDrawdown(fc.double({ min: 15.01, max: 50 })),
        async (portfolio) => {
          const agent = new RiskAnalystAgent();
          const result = await agent.execute(mockContext, portfolio);
          
          expect(result.data.risk_level).toBe('CRITICAL');
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Test Configuration

- **Property-based testing library**: `fast-check`
- **Minimum iterations**: 100 per property test
- **Test tagging format**: `Feature: multi-agent-analysis, Property N: {property_text}`

### Integration Tests

1. **Full Pipeline Test**
   - Execute complete multi-agent flow with mock external APIs
   - Verify final report structure and content

2. **External API Integration**
   - Test Serper adapter with real API (rate limited)
   - Test SEC adapter with real EDGAR data
   - Test Jina adapter with sample URLs

3. **Cache Integration**
   - Verify cache hit/miss behavior
   - Test cache expiration
   - Test force refresh bypass
