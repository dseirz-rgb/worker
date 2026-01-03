/**
 * 风控数据服务 - Supabase 数据访问层
 * 提供风控配置、日志、快照等数据的CRUD操作
 */

import { getClient } from './supabaseData';

// ============ 类型定义 ============

export interface RiskThresholds {
  id?: number;
  user_id: number;
  leverage_warning: number;
  leverage_critical: number;
  leverage_in_drawdown: number;
  monthly_drawdown_warning: number;
  monthly_drawdown_critical: number;
  trailing_stop_percent: number;
  losing_streak_warning: number;
  losing_streak_critical: number;
  created_at?: string;
  updated_at?: string;
}

export interface RiskLog {
  id?: number;
  user_id: number;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  recommendation?: string;
  metrics?: Record<string, any>;
  acknowledged: boolean;
  acknowledged_at?: string;
  created_at?: string;
}

export interface MonthlySnapshot {
  id?: number;
  user_id: number;
  year_month: string; // '2026-01' 格式
  start_nav: number;
  end_nav?: number;
  max_drawdown?: number;
  max_leverage?: number;
  losing_streak_days?: number;
  rule_breaches?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CircuitBreakerEvent {
  id?: number;
  user_id: number;
  breaker_type: 'leverage' | 'drawdown' | 'trailing_stop' | 'losing_streak';
  reason: string;
  severity: 'warning' | 'critical';
  activated_at: string;
  expires_at?: string;
  trigger_value?: number;
  threshold_value?: number;
  is_active: boolean;
  deactivated_at?: string;
  overridden: boolean;
  override_reason?: string;
  overridden_at?: string;
  created_at?: string;
}

// ============ 默认值 ============

export const DEFAULT_RISK_THRESHOLDS: Omit<RiskThresholds, 'id' | 'created_at' | 'updated_at'> = {
  user_id: 1,
  leverage_warning: 1.5,
  leverage_critical: 2.0,
  leverage_in_drawdown: 1.2,
  monthly_drawdown_warning: 10,
  monthly_drawdown_critical: 15,
  trailing_stop_percent: 15,
  losing_streak_warning: 3,
  losing_streak_critical: 5,
};

// ============ 风控配置 CRUD ============

/**
 * 获取用户风控配置
 */
export async function getRiskThresholds(userId: number = 1): Promise<RiskThresholds> {
  const supabase = getClient();
  if (!supabase) {
    console.warn('[RiskDataService] Supabase not available, using defaults');
    return { ...DEFAULT_RISK_THRESHOLDS, user_id: userId };
  }

  const { data, error } = await supabase
    .from('risk_thresholds')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.warn('[RiskDataService] No config found, using defaults:', error?.message);
    return { ...DEFAULT_RISK_THRESHOLDS, user_id: userId };
  }

  // 转换数据库返回的字符串为数字
  return {
    ...data,
    leverage_warning: Number(data.leverage_warning),
    leverage_critical: Number(data.leverage_critical),
    leverage_in_drawdown: Number(data.leverage_in_drawdown),
    monthly_drawdown_warning: Number(data.monthly_drawdown_warning),
    monthly_drawdown_critical: Number(data.monthly_drawdown_critical),
    trailing_stop_percent: Number(data.trailing_stop_percent),
  };
}

/**
 * 保存用户风控配置
 */
export async function saveRiskThresholds(
  userId: number,
  thresholds: Partial<RiskThresholds>
): Promise<RiskThresholds | null> {
  const supabase = getClient();
  if (!supabase) {
    console.error('[RiskDataService] Supabase not available');
    return null;
  }

  const { data, error } = await supabase
    .from('risk_thresholds')
    .upsert({
      user_id: userId,
      ...thresholds,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('[RiskDataService] Failed to save thresholds:', error);
    return null;
  }

  return data;
}

/**
 * 重置为默认配置
 */
export async function resetRiskThresholds(userId: number = 1): Promise<RiskThresholds | null> {
  return saveRiskThresholds(userId, DEFAULT_RISK_THRESHOLDS);
}

// ============ 风控日志 CRUD ============

/**
 * 记录风控警报
 */
export async function logRiskAlert(alert: Omit<RiskLog, 'id' | 'created_at'>): Promise<RiskLog | null> {
  const supabase = getClient();
  if (!supabase) {
    console.error('[RiskDataService] Supabase not available');
    return null;
  }

  const { data, error } = await supabase
    .from('risk_logs')
    .insert(alert)
    .select()
    .single();

  if (error) {
    console.error('[RiskDataService] Failed to log alert:', error);
    return null;
  }

  return data;
}

/**
 * 获取风控日志列表
 */
export async function getRiskLogs(
  userId: number = 1,
  options: {
    limit?: number;
    alertType?: string;
    severity?: string;
    acknowledged?: boolean;
  } = {}
): Promise<RiskLog[]> {
  const supabase = getClient();
  if (!supabase) return [];

  let query = supabase
    .from('risk_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  }
  if (options.alertType) {
    query = query.eq('alert_type', options.alertType);
  }
  if (options.severity) {
    query = query.eq('severity', options.severity);
  }
  if (options.acknowledged !== undefined) {
    query = query.eq('acknowledged', options.acknowledged);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[RiskDataService] Failed to get logs:', error);
    return [];
  }

  return data || [];
}

/**
 * 确认风控警报
 */
export async function acknowledgeRiskAlert(alertId: number): Promise<boolean> {
  const supabase = getClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('risk_logs')
    .update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', alertId);

  if (error) {
    console.error('[RiskDataService] Failed to acknowledge alert:', error);
    return false;
  }

  return true;
}

// ============ 月度快照 CRUD ============

/**
 * 获取月度快照
 */
export async function getMonthlySnapshot(
  userId: number,
  yearMonth: string
): Promise<MonthlySnapshot | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('monthly_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .single();

  if (error) {
    // 可能是没有记录，不算错误
    return null;
  }

  return data ? {
    ...data,
    start_nav: Number(data.start_nav),
    end_nav: data.end_nav ? Number(data.end_nav) : undefined,
    max_drawdown: data.max_drawdown ? Number(data.max_drawdown) : undefined,
    max_leverage: data.max_leverage ? Number(data.max_leverage) : undefined,
  } : null;
}

/**
 * 创建或更新月度快照
 */
export async function upsertMonthlySnapshot(
  snapshot: Omit<MonthlySnapshot, 'id' | 'created_at'>
): Promise<MonthlySnapshot | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('monthly_snapshots')
    .upsert({
      ...snapshot,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,year_month' })
    .select()
    .single();

  if (error) {
    console.error('[RiskDataService] Failed to upsert snapshot:', error);
    return null;
  }

  return data;
}

/**
 * 获取当前月份的快照，如果不存在则创建
 */
export async function getOrCreateCurrentMonthSnapshot(
  userId: number,
  currentNAV: number
): Promise<MonthlySnapshot | null> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  let snapshot = await getMonthlySnapshot(userId, yearMonth);
  
  if (!snapshot) {
    // 创建新的月度快照
    snapshot = await upsertMonthlySnapshot({
      user_id: userId,
      year_month: yearMonth,
      start_nav: currentNAV,
    });
  }
  
  return snapshot;
}

/**
 * 记录月度快照 - Task 14.1
 * 在每月第一天自动记录 month_start_NAV
 */
export async function recordMonthlySnapshot(
  userId: number,
  yearMonth: string,
  startNAV: number
): Promise<MonthlySnapshot | null> {
  return upsertMonthlySnapshot({
    user_id: userId,
    year_month: yearMonth,
    start_nav: startNAV,
  });
}

/**
 * 更新月度快照的结束数据
 */
export async function updateMonthlySnapshotEnd(
  userId: number,
  yearMonth: string,
  endNAV: number,
  maxDrawdown?: number,
  maxLeverage?: number,
  losingStreakDays?: number,
  ruleBreaches?: number
): Promise<MonthlySnapshot | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('monthly_snapshots')
    .update({
      end_nav: endNAV,
      max_drawdown: maxDrawdown,
      max_leverage: maxLeverage,
      losing_streak_days: losingStreakDays,
      rule_breaches: ruleBreaches,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .select()
    .single();

  if (error) {
    console.error('[RiskDataService] Failed to update snapshot end:', error);
    return null;
  }

  return data;
}

/**
 * 获取历史月度快照列表
 */
export async function getMonthlySnapshots(
  userId: number,
  limit: number = 12
): Promise<MonthlySnapshot[]> {
  const supabase = getClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('monthly_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('year_month', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[RiskDataService] Failed to get snapshots:', error);
    return [];
  }

  return (data || []).map(d => ({
    ...d,
    start_nav: Number(d.start_nav),
    end_nav: d.end_nav ? Number(d.end_nav) : undefined,
    max_drawdown: d.max_drawdown ? Number(d.max_drawdown) : undefined,
    max_leverage: d.max_leverage ? Number(d.max_leverage) : undefined,
  }));
}

// ============ 熔断事件 CRUD ============

/**
 * 记录熔断事件
 */
export async function logCircuitBreakerEvent(
  event: Omit<CircuitBreakerEvent, 'id' | 'created_at'>
): Promise<CircuitBreakerEvent | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('circuit_breaker_events')
    .insert(event)
    .select()
    .single();

  if (error) {
    console.error('[RiskDataService] Failed to log circuit breaker:', error);
    return null;
  }

  return data;
}

/**
 * 获取当前激活的熔断
 */
export async function getActiveCircuitBreakers(userId: number = 1): Promise<CircuitBreakerEvent[]> {
  const supabase = getClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('circuit_breaker_events')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('activated_at', { ascending: false });

  if (error) {
    console.error('[RiskDataService] Failed to get active breakers:', error);
    return [];
  }

  return data || [];
}

/**
 * 解除熔断
 */
export async function deactivateCircuitBreaker(eventId: number): Promise<boolean> {
  const supabase = getClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('circuit_breaker_events')
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
    })
    .eq('id', eventId);

  if (error) {
    console.error('[RiskDataService] Failed to deactivate breaker:', error);
    return false;
  }

  return true;
}

/**
 * 手动覆盖熔断（需要记录原因）
 */
export async function overrideCircuitBreaker(
  eventId: number,
  reason: string
): Promise<boolean> {
  const supabase = getClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('circuit_breaker_events')
    .update({
      overridden: true,
      override_reason: reason,
      overridden_at: new Date().toISOString(),
      is_active: false,
      deactivated_at: new Date().toISOString(),
    })
    .eq('id', eventId);

  if (error) {
    console.error('[RiskDataService] Failed to override breaker:', error);
    return false;
  }

  return true;
}

/**
 * 检查并清理过期的熔断
 */
export async function cleanupExpiredBreakers(userId: number = 1): Promise<number> {
  const supabase = getClient();
  if (!supabase) return 0;

  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('circuit_breaker_events')
    .update({
      is_active: false,
      deactivated_at: now,
    })
    .eq('user_id', userId)
    .eq('is_active', true)
    .lt('expires_at', now)
    .select();

  if (error) {
    console.error('[RiskDataService] Failed to cleanup breakers:', error);
    return 0;
  }

  return data?.length || 0;
}
