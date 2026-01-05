/**
 * Adaptive RAG Service - 智能检索增强服务
 * 
 * 从 packages/riskcontrol/src/services/adaptiveRag 移植并适配 Echo 架构。
 * 
 * 实现智能路由和多源检索：
 * 1. 查询分类 - 判断需要结构化数据还是知识库
 * 2. LightRAG 检索 - 知识图谱查询（主要）
 * 3. pgvector 向量搜索 - 降级方案
 * 4. PostgreSQL FTS - 最终降级
 * 5. 历史对话搜索 - 补充上下文
 * 
 * @module services/echo-server/aiServer/investment/adaptiveRagService
 */

import {
  getInvestmentDb,
  searchDocuments,
  vectorSearchDocuments,
  getMessages,
} from '../../lib/investmentDb';

import type {
  Citation,
  RAGResult,
  RAGOptions,
  RAGSource,
  QueryClassification,
} from './types';

import { buildContext } from './contextBuilder';

// ============================================================================
// 常量
// ============================================================================

/** 结构化数据关键词 - 触发持仓/交易查询 */
const STRUCTURED_KEYWORDS = [
  '持仓', '仓位', '交易', '买入', '卖出', '盈亏', '净值',
  '股票', '期权', '市值', '成本', '收益', '亏损', '回撤',
  '杠杆', '融资', '保证金', '资产', '负债', '权益',
  '今天', '昨天', '本周', '本月', '今年', '最近',
  '我的', '我有', '账户', '组合',
  'position', 'trade', 'buy', 'sell', 'profit', 'loss',
  'portfolio', 'stock', 'option', 'value', 'cost',
];

/** 知识库关键词 - 触发 RAG 查询 */
const KNOWLEDGE_KEYWORDS = [
  '策略', '原则', '理论', '分析', '方法', '思路', '逻辑',
  '为什么', '怎么', '如何', '什么是', '解释', '说明',
  '书', '文章', '笔记', '观点', '建议', '经验', '教训',
  '巴菲特', '芒格', '格雷厄姆', '彼得林奇', '索罗斯',
  '价值投资', '成长投资', '趋势', '周期', '估值',
  'strategy', 'principle', 'theory', 'analysis', 'method',
  'why', 'how', 'what', 'explain', 'book', 'article',
];

/** 长查询阈值 */
const LONG_QUERY_THRESHOLD = 20;

/** LightRAG 服务地址 */
const LIGHTRAG_URL = process.env.LIGHTRAG_URL || 'http://localhost:9621';


// ============================================================================
// 查询分类
// ============================================================================

/**
 * 分类查询，判断需要哪些数据源
 */
export function classifyQuery(query: string): QueryClassification {
  const normalizedQuery = query.toLowerCase().trim();
  const matchedKeywords: string[] = [];

  // 检查结构化数据关键词
  let structuredScore = 0;
  for (const keyword of STRUCTURED_KEYWORDS) {
    if (normalizedQuery.includes(keyword.toLowerCase())) {
      structuredScore++;
      matchedKeywords.push(keyword);
    }
  }

  // 检查知识库关键词
  let knowledgeScore = 0;
  for (const keyword of KNOWLEDGE_KEYWORDS) {
    if (normalizedQuery.includes(keyword.toLowerCase())) {
      knowledgeScore++;
      matchedKeywords.push(keyword);
    }
  }

  // 长查询可能需要知识库
  const isLongQuery = normalizedQuery.length > LONG_QUERY_THRESHOLD;
  if (isLongQuery && knowledgeScore === 0) {
    knowledgeScore += 0.5;
  }

  // 问句模式暗示需要知识库
  const questionPatterns = /^(为什么|怎么|如何|什么|哪个|哪些|是否|能否|可以|应该)/;
  if (questionPatterns.test(normalizedQuery)) {
    knowledgeScore += 0.5;
  }

  // 计算需求
  const needsStructuredData = structuredScore > 0 ||
    (structuredScore === 0 && knowledgeScore === 0); // 无匹配时默认结构化数据
  const needsKnowledgeBase = knowledgeScore > 0 || isLongQuery;

  // 计算置信度
  const totalScore = structuredScore + knowledgeScore;
  const confidence = totalScore > 0
    ? Math.min(1, totalScore / 3)
    : 0.5;

  return {
    needsStructuredData,
    needsKnowledgeBase,
    confidence,
    matchedKeywords,
  };
}

// ============================================================================
// LightRAG 集成
// ============================================================================

/**
 * 检查 LightRAG 服务是否可用
 */
export async function isLightRAGAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${LIGHTRAG_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 查询 LightRAG 知识图谱
 */
export async function queryLightRAG(
  query: string,
  mode: 'local' | 'global' | 'hybrid' = 'hybrid'
): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    const response = await fetch(`${LIGHTRAG_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, mode }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return { success: false, error: `LightRAG error: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, result: data.response || data.result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}


// ============================================================================
// 向量搜索
// ============================================================================

/**
 * 获取查询的 embedding 向量
 * 使用 Echo 的 AI 服务获取 embedding
 */
async function getQueryEmbedding(query: string): Promise<number[] | null> {
  try {
    // 使用 Gemini embedding API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[AdaptiveRAG] GEMINI_API_KEY not configured');
      return null;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: query }] },
          taskType: 'RETRIEVAL_QUERY',
        }),
      }
    );

    if (!response.ok) {
      console.error('[AdaptiveRAG] Embedding API error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.embedding?.values || null;
  } catch (error) {
    console.error('[AdaptiveRAG] Embedding error:', error);
    return null;
  }
}

/**
 * 向量搜索文档
 */
async function vectorSearch(
  query: string,
  limit: number = 5
): Promise<{ content: string; title: string; similarity: number }[]> {
  try {
    const embedding = await getQueryEmbedding(query);
    if (!embedding) {
      return [];
    }

    const results = await vectorSearchDocuments(embedding, 0.5, limit);
    return results.map(doc => ({
      content: doc.content,
      title: doc.title || '未命名文档',
      similarity: 0.7, // 默认相似度
    }));
  } catch (error) {
    console.error('[AdaptiveRAG] Vector search error:', error);
    return [];
  }
}

// ============================================================================
// 全文搜索
// ============================================================================

/**
 * PostgreSQL 全文搜索
 */
async function fullTextSearch(
  query: string,
  limit: number = 5
): Promise<{ content: string; title: string }[]> {
  try {
    const results = await searchDocuments(query, limit);
    return results.map(doc => ({
      content: doc.content,
      title: doc.title || '未命名文档',
    }));
  } catch (error) {
    console.error('[AdaptiveRAG] FTS error:', error);
    return [];
  }
}


// ============================================================================
// 历史对话搜索
// ============================================================================

/**
 * 搜索历史对话中的相关回答
 */
async function searchHistoryMessages(
  query: string,
  limit: number = 3
): Promise<{ content: string; date: string }[]> {
  const client = getInvestmentDb();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('messages')
      .select('content, created_at')
      .eq('role', 'assistant')
      .textSearch('content', query, { type: 'websearch', config: 'english' })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map((m: any) => ({
      content: m.content.slice(0, 300),
      date: new Date(m.created_at).toLocaleDateString(),
    }));
  } catch (error) {
    console.error('[AdaptiveRAG] History search error:', error);
    return [];
  }
}

// ============================================================================
// 引用格式化
// ============================================================================

/**
 * 格式化引用信息
 */
function formatCitation(
  source: RAGSource,
  title: string,
  snippet: string
): Citation {
  const sourceLabels: Record<RAGSource, string> = {
    lightrag: '🧠 知识图谱 (LightRAG)',
    pgvector: '🔍 向量搜索 (pgvector)',
    fts: '📝 关键词搜索 (FTS)',
    history: '💬 历史对话',
  };

  return {
    source: sourceLabels[source],
    title,
    content_snippet: snippet.slice(0, 100) + (snippet.length > 100 ? '...' : ''),
  };
}

// ============================================================================
// 主服务类
// ============================================================================

/**
 * Adaptive RAG Service
 * 
 * 智能检索增强服务，支持多源检索和优雅降级。
 */
export class AdaptiveRagService {
  private defaultOptions: RAGOptions = {
    sources: ['lightrag', 'pgvector', 'fts'],
    maxResults: 5,
    matchThreshold: 0.5,
    includeHistory: true,
  };

  /**
   * 获取投资上下文
   * 
   * 主入口函数，整合所有数据源。
   */
  async getInvestmentContext(
    query: string,
    options?: Partial<RAGOptions>
  ): Promise<RAGResult> {
    const opts = { ...this.defaultOptions, ...options };
    const citations: Citation[] = [];
    const contextParts: string[] = [];

    console.log('[AdaptiveRAG] Processing query:', query.slice(0, 50));

    // Step 1: 分类查询
    const classification = classifyQuery(query);
    console.log('[AdaptiveRAG] Classification:', classification);

    // Step 2: 获取结构化数据（如果需要）
    if (classification.needsStructuredData) {
      try {
        const structuredContext = await buildContext();
        if (structuredContext && !structuredContext.includes('暂无')) {
          contextParts.push(structuredContext);
          citations.push({
            source: '📊 结构化数据 (Supabase)',
            title: '投资组合数据',
            content_snippet: '持仓、交易、净值等实时数据',
          });
        }
      } catch (error) {
        console.warn('[AdaptiveRAG] Structured data fetch failed:', error);
      }
    }

    // Step 3: 获取知识库数据（如果需要）
    if (classification.needsKnowledgeBase) {
      const knowledgeContext = await this.fetchKnowledgeData(query, opts, citations);
      if (knowledgeContext) {
        contextParts.push(knowledgeContext);
      }
    }

    // Step 4: 搜索历史对话（可选）
    if (opts.includeHistory) {
      const historyContext = await this.fetchHistoryData(query, citations);
      if (historyContext) {
        contextParts.push(historyContext);
      }
    }

    // 合并上下文
    const text = contextParts.length > 0
      ? contextParts.join('\n\n---\n\n')
      : '暂无相关上下文数据。';

    return { text, citations };
  }


  /**
   * 获取知识库数据（带降级）
   */
  private async fetchKnowledgeData(
    query: string,
    opts: RAGOptions,
    citations: Citation[]
  ): Promise<string | null> {
    const sources = opts.sources || ['lightrag', 'pgvector', 'fts'];
    const results: string[] = [];

    // 尝试 LightRAG
    if (sources.includes('lightrag')) {
      try {
        if (await isLightRAGAvailable()) {
          console.log('[AdaptiveRAG] Querying LightRAG...');
          const result = await queryLightRAG(query, 'hybrid');

          if (result.success && result.result) {
            results.push(`## 知识图谱检索结果\n${result.result}`);
            citations.push(formatCitation('lightrag', 'GraphRAG 检索', result.result));
            console.log('[AdaptiveRAG] LightRAG success');
          }
        }
      } catch (error) {
        console.warn('[AdaptiveRAG] LightRAG failed:', error);
      }
    }

    // 降级到向量搜索
    if (results.length === 0 && sources.includes('pgvector')) {
      console.log('[AdaptiveRAG] Falling back to vector search...');
      const vectorResults = await vectorSearch(query, opts.maxResults);

      if (vectorResults.length > 0) {
        const content = vectorResults
          .map(r => `### ${r.title}\n${r.content}`)
          .join('\n\n');
        results.push(`## 向量搜索结果\n${content}`);

        vectorResults.forEach(r => {
          citations.push(formatCitation('pgvector', r.title, r.content));
        });
      }
    }

    // 最终降级到全文搜索
    if (results.length === 0 && sources.includes('fts')) {
      console.log('[AdaptiveRAG] Falling back to FTS...');
      const ftsResults = await fullTextSearch(query, opts.maxResults);

      if (ftsResults.length > 0) {
        const content = ftsResults
          .map(r => `### ${r.title}\n${r.content}`)
          .join('\n\n');
        results.push(`## 全文搜索结果\n${content}`);

        ftsResults.forEach(r => {
          citations.push(formatCitation('fts', r.title, r.content));
        });
      }
    }

    return results.length > 0 ? results.join('\n\n') : null;
  }

  /**
   * 获取历史对话数据
   */
  private async fetchHistoryData(
    query: string,
    citations: Citation[]
  ): Promise<string | null> {
    const historyResults = await searchHistoryMessages(query, 3);

    if (historyResults.length === 0) {
      return null;
    }

    const content = historyResults
      .map(h => `### AI 回答 (${h.date})\n${h.content}...`)
      .join('\n\n');

    historyResults.forEach(h => {
      citations.push(formatCitation('history', `历史回答 (${h.date})`, h.content));
    });

    return `## 相关历史对话\n${content}`;
  }
}

// ============================================================================
// 导出
// ============================================================================

/** 默认服务实例 */
export const adaptiveRagService = new AdaptiveRagService();

/** 便捷函数 */
export async function getInvestmentContext(
  query: string,
  options?: Partial<RAGOptions>
): Promise<RAGResult> {
  return adaptiveRagService.getInvestmentContext(query, options);
}

export default adaptiveRagService;
