/**
 * Price Alert Service - 价格警报引擎
 * Feature: realtime-market-platform
 * 
 * 实现价格警报规则的 CRUD、条件评估、去重和通知
 * 
 * Property 3: 警报规则 CRUD 一致性
 * Property 4: 警报条件评估正确性
 * Property 5: 警报通知完整性
 * Property 6: 警报去重机制
 */

import { getSupabaseClient } from './supabase';

// ============ 类型定义 ============

export type AlertConditionType = 
  | 'price_above'    // 价格高于
  | 'price_below'    // 价格低于
  | 'change_above'   // 涨幅超过
  | 'change_below'   // 跌幅超过
  | 'break_ma';      // 突破均线

export type NotificationChannel = 'toast' | 'browser' | 'email';

export interface AlertRule {
  id: string;
  userId: string;
  ticker: string;
  conditionType: AlertConditionType;
  targetValue: number;
  notificationChannels: NotificationChannel[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
  cooldownUntil?: string;
}

export interface CreateAlertRuleInput {
  ticker: string;
  conditionType: AlertConditionType;
  targetValue: number;
  notificationChannels: NotificationChannel[];
  enabled?: boolean;
}

export interface UpdateAlertRuleInput {
  conditionType?: AlertConditionType;
  targetValue?: number;
  notificationChannels?: NotificationChannel[];
  enabled?: boolean;
}

export interface AlertTriggerResult {
  ruleId: string;
  ticker: string;
  triggeredPrice: number;
  conditionType: AlertConditionType;
  targetValue: number;
  triggeredAt: string;
  notificationSent: boolean;
  notificationChannels: NotificationChannel[];
}

export interface QuoteData {
  ticker: string;
  price: number;
  changePercent: number;
  previousClose?: number;
  ma5?: number;
  ma10?: number;
  ma20?: number;
}

// ============ 配置常量 ============

const COOLDOWN_MINUTES = 5;

// ============ 数据库操作 ============

/**
 * 创建警报规则
 * Property 3: CRUD 一致性
 */
export async function createRule(
  userId: string,
  input: CreateAlertRuleInput
): Promise<AlertRule | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[PriceAlert] Supabase client not initialized');
    return null;
  }

  const { data, error } = await supabase
    .from('price_alert_rules')
    .insert({
      user_id: userId,
      ticker: input.ticker.toUpperCase(),
      condition_type: input.conditionType,
      target_value: input.targetValue,
      notification_channels: input.notificationChannels,
      enabled: input.enabled ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error('[PriceAlert] Failed to create rule:', error);
    return null;
  }

  return mapDbToRule(data);
}

/**
 * 更新警报规则
 * Property 3: CRUD 一致性
 */
export async function updateRule(
  ruleId: string,
  userId: string,
  input: UpdateAlertRuleInput
): Promise<AlertRule | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[PriceAlert] Supabase client not initialized');
    return null;
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.conditionType !== undefined) {
    updateData.condition_type = input.conditionType;
  }
  if (input.targetValue !== undefined) {
    updateData.target_value = input.targetValue;
  }
  if (input.notificationChannels !== undefined) {
    updateData.notification_channels = input.notificationChannels;
  }
  if (input.enabled !== undefined) {
    updateData.enabled = input.enabled;
  }

  const { data, error } = await supabase
    .from('price_alert_rules')
    .update(updateData)
    .eq('id', ruleId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('[PriceAlert] Failed to update rule:', error);
    return null;
  }

  return mapDbToRule(data);
}

/**
 * 删除警报规则
 * Property 3: CRUD 一致性
 */
export async function deleteRule(
  ruleId: string,
  userId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[PriceAlert] Supabase client not initialized');
    return false;
  }

  const { error } = await supabase
    .from('price_alert_rules')
    .delete()
    .eq('id', ruleId)
    .eq('user_id', userId);

  if (error) {
    console.error('[PriceAlert] Failed to delete rule:', error);
    return false;
  }

  return true;
}

/**
 * 获取用户的所有警报规则
 */
export async function getRules(userId: string): Promise<AlertRule[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[PriceAlert] Supabase client not initialized');
    return [];
  }

  const { data, error } = await supabase
    .from('price_alert_rules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[PriceAlert] Failed to get rules:', error);
    return [];
  }

  return (data || []).map(mapDbToRule);
}

/**
 * 获取单个警报规则
 */
export async function getRule(
  ruleId: string,
  userId: string
): Promise<AlertRule | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[PriceAlert] Supabase client not initialized');
    return null;
  }

  const { data, error } = await supabase
    .from('price_alert_rules')
    .select('*')
    .eq('id', ruleId)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('[PriceAlert] Failed to get rule:', error);
    return null;
  }

  return mapDbToRule(data);
}

/**
 * 获取指定股票的启用规则
 */
export async function getEnabledRulesForTicker(ticker: string): Promise<AlertRule[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[PriceAlert] Supabase client not initialized');
    return [];
  }

  const { data, error } = await supabase
    .from('price_alert_rules')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .eq('enabled', true);

  if (error) {
    console.error('[PriceAlert] Failed to get enabled rules:', error);
    return [];
  }

  return (data || []).map(mapDbToRule);
}

// ============ 条件评估 ============

/**
 * 评估单个规则
 * Property 4: 警报条件评估正确性
 */
export function evaluateRule(rule: AlertRule, quote: QuoteData): boolean {
  if (!rule.enabled) return false;

  switch (rule.conditionType) {
    case 'price_above':
      return quote.price > rule.targetValue;
    
    case 'price_below':
      return quote.price < rule.targetValue;
    
    case 'change_above':
      return quote.changePercent > rule.targetValue;
    
    case 'change_below':
      return quote.changePercent < -Math.abs(rule.targetValue);
    
    case 'break_ma':
      // 突破均线：价格从下方突破指定均线
      const maValue = getMaValue(quote, rule.targetValue);
      if (maValue === null) return false;
      // 简化逻辑：当前价格高于均线且之前收盘价低于均线
      return quote.price > maValue && (quote.previousClose ?? 0) <= maValue;
    
    default:
      return false;
  }
}

/**
 * 批量评估规则
 * Property 4: 警报条件评估正确性
 */
export function evaluateRules(
  rules: AlertRule[],
  quote: QuoteData
): AlertRule[] {
  return rules.filter(rule => evaluateRule(rule, quote));
}

/**
 * 获取均线值
 */
function getMaValue(quote: QuoteData, maPeriod: number): number | null {
  switch (maPeriod) {
    case 5: return quote.ma5 ?? null;
    case 10: return quote.ma10 ?? null;
    case 20: return quote.ma20 ?? null;
    default: return null;
  }
}

// ============ 去重机制 ============

/**
 * 检查规则是否在冷却期内
 * Property 6: 警报去重机制
 */
export function isInCooldown(rule: AlertRule): boolean {
  if (!rule.cooldownUntil) return false;
  return new Date(rule.cooldownUntil) > new Date();
}

/**
 * 更新规则的冷却期
 * Property 6: 警报去重机制
 */
export async function updateCooldown(ruleId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[PriceAlert] Supabase client not initialized');
    return;
  }

  const cooldownUntil = new Date(Date.now() + COOLDOWN_MINUTES * 60 * 1000);
  
  await supabase
    .from('price_alert_rules')
    .update({
      last_triggered_at: new Date().toISOString(),
      cooldown_until: cooldownUntil.toISOString(),
    })
    .eq('id', ruleId);
}

// ============ 警报历史 ============

/**
 * 记录警报触发历史
 */
export async function recordAlertHistory(
  result: AlertTriggerResult
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[PriceAlert] Supabase client not initialized');
    return;
  }

  await supabase
    .from('price_alert_history')
    .insert({
      rule_id: result.ruleId,
      ticker: result.ticker,
      triggered_price: result.triggeredPrice,
      condition_type: result.conditionType,
      target_value: result.targetValue,
      triggered_at: result.triggeredAt,
      notification_sent: result.notificationSent,
      notification_channels: result.notificationChannels,
    });
}

/**
 * 获取警报历史
 */
export async function getAlertHistory(
  userId: string,
  limit: number = 50
): Promise<AlertTriggerResult[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[PriceAlert] Supabase client not initialized');
    return [];
  }

  const { data, error } = await supabase
    .from('price_alert_history')
    .select(`
      *,
      price_alert_rules!inner(user_id)
    `)
    .eq('price_alert_rules.user_id', userId)
    .order('triggered_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[PriceAlert] Failed to get history:', error);
    return [];
  }

  return (data || []).map((item: Record<string, unknown>) => ({
    ruleId: item.rule_id as string,
    ticker: item.ticker as string,
    triggeredPrice: item.triggered_price as number,
    conditionType: item.condition_type as AlertConditionType,
    targetValue: item.target_value as number,
    triggeredAt: item.triggered_at as string,
    notificationSent: item.notification_sent as boolean,
    notificationChannels: item.notification_channels as NotificationChannel[],
  }));
}

// ============ 通知发送 ============

/**
 * 发送警报通知
 * Property 5: 警报通知完整性
 */
export async function sendAlertNotification(
  rule: AlertRule,
  quote: QuoteData
): Promise<boolean> {
  const message = formatAlertMessage(rule, quote);
  let success = true;

  for (const channel of rule.notificationChannels) {
    try {
      switch (channel) {
        case 'toast':
          await sendToastNotification(message);
          break;
        case 'browser':
          await sendBrowserNotification(rule.ticker, message);
          break;
        case 'email':
          // Email 通知需要后端支持，这里只记录
          console.log('[PriceAlert] Email notification:', message);
          break;
      }
    } catch (error) {
      console.error(`[PriceAlert] Failed to send ${channel} notification:`, error);
      success = false;
    }
  }

  return success;
}

/**
 * 格式化警报消息
 * Property 5: 警报通知完整性 - 包含 ticker, price, condition, timestamp
 */
function formatAlertMessage(rule: AlertRule, quote: QuoteData): string {
  const conditionText = getConditionText(rule.conditionType, rule.targetValue);
  const timestamp = new Date().toLocaleString('zh-CN');
  
  return `${rule.ticker} ${conditionText}！当前价格: ${quote.price.toFixed(2)}，涨跌幅: ${quote.changePercent.toFixed(2)}% [${timestamp}]`;
}

/**
 * 获取条件描述文本
 */
function getConditionText(conditionType: AlertConditionType, targetValue: number): string {
  switch (conditionType) {
    case 'price_above':
      return `价格突破 ${targetValue}`;
    case 'price_below':
      return `价格跌破 ${targetValue}`;
    case 'change_above':
      return `涨幅超过 ${targetValue}%`;
    case 'change_below':
      return `跌幅超过 ${Math.abs(targetValue)}%`;
    case 'break_ma':
      return `突破 MA${targetValue}`;
    default:
      return '触发警报';
  }
}

/**
 * 发送 Toast 通知
 */
async function sendToastNotification(message: string): Promise<void> {
  // 使用自定义事件触发 Toast
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('price-alert', { detail: { message } }));
  }
}

/**
 * 发送浏览器通知
 */
async function sendBrowserNotification(title: string, message: string): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(`价格警报: ${title}`, {
      body: message,
      icon: '/favicon.ico',
    });
  } else if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification(`价格警报: ${title}`, {
        body: message,
        icon: '/favicon.ico',
      });
    }
  }
}

// ============ 主处理流程 ============

/**
 * 处理行情更新，评估并触发警报
 */
export async function processQuoteUpdate(quote: QuoteData): Promise<AlertTriggerResult[]> {
  const results: AlertTriggerResult[] = [];
  
  // 获取该股票的所有启用规则
  const rules = await getEnabledRulesForTicker(quote.ticker);
  
  for (const rule of rules) {
    // 检查冷却期
    if (isInCooldown(rule)) {
      continue;
    }
    
    // 评估规则
    if (!evaluateRule(rule, quote)) {
      continue;
    }
    
    // 发送通知
    const notificationSent = await sendAlertNotification(rule, quote);
    
    // 更新冷却期
    await updateCooldown(rule.id);
    
    // 记录结果
    const result: AlertTriggerResult = {
      ruleId: rule.id,
      ticker: quote.ticker,
      triggeredPrice: quote.price,
      conditionType: rule.conditionType,
      targetValue: rule.targetValue,
      triggeredAt: new Date().toISOString(),
      notificationSent,
      notificationChannels: rule.notificationChannels,
    };
    
    // 记录历史
    await recordAlertHistory(result);
    
    results.push(result);
  }
  
  return results;
}

// ============ 辅助函数 ============

/**
 * 数据库记录映射到 AlertRule
 */
function mapDbToRule(data: Record<string, unknown>): AlertRule {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    ticker: data.ticker as string,
    conditionType: data.condition_type as AlertConditionType,
    targetValue: data.target_value as number,
    notificationChannels: data.notification_channels as NotificationChannel[],
    enabled: data.enabled as boolean,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    lastTriggeredAt: data.last_triggered_at as string | undefined,
    cooldownUntil: data.cooldown_until as string | undefined,
  };
}
