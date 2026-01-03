/**
 * 熔断机制服务 - Circuit Breaker Service
 * 实现杠杆熔断、回撤熔断、止盈熔断、连败熔断
 */

import {
  type RiskMetrics,
  type RiskThresholds,
  DEFAULT_THRESHOLDS,
} from './riskMetricsService';
import {
  logCircuitBreakerEvent,
  getActiveCircuitBreakers,
  deactivateCircuitBreaker,
  overrideCircuitBreaker as overrideCircuitBreakerDB,
  type CircuitBreakerEvent,
} from './riskDataService';

// ============ 类型定义 ============

export type BreakerType = 'leverage' | 'drawdown' | 'trailing_stop' | 'losing_streak';
export type BreakerSeverity = 'warning' | 'critical';

export interface CircuitBreakerState {
  isActive: boolean;
  breakerType: BreakerType;
  reason: string;
  severity: BreakerSeverity;
  activatedAt: string;
  expiresAt: string | null;
  
  // 具体限制
  tradingAllowed: boolean;
  maxAllowedLeverage: number;
  requiresConfirmation: boolean;
  coolingPeriodHours: number;
}

export interface BreakerCheckResult {
  triggered: boolean;
  severity: BreakerSeverity;
  reason: string;
  triggerValue: number;
  thresholdValue: number;
  recommendation: string;
}

// ============ 熔断检查函数 ============

/**
 * 检查杠杆熔断
 * Property 2: 当杠杆 > 1.5x 时，阻止新的买入/做空订单
 */
export function checkLeverageBreaker(
  leverage: number,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS,
  isInDrawdown: boolean = false
): BreakerCheckResult {
  // 回撤期间使用更严格的限制
  const effectiveLimit = isInDrawdown 
    ? thresholds.leverageInDrawdown 
    : thresholds.leverageCritical;
  
  if (leverage >= thresholds.leverageCritical) {
    return {
      triggered: true,
      severity: 'critical',
      reason: `杠杆率 ${leverage.toFixed(2)}x 超过危险阈值 ${thresholds.leverageCritical}x`,
      triggerValue: leverage,
      thresholdValue: thresholds.leverageCritical,
      recommendation: '立即减仓！禁止任何新的买入或做空操作。',
    };
  }
  
  if (leverage >= thresholds.leverageWarning) {
    return {
      triggered: true,
      severity: 'warning',
      reason: `杠杆率 ${leverage.toFixed(2)}x 超过警告阈值 ${thresholds.leverageWarning}x`,
      triggerValue: leverage,
      thresholdValue: thresholds.leverageWarning,
      recommendation: '建议减仓降低杠杆，避免进一步加仓。',
    };
  }
  
  // 回撤期间的额外检查
  if (isInDrawdown && leverage >= thresholds.leverageInDrawdown) {
    return {
      triggered: true,
      severity: 'warning',
      reason: `回撤期间杠杆率 ${leverage.toFixed(2)}x 超过限制 ${thresholds.leverageInDrawdown}x`,
      triggerValue: leverage,
      thresholdValue: thresholds.leverageInDrawdown,
      recommendation: '回撤期间应保持低杠杆，建议减仓。',
    };
  }
  
  return {
    triggered: false,
    severity: 'warning',
    reason: '',
    triggerValue: leverage,
    thresholdValue: effectiveLimit,
    recommendation: '',
  };
}

/**
 * 检查月度回撤熔断
 */
export function checkDrawdownBreaker(
  monthlyDrawdown: number,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS
): BreakerCheckResult {
  if (monthlyDrawdown >= thresholds.monthlyDrawdownCritical) {
    return {
      triggered: true,
      severity: 'critical',
      reason: `月度回撤 ${monthlyDrawdown.toFixed(2)}% 超过危险阈值 ${thresholds.monthlyDrawdownCritical}%`,
      triggerValue: monthlyDrawdown,
      thresholdValue: thresholds.monthlyDrawdownCritical,
      recommendation: '强制空仓或仅保留底仓，进入冷静期至少3天。',
    };
  }
  
  if (monthlyDrawdown >= thresholds.monthlyDrawdownWarning) {
    return {
      triggered: true,
      severity: 'warning',
      reason: `月度回撤 ${monthlyDrawdown.toFixed(2)}% 超过警告阈值 ${thresholds.monthlyDrawdownWarning}%`,
      triggerValue: monthlyDrawdown,
      thresholdValue: thresholds.monthlyDrawdownWarning,
      recommendation: '强制半仓，降低杠杆至1.0x以下。',
    };
  }
  
  return {
    triggered: false,
    severity: 'warning',
    reason: '',
    triggerValue: monthlyDrawdown,
    thresholdValue: thresholds.monthlyDrawdownWarning,
    recommendation: '',
  };
}

/**
 * 检查移动止盈熔断
 */
export function checkTrailingStopBreaker(
  nav: number,
  hwm: number,
  trailingStopPercent: number = DEFAULT_THRESHOLDS.trailingStopPercent
): BreakerCheckResult {
  if (hwm <= 0) {
    return {
      triggered: false,
      severity: 'warning',
      reason: '',
      triggerValue: 0,
      thresholdValue: 0,
      recommendation: '',
    };
  }
  
  const trailingStopLevel = hwm * (1 - trailingStopPercent / 100);
  const distancePercent = ((nav - trailingStopLevel) / hwm) * 100;
  
  if (nav < trailingStopLevel) {
    return {
      triggered: true,
      severity: 'critical',
      reason: `净值 ${nav.toFixed(0)} 跌破移动止盈线 ${trailingStopLevel.toFixed(0)} (HWM ${hwm.toFixed(0)} 的 ${100 - trailingStopPercent}%)`,
      triggerValue: nav,
      thresholdValue: trailingStopLevel,
      recommendation: '触发移动止盈，建议大幅减仓保护利润。',
    };
  }
  
  if (distancePercent < 5) {
    return {
      triggered: true,
      severity: 'warning',
      reason: `净值距离移动止盈线仅 ${distancePercent.toFixed(2)}%`,
      triggerValue: nav,
      thresholdValue: trailingStopLevel,
      recommendation: '接近移动止盈线，建议提高警惕。',
    };
  }
  
  return {
    triggered: false,
    severity: 'warning',
    reason: '',
    triggerValue: nav,
    thresholdValue: trailingStopLevel,
    recommendation: '',
  };
}

/**
 * 检查连败熔断
 */
export function checkLosingStreakBreaker(
  streak: number,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS
): BreakerCheckResult {
  if (streak >= thresholds.losingStreakCritical) {
    return {
      triggered: true,
      severity: 'critical',
      reason: `连续亏损 ${streak} 天，超过危险阈值 ${thresholds.losingStreakCritical} 天`,
      triggerValue: streak,
      thresholdValue: thresholds.losingStreakCritical,
      recommendation: '强制停止交易，进入冷静期。',
    };
  }
  
  if (streak >= thresholds.losingStreakWarning) {
    return {
      triggered: true,
      severity: 'warning',
      reason: `连续亏损 ${streak} 天，超过警告阈值 ${thresholds.losingStreakWarning} 天`,
      triggerValue: streak,
      thresholdValue: thresholds.losingStreakWarning,
      recommendation: '新交易需要确认，避免报复性交易。',
    };
  }
  
  return {
    triggered: false,
    severity: 'warning',
    reason: '',
    triggerValue: streak,
    thresholdValue: thresholds.losingStreakWarning,
    recommendation: '',
  };
}

// ============ 综合熔断服务 ============

/**
 * 检查所有熔断条件
 */
export function checkAllBreakers(
  metrics: RiskMetrics,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS
): Map<BreakerType, BreakerCheckResult> {
  const results = new Map<BreakerType, BreakerCheckResult>();
  
  const isInDrawdown = metrics.highWaterMark > 0 && 
    metrics.distanceToTrailingStop < 0;
  
  results.set('leverage', checkLeverageBreaker(
    metrics.currentLeverage, 
    thresholds, 
    isInDrawdown
  ));
  
  results.set('drawdown', checkDrawdownBreaker(
    metrics.monthlyDrawdown, 
    thresholds
  ));
  
  results.set('trailing_stop', checkTrailingStopBreaker(
    metrics.highWaterMark - metrics.distanceToTrailingStop, // currentNAV
    metrics.highWaterMark,
    thresholds.trailingStopPercent
  ));
  
  results.set('losing_streak', checkLosingStreakBreaker(
    metrics.currentLosingStreak, 
    thresholds
  ));
  
  return results;
}

/**
 * 判断是否应该阻止交易
 */
export function shouldBlockTrade(
  metrics: RiskMetrics,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS
): { blocked: boolean; reasons: string[] } {
  const results = checkAllBreakers(metrics, thresholds);
  const reasons: string[] = [];
  
  // 杠杆超过 critical 阈值时阻止交易
  const leverageResult = results.get('leverage');
  if (leverageResult?.triggered && leverageResult.severity === 'critical') {
    reasons.push(leverageResult.reason);
  }
  
  // 月度回撤超过 critical 阈值时阻止交易
  const drawdownResult = results.get('drawdown');
  if (drawdownResult?.triggered && drawdownResult.severity === 'critical') {
    reasons.push(drawdownResult.reason);
  }
  
  // 连败超过 critical 阈值时阻止交易
  const streakResult = results.get('losing_streak');
  if (streakResult?.triggered && streakResult.severity === 'critical') {
    reasons.push(streakResult.reason);
  }
  
  return {
    blocked: reasons.length > 0,
    reasons,
  };
}

/**
 * 判断交易是否需要确认
 */
export function requiresTradeConfirmation(
  metrics: RiskMetrics,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS
): { required: boolean; warnings: string[] } {
  const results = checkAllBreakers(metrics, thresholds);
  const warnings: string[] = [];
  
  for (const [type, result] of Array.from(results.entries())) {
    if (result.triggered && result.severity === 'warning') {
      warnings.push(result.reason);
    }
  }
  
  return {
    required: warnings.length > 0,
    warnings,
  };
}

/**
 * 获取当前激活的熔断状态
 */
export async function getActiveBreakers(userId: number = 1): Promise<CircuitBreakerState[]> {
  const events = await getActiveCircuitBreakers(userId);
  
  return events.map(event => ({
    isActive: event.is_active,
    breakerType: event.breaker_type,
    reason: event.reason,
    severity: event.severity,
    activatedAt: event.activated_at,
    expiresAt: event.expires_at || null,
    tradingAllowed: event.severity !== 'critical',
    maxAllowedLeverage: event.severity === 'critical' ? 1.0 : 1.5,
    requiresConfirmation: true,
    coolingPeriodHours: event.severity === 'critical' ? 72 : 24,
  }));
}

/**
 * 触发熔断并记录
 */
export async function triggerBreaker(
  userId: number,
  breakerType: BreakerType,
  result: BreakerCheckResult
): Promise<CircuitBreakerEvent | null> {
  if (!result.triggered) return null;
  
  const coolingHours = result.severity === 'critical' ? 72 : 24;
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + coolingHours);
  
  return logCircuitBreakerEvent({
    user_id: userId,
    breaker_type: breakerType,
    reason: result.reason,
    severity: result.severity,
    activated_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    trigger_value: result.triggerValue,
    threshold_value: result.thresholdValue,
    is_active: true,
    overridden: false,
  });
}

/**
 * 解除熔断
 */
export async function releaseBreaker(eventId: number): Promise<boolean> {
  return deactivateCircuitBreaker(eventId);
}

/**
 * 手动覆盖熔断（需要记录原因）
 */
export async function overrideBreaker(
  eventId: number,
  reason: string
): Promise<boolean> {
  return overrideCircuitBreakerDB(eventId, reason);
}

/**
 * 获取熔断状态摘要
 */
export function getBreakerSummary(
  metrics: RiskMetrics,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS
): {
  totalTriggered: number;
  criticalCount: number;
  warningCount: number;
  tradingAllowed: boolean;
  requiresConfirmation: boolean;
  activeBreakers: Array<{ type: BreakerType; result: BreakerCheckResult }>;
} {
  const results = checkAllBreakers(metrics, thresholds);
  const activeBreakers: Array<{ type: BreakerType; result: BreakerCheckResult }> = [];
  
  let criticalCount = 0;
  let warningCount = 0;
  
  for (const [type, result] of Array.from(results.entries())) {
    if (result.triggered) {
      activeBreakers.push({ type, result });
      if (result.severity === 'critical') {
        criticalCount++;
      } else {
        warningCount++;
      }
    }
  }
  
  return {
    totalTriggered: activeBreakers.length,
    criticalCount,
    warningCount,
    tradingAllowed: criticalCount === 0,
    requiresConfirmation: warningCount > 0,
    activeBreakers,
  };
}
