/**
 * Agent Orchestrator
 *
 * Coordinates execution of multiple agents with different orchestration modes.
 * Inspired by AutoGen's RoundRobinGroupChat, SelectorGroupChat, Swarm, and Agno Team.
 *
 * Supported modes:
 * - sequential: Execute agents in predefined order
 * - selector: LLM dynamically chooses next agent
 * - handoff: Agents explicitly transfer control
 * - respond_directly: Simple queries handled by Advisor alone
 *
 * @module agents/orchestrator
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for detailed design
 */

import {
  Agent,
  AgentContext,
  AgentResult,
  AgentMessage,
  AgentState,
  AgentTrace,
  HandoffMessage,
  HandoffTrace,
  OrchestrationMode,
  ExecutionOptions,
  ExecutionTrace,
  OrchestratorResult,
  OrchestratorState,
  CacheState,
  ProgressStatus,
  PortfolioState,
  FinalReport,
  QueryComplexity,
  ExtendedThinkingConfig,
  DEFAULT_EXTENDED_THINKING_CONFIG,
  isHandoffMessage,
  createDefaultAgentContext,
  AgentAlertEvent,
} from './types';
import { AgentMemoryManager, MemoryEntry } from './memory';
import { AgentPersonality, mergePersonality } from './personality';
import { AgentAlertManager, sendAgentAlert } from './alertManager';

// =============================================================================
// Types
// =============================================================================

/**
 * Progress callback function type
 */
export type ProgressCallback = (status: ProgressStatus) => void;

/**
 * Alert callback function type
 */
export type AlertCallback = (alert: unknown) => void;

/**
 * LLM call function type for selector mode
 */
export type LLMCallFunction = (prompt: string) => Promise<string>;


// =============================================================================
// Cache Manager (Simple Implementation)
// =============================================================================

/**
 * Simple cache manager for orchestrator state
 */
export class CacheManager {
  private cache: Map<string, { data: unknown; expiresAt: number }> = new Map();

  /**
   * Get cached data by key
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Set cache with TTL
   */
  set(key: string, data: unknown, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get serializable cache state
   */
  getState(): CacheState {
    const entries: Array<{ key: string; value: unknown; expiresAt: number }> = [];
    this.cache.forEach((entry, key) => {
      entries.push({ key, value: entry.data, expiresAt: entry.expiresAt });
    });
    return { entries, timestamp: Date.now() };
  }

  /**
   * Restore cache from state
   */
  setState(state: CacheState): void {
    this.cache.clear();
    const now = Date.now();
    for (const entry of state.entries) {
      if (entry.expiresAt > now) {
        this.cache.set(entry.key, { data: entry.value, expiresAt: entry.expiresAt });
      }
    }
  }
}


// =============================================================================
// State Manager
// =============================================================================

/**
 * Manages orchestrator state persistence
 */
export class StateManager {
  private readonly STORAGE_KEY = 'orchestrator_state';

  /**
   * Save state to localStorage
   */
  save(state: OrchestratorState): void {
    try {
      // Convert Map to array for JSON serialization
      const serializable = {
        ...state,
        agentStates: Array.from(state.agentStates.entries()),
        memoryState: state.memoryState
          ? Array.from(state.memoryState.entries())
          : undefined,
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serializable));
    } catch (error) {
      console.warn('Failed to save orchestrator state:', error);
    }
  }

  /**
   * Load state from localStorage
   */
  load(): OrchestratorState | null {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return null;

      const parsed = JSON.parse(data);
      return {
        ...parsed,
        agentStates: new Map(parsed.agentStates),
        memoryState: parsed.memoryState
          ? new Map(parsed.memoryState)
          : undefined,
      };
    } catch (error) {
      console.warn('Failed to load orchestrator state:', error);
      return null;
    }
  }

  /**
   * Clear saved state
   */
  clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear orchestrator state:', error);
    }
  }
}


// =============================================================================
// Orchestrator Options
// =============================================================================

/**
 * Options for creating an AgentOrchestrator
 */
export interface OrchestratorOptions {
  /** Orchestration mode (default: sequential) */
  mode?: OrchestrationMode;

  /** Extended thinking configuration */
  extendedThinking?: ExtendedThinkingConfig;

  /** LLM call function for selector mode */
  llmCall?: LLMCallFunction;

  /** Memory manager instance */
  memoryManager?: AgentMemoryManager;

  /** Alert manager instance for automatic alert detection */
  alertManager?: AgentAlertManager;

  /** Default agent execution order for sequential mode */
  defaultAgentOrder?: string[];

  /** Maximum iterations for selector/handoff modes */
  maxIterations?: number;

  /** Default timeout in milliseconds */
  defaultTimeout?: number;
}

/**
 * Default agent execution order
 */
const DEFAULT_AGENT_ORDER = [
  'position_analyst',
  'risk_analyst',
  'market_analyst',
  'advisor',
];

/**
 * Default maximum iterations for selector/handoff modes
 */
const DEFAULT_MAX_ITERATIONS = 10;

/**
 * Default timeout in milliseconds (60 seconds)
 */
const DEFAULT_TIMEOUT = 60000;


// =============================================================================
// Agent Orchestrator Class
// =============================================================================

/**
 * Coordinates execution of multiple agents with different orchestration modes.
 *
 * Supported modes:
 * - **sequential**: Execute agents in predefined order (default)
 * - **selector**: LLM dynamically chooses next agent based on context
 * - **handoff**: Agents explicitly transfer control via HandoffMessage
 * - **respond_directly**: Simple queries handled by Advisor alone
 *
 * @example
 * ```typescript
 * const orchestrator = new AgentOrchestrator(
 *   [positionAnalyst, riskAnalyst, marketAnalyst, advisor],
 *   cacheManager,
 *   { mode: 'sequential' }
 * );
 *
 * const result = await orchestrator.execute(
 *   portfolio,
 *   { query: 'Analyze my portfolio risk' },
 *   (status) => console.log(status.phase)
 * );
 * ```
 *
 * @see Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.5.1-1.5.5
 */
export class AgentOrchestrator {
  /** Registered agents by ID */
  private agents: Map<string, Agent>;

  /** Cache manager for data caching */
  private cacheManager: CacheManager;

  /** State manager for persistence */
  private stateManager: StateManager;

  /** Memory manager for cross-session learning */
  private memoryManager: AgentMemoryManager;

  /** Alert manager for automatic alert detection */
  private alertManager: AgentAlertManager;

  /** Current orchestration mode */
  private mode: OrchestrationMode;

  /** Extended thinking configuration */
  private extendedThinking: ExtendedThinkingConfig;

  /** LLM call function for selector mode */
  private llmCall: LLMCallFunction;

  /** Default agent execution order */
  private defaultAgentOrder: string[];

  /** Maximum iterations for selector/handoff modes */
  private maxIterations: number;

  /** Default timeout in milliseconds */
  private defaultTimeout: number;

  /**
   * Create a new AgentOrchestrator
   *
   * @param agents - Array of agents to orchestrate
   * @param cacheManager - Cache manager instance
   * @param options - Orchestrator configuration options
   */
  constructor(
    agents: Agent[],
    cacheManager: CacheManager,
    options: OrchestratorOptions = {}
  ) {
    this.agents = new Map(agents.map((a) => [a.id, a]));
    this.cacheManager = cacheManager;
    this.stateManager = new StateManager();
    this.memoryManager = options.memoryManager || new AgentMemoryManager();
    this.alertManager = options.alertManager || new AgentAlertManager();
    this.mode = options.mode || 'sequential';
    this.extendedThinking =
      options.extendedThinking || DEFAULT_EXTENDED_THINKING_CONFIG;
    this.llmCall = options.llmCall || this.defaultLLMCall.bind(this);
    this.defaultAgentOrder = options.defaultAgentOrder || DEFAULT_AGENT_ORDER;
    this.maxIterations = options.maxIterations || DEFAULT_MAX_ITERATIONS;
    this.defaultTimeout = options.defaultTimeout || DEFAULT_TIMEOUT;
  }


  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Execute agents based on configured mode
   *
   * @param portfolio - Current portfolio state
   * @param options - Execution options
   * @param onProgress - Progress callback function
   * @returns Orchestrator result with all agent results and final report
   *
   * @see Requirements 1.2, 1.3, 1.4, 1.5
   */
  async execute(
    portfolio: PortfolioState,
    options: ExecutionOptions = {},
    onProgress?: ProgressCallback
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const effectiveMode = options.mode || this.mode;
    const timeout = options.timeout || this.defaultTimeout;

    // Build initial context
    const context = await this.buildContext(options);
    context.mode = effectiveMode;

    // Load long-term memories for relevant agents
    await this.loadAgentMemories(context);

    // Emit initial progress
    onProgress?.({
      currentAgent: '',
      phase: 'Initializing',
      progress: 0,
      mode: effectiveMode,
    });

    let result: OrchestratorResult;

    try {
      // Execute with timeout, passing onAlert callback
      result = await this.executeWithTimeout(
        () => this.executeByMode(effectiveMode, context, portfolio, onProgress, options.onAlert),
        timeout
      );
    } catch (error) {
      // Return partial result on error
      result = this.createErrorResult(error as Error, startTime, effectiveMode);
    }

    // Update execution trace timing
    result.executionTrace.endTime = Date.now();
    result.executionTrace.totalDurationMs =
      result.executionTrace.endTime - startTime;

    // Emit completion progress
    onProgress?.({
      currentAgent: '',
      phase: 'Complete',
      progress: 100,
      mode: effectiveMode,
    });

    return result;
  }

  /**
   * Get the current orchestration mode
   */
  getMode(): OrchestrationMode {
    return this.mode;
  }

  /**
   * Set the orchestration mode
   */
  setMode(mode: OrchestrationMode): void {
    this.mode = mode;
  }

  /**
   * Get a registered agent by ID
   */
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all registered agents
   */
  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Register a new agent
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Unregister an agent by ID
   */
  unregisterAgent(id: string): boolean {
    return this.agents.delete(id);
  }


  // ===========================================================================
  // Mode Execution Methods
  // ===========================================================================

  /**
   * Execute by the specified mode
   */
  private async executeByMode(
    mode: OrchestrationMode,
    context: AgentContext,
    portfolio: PortfolioState,
    onProgress?: ProgressCallback,
    onAlert?: (alert: AgentAlertEvent) => void
  ): Promise<OrchestratorResult> {
    switch (mode) {
      case 'sequential':
        return this.executeSequential(context, portfolio, onProgress, onAlert);
      case 'selector':
        return this.executeSelector(context, portfolio, onProgress, onAlert);
      case 'handoff':
        return this.executeHandoff(context, portfolio, onProgress, onAlert);
      case 'respond_directly':
        return this.executeRespondDirectly(context, portfolio, onProgress, onAlert);
      default:
        return this.executeSequential(context, portfolio, onProgress, onAlert);
    }
  }

  /**
   * Sequential mode: Execute agents in predefined order
   *
   * Agents are executed in the order specified by defaultAgentOrder.
   * Context is accumulated and passed to each subsequent agent.
   *
   * @see Requirements 1.2, 1.3, 1.4, 1.5
   */
  private async executeSequential(
    context: AgentContext,
    portfolio: PortfolioState,
    onProgress?: ProgressCallback,
    onAlert?: (alert: AgentAlertEvent) => void
  ): Promise<OrchestratorResult> {
    const results: AgentResult[] = [];
    const agentTraces: AgentTrace[] = [];
    const handoffs: HandoffTrace[] = [];
    const startTime = Date.now();

    // Filter agents based on execution options
    const agentOrder = this.getFilteredAgentOrder(context);
    const totalAgents = agentOrder.length;

    for (let i = 0; i < agentOrder.length; i++) {
      const agentId = agentOrder[i];
      const agent = this.agents.get(agentId);

      if (!agent) {
        console.warn(`Agent not found: ${agentId}`);
        continue;
      }

      // Emit progress
      onProgress?.({
        currentAgent: agent.id,
        phase: agent.role,
        progress: (i / totalAgents) * 100,
        message: `Executing ${agent.role}`,
        mode: 'sequential',
      });

      const agentStartTime = Date.now();

      try {
        const result = await agent.execute(context, portfolio);

        // In sequential mode, ignore handoffs and continue
        if (isHandoffMessage(result)) {
          handoffs.push({
            from: result.from,
            to: result.to,
            reason: result.reason,
            timestamp: Date.now(),
          });
          continue;
        }

        results.push(result);
        context.previousResults.set(agent.id, result);

        // Add to message thread
        context.messageThread.push({
          agentId: agent.id,
          content: result.summary,
          timestamp: Date.now(),
          type: 'result',
        });

        // Record trace
        agentTraces.push(this.createAgentTrace(agent, agentStartTime, result));

        // Check for alerts and emit them (Task 15.4)
        await this.checkAndEmitAlerts(result, onAlert);
      } catch (error) {
        // Create fallback result on error
        const fallbackResult = this.createFallbackResult(agent, error as Error);
        results.push(fallbackResult);
        context.previousResults.set(agent.id, fallbackResult);

        // Record error trace
        agentTraces.push(
          this.createAgentTrace(agent, agentStartTime, fallbackResult, error as Error)
        );
      }
    }

    return this.buildOrchestratorResult(
      results,
      startTime,
      'sequential',
      agentTraces,
      handoffs
    );
  }


  /**
   * Selector mode: LLM chooses next agent based on context
   *
   * Uses LLM to dynamically select the most appropriate next agent
   * based on the current analysis progress and context.
   *
   * @see Requirements 1.6, 1.8
   */
  private async executeSelector(
    context: AgentContext,
    portfolio: PortfolioState,
    onProgress?: ProgressCallback,
    onAlert?: (alert: AgentAlertEvent) => void
  ): Promise<OrchestratorResult> {
    const results: AgentResult[] = [];
    const agentTraces: AgentTrace[] = [];
    const handoffs: HandoffTrace[] = [];
    const startTime = Date.now();
    const maxIterations = this.maxIterations;

    // Start with the first agent in the order
    let currentAgent = this.agents.get(this.defaultAgentOrder[0]);
    if (!currentAgent) {
      throw new Error('No starting agent found for selector mode');
    }

    for (let i = 0; i < maxIterations; i++) {
      // Emit progress
      onProgress?.({
        currentAgent: currentAgent.id,
        phase: currentAgent.role,
        progress: (i / maxIterations) * 100,
        message: `LLM selected: ${currentAgent.role}`,
        mode: 'selector',
      });

      const agentStartTime = Date.now();

      try {
        const result = await currentAgent.execute(context, portfolio);

        // Handle handoff message
        if (isHandoffMessage(result)) {
          handoffs.push({
            from: result.from,
            to: result.to,
            reason: result.reason,
            timestamp: Date.now(),
          });

          const targetAgent = this.agents.get(result.to);
          if (targetAgent) {
            currentAgent = targetAgent;
          }
          continue;
        }

        results.push(result);
        context.previousResults.set(currentAgent.id, result);

        // Add to message thread
        context.messageThread.push({
          agentId: currentAgent.id,
          content: result.summary,
          timestamp: Date.now(),
          type: 'result',
        });

        // Record trace
        agentTraces.push(this.createAgentTrace(currentAgent, agentStartTime, result));

        // Check for alerts and emit them (Task 15.4)
        await this.checkAndEmitAlerts(result, onAlert);

        // Check termination condition: advisor has completed
        if (currentAgent.id === 'advisor') {
          break;
        }

        // LLM selects next agent
        currentAgent = await this.selectNextAgent(context, portfolio);
      } catch (error) {
        const fallbackResult = this.createFallbackResult(currentAgent, error as Error);
        results.push(fallbackResult);
        context.previousResults.set(currentAgent.id, fallbackResult);

        agentTraces.push(
          this.createAgentTrace(currentAgent, agentStartTime, fallbackResult, error as Error)
        );

        // On error, try to continue with default next agent
        currentAgent = this.getDefaultNextAgent(currentAgent.id);
        if (!currentAgent) break;
      }
    }

    return this.buildOrchestratorResult(
      results,
      startTime,
      'selector',
      agentTraces,
      handoffs
    );
  }

  /**
   * Use LLM to select the most appropriate next agent
   *
   * @param context - Current agent context
   * @param portfolio - Portfolio state
   * @returns Selected agent
   *
   * @see Requirements 1.6, 1.8
   */
  private async selectNextAgent(
    context: AgentContext,
    _portfolio: PortfolioState
  ): Promise<Agent> {
    // Build agent descriptions for LLM
    const agentDescriptions = Array.from(this.agents.values())
      .map((a) => `- ${a.id}: ${a.description}`)
      .join('\n');

    // Build progress summary from message thread
    const progressSummary =
      context.messageThread.length > 0
        ? context.messageThread
            .map((m) => `[${m.agentId}]: ${m.content.substring(0, 200)}...`)
            .join('\n')
        : 'No analysis completed yet.';

    const prompt = `Based on the current analysis progress, select the next agent to execute.

Available agents:
${agentDescriptions}

User query: ${context.query}

Current progress:
${progressSummary}

Rules:
1. Select the agent that would provide the most valuable next step
2. If all necessary analysis is complete, select 'advisor' to synthesize
3. Avoid selecting agents that have already completed their analysis

Respond with just the agent ID (e.g., 'risk_analyst' or 'advisor').`;

    try {
      const response = await this.llmCall(prompt);
      const agentId = response.trim().toLowerCase();

      const selectedAgent = this.agents.get(agentId);
      if (selectedAgent) {
        return selectedAgent;
      }

      // Fallback to advisor if invalid selection
      return this.agents.get('advisor') || Array.from(this.agents.values())[0];
    } catch (error) {
      console.warn('LLM selection failed, falling back to default order:', error);
      return this.getDefaultNextAgent(
        context.messageThread[context.messageThread.length - 1]?.agentId || ''
      );
    }
  }


  /**
   * Handoff mode: Agents explicitly transfer control
   *
   * Agents can return HandoffMessage to transfer control to a specific agent.
   * If no handoff is returned, execution follows the default order.
   *
   * @see Requirements 1.7, 1.9
   */
  private async executeHandoff(
    context: AgentContext,
    portfolio: PortfolioState,
    onProgress?: ProgressCallback,
    onAlert?: (alert: AgentAlertEvent) => void
  ): Promise<OrchestratorResult> {
    const results: AgentResult[] = [];
    const agentTraces: AgentTrace[] = [];
    const handoffs: HandoffTrace[] = [];
    const startTime = Date.now();
    const maxIterations = this.maxIterations + 5; // Allow extra iterations for handoffs

    // Start with the first agent
    let currentAgent = this.agents.get(this.defaultAgentOrder[0]);
    if (!currentAgent) {
      throw new Error('No starting agent found for handoff mode');
    }

    for (let i = 0; i < maxIterations; i++) {
      // Emit progress
      onProgress?.({
        currentAgent: currentAgent.id,
        phase: currentAgent.role,
        progress: (i / maxIterations) * 100,
        message: `Executing ${currentAgent.role}`,
        mode: 'handoff',
      });

      const agentStartTime = Date.now();

      try {
        const result = await currentAgent.execute(context, portfolio);

        // Handle handoff message
        if (isHandoffMessage(result)) {
          // Record handoff trace
          handoffs.push({
            from: result.from,
            to: result.to,
            reason: result.reason,
            timestamp: Date.now(),
          });

          // Add handoff to message thread
          context.messageThread.push({
            agentId: currentAgent.id,
            content: `Handoff to ${result.to}: ${result.reason}`,
            timestamp: Date.now(),
            type: 'handoff',
          });

          // Route to target agent
          const targetAgent = this.agents.get(result.to);
          if (targetAgent) {
            currentAgent = targetAgent;
          } else {
            console.warn(`Handoff target not found: ${result.to}`);
            currentAgent = this.getDefaultNextAgent(currentAgent.id);
            if (!currentAgent) break;
          }
          continue;
        }

        // Process normal result
        results.push(result);
        context.previousResults.set(currentAgent.id, result);

        // Add to message thread
        context.messageThread.push({
          agentId: currentAgent.id,
          content: result.summary,
          timestamp: Date.now(),
          type: 'result',
        });

        // Record trace
        agentTraces.push(this.createAgentTrace(currentAgent, agentStartTime, result));

        // Check for alerts and emit them (Task 15.4)
        await this.checkAndEmitAlerts(result, onAlert);

        // Termination: advisor completed without handoff
        if (currentAgent.id === 'advisor') {
          break;
        }

        // Default progression if no handoff
        const nextAgent = this.getDefaultNextAgent(currentAgent.id);
        if (!nextAgent) break;
        currentAgent = nextAgent;
      } catch (error) {
        const fallbackResult = this.createFallbackResult(currentAgent, error as Error);
        results.push(fallbackResult);
        context.previousResults.set(currentAgent.id, fallbackResult);

        agentTraces.push(
          this.createAgentTrace(currentAgent, agentStartTime, fallbackResult, error as Error)
        );

        // On error, continue with default next agent
        const nextAgent = this.getDefaultNextAgent(currentAgent.id);
        if (!nextAgent) break;
        currentAgent = nextAgent;
      }
    }

    return this.buildOrchestratorResult(
      results,
      startTime,
      'handoff',
      agentTraces,
      handoffs
    );
  }


  /**
   * Respond Directly mode: Advisor handles simple queries without delegation
   *
   * For simple queries, the Advisor responds directly without calling other agents.
   * For complex queries, falls back to sequential mode.
   *
   * @see Requirements 1.5.1, 1.5.2, 1.5.3, 1.5.4, 1.5.5
   */
  private async executeRespondDirectly(
    context: AgentContext,
    portfolio: PortfolioState,
    onProgress?: ProgressCallback,
    onAlert?: (alert: AgentAlertEvent) => void
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const agentTraces: AgentTrace[] = [];

    // Assess query complexity
    const complexity = await this.assessQueryComplexity(context.query, portfolio);

    if (complexity === 'simple') {
      // Advisor responds directly without calling other agents
      onProgress?.({
        currentAgent: 'advisor',
        phase: 'Direct Response',
        progress: 50,
        message: 'Simple query - responding directly',
        mode: 'respond_directly',
      });

      const advisor = this.agents.get('advisor');
      if (!advisor) {
        throw new Error('Advisor agent not found for respond_directly mode');
      }

      const agentStartTime = Date.now();

      try {
        const result = await advisor.execute(context, portfolio);

        if (isHandoffMessage(result)) {
          // If advisor requests handoff, fall back to sequential
          return this.executeSequential(context, portfolio, onProgress, onAlert);
        }

        agentTraces.push(this.createAgentTrace(advisor, agentStartTime, result));

        // Check for alerts and emit them (Task 15.4)
        await this.checkAndEmitAlerts(result, onAlert);

        return this.buildOrchestratorResult(
          [result],
          startTime,
          'respond_directly',
          agentTraces,
          []
        );
      } catch (error) {
        const fallbackResult = this.createFallbackResult(advisor, error as Error);
        agentTraces.push(
          this.createAgentTrace(advisor, agentStartTime, fallbackResult, error as Error)
        );

        return this.buildOrchestratorResult(
          [fallbackResult],
          startTime,
          'respond_directly',
          agentTraces,
          []
        );
      }
    }

    // For moderate/complex queries, fall back to sequential mode
    onProgress?.({
      currentAgent: '',
      phase: 'Complex Query Detected',
      progress: 10,
      message: `Query complexity: ${complexity} - using sequential mode`,
      mode: 'respond_directly',
    });

    // Execute sequential but preserve respond_directly as the reported mode
    const sequentialResult = await this.executeSequential(context, portfolio, onProgress, onAlert);
    
    // Override the mode in the result to reflect the original request
    return {
      ...sequentialResult,
      mode: 'respond_directly',
      executionTrace: {
        ...sequentialResult.executionTrace,
        mode: 'respond_directly',
      },
    };
  }

  /**
   * Assess query complexity to determine if direct response is appropriate
   *
   * @param query - User query string
   * @param portfolio - Portfolio state
   * @returns Query complexity classification
   *
   * @see Requirements 1.5.2, 1.5.3
   */
  async assessQueryComplexity(
    query: string,
    portfolio: PortfolioState
  ): Promise<QueryComplexity> {
    const queryLower = query.toLowerCase();

    // Simple query patterns - can be answered directly
    const simplePatterns = [
      /^what('s| is) my (total|current) (value|balance|portfolio)/i,
      /^how many (positions|stocks|holdings)/i,
      /^list my (holdings|positions|stocks)/i,
      /^what('s| is) my (largest|biggest|top) position/i,
      /^show my portfolio/i,
      /^what do i (own|hold)/i,
      /^portfolio summary/i,
      /^current holdings/i,
    ];

    if (simplePatterns.some((p) => p.test(query))) {
      return 'simple';
    }

    // Complex query indicators
    const complexIndicators = [
      portfolio.positions.length > 20,
      /stress test/i.test(queryLower),
      /scenario/i.test(queryLower),
      /recommendation/i.test(queryLower),
      /should i/i.test(queryLower),
      /what if/i.test(queryLower),
      /analyze.*risk/i.test(queryLower),
      /deep analysis/i.test(queryLower),
      /comprehensive/i.test(queryLower),
      /market.*outlook/i.test(queryLower),
      /rebalance/i.test(queryLower),
    ];

    const complexCount = complexIndicators.filter(Boolean).length;

    if (complexCount >= 2) {
      return 'complex';
    }

    // Moderate complexity - single complex indicator or medium-sized portfolio
    if (complexCount === 1 || portfolio.positions.length > 10) {
      return 'moderate';
    }

    return 'simple';
  }


  // ===========================================================================
  // State Persistence Methods
  // ===========================================================================

  /**
   * Save complete orchestrator state for persistence
   *
   * @returns Serializable orchestrator state
   *
   * @see Requirements 1.1.4, 1.1.5
   */
  async saveState(): Promise<OrchestratorState> {
    const agentStates = new Map<string, AgentState>();

    const agentEntries = Array.from(this.agents.entries());
    for (const [id, agent] of agentEntries) {
      agentStates.set(id, agent.saveState());
    }

    // Export memory state
    const memoryState = await this.memoryManager.exportMemories();

    const state: OrchestratorState = {
      mode: this.mode,
      agentStates,
      cacheState: this.cacheManager.getState(),
      timestamp: Date.now(),
      memoryState,
    };

    // Persist to storage
    this.stateManager.save(state);

    return state;
  }

  /**
   * Restore orchestrator from saved state
   *
   * @param state - Previously saved state object
   *
   * @see Requirements 1.1.4, 1.1.5
   */
  async loadState(state: OrchestratorState): Promise<void> {
    this.mode = state.mode;

    // Restore agent states
    const stateEntries = Array.from(state.agentStates.entries());
    for (const [id, agentState] of stateEntries) {
      const agent = this.agents.get(id);
      if (agent) {
        agent.loadState(agentState);
      }
    }

    // Restore cache state
    this.cacheManager.setState(state.cacheState);

    // Restore memory state
    if (state.memoryState) {
      await this.memoryManager.clearAll();
      const memoryEntries = Array.from(state.memoryState.entries());
      for (const [, memories] of memoryEntries) {
        await this.memoryManager.importMemories(memories);
      }
    }
  }

  /**
   * Load saved state from storage
   *
   * @returns True if state was loaded successfully
   */
  async loadSavedState(): Promise<boolean> {
    const state = this.stateManager.load();
    if (state) {
      await this.loadState(state);
      return true;
    }
    return false;
  }

  /**
   * Clear saved state
   */
  clearSavedState(): void {
    this.stateManager.clear();
  }


  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Check agent result for alerts and emit them via callback.
   *
   * Uses the AlertManager to detect alert conditions and sends
   * alerts through the riskAlertService integration.
   *
   * @param result - Agent execution result
   * @param onAlert - Optional callback for alert events
   *
   * @see Requirements 10.7, 10.8
   */
  private async checkAndEmitAlerts(
    result: AgentResult,
    onAlert?: (alert: AgentAlertEvent) => void
  ): Promise<void> {
    // Check for alerts using the alert manager
    const alerts = this.alertManager.checkAndEmitAlerts(result);

    // Emit alerts via callback and send through riskAlertService
    for (const alert of alerts) {
      // Call the onAlert callback if provided
      if (onAlert) {
        try {
          onAlert(alert);
        } catch (error) {
          console.error('Error in onAlert callback:', error);
        }
      }

      // Send alert through riskAlertService integration
      try {
        await sendAgentAlert(alert, {
          sendEmail: alert.severity === 'critical',
          showToast: true,
          browserNotify: true,
        });
      } catch (error) {
        console.error('Error sending agent alert:', error);
      }
    }
  }

  /**
   * Build initial context for execution
   */
  private async buildContext(options: ExecutionOptions): Promise<AgentContext> {
    const context = createDefaultAgentContext(options.query || '', this.mode);

    // Apply personality override if provided
    if (options.personalityOverride) {
      const agentValues = Array.from(this.agents.values());
      for (const agent of agentValues) {
        if (agent.personality) {
          agent.personality = mergePersonality(
            agent.personality,
            options.personalityOverride
          );
        }
      }
    }

    return context;
  }

  /**
   * Load relevant memories for agents
   */
  private async loadAgentMemories(context: AgentContext): Promise<void> {
    const agentValues = Array.from(this.agents.values());
    for (const agent of agentValues) {
      if (agent.memory?.longTermEnabled) {
        try {
          const memories = await this.memoryManager.retrieve(
            agent.id,
            { query: context.query },
            {
              strategy: agent.memory.retrievalStrategy,
              limit: 5,
            }
          );

          // Store memories in context for agent access
          if (memories.length > 0) {
            const memoryContext = memories
              .map((m) => `[${m.type}] ${m.content}`)
              .join('\n');
            context.userNotes = context.userNotes
              ? `${context.userNotes}\n\nRelevant memories:\n${memoryContext}`
              : `Relevant memories:\n${memoryContext}`;
          }
        } catch (error) {
          console.warn(`Failed to load memories for agent ${agent.id}:`, error);
        }
      }
    }
  }

  /**
   * Get filtered agent order based on execution options
   */
  private getFilteredAgentOrder(context: AgentContext): string[] {
    let order = [...this.defaultAgentOrder];

    // Filter to only registered agents
    order = order.filter((id) => this.agents.has(id));

    return order;
  }

  /**
   * Get the default next agent in sequence
   */
  private getDefaultNextAgent(currentAgentId: string): Agent {
    const currentIndex = this.defaultAgentOrder.indexOf(currentAgentId);

    if (currentIndex === -1 || currentIndex >= this.defaultAgentOrder.length - 1) {
      // Return advisor as final agent
      return this.agents.get('advisor') || Array.from(this.agents.values())[0];
    }

    const nextId = this.defaultAgentOrder[currentIndex + 1];
    return this.agents.get(nextId) || this.agents.get('advisor')!;
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Default LLM call implementation (placeholder)
   */
  private async defaultLLMCall(prompt: string): Promise<string> {
    console.warn('Using default LLM call - please provide a real implementation');
    // Return a default agent selection based on simple heuristics
    if (prompt.includes('risk')) return 'risk_analyst';
    if (prompt.includes('market') || prompt.includes('news')) return 'market_analyst';
    if (prompt.includes('position') || prompt.includes('concentration'))
      return 'position_analyst';
    return 'advisor';
  }


  /**
   * Create agent execution trace
   */
  private createAgentTrace(
    agent: Agent,
    startTime: number,
    result: AgentResult,
    error?: Error
  ): AgentTrace {
    const endTime = Date.now();
    return {
      agentId: agent.id,
      startTime,
      endTime,
      durationMs: endTime - startTime,
      status: result.status,
      tokensUsed: result.metadata.tokensUsed,
      dataSources: result.metadata.dataSources,
      error: error?.message,
    };
  }

  /**
   * Create fallback result when agent execution fails
   */
  private createFallbackResult(agent: Agent, error: Error): AgentResult {
    return {
      agentId: agent.id,
      status: 'failed',
      data: {},
      summary: `Agent ${agent.role} failed: ${error.message}`,
      metadata: {
        executionTimeMs: 0,
        tokensUsed: 0,
        dataSources: [],
        error: error.message,
      },
    };
  }

  /**
   * Create error result for complete execution failure
   */
  private createErrorResult(
    error: Error,
    startTime: number,
    mode: OrchestrationMode
  ): OrchestratorResult {
    return {
      results: [],
      finalReport: {
        title: 'Execution Failed',
        risk_level: 'HIGH',
        summary: `Orchestrator execution failed: ${error.message}`,
        content: error.stack || error.message,
        recommendation: 'HOLD',
        action_plan: 'Please retry the analysis or contact support.',
        primary_ticker: '',
      },
      executionTrace: {
        startTime,
        endTime: Date.now(),
        totalDurationMs: Date.now() - startTime,
        mode,
        agentTraces: [],
        handoffs: [],
      },
      mode,
    };
  }


  /**
   * Build final orchestrator result from agent results
   */
  private buildOrchestratorResult(
    results: AgentResult[],
    startTime: number,
    mode: OrchestrationMode,
    agentTraces: AgentTrace[],
    handoffs: HandoffTrace[]
  ): OrchestratorResult {
    // Find advisor result for final report
    const advisorResult = results.find((r) => r.agentId === 'advisor');

    // Build final report from advisor result or synthesize from all results
    const finalReport = this.buildFinalReport(results, advisorResult);

    // Collect new memories from this execution
    const newMemories = this.extractNewMemories(results);

    return {
      results,
      finalReport,
      executionTrace: {
        startTime,
        endTime: Date.now(),
        totalDurationMs: Date.now() - startTime,
        mode,
        agentTraces,
        handoffs,
      },
      mode,
      newMemories,
    };
  }

  /**
   * Build final report from agent results with combined summary conclusion
   */
  private buildFinalReport(
    results: AgentResult[],
    advisorResult?: AgentResult
  ): FinalReport {
    if (advisorResult && advisorResult.status === 'success') {
      // Use advisor's structured output
      const data = advisorResult.data;
      
      // Generate combined summary conclusion from all agents
      const combinedConclusion = this.generateCombinedConclusion(results);
      
      return {
        title: (data.title as string) || '投资分析报告',
        risk_level: (data.risk_level as FinalReport['risk_level']) || 'MEDIUM',
        summary: combinedConclusion || advisorResult.summary,
        content: (data.content as string) || advisorResult.summary,
        recommendation:
          (data.recommendation as FinalReport['recommendation']) || 'HOLD',
        action_plan: (data.action_plan as string) || '',
        primary_ticker: (data.primary_ticker as string) || '',
      };
    }

    // Synthesize from all results if no advisor result
    const combinedConclusion = this.generateCombinedConclusion(results);

    // Determine risk level from risk analyst result
    const riskResult = results.find((r) => r.agentId === 'risk_analyst');
    const riskLevel =
      (riskResult?.data?.risk_level as FinalReport['risk_level']) || 'MEDIUM';

    return {
      title: '投资分析报告',
      risk_level: riskLevel,
      summary: combinedConclusion || '分析完成，部分结果可用。',
      content: combinedConclusion,
      recommendation: 'HOLD',
      action_plan: '请查看各分析师的详细分析以获取具体建议。',
      primary_ticker: '',
    };
  }

  /**
   * Generate combined conclusion from all agent results (Chinese)
   */
  private generateCombinedConclusion(results: AgentResult[]): string {
    const sections: string[] = [];
    
    // Header
    sections.push('## 📊 综合分析结论\n');
    
    // Position Analyst summary
    const positionResult = results.find((r) => r.agentId === 'position_analyst');
    if (positionResult?.status === 'success') {
      sections.push(`### 持仓分析师\n${positionResult.summary}\n`);
    }
    
    // Risk Analyst summary
    const riskResult = results.find((r) => r.agentId === 'risk_analyst');
    if (riskResult?.status === 'success') {
      sections.push(`### 风险分析师\n${riskResult.summary}\n`);
    }
    
    // Market Analyst summary
    const marketResult = results.find((r) => r.agentId === 'market_analyst');
    if (marketResult?.status === 'success') {
      sections.push(`### 市场分析师\n${marketResult.summary}\n`);
    }
    
    // Advisor summary
    const advisorResult = results.find((r) => r.agentId === 'advisor');
    if (advisorResult?.status === 'success') {
      sections.push(`### 投资顾问\n${advisorResult.summary}\n`);
    }
    
    // Generate overall conclusion
    const overallConclusion = this.synthesizeOverallConclusion(results);
    if (overallConclusion) {
      sections.push(`### 🎯 总体结论\n${overallConclusion}`);
    }
    
    return sections.join('\n');
  }

  /**
   * Synthesize overall conclusion from all agent results
   */
  private synthesizeOverallConclusion(results: AgentResult[]): string {
    const conclusions: string[] = [];
    
    // Get risk level
    const riskResult = results.find((r) => r.agentId === 'risk_analyst');
    const advisorResult = results.find((r) => r.agentId === 'advisor');
    
    const riskLevel = advisorResult?.data?.risk_level || riskResult?.data?.risk_level;
    
    // Risk level conclusion
    const riskLevelChinese: Record<string, string> = {
      LOW: '低风险',
      MEDIUM: '中等风险',
      HIGH: '高风险',
      CRITICAL: '危险',
    };
    
    if (riskLevel) {
      const levelText = riskLevelChinese[riskLevel as string] || riskLevel;
      conclusions.push(`综合各分析师意见，当前投资组合风险等级为 **${levelText}**。`);
    }
    
    // Count concerns
    const concerns: string[] = [];
    
    // From position analyst
    const positionResult = results.find((r) => r.agentId === 'position_analyst');
    if (positionResult?.data?.concentration_analysis) {
      const concentration = positionResult.data.concentration_analysis as {
        high_concentration_flags?: string[];
        top3_total_weight?: number;
      };
      if (concentration.high_concentration_flags && concentration.high_concentration_flags.length > 0) {
        concerns.push(`持仓集中度过高 (${concentration.high_concentration_flags.join(', ')})`);
      }
    }
    
    // From risk analyst
    if (riskResult?.data?.drawdown_analysis) {
      const drawdown = riskResult.data.drawdown_analysis as { current_drawdown?: number };
      if (drawdown.current_drawdown && drawdown.current_drawdown > 15) {
        concerns.push(`回撤较大 (${drawdown.current_drawdown.toFixed(1)}%)`);
      }
    }
    
    if (riskResult?.data?.leverage_assessment) {
      const leverage = riskResult.data.leverage_assessment as { current_leverage?: number };
      if (leverage.current_leverage && leverage.current_leverage > 2) {
        concerns.push(`杠杆率偏高 (${leverage.current_leverage.toFixed(2)}倍)`);
      }
    }
    
    // Add concerns summary
    if (concerns.length > 0) {
      conclusions.push(`主要风险点: ${concerns.join('、')}。`);
    } else {
      conclusions.push('当前未发现重大风险点。');
    }
    
    // Recommendation
    const recommendation = advisorResult?.data?.recommendation;
    if (recommendation) {
      const recommendationChinese: Record<string, string> = {
        BUY: '建议适度加仓',
        SELL: '建议减仓',
        HOLD: '建议持有观望',
        REBALANCE: '建议调整持仓结构',
        WARNING: '建议立即采取风险控制措施',
      };
      const recText = recommendationChinese[recommendation as string] || recommendation;
      conclusions.push(`投资建议: ${recText}。`);
    }
    
    return conclusions.join(' ');
  }

  /**
   * Extract new memories from agent results
   */
  private extractNewMemories(results: AgentResult[]): MemoryEntry[] {
    const memories: MemoryEntry[] = [];

    for (const result of results) {
      if (result.status === 'success' && result.data.insights) {
        const insights = result.data.insights as string[];
        for (const insight of insights) {
          memories.push({
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            agentId: result.agentId,
            type: 'insight',
            content: insight,
            context: { source: 'execution' },
            importance: 0.7,
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            accessCount: 0,
          });
        }
      }
    }

    return memories;
  }
}


// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an AgentOrchestrator with default configuration
 *
 * @param agents - Array of agents to orchestrate
 * @param options - Optional configuration options
 * @returns Configured AgentOrchestrator instance
 */
export function createOrchestrator(
  agents: Agent[],
  options: OrchestratorOptions = {}
): AgentOrchestrator {
  const cacheManager = new CacheManager();
  return new AgentOrchestrator(agents, cacheManager, options);
}

/**
 * Create a CacheManager instance
 */
export function createCacheManager(): CacheManager {
  return new CacheManager();
}

/**
 * Create a StateManager instance
 */
export function createStateManager(): StateManager {
  return new StateManager();
}


