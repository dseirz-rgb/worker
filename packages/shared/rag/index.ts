/**
 * 上下文隔离 RAG 服务 (IsolatedRAGService)
 * 
 * 管理 Investment 和 Daily 两个独立的知识库命名空间
 * - Investment: 投资文档、市场分析、交易记录
 * - Daily: 笔记、任务、日常知识
 * 
 * 核心原则：知识库完全隔离，防止跨域信息泄露
 * 
 * @module @echoai/shared/rag
 */

// ============================================
// 类型定义
// ============================================

export type RAGNamespace = 'investment' | 'daily';

export interface RAGDocument {
  id: string;
  content: string;
  namespace: RAGNamespace;
  metadata: Record<string, unknown>;
  score?: number;
}

export interface RAGResult {
  documents: RAGDocument[];
  query: string;
  namespace: RAGNamespace;
  totalFound: number;
  processingTime: number;
}

export interface QueryContext {
  currentModule: 'echo' | 'riskcontrol';
  currentAgent: 'investment' | 'daily';
  conversationHistory?: Message[];
  userId?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface RAGServiceConfig {
  investmentRAGUrl: string;  // LightRAG 服务 URL
  dailyRAGUrl?: string;      // Echo RAG 服务 URL（可选，可能使用 LibSQL）
  timeout?: number;
}

export type TopicType = 'investment' | 'daily' | 'ambiguous';

// ============================================
// 话题关键词
// ============================================

const INVESTMENT_KEYWORDS = [
  // 中文
  '股票', '基金', '投资', '持仓', '收益', '风险', '市场', '交易',
  '买入', '卖出', '涨', '跌', '分红', '估值', '财报', '年报',
  '季报', '盈利', '亏损', '杠杆', '融资', '融券', '期权', '期货',
  '债券', 'ETF', '指数', '大盘', '板块', '行业', '龙头', '概念股',
  '仓位', '净值', '回撤', '波动', '趋势', '预测', '分析',
  // 英文
  'stock', 'fund', 'investment', 'portfolio', 'return', 'risk',
  'market', 'trade', 'buy', 'sell', 'dividend', 'valuation',
  'earnings', 'profit', 'loss', 'leverage', 'margin', 'option',
  'futures', 'bond', 'etf', 'index', 'sector', 'position',
];

const DAILY_KEYWORDS = [
  // 中文
  '笔记', '任务', '日程', '提醒', '会议', '工作', '生活', '学习',
  '计划', '安排', '待办', '完成', '进度', '项目', '文档', '记录',
  '想法', '灵感', '备忘', '清单', '目标', '习惯', '日记',
  // 英文
  'note', 'task', 'calendar', 'reminder', 'meeting', 'work',
  'life', 'study', 'plan', 'schedule', 'todo', 'done', 'progress',
  'project', 'document', 'record', 'idea', 'memo', 'list', 'goal',
];

// ============================================
// 上下文隔离 RAG 服务
// ============================================

export class IsolatedRAGService {
  private config: RAGServiceConfig;

  constructor(config: RAGServiceConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  /**
   * 查询知识库（自动路由）
   * 根据上下文自动选择正确的命名空间
   */
  async query(question: string, context: QueryContext): Promise<RAGResult> {
    // 根据当前 Agent 确定命名空间
    const namespace = context.currentAgent;
    return this.queryNamespace(question, namespace);
  }

  /**
   * 显式指定命名空间查询
   * 
   * **Property 3 & 4: Agent 知识库隔离**
   * 确保查询只返回指定命名空间的文档
   */
  async queryNamespace(
    question: string,
    namespace: RAGNamespace
  ): Promise<RAGResult> {
    const start = Date.now();

    try {
      const url = namespace === 'investment' 
        ? this.config.investmentRAGUrl 
        : (this.config.dailyRAGUrl || this.config.investmentRAGUrl);

      const response = await fetch(`${url}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: question,
          namespace,
          top_k: 5,
        }),
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) {
        throw new RAGError(
          'QUERY_FAILED',
          `RAG query failed: ${response.status}`,
          namespace
        );
      }

      const data = await response.json();
      
      // 验证返回的文档都属于正确的命名空间
      const documents: RAGDocument[] = (data.documents || []).map((doc: any) => ({
        id: doc.id,
        content: doc.content,
        namespace, // 强制设置为请求的命名空间
        metadata: doc.metadata || {},
        score: doc.score,
      }));

      return {
        documents,
        query: question,
        namespace,
        totalFound: documents.length,
        processingTime: Date.now() - start,
      };
    } catch (error) {
      if (error instanceof RAGError) {
        throw error;
      }

      throw new RAGError(
        'SERVICE_UNAVAILABLE',
        error instanceof Error ? error.message : 'RAG service unavailable',
        namespace
      );
    }
  }

  /**
   * 跨域查询（需要用户确认）
   * 
   * 只有在用户明确确认后才混合两个命名空间的结果
   */
  async queryCrossDomain(
    question: string,
    userConfirmed: boolean
  ): Promise<RAGResult> {
    if (!userConfirmed) {
      throw new RAGError(
        'CROSS_DOMAIN_NOT_CONFIRMED',
        'Cross-domain query requires user confirmation',
        'investment'
      );
    }

    const start = Date.now();

    // 并行查询两个命名空间
    const [investmentResult, dailyResult] = await Promise.allSettled([
      this.queryNamespace(question, 'investment'),
      this.queryNamespace(question, 'daily'),
    ]);

    const documents: RAGDocument[] = [];

    if (investmentResult.status === 'fulfilled') {
      documents.push(...investmentResult.value.documents);
    }

    if (dailyResult.status === 'fulfilled') {
      documents.push(...dailyResult.value.documents);
    }

    // 按分数排序
    documents.sort((a, b) => (b.score || 0) - (a.score || 0));

    return {
      documents: documents.slice(0, 10), // 最多返回 10 个
      query: question,
      namespace: 'investment', // 跨域查询标记为 investment
      totalFound: documents.length,
      processingTime: Date.now() - start,
    };
  }

  /**
   * 主题检测
   * 自动识别问题属于投资还是日常话题
   */
  detectTopic(question: string): TopicType {
    const lowerQuestion = question.toLowerCase();

    const investmentScore = INVESTMENT_KEYWORDS.filter(
      keyword => lowerQuestion.includes(keyword.toLowerCase())
    ).length;

    const dailyScore = DAILY_KEYWORDS.filter(
      keyword => lowerQuestion.includes(keyword.toLowerCase())
    ).length;

    if (investmentScore > dailyScore && investmentScore > 0) {
      return 'investment';
    } else if (dailyScore > investmentScore && dailyScore > 0) {
      return 'daily';
    }

    return 'ambiguous';
  }

  /**
   * 根据话题自动选择命名空间查询
   */
  async queryWithTopicDetection(question: string): Promise<RAGResult> {
    const topic = this.detectTopic(question);

    if (topic === 'ambiguous') {
      // 默认使用 daily 命名空间
      return this.queryNamespace(question, 'daily');
    }

    return this.queryNamespace(question, topic);
  }

  /**
   * 添加文档到知识库
   */
  async addDocument(
    content: string,
    namespace: RAGNamespace,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const url = namespace === 'investment'
      ? this.config.investmentRAGUrl
      : (this.config.dailyRAGUrl || this.config.investmentRAGUrl);

    const response = await fetch(`${url}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        namespace,
        metadata: metadata || {},
      }),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      throw new RAGError(
        'DOCUMENT_ADD_FAILED',
        `Failed to add document: ${response.status}`,
        namespace
      );
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * 删除文档
   */
  async deleteDocument(documentId: string, namespace: RAGNamespace): Promise<void> {
    const url = namespace === 'investment'
      ? this.config.investmentRAGUrl
      : (this.config.dailyRAGUrl || this.config.investmentRAGUrl);

    const response = await fetch(`${url}/documents/${documentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ namespace }),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      throw new RAGError(
        'DOCUMENT_DELETE_FAILED',
        `Failed to delete document: ${response.status}`,
        namespace
      );
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    investment: { available: boolean; latency?: number };
    daily: { available: boolean; latency?: number };
  }> {
    const checkService = async (url: string) => {
      const start = Date.now();
      try {
        const response = await fetch(`${url}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        return {
          available: response.ok,
          latency: Date.now() - start,
        };
      } catch {
        return {
          available: false,
          latency: Date.now() - start,
        };
      }
    };

    const [investment, daily] = await Promise.all([
      checkService(this.config.investmentRAGUrl),
      this.config.dailyRAGUrl
        ? checkService(this.config.dailyRAGUrl)
        : Promise.resolve({ available: false, latency: undefined }),
    ]);

    return { investment, daily };
  }
}

// ============================================
// RAG 错误类
// ============================================

export class RAGError extends Error {
  constructor(
    public code: 
      | 'SERVICE_UNAVAILABLE' 
      | 'QUERY_FAILED' 
      | 'EMBEDDING_FAILED' 
      | 'NO_RESULTS'
      | 'CROSS_DOMAIN_NOT_CONFIRMED'
      | 'DOCUMENT_ADD_FAILED'
      | 'DOCUMENT_DELETE_FAILED',
    message: string,
    public namespace: RAGNamespace
  ) {
    super(message);
    this.name = 'RAGError';
  }
}

// ============================================
// 单例导出
// ============================================

let ragServiceInstance: IsolatedRAGService | null = null;

export function initRAGService(config: RAGServiceConfig): IsolatedRAGService {
  ragServiceInstance = new IsolatedRAGService(config);
  return ragServiceInstance;
}

export function getRAGService(): IsolatedRAGService | null {
  return ragServiceInstance;
}

export default IsolatedRAGService;
