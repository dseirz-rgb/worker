/**
 * Context Builder Module
 * 
 * 负责将投资组合数据和知识库内容格式化为 AI 可理解的上下文。
 * 
 * 主要功能：
 * 1. buildStructuredContext() - 将持仓、交易等结构化数据转为 JSON 格式
 * 2. buildKnowledgeContext() - 格式化知识库检索结果
 * 3. mergeContexts() - 合并多个上下文来源
 * 
 * @module contextBuilder
 */

// ============================================================================
// 接口定义
// ============================================================================

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
}

/**
 * 货币值（带单位）
 */
export interface CurrencyValue {
  value: number;
  currency: 'USD' | 'HKD' | 'CNY';
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
// 常量
// ============================================================================

/** 最大显示持仓数量 */
const MAX_POSITIONS = 20;

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 构建结构化投资组合上下文
 * 
 * 将投资组合数据转换为 JSON 格式的上下文字符串，供 AI 理解。
 * 
 * 特性：
 * - 货币单位分离：current_price.value + current_price.currency
 * - 位置截断：超过 20 个持仓时只保留 top 20（按市值排序）
 * - 包含截断汇总信息
 * 
 * @param data - 投资组合上下文数据
 * @returns 格式化的上下文字符串
 * 
 * @example
 * ```typescript
 * const context = buildStructuredContext({
 *   summary: { ... },
 *   positions: [...],
 *   options: [...],
 *   transactions: [...]
 * });
 * ```
 */
export function buildStructuredContext(data: PortfolioContext): string {
  // 处理持仓截断
  const { displayPositions, truncatedCount } = truncatePositions(data.positions);
  
  // 构建 JSON 结构
  const json = {
    portfolio_summary: {
      snapshot_date: data.summary.snapshot_date,
      total_net_worth_cny: data.summary.total_net_worth_cny,
      total_positions: data.summary.total_positions,
      total_options: data.summary.total_options,
      cash_ratio_percent: data.summary.cash_ratio_percent,
      ytd_return_percent: data.summary.ytd_return_percent
    },
    stock_positions: displayPositions.map(p => ({
      ticker: p.ticker,
      name: p.name,
      quantity: p.quantity,
      current_price: {
        value: p.current_price.value,
        currency: p.current_price.currency
      },
      avg_cost: {
        value: p.avg_cost.value,
        currency: p.avg_cost.currency
      },
      market_value_cny: p.market_value_cny,
      weight_percent: p.weight_percent,
      unrealized_pnl_percent: p.unrealized_pnl_percent
    })),
    option_positions: data.options.map(o => ({
      symbol: o.symbol,
      underlying: o.underlying,
      option_type: o.option_type,
      strike_price: o.strike_price,
      expiry_date: o.expiry_date,
      quantity: o.quantity,
      current_price: o.current_price,
      market_value_cny: o.market_value_cny,
      weight_percent: o.weight_percent
    })),
    recent_transactions: data.transactions.slice(0, 10).map(t => ({
      date: t.date,
      action: t.action,
      ticker: t.ticker,
      quantity: t.quantity,
      price: {
        value: t.price.value,
        currency: t.price.currency
      }
    }))
  };
  
  // 构建输出字符串
  let output = `## 投资组合数据 (JSON 格式)
\`\`\`json
${JSON.stringify(json, null, 2)}
\`\`\`

### 数据说明
- current_price: 当前价格，货币单位见 currency 字段
- avg_cost: 平均成本，货币单位见 currency 字段
- market_value_cny: 市值，已换算为人民币
- weight_percent: 占总资产比例
- unrealized_pnl_percent: 未实现盈亏百分比`;

  // 添加截断信息
  if (truncatedCount > 0) {
    output += `\n\n### 持仓截断说明
(${truncatedCount}) additional positions not shown. 显示的是按市值排序的 Top ${MAX_POSITIONS} 持仓。`;
  }

  return output;
}

/**
 * 构建知识库上下文
 * 
 * 将知识图谱检索结果格式化为可读的上下文字符串。
 * 
 * @param data - 知识库上下文数据
 * @returns 格式化的上下文字符串
 * 
 * @example
 * ```typescript
 * const context = buildKnowledgeContext({
 *   entities: [{ name: '价值投资', description: '...' }],
 *   relations: [{ source: '巴菲特', relation: '倡导', target: '价值投资' }],
 *   relevantContent: '...'
 * });
 * ```
 */
export function buildKnowledgeContext(data: KnowledgeContext): string {
  const sections: string[] = [];
  
  sections.push('## 相关知识库内容');
  
  // 实体部分
  if (data.entities && data.entities.length > 0) {
    sections.push('\n### 相关实体');
    const entityLines = data.entities.map(e => {
      const typeInfo = e.type ? ` [${e.type}]` : '';
      return `- **${e.name}**${typeInfo}: ${e.description}`;
    });
    sections.push(entityLines.join('\n'));
  }
  
  // 关系部分
  if (data.relations && data.relations.length > 0) {
    sections.push('\n### 实体关系');
    const relationLines = data.relations.map(r => 
      `- ${r.source} → ${r.relation} → ${r.target}`
    );
    sections.push(relationLines.join('\n'));
  }
  
  // 相关内容部分
  if (data.relevantContent && data.relevantContent.trim()) {
    sections.push('\n### 相关文档摘要');
    sections.push(data.relevantContent);
  }
  
  return sections.join('\n');
}

/**
 * 合并多个上下文来源
 * 
 * 将结构化数据上下文和知识库上下文合并为单一字符串，
 * 并添加清晰的来源标签。
 * 
 * @param structuredContext - 结构化数据上下文（可选）
 * @param knowledgeContext - 知识库上下文（可选）
 * @returns 合并后的上下文字符串
 * 
 * @example
 * ```typescript
 * const merged = mergeContexts(
 *   buildStructuredContext(portfolioData),
 *   buildKnowledgeContext(knowledgeData)
 * );
 * ```
 */
export function mergeContexts(
  structuredContext?: string | null,
  knowledgeContext?: string | null
): string {
  const sections: string[] = [];
  
  // 添加标题
  sections.push('# 投资助手上下文信息\n');
  
  // 添加结构化数据部分
  if (structuredContext && structuredContext.trim()) {
    sections.push('---');
    sections.push('## 📊 数据来源: 投资组合数据\n');
    sections.push(structuredContext);
    sections.push('');
  }
  
  // 添加知识库部分
  if (knowledgeContext && knowledgeContext.trim()) {
    sections.push('---');
    sections.push('## 📚 数据来源: 相关知识库内容\n');
    sections.push(knowledgeContext);
    sections.push('');
  }
  
  // 如果两者都为空，返回提示信息
  if (sections.length <= 1) {
    return '# 投资助手上下文信息\n\n暂无相关上下文数据。';
  }
  
  return sections.join('\n');
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 截断持仓列表
 * 
 * 按市值降序排序，保留 top N 个持仓。
 * 
 * @param positions - 原始持仓列表
 * @returns 截断后的持仓列表和被截断的数量
 */
function truncatePositions(positions: PositionDetail[]): {
  displayPositions: PositionDetail[];
  truncatedCount: number;
} {
  if (!positions || positions.length === 0) {
    return { displayPositions: [], truncatedCount: 0 };
  }
  
  // 按市值降序排序
  const sorted = [...positions].sort((a, b) => b.market_value_cny - a.market_value_cny);
  
  if (sorted.length <= MAX_POSITIONS) {
    return { displayPositions: sorted, truncatedCount: 0 };
  }
  
  return {
    displayPositions: sorted.slice(0, MAX_POSITIONS),
    truncatedCount: sorted.length - MAX_POSITIONS
  };
}

/**
 * 从原始数据库记录转换为 PositionDetail
 * 
 * 辅助函数，用于将数据库查询结果转换为标准格式。
 * 
 * @param raw - 原始数据库记录
 * @returns 标准化的 PositionDetail
 */
export function convertToPositionDetail(raw: {
  ticker: string;
  name?: string;
  quantity: number;
  current_price: number;
  currency: 'USD' | 'HKD' | 'CNY';
  avg_cost: number;
  market_value_cny: number;
  weight_percent: number;
  unrealized_pnl_percent: number;
}): PositionDetail {
  return {
    ticker: raw.ticker,
    name: raw.name || raw.ticker,
    quantity: raw.quantity,
    current_price: {
      value: raw.current_price,
      currency: raw.currency
    },
    avg_cost: {
      value: raw.avg_cost,
      currency: raw.currency
    },
    market_value_cny: raw.market_value_cny,
    weight_percent: raw.weight_percent,
    unrealized_pnl_percent: raw.unrealized_pnl_percent
  };
}

/**
 * 从原始数据库记录转换为 TransactionDetail
 * 
 * @param raw - 原始数据库记录
 * @returns 标准化的 TransactionDetail
 */
export function convertToTransactionDetail(raw: {
  date: string;
  action: string;
  ticker: string;
  quantity: number;
  price: number;
  currency: 'USD' | 'HKD' | 'CNY';
}): TransactionDetail {
  return {
    date: raw.date,
    action: raw.action as 'BUY' | 'SELL' | 'SHORT' | 'COVER',
    ticker: raw.ticker,
    quantity: raw.quantity,
    price: {
      value: raw.price,
      currency: raw.currency
    }
  };
}

/**
 * 从原始数据库记录转换为 OptionDetail
 * 
 * @param raw - 原始数据库记录
 * @returns 标准化的 OptionDetail
 */
export function convertToOptionDetail(raw: {
  symbol?: string;
  ticker?: string;
  underlying?: string;
  option_type?: string;
  strike_price?: number;
  expiry_date?: string;
  quantity: number;
  current_price: number;
  market_value_cny: number;
  weight_percent: number;
}): OptionDetail {
  return {
    symbol: raw.symbol || raw.ticker || '',
    underlying: raw.underlying || '',
    option_type: (raw.option_type?.toUpperCase() === 'PUT' ? 'PUT' : 'CALL') as 'CALL' | 'PUT',
    strike_price: raw.strike_price || 0,
    expiry_date: raw.expiry_date || '',
    quantity: raw.quantity,
    current_price: raw.current_price,
    market_value_cny: raw.market_value_cny,
    weight_percent: raw.weight_percent
  };
}

/**
 * 提取 JSON 字符串中的 JSON 对象
 * 
 * 用于从格式化的上下文字符串中提取 JSON 数据进行验证。
 * 
 * @param context - 包含 JSON 代码块的上下文字符串
 * @returns 解析后的 JSON 对象，如果解析失败返回 null
 */
export function extractJSON(context: string): object | null {
  const jsonMatch = context.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) return null;
  
  try {
    return JSON.parse(jsonMatch[1]);
  } catch {
    return null;
  }
}
