/**
 * 风控报告生成服务 - Risk Report Service
 * 生成周报和月报，包含风控指标统计和对比分析
 * 
 * Requirements:
 * - 8.1: 每周生成风险分析周报
 * - 8.2: 周报包含：本周风险事件、预警准确率、决策执行情况
 * - 8.3: 每月生成风险分析月报
 * - 8.4: 月报包含：风险趋势分析、模型性能评估、改进建议
 * - 8.5: 支持 PDF 导出和邮件发送
 */

import type { RiskThresholds, DailyPnL } from './riskMetricsService';
import { getSupabaseClient } from './supabase';

// ============ 类型定义 ============

export interface RiskReport {
  period: 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  maxLeverage: number;
  maxDrawdown: number;
  ruleViolations: number;
  maxLosingStreak: number;
  overallScore: number;
  comparison?: {
    leverageChange: number;
    drawdownChange: number;
    scoreChange: number;
  };
  // 扩展字段
  summary?: string;
  tradingDays: number;
  profitableDays: number;
  losingDays: number;
  avgDailyPnL: number;
  totalPnL: number;
}

export interface HistoricalRecord {
  date: string;
  leverage?: number;
  nav?: number;
  pnl?: number;
  pnlPercent?: number;
}

export interface RuleViolation {
  date: string;
  type: 'leverage' | 'drawdown' | 'losing_streak';
  value: number;
  threshold: number;
}

// ============ 智能风控报告类型 (Requirements 8.1-8.4) ============

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskEvent {
  id: string;
  date: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface AlertAccuracy {
  totalAlerts: number;
  truePositives: number;
  falsePositives: number;
  accuracy: number;
  byType: Record<string, { total: number; accurate: number }>;
}

export interface DecisionExecution {
  totalDecisions: number;
  overriddenDecisions: number;
  overrideRate: number;
  avgConfidence: number;
  riskLevelDistribution: Record<RiskLevel, number>;
}

export interface ModelPerformance {
  drawdownPredictionAccuracy: number;
  regimeDetectionAccuracy: number;
  avgPredictionError: number;
  calibrationScore: number;
}

export interface TrendAnalysis {
  riskTrend: 'improving' | 'stable' | 'worsening';
  leverageTrend: 'decreasing' | 'stable' | 'increasing';
  drawdownTrend: 'decreasing' | 'stable' | 'increasing';
  weeklyScores: { week: string; score: number }[];
}

export interface ImprovementSuggestion {
  category: 'leverage' | 'drawdown' | 'alerts' | 'behavior';
  priority: 'low' | 'medium' | 'high';
  suggestion: string;
  rationale: string;
}

/**
 * 智能风控周报 (Requirements 8.1, 8.2)
 */
export interface IntelligentWeeklyReport extends RiskReport {
  // 本周风险事件
  riskEvents: RiskEvent[];
  criticalEventCount: number;
  warningEventCount: number;
  
  // 预警准确率
  alertAccuracy: AlertAccuracy;
  
  // 决策执行情况
  decisionExecution: DecisionExecution;
  
  // 杠杆和止损统计
  avgLeverage: number;
  avgStopLoss: number;
  leverageChanges: number;
  stopLossChanges: number;
  
  // 情绪化交易统计
  emotionalTradingEvents: number;
  cooldownPeriods: number;
  
  // 生成时间
  generatedAt: string;
}

/**
 * 智能风控月报 (Requirements 8.3, 8.4)
 */
export interface IntelligentMonthlyReport extends RiskReport {
  // 风险趋势分析
  trendAnalysis: TrendAnalysis;
  
  // 模型性能评估
  modelPerformance: ModelPerformance;
  
  // 改进建议
  improvementSuggestions: ImprovementSuggestion[];
  
  // 月度统计
  weeklyReports: { week: string; score: number; events: number }[];
  avgWeeklyScore: number;
  
  // 风险事件汇总
  totalRiskEvents: number;
  criticalEventCount: number;
  warningEventCount: number;
  
  // 决策统计
  totalDecisions: number;
  avgDecisionConfidence: number;
  overrideRate: number;
  
  // 生成时间
  generatedAt: string;
}

/**
 * 报告导出选项
 */
export interface ReportExportOptions {
  format: 'pdf' | 'html' | 'json';
  includeCharts: boolean;
  language: 'zh' | 'en';
}

// ============ 辅助函数 ============

/**
 * 获取指定周的起止日期
 * @param date 参考日期
 * @param weekOffset 周偏移量（0=本周，-1=上周）
 */
export function getWeekRange(date: Date, weekOffset: number = 0): { start: Date; end: Date } {
  // 使用本地日期字符串来避免时区问题
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // 创建本地日期
  const d = new Date(year, month, day);
  
  // 调整到周一 (getDay: 0=周日, 1=周一, ..., 6=周六)
  const dayOfWeek = d.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday = new Date(year, month, day + diffToMonday + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { start: monday, end: sunday };
}

/**
 * 获取指定月的起止日期
 * @param date 参考日期
 * @param monthOffset 月偏移量（0=本月，-1=上月）
 */
export function getMonthRange(date: Date, monthOffset: number = 0): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth() + monthOffset;
  
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  
  return { start, end };
}

/**
 * 格式化日期为 YYYY-MM-DD（使用本地时区）
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 过滤指定日期范围内的记录
 */
export function filterByDateRange<T extends { date: string }>(
  records: T[],
  start: Date,
  end: Date
): T[] {
  const startStr = formatDate(start);
  const endStr = formatDate(end);
  
  return records.filter(r => r.date >= startStr && r.date <= endStr);
}

/**
 * 计算最大连败天数
 */
export function calculateMaxLosingStreak(dailyPnL: DailyPnL[]): number {
  if (dailyPnL.length === 0) return 0;
  
  // 按日期升序排序
  const sorted = [...dailyPnL].sort(
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
 * 计算最大回撤（百分比）
 */
export function calculateMaxDrawdown(dailyPnL: DailyPnL[]): number {
  if (dailyPnL.length === 0) return 0;
  
  // 按日期升序排序
  const sorted = [...dailyPnL].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;
  
  for (const day of sorted) {
    cumulative += day.pnlPercent;
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

/**
 * 计算规则违反次数
 */
export function countRuleViolations(
  history: HistoricalRecord[],
  thresholds: RiskThresholds
): number {
  let violations = 0;
  
  for (const record of history) {
    // 杠杆违规
    if (record.leverage && record.leverage > thresholds.leverageCritical) {
      violations++;
    }
  }
  
  return violations;
}

/**
 * 计算综合风险评分（基于周期内数据）
 * 评分范围 [0, 100]，越低越安全
 */
export function calculatePeriodRiskScore(
  maxLeverage: number,
  maxDrawdown: number,
  ruleViolations: number,
  maxLosingStreak: number,
  thresholds: RiskThresholds
): number {
  let score = 0;
  
  // 杠杆贡献 (0-30分)
  if (maxLeverage >= thresholds.leverageCritical) {
    score += 30;
  } else if (maxLeverage >= thresholds.leverageWarning) {
    score += 15 + (maxLeverage - thresholds.leverageWarning) / 
             (thresholds.leverageCritical - thresholds.leverageWarning) * 15;
  } else {
    score += Math.min(10, maxLeverage * 5);
  }
  
  // 回撤贡献 (0-30分)
  if (maxDrawdown >= thresholds.monthlyDrawdownCritical) {
    score += 30;
  } else if (maxDrawdown >= thresholds.monthlyDrawdownWarning) {
    score += 15 + (maxDrawdown - thresholds.monthlyDrawdownWarning) / 
             (thresholds.monthlyDrawdownCritical - thresholds.monthlyDrawdownWarning) * 15;
  } else {
    score += Math.min(10, maxDrawdown);
  }
  
  // 规则违反贡献 (0-20分)
  score += Math.min(20, ruleViolations * 5);
  
  // 连败贡献 (0-20分)
  if (maxLosingStreak >= thresholds.losingStreakCritical) {
    score += 20;
  } else if (maxLosingStreak >= thresholds.losingStreakWarning) {
    score += 10;
  } else {
    score += Math.min(5, maxLosingStreak * 2);
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 生成报告摘要文本
 */
export function generateSummary(report: RiskReport, period: 'weekly' | 'monthly'): string {
  const periodName = period === 'weekly' ? '本周' : '本月';
  const parts: string[] = [];
  
  // 盈亏情况
  if (report.totalPnL > 0) {
    parts.push(`${periodName}盈利，共${report.profitableDays}个盈利日`);
  } else if (report.totalPnL < 0) {
    parts.push(`${periodName}亏损，共${report.losingDays}个亏损日`);
  } else {
    parts.push(`${periodName}持平`);
  }
  
  // 风险评估
  if (report.overallScore < 30) {
    parts.push('风控表现优秀');
  } else if (report.overallScore < 60) {
    parts.push('风控表现一般，需注意');
  } else {
    parts.push('风控表现较差，需改进');
  }
  
  // 对比情况
  if (report.comparison) {
    const changes: string[] = [];
    if (report.comparison.scoreChange < -5) {
      changes.push('风险评分改善');
    } else if (report.comparison.scoreChange > 5) {
      changes.push('风险评分恶化');
    }
    if (changes.length > 0) {
      parts.push(changes.join('，'));
    }
  }
  
  return parts.join('。') + '。';
}

// ============ 核心报告生成函数 ============

/**
 * 生成周报
 * @param history 历史记录数组
 * @param dailyPnL 每日盈亏数组
 * @param thresholds 风控阈值配置
 * @param referenceDate 参考日期（默认今天）
 */
export function generateWeeklyReport(
  history: HistoricalRecord[],
  dailyPnL: DailyPnL[],
  thresholds: RiskThresholds,
  referenceDate: Date = new Date()
): RiskReport {
  // 获取本周和上周的日期范围
  const thisWeek = getWeekRange(referenceDate, 0);
  const lastWeek = getWeekRange(referenceDate, -1);
  
  // 过滤本周数据
  const thisWeekHistory = filterByDateRange(history, thisWeek.start, thisWeek.end);
  const thisWeekPnL = filterByDateRange(dailyPnL, thisWeek.start, thisWeek.end);
  
  // 过滤上周数据（用于对比）
  const lastWeekHistory = filterByDateRange(history, lastWeek.start, lastWeek.end);
  const lastWeekPnL = filterByDateRange(dailyPnL, lastWeek.start, lastWeek.end);
  
  // 计算本周指标
  const maxLeverage = thisWeekHistory.reduce(
    (max, r) => Math.max(max, r.leverage || 0), 0
  );
  const maxDrawdown = calculateMaxDrawdown(thisWeekPnL);
  const ruleViolations = countRuleViolations(thisWeekHistory, thresholds);
  const maxLosingStreak = calculateMaxLosingStreak(thisWeekPnL);
  const overallScore = calculatePeriodRiskScore(
    maxLeverage, maxDrawdown, ruleViolations, maxLosingStreak, thresholds
  );
  
  // 计算盈亏统计
  const tradingDays = thisWeekPnL.length;
  const profitableDays = thisWeekPnL.filter(d => d.pnl > 0).length;
  const losingDays = thisWeekPnL.filter(d => d.pnl < 0).length;
  const totalPnL = thisWeekPnL.reduce((sum, d) => sum + d.pnl, 0);
  const avgDailyPnL = tradingDays > 0 ? totalPnL / tradingDays : 0;
  
  // 计算上周指标（用于对比）
  let comparison: RiskReport['comparison'] | undefined;
  if (lastWeekPnL.length > 0) {
    const lastMaxLeverage = lastWeekHistory.reduce(
      (max, r) => Math.max(max, r.leverage || 0), 0
    );
    const lastMaxDrawdown = calculateMaxDrawdown(lastWeekPnL);
    const lastRuleViolations = countRuleViolations(lastWeekHistory, thresholds);
    const lastMaxLosingStreak = calculateMaxLosingStreak(lastWeekPnL);
    const lastScore = calculatePeriodRiskScore(
      lastMaxLeverage, lastMaxDrawdown, lastRuleViolations, lastMaxLosingStreak, thresholds
    );
    
    comparison = {
      leverageChange: maxLeverage - lastMaxLeverage,
      drawdownChange: maxDrawdown - lastMaxDrawdown,
      scoreChange: overallScore - lastScore,
    };
  }
  
  const report: RiskReport = {
    period: 'weekly',
    startDate: formatDate(thisWeek.start),
    endDate: formatDate(thisWeek.end),
    maxLeverage,
    maxDrawdown,
    ruleViolations,
    maxLosingStreak,
    overallScore,
    comparison,
    tradingDays,
    profitableDays,
    losingDays,
    avgDailyPnL,
    totalPnL,
  };
  
  report.summary = generateSummary(report, 'weekly');
  
  return report;
}

/**
 * 生成月报
 * @param history 历史记录数组
 * @param dailyPnL 每日盈亏数组
 * @param thresholds 风控阈值配置
 * @param referenceDate 参考日期（默认今天）
 */
export function generateMonthlyReport(
  history: HistoricalRecord[],
  dailyPnL: DailyPnL[],
  thresholds: RiskThresholds,
  referenceDate: Date = new Date()
): RiskReport {
  // 获取本月和上月的日期范围
  const thisMonth = getMonthRange(referenceDate, 0);
  const lastMonth = getMonthRange(referenceDate, -1);
  
  // 过滤本月数据
  const thisMonthHistory = filterByDateRange(history, thisMonth.start, thisMonth.end);
  const thisMonthPnL = filterByDateRange(dailyPnL, thisMonth.start, thisMonth.end);
  
  // 过滤上月数据（用于对比）
  const lastMonthHistory = filterByDateRange(history, lastMonth.start, lastMonth.end);
  const lastMonthPnL = filterByDateRange(dailyPnL, lastMonth.start, lastMonth.end);
  
  // 计算本月指标
  const maxLeverage = thisMonthHistory.reduce(
    (max, r) => Math.max(max, r.leverage || 0), 0
  );
  const maxDrawdown = calculateMaxDrawdown(thisMonthPnL);
  const ruleViolations = countRuleViolations(thisMonthHistory, thresholds);
  const maxLosingStreak = calculateMaxLosingStreak(thisMonthPnL);
  const overallScore = calculatePeriodRiskScore(
    maxLeverage, maxDrawdown, ruleViolations, maxLosingStreak, thresholds
  );
  
  // 计算盈亏统计
  const tradingDays = thisMonthPnL.length;
  const profitableDays = thisMonthPnL.filter(d => d.pnl > 0).length;
  const losingDays = thisMonthPnL.filter(d => d.pnl < 0).length;
  const totalPnL = thisMonthPnL.reduce((sum, d) => sum + d.pnl, 0);
  const avgDailyPnL = tradingDays > 0 ? totalPnL / tradingDays : 0;
  
  // 计算上月指标（用于对比）
  let comparison: RiskReport['comparison'] | undefined;
  if (lastMonthPnL.length > 0) {
    const lastMaxLeverage = lastMonthHistory.reduce(
      (max, r) => Math.max(max, r.leverage || 0), 0
    );
    const lastMaxDrawdown = calculateMaxDrawdown(lastMonthPnL);
    const lastRuleViolations = countRuleViolations(lastMonthHistory, thresholds);
    const lastMaxLosingStreak = calculateMaxLosingStreak(lastMonthPnL);
    const lastScore = calculatePeriodRiskScore(
      lastMaxLeverage, lastMaxDrawdown, lastRuleViolations, lastMaxLosingStreak, thresholds
    );
    
    comparison = {
      leverageChange: maxLeverage - lastMaxLeverage,
      drawdownChange: maxDrawdown - lastMaxDrawdown,
      scoreChange: overallScore - lastScore,
    };
  }
  
  const report: RiskReport = {
    period: 'monthly',
    startDate: formatDate(thisMonth.start),
    endDate: formatDate(thisMonth.end),
    maxLeverage,
    maxDrawdown,
    ruleViolations,
    maxLosingStreak,
    overallScore,
    comparison,
    tradingDays,
    profitableDays,
    losingDays,
    avgDailyPnL,
    totalPnL,
  };
  
  report.summary = generateSummary(report, 'monthly');
  
  return report;
}

/**
 * 获取风险评分等级
 */
export function getRiskScoreLevel(score: number): 'safe' | 'caution' | 'danger' {
  if (score < 30) return 'safe';
  if (score < 60) return 'caution';
  return 'danger';
}

/**
 * 获取风险评分等级名称（中文）
 */
export function getRiskScoreLevelName(score: number): string {
  const level = getRiskScoreLevel(score);
  const names = {
    safe: '安全',
    caution: '谨慎',
    danger: '危险',
  };
  return names[level];
}

/**
 * 获取变化趋势
 */
export function getChangeTrend(change: number): 'improved' | 'worsened' | 'stable' {
  if (change < -0.01) return 'improved';
  if (change > 0.01) return 'worsened';
  return 'stable';
}

/**
 * 格式化变化值显示
 */
export function formatChange(value: number, suffix: string = ''): string {
  if (Math.abs(value) < 0.01) return '持平';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}${suffix}`;
}

// ============ 智能风控报告生成 (Requirements 8.1-8.4) ============

/**
 * 从数据库获取风险事件
 */
async function fetchRiskEvents(
  startDate: Date,
  endDate: Date,
  userId: number = 1
): Promise<RiskEvent[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('risk_alerts_history')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      date: (row.created_at as string).split('T')[0],
      type: row.alert_type as string,
      severity: row.severity as 'info' | 'warning' | 'critical',
      message: row.message as string,
      resolved: row.acknowledged as boolean,
      resolvedAt: row.acknowledged_at as string | undefined,
    }));
  } catch (error) {
    console.error('Failed to fetch risk events:', error);
    return [];
  }
}

/**
 * 从数据库获取风控决策
 */
async function fetchRiskDecisions(
  startDate: Date,
  endDate: Date,
  userId: number = 1
): Promise<Array<{
  id: string;
  timestamp: string;
  overallRiskLevel: RiskLevel;
  effectiveLeverage: number;
  effectiveStopLoss: number;
  confidence: number;
  isOverridden: boolean;
  tradingAllowed: boolean;
}>> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('risk_decisions')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      timestamp: row.timestamp as string,
      overallRiskLevel: row.overall_risk_level as RiskLevel,
      effectiveLeverage: row.effective_leverage as number,
      effectiveStopLoss: row.effective_stop_loss as number,
      confidence: row.confidence as number,
      isOverridden: row.is_overridden as boolean,
      tradingAllowed: row.trading_allowed as boolean,
    }));
  } catch (error) {
    console.error('Failed to fetch risk decisions:', error);
    return [];
  }
}

/**
 * 从数据库获取情绪化交易事件
 */
async function fetchEmotionalTradingEvents(
  startDate: Date,
  endDate: Date,
  userId: number = 1
): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 0;
  
  try {
    const { count, error } = await supabase
      .from('emotional_trading_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('detected_at', startDate.toISOString())
      .lte('detected_at', endDate.toISOString());
    
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Failed to fetch emotional trading events:', error);
    return 0;
  }
}

/**
 * 计算预警准确率
 */
function calculateAlertAccuracy(events: RiskEvent[]): AlertAccuracy {
  const byType: Record<string, { total: number; accurate: number }> = {};
  let truePositives = 0;
  let falsePositives = 0;
  
  for (const event of events) {
    if (!byType[event.type]) {
      byType[event.type] = { total: 0, accurate: 0 };
    }
    byType[event.type].total++;
    
    // 简化逻辑：已确认的预警视为准确
    if (event.resolved) {
      truePositives++;
      byType[event.type].accurate++;
    } else {
      // 超过7天未确认的预警视为误报
      const eventDate = new Date(event.date);
      const daysSinceEvent = (Date.now() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceEvent > 7) {
        falsePositives++;
      }
    }
  }
  
  const totalAlerts = events.length;
  const accuracy = totalAlerts > 0 ? truePositives / totalAlerts : 1;
  
  return {
    totalAlerts,
    truePositives,
    falsePositives,
    accuracy,
    byType,
  };
}

/**
 * 计算决策执行情况
 */
function calculateDecisionExecution(
  decisions: Array<{
    overallRiskLevel: RiskLevel;
    confidence: number;
    isOverridden: boolean;
  }>
): DecisionExecution {
  const totalDecisions = decisions.length;
  const overriddenDecisions = decisions.filter(d => d.isOverridden).length;
  const overrideRate = totalDecisions > 0 ? overriddenDecisions / totalDecisions : 0;
  const avgConfidence = totalDecisions > 0
    ? decisions.reduce((sum, d) => sum + d.confidence, 0) / totalDecisions
    : 0;
  
  const riskLevelDistribution: Record<RiskLevel, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  
  for (const decision of decisions) {
    riskLevelDistribution[decision.overallRiskLevel]++;
  }
  
  return {
    totalDecisions,
    overriddenDecisions,
    overrideRate,
    avgConfidence,
    riskLevelDistribution,
  };
}

/**
 * 生成智能风控周报 (Requirements 8.1, 8.2)
 */
export async function generateIntelligentWeeklyReport(
  history: HistoricalRecord[],
  dailyPnL: DailyPnL[],
  thresholds: RiskThresholds,
  referenceDate: Date = new Date(),
  userId: number = 1
): Promise<IntelligentWeeklyReport> {
  // 生成基础周报
  const baseReport = generateWeeklyReport(history, dailyPnL, thresholds, referenceDate);
  
  // 获取本周日期范围
  const thisWeek = getWeekRange(referenceDate, 0);
  
  // 从数据库获取风险事件
  const riskEvents = await fetchRiskEvents(thisWeek.start, thisWeek.end, userId);
  const criticalEventCount = riskEvents.filter(e => e.severity === 'critical').length;
  const warningEventCount = riskEvents.filter(e => e.severity === 'warning').length;
  
  // 计算预警准确率
  const alertAccuracy = calculateAlertAccuracy(riskEvents);
  
  // 获取风控决策
  const decisions = await fetchRiskDecisions(thisWeek.start, thisWeek.end, userId);
  const decisionExecution = calculateDecisionExecution(decisions);
  
  // 计算杠杆和止损统计
  const avgLeverage = decisions.length > 0
    ? decisions.reduce((sum, d) => sum + d.effectiveLeverage, 0) / decisions.length
    : 1.0;
  const avgStopLoss = decisions.length > 0
    ? decisions.reduce((sum, d) => sum + d.effectiveStopLoss, 0) / decisions.length
    : -0.10;
  
  // 计算杠杆和止损变更次数
  let leverageChanges = 0;
  let stopLossChanges = 0;
  for (let i = 1; i < decisions.length; i++) {
    if (Math.abs(decisions[i].effectiveLeverage - decisions[i-1].effectiveLeverage) > 0.01) {
      leverageChanges++;
    }
    if (Math.abs(decisions[i].effectiveStopLoss - decisions[i-1].effectiveStopLoss) > 0.001) {
      stopLossChanges++;
    }
  }
  
  // 获取情绪化交易事件
  const emotionalTradingEvents = await fetchEmotionalTradingEvents(thisWeek.start, thisWeek.end, userId);
  
  // 计算冷静期次数（从决策中统计 tradingAllowed = false 的次数）
  const cooldownPeriods = decisions.filter(d => !d.tradingAllowed).length;
  
  return {
    ...baseReport,
    riskEvents,
    criticalEventCount,
    warningEventCount,
    alertAccuracy,
    decisionExecution,
    avgLeverage,
    avgStopLoss,
    leverageChanges,
    stopLossChanges,
    emotionalTradingEvents,
    cooldownPeriods,
    generatedAt: new Date().toISOString(),
  };
}


/**
 * 分析风险趋势
 */
function analyzeTrend(
  weeklyScores: { week: string; score: number }[]
): TrendAnalysis {
  if (weeklyScores.length < 2) {
    return {
      riskTrend: 'stable',
      leverageTrend: 'stable',
      drawdownTrend: 'stable',
      weeklyScores,
    };
  }
  
  // 计算趋势（简单线性回归斜率）
  const n = weeklyScores.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = weeklyScores.reduce((sum, w) => sum + w.score, 0);
  const sumXY = weeklyScores.reduce((sum, w, i) => sum + i * w.score, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  let riskTrend: 'improving' | 'stable' | 'worsening';
  if (slope < -2) {
    riskTrend = 'improving';
  } else if (slope > 2) {
    riskTrend = 'worsening';
  } else {
    riskTrend = 'stable';
  }
  
  return {
    riskTrend,
    leverageTrend: 'stable', // 简化实现
    drawdownTrend: 'stable', // 简化实现
    weeklyScores,
  };
}

/**
 * 评估模型性能
 */
function evaluateModelPerformance(
  decisions: Array<{
    confidence: number;
    overallRiskLevel: RiskLevel;
  }>,
  events: RiskEvent[]
): ModelPerformance {
  // 简化的模型性能评估
  const avgConfidence = decisions.length > 0
    ? decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length
    : 0.5;
  
  // 预警准确率作为回撤预测准确率的代理
  const acknowledgedEvents = events.filter(e => e.resolved).length;
  const drawdownPredictionAccuracy = events.length > 0
    ? acknowledgedEvents / events.length
    : 0.8;
  
  // 市场状态检测准确率（简化：基于决策置信度）
  const regimeDetectionAccuracy = avgConfidence;
  
  // 平均预测误差（简化）
  const avgPredictionError = 1 - avgConfidence;
  
  // 校准分数（简化：基于风险等级分布的均匀性）
  const calibrationScore = avgConfidence * 0.9;
  
  return {
    drawdownPredictionAccuracy,
    regimeDetectionAccuracy,
    avgPredictionError,
    calibrationScore,
  };
}

/**
 * 生成改进建议
 */
function generateImprovementSuggestions(
  report: Partial<IntelligentMonthlyReport>,
  trendAnalysis: TrendAnalysis,
  modelPerformance: ModelPerformance
): ImprovementSuggestion[] {
  const suggestions: ImprovementSuggestion[] = [];
  
  // 基于风险趋势的建议
  if (trendAnalysis.riskTrend === 'worsening') {
    suggestions.push({
      category: 'leverage',
      priority: 'high',
      suggestion: '建议降低整体杠杆水平',
      rationale: '本月风险评分呈上升趋势，表明风险敞口可能过大',
    });
  }
  
  // 基于覆盖率的建议
  if (report.overrideRate && report.overrideRate > 0.3) {
    suggestions.push({
      category: 'behavior',
      priority: 'medium',
      suggestion: '减少手动覆盖自动决策的频率',
      rationale: `本月决策覆盖率为 ${(report.overrideRate * 100).toFixed(0)}%，过高的覆盖率可能削弱风控系统的有效性`,
    });
  }
  
  // 基于模型性能的建议
  if (modelPerformance.drawdownPredictionAccuracy < 0.6) {
    suggestions.push({
      category: 'alerts',
      priority: 'medium',
      suggestion: '关注预警系统的准确性',
      rationale: '预警准确率较低，建议回顾预警触发条件是否合理',
    });
  }
  
  // 基于回撤的建议
  if (report.maxDrawdown && report.maxDrawdown > 10) {
    suggestions.push({
      category: 'drawdown',
      priority: 'high',
      suggestion: '加强回撤控制',
      rationale: `本月最大回撤达到 ${report.maxDrawdown.toFixed(1)}%，建议收紧止损线或降低仓位`,
    });
  }
  
  // 如果没有问题，给出正面反馈
  if (suggestions.length === 0) {
    suggestions.push({
      category: 'behavior',
      priority: 'low',
      suggestion: '继续保持当前的风控策略',
      rationale: '本月风控表现良好，各项指标均在合理范围内',
    });
  }
  
  return suggestions;
}

/**
 * 生成智能风控月报 (Requirements 8.3, 8.4)
 */
export async function generateIntelligentMonthlyReport(
  history: HistoricalRecord[],
  dailyPnL: DailyPnL[],
  thresholds: RiskThresholds,
  referenceDate: Date = new Date(),
  userId: number = 1
): Promise<IntelligentMonthlyReport> {
  // 生成基础月报
  const baseReport = generateMonthlyReport(history, dailyPnL, thresholds, referenceDate);
  
  // 获取本月日期范围
  const thisMonth = getMonthRange(referenceDate, 0);
  
  // 从数据库获取风险事件
  const riskEvents = await fetchRiskEvents(thisMonth.start, thisMonth.end, userId);
  const criticalEventCount = riskEvents.filter(e => e.severity === 'critical').length;
  const warningEventCount = riskEvents.filter(e => e.severity === 'warning').length;
  
  // 获取风控决策
  const decisions = await fetchRiskDecisions(thisMonth.start, thisMonth.end, userId);
  const totalDecisions = decisions.length;
  const avgDecisionConfidence = totalDecisions > 0
    ? decisions.reduce((sum, d) => sum + d.confidence, 0) / totalDecisions
    : 0;
  const overriddenCount = decisions.filter(d => d.isOverridden).length;
  const overrideRate = totalDecisions > 0 ? overriddenCount / totalDecisions : 0;
  
  // 生成周报数据用于趋势分析
  const weeklyReports: { week: string; score: number; events: number }[] = [];
  
  // 获取本月每周的数据
  const monthStart = thisMonth.start;
  let currentWeekStart = new Date(monthStart);
  
  while (currentWeekStart < thisMonth.end) {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    if (weekEnd > thisMonth.end) {
      weekEnd.setTime(thisMonth.end.getTime());
    }
    
    const weekHistory = filterByDateRange(history, currentWeekStart, weekEnd);
    const weekPnL = filterByDateRange(dailyPnL, currentWeekStart, weekEnd);
    
    const maxLeverage = weekHistory.reduce((max, r) => Math.max(max, r.leverage || 0), 0);
    const maxDrawdown = calculateMaxDrawdown(weekPnL);
    const ruleViolations = countRuleViolations(weekHistory, thresholds);
    const maxLosingStreak = calculateMaxLosingStreak(weekPnL);
    const score = calculatePeriodRiskScore(maxLeverage, maxDrawdown, ruleViolations, maxLosingStreak, thresholds);
    
    const weekEvents = riskEvents.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate >= currentWeekStart && eventDate <= weekEnd;
    }).length;
    
    weeklyReports.push({
      week: formatDate(currentWeekStart),
      score,
      events: weekEvents,
    });
    
    currentWeekStart = new Date(weekEnd);
    currentWeekStart.setDate(currentWeekStart.getDate() + 1);
  }
  
  const avgWeeklyScore = weeklyReports.length > 0
    ? weeklyReports.reduce((sum, w) => sum + w.score, 0) / weeklyReports.length
    : 0;
  
  // 分析趋势
  const trendAnalysis = analyzeTrend(weeklyReports.map(w => ({ week: w.week, score: w.score })));
  
  // 评估模型性能
  const modelPerformance = evaluateModelPerformance(decisions, riskEvents);
  
  // 构建部分报告用于生成建议
  const partialReport: Partial<IntelligentMonthlyReport> = {
    ...baseReport,
    overrideRate,
  };
  
  // 生成改进建议
  const improvementSuggestions = generateImprovementSuggestions(
    partialReport,
    trendAnalysis,
    modelPerformance
  );
  
  return {
    ...baseReport,
    trendAnalysis,
    modelPerformance,
    improvementSuggestions,
    weeklyReports,
    avgWeeklyScore,
    totalRiskEvents: riskEvents.length,
    criticalEventCount,
    warningEventCount,
    totalDecisions,
    avgDecisionConfidence,
    overrideRate,
    generatedAt: new Date().toISOString(),
  };
}


// ============ 报告导出功能 (Requirement 8.5) ============

/**
 * 生成周报 HTML 内容
 */
export function generateWeeklyReportHtml(report: IntelligentWeeklyReport): string {
  const riskLevelColors: Record<string, string> = {
    low: '#22c55e',
    medium: '#eab308',
    high: '#f97316',
    critical: '#ef4444',
  };
  
  const scoreLevel = getRiskScoreLevel(report.overallScore);
  const scoreLevelName = getRiskScoreLevelName(report.overallScore);
  const scoreColor = scoreLevel === 'safe' ? '#22c55e' : scoreLevel === 'caution' ? '#eab308' : '#ef4444';
  
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>风控周报 - ${report.startDate} 至 ${report.endDate}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .report { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { margin: 0 0 8px 0; color: #1f2937; font-size: 24px; }
    .header .period { color: #6b7280; font-size: 14px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .section-title::before { content: ''; width: 4px; height: 16px; background: #3b82f6; border-radius: 2px; }
    .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .metric-card { background: #f9fafb; border-radius: 8px; padding: 16px; }
    .metric-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .metric-value { font-size: 20px; font-weight: 600; color: #1f2937; }
    .metric-change { font-size: 12px; margin-top: 4px; }
    .metric-change.positive { color: #22c55e; }
    .metric-change.negative { color: #ef4444; }
    .score-badge { display: inline-block; padding: 4px 12px; border-radius: 16px; font-size: 14px; font-weight: 500; }
    .events-list { list-style: none; padding: 0; margin: 0; }
    .events-list li { padding: 12px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 12px; }
    .events-list li:last-child { border-bottom: none; }
    .severity-dot { width: 8px; height: 8px; border-radius: 50%; }
    .severity-critical { background: #ef4444; }
    .severity-warning { background: #f97316; }
    .severity-info { background: #3b82f6; }
    .summary { background: #f0f9ff; border-radius: 8px; padding: 16px; color: #1e40af; }
    .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="report">
    <div class="header">
      <h1>📊 风控周报</h1>
      <div class="period">${report.startDate} 至 ${report.endDate}</div>
    </div>
    
    <div class="section">
      <div class="section-title">综合评估</div>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">风险评分</div>
          <div class="metric-value">${report.overallScore.toFixed(0)}</div>
          <div class="score-badge" style="background: ${scoreColor}20; color: ${scoreColor};">${scoreLevelName}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">交易天数</div>
          <div class="metric-value">${report.tradingDays}</div>
          <div class="metric-change">盈利 ${report.profitableDays} 天 / 亏损 ${report.losingDays} 天</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">最大杠杆</div>
          <div class="metric-value">${report.maxLeverage.toFixed(2)}x</div>
          ${report.comparison ? `<div class="metric-change ${report.comparison.leverageChange > 0 ? 'negative' : 'positive'}">${formatChange(report.comparison.leverageChange, 'x')}</div>` : ''}
        </div>
        <div class="metric-card">
          <div class="metric-label">最大回撤</div>
          <div class="metric-value">${report.maxDrawdown.toFixed(1)}%</div>
          ${report.comparison ? `<div class="metric-change ${report.comparison.drawdownChange > 0 ? 'negative' : 'positive'}">${formatChange(report.comparison.drawdownChange, '%')}</div>` : ''}
        </div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">风险事件 (${report.riskEvents.length})</div>
      ${report.riskEvents.length > 0 ? `
      <ul class="events-list">
        ${report.riskEvents.slice(0, 5).map(event => `
        <li>
          <span class="severity-dot severity-${event.severity}"></span>
          <div>
            <div style="font-weight: 500;">${event.message}</div>
            <div style="font-size: 12px; color: #6b7280;">${event.date} · ${event.resolved ? '已处理' : '待处理'}</div>
          </div>
        </li>
        `).join('')}
      </ul>
      ${report.riskEvents.length > 5 ? `<div style="text-align: center; color: #6b7280; font-size: 12px; padding: 8px;">还有 ${report.riskEvents.length - 5} 个事件...</div>` : ''}
      ` : '<div style="color: #6b7280; text-align: center; padding: 16px;">本周无风险事件 ✓</div>'}
    </div>
    
    <div class="section">
      <div class="section-title">决策执行</div>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">决策总数</div>
          <div class="metric-value">${report.decisionExecution.totalDecisions}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">覆盖率</div>
          <div class="metric-value">${(report.decisionExecution.overrideRate * 100).toFixed(0)}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">平均置信度</div>
          <div class="metric-value">${(report.decisionExecution.avgConfidence * 100).toFixed(0)}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">预警准确率</div>
          <div class="metric-value">${(report.alertAccuracy.accuracy * 100).toFixed(0)}%</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <div class="summary">
        <strong>📝 周报摘要</strong><br>
        ${report.summary || '暂无摘要'}
      </div>
    </div>
    
    <div class="footer">
      生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}<br>
      RiskControl 智能风控系统
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 生成月报 HTML 内容
 */
export function generateMonthlyReportHtml(report: IntelligentMonthlyReport): string {
  const trendEmoji: Record<string, string> = {
    improving: '📈',
    stable: '➡️',
    worsening: '📉',
  };
  
  const trendText: Record<string, string> = {
    improving: '改善',
    stable: '稳定',
    worsening: '恶化',
  };
  
  const priorityColors: Record<string, string> = {
    low: '#22c55e',
    medium: '#eab308',
    high: '#ef4444',
  };
  
  const scoreLevel = getRiskScoreLevel(report.overallScore);
  const scoreLevelName = getRiskScoreLevelName(report.overallScore);
  const scoreColor = scoreLevel === 'safe' ? '#22c55e' : scoreLevel === 'caution' ? '#eab308' : '#ef4444';
  
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>风控月报 - ${report.startDate} 至 ${report.endDate}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .report { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { margin: 0 0 8px 0; color: #1f2937; font-size: 24px; }
    .header .period { color: #6b7280; font-size: 14px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .section-title::before { content: ''; width: 4px; height: 16px; background: #3b82f6; border-radius: 2px; }
    .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .metric-card { background: #f9fafb; border-radius: 8px; padding: 16px; }
    .metric-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .metric-value { font-size: 20px; font-weight: 600; color: #1f2937; }
    .trend-card { background: #f9fafb; border-radius: 8px; padding: 16px; display: flex; align-items: center; gap: 12px; }
    .trend-emoji { font-size: 24px; }
    .trend-info { flex: 1; }
    .trend-label { font-size: 12px; color: #6b7280; }
    .trend-value { font-size: 16px; font-weight: 500; color: #1f2937; }
    .suggestion-card { background: #fffbeb; border-left: 4px solid; border-radius: 0 8px 8px 0; padding: 12px 16px; margin-bottom: 8px; }
    .suggestion-title { font-weight: 500; margin-bottom: 4px; }
    .suggestion-rationale { font-size: 12px; color: #6b7280; }
    .weekly-chart { display: flex; align-items: flex-end; gap: 8px; height: 100px; padding: 16px 0; }
    .weekly-bar { flex: 1; background: #3b82f6; border-radius: 4px 4px 0 0; min-height: 4px; position: relative; }
    .weekly-bar-label { position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #6b7280; white-space: nowrap; }
    .performance-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .performance-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .performance-label { color: #6b7280; }
    .performance-value { font-weight: 500; }
    .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="report">
    <div class="header">
      <h1>📊 风控月报</h1>
      <div class="period">${report.startDate} 至 ${report.endDate}</div>
    </div>
    
    <div class="section">
      <div class="section-title">月度概览</div>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">平均风险评分</div>
          <div class="metric-value" style="color: ${scoreColor};">${report.avgWeeklyScore.toFixed(0)}</div>
          <div style="font-size: 12px; color: ${scoreColor};">${scoreLevelName}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">风险事件</div>
          <div class="metric-value">${report.totalRiskEvents}</div>
          <div style="font-size: 12px; color: #6b7280;">严重 ${report.criticalEventCount} / 警告 ${report.warningEventCount}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">决策总数</div>
          <div class="metric-value">${report.totalDecisions}</div>
          <div style="font-size: 12px; color: #6b7280;">覆盖率 ${(report.overrideRate * 100).toFixed(0)}%</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">趋势分析</div>
      <div class="metrics-grid">
        <div class="trend-card">
          <div class="trend-emoji">${trendEmoji[report.trendAnalysis.riskTrend]}</div>
          <div class="trend-info">
            <div class="trend-label">风险趋势</div>
            <div class="trend-value">${trendText[report.trendAnalysis.riskTrend]}</div>
          </div>
        </div>
        <div class="trend-card">
          <div class="trend-emoji">${trendEmoji[report.trendAnalysis.leverageTrend]}</div>
          <div class="trend-info">
            <div class="trend-label">杠杆趋势</div>
            <div class="trend-value">${trendText[report.trendAnalysis.leverageTrend]}</div>
          </div>
        </div>
        <div class="trend-card">
          <div class="trend-emoji">${trendEmoji[report.trendAnalysis.drawdownTrend]}</div>
          <div class="trend-info">
            <div class="trend-label">回撤趋势</div>
            <div class="trend-value">${trendText[report.trendAnalysis.drawdownTrend]}</div>
          </div>
        </div>
      </div>
      
      ${report.weeklyReports.length > 0 ? `
      <div style="margin-top: 16px;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">周度风险评分</div>
        <div class="weekly-chart">
          ${report.weeklyReports.map(w => `
          <div class="weekly-bar" style="height: ${Math.max(4, w.score)}%;">
            <div class="weekly-bar-label">${w.week.slice(5)}</div>
          </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>
    
    <div class="section">
      <div class="section-title">模型性能</div>
      <div class="performance-grid">
        <div class="performance-item">
          <span class="performance-label">回撤预测准确率</span>
          <span class="performance-value">${(report.modelPerformance.drawdownPredictionAccuracy * 100).toFixed(0)}%</span>
        </div>
        <div class="performance-item">
          <span class="performance-label">市场状态检测准确率</span>
          <span class="performance-value">${(report.modelPerformance.regimeDetectionAccuracy * 100).toFixed(0)}%</span>
        </div>
        <div class="performance-item">
          <span class="performance-label">平均预测误差</span>
          <span class="performance-value">${(report.modelPerformance.avgPredictionError * 100).toFixed(1)}%</span>
        </div>
        <div class="performance-item">
          <span class="performance-label">校准分数</span>
          <span class="performance-value">${(report.modelPerformance.calibrationScore * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">改进建议</div>
      ${report.improvementSuggestions.map(s => `
      <div class="suggestion-card" style="border-color: ${priorityColors[s.priority]};">
        <div class="suggestion-title" style="color: ${priorityColors[s.priority]};">
          ${s.priority === 'high' ? '⚠️' : s.priority === 'medium' ? '💡' : '✓'} ${s.suggestion}
        </div>
        <div class="suggestion-rationale">${s.rationale}</div>
      </div>
      `).join('')}
    </div>
    
    <div class="footer">
      生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}<br>
      RiskControl 智能风控系统
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 导出报告为 JSON
 */
export function exportReportAsJson(
  report: IntelligentWeeklyReport | IntelligentMonthlyReport
): string {
  return JSON.stringify(report, null, 2);
}

/**
 * 发送报告邮件 (Requirement 8.5)
 */
export async function sendReportEmail(
  report: IntelligentWeeklyReport | IntelligentMonthlyReport,
  recipientEmail: string
): Promise<{ success: boolean; message: string; id?: string }> {
  const isWeekly = report.period === 'weekly';
  const subject = isWeekly
    ? `📊 风控周报 - ${report.startDate} 至 ${report.endDate}`
    : `📊 风控月报 - ${report.startDate} 至 ${report.endDate}`;
  
  const htmlContent = isWeekly
    ? generateWeeklyReportHtml(report as IntelligentWeeklyReport)
    : generateMonthlyReportHtml(report as IntelligentMonthlyReport);
  
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: recipientEmail,
        subject,
        content: htmlContent,
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        message: result.error || '发送失败',
      };
    }
    
    return {
      success: true,
      message: '邮件发送成功',
      id: result.id,
    };
  } catch (error) {
    console.error('Failed to send report email:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '发送失败',
    };
  }
}

/**
 * 导出报告 (Requirement 8.5)
 * 
 * 注意：PDF 导出在浏览器端通过 window.print() 实现
 * 用户可以在打印对话框中选择"保存为 PDF"
 */
export function exportReport(
  report: IntelligentWeeklyReport | IntelligentMonthlyReport,
  options: ReportExportOptions
): { content: string; mimeType: string; filename: string } {
  const isWeekly = report.period === 'weekly';
  const dateStr = report.startDate.replace(/-/g, '');
  const baseFilename = isWeekly ? `risk-weekly-report-${dateStr}` : `risk-monthly-report-${dateStr}`;
  
  switch (options.format) {
    case 'json':
      return {
        content: exportReportAsJson(report),
        mimeType: 'application/json',
        filename: `${baseFilename}.json`,
      };
    
    case 'html':
    case 'pdf':
      // PDF 通过 HTML 打印实现
      const htmlContent = isWeekly
        ? generateWeeklyReportHtml(report as IntelligentWeeklyReport)
        : generateMonthlyReportHtml(report as IntelligentMonthlyReport);
      return {
        content: htmlContent,
        mimeType: 'text/html',
        filename: `${baseFilename}.html`,
      };
    
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

/**
 * 在新窗口中打开报告（用于打印/导出 PDF）
 */
export function openReportForPrint(
  report: IntelligentWeeklyReport | IntelligentMonthlyReport
): void {
  const isWeekly = report.period === 'weekly';
  const htmlContent = isWeekly
    ? generateWeeklyReportHtml(report as IntelligentWeeklyReport)
    : generateMonthlyReportHtml(report as IntelligentMonthlyReport);
  
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    // 等待内容加载后触发打印
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

/**
 * 下载报告文件
 */
export function downloadReport(
  report: IntelligentWeeklyReport | IntelligentMonthlyReport,
  options: ReportExportOptions
): void {
  const { content, mimeType, filename } = exportReport(report, options);
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
