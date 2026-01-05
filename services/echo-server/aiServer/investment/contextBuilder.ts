/**
 * Investment Context Builder
 * 
 * 负责将投资组合数据和知识库内容格式化为 AI 可理解的上下文。
 * 从 packages/riskcontrol/src/services/contextBuilder.ts 移植并适配 Echo 架构。
 * 
 * 主要功能：
 * 1. buildStructuredContext() - 将持仓、交易等结构化数据转为 JSON 格式
 * 2. buildKnowledgeContext() - 格式化知识库检索结果
 * 3. mergeContexts() - 合并多个上下文来源
 * 4. buildContext() - 完整上下文构建（带缓存）
 * 
 * @module services/echo-server/aiServer/investment/contextBuilder
 */

import {
  getDashboardSnapshot,
  getStockPositions,
  getOptionPositions,
  getRecentTransactions,
  type DashboardSnapshot,
  type StockPosition,
  type OptionPosition,
  type Transaction,
} from '../../lib/investmentDb';

import type {
  PortfolioContext,
  PortfolioSummary,
  PositionDetail,
  OptionDetail,
  TransactionDetail,
  KnowledgeContext,
  CurrencyValue,
} from './types';

// ============================================================================
// 常量
// ============================================================================

/** 最大显示持仓数量 */
const MAX_POSITIONS = 20;

/** 缓存过期时间（毫秒）*/
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

// ============================================================================
// 缓存管理
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const contextCache = new Map<string, CacheEntry<string>>();


/**
 * 生成缓存键
 */
function getCacheKey(accountId?: number): string {
  return `context_${accountId || 'default'}`;
}

/**
 * 检查缓存是否有效
 */
function isCacheValid<T>(entry: CacheEntry<T> | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL;
}

/**
 * 清除缓存
 */
export function clearContextCache(accountId?: number): void {
  if (accountId) {
    contextCache.delete(getCacheKey(accountId));
  } else {
    contextCache.clear();
  }
}

// ============================================================================
// 数据转换函数
// ============================================================================

/**
 * 将数据库股票持仓转换为 PositionDetail
 */
export function convertToPositionDetail(raw: StockPosition): PositionDetail {
  const currency = (raw.currency || 'USD') as 'USD' | 'HKD' | 'CNY';
  return {
    ticker: raw.ticker,
    name: raw.name || raw.ticker,
    quantity: raw.quantity,
    current_price: {
      value: raw.current_price,
      currency,
    },
    avg_cost: {
      value: raw.avg_cost,
      currency,
    },
    market_value_cny: raw.market_value_cny,
    weight_percent: raw.weight_percent || 0,
    unrealized_pnl_percent: raw.unrealized_pnl_percent || 0,
  };
}

/**
 * 将数据库期权持仓转换为 OptionDetail
 */
export function convertToOptionDetail(raw: OptionPosition): OptionDetail {
  return {
    symbol: raw.symbol || '',
    underlying: raw.underlying_ticker || '',
    option_type: (raw.option_type?.toUpperCase() === 'PUT' ? 'PUT' : 'CALL') as 'CALL' | 'PUT',
    strike_price: raw.strike_price || 0,
    expiry_date: raw.expiry_date || '',
    quantity: raw.quantity,
    current_price: raw.current_price,
    market_value_cny: raw.market_value_cny,
    weight_percent: raw.weight_percent || 0,
    days_to_expiry: raw.days_to_expiry,
  };
}


/**
 * 将数据库交易记录转换为 TransactionDetail
 */
export function convertToTransactionDetail(raw: Transaction): TransactionDetail {
  const currency = (raw.currency || 'USD') as 'USD' | 'HKD' | 'CNY';
  return {
    date: raw.date,
    action: raw.action as 'BUY' | 'SELL' | 'SHORT' | 'COVER',
    ticker: raw.ticker,
    quantity: raw.quantity,
    price: {
      value: raw.price || 0,
      currency,
    },
  };
}

/**
 * 截断持仓列表，按市值降序排序，保留 top N
 */
function truncatePositions(positions: PositionDetail[]): {
  displayPositions: PositionDetail[];
  truncatedCount: number;
} {
  if (!positions || positions.length === 0) {
    return { displayPositions: [], truncatedCount: 0 };
  }

  const sorted = [...positions].sort((a, b) => b.market_value_cny - a.market_value_cny);

  if (sorted.length <= MAX_POSITIONS) {
    return { displayPositions: sorted, truncatedCount: 0 };
  }

  return {
    displayPositions: sorted.slice(0, MAX_POSITIONS),
    truncatedCount: sorted.length - MAX_POSITIONS,
  };
}

// ============================================================================
// 核心构建函数
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
 */
export function buildStructuredContext(data: PortfolioContext): string {
  const { displayPositions, truncatedCount } = truncatePositions(data.positions);

  const json = {
    portfolio_summary: {
      snapshot_date: data.summary.snapshot_date,
      total_net_worth_cny: data.summary.total_net_worth_cny,
      total_positions: data.summary.total_positions,
      total_options: data.summary.total_options,
      cash_ratio_percent: data.summary.cash_ratio_percent,
      ytd_return_percent: data.summary.ytd_return_percent,
      drawdown_percent: data.summary.drawdown_percent,
      leverage_ratio: data.summary.leverage_ratio,
    },
    stock_positions: displayPositions.map(p => ({
      ticker: p.ticker,
      name: p.name,
      quantity: p.quantity,
      current_price: p.current_price,
      avg_cost: p.avg_cost,
      market_value_cny: p.market_value_cny,
      weight_percent: p.weight_percent,
      unrealized_pnl_percent: p.unrealized_pnl_percent,
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
      weight_percent: o.weight_percent,
    })),
    recent_transactions: data.transactions.slice(0, 10).map(t => ({
      date: t.date,
      action: t.action,
      ticker: t.ticker,
      quantity: t.quantity,
      price: t.price,
    })),
  };

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
 */
export function mergeContexts(
  structuredContext?: string | null,
  knowledgeContext?: string | null
): string {
  const sections: string[] = [];

  sections.push('# 投资助手上下文信息\n');

  if (structuredContext && structuredContext.trim()) {
    sections.push('---');
    sections.push('## 📊 数据来源: 投资组合数据\n');
    sections.push(structuredContext);
    sections.push('');
  }

  if (knowledgeContext && knowledgeContext.trim()) {
    sections.push('---');
    sections.push('## 📚 数据来源: 相关知识库内容\n');
    sections.push(knowledgeContext);
    sections.push('');
  }

  if (sections.length <= 1) {
    return '# 投资助手上下文信息\n\n暂无相关上下文数据。';
  }

  return sections.join('\n');
}


// ============================================================================
// 数据获取函数
// ============================================================================

/**
 * 获取持仓数据
 */
export async function getPositions(accountId?: number): Promise<PositionDetail[]> {
  try {
    const stockPositions = await getStockPositions(accountId);
    return stockPositions.map(convertToPositionDetail);
  } catch (error) {
    console.error('[ContextBuilder] Error fetching positions:', error);
    return [];
  }
}

/**
 * 获取期权持仓
 */
export async function getOptions(accountId?: number): Promise<OptionDetail[]> {
  try {
    const optionPositions = await getOptionPositions(accountId);
    return optionPositions.map(convertToOptionDetail);
  } catch (error) {
    console.error('[ContextBuilder] Error fetching options:', error);
    return [];
  }
}

/**
 * 获取交易记录
 */
export async function getTransactions(accountId?: number, limit = 10): Promise<TransactionDetail[]> {
  try {
    const transactions = await getRecentTransactions(accountId, limit);
    return transactions.map(convertToTransactionDetail);
  } catch (error) {
    console.error('[ContextBuilder] Error fetching transactions:', error);
    return [];
  }
}

/**
 * 获取 Dashboard 快照并转换为 PortfolioSummary
 */
export async function getPortfolioSummary(accountId?: number): Promise<PortfolioSummary | null> {
  try {
    const snapshot = await getDashboardSnapshot(accountId);
    if (!snapshot) return null;

    return {
      snapshot_date: snapshot.date,
      total_net_worth_cny: snapshot.net_worth_cny,
      total_positions: snapshot.total_positions || 0,
      total_options: snapshot.option_positions || 0,
      cash_ratio_percent: snapshot.cash_ratio || 0,
      ytd_return_percent: 0, // TODO: 从历史数据计算
      drawdown_percent: snapshot.drawdown_percent,
      leverage_ratio: snapshot.leverage_ratio,
    };
  } catch (error) {
    console.error('[ContextBuilder] Error fetching portfolio summary:', error);
    return null;
  }
}


// ============================================================================
// 主入口函数
// ============================================================================

/**
 * 构建完整的投资上下文（带缓存）
 * 
 * 这是主入口函数，整合所有数据源并构建 AI 可用的上下文。
 * 
 * 特性：
 * - 5 分钟缓存，减少数据库查询
 * - 优雅降级：部分数据缺失时继续处理
 * - 并行获取数据，提高性能
 * 
 * @param accountId - 用户账户 ID（可选）
 * @param forceRefresh - 强制刷新缓存
 * @returns 格式化的上下文字符串
 */
export async function buildContext(
  accountId?: number,
  forceRefresh = false
): Promise<string> {
  const cacheKey = getCacheKey(accountId);

  // 检查缓存
  if (!forceRefresh) {
    const cached = contextCache.get(cacheKey);
    if (isCacheValid(cached)) {
      console.log('[ContextBuilder] Using cached context');
      return cached!.data;
    }
  }

  console.log('[ContextBuilder] Building fresh context...');

  try {
    // 并行获取所有数据
    const [summary, positions, options, transactions] = await Promise.all([
      getPortfolioSummary(accountId),
      getPositions(accountId),
      getOptions(accountId),
      getTransactions(accountId, 10),
    ]);

    // 构建 PortfolioContext
    const portfolioContext: PortfolioContext = {
      summary: summary || {
        snapshot_date: new Date().toISOString().split('T')[0],
        total_net_worth_cny: 0,
        total_positions: positions.length,
        total_options: options.length,
        cash_ratio_percent: 0,
        ytd_return_percent: 0,
      },
      positions,
      options,
      transactions,
    };

    // 构建结构化上下文
    const structuredContext = buildStructuredContext(portfolioContext);

    // 目前只返回结构化上下文，知识库上下文由 RAG Service 提供
    const context = mergeContexts(structuredContext, null);

    // 更新缓存
    contextCache.set(cacheKey, {
      data: context,
      timestamp: Date.now(),
    });

    console.log('[ContextBuilder] Context built successfully');
    return context;
  } catch (error) {
    console.error('[ContextBuilder] Error building context:', error);
    
    // 优雅降级：返回友好提示
    return '# 投资助手上下文信息\n\n⚠️ 暂时无法获取投资数据，请稍后重试。';
  }
}

/**
 * 提取 JSON 字符串中的 JSON 对象（用于测试验证）
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

// 导出默认函数
export default buildContext;
