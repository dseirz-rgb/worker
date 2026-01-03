/**
 * Query Router - Adaptive RAG 查询路由器
 * 
 * 使用 LLM 分析用户查询，智能路由到合适的数据源：
 * - vectorstore: 投资知识、策略、原则、书籍笔记
 * - structured_data: 持仓、交易、市值、财务指标
 * - websearch: 当前事件、实时信息
 */

// ============================================================================
// Types
// ============================================================================

/**
 * 路由决策结果
 */
export interface RouteDecision {
  datasource: 'vectorstore' | 'structured_data' | 'websearch';
  confidence: number;
  reasoning: string;
}

/**
 * Query Router 配置
 */
export interface QueryRouterConfig {
  llm_model: string;
  api_key?: string;
  timeout?: number;
  fallback_datasource?: RouteDecision['datasource'];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: QueryRouterConfig = {
  llm_model: 'gemini-2.0-flash',
  timeout: 10000,
  fallback_datasource: 'vectorstore'
};

/**
 * Router System Prompt - 定义路由逻辑
 */
const ROUTER_SYSTEM_PROMPT = `You are an expert at routing user questions to the appropriate data source.

Available data sources:
1. vectorstore - Contains investment knowledge, strategies, principles, book notes, and analysis methods
2. structured_data - Contains portfolio positions, transactions, market data, and financial metrics
3. websearch - For current events, real-time information, or topics not covered by other sources

Analyze the user's question and return JSON with:
- datasource: one of 'vectorstore', 'structured_data', 'websearch'
- confidence: 0.0 to 1.0
- reasoning: brief explanation

Examples:
- "我的持仓情况" → structured_data (portfolio query)
- "巴菲特的投资原则" → vectorstore (investment knowledge)
- "今天美股发生了什么" → websearch (current events)
- "我最近的交易记录" → structured_data (transaction history)
- "价值投资的核心理念" → vectorstore (investment philosophy)
- "特斯拉最新财报" → websearch (current financial news)

IMPORTANT: Return ONLY valid JSON, no markdown code blocks or extra text.`;

// ============================================================================
// Keyword-based Fallback Router
// ============================================================================

// 结构化数据关键词
const STRUCTURED_DATA_KEYWORDS = [
  '持仓', '仓位', '交易', '买入', '卖出', '盈亏', '净值',
  '股票', '期权', '市值', '成本', '收益', '亏损', '回撤',
  '杠杆', '融资', '保证金', '资产', '负债', '权益',
  '我的', '我有', '账户', '组合', '投资组合',
  'position', 'trade', 'buy', 'sell', 'profit', 'loss',
  'portfolio', 'my stock', 'my option', 'account'
];

// 知识库关键词
const VECTORSTORE_KEYWORDS = [
  '策略', '原则', '理论', '分析', '方法', '思路', '逻辑',
  '为什么', '怎么', '如何', '什么是', '解释', '说明',
  '书', '文章', '笔记', '观点', '建议', '经验', '教训',
  '巴菲特', '芒格', '格雷厄姆', '彼得林奇', '索罗斯',
  '价值投资', '成长投资', '趋势', '周期', '估值',
  'strategy', 'principle', 'theory', 'analysis', 'method',
  'why', 'how', 'what', 'explain', 'book', 'article'
];

// Web 搜索关键词
const WEBSEARCH_KEYWORDS = [
  '今天', '最新', '刚刚', '现在', '实时', '新闻',
  '财报', '公告', '发布', '事件', '消息',
  'today', 'latest', 'current', 'news', 'recent',
  'announcement', 'earnings', 'report'
];

/**
 * 基于关键词的降级路由
 * 当 LLM 调用失败时使用
 */
function keywordBasedRoute(query: string): RouteDecision {
  const normalizedQuery = query.toLowerCase();
  
  let structuredScore = 0;
  let vectorstoreScore = 0;
  let websearchScore = 0;
  
  // 计算各数据源的匹配分数
  for (const keyword of STRUCTURED_DATA_KEYWORDS) {
    if (normalizedQuery.includes(keyword.toLowerCase())) {
      structuredScore++;
    }
  }
  
  for (const keyword of VECTORSTORE_KEYWORDS) {
    if (normalizedQuery.includes(keyword.toLowerCase())) {
      vectorstoreScore++;
    }
  }
  
  for (const keyword of WEBSEARCH_KEYWORDS) {
    if (normalizedQuery.includes(keyword.toLowerCase())) {
      websearchScore++;
    }
  }
  
  // 确定最高分数的数据源
  const maxScore = Math.max(structuredScore, vectorstoreScore, websearchScore);
  
  if (maxScore === 0) {
    // 无匹配，默认使用 vectorstore
    return {
      datasource: 'vectorstore',
      confidence: 0.3,
      reasoning: 'No keyword matches, defaulting to vectorstore'
    };
  }
  
  // 计算置信度 (基于匹配数量)
  const confidence = Math.min(0.8, 0.4 + maxScore * 0.1);
  
  if (structuredScore >= vectorstoreScore && structuredScore >= websearchScore) {
    return {
      datasource: 'structured_data',
      confidence,
      reasoning: `Keyword match: structured_data (${structuredScore} matches)`
    };
  }
  
  if (websearchScore >= vectorstoreScore) {
    return {
      datasource: 'websearch',
      confidence,
      reasoning: `Keyword match: websearch (${websearchScore} matches)`
    };
  }
  
  return {
    datasource: 'vectorstore',
    confidence,
    reasoning: `Keyword match: vectorstore (${vectorstoreScore} matches)`
  };
}

// ============================================================================
// LLM Response Parser
// ============================================================================

/**
 * 解析 LLM 返回的 JSON 响应
 */
function parseLLMResponse(responseText: string): RouteDecision | null {
  try {
    // 尝试直接解析
    const parsed = JSON.parse(responseText.trim());
    return validateRouteDecision(parsed);
  } catch {
    // 尝试从 markdown 代码块中提取
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        return validateRouteDecision(parsed);
      } catch {
        // 继续尝试其他方式
      }
    }
    
    // 尝试提取 JSON 对象
    const objectMatch = responseText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        const parsed = JSON.parse(objectMatch[0]);
        return validateRouteDecision(parsed);
      } catch {
        // 解析失败
      }
    }
    
    return null;
  }
}

/**
 * 验证并规范化路由决策
 */
function validateRouteDecision(data: unknown): RouteDecision | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  
  const obj = data as Record<string, unknown>;
  
  // 验证 datasource
  const validDatasources = ['vectorstore', 'structured_data', 'websearch'];
  if (!obj.datasource || !validDatasources.includes(obj.datasource as string)) {
    return null;
  }
  
  // 验证 confidence
  let confidence = typeof obj.confidence === 'number' ? obj.confidence : 0.5;
  confidence = Math.max(0, Math.min(1, confidence)); // Clamp to [0, 1]
  
  // 验证 reasoning
  const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : 'No reasoning provided';
  
  return {
    datasource: obj.datasource as RouteDecision['datasource'],
    confidence,
    reasoning
  };
}

// ============================================================================
// QueryRouter Class
// ============================================================================

/**
 * Query Router - 使用 LLM 进行智能查询路由
 */
export class QueryRouter {
  private config: QueryRouterConfig;
  
  constructor(config?: Partial<QueryRouterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 路由查询到合适的数据源
   * 
   * @param query - 用户查询字符串
   * @returns 路由决策，包含数据源、置信度和推理
   */
  async route(query: string): Promise<RouteDecision> {
    // 空查询处理
    if (!query || query.trim().length === 0) {
      return {
        datasource: this.config.fallback_datasource || 'vectorstore',
        confidence: 0,
        reasoning: 'Empty query, using fallback datasource'
      };
    }
    
    try {
      // 尝试使用 LLM 路由
      const decision = await this.llmRoute(query);
      console.log('[QueryRouter] LLM route decision:', decision);
      return decision;
    } catch (error) {
      // LLM 调用失败，降级到关键词路由
      console.warn('[QueryRouter] LLM route failed, falling back to keyword-based routing:', error);
      const fallbackDecision = keywordBasedRoute(query);
      console.log('[QueryRouter] Keyword fallback decision:', fallbackDecision);
      return fallbackDecision;
    }
  }
  
  /**
   * 使用 LLM 进行路由决策
   */
  private async llmRoute(query: string): Promise<RouteDecision> {
    const apiKey = this.config.api_key || this.getApiKey();
    
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }
    
    // 构建请求
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: query }]
        }
      ],
      systemInstruction: {
        role: 'system',
        parts: [{ text: ROUTER_SYSTEM_PROMPT }]
      },
      generationConfig: {
        temperature: 0.1, // 低温度以获得更确定的输出
        maxOutputTokens: 256,
        responseMimeType: 'application/json'
      }
    };
    
    // 调用 Gemini API
    const response = await this.callGeminiAPI(apiKey, requestBody);
    
    // 解析响应
    const decision = parseLLMResponse(response);
    
    if (!decision) {
      throw new Error('Failed to parse LLM response');
    }
    
    return decision;
  }
  
  /**
   * 调用 Gemini API
   */
  private async callGeminiAPI(apiKey: string, requestBody: unknown): Promise<string> {
    const model = this.config.llm_model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout || DEFAULT_CONFIG.timeout!
    );
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // 提取文本响应
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }
      
      return text;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * 获取 API Key
   * 优先从环境变量获取
   */
  private getApiKey(): string | undefined {
    // 浏览器环境 - 从 Vite 环境变量获取
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    }
    
    // Node.js 环境
    if (typeof process !== 'undefined' && process.env) {
      return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    }
    
    return undefined;
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<QueryRouterConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): QueryRouterConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Singleton & Convenience Functions
// ============================================================================

// 默认单例实例
export const queryRouter = new QueryRouter();

/**
 * 便捷函数：路由查询
 */
export async function routeQuery(query: string): Promise<RouteDecision> {
  return queryRouter.route(query);
}

/**
 * 便捷函数：使用关键词路由（不调用 LLM）
 */
export function routeQueryByKeywords(query: string): RouteDecision {
  return keywordBasedRoute(query);
}
