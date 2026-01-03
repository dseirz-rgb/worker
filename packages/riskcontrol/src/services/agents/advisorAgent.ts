/**
 * Advisor Agent
 *
 * The core synthesis agent that combines insights from all specialist agents
 * to generate comprehensive investment recommendations with prioritized action items.
 *
 * Features:
 * - Synthesis: Integrates Position, Risk, and Market Analyst results
 * - Action Generation: Creates prioritized action items
 * - Personality Integration: Adjusts recommendations based on personality
 * - Memory Integration: Leverages historical insights
 * - Extended Thinking: Deep reasoning for critical scenarios
 *
 * @module agents/advisorAgent
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for detailed design
 */

import type {
  Agent,
  AgentContext,
  AgentResult,
  AgentState,
  AgentMessage,
  PortfolioState,
  AgentPersonality,
  AgentMemoryConfig,
  FinalReport,
  RiskLevel,
  ActionItem,
  RecommendationType,
  ExtendedThinkingConfig,
} from './types';
import { AgentMemoryManager, MemoryEntry } from './memory';
import {
  ExtendedThinkingExecutor,
  shouldUseExtendedThinking,
  createExtendedThinkingExecutor,
} from './extendedThinking';
import {
  generatePersonalityPrompt,
  getActionPriorityMultiplier,
  CHALLENGER_PERSONALITY,
  generateChallengerPersonalityPrompt,
} from './personality';


// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for the Advisor Agent
 */
export interface AdvisorConfig {
  /** Agent personality */
  personality?: AgentPersonality;
  /** Memory manager for cross-session learning */
  memoryManager?: AgentMemoryManager;
  /** Enable extended thinking mode */
  extendedThinkingEnabled?: boolean;
  /** Token budget for extended thinking */
  extendedThinkingBudget?: number;
}

/**
 * Synthesis result combining all agent analyses
 */
export interface SynthesisResult {
  /** Overall risk level */
  riskLevel: RiskLevel;
  /** Key findings from all agents */
  keyFindings: string[];
  /** Areas of concern */
  concerns: string[];
  /** Opportunities identified */
  opportunities: string[];
}

/**
 * Internal state for the Advisor Agent
 */
interface AdvisorInternalState {
  /** Number of analyses performed */
  analysisCount: number;
  /** Last analysis timestamp */
  lastAnalysisTimestamp: number;
  /** Last generated action items */
  lastActionItems: ActionItem[];
}

// =============================================================================
// Advisor Agent Implementation
// =============================================================================

/**
 * Advisor Agent
 *
 * Synthesizes all analyses and provides actionable investment recommendations.
 *
 * @implements {Agent}
 */
export class AdvisorAgent implements Agent {
  id = 'advisor';
  role = 'Investment Advisor';
  goal = 'Synthesize all analyses and provide actionable investment recommendations';
  description = 'Combines insights from all specialist agents to generate comprehensive investment advice with prioritized action items. Should be called last.';
  tools = ['llm', 'memory', 'extended_thinking'];

  personality?: AgentPersonality;
  memory?: AgentMemoryConfig;

  private memoryManager?: AgentMemoryManager;
  private extendedThinkingExecutor?: ExtendedThinkingExecutor;
  private config: AdvisorConfig;

  // Internal state
  private analysisCount = 0;
  private lastAnalysisTimestamp = 0;
  private lastActionItems: ActionItem[] = [];
  private messageHistory: AgentMessage[] = [];
  private extendedThinkingConfig: ExtendedThinkingConfig;

  constructor(config: AdvisorConfig = {}) {
    this.config = config;
    // Use CHALLENGER_PERSONALITY by default for aggressive, challenging style
    // @see Requirements 2.1, 2.2, 2.3
    this.personality = config.personality || CHALLENGER_PERSONALITY;
    this.memoryManager = config.memoryManager;

    // Store extended thinking config for later use
    this.extendedThinkingConfig = {
      enabled: config.extendedThinkingEnabled ?? false,
      budgetTokens: config.extendedThinkingBudget || 10000,
      triggers: {
        criticalRisk: true,
        complexDecision: true,
        userRequested: false,
      },
    };
  }


  async execute(
    context: AgentContext,
    portfolio: PortfolioState
  ): Promise<AgentResult> {
    const startTime = Date.now();
    let tokensUsed = 0;

    try {
      // 1. Load relevant memories
      const relevantMemories = await this.loadRelevantMemories(context);

      // 2. Get results from previous agents
      const positionAnalysis = context.previousResults?.get('position_analyst');
      const riskAnalysis = context.previousResults?.get('risk_analyst');
      const marketAnalysis = context.previousResults?.get('market_analyst');

      // 3. Synthesize risk level
      const synthesis = this.synthesizeAnalyses(
        positionAnalysis,
        riskAnalysis,
        marketAnalysis
      );

      // 4. Check if extended thinking is needed
      const useExtendedThinking = this.shouldUseExtendedThinking(
        synthesis.riskLevel,
        context
      );

      // 5. Generate action items
      let actionItems: ActionItem[];
      let thinkingProcess: string | undefined;

      if (useExtendedThinking && this.extendedThinkingExecutor) {
        const result = await this.generateWithExtendedThinking(
          synthesis,
          portfolio,
          relevantMemories
        );
        actionItems = result.actionItems;
        thinkingProcess = result.thinkingProcess;
        tokensUsed = result.tokensUsed;
      } else {
        actionItems = this.generateActionItems(
          synthesis,
          positionAnalysis,
          riskAnalysis,
          marketAnalysis
        );
      }

      // 6. Apply personality adjustments
      actionItems = this.applyPersonalityAdjustments(actionItems);

      // 7. Generate final report
      const finalReport = this.generateFinalReport(
        synthesis,
        actionItems,
        positionAnalysis,
        riskAnalysis,
        marketAnalysis
      );

      // 8. Store insights to memory
      await this.storeInsightsToMemory(finalReport, context);

      // 9. Generate summary
      const summary = this.generateSummary(finalReport, thinkingProcess);

      // Update internal state
      this.analysisCount++;
      this.lastAnalysisTimestamp = Date.now();
      this.lastActionItems = actionItems;

      return {
        agentId: this.id,
        status: 'success',
        data: {
          final_report: finalReport,
          action_items: actionItems,
          risk_level: synthesis.riskLevel,
          synthesis,
          extended_thinking_used: useExtendedThinking,
          thinking_process: thinkingProcess,
        },
        summary,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          tokensUsed,
          dataSources: ['llm', 'memory'],
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        agentId: this.id,
        status: 'failed',
        data: {
          final_report: this.createEmptyReport(),
          action_items: [],
          risk_level: 'MEDIUM' as RiskLevel,
        },
        summary: `Advisor analysis failed: ${errorMessage}`,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          tokensUsed: 0,
          dataSources: ['llm'],
          error: errorMessage,
        },
      };
    }
  }

  saveState(): AgentState {
    return {
      agentId: this.id,
      timestamp: Date.now(),
      internalState: {
        analysisCount: this.analysisCount,
        lastAnalysisTimestamp: this.lastAnalysisTimestamp,
        lastActionItems: this.lastActionItems,
      },
      messageHistory: this.messageHistory,
    };
  }

  loadState(state: AgentState): void {
    if (state.agentId !== this.id) {
      console.warn(`State agent ID mismatch: expected ${this.id}, got ${state.agentId}`);
      return;
    }

    const internalState = state.internalState as unknown as AdvisorInternalState;
    this.analysisCount = internalState.analysisCount || 0;
    this.lastAnalysisTimestamp = internalState.lastAnalysisTimestamp || 0;
    this.lastActionItems = internalState.lastActionItems || [];
    this.messageHistory = state.messageHistory || [];
  }


  // ===========================================================================
  // Memory Integration
  // ===========================================================================

  private async loadRelevantMemories(context: AgentContext): Promise<MemoryEntry[]> {
    if (!this.memoryManager) return [];

    try {
      return await this.memoryManager.retrieve(
        this.id,
        { query: context.query },
        {
          strategy: 'hybrid',
          limit: 10,
        }
      );
    } catch (error) {
      console.warn('Failed to load memories:', error);
      return [];
    }
  }

  private async storeInsightsToMemory(
    report: FinalReport,
    context: AgentContext
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      await this.memoryManager.store({
        agentId: this.id,
        type: 'insight',
        content: report.summary,
        importance: report.risk_level === 'CRITICAL' ? 1.0 : 0.7,
        context: {
          riskLevel: report.risk_level,
          recommendation: report.recommendation,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.warn('Failed to store memory:', error);
    }
  }

  // ===========================================================================
  // Synthesis
  // ===========================================================================

  private synthesizeAnalyses(
    positionAnalysis?: AgentResult,
    riskAnalysis?: AgentResult,
    marketAnalysis?: AgentResult
  ): SynthesisResult {
    const keyFindings: string[] = [];
    const concerns: string[] = [];
    const opportunities: string[] = [];

    // Extract from position analysis
    if (positionAnalysis?.status === 'success') {
      const data = positionAnalysis.data;
      const concentration = data.concentration_analysis as {
        top3_total_weight?: number;
        high_concentration_flags?: string[];
      };

      if (concentration?.top3_total_weight && concentration.top3_total_weight > 50) {
        concerns.push(`持仓集中度过高: 前3大持仓占比 ${concentration.top3_total_weight.toFixed(1)}%`);
      }

      if (concentration?.high_concentration_flags && concentration.high_concentration_flags.length > 0) {
        concerns.push(`单一持仓过度集中: ${concentration.high_concentration_flags.join(', ')}`);
      }

      const correlationRisks = data.correlation_risks as Array<{ riskLevel: string; description: string }>;
      if (correlationRisks?.length > 0) {
        const highRisks = correlationRisks.filter((r) => r.riskLevel === 'high');
        if (highRisks.length > 0) {
          concerns.push(...highRisks.map((r) => r.description));
        }
      }
    }

    // Extract from risk analysis
    if (riskAnalysis?.status === 'success') {
      const data = riskAnalysis.data;
      const drawdown = data.drawdown_analysis as { current_drawdown?: number };
      const leverage = data.leverage_assessment as { current_leverage?: number; margin_safety?: string };

      if (drawdown?.current_drawdown && drawdown.current_drawdown > 15) {
        concerns.push(`回撤较大: ${drawdown.current_drawdown.toFixed(1)}%`);
      }

      if (leverage?.current_leverage && leverage.current_leverage > 2) {
        concerns.push(`杠杆率偏高: ${leverage.current_leverage.toFixed(2)}倍`);
      }

      if (leverage?.margin_safety === 'danger') {
        concerns.push('保证金安全处于危险水平');
      }
    }

    // Extract from market analysis
    if (marketAnalysis?.status === 'success') {
      const data = marketAnalysis.data;
      const sentiment = data.overall_sentiment as { overall_score?: number; sentiment_label?: string };

      if (sentiment?.overall_score !== undefined) {
        if (sentiment.overall_score < -0.3) {
          concerns.push(`市场情绪偏负面: ${sentiment.sentiment_label}`);
        } else if (sentiment.overall_score > 0.3) {
          opportunities.push(`市场情绪积极: ${sentiment.sentiment_label}`);
        }
      }
    }

    // Determine overall risk level
    const riskLevel = this.determineRiskLevel(concerns, riskAnalysis);

    return {
      riskLevel,
      keyFindings,
      concerns,
      opportunities,
    };
  }

  private determineRiskLevel(concerns: string[], riskAnalysis?: AgentResult): RiskLevel {
    // Check explicit risk level from risk analyst
    if (riskAnalysis?.data?.risk_level) {
      const level = riskAnalysis.data.risk_level as string;
      if (level === 'CRITICAL') return 'CRITICAL';
      if (level === 'HIGH') return 'HIGH';
    }

    // Determine based on concerns
    const criticalKeywords = ['danger', 'critical', 'margin call'];
    const highKeywords = ['high leverage', 'significant drawdown', 'over-concentrated'];

    for (const concern of concerns) {
      const lower = concern.toLowerCase();
      if (criticalKeywords.some((k) => lower.includes(k))) return 'CRITICAL';
    }

    for (const concern of concerns) {
      const lower = concern.toLowerCase();
      if (highKeywords.some((k) => lower.includes(k))) return 'HIGH';
    }

    if (concerns.length >= 3) return 'HIGH';
    if (concerns.length >= 1) return 'MEDIUM';
    return 'LOW';
  }


  // ===========================================================================
  // Extended Thinking
  // ===========================================================================

  private shouldUseExtendedThinking(riskLevel: RiskLevel, context: AgentContext): boolean {
    if (!this.extendedThinkingConfig.enabled) return false;

    const result = shouldUseExtendedThinking({
      riskLevel,
      query: context.query,
      userRequestedDeepAnalysis:
        context.query.includes('深度分析') ||
        context.query.includes('详细') ||
        context.query.includes('deep analysis'),
    }, this.extendedThinkingConfig);
    
    return result.shouldUse;
  }

  private async generateWithExtendedThinking(
    synthesis: SynthesisResult,
    portfolio: PortfolioState,
    memories: MemoryEntry[]
  ): Promise<{ actionItems: ActionItem[]; thinkingProcess: string; tokensUsed: number }> {
    // Build context for extended thinking
    const thinkingContext = {
      riskLevel: synthesis.riskLevel,
      concerns: synthesis.concerns,
      opportunities: synthesis.opportunities,
      portfolioValue: portfolio.totalValue,
      positionCount: portfolio.positions.length,
      relevantMemories: memories.map((m) => m.content).slice(0, 3),
    };

    // For now, simulate extended thinking with structured analysis
    const thinkingProcess = this.simulateExtendedThinking(thinkingContext);
    const actionItems = this.generateActionItemsFromThinking(synthesis, thinkingProcess);

    return {
      actionItems,
      thinkingProcess,
      tokensUsed: thinkingProcess.length / 4, // Rough estimate
    };
  }

  private simulateExtendedThinking(context: {
    riskLevel: RiskLevel;
    concerns: string[];
    opportunities: string[];
    portfolioValue: number;
    positionCount: number;
    relevantMemories: string[];
  }): string {
    const steps: string[] = [];

    steps.push(`## Extended Thinking Process\n`);
    steps.push(`### Step 1: Risk Assessment`);
    steps.push(`Current risk level: ${context.riskLevel}`);
    steps.push(`Number of concerns: ${context.concerns.length}`);
    steps.push(`Number of opportunities: ${context.opportunities.length}\n`);

    steps.push(`### Step 2: Concern Analysis`);
    for (const concern of context.concerns) {
      steps.push(`- Analyzing: ${concern}`);
    }
    steps.push('');

    steps.push(`### Step 3: Historical Context`);
    if (context.relevantMemories.length > 0) {
      steps.push(`Found ${context.relevantMemories.length} relevant past insights`);
    } else {
      steps.push('No relevant historical insights found');
    }
    steps.push('');

    steps.push(`### Step 4: Action Prioritization`);
    steps.push(`Portfolio value: $${context.portfolioValue.toLocaleString()}`);
    steps.push(`Position count: ${context.positionCount}`);
    steps.push('Prioritizing actions based on risk level and portfolio size\n');

    steps.push(`### Conclusion`);
    steps.push(`Risk level ${context.riskLevel} requires ${context.riskLevel === 'CRITICAL' ? 'immediate' : 'timely'} action.`);

    return steps.join('\n');
  }

  private generateActionItemsFromThinking(
    synthesis: SynthesisResult,
    _thinkingProcess: string
  ): ActionItem[] {
    return this.generateActionItems(synthesis, undefined, undefined, undefined);
  }

  // ===========================================================================
  // Action Item Generation
  // ===========================================================================

  private generateActionItems(
    synthesis: SynthesisResult,
    positionAnalysis?: AgentResult,
    riskAnalysis?: AgentResult,
    marketAnalysis?: AgentResult
  ): ActionItem[] {
    const items: ActionItem[] = [];
    let priority = 1;

    // Generate items based on concerns
    for (const concern of synthesis.concerns) {
      const item = this.concernToActionItem(concern, priority++);
      if (item) items.push(item);
    }

    // Add rebalancing suggestion if concentration is high
    if (positionAnalysis?.data?.concentration_analysis) {
      const concentration = positionAnalysis.data.concentration_analysis as {
        high_concentration_flags?: string[];
      };
      
      if (concentration.high_concentration_flags && concentration.high_concentration_flags.length > 0) {
        for (const ticker of concentration.high_concentration_flags) {
          items.push({
            action: 'rebalance',
            ticker,
            priority: priority++,
            rationale: `持仓 ${ticker} 超过30%集中度阈值`,
          });
        }
      }
    }

    // Add monitoring items for market sentiment
    if (marketAnalysis?.data?.ticker_sentiments) {
      const sentiments = marketAnalysis.data.ticker_sentiments as Array<{
        ticker: string;
        sentiment_score: number;
      }>;
      
      const negative = sentiments.filter((s) => s.sentiment_score < -0.3);
      for (const s of negative.slice(0, 2)) {
        items.push({
          action: 'monitor',
          ticker: s.ticker,
          priority: priority++,
          rationale: `检测到负面市场情绪 (${s.sentiment_score.toFixed(2)})`,
        });
      }
    }

    // Sort by priority
    return items.sort((a, b) => a.priority - b.priority).slice(0, 10);
  }

  private concernToActionItem(concern: string, priority: number): ActionItem | null {
    const lower = concern.toLowerCase();

    if (lower.includes('leverage') || lower.includes('margin') || lower.includes('杠杆') || lower.includes('保证金')) {
      return {
        action: 'sell',
        ticker: 'PORTFOLIO',
        priority,
        rationale: `降低杠杆: ${concern}`,
      };
    }

    if (lower.includes('drawdown') || lower.includes('回撤')) {
      return {
        action: 'hold',
        ticker: 'PORTFOLIO',
        priority,
        rationale: `关注回撤: ${concern}`,
      };
    }

    if (lower.includes('concentrated') || lower.includes('concentration') || lower.includes('集中')) {
      return {
        action: 'rebalance',
        ticker: 'PORTFOLIO',
        priority,
        rationale: `调整集中度: ${concern}`,
      };
    }

    return null;
  }

  private applyPersonalityAdjustments(items: ActionItem[]): ActionItem[] {
    if (!this.personality) return items;

    const adjustedItems = items.map((item) => {
      // Map action item action to personality action type
      const actionTypeMap: Record<string, 'buy' | 'sell' | 'hold' | 'reduce' | 'increase'> = {
        buy: 'buy',
        sell: 'sell',
        hold: 'hold',
        rebalance: 'reduce',
        monitor: 'hold',
      };
      const actionType = actionTypeMap[item.action] || 'hold';
      const multiplier = getActionPriorityMultiplier(this.personality!, actionType);
      
      return {
        ...item,
        priority: Math.max(1, Math.round(item.priority * multiplier)),
      };
    });

    // Re-sort by priority after applying adjustments
    return adjustedItems.sort((a, b) => a.priority - b.priority);
  }


  // ===========================================================================
  // Report Generation
  // ===========================================================================

  private generateFinalReport(
    synthesis: SynthesisResult,
    actionItems: ActionItem[],
    positionAnalysis?: AgentResult,
    riskAnalysis?: AgentResult,
    marketAnalysis?: AgentResult
  ): FinalReport {
    // Determine recommendation
    const recommendation = this.determineRecommendation(synthesis, actionItems);

    // Build summary in Chinese
    const summaryParts: string[] = [];
    
    if (synthesis.concerns.length > 0) {
      summaryParts.push(`主要风险点: ${synthesis.concerns.slice(0, 3).join('; ')}`);
    }
    
    if (synthesis.opportunities.length > 0) {
      summaryParts.push(`投资机会: ${synthesis.opportunities.slice(0, 2).join('; ')}`);
    }

    // Build content
    const contentParts: string[] = [];
    
    if (positionAnalysis?.summary) {
      contentParts.push(`## 持仓分析\n${positionAnalysis.summary}`);
    }
    
    if (riskAnalysis?.summary) {
      contentParts.push(`## 风险分析\n${riskAnalysis.summary}`);
    }
    
    if (marketAnalysis?.summary) {
      contentParts.push(`## 市场分析\n${marketAnalysis.summary}`);
    }

    // Build action plan in Chinese
    const actionLabels: Record<string, string> = {
      BUY: '买入',
      SELL: '卖出',
      HOLD: '持有',
      REBALANCE: '调仓',
      MONITOR: '关注',
    };
    
    const actionPlan = actionItems
      .slice(0, 5)
      .map((item, i) => `${i + 1}. [${actionLabels[item.action.toUpperCase()] || item.action.toUpperCase()}] ${item.ticker}: ${item.rationale}`)
      .join('\n');

    // Get primary ticker
    const primaryTicker = actionItems.find((i) => i.ticker !== 'PORTFOLIO')?.ticker || 'PORTFOLIO';

    return {
      title: `投资分析报告 - ${new Date().toLocaleDateString('zh-CN')}`,
      risk_level: synthesis.riskLevel,
      summary: summaryParts.join('。') || '投资组合分析完成。',
      content: contentParts.join('\n\n') || '暂无详细分析。',
      recommendation,
      action_plan: actionPlan || '暂无需要立即执行的操作。',
      primary_ticker: primaryTicker,
    };
  }

  private determineRecommendation(
    synthesis: SynthesisResult,
    actionItems: ActionItem[]
  ): RecommendationType {
    if (synthesis.riskLevel === 'CRITICAL') return 'WARNING';
    if (synthesis.riskLevel === 'HIGH') return 'REBALANCE';

    const hasRebalance = actionItems.some((i) => i.action === 'rebalance');
    if (hasRebalance) return 'REBALANCE';

    const hasSell = actionItems.some((i) => i.action === 'sell');
    if (hasSell) return 'SELL';

    if (synthesis.opportunities.length > synthesis.concerns.length) return 'BUY';

    return 'HOLD';
  }

  private createEmptyReport(): FinalReport {
    return {
      title: 'Investment Analysis Report',
      risk_level: 'MEDIUM',
      summary: 'Analysis incomplete.',
      content: '',
      recommendation: 'HOLD',
      action_plan: '',
      primary_ticker: 'PORTFOLIO',
    };
  }

  private generateSummary(report: FinalReport, thinkingProcess?: string): string {
    const parts: string[] = [];

    // Risk level indicator with Chinese labels
    const riskEmoji = {
      LOW: '🟢',
      MEDIUM: '🟡',
      HIGH: '🟠',
      CRITICAL: '🔴',
    }[report.risk_level];

    const riskLevelChinese = {
      LOW: '低风险',
      MEDIUM: '中等风险',
      HIGH: '高风险',
      CRITICAL: '危险',
    }[report.risk_level];

    const recommendationChinese = {
      BUY: '建议买入',
      SELL: '建议卖出',
      HOLD: '建议持有',
      REBALANCE: '建议调仓',
      WARNING: '风险警告',
    }[report.recommendation] || report.recommendation;

    parts.push(`${riskEmoji} 风险等级: ${riskLevelChinese}`);
    parts.push(`投资建议: ${recommendationChinese}`);

    if (report.summary) {
      parts.push(report.summary);
    }

    if (thinkingProcess) {
      parts.push('(本次分析使用了深度思考模式)');
    }

    return parts.join('。');
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an Advisor Agent with default configuration
 */
export function createAdvisorAgent(config?: AdvisorConfig): AdvisorAgent {
  return new AdvisorAgent(config);
}

/**
 * Create a conservative Advisor Agent
 */
export function createConservativeAdvisor(
  memoryManager?: AgentMemoryManager
): AdvisorAgent {
  return new AdvisorAgent({
    personality: {
      riskTolerance: 'conservative',
      decisionStyle: 'data-driven',
    },
    memoryManager,
    extendedThinkingEnabled: true,
  });
}

/**
 * Create an aggressive Advisor Agent
 */
export function createAggressiveAdvisor(
  memoryManager?: AgentMemoryManager
): AdvisorAgent {
  return new AdvisorAgent({
    personality: {
      riskTolerance: 'aggressive',
      decisionStyle: 'intuitive',
    },
    memoryManager,
    extendedThinkingEnabled: false,
  });
}

export default AdvisorAgent;
