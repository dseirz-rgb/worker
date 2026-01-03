/**
 * Multi-Agent Service
 *
 * Unified entry point for the multi-agent investment analysis system.
 * Coordinates all agents, manages state, and provides a simple API.
 *
 * @module agents/multiAgentService
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for detailed design
 */

import type {
  PortfolioState,
  OrchestrationMode,
  AgentPersonality,
  OrchestratorResult,
  AgentAlertEvent,
  ProgressStatus,
  Agent,
} from './types';
import { AgentOrchestrator, createOrchestrator, CacheManager } from './orchestrator';
import { AgentMemoryManager, createMemoryManager } from './memory';
import { AgentAlertManager, createAlertManager } from './alertManager';
import { StateManager, createStateManager } from './stateManager';
import { createPositionAnalystAgent } from './positionAnalyst';
import { createRiskAnalystAgent } from './riskAnalyst';
import { createMarketAnalystAgent } from './marketAnalyst';
import { createAdvisorAgent } from './advisorAgent';
import { DataSourceCacheManager, createDataSourceManager } from './dataSources';


// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for the Multi-Agent Service
 */
export interface MultiAgentConfig {
  // API Keys
  serperApiKey?: string;
  geminiApiKey?: string;
  jinaApiKey?: string;

  // Orchestration
  mode?: OrchestrationMode;
  personality?: AgentPersonality;

  // Features
  enableMemory?: boolean;
  enableExtendedThinking?: boolean;
  enableAlerts?: boolean;

  // Callbacks
  onProgress?: (status: ProgressStatus) => void;
  onAlert?: (alert: AgentAlertEvent) => void;
}

/**
 * Request for portfolio analysis
 */
export interface AnalysisRequest {
  portfolio: PortfolioState;
  query?: string;
  mode?: OrchestrationMode;
  personality?: AgentPersonality;
}

/**
 * Service status information
 */
export interface ServiceStatus {
  memoryEntries: number;
  cacheSize: number;
  hasState: boolean;
  agentCount: number;
}

// =============================================================================
// Multi-Agent Service Implementation
// =============================================================================

/**
 * Multi-Agent Service
 *
 * Unified entry point for the multi-agent investment analysis system.
 */
export class MultiAgentService {
  private orchestrator: AgentOrchestrator;
  private memoryManager: AgentMemoryManager;
  private alertManager: AgentAlertManager;
  private stateManager: StateManager;
  private dataSourceManager: DataSourceCacheManager;
  private config: MultiAgentConfig;
  private agents: Agent[];

  constructor(config: MultiAgentConfig = {}) {
    this.config = config;

    // 1. Initialize Memory Manager
    this.memoryManager = createMemoryManager();

    // 2. Initialize Alert Manager
    this.alertManager = createAlertManager();
    if (config.onAlert) {
      this.alertManager.onAlert(config.onAlert);
    }

    // 3. Initialize State Manager
    this.stateManager = createStateManager();

    // 4. Initialize Data Sources
    this.dataSourceManager = createDataSourceManager({
      serperApiKey: config.serperApiKey,
      jinaApiKey: config.jinaApiKey,
    });

    // 5. Create Agents
    this.agents = this.createAgents();

    // 6. Initialize Orchestrator
    const cacheManager = new CacheManager();
    this.orchestrator = new AgentOrchestrator(this.agents, cacheManager, {
      mode: config.mode || 'sequential',
      memoryManager: config.enableMemory ? this.memoryManager : undefined,
    });
  }

  private createAgents(): Agent[] {
    const agents: Agent[] = [];

    // Position Analyst
    agents.push(
      createPositionAnalystAgent(this.config.personality)
    );

    // Risk Analyst
    agents.push(createRiskAnalystAgent());

    // Market Analyst (if API key available)
    if (this.config.serperApiKey) {
      agents.push(
        createMarketAnalystAgent(this.config.serperApiKey, {
          jinaApiKey: this.config.jinaApiKey,
          personality: this.config.personality,
        })
      );
    }

    // Advisor Agent
    agents.push(
      createAdvisorAgent({
        personality: this.config.personality,
        memoryManager: this.config.enableMemory ? this.memoryManager : undefined,
        extendedThinkingEnabled: this.config.enableExtendedThinking,
      })
    );

    return agents;
  }


  /**
   * Execute a full portfolio analysis
   */
  async analyze(request: AnalysisRequest): Promise<OrchestratorResult> {
    const { portfolio, query, mode, personality } = request;

    // Check for saved state
    const savedState = await this.stateManager.loadState();
    if (savedState) {
      console.log('Found saved state, can resume if needed');
    }

    // Execute analysis with alert callback
    const result = await this.orchestrator.execute(portfolio, {
      query: query || '分析我的投资组合风险',
      mode: mode || this.config.mode || 'sequential',
      personalityOverride: personality || this.config.personality,
      onAlert: this.config.onAlert,
    }, this.config.onProgress);

    // Save state
    const state = await this.orchestrator.saveState();
    if (state) {
      await this.stateManager.saveState(state);
    }

    return result;
  }

  /**
   * Quick analysis using Respond Directly mode
   */
  async quickAnalyze(
    portfolio: PortfolioState,
    query: string
  ): Promise<OrchestratorResult> {
    return this.analyze({
      portfolio,
      query,
      mode: 'respond_directly',
    });
  }

  /**
   * Deep analysis using Sequential mode with Extended Thinking
   */
  async deepAnalyze(
    portfolio: PortfolioState,
    query?: string
  ): Promise<OrchestratorResult> {
    return this.analyze({
      portfolio,
      query: query || '请对我的投资组合进行深度风险分析',
      mode: 'sequential',
    });
  }

  /**
   * Clear all caches and state
   */
  async clearAll(): Promise<void> {
    await this.stateManager.clearState();
    await this.dataSourceManager.clearAll();
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<ServiceStatus> {
    const allMemories = await this.memoryManager.getAll();
    const hasState = await this.stateManager.hasState();
    return {
      memoryEntries: allMemories.length,
      cacheSize: this.dataSourceManager.getTotalCacheSize(),
      hasState,
      agentCount: this.agents.length,
    };
  }

  /**
   * Get the orchestrator for advanced usage
   */
  getOrchestrator(): AgentOrchestrator {
    return this.orchestrator;
  }

  /**
   * Get the memory manager for advanced usage
   */
  getMemoryManager(): AgentMemoryManager {
    return this.memoryManager;
  }

  /**
   * Get the alert manager for advanced usage
   */
  getAlertManager(): AgentAlertManager {
    return this.alertManager;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a Multi-Agent Service with configuration
 */
export function createMultiAgentService(
  config?: MultiAgentConfig
): MultiAgentService {
  return new MultiAgentService(config);
}

/**
 * Convenience function to analyze a portfolio
 */
export async function analyzePortfolio(
  portfolio: PortfolioState,
  options?: {
    query?: string;
    mode?: OrchestrationMode;
    onProgress?: (status: ProgressStatus) => void;
    onAlert?: (alert: AgentAlertEvent) => void;
    serperApiKey?: string;
  }
): Promise<OrchestratorResult> {
  const service = createMultiAgentService({
    mode: options?.mode,
    onProgress: options?.onProgress,
    onAlert: options?.onAlert,
    serperApiKey: options?.serperApiKey,
  });

  return service.analyze({
    portfolio,
    query: options?.query,
  });
}

export default MultiAgentService;
