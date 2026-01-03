/**
 * 统一数据层类型定义
 * 用于解决 Dashboard 各卡片数据不一致的问题
 * 
 * 设计原则：
 * 1. 静态数据使用统一的 timestamp，确保数据版本一致
 * 2. 实时价格独立于快照，支持高频更新
 * 3. 用户数据独立管理，支持乐观更新
 */

import type { 
  DashboardSnapshot as SupabaseDashboard,
  StockPosition as SupabaseStockPosition,
  OptionPosition as SupabaseOptionPosition,
  RiskMetrics as SupabaseRiskMetrics,
} from '../services/supabaseData';

import type { Transaction, WatchlistItem, AppSettings } from './index';

// ============================================
// 核心数据快照类型
// ============================================

/**
 * 数据快照 - 包含某一时间点的完整 Dashboard 数据
 * 所有静态数据使用统一的 timestamp，确保数据版本一致
 */
export interface DashboardSnapshot {
  /** 快照时间戳（毫秒），用于标识数据版本 */
  timestamp: number;
  
  /** Dashboard 核心数据（净值、现金、配置比例等） */
  dashboard: SupabaseDashboard | null;
  
  /** 股票持仓列表 */
  stockPositions: SupabaseStockPosition[];
  
  /** 期权持仓列表 */
  optionPositions: SupabaseOptionPosition[];
  
  /** 风险指标（VaR、夏普比率、最大回撤等） */
  riskMetrics: SupabaseRiskMetrics | null;
  
  /** 历史净值数据（用于图表展示） */
  history: SupabaseDashboard[];
  
  /** 收益归因数据（交易盈亏、股息、利息等） */
  returnAttribution: ReturnAttributionData | null;
  
  /** 成本分析数据（佣金、费用、税费等） */
  costAnalysis: CostAnalysisData | null;
}

// ============================================
// 收益归因与成本分析
// ============================================

/**
 * 收益归因数据
 * 用于分析收益来源，帮助优化投资策略
 */
export interface ReturnAttributionData {
  /** 交易盈亏（已实现） */
  trading_pnl: number;
  /** 持仓盈亏（未实现） */
  position_pnl: number;
  /** 股息收入 */
  dividend_income: number;
  /** 利息收入 */
  interest_income: number;
  /** 期权盈亏 */
  option_pnl: number;
  /** 外汇盈亏 */
  fx_pnl: number;
  /** 总收益 */
  total_return: number;
  /** 记录数量（用于 YTD 累计） */
  record_count?: number;
}

/**
 * 成本分析数据
 * 用于追踪交易成本，优化交易频率
 */
export interface CostAnalysisData {
  /** 数据日期 */
  date: string;
  /** 总佣金 */
  total_commissions: number;
  /** 总费用 */
  total_fees: number;
  /** 总税费 */
  total_taxes: number;
  /** 总成本 */
  total_costs: number;
  /** 成本占净值比例 */
  cost_to_nav_ratio: number;
  /** 股票佣金 */
  stock_commissions: number;
  /** 期权佣金 */
  option_commissions: number;
}

// ============================================
// 实时价格数据
// ============================================

/**
 * 单个股票的实时价格信息
 */
export interface LivePriceInfo {
  /** 当前价格 */
  currentPrice: number;
  /** 涨跌幅（百分比） */
  changePercent: number;
  /** 最后更新时间（毫秒） */
  lastUpdated: number;
}

/**
 * 实时价格数据（独立于快照）
 * 以 ticker 为 key 的价格映射
 */
export interface LivePriceData {
  [ticker: string]: LivePriceInfo;
}

// ============================================
// 用户数据
// ============================================

/**
 * 用户数据（独立于快照）
 * 包含用户的交易记录、观察列表和设置
 */
export interface UserData {
  /** 交易记录列表 */
  transactions: Transaction[];
  /** 观察列表 */
  watchlist: WatchlistItem[];
  /** 应用设置 */
  settings: AppSettings | null;
}

// ============================================
// 缓存配置
// ============================================

/**
 * 统一缓存配置
 * 用于 React Query 的缓存策略
 */
export const UNIFIED_CACHE_CONFIG = {
  /** 静态数据：3分钟 staleTime，10分钟 gcTime */
  static: {
    staleTime: 3 * 60 * 1000,  // 3 分钟内数据视为新鲜
    gcTime: 10 * 60 * 1000,    // 10 分钟后垃圾回收
  },
  /** 实时价格：30秒 staleTime，自动刷新 */
  live: {
    staleTime: 30 * 1000,      // 30 秒内数据视为新鲜
    refetchInterval: 30 * 1000, // 每 30 秒自动刷新
  },
  /** 用户数据：5分钟 staleTime */
  user: {
    staleTime: 5 * 60 * 1000,  // 5 分钟内数据视为新鲜
    gcTime: 10 * 60 * 1000,    // 10 分钟后垃圾回收
  },
} as const;

// ============================================
// Store 返回类型
// ============================================

/**
 * 数据一致性验证结果
 */
export interface ConsistencyValidationResult {
  /** 是否通过验证 */
  valid: boolean;
  /** 问题列表（如果有） */
  issues: string[];
}

/**
 * useDashboardStore 返回类型
 * 统一数据层的主要接口
 */
export interface DashboardStoreResult {
  /** 数据快照（包含所有静态数据） */
  snapshot: DashboardSnapshot;
  
  /** 实时价格（独立于快照，高频更新） */
  livePrices: LivePriceData;
  
  /** 是否正在加载 */
  isLoading: boolean;
  
  /** 是否有错误 */
  isError: boolean;
  
  /** 错误列表（每个查询可能有独立的错误） */
  errors: (Error | null)[];
  
  /** 刷新所有数据 */
  refresh: () => Promise<void>;
  
  /** 验证数据一致性 */
  validateConsistency: () => ConsistencyValidationResult;
  
  /** 最后更新时间 */
  lastUpdated: Date;
}

// ============================================
// 工具函数
// ============================================

/**
 * 创建空的 DashboardSnapshot
 * 用于初始化状态或错误恢复
 */
export function createEmptySnapshot(): DashboardSnapshot {
  return {
    timestamp: Date.now(),
    dashboard: null,
    stockPositions: [],
    optionPositions: [],
    riskMetrics: null,
    history: [],
    returnAttribution: null,
    costAnalysis: null,
  };
}

/**
 * 检查快照是否为空
 */
export function isEmptySnapshot(snapshot: DashboardSnapshot): boolean {
  return (
    snapshot.dashboard === null &&
    snapshot.stockPositions.length === 0 &&
    snapshot.optionPositions.length === 0 &&
    snapshot.riskMetrics === null &&
    snapshot.history.length === 0
  );
}

/**
 * 获取快照的数据日期
 * 返回 dashboard 中的日期，如果不存在则返回 null
 */
export function getSnapshotDate(snapshot: DashboardSnapshot): string | null {
  return snapshot.dashboard?.date ?? null;
}

/**
 * 计算快照数据的年龄（毫秒）
 */
export function getSnapshotAge(snapshot: DashboardSnapshot): number {
  return Date.now() - snapshot.timestamp;
}

/**
 * 检查快照是否过期
 * @param snapshot 数据快照
 * @param maxAge 最大年龄（毫秒），默认 3 分钟
 */
export function isSnapshotStale(
  snapshot: DashboardSnapshot, 
  maxAge: number = UNIFIED_CACHE_CONFIG.static.staleTime
): boolean {
  return getSnapshotAge(snapshot) > maxAge;
}

// ============================================
// 实时价格合并函数
// ============================================

/**
 * 带实时价格的股票持仓（扩展类型）
 * 在渲染时使用，包含最新的市场价格
 */
export interface EnrichedStockPosition extends SupabaseStockPosition {
  /** 实时价格（如果可用） */
  live_price?: number;
  /** 实时涨跌幅（如果可用） */
  live_change_percent?: number;
  /** 实时价格最后更新时间（如果可用） */
  live_last_updated?: number;
  /** 是否有实时价格数据 */
  has_live_price: boolean;
  /** 使用实时价格计算的市值（如果有实时价格） */
  live_market_value?: number;
  /** 使用实时价格计算的未实现盈亏（如果有实时价格） */
  live_unrealized_pnl?: number;
  /** 使用实时价格计算的未实现盈亏百分比（如果有实时价格） */
  live_unrealized_pnl_percent?: number;
}

/**
 * 合并实时价格到持仓数据
 * 
 * 这是一个纯函数，用于在渲染时将实时价格数据合并到静态持仓数据中。
 * 不会修改原始数据，返回新的数组。
 * 
 * @param positions 股票持仓列表（静态数据）
 * @param livePrices 实时价格数据
 * @returns 带实时价格的持仓列表
 * 
 * @example
 * ```typescript
 * const enrichedPositions = enrichWithLivePrices(
 *   snapshot.stockPositions,
 *   livePrices
 * );
 * ```
 */
export function enrichWithLivePrices(
  positions: SupabaseStockPosition[],
  livePrices: LivePriceData
): EnrichedStockPosition[] {
  return positions.map((position) => {
    const livePrice = livePrices[position.ticker];
    
    if (!livePrice) {
      // 没有实时价格，返回原始数据加上标记
      return {
        ...position,
        has_live_price: false,
      };
    }
    
    // 计算使用实时价格的市值和盈亏
    const liveMarketValue = livePrice.currentPrice * position.quantity;
    const totalCost = position.avg_cost * position.quantity;
    const liveUnrealizedPnl = liveMarketValue - totalCost;
    const liveUnrealizedPnlPercent = totalCost > 0 
      ? (liveUnrealizedPnl / totalCost) * 100 
      : 0;
    
    return {
      ...position,
      live_price: livePrice.currentPrice,
      live_change_percent: livePrice.changePercent,
      live_last_updated: livePrice.lastUpdated,
      has_live_price: true,
      live_market_value: liveMarketValue,
      live_unrealized_pnl: liveUnrealizedPnl,
      live_unrealized_pnl_percent: liveUnrealizedPnlPercent,
    };
  });
}

// ============================================
// 类型导出（重新导出 Supabase 类型供外部使用）
// ============================================

export type {
  SupabaseDashboard,
  SupabaseStockPosition,
  SupabaseOptionPosition,
  SupabaseRiskMetrics,
};
