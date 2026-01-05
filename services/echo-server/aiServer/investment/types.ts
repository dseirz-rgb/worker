/**
 * Investment AI 模块类型定义
 * 
 * 包含投资 AI 功能所需的所有类型：
 * - 上下文构建器类型
 * - RAG 服务类型
 * - Agent 类型
 * - 报告类型
 * 
 * @module services/echo-server/aiServer/investment/types
 */

// ============================================================================
// 上下文构建器类型
// ============================================================================

/**
 * 货币值（带单位）
 */
export interface CurrencyValue {
  value: number;
  currency: 'USD' | 'HKD' | 'CNY';
}

/**
 * 投资组合摘要
 */
export interface PortfolioSummary {
  snapshot_date: string;
  total_net_worth_cny: number;
  total_positions: number;
  total_options: number;
  cash_ratio_percent: number;
  ytd_return_percent: number;
  drawdown_percent?: number;
  leverage_ratio?: number;
}

/**
 * 持仓详情
 */
export interface PositionDetail {
  ticker: string;
  name: string;
  quantity: number;
  current_price: CurrencyValue;
  avg_cost: CurrencyValue;
  market_value_cny: number;
  weight_percent: number;
  unrealized_pnl_percent: number;
}


/**
 * 期权持仓详情
 */
export interface OptionDetail {
  symbol: string;
  underlying: string;
  option_type: 'CALL' | 'PUT';
  strike_price: number;
  expiry_date: string;
  quantity: number;
  current_price: number;
  market_value_cny: number;
  weight_percent: number;
  days_to_expiry?: number;
}

/**
 * 交易记录详情
 */
export interface TransactionDetail {
  date: string;
  action: 'BUY' | 'SELL' | 'SHORT' | 'COVER';
  ticker: string;
  quantity: number;
  price: CurrencyValue;
}

/**
 * 完整的投资组合上下文
 */
export interface PortfolioContext {
  summary: PortfolioSummary;
  positions: PositionDetail[];
  options: OptionDetail[];
  transactions: TransactionDetail[];
}

// ============================================================================
// 知识库类型
// ============================================================================

/**
 * 知识图谱实体
 */
export interface Entity {
  name: string;
  description: string;
  type?: string;
}

/**
 * 知识图谱关系
 */
export interface Relation {
  source: string;
  relation: string;
  target: string;
}

/**
 * 知识库上下文
 */
export interface KnowledgeContext {
  entities: Entity[];
  relations: Relation[];
  relevantContent: string;
}


// ============================================================================
// RAG 服务类型
// ============================================================================

/**
 * 查询分类结果
 */
export interface QueryClassification {
  needsStructuredData: boolean;  // 需要持仓/交易等结构化数据
  needsKnowledgeBase: boolean;   // 需要知识库/策略等非结构化数据
  confidence: number;            // 分类置信度 0-1
  matchedKeywords: string[];     // 匹配到的关键词
}

/**
 * 引用信息
 */
export interface Citation {
  source: string;
  title: string;
  content_snippet?: string;
  url?: string;
}

/**
 * RAG 检索结果
 */
export interface RAGResult {
  text: string;
  citations: Citation[];
}

/**
 * RAG 数据源类型
 */
export type RAGSource = 'lightrag' | 'pgvector' | 'fts' | 'history';

/**
 * RAG 检索选项
 */
export interface RAGOptions {
  sources?: RAGSource[];
  maxResults?: number;
  matchThreshold?: number;
  includeHistory?: boolean;
}


// ============================================================================
// Agent 类型
// ============================================================================

/**
 * 投资 Agent 配置
 */
export interface InvestmentAgentConfig {
  name: string;
  persona: string;
  systemPrompt: string;
  tools: string[];
}

/**
 * 对话消息
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  timestamp?: string;
}

/**
 * 对话上下文类型
 */
export type ContextType = 'report' | 'briefing' | 'portfolio' | 'general';

/**
 * 对话请求
 */
export interface ChatRequest {
  conversationId?: number;
  message: string;
  contextType?: ContextType;
  includeContext?: boolean;
}

/**
 * 对话响应
 */
export interface ChatResponse {
  message: string;
  citations: Citation[];
  conversationId: number;
  messageId: number;
}


// ============================================================================
// 报告类型
// ============================================================================

/**
 * 风险等级
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * 建议类型
 */
export type Recommendation = 'BUY' | 'SELL' | 'HOLD' | 'REBALANCE' | 'WARNING';

/**
 * 每日洞察
 */
export interface DailyInsight {
  date: string;
  content: string;  // 限制 100 字符
  riskLevel: RiskLevel;
}

/**
 * 风控研报
 */
export interface RiskReport {
  id?: number;
  title: string;
  riskLevel: RiskLevel;
  summary: string;
  content: string;
  recommendation: Recommendation;
  actionPlan: string;
  primaryTicker: string;
  portfolioSnapshot: Record<string, unknown>;
  createdAt?: string;
}

/**
 * 多 Agent 分析结果
 */
export interface AgentAnalysis {
  agentName: string;
  analysis: string;
  confidence: number;
  timestamp: string;
}

/**
 * 编排模式
 */
export type OrchestrationMode = 'sequential' | 'respond_directly' | 'selector';
