import { getClient } from './supabaseData';
import type { Citation } from '../types';
import { 
  buildStructuredContext, 
  buildKnowledgeContext, 
  mergeContexts,
  convertToPositionDetail,
  convertToTransactionDetail,
  convertToOptionDetail,
  type PortfolioContext,
  type KnowledgeContext
} from './contextBuilder';
import { adaptiveRagService } from './adaptiveRag';
import { API_ENDPOINTS } from './apiConfig';

/**
 * RAG Service - Retrieve Augmentation Generation
 * 负责从 Supabase 获取相关投资数据，构建上下文给 AI
 * 
 * 新架构：使用 AdaptiveRAGService 进行智能路由和质量控制
 * 保留原有方法作为降级选项
 */

// Feature flag for adaptive RAG
const USE_ADAPTIVE_RAG = true;

// ============================================================================
// Query Classification
// ============================================================================

/**
 * Query classification result
 */
export interface QueryClassification {
  needsStructuredData: boolean;  // 需要持仓/交易等结构化数据
  needsKnowledgeBase: boolean;   // 需要知识库/策略等非结构化数据
  confidence: number;            // 分类置信度 0-1
  matchedKeywords: string[];     // 匹配到的关键词
}

// 结构化数据关键词 - 触发持仓/交易查询
const STRUCTURED_KEYWORDS = [
  '持仓', '仓位', '交易', '买入', '卖出', '盈亏', '净值',
  '股票', '期权', '市值', '成本', '收益', '亏损', '回撤',
  '杠杆', '融资', '保证金', '资产', '负债', '权益',
  '今天', '昨天', '本周', '本月', '今年', '最近',
  'position', 'trade', 'buy', 'sell', 'profit', 'loss',
  'portfolio', 'stock', 'option', 'value', 'cost'
];

// 知识库关键词 - 触发 LightRAG 查询
const KNOWLEDGE_KEYWORDS = [
  '策略', '原则', '理论', '分析', '方法', '思路', '逻辑',
  '为什么', '怎么', '如何', '什么是', '解释', '说明',
  '书', '文章', '笔记', '观点', '建议', '经验', '教训',
  '巴菲特', '芒格', '格雷厄姆', '彼得林奇', '索罗斯',
  '价值投资', '成长投资', '趋势', '周期', '估值',
  'strategy', 'principle', 'theory', 'analysis', 'method',
  'why', 'how', 'what', 'explain', 'book', 'article'
];

// 长查询阈值 - 超过此长度默认需要知识库
const LONG_QUERY_THRESHOLD = 20;

/**
 * Classify a query to determine which data sources are needed
 * 
 * @param query - User's query string
 * @returns Classification result with data source requirements
 */
export function classifyQuery(query: string): QueryClassification {
  const normalizedQuery = query.toLowerCase().trim();
  const matchedKeywords: string[] = [];
  
  // Check structured data keywords
  let structuredScore = 0;
  for (const keyword of STRUCTURED_KEYWORDS) {
    if (normalizedQuery.includes(keyword.toLowerCase())) {
      structuredScore++;
      matchedKeywords.push(keyword);
    }
  }
  
  // Check knowledge base keywords
  let knowledgeScore = 0;
  for (const keyword of KNOWLEDGE_KEYWORDS) {
    if (normalizedQuery.includes(keyword.toLowerCase())) {
      knowledgeScore++;
      matchedKeywords.push(keyword);
    }
  }
  
  // Long queries likely need knowledge base
  const isLongQuery = normalizedQuery.length > LONG_QUERY_THRESHOLD;
  if (isLongQuery && knowledgeScore === 0) {
    knowledgeScore += 0.5;
  }
  
  // Question patterns suggest knowledge needs
  const questionPatterns = /^(为什么|怎么|如何|什么|哪个|哪些|是否|能否|可以|应该)/;
  if (questionPatterns.test(normalizedQuery)) {
    knowledgeScore += 0.5;
  }
  
  // Calculate needs
  const needsStructuredData = structuredScore > 0 || 
    (structuredScore === 0 && knowledgeScore === 0); // Default to structured if no matches
  const needsKnowledgeBase = knowledgeScore > 0 || isLongQuery;
  
  // Calculate confidence
  const totalScore = structuredScore + knowledgeScore;
  const confidence = totalScore > 0 
    ? Math.min(1, totalScore / 3) // Cap at 1
    : 0.5; // Default confidence when no keywords matched
  
  return {
    needsStructuredData,
    needsKnowledgeBase,
    confidence,
    matchedKeywords
  };
}

export const ragService = {
  /**
   * 获取完整的投资上下文
   * 
   * 新架构：
   * 1. 优先使用 AdaptiveRAGService (智能路由 + 质量控制)
   * 2. 降级到传统方法 (classifyQuery + 并行检索)
   * 
   * 包括：持仓、风险指标、最近交易、相关笔记
   */
  async getInvestmentContext(query: string): Promise<{ text: string, citations: Citation[] }> {
    // 使用 Adaptive RAG 服务
    if (USE_ADAPTIVE_RAG) {
      try {
        console.log('[RAG] Using AdaptiveRAGService for query:', query.slice(0, 50));
        const result = await adaptiveRagService.getInvestmentContext(query);
        return result;
      } catch (error) {
        console.warn('[RAG] AdaptiveRAGService failed, falling back to legacy:', error);
        // Fall through to legacy implementation
      }
    }

    // Legacy implementation (fallback)
    return this.getInvestmentContextLegacy(query);
  },

  /**
   * Legacy implementation - 原有的检索逻辑
   * 作为 AdaptiveRAGService 的降级选项
   */
  async getInvestmentContextLegacy(query: string): Promise<{ text: string, citations: Citation[] }> {
    const supabase = getClient();
    if (!supabase) return { text: '数据库连接失败', citations: [] };

    try {
      // Step 1: 分类查询
      const classification = classifyQuery(query);
      console.log('[RAG] Query classification:', classification);
      
      const citations: Citation[] = [];
      let structuredContext: string | null = null;
      let knowledgeContext: string | null = null;
      
      // Step 2: 并行获取数据
      const promises: Promise<void>[] = [];
      
      // 2a. 结构化数据检索
      if (classification.needsStructuredData) {
        promises.push(
          this.fetchStructuredData(supabase).then(result => {
            structuredContext = result.context;
            citations.push(...result.citations);
          })
        );
      }
      
      // 2b. 知识库检索 (LightRAG + Supabase 向量搜索)
      if (classification.needsKnowledgeBase) {
        promises.push(
          this.fetchKnowledgeData(supabase, query).then(result => {
            knowledgeContext = result.context;
            citations.push(...result.citations);
          })
        );
      }
      
      // 等待所有数据获取完成
      await Promise.all(promises);
      
      // Step 3: 合并上下文
      const mergedContext = mergeContexts(structuredContext, knowledgeContext);
      
      return { text: mergedContext, citations };
    } catch (error) {
      console.error('Error fetching RAG context:', error);
      return { text: '无法获取投资数据上下文。', citations: [] };
    }
  },
  
  /**
   * 获取结构化投资数据
   */
  async fetchStructuredData(supabase: any): Promise<{ context: string, citations: Citation[] }> {
    const citations: Citation[] = [];
    
    // 1. 获取最新持仓 (带聚合逻辑)
    const { data: rawPositions, error: posError } = await supabase
      .from('stock_positions') 
      .select('*')
      .order('snapshot_date', { ascending: false });

    if (posError) console.error('[RAG] Error fetching positions:', posError);
    
    // 聚合逻辑
    const aggregatedMap = new Map<string, any>();
    const latestDate = rawPositions?.[0]?.snapshot_date;
    const validPositions = rawPositions?.filter((p: any) => p.snapshot_date === latestDate) || [];

    for (const pos of validPositions) {
      if (!aggregatedMap.has(pos.ticker)) {
        aggregatedMap.set(pos.ticker, { ...pos });
      } else {
        const existing = aggregatedMap.get(pos.ticker)!;
        const totalCostExisting = existing.quantity * existing.avg_cost;
        const totalCostNew = pos.quantity * pos.avg_cost;
        const newQuantity = existing.quantity + pos.quantity;
        const newAvgCost = newQuantity > 0 ? (totalCostExisting + totalCostNew) / newQuantity : 0;

        existing.quantity = newQuantity;
        existing.avg_cost = newAvgCost;
        existing.market_value_cny += pos.market_value_cny;
        existing.weight_percent = (existing.weight_percent || 0) + (pos.weight_percent || 0);
        
        const totalCost = newQuantity * newAvgCost;
        existing.unrealized_pnl_percent = totalCost > 0 ? (existing.unrealized_pnl / totalCost) * 100 : 0;
      }
    }
    
    const positions = Array.from(aggregatedMap.values())
      .sort((a, b) => b.market_value_cny - a.market_value_cny)
      .slice(0, 20);

    console.log('[RAG] Positions aggregated:', positions.length);

    // 2. 获取期权持仓
    const { data: snapshots } = await supabase
      .from('option_positions')
      .select('snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1);
      
    let options: any[] = [];
    if (snapshots && snapshots.length > 0) {
      const latestOptDate = snapshots[0].snapshot_date;
      const { data: currentOptions } = await supabase
        .from('option_positions')
        .select('*')
        .eq('snapshot_date', latestOptDate)
        .order('market_value_cny', { ascending: false });
      options = currentOptions || [];
    }
    
    console.log('[RAG] Options fetched:', options.length);

    // 3. 获取 Dashboard Snapshot
    const { data: dashboard } = await supabase
      .from('dashboard_snapshots')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    // 4. 获取最近交易
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .limit(10);
    
    console.log('[RAG] Transactions fetched:', transactions?.length || 0);

    // 构建 PortfolioContext
    const portfolioContext: PortfolioContext = {
      summary: {
        snapshot_date: dashboard?.date || latestDate || new Date().toISOString().split('T')[0],
        total_net_worth_cny: dashboard?.net_worth_cny || 0,
        total_positions: positions.length,
        total_options: options.length,
        cash_ratio_percent: 0, // TODO: calculate from data
        ytd_return_percent: 0  // TODO: calculate from data
      },
      positions: positions.map((p: any) => convertToPositionDetail({
        ticker: p.ticker,
        name: p.name,
        quantity: p.quantity,
        current_price: p.current_price,
        currency: p.currency || 'USD',
        avg_cost: p.avg_cost,
        market_value_cny: p.market_value_cny,
        weight_percent: p.weight_percent,
        unrealized_pnl_percent: p.unrealized_pnl_percent
      })),
      options: options.map((o: any) => convertToOptionDetail(o)),
      transactions: (transactions || []).map((t: any) => convertToTransactionDetail({
        date: t.date,
        action: t.action,
        ticker: t.ticker,
        quantity: t.quantity,
        price: t.price,
        currency: t.currency || 'USD'
      }))
    };

    // 构建引用 - 添加技术来源标识
    if (dashboard) {
      citations.push({
        source: '📊 结构化数据 (Supabase)',
        title: `净值报告 (${dashboard.date})`,
        content_snippet: `净值: ¥${dashboard.net_worth_cny}`
      });
    }
    
    positions.slice(0, 5).forEach((p: any) => {
      citations.push({
        source: '📊 结构化数据 (Supabase)',
        title: `${p.ticker} ${p.name || ''}`,
        content_snippet: `占比: ${p.weight_percent?.toFixed(1) || 0}%`
      });
    });

    return {
      context: buildStructuredContext(portfolioContext),
      citations
    };
  },
  
  /**
   * 获取知识库数据 (LightRAG + Supabase 向量搜索)
   */
  async fetchKnowledgeData(supabase: any, query: string): Promise<{ context: string, citations: Citation[] }> {
    const citations: Citation[] = [];
    let knowledgeData: KnowledgeContext = {
      entities: [],
      relations: [],
      relevantContent: ''
    };
    
    // 尝试 LightRAG 查询
    let lightragSuccess = false;
    try {
      const { queryKnowledge, isLightRAGAvailable } = await import('./lightragClient');
      
      if (await isLightRAGAvailable()) {
        console.log('[RAG] Querying LightRAG...');
        const result = await queryKnowledge(query, 'hybrid');
        
        if (result.success && result.result) {
          knowledgeData.relevantContent = result.result;
          lightragSuccess = true;
          
          citations.push({
            source: '🧠 知识图谱 (LightRAG)',
            title: 'GraphRAG 检索结果',
            content_snippet: result.result.slice(0, 100) + '...'
          });
          
          console.log('[RAG] LightRAG query successful');
        }
      }
    } catch (error) {
      console.warn('[RAG] LightRAG query failed, falling back to vector search:', error);
    }
    
    // 降级到 Supabase 向量搜索
    if (!lightragSuccess) {
      console.log('[RAG] Falling back to Supabase vector search...');
      
      try {
        // 获取查询向量
        const embeddingResponse = await fetch(API_ENDPOINTS.EMBEDDING, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ content: query, task_type: 'RETRIEVAL_QUERY' }]
          })
        });
        
        if (embeddingResponse.ok) {
          const data = await embeddingResponse.json();
          const embedding = data.predictions[0].embeddings.values;
          
          // 向量搜索
          const { data: searchResults, error: searchError } = await supabase
            .rpc('match_documents', {
              query_embedding: embedding,
              match_threshold: 0.5,
              match_count: 5
            });
          
          if (!searchError && searchResults && searchResults.length > 0) {
            knowledgeData.relevantContent = searchResults
              .map((doc: any) => `[${doc.metadata?.title || '文档'}]\n${doc.content}`)
              .join('\n\n---\n\n');
            
            searchResults.forEach((doc: any) => {
              citations.push({
                source: '🔍 向量搜索 (Supabase pgvector)',
                title: doc.metadata?.title || '未命名文档',
                content_snippet: doc.content.slice(0, 50) + '...'
              });
            });
          }
        }
      } catch (error) {
        console.error('[RAG] Vector search failed:', error);
        
        // 最终降级：关键词搜索
        const { data } = await supabase
          .from('documents')
          .select('*')
          .textSearch('content', query, { type: 'websearch', config: 'english' })
          .limit(5);
        
        if (data && data.length > 0) {
          knowledgeData.relevantContent = data
            .map((doc: any) => `[${doc.title || '文档'}]\n${doc.content}`)
            .join('\n\n---\n\n');
          
          data.forEach((doc: any) => {
            citations.push({
              source: '📝 关键词搜索 (Supabase FTS)',
              title: doc.title || '未命名文档',
              content_snippet: doc.content.slice(0, 50) + '...'
            });
          });
        }
      }
    }
    
    // 搜索历史对话
    try {
      const { data: msgData } = await supabase
        .from('messages')
        .select('content, created_at')
        .eq('role', 'assistant')
        .textSearch('content', query, { type: 'websearch', config: 'english' })
        .limit(3);
        
      if (msgData && msgData.length > 0) {
        const historyContent = msgData
          .map((m: any) => `[历史回答 ${new Date(m.created_at).toLocaleDateString()}]\n${m.content.slice(0, 300)}...`)
          .join('\n\n');
        
        knowledgeData.relevantContent += '\n\n### 相关历史对话\n' + historyContent;
        
        msgData.forEach((m: any) => {
          citations.push({
            source: '💬 历史对话 (Supabase FTS)',
            title: `AI 回答 (${new Date(m.created_at).toLocaleDateString()})`,
            content_snippet: m.content.slice(0, 50) + '...'
          });
        });
        
        console.log('[RAG] Found history messages:', msgData.length);
      }
    } catch (error) {
      console.warn('[RAG] History search failed:', error);
    }

    return {
      context: buildKnowledgeContext(knowledgeData),
      citations
    };
  }
};
