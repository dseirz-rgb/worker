/**
 * 季节性风险分析服务 - Seasonal Risk Analysis Service
 * 分析历史月度表现，识别弱势月份，提供季节性风险警告
 */

import type { DashboardSnapshot } from './supabaseData';

// ============ 类型定义 ============

export type SeasonalRiskLevel = 'low' | 'medium' | 'high';

export interface MonthlyStats {
  month: number;           // 1-12
  monthName: string;       // 中文月份名
  avgReturn: number;       // 平均收益率 (%)
  maxDrawdown: number;     // 最大回撤 (%)
  winRate: number;         // 胜率 (%)
  tradingDays: number;     // 交易天数
  totalDays: number;       // 总天数（跨年累计）
  bestReturn: number;      // 最佳单日收益 (%)
  worstReturn: number;     // 最差单日收益 (%)
  volatility: number;      // 波动率 (%)
  isWeakMonth: boolean;    // 是否为弱势月份
}

export interface SeasonalPerformance {
  monthlyStats: MonthlyStats[];
  weakMonths: number[];           // 弱势月份列表 (1-12)
  strongMonths: number[];         // 强势月份列表 (1-12)
  overallAvgReturn: number;       // 整体平均月收益率
  analysisStartDate: string;      // 分析起始日期
  analysisEndDate: string;        // 分析结束日期
  totalTradingDays: number;       // 总交易天数
}

export interface SeasonalRiskWarning {
  hasWarning: boolean;
  riskLevel: SeasonalRiskLevel;
  currentMonth: number;
  currentMonthName: string;
  message: string;
  historicalAvgReturn: number;
  historicalMaxDrawdown: number;
  historicalWinRate: number;
  suggestions: string[];
}

// ============ 常量定义 ============

const MONTH_NAMES = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月'
];

// ============ 核心分析函数 ============

/**
 * 分析历史月度收益表现
 * @param history - 历史 DashboardSnapshot 数据数组
 * @returns SeasonalPerformance - 季节性表现分析结果
 */
export function analyzeSeasonalPerformance(history: DashboardSnapshot[]): SeasonalPerformance {
  if (!history || history.length === 0) {
    return createEmptySeasonalPerformance();
  }

  // 按日期排序
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // 按月份分组数据
  const monthlyData = groupByMonth(sortedHistory);

  // 计算每月统计数据
  const monthlyStats: MonthlyStats[] = [];
  let totalReturns: number[] = [];

  for (let month = 1; month <= 12; month++) {
    const data = monthlyData.get(month) || [];
    const stats = calculateMonthStats(month, data);
    monthlyStats.push(stats);
    
    // 收集所有日收益用于计算整体平均
    data.forEach(d => {
      if (d.daily_pnl_percent !== null && d.daily_pnl_percent !== undefined) {
        totalReturns.push(d.daily_pnl_percent);
      }
    });
  }

  // 计算整体平均日收益率
  const overallAvgDailyReturn = totalReturns.length > 0
    ? totalReturns.reduce((a, b) => a + b, 0) / totalReturns.length
    : 0;

  // 识别弱势和强势月份
  const { weakMonths, strongMonths } = identifyWeakAndStrongMonths(monthlyStats, overallAvgDailyReturn);

  // 更新 isWeakMonth 标记
  monthlyStats.forEach(stats => {
    stats.isWeakMonth = weakMonths.includes(stats.month);
  });

  return {
    monthlyStats,
    weakMonths,
    strongMonths,
    overallAvgReturn: overallAvgDailyReturn,
    analysisStartDate: sortedHistory[0]?.date || '',
    analysisEndDate: sortedHistory[sortedHistory.length - 1]?.date || '',
    totalTradingDays: sortedHistory.length,
  };
}

/**
 * 获取当前月份的季节性风险警告
 * @param currentMonth - 当前月份 (1-12)
 * @param history - 历史数据
 * @returns SeasonalRiskWarning - 季节性风险警告
 */
export function getSeasonalRiskWarning(
  currentMonth: number,
  history: DashboardSnapshot[]
): SeasonalRiskWarning {
  const performance = analyzeSeasonalPerformance(history);
  const monthStats = performance.monthlyStats.find(s => s.month === currentMonth);

  if (!monthStats || performance.totalTradingDays < 30) {
    return createNoDataWarning(currentMonth);
  }

  const isWeakMonth = performance.weakMonths.includes(currentMonth);
  const riskLevel = determineRiskLevel(monthStats, performance.overallAvgReturn);

  const suggestions = generateSuggestions(monthStats, riskLevel, isWeakMonth);

  let message = '';
  if (isWeakMonth) {
    message = `${monthStats.monthName}历史表现较弱，平均收益率 ${monthStats.avgReturn.toFixed(2)}%，建议谨慎操作`;
  } else if (riskLevel === 'medium') {
    message = `${monthStats.monthName}历史表现一般，注意控制仓位`;
  } else {
    message = `${monthStats.monthName}历史表现良好，可正常操作`;
  }

  return {
    hasWarning: isWeakMonth || riskLevel !== 'low',
    riskLevel,
    currentMonth,
    currentMonthName: monthStats.monthName,
    message,
    historicalAvgReturn: monthStats.avgReturn,
    historicalMaxDrawdown: monthStats.maxDrawdown,
    historicalWinRate: monthStats.winRate,
    suggestions,
  };
}

/**
 * 获取月度统计数据
 * @param history - 历史数据
 * @returns MonthlyStats[] - 月度统计数组
 */
export function getMonthlyStats(history: DashboardSnapshot[]): MonthlyStats[] {
  const performance = analyzeSeasonalPerformance(history);
  return performance.monthlyStats;
}

// ============ 辅助函数 ============

/**
 * 按月份分组历史数据
 */
function groupByMonth(history: DashboardSnapshot[]): Map<number, DashboardSnapshot[]> {
  const monthlyData = new Map<number, DashboardSnapshot[]>();

  for (let month = 1; month <= 12; month++) {
    monthlyData.set(month, []);
  }

  history.forEach(snapshot => {
    const date = new Date(snapshot.date);
    const month = date.getMonth() + 1; // getMonth() 返回 0-11
    const existing = monthlyData.get(month) || [];
    existing.push(snapshot);
    monthlyData.set(month, existing);
  });

  return monthlyData;
}

/**
 * 计算单月统计数据
 */
function calculateMonthStats(month: number, data: DashboardSnapshot[]): MonthlyStats {
  const monthName = MONTH_NAMES[month - 1];

  if (data.length === 0) {
    return {
      month,
      monthName,
      avgReturn: 0,
      maxDrawdown: 0,
      winRate: 0,
      tradingDays: 0,
      totalDays: 0,
      bestReturn: 0,
      worstReturn: 0,
      volatility: 0,
      isWeakMonth: false,
    };
  }

  // 提取日收益率
  const dailyReturns = data
    .map(d => d.daily_pnl_percent)
    .filter((r): r is number => r !== null && r !== undefined && !isNaN(r));

  // 计算平均收益率
  const avgReturn = dailyReturns.length > 0
    ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    : 0;

  // 计算胜率
  const winningDays = dailyReturns.filter(r => r > 0).length;
  const winRate = dailyReturns.length > 0
    ? (winningDays / dailyReturns.length) * 100
    : 0;

  // 计算最大回撤
  const drawdowns = data
    .map(d => d.drawdown_percent)
    .filter((d): d is number => d !== null && d !== undefined && !isNaN(d));
  const maxDrawdown = drawdowns.length > 0
    ? Math.min(...drawdowns) // drawdown_percent 通常是负数
    : 0;

  // 最佳和最差单日收益
  const bestReturn = dailyReturns.length > 0 ? Math.max(...dailyReturns) : 0;
  const worstReturn = dailyReturns.length > 0 ? Math.min(...dailyReturns) : 0;

  // 计算波动率（标准差）
  const volatility = calculateVolatility(dailyReturns);

  return {
    month,
    monthName,
    avgReturn,
    maxDrawdown: Math.abs(maxDrawdown), // 转为正数表示
    winRate,
    tradingDays: dailyReturns.length,
    totalDays: data.length,
    bestReturn,
    worstReturn,
    volatility,
    isWeakMonth: false, // 稍后更新
  };
}

/**
 * 计算波动率（标准差）
 */
function calculateVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;

  return Math.sqrt(variance);
}

/**
 * 识别弱势和强势月份
 */
function identifyWeakAndStrongMonths(
  monthlyStats: MonthlyStats[],
  overallAvgReturn: number
): { weakMonths: number[]; strongMonths: number[] } {
  const weakMonths: number[] = [];
  const strongMonths: number[] = [];

  monthlyStats.forEach(stats => {
    if (stats.tradingDays < 5) {
      // 数据不足，跳过
      return;
    }

    // 弱势月份条件：
    // 1. 平均收益为负，或
    // 2. 平均收益显著低于整体平均（低于整体平均的50%）
    const isWeak = stats.avgReturn < 0 || 
      (overallAvgReturn > 0 && stats.avgReturn < overallAvgReturn * 0.5);

    // 强势月份条件：
    // 平均收益显著高于整体平均（高于整体平均的150%）
    const isStrong = overallAvgReturn > 0 && stats.avgReturn > overallAvgReturn * 1.5;

    if (isWeak) {
      weakMonths.push(stats.month);
    } else if (isStrong) {
      strongMonths.push(stats.month);
    }
  });

  return { weakMonths, strongMonths };
}

/**
 * 确定风险等级
 */
function determineRiskLevel(
  monthStats: MonthlyStats,
  overallAvgReturn: number
): SeasonalRiskLevel {
  // 高风险条件
  if (
    monthStats.avgReturn < -0.1 || // 平均日亏损超过0.1%
    monthStats.maxDrawdown > 10 || // 最大回撤超过10%
    monthStats.winRate < 40        // 胜率低于40%
  ) {
    return 'high';
  }

  // 中等风险条件
  if (
    monthStats.avgReturn < 0 ||
    monthStats.avgReturn < overallAvgReturn * 0.7 ||
    monthStats.winRate < 50
  ) {
    return 'medium';
  }

  return 'low';
}

/**
 * 生成建议
 */
function generateSuggestions(
  monthStats: MonthlyStats,
  riskLevel: SeasonalRiskLevel,
  isWeakMonth: boolean
): string[] {
  const suggestions: string[] = [];

  if (isWeakMonth || riskLevel === 'high') {
    suggestions.push('建议降低仓位至正常水平的70%以下');
    suggestions.push('避免使用杠杆');
    suggestions.push('设置更严格的止损线');
    
    if (monthStats.volatility > 2) {
      suggestions.push('本月历史波动较大，建议减少交易频率');
    }
  } else if (riskLevel === 'medium') {
    suggestions.push('保持正常仓位，注意风险控制');
    suggestions.push('密切关注市场变化');
  } else {
    suggestions.push('可按正常策略操作');
    suggestions.push('历史表现良好，但仍需保持风险意识');
  }

  return suggestions;
}

/**
 * 创建空的季节性表现数据
 */
function createEmptySeasonalPerformance(): SeasonalPerformance {
  const monthlyStats: MonthlyStats[] = [];
  
  for (let month = 1; month <= 12; month++) {
    monthlyStats.push({
      month,
      monthName: MONTH_NAMES[month - 1],
      avgReturn: 0,
      maxDrawdown: 0,
      winRate: 0,
      tradingDays: 0,
      totalDays: 0,
      bestReturn: 0,
      worstReturn: 0,
      volatility: 0,
      isWeakMonth: false,
    });
  }

  return {
    monthlyStats,
    weakMonths: [],
    strongMonths: [],
    overallAvgReturn: 0,
    analysisStartDate: '',
    analysisEndDate: '',
    totalTradingDays: 0,
  };
}

/**
 * 创建无数据警告
 */
function createNoDataWarning(currentMonth: number): SeasonalRiskWarning {
  return {
    hasWarning: false,
    riskLevel: 'low',
    currentMonth,
    currentMonthName: MONTH_NAMES[currentMonth - 1],
    message: '历史数据不足，无法进行季节性分析',
    historicalAvgReturn: 0,
    historicalMaxDrawdown: 0,
    historicalWinRate: 0,
    suggestions: ['建议积累更多历史数据后再进行季节性分析'],
  };
}

/**
 * 获取风险等级颜色
 */
export function getSeasonalRiskColor(level: SeasonalRiskLevel): string {
  switch (level) {
    case 'low':
      return 'text-green-500';
    case 'medium':
      return 'text-yellow-500';
    case 'high':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

/**
 * 获取风险等级背景色
 */
export function getSeasonalRiskBgColor(level: SeasonalRiskLevel): string {
  switch (level) {
    case 'low':
      return 'bg-green-500/10';
    case 'medium':
      return 'bg-yellow-500/10';
    case 'high':
      return 'bg-red-500/10';
    default:
      return 'bg-gray-500/10';
  }
}

/**
 * 获取风险等级中文名称
 */
export function getSeasonalRiskLevelName(level: SeasonalRiskLevel): string {
  switch (level) {
    case 'low':
      return '低风险';
    case 'medium':
      return '中等风险';
    case 'high':
      return '高风险';
    default:
      return '未知';
  }
}
