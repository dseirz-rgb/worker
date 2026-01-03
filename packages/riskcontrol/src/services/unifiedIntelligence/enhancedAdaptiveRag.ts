/**
 * Enhanced Adaptive RAG Service
 *
 * 扩展 AdaptiveRAGService，优先使用 LightRAG，并为 Agent 提供检索接口。
 *
 * 主要增强：
 * 1. LightRAG 优先 - 向量检索优先使用 LightRAG，失败时降级到 Supabase
 * 2. Agent 检索接口 - 为不同 Agent 提供定制化检索
 * 3. 质量控制 - 文档评分和幻觉检测集成
 *
 * @module unifiedIntelligence/enhancedAdaptiveRag
 * @see {@link .kiro/specs/unified-intelligence/design.md}
 */

import type { Document, Citation, Message } from '../adaptiveRag/types';
import { AdaptiveRAGService } from '../adaptiveRag/adaptiveRagService';
import { queryKnowledge, isLightRAGAvailable } from '../lightragClient';
import { getClient } from '../supabaseData';
import type { RetrievalResult } from './types';
import { API_ENDPOINTS } from '../apiConfig';

// =============================================================================
// Types
// =============================================================================

/**
 * Agent-specific retrieval options
 */
export interface AgentRetrievalOptions {
  /** Maximum documents to retrieve */
  maxDocs?: number;

  /** Minimum relevance score */
  minRelevance?: number;

  /** Include web search results */
  includeWebSearch?: boolean;

  /** Custom query transformation */
  queryTransform?: (query: string) => string;
}

/**
 * LightRAG query mode
 */
type LightRAGMode = 'naive' | 'local' | 'global' | 'hybrid';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_DOCS = 5;
const DEFAULT_MIN_RELEVANCE = 0.5;

/**
 * Agent-specific retrieval configurations
 */
const AGENT_RETRIEVAL_CONFIG: Record<string, AgentRetrievalOptions> = {
  position_analyst: {
    maxDocs: 3,
    minRelevance: 0.6,
    includeWebSearch: false,
  },
  risk_analyst: {
    maxDocs: 5,
    minRelevance: 0.5,
    includeWebSearch: false,
  },
  market_analyst: {
    maxDocs: 5,
    minRelevance: 0.4,
    includeWebSearch: true,
  },
  web_surfer: {
    maxDocs: 10,
    minRelevance: 0.3,
    includeWebSearch: true,
  },
  advisor: {
    maxDocs: 5,
    minRelevance: 0.5,
    includeWebSearch: false,
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert LightRAG result to Document format
 */
function lightragResultToDocuments(result: string): Document[] {
  if (!result || result.trim().length === 0) {
    return [];
  }

  return [
    {
      id: 'lightrag-result',
      content: result,
      metadata: { source: 'LightRAG', type: 'knowledge_graph' },
      relevance_score: 1.0,
    },
  ];
}

/**
 * Convert Supabase search results to Document format
 */
function supabaseResultsToDocuments(results: unknown[]): Document[] {
  return results.map((doc: any, index) => ({
    id: doc.id || `supabase-${index}`,
    content: doc.content || '',
    metadata: {
      source: 'Supabase',
      title: doc.metadata?.title || doc.title || 'Unknown',
      ...doc.metadata,
    },
    relevance_score: doc.similarity || 0.5,
  }));
}

// =============================================================================
// EnhancedAdaptiveRAGService Class
// =============================================================================

/**
 * Enhanced Adaptive RAG Service
 *
 * 扩展基础 AdaptiveRAGService，提供：
 * - LightRAG 优先检索
 * - Agent 专用检索接口
 * - 增强的降级机制
 *
 * @example
 * ```typescript
 * const service = new EnhancedAdaptiveRAGService();
 *
 * // 标准查询
 * const result = await service.getInvestmentContext('巴菲特的投资原则');
 *
 * // Agent 专用检索
 * const agentDocs = await service.retrieveForAgent('risk_analyst', '分析杠杆风险');
 * ```
 */
export class EnhancedAdaptiveRAGService extends AdaptiveRAGService {
  private lightragAvailable: boolean | null = null;
  private lightragCheckTime: number = 0;
  private readonly LIGHTRAG_CHECK_INTERVAL = 60000; // 1 minute

  constructor() {
    super();
  }

  // ===========================================================================
  // Agent Retrieval Interface
  // ===========================================================================

  /**
   * 为 Agent 提供检索接口
   *
   * 根据 Agent 类型选择合适的检索策略：
   * - position_analyst: 结构化数据优先
   * - risk_analyst: 知识库 + 结构化数据
   * - market_analyst: Web 搜索 + 知识库
   * - web_surfer: Web 搜索优先
   * - advisor: 综合检索
   *
   * @param agentId - Agent 标识符
   * @param query - 检索查询
   * @param options - 可选配置
   * @returns 检索结果，包含文档和引用
   */
  async retrieveForAgent(
    agentId: string,
    query: string,
    options?: AgentRetrievalOptions
  ): Promise<RetrievalResult> {
    const config = {
      ...AGENT_RETRIEVAL_CONFIG[agentId],
      ...options,
    };

    const citations: Citation[] = [];
    let documents: Document[] = [];

    try {
      switch (agentId) {
        case 'position_analyst':
          // 持仓分析师 - 优先结构化数据
          documents = await this.retrieveStructuredDataEnhanced(query, citations);
          break;

        case 'risk_analyst':
          // 风险分析师 - 知识库 + 结构化数据
          const [riskKnowledge, riskData] = await Promise.all([
            this.retrieveFromLightRAGFirst(query, citations),
            this.retrieveStructuredDataEnhanced(query, []),
          ]);
          documents = [...riskKnowledge, ...riskData];
          break;

        case 'market_analyst':
          // 市场分析师 - 知识库 + Web 搜索
          documents = await this.retrieveFromLightRAGFirst(query, citations);
          if (config.includeWebSearch && documents.length < 2) {
            const webDocs = await this.retrieveWebSearchResults(query, citations);
            documents = [...documents, ...webDocs];
          }
          break;

        case 'web_surfer':
          // Web 冲浪者 - Web 搜索优先
          documents = await this.retrieveWebSearchResults(query, citations);
          break;

        case 'advisor':
        default:
          // 顾问 - 综合检索
          documents = await this.retrieveFromLightRAGFirst(query, citations);
          break;
      }

      // 应用文档数量限制
      const maxDocs = config.maxDocs || DEFAULT_MAX_DOCS;
      documents = documents.slice(0, maxDocs);

      // 过滤低相关性文档
      const minRelevance = config.minRelevance || DEFAULT_MIN_RELEVANCE;
      documents = documents.filter(
        (doc) => (doc.relevance_score || 0) >= minRelevance
      );

      return {
        documents,
        citations,
        hasRelevantDocs: documents.length > 0,
      };
    } catch (error) {
      console.error(`[EnhancedRAG] Agent retrieval error for ${agentId}:`, error);
      return {
        documents: [],
        citations: [],
        hasRelevantDocs: false,
      };
    }
  }

  // ===========================================================================
  // Enhanced Retrieval Methods
  // ===========================================================================

  /**
   * LightRAG 优先检索
   *
   * 优先使用 LightRAG 进行知识图谱检索，失败时降级到 Supabase 向量搜索。
   *
   * @param query - 检索查询
   * @param citations - 引用数组（会被修改）
   * @returns 检索到的文档
   */
  async retrieveFromLightRAGFirst(
    query: string,
    citations: Citation[]
  ): Promise<Document[]> {
    // 1. 尝试 LightRAG
    try {
      if (await this.checkLightRAGAvailable()) {
        console.log('[EnhancedRAG] Querying LightRAG...');
        const result = await queryKnowledge(query, 'hybrid');

        if (result.success && result.result) {
          const documents = lightragResultToDocuments(result.result);
          citations.push({
            source: '🧠 知识图谱 (LightRAG)',
            title: 'GraphRAG 检索结果',
            content_snippet: result.result.slice(0, 100) + '...',
          });
          console.log('[EnhancedRAG] LightRAG returned results');
          return documents;
        }
      }
    } catch (error) {
      console.warn('[EnhancedRAG] LightRAG query failed:', error);
    }

    // 2. 降级到 Supabase 向量搜索
    console.log('[EnhancedRAG] Falling back to Supabase vector search');
    return this.retrieveFromSupabaseVector(query, citations);
  }

  /**
   * 增强的结构化数据检索
   */
  private async retrieveStructuredDataEnhanced(
    query: string,
    citations: Citation[]
  ): Promise<Document[]> {
    const supabase = getClient();
    if (!supabase) {
      return [];
    }

    const documents: Document[] = [];

    try {
      // 获取最新持仓
      const { data: positions } = await supabase
        .from('stock_positions')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(20);

      if (positions && positions.length > 0) {
        const latestDate = positions[0].snapshot_date;
        const latestPositions = positions.filter(
          (p: any) => p.snapshot_date === latestDate
        );

        const positionContent = latestPositions
          .map(
            (p: any) =>
              `${p.ticker} ${p.name || ''}: ${p.quantity}股, 市值¥${p.market_value_cny?.toFixed(0) || 0}, 占比${p.weight_percent?.toFixed(1) || 0}%`
          )
          .join('\n');

        documents.push({
          id: 'positions',
          content: `## 当前持仓 (${latestDate})\n${positionContent}`,
          metadata: { source: 'Supabase', type: 'positions', date: latestDate },
          relevance_score: 0.9,
        });

        citations.push({
          source: '📊 结构化数据 (Supabase)',
          title: `持仓数据 (${latestDate})`,
          content_snippet: `${latestPositions.length}只股票`,
        });
      }

      // 获取仪表盘快照
      const { data: dashboard } = await supabase
        .from('dashboard_snapshots')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (dashboard) {
        documents.push({
          id: 'dashboard',
          content: `## 账户概览 (${dashboard.date})\n净值: ¥${dashboard.net_worth_cny?.toFixed(0) || 0}\n杠杆: ${dashboard.leverage?.toFixed(2) || 1}x`,
          metadata: { source: 'Supabase', type: 'dashboard', date: dashboard.date },
          relevance_score: 0.85,
        });
      }
    } catch (error) {
      console.error('[EnhancedRAG] Structured data retrieval error:', error);
    }

    return documents;
  }

  /**
   * Supabase 向量搜索
   */
  private async retrieveFromSupabaseVector(
    query: string,
    citations: Citation[]
  ): Promise<Document[]> {
    const supabase = getClient();
    if (!supabase) {
      return [];
    }

    try {
      // 获取查询的 embedding
      const embeddingResponse = await fetch(API_ENDPOINTS.EMBEDDING, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ content: query, task_type: 'RETRIEVAL_QUERY' }],
        }),
      });

      if (!embeddingResponse.ok) {
        throw new Error('Embedding API failed');
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.predictions?.[0]?.embeddings?.values;

      if (!embedding) {
        throw new Error('No embedding returned');
      }

      // 向量搜索
      const { data: searchResults, error } = await supabase.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 5,
      });

      if (error) {
        throw error;
      }

      if (searchResults && searchResults.length > 0) {
        const documents = supabaseResultsToDocuments(searchResults);

        citations.push({
          source: '🔍 向量搜索 (Supabase)',
          title: '知识库检索',
          content_snippet: `找到 ${searchResults.length} 个相关文档`,
        });

        return documents;
      }
    } catch (error) {
      console.warn('[EnhancedRAG] Supabase vector search failed:', error);
    }

    return [];
  }

  /**
   * Web 搜索结果检索（占位实现）
   */
  private async retrieveWebSearchResults(
    query: string,
    citations: Citation[]
  ): Promise<Document[]> {
    // TODO: 集成实际的 Web 搜索 API (如 Serper, Tavily)
    console.log('[EnhancedRAG] Web search requested for:', query);

    citations.push({
      source: '🌐 Web 搜索',
      title: '搜索建议',
      content_snippet: '建议查询最新网络信息',
    });

    return [
      {
        id: 'web-search-placeholder',
        content: `[Web Search] 查询: "${query}" - 请使用 WebSurfer Agent 获取最新信息`,
        metadata: { source: 'WebSearch', type: 'placeholder' },
        relevance_score: 0.3,
      },
    ];
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * 检查 LightRAG 是否可用（带缓存）
   */
  private async checkLightRAGAvailable(): Promise<boolean> {
    const now = Date.now();

    // 使用缓存结果
    if (
      this.lightragAvailable !== null &&
      now - this.lightragCheckTime < this.LIGHTRAG_CHECK_INTERVAL
    ) {
      return this.lightragAvailable;
    }

    // 重新检查
    try {
      this.lightragAvailable = await isLightRAGAvailable();
      this.lightragCheckTime = now;
      return this.lightragAvailable;
    } catch {
      this.lightragAvailable = false;
      this.lightragCheckTime = now;
      return false;
    }
  }

  /**
   * 强制刷新 LightRAG 可用性检查
   */
  refreshLightRAGStatus(): void {
    this.lightragAvailable = null;
    this.lightragCheckTime = 0;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/** 默认单例实例 */
export const enhancedAdaptiveRagService = new EnhancedAdaptiveRAGService();

/**
 * 便捷函数：为 Agent 检索文档
 */
export async function retrieveForAgent(
  agentId: string,
  query: string,
  options?: AgentRetrievalOptions
): Promise<RetrievalResult> {
  return enhancedAdaptiveRagService.retrieveForAgent(agentId, query, options);
}
