/**
 * Supabase 数据到 Portfolio 数据的适配器
 * 将 Supabase 的数据格式转换为 usePortfolio 期望的格式
 * 
 * 修复版本：正确处理类型转换和字段名匹配
 */

import type { 
  DashboardSnapshot,
  StockPosition as SupabaseStockPosition,
  OptionPosition as SupabaseOptionPosition,
  RiskMetrics as SupabaseRiskMetrics,
} from '../services/supabaseData';
import type { Position, RiskAlert, NetWorthRecord, TradingStats } from '../types';
import { generateRiskAlerts } from '../services/riskEngine';

// 使用完整的 PortfolioState 类型
import type { PortfolioState } from '../types';

export interface NetWorthDataPoint {
  date: string;
  value: number;
}



/**
 * 将 Supabase 的驾驶舱数据转换为 PortfolioState
 */
export function adaptDashboardToPortfolio(
  dashboard: DashboardSnapshot | null,
  stockPositionsParam: SupabaseStockPosition[] | null | undefined,
  optionPositionsParam: SupabaseOptionPosition[] | null | undefined,
  riskLimits?: {
    stopLossPercent: number;
    maxDrawdownPercent: number;
    positionLimitPercent: number;
  }
): PortfolioState {
  if (!dashboard) {
    return {
      totalNetWorthCNY: 0,
      dailyPnL: 0,
      dailyPnLPercent: 0,
      drawdownPercent: 0,
      drawdownAmount: 0,
      highWaterMark: 0,
      cashBalance: { USD: 0, HKD: 0, CNY: 0, totalCNY: 0 },
      allocation: { cashRatio: 0, longRatio: 0, shortRatio: 0, cashValueCNY: 0, longValueCNY: 0, shortValueCNY: 0 },
      positions: [],
      alerts: [],
      totalPnL: 0,
      totalPnLPercent: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  // 确保参数是数组，使用不同的变量名避免冲突
  const safeStockPositions = Array.isArray(stockPositionsParam) ? stockPositionsParam : [];
  const safeOptionPositions = Array.isArray(optionPositionsParam) ? optionPositionsParam : [];

  // 转换股票持仓数据（添加空值检查）
  const stockPositionsConverted: Position[] = safeStockPositions.map(p => ({
    id: `stock-${p.ticker || 'unknown'}-${p.snapshot_date || 'unknown'}`,
    ticker: p.ticker || '',
    name: p.name || '',
    market: (p.market || 'US') as 'US' | 'HK' | 'CN',
    currency: (p.currency || 'USD') as 'USD' | 'HKD' | 'CNY',
    // 优先使用 position_type，或者如果数量 > 0 则视为做多
    direction: ((p.position_type === 'LONG' || (p.quantity || 0) > 0) ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
    quantity: p.quantity || 0,
    avgCost: p.avg_cost || 0,
    currentPrice: p.current_price || 0,
    marketValue: p.market_value || 0,
    marketValueCNY: p.market_value_cny || 0,
    unrealizedPnL: p.unrealized_pnl || 0,
    unrealizedPnLCNY: p.unrealized_pnl_cny || 0,
    unrealizedPnLPercent: p.unrealized_pnl_percent || 0,
    weight: p.weight_percent || 0,
    firstBuyDate: p.snapshot_date || '',
    lastTradeDate: p.snapshot_date || '',
  }));

  // 转换期权持仓数据（添加空值检查，并考虑 multiplier）
  const optionPositionsConverted: Position[] = safeOptionPositions.map(p => {
    // 期权的 multiplier 通常是 100（美股期权）
    const multiplier = p.multiplier || 100;
    
    return {
      id: `option-${p.symbol || 'unknown'}-${p.snapshot_date || 'unknown'}`,
      ticker: p.symbol || '',
      name: `${p.underlying_name || ''} ${p.option_type || ''} ${p.strike_price || 0} ${p.expiry_date || ''}`,
      market: (p.market || 'US') as 'US' | 'HK' | 'CN',
      currency: (p.currency || 'USD') as 'USD' | 'HKD' | 'CNY',
      direction: ((p.quantity || 0) > 0 ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
      quantity: Math.abs(p.quantity || 0) * multiplier, // 期权数量 * multiplier
      avgCost: p.avg_cost || 0,
      currentPrice: p.current_price || 0,
      // 如果数据库中的 market_value 已经考虑了 multiplier，则直接使用
      // 否则需要乘以 multiplier
      marketValue: p.market_value || 0,
      marketValueCNY: p.market_value_cny || 0,
      unrealizedPnL: p.unrealized_pnl || 0,
      unrealizedPnLCNY: p.unrealized_pnl_cny || 0,
      unrealizedPnLPercent: p.unrealized_pnl_percent || 0,
      weight: p.weight_percent || 0,
      firstBuyDate: p.snapshot_date || '',
      lastTradeDate: p.snapshot_date || '',
    };
  });

  // 合并所有持仓
  const allPositions = [...stockPositionsConverted, ...optionPositionsConverted];

  // 生成风控警报（使用传入的风险限制或默认值）
  const effectiveRiskLimits = riskLimits || {
    stopLossPercent: -20,
    maxDrawdownPercent: 5,
    positionLimitPercent: 15,
  };
  
  const alerts = generateRiskAlerts(
    allPositions,
    dashboard.net_worth_cny || 0,
    dashboard.high_water_mark || 0,
    effectiveRiskLimits
  );

  return {
    totalNetWorthCNY: dashboard.net_worth_cny || 0,
    dailyPnL: dashboard.daily_pnl || 0, // daily_pnl 已经是 CNY 单位
    dailyPnLPercent: dashboard.daily_pnl_percent || 0,
    drawdownPercent: dashboard.drawdown_percent || 0,
    drawdownAmount: dashboard.drawdown_amount || 0,
    highWaterMark: dashboard.high_water_mark || 0,
    cashBalance: {
      USD: dashboard.cash_usd || 0,
      HKD: dashboard.cash_hkd || 0,
      CNY: dashboard.cash_cny || 0,
      totalCNY: (dashboard.cash_usd || 0) * (dashboard.usd_cny_rate || 7.2) + 
                (dashboard.cash_hkd || 0) * (dashboard.hkd_cny_rate || 0.92) + 
                (dashboard.cash_cny || 0),
    },
    allocation: {
      cashRatio: dashboard.cash_ratio || 0,
      longRatio: dashboard.long_ratio || 0,
      shortRatio: dashboard.short_ratio || 0,
      cashValueCNY: (dashboard.cash_usd || 0) * (dashboard.usd_cny_rate || 7.2) + 
                    (dashboard.cash_hkd || 0) * (dashboard.hkd_cny_rate || 0.92) + 
                    (dashboard.cash_cny || 0),
      longValueCNY: (dashboard.net_worth_cny || 0) * (dashboard.long_ratio || 0) / 100,
      shortValueCNY: (dashboard.net_worth_cny || 0) * (dashboard.short_ratio || 0) / 100,
    },
    positions: allPositions,
    alerts,
    totalPnL: dashboard.daily_pnl || 0,
    totalPnLPercent: dashboard.daily_pnl_percent || 0,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * 将 Supabase 的历史数据转换为净值图表数据
 * 转换为 NetWorthRecord 格式以兼容 NetWorthChart 组件
 */
export function adaptDashboardHistory(history: DashboardSnapshot[]): NetWorthRecord[] {
  if (!history || history.length === 0) {
    return [];
  }

  // 计算每个时间点的高水位线
  let runningHWM = 0;
  
  return history.map(d => {
    const netWorth = d.net_worth_cny || 0;
    runningHWM = Math.max(runningHWM, netWorth);
    
    // 计算实际金额值
    const cashValue = d.cash_total_cny ?? ((d.cash_ratio || 0) / 100 * netWorth);
    const longValue = d.long_value_cny ?? ((d.long_ratio || 0) / 100 * netWorth);
    const shortValue = d.short_value_cny ?? ((d.short_ratio || 0) / 100 * netWorth);
    
    return {
      date: d.date,
      netWorth: netWorth,
      cashRatio: d.cash_ratio || 0,
      longRatio: d.long_ratio || 0,
      shortRatio: d.short_ratio || 0,
      highWaterMark: runningHWM,
      cashValue,
      longValue,
      shortValue,
    };
  });
}

/**
 * 从风险指标生成交易统计
 */
export function adaptRiskMetricsToTradingStats(metrics: SupabaseRiskMetrics | null): TradingStats {
  if (!metrics) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      maxWin: null,
      maxLoss: null,
      totalRealizedPnL: 0,
    };
  }

  // 从风险指标中提取数据
  const winRate = metrics.win_rate ?? 0;
  const profitFactor = metrics.profit_factor ?? 0;
  const avgWin = metrics.avg_win ?? 0;
  const avgLoss = metrics.avg_loss ?? 0;
  
  // 如果没有总交易数，尝试从其他指标推算
  // 由于风险指标中没有总交易数，我们使用 winRate 和 profitFactor 来估算
  // 这里假设有足够的交易数据来计算，如果没有则返回默认值
  // 实际应该从交易记录中计算，但为了兼容性，我们使用风险指标中的数据
  const totalTrades = 0; // 无法从风险指标中获取，需要从交易记录中计算
  const winningTrades = 0;
  const losingTrades = 0;

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    maxWin: null,
    maxLoss: null,
    totalRealizedPnL: 0,
  };
}

