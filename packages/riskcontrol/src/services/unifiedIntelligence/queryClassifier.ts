/**
 * Query Classifier - 统一智能系统查询分类器
 *
 * 基于 Adaptive RAG 的 QueryRouter，扩展为三级处理模式分类：
 * - rag_only: 简单问题，快速响应 (<2s)
 * - rag_agent: RAG + 单 Agent 分析 (5-15s)
 * - full_agent: 完整多 Agent 分析 (15-30s)
 *
 * @module unifiedIntelligence/queryClassifier
 * @see {@link .kiro/specs/unified-intelligence/design.md}
 */

import { QueryRouter, type RouteDecision } from '../adaptiveRag/queryRouter';
import type { ClassificationResult, ProcessingMode } from './types';

// =============================================================================
// Constants
// =============================================================================

/**
 * 简单问题模式 - 适合 RAG-only 处理
 * 特征：短问句、定义类、解释类
 */
const SIMPLE_QUERY_PATTERNS = [
  /^(什么是|解释|定义|介绍)/,
  /^(今天|现在|当前).*(怎么样|如何|多少)/,
  /^(查看|看看|显示)/,
  /\?$/, // 简短问句
  /^(how|what|when|where|who)\s/i,
  /^(show|display|list)\s/i,
];

/**
 * 深度分析模式 - 需要 full_agent 处理
 * 特征：深度分析、风险评估、策略建议
 */
const DEEP_ANALYSIS_PATTERNS = [
  /(深度|全面|详细|完整).*(分析|诊断|评估|研究)/,
  /(风险|回撤|杠杆|集中度).*(分析|评估|研究|诊断)/,
  /(建议|操作|调仓|策略|优化)/,
  /(帮我|请|麻烦).*(分析|评估|诊断)/,
  /综合.*(分析|评估|判断)/,
  /(deep|comprehensive|detailed|full).*(analysis|assessment|evaluation)/i,
  /(risk|drawdown|leverage).*(analysis|assessment)/i,
  /(recommend|suggest|advise|optimize)/i,
];

/**
 * 单 Agent 模式 - 适合 rag_agent 处理
 * 特征：特定领域问题，需要一个专业 Agent
 */
const SINGLE_AGENT_PATTERNS: Array<{ pattern: RegExp; agent: string }> = [
  { pattern: /(持仓|仓位|集中度|权重)/, agent: 'position_analyst' },
  { pattern: /(风险|回撤|杠杆|保证金)/, agent: 'risk_analyst' },
  { pattern: /(市场|新闻|财报|公告)/, agent: 'market_analyst' },
  { pattern: /(position|holding|concentration)/i, agent: 'position_analyst' },
  { pattern: /(risk|drawdown|leverage|margin)/i, agent: 'risk_analyst' },
  { pattern: /(market|news|earnings|announcement)/i, agent: 'market_analyst' },
];

/**
 * 默认置信度阈值
 */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;

/**
 * 简单查询最大长度
 */
const SIMPLE_QUERY_MAX_LENGTH = 30;

// =============================================================================
// QueryClassifier Class
// =============================================================================

/**
 * Query Classifier 配置
 */
export interface QueryClassifierConfig {
  /** 置信度阈值，高于此值使用 rag_only (default: 0.8) */
  confidenceThreshold: number;

  /** 简单查询最大长度 (default: 30) */
  simpleQueryMaxLength: number;

  /** QueryRouter 配置 */
  routerConfig?: {
    llm_model?: string;
    api_key?: string;
    timeout?: number;
  };
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: QueryClassifierConfig = {
  confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
  simpleQueryMaxLength: SIMPLE_QUERY_MAX_LENGTH,
};

/**
 * Query Classifier - 查询分类器
 *
 * 使用 Adaptive RAG 的 QueryRouter 作为基础，
 * 根据置信度和问题复杂度决定处理模式。
 *
 * @example
 * ```typescript
 * const classifier = new QueryClassifier();
 * const result = await classifier.classify('什么是价值投资？');
 * // { mode: 'rag_only', confidence: 0.92, reasoning: '...' }
 *
 * const result2 = await classifier.classify('帮我深度分析当前持仓风险');
 * // { mode: 'full_agent', confidence: 0.9, reasoning: '...', suggestedAgents: [...] }
 * ```
 */
export class QueryClassifier {
  private config: QueryClassifierConfig;
  private queryRouter: QueryRouter;

  constructor(config?: Partial<QueryClassifierConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.queryRouter = new QueryRouter(config?.routerConfig);
  }

  /**
   * 分类查询，决定处理模式
   *
   * @param question - 用户查询
   * @returns 分类结果，包含模式、置信度、推理和建议 Agent
   */
  async classify(question: string): Promise<ClassificationResult> {
    // 空查询处理
    if (!question || question.trim().length === 0) {
      return {
        mode: 'rag_only',
        confidence: 0,
        reasoning: 'Empty query, defaulting to RAG only',
      };
    }

    const normalizedQuestion = question.trim();

    // 1. 检查是否需要深度分析 (优先级最高)
    if (this.requiresDeepAnalysis(normalizedQuestion)) {
      const suggestedAgents = this.getSuggestedAgents(normalizedQuestion);
      return {
        mode: 'full_agent',
        confidence: 0.9,
        reasoning: 'Query requires deep multi-agent analysis',
        suggestedAgents:
          suggestedAgents.length > 0
            ? suggestedAgents
            : ['position_analyst', 'risk_analyst', 'market_analyst', 'advisor'],
      };
    }

    // 2. 使用 QueryRouter 获取路由决策
    const routeResult = await this.queryRouter.route(normalizedQuestion);

    // 3. 检查是否为简单查询 + 高置信度
    if (
      routeResult.confidence > this.config.confidenceThreshold &&
      this.isSimpleQuery(normalizedQuestion)
    ) {
      return {
        mode: 'rag_only',
        confidence: routeResult.confidence,
        reasoning: `Simple query with high confidence (${routeResult.confidence.toFixed(2)}): ${routeResult.reasoning}`,
      };
    }

    // 4. 检查是否匹配单 Agent 模式
    const singleAgentMatch = this.matchSingleAgent(normalizedQuestion);
    if (singleAgentMatch && routeResult.confidence >= 0.5) {
      return {
        mode: 'rag_agent',
        confidence: routeResult.confidence,
        reasoning: `Query matches ${singleAgentMatch} domain`,
        suggestedAgents: [singleAgentMatch],
      };
    }

    // 5. 中等置信度 - 使用 rag_agent
    if (routeResult.confidence >= 0.5) {
      return {
        mode: 'rag_agent',
        confidence: routeResult.confidence,
        reasoning: `Medium confidence query: ${routeResult.reasoning}`,
        suggestedAgents: this.getSuggestedAgents(normalizedQuestion),
      };
    }

    // 6. 低置信度 - 使用 full_agent 确保质量
    return {
      mode: 'full_agent',
      confidence: routeResult.confidence,
      reasoning: `Low confidence (${routeResult.confidence.toFixed(2)}), using full agent analysis for quality`,
      suggestedAgents: ['position_analyst', 'risk_analyst', 'market_analyst', 'advisor'],
    };
  }

  /**
   * 快速分类（不调用 LLM）
   * 仅使用模式匹配，适合需要快速响应的场景
   */
  classifyFast(question: string): ClassificationResult {
    if (!question || question.trim().length === 0) {
      return {
        mode: 'rag_only',
        confidence: 0,
        reasoning: 'Empty query',
      };
    }

    const normalizedQuestion = question.trim();

    // 深度分析检查
    if (this.requiresDeepAnalysis(normalizedQuestion)) {
      return {
        mode: 'full_agent',
        confidence: 0.85,
        reasoning: 'Deep analysis keywords detected',
        suggestedAgents: this.getSuggestedAgents(normalizedQuestion),
      };
    }

    // 简单查询检查
    if (this.isSimpleQuery(normalizedQuestion)) {
      return {
        mode: 'rag_only',
        confidence: 0.75,
        reasoning: 'Simple query pattern detected',
      };
    }

    // 单 Agent 匹配
    const singleAgent = this.matchSingleAgent(normalizedQuestion);
    if (singleAgent) {
      return {
        mode: 'rag_agent',
        confidence: 0.7,
        reasoning: `Matches ${singleAgent} domain`,
        suggestedAgents: [singleAgent],
      };
    }

    // 默认 rag_agent
    return {
      mode: 'rag_agent',
      confidence: 0.5,
      reasoning: 'No specific pattern matched, using RAG + Agent',
      suggestedAgents: this.getSuggestedAgents(normalizedQuestion),
    };
  }

  /**
   * 检查是否为简单查询
   */
  private isSimpleQuery(question: string): boolean {
    // 长度检查
    if (question.length > this.config.simpleQueryMaxLength) {
      return false;
    }

    // 模式匹配
    return SIMPLE_QUERY_PATTERNS.some((pattern) => pattern.test(question));
  }

  /**
   * 检查是否需要深度分析
   */
  private requiresDeepAnalysis(question: string): boolean {
    return DEEP_ANALYSIS_PATTERNS.some((pattern) => pattern.test(question));
  }

  /**
   * 匹配单个 Agent
   */
  private matchSingleAgent(question: string): string | null {
    for (const { pattern, agent } of SINGLE_AGENT_PATTERNS) {
      if (pattern.test(question)) {
        return agent;
      }
    }
    return null;
  }

  /**
   * 获取建议的 Agent 列表
   */
  private getSuggestedAgents(question: string): string[] {
    const agents: string[] = [];

    for (const { pattern, agent } of SINGLE_AGENT_PATTERNS) {
      if (pattern.test(question) && !agents.includes(agent)) {
        agents.push(agent);
      }
    }

    return agents;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<QueryClassifierConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.routerConfig) {
      this.queryRouter.updateConfig(config.routerConfig);
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): QueryClassifierConfig {
    return { ...this.config };
  }
}

// =============================================================================
// Singleton & Convenience Functions
// =============================================================================

/** 默认单例实例 */
export const queryClassifier = new QueryClassifier();

/**
 * 便捷函数：分类查询
 */
export async function classifyQuery(question: string): Promise<ClassificationResult> {
  return queryClassifier.classify(question);
}

/**
 * 便捷函数：快速分类（不调用 LLM）
 */
export function classifyQueryFast(question: string): ClassificationResult {
  return queryClassifier.classifyFast(question);
}
