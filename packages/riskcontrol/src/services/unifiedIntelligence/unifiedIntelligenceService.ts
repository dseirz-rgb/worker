/**
 * Unified Intelligence Service
 *
 * 统一入口服务，整合 Multi-Agent System、Adaptive RAG、LightRAG 和 Voice Service。
 *
 * 核心功能：
 * 1. query() - 自动分类并路由查询
 * 2. deepAnalyze() - 强制使用多 Agent 深度分析
 * 3. quickAnswer() - 强制使用 RAG 快速响应
 * 4. generateDailyInsight() - 生成每日洞察
 * 5. getVoiceContext() - 获取语音服务上下文
 *
 * 向后兼容：
 * - 设置 DISABLE_UNIFIED_INTELLIGENCE=true 环境变量可禁用统一智能系统
 * - 禁用时自动降级到 ragService
 *
 * @module unifiedIntelligence/unifiedIntelligenceService
 * @see {@link .kiro/specs/unified-intelligence/design.md}
 */

import type {
  UnifiedIntelligenceConfig,
  QueryResult,
  AnalysisResult,
  QueryContext,
  VoiceContext,
  DailyInsight,
  ProcessingMode,
  ClassificationResult,
  QueryOptions,
  DeepAnalyzeOptions,
  PortfolioState,
  AgentResult,
  AgentAlertEvent,
  Citation,
  ProgressStatus,
} from './types';
import { DEFAULT_UNIFIED_INTELLIGENCE_CONFIG } from './types';
import { QueryClassifier } from './queryClassifier';
import { EnhancedAdaptiveRAGService } from './enhancedAdaptiveRag';
import { AgentRAGIntegration } from './agentRagIntegration';
import {
  UnifiedIntelligenceCache,
  unifiedIntelligenceCache,
  QUERY_RESULT_TTL,
  AGENT_RESULT_TTL,
  DAILY_INSIGHT_TTL,
} from './cache';
import {
  buildChallengerPrompt,
  DEFAULT_CHALLENGER_CONFIG,
  CHALLENGER_ENABLED,
  type ChallengerContext,
} from '../challengerPromptBuilder';

// =============================================================================
// Feature Flag
// =============================================================================

/**
 * Check if unified intelligence is disabled via environment variable.
 * When disabled, falls back to legacy ragService.
 */
function isUnifiedIntelligenceDisabled(): boolean {
  // Check for browser environment
  if (typeof window !== 'undefined') {
    // Check for Vite env variable
    const viteEnv = (import.meta as any)?.env?.VITE_DISABLE_UNIFIED_INTELLIGENCE;
    if (viteEnv === 'true' || viteEnv === '1') {
      return true;
    }
  }
  
  // Check for Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    const nodeEnv = process.env.DISABLE_UNIFIED_INTELLIGENCE;
    if (nodeEnv === 'true' || nodeEnv === '1') {
      return true;
    }
  }
  
  return false;
}

/**
 * Feature flag status - cached for performance
 */
let _featureFlagChecked = false;
let _isDisabled = false;

function checkFeatureFlag(): boolean {
  if (!_featureFlagChecked) {
    _isDisabled = isUnifiedIntelligenceDisabled();
    _featureFlagChecked = true;
    if (_isDisabled) {
      console.log('[UnifiedIntelligence] Disabled via feature flag, using legacy ragService');
    }
  }
  return _isDisabled;
}

// =============================================================================
// Types
// =============================================================================

/**
 * Internal execution state
 */
interface ExecutionState {
  startTime: number;
  mode: ProcessingMode;
  classification?: ClassificationResult;
  ragResult?: { text: string; citations: Citation[] };
  agentResults?: AgentResult[];
  alerts: AgentAlertEvent[];
}

// =============================================================================
// UnifiedIntelligenceService Class
// =============================================================================

/**
 * Unified Intelligence Service
 *
 * 统一入口，根据查询复杂度自动选择处理模式：
 * - rag_only: 简单问题，快速响应 (<2s)
 * - rag_agent: RAG + 单 Agent 分析 (5-15s)
 * - full_agent: 完整多 Agent 分析 (15-30s)
 *
 * @example
 * ```typescript
 * const service = new UnifiedIntelligenceService();
 *
 * // 自动路由查询
 * const result = await service.query('什么是价值投资？');
 *
 * // 深度分析
 * const analysis = await service.deepAnalyze(portfolio, '分析风险');
 *
 * // 快速响应
 * const quick = await service.quickAnswer('今天市场怎么样？');
 * ```
 */
export class UnifiedIntelligenceService {
  private config: UnifiedIntelligenceConfig;
  private queryClassifier: QueryClassifier;
  private enhancedRag: EnhancedAdaptiveRAGService;
  private agentRagIntegration: AgentRAGIntegration;
  private cache: UnifiedIntelligenceCache;

  constructor(config?: Partial<UnifiedIntelligenceConfig>) {
    this.config = { ...DEFAULT_UNIFIED_INTELLIGENCE_CONFIG, ...config };
    this.queryClassifier = new QueryClassifier({
      confidenceThreshold: this.config.confidenceThreshold,
    });
    this.enhancedRag = new EnhancedAdaptiveRAGService();
    this.agentRagIntegration = new AgentRAGIntegration();
    this.cache = unifiedIntelligenceCache;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * 自动分类并路由查询
   *
   * 根据查询复杂度自动选择处理模式：
   * - 简单问题 + 高置信度 → RAG only
   * - 中等复杂度 → RAG + Agent
   * - 复杂问题 → Full Agent
   *
   * 向后兼容：当 DISABLE_UNIFIED_INTELLIGENCE=true 时，降级到 ragService
   *
   * @param question - 用户查询
   * @param context - 可选上下文
   * @param options - 可选配置
   * @returns 查询结果
   */
  async query(
    question: string,
    context?: QueryContext,
    options?: QueryOptions
  ): Promise<QueryResult> {
    // Check feature flag - fallback to legacy ragService if disabled
    if (checkFeatureFlag()) {
      return this.queryLegacy(question);
    }

    // Check cache first (unless skipCache is set)
    if (this.config.cacheEnabled && !options?.skipCache) {
      const cached = this.cache.getCachedQueryResult(question);
      if (cached) {
        return cached;
      }
    }

    const state: ExecutionState = {
      startTime: Date.now(),
      mode: 'rag_only',
      alerts: [],
    };

    try {
      // 1. 确定处理模式
      if (options?.forceMode) {
        state.mode = options.forceMode;
      } else if (context?.forceMode) {
        state.mode = context.forceMode;
      } else {
        state.classification = await this.queryClassifier.classify(question);
        state.mode = state.classification.mode;
      }

      // 2. 根据模式执行
      let result: QueryResult;
      switch (state.mode) {
        case 'rag_only':
          result = await this.executeRagOnly(question, state);
          break;

        case 'rag_agent':
          result = await this.executeRagAgent(
            question,
            state,
            state.classification?.suggestedAgents
          );
          break;

        case 'full_agent':
          result = await this.executeFullAgent(question, state, context?.portfolio);
          break;

        default:
          result = await this.executeRagOnly(question, state);
      }

      // Cache the result
      if (this.config.cacheEnabled) {
        this.cache.cacheQueryResult(question, result);
      }

      return result;
    } catch (error) {
      console.error('[UnifiedIntelligence] Query error:', error);
      return this.createErrorResult(state, error);
    }
  }

  /**
   * Legacy query implementation using ragService
   * Used when unified intelligence is disabled via feature flag
   */
  private async queryLegacy(question: string): Promise<QueryResult> {
    const startTime = Date.now();
    try {
      // Dynamic import to avoid circular dependencies
      const { ragService } = await import('../ragService');
      const result = await ragService.getInvestmentContext(question);
      
      // Map citations to ensure content_snippet is always present
      const mappedCitations: Citation[] = result.citations.map(c => ({
        source: c.source,
        title: c.title,
        content_snippet: c.content_snippet || '',
        url: c.url,
      }));
      
      return {
        text: result.text,
        citations: mappedCitations,
        mode: 'rag_only',
        confidence: 0.8,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[UnifiedIntelligence] Legacy query error:', error);
      return {
        text: '处理请求时发生错误，请稍后重试。',
        citations: [],
        mode: 'rag_only',
        confidence: 0,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 深度分析 - 强制使用多 Agent
   *
   * @param portfolio - 投资组合状态
   * @param query - 可选的分析查询
   * @param options - 可选配置
   * @returns 分析结果
   */
  async deepAnalyze(
    portfolio: PortfolioState,
    query?: string,
    options?: DeepAnalyzeOptions
  ): Promise<AnalysisResult> {
    const state: ExecutionState = {
      startTime: Date.now(),
      mode: 'full_agent',
      alerts: [],
    };

    const analysisQuery = query || '请对当前投资组合进行全面深度分析';

    try {
      // 1. 获取 RAG 上下文
      const ragResult = await this.enhancedRag.getInvestmentContext(analysisQuery);
      state.ragResult = ragResult;

      // 2. 执行多 Agent 分析
      const agentResults = await this.executeMultiAgentAnalysis(
        analysisQuery,
        portfolio,
        options
      );
      state.agentResults = agentResults;

      // 3. 合成最终结果
      return this.synthesizeAnalysisResult(state, agentResults, portfolio);
    } catch (error) {
      console.error('[UnifiedIntelligence] Deep analyze error:', error);
      return this.createErrorAnalysisResult(state, error);
    }
  }

  /**
   * 快速响应 - 强制使用 RAG
   *
   * @param question - 用户查询
   * @returns 查询结果
   */
  async quickAnswer(question: string): Promise<QueryResult> {
    return this.query(question, undefined, { forceMode: 'rag_only' });
  }

  /**
   * 生成每日洞察
   *
   * @param portfolio - 投资组合状态
   * @returns 每日洞察
   */
  async generateDailyInsight(portfolio: PortfolioState): Promise<DailyInsight> {
    const today = new Date().toISOString().split('T')[0];

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.cache.getCachedDailyInsight(today);
      if (cached) {
        return cached;
      }
    }

    try {
      // 执行各 Agent 分析
      const [positionResult, riskResult, marketResult] = await Promise.all([
        this.executeAgentAnalysis('position_analyst', '分析当前持仓结构', portfolio),
        this.executeAgentAnalysis('risk_analyst', '评估当前风险状况', portfolio),
        this.executeAgentAnalysis('market_analyst', '分析今日市场动态', portfolio),
      ]);

      // 生成顾问建议
      const advisorResult = await this.executeAgentAnalysis(
        'advisor',
        '基于以上分析给出今日建议',
        portfolio
      );

      const insight: DailyInsight = {
        date: today,
        summary: this.generateDailySummary(positionResult, riskResult, marketResult),
        positionInsights: {
          agentId: 'position_analyst',
          summary: positionResult?.summary || '持仓分析暂不可用',
          keyChanges: this.extractKeyPoints(positionResult),
        },
        riskInsights: {
          agentId: 'risk_analyst',
          summary: riskResult?.summary || '风险分析暂不可用',
          riskLevel: this.extractRiskLevel(riskResult),
          warnings: this.extractWarnings(riskResult),
        },
        marketInsights: {
          agentId: 'market_analyst',
          summary: marketResult?.summary || '市场分析暂不可用',
          headlines: this.extractHeadlines(marketResult),
        },
        recommendation: {
          agentId: 'advisor',
          summary: advisorResult?.summary || '建议暂不可用',
          actions: this.extractActions(advisorResult),
        },
      };

      // Cache the result
      if (this.config.cacheEnabled) {
        this.cache.cacheDailyInsight(today, insight);
      }

      return insight;
    } catch (error) {
      console.error('[UnifiedIntelligence] Daily insight error:', error);
      return this.createEmptyDailyInsight(today);
    }
  }

  /**
   * 获取语音服务上下文
   *
   * @returns 语音上下文
   */
  async getVoiceContext(): Promise<VoiceContext> {
    try {
      // 获取最新分析结果（如果有缓存）
      const latestAnalysis = await this.getLatestAnalysisSummary();

      return {
        portfolioSummary: await this.getPortfolioSummary(),
        riskSummary: await this.getRiskSummary(),
        latestAnalysis,
        recentAlerts: await this.getRecentAlerts(),
      };
    } catch (error) {
      console.error('[UnifiedIntelligence] Voice context error:', error);
      return {
        portfolioSummary: '投资组合信息暂不可用',
        riskSummary: '风险信息暂不可用',
        recentAlerts: [],
      };
    }
  }

  // ===========================================================================
  // Challenger Integration
  // ===========================================================================

  /**
   * Build challenger context from portfolio and user data
   * @see Requirements 1.1, 1.2, 1.3, 1.4
   */
  private async buildChallengerContext(
    portfolio?: PortfolioState
  ): Promise<ChallengerContext> {
    const context: ChallengerContext = {};

    // Extract holdings from portfolio
    if (portfolio?.positions) {
      context.currentHoldings = portfolio.positions.map(p => ({
        ticker: p.ticker,
        weight: p.weight,
        pnl: p.unrealizedPnL,
      }));
    }

    // Try to load user principles from notes (via RAG)
    try {
      const principlesResult = await this.enhancedRag.getInvestmentContext(
        '我的投资原则和规则'
      );
      // Extract principles from RAG result
      const principleMatches = principlesResult.text.match(/原则[：:]\s*([^\n]+)/g);
      if (principleMatches) {
        context.userPrinciples = principleMatches.map(p => 
          p.replace(/原则[：:]\s*/, '').trim()
        );
      }
    } catch (error) {
      console.warn('[UnifiedIntelligence] Failed to load user principles:', error);
    }

    return context;
  }

  /**
   * Enhance query with challenger prompt
   * @see Requirements 1.1, 3.1, 3.2
   */
  private enhanceQueryWithChallenger(
    query: string,
    challengerContext: ChallengerContext
  ): string {
    if (!CHALLENGER_ENABLED) {
      return query;
    }

    return buildChallengerPrompt(query, challengerContext, DEFAULT_CHALLENGER_CONFIG);
  }

  // ===========================================================================
  // Execution Methods
  // ===========================================================================

  /**
   * 执行 RAG-only 模式
   */
  private async executeRagOnly(
    question: string,
    state: ExecutionState
  ): Promise<QueryResult> {
    const ragResult = await this.enhancedRag.getInvestmentContext(question);
    state.ragResult = ragResult;

    return {
      text: ragResult.text,
      citations: ragResult.citations,
      mode: 'rag_only',
      confidence: state.classification?.confidence || 0.8,
      processingTime: Date.now() - state.startTime,
    };
  }

  /**
   * 执行 RAG + Agent 模式
   */
  private async executeRagAgent(
    question: string,
    state: ExecutionState,
    suggestedAgents?: string[]
  ): Promise<QueryResult> {
    // 1. 获取 RAG 结果
    const ragResult = await this.enhancedRag.getInvestmentContext(question);
    state.ragResult = ragResult;

    // 2. 选择并执行单个 Agent
    const agentId = suggestedAgents?.[0] || 'advisor';
    const agentResult = await this.executeAgentAnalysis(agentId, question);

    if (agentResult) {
      state.agentResults = [agentResult];
    }

    // 3. 合并结果
    const combinedText = agentResult
      ? `${ragResult.text}\n\n**${this.getAgentName(agentId)}分析：**\n${agentResult.summary}`
      : ragResult.text;

    return {
      text: combinedText,
      citations: ragResult.citations,
      mode: 'rag_agent',
      agentResults: state.agentResults,
      confidence: state.classification?.confidence || 0.7,
      processingTime: Date.now() - state.startTime,
    };
  }

  /**
   * 执行完整多 Agent 模式
   */
  private async executeFullAgent(
    question: string,
    state: ExecutionState,
    portfolio?: PortfolioState
  ): Promise<QueryResult> {
    // 1. 获取 RAG 上下文
    const ragResult = await this.enhancedRag.getInvestmentContext(question);
    state.ragResult = ragResult;

    // 2. 执行多 Agent 分析
    const agentResults = await this.executeMultiAgentAnalysis(question, portfolio);
    state.agentResults = agentResults;

    // 3. 合成结果
    const synthesizedText = this.synthesizeAgentResults(ragResult.text, agentResults);

    return {
      text: synthesizedText,
      citations: ragResult.citations,
      mode: 'full_agent',
      agentResults,
      confidence: state.classification?.confidence || 0.9,
      processingTime: Date.now() - state.startTime,
    };
  }

  /**
   * 执行多 Agent 分析
   * 
   * 使用 Multi-Agent Orchestrator 执行完整的多 Agent 分析
   * 集成 Challenger 风格以保持"严厉教练"特性
   * 
   * @see Requirements 1.1, 1.2, 1.3, 1.4
   */
  private async executeMultiAgentAnalysis(
    query: string,
    portfolio?: PortfolioState,
    options?: DeepAnalyzeOptions
  ): Promise<AgentResult[]> {
    try {
      // 构建默认 portfolio 如果没有提供
      const effectivePortfolio: PortfolioState = portfolio || {
        positions: [],
        totalValue: 0,
        cashBalance: 0,
        marginLoan: 0,
        highWaterMark: 0,
        timestamp: Date.now(),
      };

      // 获取 RAG 上下文
      const ragContext = await this.enhancedRag.getInvestmentContext(query);

      // 构建 Challenger 上下文
      const challengerContext = await this.buildChallengerContext(effectivePortfolio);

      // 增强查询以包含 Challenger 指令
      const enhancedQuery = this.enhanceQueryWithChallenger(
        `${query}\n\n相关知识库文档:\n${ragContext.text}`,
        challengerContext
      );

      options?.onProgress?.({
        currentAgent: 'orchestrator',
        phase: 'initializing',
        progress: 10,
        message: '正在初始化多 Agent 分析（质疑模式）...',
      });

      // 动态导入 multi-agent 服务以避免循环依赖
      const { analyzePortfolio } = await import('../agents');

      // 调用真实的 multi-agent 系统，使用 sequential 模式执行所有 agents
      const orchestratorResult = await analyzePortfolio(effectivePortfolio, {
        query: enhancedQuery,
        mode: 'sequential', // 使用顺序模式执行所有 agents
        onProgress: options?.onProgress ? (status) => {
          options.onProgress!({
            currentAgent: status.currentAgent,
            phase: status.phase,
            progress: 10 + (status.progress * 0.9), // 10-100%
            message: status.message,
          });
        } : undefined,
      });

      options?.onProgress?.({
        currentAgent: 'orchestrator',
        phase: 'completed',
        progress: 100,
        message: '多 Agent 分析完成',
      });

      return orchestratorResult.results;
    } catch (error) {
      console.error('[UnifiedIntelligence] Multi-agent analysis error:', error);
      
      // 降级到单独执行每个 agent
      console.warn('[UnifiedIntelligence] Falling back to individual agent execution');
      const agents = ['position_analyst', 'risk_analyst', 'market_analyst', 'advisor'];
      const includedAgents = options?.includeAgents || agents;
      const excludedAgents = options?.excludeAgents || [];

      const activeAgents = includedAgents.filter((a) => !excludedAgents.includes(a));

      const results = await Promise.all(
        activeAgents.map((agentId) =>
          this.executeAgentAnalysis(agentId, query, portfolio, options?.onProgress)
        )
      );

      return results.filter((r): r is AgentResult => r !== null);
    }
  }

  /**
   * 执行单个 Agent 分析 (用于降级或单独调用场景)
   * 
   * 集成真实的 Multi-Agent 系统，调用 orchestrator 执行分析
   */
  private async executeAgentAnalysis(
    agentId: string,
    query: string,
    portfolio?: PortfolioState,
    onProgress?: (progress: ProgressStatus) => void
  ): Promise<AgentResult | null> {
    try {
      onProgress?.({
        currentAgent: agentId,
        phase: 'analyzing',
        progress: 25,
        message: `${this.getAgentName(agentId)}正在分析...`,
      });

      // 获取 Agent 专用检索结果作为上下文
      const retrievalResult = await this.agentRagIntegration.retrieve(agentId, query);
      
      onProgress?.({
        currentAgent: agentId,
        phase: 'analyzing',
        progress: 50,
        message: `${this.getAgentName(agentId)}正在生成分析...`,
      });

      // 构建默认 portfolio 如果没有提供
      const effectivePortfolio: PortfolioState = portfolio || {
        positions: [],
        totalValue: 0,
        cashBalance: 0,
        marginLoan: 0,
        highWaterMark: 0,
        timestamp: Date.now(),
      };

      // 动态导入 multi-agent 服务以避免循环依赖
      const { analyzePortfolio } = await import('../agents');

      // 调用真实的 multi-agent 系统
      const orchestratorResult = await analyzePortfolio(effectivePortfolio, {
        query: `${query}\n\n相关知识库文档:\n${retrievalResult.documents.map(d => d.content).join('\n\n')}`,
        mode: 'respond_directly', // 单个 agent 使用快速响应模式
        onProgress: onProgress ? (status) => {
          onProgress({
            currentAgent: agentId,
            phase: status.phase,
            progress: 50 + (status.progress * 0.5), // 50-100%
            message: status.message,
          });
        } : undefined,
      });

      // 从 orchestrator 结果中提取对应 agent 的结果
      const agentResult = orchestratorResult.results.find(r => r.agentId === agentId);
      
      if (agentResult) {
        onProgress?.({
          currentAgent: agentId,
          phase: 'completed',
          progress: 100,
          message: `${this.getAgentName(agentId)}分析完成`,
        });
        return agentResult;
      }

      // 如果没有找到特定 agent 的结果，使用 advisor 的结果或合成结果
      const advisorResult = orchestratorResult.results.find(r => r.agentId === 'advisor');
      if (advisorResult) {
        onProgress?.({
          currentAgent: agentId,
          phase: 'completed',
          progress: 100,
          message: `${this.getAgentName(agentId)}分析完成`,
        });
        return {
          ...advisorResult,
          agentId, // 替换为请求的 agentId
        };
      }

      // 使用 finalReport 构建结果
      const synthesizedResult: AgentResult = {
        agentId,
        status: 'success',
        data: {
          query,
          documentsUsed: retrievalResult.documents.length,
          report: orchestratorResult.finalReport,
        },
        summary: orchestratorResult.finalReport.summary || `${this.getAgentName(agentId)}完成分析。`,
        metadata: {
          executionTimeMs: orchestratorResult.executionTrace.totalDurationMs,
          tokensUsed: orchestratorResult.executionTrace.agentTraces.reduce((sum, t) => sum + t.tokensUsed, 0),
          dataSources: ['LightRAG', 'Supabase', 'MultiAgent'],
        },
      };

      onProgress?.({
        currentAgent: agentId,
        phase: 'completed',
        progress: 100,
        message: `${this.getAgentName(agentId)}分析完成`,
      });

      return synthesizedResult;
    } catch (error) {
      console.error(`[UnifiedIntelligence] Agent ${agentId} error:`, error);
      
      // 降级到 RAG-only 响应
      try {
        const retrievalResult = await this.agentRagIntegration.retrieve(agentId, query);
        const fallbackResult: AgentResult = {
          agentId,
          status: 'partial',
          data: {
            query,
            documentsUsed: retrievalResult.documents.length,
            fallback: true,
          },
          summary: retrievalResult.documents.length > 0 
            ? `基于知识库的分析：${retrievalResult.documents[0].content.substring(0, 200)}...`
            : `${this.getAgentName(agentId)}分析暂时不可用，请稍后重试。`,
          metadata: {
            executionTimeMs: 0,
            tokensUsed: 0,
            dataSources: ['LightRAG', 'Supabase'],
            error: error instanceof Error ? error.message : String(error),
          },
        };
        return fallbackResult;
      } catch (fallbackError) {
        console.error(`[UnifiedIntelligence] Fallback also failed for ${agentId}:`, fallbackError);
        return null;
      }
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private getAgentName(agentId: string): string {
    const names: Record<string, string> = {
      position_analyst: '持仓分析师',
      risk_analyst: '风险分析师',
      market_analyst: '市场分析师',
      web_surfer: 'Web 冲浪者',
      advisor: '投资顾问',
    };
    return names[agentId] || agentId;
  }

  private synthesizeAgentResults(ragText: string, agentResults: AgentResult[]): string {
    const agentSummaries = agentResults
      .map((r) => `**${this.getAgentName(r.agentId)}：**\n${r.summary}`)
      .join('\n\n');

    return `${ragText}\n\n---\n\n## Agent 分析\n\n${agentSummaries}`;
  }

  private synthesizeAnalysisResult(
    state: ExecutionState,
    agentResults: AgentResult[],
    portfolio: PortfolioState
  ): AnalysisResult {
    const riskLevel = this.determineOverallRiskLevel(agentResults);
    const recommendations = this.extractRecommendations(agentResults);

    return {
      text: this.synthesizeAgentResults(state.ragResult?.text || '', agentResults),
      citations: state.ragResult?.citations || [],
      mode: 'full_agent',
      agentResults,
      confidence: 0.9,
      processingTime: Date.now() - state.startTime,
      summary: this.generateAnalysisSummary(agentResults),
      riskLevel,
      recommendations,
      alerts: state.alerts,
    };
  }

  private determineOverallRiskLevel(
    agentResults: AgentResult[]
  ): 'low' | 'medium' | 'high' {
    const riskResult = agentResults.find((r) => r.agentId === 'risk_analyst');
    if (riskResult?.data?.riskLevel) {
      return riskResult.data.riskLevel as 'low' | 'medium' | 'high';
    }
    return 'medium';
  }

  private extractRecommendations(agentResults: AgentResult[]): string[] {
    const advisorResult = agentResults.find((r) => r.agentId === 'advisor');
    if (advisorResult?.data?.recommendations) {
      return advisorResult.data.recommendations as string[];
    }
    return ['继续观察市场动态', '保持当前配置'];
  }

  private generateAnalysisSummary(agentResults: AgentResult[]): string {
    return agentResults.map((r) => r.summary).join(' ');
  }

  private generateDailySummary(
    positionResult: AgentResult | null,
    riskResult: AgentResult | null,
    marketResult: AgentResult | null
  ): string {
    const parts = [];
    if (positionResult) parts.push(positionResult.summary);
    if (riskResult) parts.push(riskResult.summary);
    if (marketResult) parts.push(marketResult.summary);
    return parts.join(' ') || '今日分析暂不可用';
  }

  private extractKeyPoints(result: AgentResult | null): string[] {
    if (!result?.data?.keyPoints) return [];
    return result.data.keyPoints as string[];
  }

  private extractRiskLevel(result: AgentResult | null): 'low' | 'medium' | 'high' {
    if (result?.data?.riskLevel) {
      return result.data.riskLevel as 'low' | 'medium' | 'high';
    }
    return 'medium';
  }

  private extractWarnings(result: AgentResult | null): string[] {
    if (!result?.data?.warnings) return [];
    return result.data.warnings as string[];
  }

  private extractHeadlines(result: AgentResult | null): string[] {
    if (!result?.data?.headlines) return [];
    return result.data.headlines as string[];
  }

  private extractActions(result: AgentResult | null): string[] {
    if (!result?.data?.actions) return [];
    return result.data.actions as string[];
  }

  private createEmptyDailyInsight(date: string): DailyInsight {
    return {
      date,
      summary: '今日洞察生成失败',
      positionInsights: {
        agentId: 'position_analyst',
        summary: '暂不可用',
        keyChanges: [],
      },
      riskInsights: {
        agentId: 'risk_analyst',
        summary: '暂不可用',
        riskLevel: 'medium',
        warnings: [],
      },
      marketInsights: {
        agentId: 'market_analyst',
        summary: '暂不可用',
        headlines: [],
      },
      recommendation: {
        agentId: 'advisor',
        summary: '暂不可用',
        actions: [],
      },
    };
  }

  private createErrorResult(state: ExecutionState, error: unknown): QueryResult {
    return {
      text: '处理请求时发生错误，请稍后重试。',
      citations: [],
      mode: state.mode,
      confidence: 0,
      processingTime: Date.now() - state.startTime,
    };
  }

  private createErrorAnalysisResult(
    state: ExecutionState,
    error: unknown
  ): AnalysisResult {
    return {
      text: '深度分析时发生错误，请稍后重试。',
      citations: [],
      mode: 'full_agent',
      confidence: 0,
      processingTime: Date.now() - state.startTime,
      summary: '分析失败',
      riskLevel: 'medium',
      recommendations: [],
      alerts: [],
    };
  }

  // ===========================================================================
  // Voice Context Helpers
  // ===========================================================================

  private async getPortfolioSummary(): Promise<string> {
    // TODO: 从实际数据源获取
    return '投资组合概览：请连接数据源获取详细信息';
  }

  private async getRiskSummary(): Promise<string> {
    // TODO: 从实际数据源获取
    return '风险状态：请连接数据源获取详细信息';
  }

  private async getLatestAnalysisSummary(): Promise<VoiceContext['latestAnalysis']> {
    // TODO: 从缓存获取最新分析
    return undefined;
  }

  private async getRecentAlerts(): Promise<AgentAlertEvent[]> {
    // TODO: 从存储获取最近告警
    return [];
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * 更新配置
   */
  updateConfig(config: Partial<UnifiedIntelligenceConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.confidenceThreshold !== undefined) {
      this.queryClassifier.updateConfig({
        confidenceThreshold: config.confidenceThreshold,
      });
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): UnifiedIntelligenceConfig {
    return { ...this.config };
  }

  /**
   * 清除缓存（当投资组合变化时调用）
   */
  invalidateCacheOnPortfolioChange(): void {
    this.cache.invalidateOnPortfolioChange();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/** 默认单例实例 */
export const unifiedIntelligenceService = new UnifiedIntelligenceService();

/**
 * Check if unified intelligence is enabled
 * @returns true if enabled, false if disabled via feature flag
 */
export function isUnifiedIntelligenceEnabled(): boolean {
  return !checkFeatureFlag();
}

/**
 * Reset feature flag cache (useful for testing)
 */
export function resetFeatureFlagCache(): void {
  _featureFlagChecked = false;
  _isDisabled = false;
}

/**
 * 便捷函数：查询
 */
export async function query(
  question: string,
  context?: QueryContext,
  options?: QueryOptions
): Promise<QueryResult> {
  return unifiedIntelligenceService.query(question, context, options);
}

/**
 * 便捷函数：深度分析
 */
export async function deepAnalyze(
  portfolio: PortfolioState,
  query?: string,
  options?: DeepAnalyzeOptions
): Promise<AnalysisResult> {
  return unifiedIntelligenceService.deepAnalyze(portfolio, query, options);
}

/**
 * 便捷函数：快速响应
 */
export async function quickAnswer(question: string): Promise<QueryResult> {
  return unifiedIntelligenceService.quickAnswer(question);
}
