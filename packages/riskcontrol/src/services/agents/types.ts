/**
 * Multi-Agent Investment Analysis System - Core Type Definitions
 *
 * This module defines all TypeScript interfaces for the multi-agent orchestration
 * framework, inspired by AutoGen, CrewAI, Agno, and Stockagent patterns.
 *
 * @module agents/types
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for detailed design
 */

// =============================================================================
// Agent Personality System (Inspired by Stockagent)
// =============================================================================

/**
 * Risk tolerance levels that affect recommendation aggressiveness.
 * - conservative: Prioritizes capital preservation over growth
 * - moderate: Balanced approach between risk and reward
 * - aggressive: Prioritizes growth opportunities, accepts higher risk
 */
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

/**
 * Decision-making styles that affect analysis depth vs speed tradeoff.
 * - data-driven: Relies heavily on quantitative metrics and historical data
 * - intuitive: Incorporates qualitative factors and market sentiment
 * - balanced: Combines both data-driven and intuitive approaches
 */
export type DecisionStyle = 'data-driven' | 'intuitive' | 'balanced';

/**
 * Agent personality configuration that influences decision-making style
 * and risk tolerance in recommendations.
 *
 * @example
 * ```typescript
 * const conservativePersonality: AgentPersonality = {
 *   riskTolerance: 'conservative',
 *   decisionStyle: 'data-driven',
 *   traits: ['cautious', 'thorough', 'principle-aligned']
 * };
 * ```
 *
 * @see Requirements 1.2.1, 1.2.2, 1.2.3
 */
export interface AgentPersonality {
  /** Risk tolerance level affects recommendation aggressiveness */
  riskTolerance: RiskTolerance;

  /** Decision style affects analysis depth vs speed tradeoff */
  decisionStyle: DecisionStyle;

  /** Custom personality traits for prompt engineering */
  traits?: string[];
}


// =============================================================================
// Agent Memory System (Inspired by Agno agentic_memory)
// =============================================================================

/**
 * Memory retrieval strategies for accessing stored memories.
 * - recency: Returns most recently accessed memories first
 * - relevance: Returns memories most relevant to current query
 * - hybrid: Combines recency, relevance, and importance scores
 */
export type MemoryRetrievalStrategy = 'recency' | 'relevance' | 'hybrid';

/**
 * Types of memory entries that can be stored.
 * - insight: Key observations or learnings from analysis
 * - pattern: Recurring patterns detected across analyses
 * - decision: Important decisions made and their rationale
 * - outcome: Results of past recommendations for learning
 */
export type MemoryEntryType = 'insight' | 'pattern' | 'decision' | 'outcome';

/**
 * Memory configuration for agents enabling cross-session learning.
 *
 * @example
 * ```typescript
 * const memoryConfig: AgentMemoryConfig = {
 *   shortTermEnabled: true,
 *   longTermEnabled: true,
 *   maxLongTermEntries: 100,
 *   retrievalStrategy: 'hybrid'
 * };
 * ```
 *
 * @see Requirements 1.3.1, 1.3.3, 1.3.4
 */
export interface AgentMemoryConfig {
  /** Enable short-term memory within session */
  shortTermEnabled: boolean;

  /** Enable long-term memory across sessions */
  longTermEnabled: boolean;

  /** Maximum entries in long-term memory before pruning */
  maxLongTermEntries: number;

  /** Strategy for retrieving relevant memories */
  retrievalStrategy: MemoryRetrievalStrategy;
}

/**
 * Long-term memory entry for cross-session learning.
 * Stores insights, patterns, decisions, and outcomes for future reference.
 *
 * @example
 * ```typescript
 * const memoryEntry: MemoryEntry = {
 *   id: 'mem_123',
 *   agentId: 'advisor',
 *   type: 'insight',
 *   content: 'High concentration in tech sector increases volatility',
 *   context: { sector: 'technology', concentration: 0.45 },
 *   importance: 0.8,
 *   createdAt: Date.now(),
 *   lastAccessedAt: Date.now(),
 *   accessCount: 0
 * };
 * ```
 *
 * @see Requirements 1.3.2
 */
export interface MemoryEntry {
  /** Unique identifier for the memory entry */
  id: string;

  /** ID of the agent that created this memory */
  agentId: string;

  /** Type of memory entry */
  type: MemoryEntryType;

  /** The actual content/insight stored */
  content: string;

  /** Additional context data associated with the memory */
  context: Record<string, unknown>;

  /** Importance score from 0-1, used for pruning decisions */
  importance: number;

  /** Timestamp when the memory was created */
  createdAt: number;

  /** Timestamp when the memory was last accessed */
  lastAccessedAt: number;

  /** Number of times this memory has been accessed */
  accessCount: number;
}


// =============================================================================
// Agent State Persistence
// =============================================================================

/**
 * Message in the agent communication thread.
 * Used for tracking conversation history between agents.
 *
 * @see Requirements 1.1.1
 */
export interface AgentMessage {
  /** ID of the agent that sent this message */
  agentId: string;

  /** Message content */
  content: string;

  /** Timestamp when the message was created */
  timestamp: number;

  /** Type of message for categorization */
  type?: 'result' | 'handoff' | 'error';
}

/**
 * Serializable agent state for persistence and restoration.
 * Enables saving and resuming interrupted analyses.
 *
 * @example
 * ```typescript
 * const state: AgentState = {
 *   agentId: 'position_analyst',
 *   timestamp: Date.now(),
 *   internalState: { lastAnalyzedTickers: ['AAPL', 'GOOGL'] },
 *   messageHistory: []
 * };
 * ```
 *
 * @see Requirements 1.1.1, 1.1.2, 1.1.3
 */
export interface AgentState {
  /** ID of the agent this state belongs to */
  agentId: string;

  /** Timestamp when the state was saved */
  timestamp: number;

  /** Agent-specific internal state data */
  internalState: Record<string, unknown>;

  /** Message history for context restoration */
  messageHistory: AgentMessage[];
}


// =============================================================================
// Agent Handoff System (Inspired by AutoGen Swarm)
// =============================================================================

/**
 * Message for agent-to-agent handoff.
 * Allows agents to explicitly transfer control to specific agents.
 *
 * @example
 * ```typescript
 * const handoff: HandoffMessage = {
 *   type: 'handoff',
 *   from: 'market_analyst',
 *   to: 'web_surfer',
 *   reason: 'Need to extract detailed content from SEC filings',
 *   context: { urls: ['https://sec.gov/...'], tickers: ['AAPL'] }
 * };
 * ```
 *
 * @see Requirements 1.7
 */
export interface HandoffMessage {
  /** Discriminator for type narrowing */
  type: 'handoff';

  /** Source agent ID initiating the handoff */
  from: string;

  /** Target agent ID to receive control */
  to: string;

  /** Reason for the handoff */
  reason: string;

  /** Additional context for the target agent */
  context?: Record<string, unknown>;
}

/**
 * Type guard to check if a result is a HandoffMessage.
 *
 * @param result - The result to check
 * @returns True if the result is a HandoffMessage
 */
export function isHandoffMessage(
  result: AgentResult | HandoffMessage
): result is HandoffMessage {
  return (result as HandoffMessage).type === 'handoff';
}


// =============================================================================
// Agent Result Types
// =============================================================================

/**
 * Execution status of an agent.
 * - success: Agent completed successfully with full results
 * - partial: Agent completed with some data missing (e.g., API failures)
 * - failed: Agent failed to execute, fallback data provided
 */
export type AgentResultStatus = 'success' | 'partial' | 'failed';

/**
 * Metadata about agent execution for monitoring and debugging.
 *
 * @see Requirements 1.5
 */
export interface AgentResultMetadata {
  /** Time taken to execute the agent in milliseconds */
  executionTimeMs: number;

  /** Number of LLM tokens used during execution */
  tokensUsed: number;

  /** List of data sources accessed during execution */
  dataSources: string[];

  /** Error message if execution failed */
  error?: string;
}

/**
 * Standard result format for all agents.
 * Provides consistent structure for agent outputs.
 *
 * @example
 * ```typescript
 * const result: AgentResult = {
 *   agentId: 'position_analyst',
 *   status: 'success',
 *   data: {
 *     concentration_analysis: { top3_total_weight: 0.65 },
 *     correlation_risks: [],
 *     performance_attribution: {}
 *   },
 *   summary: 'Portfolio shows moderate concentration in tech sector',
 *   metadata: {
 *     executionTimeMs: 1500,
 *     tokensUsed: 500,
 *     dataSources: ['portfolio_data', 'rag_knowledge']
 *   }
 * };
 * ```
 *
 * @see Requirements 2.4, 3.4, 4.5, 5.4
 */
export interface AgentResult {
  /** ID of the agent that produced this result */
  agentId: string;

  /** Execution status */
  status: AgentResultStatus;

  /** Structured analysis data (agent-specific) */
  data: Record<string, unknown>;

  /** Human-readable summary of the analysis */
  summary: string;

  /** Execution metadata for monitoring */
  metadata: AgentResultMetadata;
}


// =============================================================================
// External Data Types
// =============================================================================

/**
 * News item from external news sources (e.g., Serper API).
 *
 * @see Requirements 4.1, 4.2
 */
export interface NewsItem {
  /** News article title */
  title: string;

  /** Brief excerpt from the article */
  snippet: string;

  /** Source publication name */
  source: string;

  /** Publication date */
  date: string;

  /** URL to the full article */
  link: string;

  /** Analyzed sentiment of the article */
  sentiment?: 'positive' | 'negative' | 'neutral';
}

/**
 * SEC filing information from EDGAR database.
 *
 * @see Requirements 4.4
 */
export interface SECFiling {
  /** Form type (e.g., '10-K', '10-Q') */
  form: string;

  /** Date the filing was submitted */
  filingDate: string;

  /** Unique accession number for the filing */
  accessionNumber: string;

  /** Primary document filename */
  primaryDocument: string;

  /** Key highlights extracted from the filing */
  highlights?: string[];
}

/**
 * Cache entry for news items.
 */
export interface NewsCacheEntry {
  /** Cached news items */
  items: NewsItem[];

  /** Timestamp when cached */
  timestamp: number;
}

/**
 * Cache entry for SEC filings.
 */
export interface SECFilingsCacheEntry {
  /** Cached filings */
  filings: SECFiling[];

  /** Timestamp when cached */
  timestamp: number;
}

/**
 * Cache entry for article content.
 */
export interface ArticleContentCacheEntry {
  /** Cached content */
  content: string;

  /** Timestamp when cached */
  timestamp: number;
}

/**
 * Cache for external data to avoid repeated API calls.
 *
 * @see Requirements 8.1, 8.2
 */
export interface ExternalDataCache {
  /** Cached news by ticker */
  news: Map<string, NewsCacheEntry>;

  /** Cached SEC filings by ticker */
  secFilings: Map<string, SECFilingsCacheEntry>;

  /** Cached article content by URL */
  articleContent: Map<string, ArticleContentCacheEntry>;
}


// =============================================================================
// Agent Context
// =============================================================================

/**
 * Orchestration modes supported by the system.
 * - sequential: Execute agents in predefined order
 * - selector: LLM dynamically chooses next agent
 * - handoff: Agents explicitly transfer control
 * - respond_directly: Simple queries handled by Advisor alone
 *
 * @see Requirements 1.9, 1.5.1
 */
export type OrchestrationMode =
  | 'sequential'
  | 'selector'
  | 'handoff'
  | 'respond_directly';

/**
 * Context object passed between agents during execution.
 * Accumulates results and provides shared state.
 *
 * @example
 * ```typescript
 * const context: AgentContext = {
 *   query: 'Analyze my portfolio risk',
 *   previousResults: new Map(),
 *   userNotes: 'Focus on tech sector exposure',
 *   externalData: { news: new Map(), secFilings: new Map(), articleContent: new Map() },
 *   messageThread: [],
 *   mode: 'sequential'
 * };
 * ```
 *
 * @see Requirements 1.2, 1.3
 */
export interface AgentContext {
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
  mode: OrchestrationMode;
}


// =============================================================================
// Portfolio Types (for Agent execution)
// =============================================================================

/**
 * Individual position in a portfolio.
 */
export interface Position {
  /** Stock ticker symbol */
  ticker: string;

  /** Position weight as percentage (0-100) */
  weight: number;

  /** Market value in base currency */
  marketValue: number;

  /** Cost basis for the position */
  costBasis: number;

  /** Unrealized profit/loss */
  unrealizedPnL: number;

  /** Market where the stock trades (e.g., 'US', 'HK') */
  market: string;

  /** Sector classification */
  sector?: string;
}

/**
 * Complete portfolio state for analysis.
 *
 * @see Requirements 2.1, 3.1
 */
export interface PortfolioState {
  /** All positions in the portfolio */
  positions: Position[];

  /** Total portfolio value */
  totalValue: number;

  /** Cash balance */
  cashBalance: number;

  /** Current margin loan amount */
  marginLoan: number;

  /** High water mark for drawdown calculation */
  highWaterMark: number;

  /** Timestamp of the portfolio snapshot */
  timestamp: number;
}


// =============================================================================
// Agent Interface
// =============================================================================

/**
 * Base interface for all analysis agents.
 * Inspired by AutoGen, Agno, and Stockagent patterns.
 *
 * Each agent has a specific role and goal, can use designated tools,
 * and produces structured results. Agents support state persistence
 * for resuming interrupted analyses.
 *
 * @example
 * ```typescript
 * class PositionAnalystAgent implements Agent {
 *   id = 'position_analyst';
 *   role = 'Portfolio Structure Analyst';
 *   goal = 'Analyze portfolio concentration and performance';
 *   description = 'Analyzes portfolio structure, concentration risks, and performance attribution';
 *   tools = ['portfolio_data', 'rag_knowledge'];
 *
 *   async execute(context: AgentContext, portfolio: PortfolioState): Promise<AgentResult> {
 *     // Implementation
 *   }
 *
 *   saveState(): AgentState {
 *     return { agentId: this.id, timestamp: Date.now(), internalState: {}, messageHistory: [] };
 *   }
 *
 *   loadState(state: AgentState): void {
 *     // Restore state
 *   }
 * }
 * ```
 *
 * @see Requirements 1.1, 1.1.1, 1.1.2, 1.1.3
 */
export interface Agent {
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

  /** Agent personality configuration (optional) */
  personality?: AgentPersonality;

  /** Memory configuration (optional) */
  memory?: AgentMemoryConfig;

  /**
   * Execute the agent's analysis task.
   *
   * @param context - Accumulated context from previous agents
   * @param portfolio - Current portfolio state
   * @returns Agent's analysis result or HandoffMessage
   */
  execute(
    context: AgentContext,
    portfolio: PortfolioState
  ): Promise<AgentResult | HandoffMessage>;

  /**
   * Save agent's internal state for persistence.
   *
   * @returns Serializable state object
   */
  saveState(): AgentState;

  /**
   * Restore agent's internal state.
   *
   * @param state - Previously saved state object
   */
  loadState(state: AgentState): void;
}


// =============================================================================
// Extended Thinking Configuration (Inspired by Agno + Claude)
// =============================================================================

/**
 * Trigger conditions for extended thinking mode.
 *
 * @see Requirements 1.4.1
 */
export interface ExtendedThinkingTriggers {
  /** Enable for CRITICAL risk scenarios */
  criticalRisk: boolean;

  /** Enable for complex multi-factor decisions */
  complexDecision: boolean;

  /** Enable when user explicitly requests deep analysis */
  userRequested: boolean;
}

/**
 * Configuration for extended thinking mode.
 * Enables deeper reasoning for complex analysis scenarios.
 *
 * @example
 * ```typescript
 * const config: ExtendedThinkingConfig = {
 *   enabled: true,
 *   budgetTokens: 1024,
 *   triggers: {
 *     criticalRisk: true,
 *     complexDecision: true,
 *     userRequested: true
 *   }
 * };
 * ```
 *
 * @see Requirements 1.4.1, 1.4.2, 1.4.3
 */
export interface ExtendedThinkingConfig {
  /** Enable extended thinking mode */
  enabled: boolean;

  /** Token budget for thinking (default: 1024) */
  budgetTokens: number;

  /** Trigger conditions for extended thinking */
  triggers: ExtendedThinkingTriggers;
}

/**
 * Default extended thinking configuration.
 */
export const DEFAULT_EXTENDED_THINKING_CONFIG: ExtendedThinkingConfig = {
  enabled: true,
  budgetTokens: 1024,
  triggers: {
    criticalRisk: true,
    complexDecision: true,
    userRequested: true,
  },
};


// =============================================================================
// Orchestrator Types
// =============================================================================

/**
 * Progress status emitted during multi-agent execution.
 *
 * @see Requirements 1.5, 7.3
 */
export interface ProgressStatus {
  /** ID of the currently executing agent */
  currentAgent: string;

  /** Current phase description */
  phase: string;

  /** Progress percentage (0-100) */
  progress: number;

  /** Optional status message */
  message?: string;

  /** Current orchestration mode */
  mode?: OrchestrationMode;

  /** Indicates if extended thinking is active */
  extendedThinkingActive?: boolean;
}

/**
 * Risk level classification for reports.
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Recommendation type for action plans.
 */
export type RecommendationType =
  | 'BUY'
  | 'SELL'
  | 'HOLD'
  | 'REBALANCE'
  | 'WARNING';

/**
 * Final report structure for backward compatibility.
 *
 * @see Requirements 7.2
 */
export interface FinalReport {
  /** Report title */
  title: string;

  /** Overall risk level */
  risk_level: RiskLevel;

  /** Executive summary */
  summary: string;

  /** Detailed analysis content */
  content: string;

  /** Primary recommendation */
  recommendation: RecommendationType;

  /** Detailed action plan */
  action_plan: string;

  /** Primary ticker being analyzed */
  primary_ticker: string;
}

/**
 * Trace of a single agent's execution.
 */
export interface AgentTrace {
  /** Agent ID */
  agentId: string;

  /** Start timestamp */
  startTime: number;

  /** End timestamp */
  endTime: number;

  /** Duration in milliseconds */
  durationMs: number;

  /** Execution status */
  status: string;

  /** Tokens used */
  tokensUsed: number;

  /** Data sources accessed */
  dataSources: string[];

  /** Error message if failed */
  error?: string;
}

/**
 * Trace of a handoff between agents.
 */
export interface HandoffTrace {
  /** Source agent ID */
  from: string;

  /** Target agent ID */
  to: string;

  /** Reason for handoff */
  reason: string;

  /** Timestamp of handoff */
  timestamp: number;
}

/**
 * Complete execution trace for debugging.
 *
 * @see Requirements 7.4
 */
export interface ExecutionTrace {
  /** Execution start time */
  startTime: number;

  /** Execution end time */
  endTime: number;

  /** Total duration in milliseconds */
  totalDurationMs: number;

  /** Orchestration mode used */
  mode: OrchestrationMode;

  /** Individual agent traces */
  agentTraces: AgentTrace[];

  /** Handoff traces */
  handoffs: HandoffTrace[];
}


/**
 * Result from orchestrator execution.
 *
 * @see Requirements 7.1
 */
export interface OrchestratorResult {
  /** Results from all executed agents */
  results: AgentResult[];

  /** Final synthesized report */
  finalReport: FinalReport;

  /** Complete execution trace */
  executionTrace: ExecutionTrace;

  /** Orchestration mode used */
  mode: OrchestrationMode;

  /** Memories created during this execution */
  newMemories?: MemoryEntry[];
}

/**
 * Cache state for persistence.
 */
export interface CacheState {
  /** Serialized cache entries */
  entries: Array<{
    key: string;
    value: unknown;
    expiresAt: number;
  }>;

  /** Timestamp when state was captured */
  timestamp: number;
}

/**
 * Complete orchestrator state for persistence.
 *
 * @see Requirements 1.1.4, 1.1.5
 */
export interface OrchestratorState {
  /** Orchestration mode */
  mode: OrchestrationMode;

  /** States of all agents */
  agentStates: Map<string, AgentState>;

  /** Cache state */
  cacheState: CacheState;

  /** Timestamp when state was saved */
  timestamp: number;

  /** Memory state for restoration */
  memoryState?: Map<string, MemoryEntry[]>;
}

/**
 * Options for orchestrator execution.
 *
 * @see Requirements 1.9
 */
export interface ExecutionOptions {
  /** User query or analysis request */
  query?: string;

  /** Force refresh all caches */
  forceRefresh?: boolean;

  /** Only include these agents */
  includeAgents?: string[];

  /** Exclude these agents */
  excludeAgents?: string[];

  /** Timeout in milliseconds */
  timeout?: number;

  /** Orchestration mode override */
  mode?: OrchestrationMode;

  /** Maximum iterations for selector/handoff modes */
  maxIterations?: number;

  /** Extended thinking configuration override */
  extendedThinking?: Partial<ExtendedThinkingConfig>;

  /** Personality override for agents */
  personalityOverride?: Partial<AgentPersonality>;

  /**
   * Callback for alert events emitted during execution.
   * Called after each agent execution if alerts are triggered.
   *
   * @see Requirements 10.7, 10.8
   */
  onAlert?: (alert: AgentAlertEvent) => void;
}


// =============================================================================
// Context Management (TransformMessages)
// =============================================================================

/**
 * Message transform interface for context management.
 * Transforms are applied to message history before LLM calls.
 *
 * @see Requirements 9.1
 */
export interface MessageTransform {
  /** Transform name for logging */
  name: string;

  /**
   * Apply transformation to message array.
   *
   * @param messages - Input message array
   * @returns Transformed message array
   */
  applyTransform(messages: AgentMessage[]): AgentMessage[];
}

/**
 * Configuration for message transforms.
 *
 * @see Requirements 9.2, 9.3, 9.6, 9.7
 */
export interface TransformConfig {
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

/**
 * Default transform configuration.
 */
export const DEFAULT_TRANSFORM_CONFIG: TransformConfig = {
  enabled: true,
  maxMessages: 10,
  maxTokens: 4000,
  maxTokensPerMessage: 500,
  minTokens: 1000,
};


// =============================================================================
// AI-Triggered Alert System
// =============================================================================

/**
 * Alert severity levels.
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Alert types for categorization.
 */
export type AlertType =
  | 'RISK_LEVEL'
  | 'DRAWDOWN'
  | 'LEVERAGE'
  | 'SENTIMENT'
  | 'CONCENTRATION';

/**
 * Alert event emitted by agents when risks are detected.
 *
 * @see Requirements 10.1, 10.5, 10.7
 */
export interface AgentAlertEvent {
  /** Source agent that detected the risk */
  sourceAgent: string;

  /** Alert severity level */
  severity: AlertSeverity;

  /** Alert type for categorization */
  alertType: AlertType;

  /** Alert title */
  title: string;

  /** Detailed message */
  message: string;

  /** Recommended action */
  recommendation: string;

  /** Supporting data from agent analysis */
  data: Record<string, unknown>;

  /** Timestamp */
  timestamp: string;
}

/**
 * Alert trigger configuration for each agent type.
 *
 * @see Requirements 10.1, 10.2, 10.3
 */
export interface AlertTriggerConfig {
  /** Risk Analyst triggers */
  riskAnalyst: {
    /** Drawdown threshold percentage (default: 15) */
    drawdownThreshold: number;
    /** Leverage threshold multiplier (default: 2.5) */
    leverageThreshold: number;
  };

  /** Market Analyst triggers */
  marketAnalyst: {
    /** Negative sentiment threshold (default: -0.5) */
    negativeSentimentThreshold: number;
  };

  /** Advisor triggers */
  advisor: {
    /** Trigger on CRITICAL risk level (default: true) */
    criticalRiskLevel: boolean;
  };
}

/**
 * Default alert trigger configuration.
 */
export const DEFAULT_ALERT_TRIGGERS: AlertTriggerConfig = {
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


// =============================================================================
// Data Source Interface
// =============================================================================

/**
 * Base interface for external data sources.
 *
 * @see Requirements 6.1
 */
export interface DataSource {
  /** Data source name for identification */
  name: string;

  /**
   * Check if the data source is available.
   *
   * @returns True if the data source can be used
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get cached data if available.
   *
   * @param key - Cache key
   * @returns Cached data or null if not found/expired
   */
  getCache(key: string): unknown | null;

  /**
   * Set cache with TTL.
   *
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttlMs - Time to live in milliseconds
   */
  setCache(key: string, data: unknown, ttlMs: number): void;
}

// =============================================================================
// Memory Storage Interface
// =============================================================================

/**
 * Storage interface for agent memories.
 *
 * @see Requirements 1.3.1
 */
export interface MemoryStorage {
  /**
   * Save a memory entry.
   *
   * @param entry - Memory entry to save
   */
  save(entry: MemoryEntry): Promise<void>;

  /**
   * Get all memories for an agent.
   *
   * @param agentId - Agent ID
   * @returns Array of memory entries
   */
  getByAgent(agentId: string): Promise<MemoryEntry[]>;

  /**
   * Delete multiple memory entries.
   *
   * @param ids - Array of memory IDs to delete
   */
  deleteMany(ids: string[]): Promise<void>;
}


// =============================================================================
// Agent-Specific Data Types
// =============================================================================

/**
 * Concentration analysis output from Position Analyst.
 *
 * @see Requirements 2.1, 2.4
 */
export interface ConcentrationAnalysis {
  /** Top 3 positions by weight */
  top3_positions: Array<{ ticker: string; weight: number }>;

  /** Combined weight of top 3 positions */
  top3_total_weight: number;

  /** Tickers with weight > 30% */
  high_concentration_flags: string[];

  /** Herfindahl-Hirschman Index for concentration */
  herfindahl_index: number;
}

/**
 * Stress test result from Risk Analyst.
 *
 * @see Requirements 3.2
 */
export interface StressTestResult {
  /** Scenario description (e.g., "Market -10%") */
  scenario: string;

  /** Estimated portfolio impact percentage */
  portfolio_impact: number;

  /** Risk of margin call in this scenario */
  margin_call_risk: boolean;

  /** Percentage gain needed to recover */
  recovery_needed: number;
}

/**
 * Drawdown analysis from Risk Analyst.
 *
 * @see Requirements 3.1
 */
export interface DrawdownAnalysis {
  /** Current drawdown percentage from high water mark */
  current_drawdown: number;

  /** High water mark value */
  high_water_mark: number;

  /** Current portfolio value */
  current_value: number;

  /** Days since high water mark */
  days_since_peak: number;
}

/**
 * Leverage assessment from Risk Analyst.
 *
 * @see Requirements 3.3
 */
export interface LeverageAssessment {
  /** Current leverage ratio */
  current_leverage: number;

  /** Margin loan amount */
  margin_loan: number;

  /** Available margin */
  available_margin: number;

  /** Margin safety level */
  margin_safety: 'safe' | 'warning' | 'danger';
}

/**
 * Action item in the recommendation plan.
 *
 * @see Requirements 5.3
 */
export interface ActionItem {
  /** Action type */
  action: 'buy' | 'sell' | 'hold' | 'rebalance' | 'monitor';

  /** Target ticker */
  ticker: string;

  /** Priority level (1 = highest) */
  priority: number;

  /** Suggested quantity or percentage */
  quantity?: number;

  /** Rationale for the action */
  rationale: string;

  /** Urgency level */
  urgency?: 'immediate' | 'soon' | 'when_convenient';
}

/**
 * Extracted content from web pages.
 *
 * @see Requirements 4.1.5
 */
export interface ExtractedContent {
  /** Source URL */
  url: string;

  /** Page title */
  title: string;

  /** Main content text */
  content: string;

  /** Error message if extraction failed */
  error?: string;

  /** Structured extracted data */
  extracted_data: {
    /** Extracted tables */
    tables?: unknown[];
    /** Financial data points */
    financialData?: Record<string, unknown>;
    /** Key points summary */
    keyPoints?: string[];
  };
}


// =============================================================================
// Utility Types
// =============================================================================

/**
 * Query complexity classification for respond_directly mode.
 *
 * @see Requirements 1.5.2, 1.5.3
 */
export type QueryComplexity = 'simple' | 'moderate' | 'complex';

/**
 * Cache entry with expiration.
 */
export interface CacheEntry<T = unknown> {
  /** Cached data */
  data: T;

  /** Timestamp when cached */
  timestamp: number;

  /** Expiration timestamp */
  expiresAt: number;
}

/**
 * Rate limiter configuration.
 */
export interface RateLimiterConfig {
  /** Maximum tokens (requests) */
  maxTokens: number;

  /** Refill rate (tokens per second) */
  refillRate: number;
}

/**
 * Error thrown during agent execution.
 */
export class AgentExecutionError extends Error {
  constructor(
    public agentId: string,
    public originalError: Error,
    public context: Partial<AgentContext>
  ) {
    super(`Agent ${agentId} failed: ${originalError.message}`);
    this.name = 'AgentExecutionError';
  }
}

// =============================================================================
// Factory Functions for Creating Default Objects
// =============================================================================

/**
 * Create an empty external data cache.
 */
export function createEmptyExternalDataCache(): ExternalDataCache {
  return {
    news: new Map(),
    secFilings: new Map(),
    articleContent: new Map(),
  };
}

/**
 * Create a default agent context.
 */
export function createDefaultAgentContext(
  query: string = '',
  mode: OrchestrationMode = 'sequential'
): AgentContext {
  return {
    query,
    previousResults: new Map(),
    userNotes: '',
    externalData: createEmptyExternalDataCache(),
    messageThread: [],
    mode,
  };
}

/**
 * Create a default agent personality.
 */
export function createDefaultPersonality(): AgentPersonality {
  return {
    riskTolerance: 'moderate',
    decisionStyle: 'data-driven',
    traits: [],
  };
}

/**
 * Create a default memory configuration.
 */
export function createDefaultMemoryConfig(): AgentMemoryConfig {
  return {
    shortTermEnabled: true,
    longTermEnabled: true,
    maxLongTermEntries: 100,
    retrievalStrategy: 'hybrid',
  };
}
