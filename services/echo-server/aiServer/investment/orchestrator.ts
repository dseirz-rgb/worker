/**
 * Multi-Agent Orchestrator
 * 
 * 从 packages/riskcontrol/src/services/agents/orchestrator.ts 移植
 * 协调多个 Agent 执行投资分析任务
 * 
 * 支持模式：
 * - sequential: 按预定顺序执行
 * - selector: LLM 动态选择下一个 Agent
 * - respond_directly: 简单查询由 Advisor 直接回答
 * 
 * @module services/echo-server/aiServer/investment/orchestrator
 */

import type {
  OrchestrationMode,
  RiskLevel,
  Citation,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Agent 执行结果
 */
export interface AgentResult {
  agentId: string;
  status: 'success' | 'partial' | 'failed';
  data: Record<string, unknown>;
  summary: string;
  metadata: {
    executionTimeMs: number;
    tokensUsed: number;
    dataSources: string[];
    error?: string;
  };
}

/**
 * Agent 上下文
 */
export interface AgentContext {
  query: string;
  previousResults: Map<string, AgentResult>;
  userNotes: string;
  messageThread: AgentMessage[];
  mode: OrchestrationMode;
  accountId: number;
}

/**
 * Agent 消息
 */
export interface AgentMessage {
  agentId: string;
  content: string;
  timestamp: number;
  type: 'result' | 'handoff' | 'error';
}

/**
 * 投资组合状态
 */
export interface PortfolioState {
  positions: Position[];
  totalValue: number;
  cashBalance: number;
  marginLoan: number;
  highWaterMark: number;
  timestamp: number;
}

/**
 * 持仓
 */
export interface Position {
  ticker: string;
  weight: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnL: number;
  market: string;
  sector?: string;
}

/**
 * 最终报告
 */
export interface FinalReport {
  title: string;
  riskLevel: RiskLevel;
  summary: string;
  content: string;
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'REBALANCE' | 'WARNING';
  actionPlan: string;
  primaryTicker: string;
}

/**
 * 执行追踪
 */
export interface ExecutionTrace {
  startTime: number;
  endTime: number;
  totalDurationMs: number;
  mode: OrchestrationMode;
  agentTraces: AgentTrace[];
}

/**
 * Agent 追踪
 */
export interface AgentTrace {
  agentId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: string;
  tokensUsed: number;
}

/**
 * 编排器结果
 */
export interface OrchestratorResult {
  results: AgentResult[];
  finalReport: FinalReport;
  executionTrace: ExecutionTrace;
  mode: OrchestrationMode;
  citations: Citation[];
}

/**
 * 进度状态
 */
export interface ProgressStatus {
  currentAgent: string;
  phase: string;
  progress: number;
  message?: string;
  mode?: OrchestrationMode;
}

/**
 * Agent 接口
 */
export interface Agent {
  id: string;
  role: string;
  goal: string;
  description: string;
  execute(context: AgentContext, portfolio: PortfolioState): Promise<AgentResult>;
}

/**
 * 编排器选项
 */
export interface OrchestratorOptions {
  mode?: OrchestrationMode;
  maxIterations?: number;
  defaultTimeout?: number;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_AGENT_ORDER = [
  'position_analyst',
  'risk_analyst',
  'market_analyst',
  'advisor',
];

const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_TIMEOUT = 60000;

// ============================================================================
// Multi-Agent Orchestrator
// ============================================================================

/**
 * Multi-Agent Orchestrator
 * 
 * 协调多个 Agent 执行投资分析
 */
export class MultiAgentOrchestrator {
  private agents: Map<string, Agent> = new Map();
  private mode: OrchestrationMode;
  private maxIterations: number;
  private defaultTimeout: number;
  private defaultAgentOrder: string[];

  constructor(options: OrchestratorOptions = {}) {
    this.mode = options.mode || 'sequential';
    this.maxIterations = options.maxIterations || DEFAULT_MAX_ITERATIONS;
    this.defaultTimeout = options.defaultTimeout || DEFAULT_TIMEOUT;
    this.defaultAgentOrder = DEFAULT_AGENT_ORDER;
  }

  /**
   * 注册 Agent
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * 获取 Agent
   */
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /**
   * 获取所有 Agent
   */
  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 设置编排模式
   */
  setMode(mode: OrchestrationMode): void {
    this.mode = mode;
  }

  /**
   * 获取编排模式
   */
  getMode(): OrchestrationMode {
    return this.mode;
  }

  /**
   * 执行分析
   */
  async execute(
    portfolio: PortfolioState,
    options: {
      query?: string;
      mode?: OrchestrationMode;
      accountId?: number;
      onProgress?: (status: ProgressStatus) => void;
    } = {}
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const effectiveMode = options.mode || this.mode;
    const query = options.query || '分析我的投资组合风险';
    const accountId = options.accountId || 1;

    // 构建初始上下文
    const context: AgentContext = {
      query,
      previousResults: new Map(),
      userNotes: '',
      messageThread: [],
      mode: effectiveMode,
      accountId,
    };

    // 发送初始进度
    options.onProgress?.({
      currentAgent: '',
      phase: 'Initializing',
      progress: 0,
      mode: effectiveMode,
    });

    let result: OrchestratorResult;

    try {
      // 根据模式执行
      switch (effectiveMode) {
        case 'sequential':
          result = await this.executeSequential(context, portfolio, options.onProgress);
          break;
        case 'respond_directly':
          result = await this.executeRespondDirectly(context, portfolio, options.onProgress);
          break;
        case 'selector':
          result = await this.executeSelector(context, portfolio, options.onProgress);
          break;
        default:
          result = await this.executeSequential(context, portfolio, options.onProgress);
      }
    } catch (error) {
      result = this.createErrorResult(error as Error, startTime, effectiveMode);
    }

    // 更新执行时间
    result.executionTrace.endTime = Date.now();
    result.executionTrace.totalDurationMs = result.executionTrace.endTime - startTime;

    // 发送完成进度
    options.onProgress?.({
      currentAgent: '',
      phase: 'Complete',
      progress: 100,
      mode: effectiveMode,
    });

    return result;
  }

  /**
   * Sequential 模式：按顺序执行所有 Agent
   */
  private async executeSequential(
    context: AgentContext,
    portfolio: PortfolioState,
    onProgress?: (status: ProgressStatus) => void
  ): Promise<OrchestratorResult> {
    const results: AgentResult[] = [];
    const agentTraces: AgentTrace[] = [];
    const startTime = Date.now();
    const citations: Citation[] = [];

    // 过滤可用的 Agent
    const agentOrder = this.defaultAgentOrder.filter(id => this.agents.has(id));
    const totalAgents = agentOrder.length;

    for (let i = 0; i < agentOrder.length; i++) {
      const agentId = agentOrder[i];
      const agent = this.agents.get(agentId);

      if (!agent) continue;

      // 发送进度
      onProgress?.({
        currentAgent: agent.id,
        phase: agent.role,
        progress: (i / totalAgents) * 100,
        message: `执行 ${agent.role}`,
        mode: 'sequential',
      });

      const agentStartTime = Date.now();

      try {
        const result = await agent.execute(context, portfolio);
        results.push(result);
        context.previousResults.set(agent.id, result);

        // 添加到消息线程
        context.messageThread.push({
          agentId: agent.id,
          content: result.summary,
          timestamp: Date.now(),
          type: 'result',
        });

        // 记录追踪
        agentTraces.push({
          agentId: agent.id,
          startTime: agentStartTime,
          endTime: Date.now(),
          durationMs: Date.now() - agentStartTime,
          status: result.status,
          tokensUsed: result.metadata.tokensUsed,
        });
      } catch (error) {
        const fallbackResult = this.createFallbackResult(agent, error as Error);
        results.push(fallbackResult);
        context.previousResults.set(agent.id, fallbackResult);

        agentTraces.push({
          agentId: agent.id,
          startTime: agentStartTime,
          endTime: Date.now(),
          durationMs: Date.now() - agentStartTime,
          status: 'failed',
          tokensUsed: 0,
        });
      }
    }

    return this.buildOrchestratorResult(results, startTime, 'sequential', agentTraces, citations);
  }

  /**
   * Respond Directly 模式：简单查询由 Advisor 直接回答
   */
  private async executeRespondDirectly(
    context: AgentContext,
    portfolio: PortfolioState,
    onProgress?: (status: ProgressStatus) => void
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const agentTraces: AgentTrace[] = [];
    const citations: Citation[] = [];

    // 评估查询复杂度
    const complexity = this.assessQueryComplexity(context.query, portfolio);

    if (complexity === 'simple') {
      // Advisor 直接回答
      onProgress?.({
        currentAgent: 'advisor',
        phase: 'Direct Response',
        progress: 50,
        message: '简单查询 - 直接回答',
        mode: 'respond_directly',
      });

      const advisor = this.agents.get('advisor');
      if (!advisor) {
        return this.executeSequential(context, portfolio, onProgress);
      }

      const agentStartTime = Date.now();

      try {
        const result = await advisor.execute(context, portfolio);

        agentTraces.push({
          agentId: advisor.id,
          startTime: agentStartTime,
          endTime: Date.now(),
          durationMs: Date.now() - agentStartTime,
          status: result.status,
          tokensUsed: result.metadata.tokensUsed,
        });

        return this.buildOrchestratorResult([result], startTime, 'respond_directly', agentTraces, citations);
      } catch (error) {
        const fallbackResult = this.createFallbackResult(advisor, error as Error);
        agentTraces.push({
          agentId: advisor.id,
          startTime: agentStartTime,
          endTime: Date.now(),
          durationMs: Date.now() - agentStartTime,
          status: 'failed',
          tokensUsed: 0,
        });

        return this.buildOrchestratorResult([fallbackResult], startTime, 'respond_directly', agentTraces, citations);
      }
    }

    // 复杂查询回退到 Sequential 模式
    onProgress?.({
      currentAgent: '',
      phase: 'Complex Query Detected',
      progress: 10,
      message: `查询复杂度: ${complexity} - 使用 sequential 模式`,
      mode: 'respond_directly',
    });

    const sequentialResult = await this.executeSequential(context, portfolio, onProgress);
    return {
      ...sequentialResult,
      mode: 'respond_directly',
    };
  }

  /**
   * Selector 模式：LLM 动态选择下一个 Agent
   */
  private async executeSelector(
    context: AgentContext,
    portfolio: PortfolioState,
    onProgress?: (status: ProgressStatus) => void
  ): Promise<OrchestratorResult> {
    // 简化实现：目前回退到 Sequential 模式
    // 完整实现需要 LLM 调用来选择下一个 Agent
    return this.executeSequential(context, portfolio, onProgress);
  }

  /**
   * 评估查询复杂度
   */
  private assessQueryComplexity(
    query: string,
    portfolio: PortfolioState
  ): 'simple' | 'moderate' | 'complex' {
    const queryLower = query.toLowerCase();

    // 简单查询模式
    const simplePatterns = [
      /^what('s| is) my (total|current) (value|balance|portfolio)/i,
      /^how many (positions|stocks|holdings)/i,
      /^list my (holdings|positions|stocks)/i,
      /^portfolio summary/i,
      /^current holdings/i,
      /我的持仓/,
      /投资组合概况/,
      /总资产/,
    ];

    if (simplePatterns.some(p => p.test(query))) {
      return 'simple';
    }

    // 复杂查询指标
    const complexIndicators = [
      portfolio.positions.length > 20,
      /stress test/i.test(queryLower),
      /scenario/i.test(queryLower),
      /recommendation/i.test(queryLower),
      /should i/i.test(queryLower),
      /what if/i.test(queryLower),
      /analyze.*risk/i.test(queryLower),
      /deep analysis/i.test(queryLower),
      /压力测试/.test(query),
      /风险分析/.test(query),
      /建议/.test(query),
    ];

    const complexCount = complexIndicators.filter(Boolean).length;

    if (complexCount >= 2) {
      return 'complex';
    }

    if (complexCount === 1 || portfolio.positions.length > 10) {
      return 'moderate';
    }

    return 'simple';
  }

  /**
   * 构建编排器结果
   */
  private buildOrchestratorResult(
    results: AgentResult[],
    startTime: number,
    mode: OrchestrationMode,
    agentTraces: AgentTrace[],
    citations: Citation[]
  ): OrchestratorResult {
    // 从结果中提取最终报告
    const advisorResult = results.find(r => r.agentId === 'advisor');
    const finalReport = this.extractFinalReport(advisorResult, results);

    return {
      results,
      finalReport,
      executionTrace: {
        startTime,
        endTime: Date.now(),
        totalDurationMs: Date.now() - startTime,
        mode,
        agentTraces,
      },
      mode,
      citations,
    };
  }

  /**
   * 提取最终报告
   */
  private extractFinalReport(
    advisorResult: AgentResult | undefined,
    allResults: AgentResult[]
  ): FinalReport {
    if (advisorResult?.data?.report) {
      return advisorResult.data.report as FinalReport;
    }

    // 从所有结果生成摘要报告
    const summaries = allResults.map(r => r.summary).filter(Boolean);
    const hasErrors = allResults.some(r => r.status === 'failed');

    return {
      title: '投资组合分析报告',
      riskLevel: hasErrors ? 'MEDIUM' : 'LOW',
      summary: summaries.join('\n\n') || '分析完成',
      content: summaries.join('\n\n') || '分析完成',
      recommendation: 'HOLD',
      actionPlan: '继续监控投资组合',
      primaryTicker: '',
    };
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(
    error: Error,
    startTime: number,
    mode: OrchestrationMode
  ): OrchestratorResult {
    return {
      results: [],
      finalReport: {
        title: '分析失败',
        riskLevel: 'HIGH',
        summary: `分析过程中发生错误: ${error.message}`,
        content: error.message,
        recommendation: 'WARNING',
        actionPlan: '请稍后重试',
        primaryTicker: '',
      },
      executionTrace: {
        startTime,
        endTime: Date.now(),
        totalDurationMs: Date.now() - startTime,
        mode,
        agentTraces: [],
      },
      mode,
      citations: [],
    };
  }

  /**
   * 创建降级结果
   */
  private createFallbackResult(agent: Agent, error: Error): AgentResult {
    return {
      agentId: agent.id,
      status: 'failed',
      data: {},
      summary: `${agent.role} 执行失败: ${error.message}`,
      metadata: {
        executionTimeMs: 0,
        tokensUsed: 0,
        dataSources: [],
        error: error.message,
      },
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建 Multi-Agent Orchestrator
 */
export function createOrchestrator(options?: OrchestratorOptions): MultiAgentOrchestrator {
  return new MultiAgentOrchestrator(options);
}

export default MultiAgentOrchestrator;
