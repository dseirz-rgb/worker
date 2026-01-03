/**
 * 风控指标计算服务 - Risk Metrics Service
 * 实现2026风控系统的核心计算逻辑
 */

// ============ 类型定义 ============

export type LeverageStatus = 'normal' | 'warning' | 'critical';
export type DrawdownStatus = 'normal' | 'warning' | 'critical';
export type TrailingStopStatus = 'normal' | 'warning' | 'triggered';
export type LosingStreakStatus = 'normal' | 'warning' | 'critical';
export type OverallRiskStatus = 'safe' | 'caution' | 'danger';

export interface RiskThresholds {
  leverageWarning: number;      // default: 1.5
  leverageCritical: number;     // default: 2.0
  leverageInDrawdown: number;   // default: 1.2
  monthlyDrawdownWarning: number;   // default: 10
  monthlyDrawdownCritical: number;  // default: 15
  trailingStopPercent: number;  // default: 15
  losingStreakWarning: number;  // default: 3
  losingStreakCritical: number; // default: 5
}

export interface RiskMetrics {
  // 杠杆相关
  currentLeverage: number;
  leverageStatus: LeverageStatus;
  leverageLimit: number;
  
  // 月度回撤相关
  monthlyDrawdown: number;
  monthlyDrawdownStatus: DrawdownStatus;
  monthStartNAV: number;
  distanceToMonthlyStopLoss: number;
  
  // 高水位相关
  highWaterMark: number;
  trailingStopLevel: number;
  distanceToTrailingStop: number;
  trailingStopStatus: TrailingStopStatus;
  
  // 连败相关
  currentLosingStreak: number;
  losingStreakStatus: LosingStreakStatus;
  maxHistoricalLosingStreak: number;
  
  // 综合评分
  overallRiskScore: number;
  overallStatus: OverallRiskStatus;
}

export interface DailyPnL {
  date: string;
  pnl: number;
  pnlPercent: number;
}

// ============ 默认阈值 ============

export const DEFAULT_THRESHOLDS: RiskThresholds = {
  leverageWarning: 1.5,
  leverageCritical: 2.0,
  leverageInDrawdown: 1.2,
  monthlyDrawdownWarning: 10,
  monthlyDrawdownCritical: 15,
  trailingStopPercent: 15,
  losingStreakWarning: 3,
  losingStreakCritical: 5,
};

// ============ 核心计算函数 ============

/**
 * 计算杠杆状态
 * Property 1: 如果 leverage > leverageWarning，状态必须是 'warning' 或 'critical'
 * Property 3: 如果在回撤期间，杠杆限制降低到 leverageInDrawdown
 */
export function calculateLeverageStatus(
  leverage: number,
  thresholds: RiskThresholds,
  isInDrawdown: boolean
): { status: LeverageStatus; limit: number } {
  // 动态杠杆限制：回撤期间降低
  const limit = isInDrawdown ? thresholds.leverageInDrawdown : thresholds.leverageCritical;
  
  let status: LeverageStatus;
  
  if (leverage >= thresholds.leverageCritical) {
    status = 'critical';
  } else if (leverage >= thresholds.leverageWarning) {
    status = 'warning';
  } else {
    status = 'normal';
  }
  
  return { status, limit };
}

/**
 * 计算月度回撤
 * Property 4: monthlyDrawdown = (monthStartNAV - currentNAV) / monthStartNAV * 100
 * Property 5: 如果 drawdown >= 10%，状态是 'warning' 或 'critical'；>= 15% 是 'critical'
 */
export function calculateMonthlyDrawdown(
  monthStartNAV: number,
  currentNAV: number,
  thresholds: RiskThresholds
): { drawdown: number; status: DrawdownStatus; distanceToStopLoss: number } {
  // 边界情况处理
  if (monthStartNAV <= 0) {
    return { drawdown: 0, status: 'normal', distanceToStopLoss: thresholds.monthlyDrawdownCritical };
  }
  
  // 计算回撤百分比（正数表示亏损）
  const drawdown = ((monthStartNAV - currentNAV) / monthStartNAV) * 100;
  
  // 确定状态
  let status: DrawdownStatus;
  if (drawdown >= thresholds.monthlyDrawdownCritical) {
    status = 'critical';
  } else if (drawdown >= thresholds.monthlyDrawdownWarning) {
    status = 'warning';
  } else {
    status = 'normal';
  }
  
  // 距离止损线的距离
  const distanceToStopLoss = thresholds.monthlyDrawdownCritical - Math.max(0, drawdown);
  
  return { drawdown, status, distanceToStopLoss };
}

/**
 * 计算移动止盈水平
 * Property 7: 高水位只能增加或保持不变，不能减少
 * Property 8: trailingStopLevel = HWM * (1 - trailingStopPercent / 100)
 */
export function calculateTrailingStopLevel(
  hwm: number,
  trailingStopPercent: number
): number {
  // Property 10: 确保 trailingStopPercent 在 10-25 范围内
  const clampedPercent = Math.max(10, Math.min(25, trailingStopPercent));
  return hwm * (1 - clampedPercent / 100);
}

/**
 * 计算移动止盈状态
 * Property 9: 如果 NAV < trailingStopLevel，触发止盈警报
 */
export function calculateTrailingStopStatus(
  currentNAV: number,
  hwm: number,
  trailingStopPercent: number
): { level: number; status: TrailingStopStatus; distance: number } {
  const level = calculateTrailingStopLevel(hwm, trailingStopPercent);
  const distance = currentNAV - level;
  const distancePercent = hwm > 0 ? (distance / hwm) * 100 : 0;
  
  let status: TrailingStopStatus;
  if (currentNAV < level) {
    status = 'triggered';
  } else if (distancePercent < 5) {
    // 距离止盈线不到5%时警告
    status = 'warning';
  } else {
    status = 'normal';
  }
  
  return { level, status, distance };
}

/**
 * 计算连败天数
 * Property 11: 连败计数 = 从当前日期往前连续亏损的天数
 * Property 12: 如果最新一天盈利，连败重置为0
 */
export function calculateLosingStreak(dailyPnLHistory: DailyPnL[]): number {
  if (dailyPnLHistory.length === 0) {
    return 0;
  }
  
  // 按日期降序排序（最新的在前）
  const sorted = [...dailyPnLHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  // 如果最新一天盈利，连败为0
  if (sorted[0].pnl > 0) {
    return 0;
  }
  
  // 计算连续亏损天数
  let streak = 0;
  for (const day of sorted) {
    if (day.pnl < 0) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

/**
 * 计算连败状态
 * Property 13: 如果 streak >= 3，状态是 'warning' 或 'critical'；>= 5 是 'critical'
 */
export function calculateLosingStreakStatus(
  streak: number,
  thresholds: RiskThresholds
): LosingStreakStatus {
  if (streak >= thresholds.losingStreakCritical) {
    return 'critical';
  } else if (streak >= thresholds.losingStreakWarning) {
    return 'warning';
  }
  return 'normal';
}

/**
 * 计算综合风险评分
 * Property 14: 评分范围 [0, 100]，越低越安全
 */
export function calculateOverallRiskScore(metrics: {
  leverageStatus: LeverageStatus;
  monthlyDrawdownStatus: DrawdownStatus;
  trailingStopStatus: TrailingStopStatus;
  losingStreakStatus: LosingStreakStatus;
  currentLeverage: number;
  monthlyDrawdown: number;
  currentLosingStreak: number;
}): { score: number; status: OverallRiskStatus } {
  let score = 0;
  
  // 杠杆贡献 (0-30分)
  if (metrics.leverageStatus === 'critical') {
    score += 30;
  } else if (metrics.leverageStatus === 'warning') {
    score += 15;
  } else {
    // 正常情况下，杠杆越高分数越高
    score += Math.min(10, metrics.currentLeverage * 5);
  }
  
  // 月度回撤贡献 (0-30分)
  if (metrics.monthlyDrawdownStatus === 'critical') {
    score += 30;
  } else if (metrics.monthlyDrawdownStatus === 'warning') {
    score += 15;
  } else {
    // 正常情况下，回撤越大分数越高
    score += Math.min(10, Math.max(0, metrics.monthlyDrawdown));
  }
  
  // 移动止盈贡献 (0-25分)
  if (metrics.trailingStopStatus === 'triggered') {
    score += 25;
  } else if (metrics.trailingStopStatus === 'warning') {
    score += 12;
  }
  
  // 连败贡献 (0-15分)
  if (metrics.losingStreakStatus === 'critical') {
    score += 15;
  } else if (metrics.losingStreakStatus === 'warning') {
    score += 8;
  } else {
    score += Math.min(5, metrics.currentLosingStreak * 2);
  }
  
  // 确保分数在 [0, 100] 范围内
  score = Math.max(0, Math.min(100, score));
  
  // 确定整体状态
  let status: OverallRiskStatus;
  if (score >= 60) {
    status = 'danger';
  } else if (score >= 30) {
    status = 'caution';
  } else {
    status = 'safe';
  }
  
  return { score, status };
}

/**
 * 更新高水位线
 * Property 7: HWM 只能增加或保持不变
 */
export function updateHighWaterMark(currentHWM: number, currentNAV: number): number {
  return Math.max(currentHWM, currentNAV);
}

/**
 * 计算完整的风控指标
 */
export function calculateRiskMetrics(
  currentNAV: number,
  currentLeverage: number,
  monthStartNAV: number,
  highWaterMark: number,
  dailyPnLHistory: DailyPnL[],
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS
): RiskMetrics {
  // 判断是否在回撤期间（当前NAV低于HWM）
  const isInDrawdown = currentNAV < highWaterMark;
  
  // 计算各项指标
  const leverageResult = calculateLeverageStatus(currentLeverage, thresholds, isInDrawdown);
  const drawdownResult = calculateMonthlyDrawdown(monthStartNAV, currentNAV, thresholds);
  const trailingStopResult = calculateTrailingStopStatus(currentNAV, highWaterMark, thresholds.trailingStopPercent);
  const losingStreak = calculateLosingStreak(dailyPnLHistory);
  const losingStreakStatus = calculateLosingStreakStatus(losingStreak, thresholds);
  
  // 计算历史最大连败
  const maxHistoricalLosingStreak = calculateMaxHistoricalLosingStreak(dailyPnLHistory);
  
  // 计算综合评分
  const overallResult = calculateOverallRiskScore({
    leverageStatus: leverageResult.status,
    monthlyDrawdownStatus: drawdownResult.status,
    trailingStopStatus: trailingStopResult.status,
    losingStreakStatus,
    currentLeverage,
    monthlyDrawdown: drawdownResult.drawdown,
    currentLosingStreak: losingStreak,
  });
  
  return {
    currentLeverage,
    leverageStatus: leverageResult.status,
    leverageLimit: leverageResult.limit,
    
    monthlyDrawdown: drawdownResult.drawdown,
    monthlyDrawdownStatus: drawdownResult.status,
    monthStartNAV,
    distanceToMonthlyStopLoss: drawdownResult.distanceToStopLoss,
    
    highWaterMark,
    trailingStopLevel: trailingStopResult.level,
    distanceToTrailingStop: trailingStopResult.distance,
    trailingStopStatus: trailingStopResult.status,
    
    currentLosingStreak: losingStreak,
    losingStreakStatus,
    maxHistoricalLosingStreak,
    
    overallRiskScore: overallResult.score,
    overallStatus: overallResult.status,
  };
}

/**
 * 计算历史最大连败天数
 */
function calculateMaxHistoricalLosingStreak(dailyPnLHistory: DailyPnL[]): number {
  if (dailyPnLHistory.length === 0) {
    return 0;
  }
  
  // 按日期升序排序
  const sorted = [...dailyPnLHistory].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  let maxStreak = 0;
  let currentStreak = 0;
  
  for (const day of sorted) {
    if (day.pnl < 0) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  
  return maxStreak;
}

/**
 * 验证移动止盈百分比是否在有效范围内
 * Property 10: 10 <= trailingStopPercent <= 25
 */
export function validateTrailingStopPercent(percent: number): boolean {
  return percent >= 10 && percent <= 25;
}

/**
 * 获取风险等级颜色
 */
export function getRiskLevelColor(status: LeverageStatus | DrawdownStatus | LosingStreakStatus | OverallRiskStatus): string {
  switch (status) {
    case 'normal':
    case 'safe':
      return 'text-green-500';
    case 'warning':
    case 'caution':
      return 'text-yellow-500';
    case 'critical':
    case 'danger':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

/**
 * 获取移动止盈状态颜色
 */
export function getTrailingStopColor(status: TrailingStopStatus): string {
  switch (status) {
    case 'normal':
      return 'text-green-500';
    case 'warning':
      return 'text-yellow-500';
    case 'triggered':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}
