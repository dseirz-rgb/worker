/**
 * 风控警报服务 - Risk Alert Service (2026 升级版)
 * 集成新的风控指标和熔断机制，提供完整的警报生成和通知功能
 */

import { toast } from 'sonner';
import {
  type RiskMetrics,
  type RiskThresholds as MetricsThresholds,
  DEFAULT_THRESHOLDS,
} from './riskMetricsService';
import {
  checkAllBreakers,
  type BreakerType,
  type BreakerCheckResult,
} from './circuitBreakerService';
import { logRiskAlert, type RiskLog } from './riskDataService';
import { API_ENDPOINTS } from './apiConfig';

// ============ 类型定义 ============

export type RiskAlertType =
  | 'LEVERAGE_WARNING'
  | 'LEVERAGE_CRITICAL'
  | 'LEVERAGE_BLOCKED'
  | 'MONTHLY_DRAWDOWN_WARNING'
  | 'MONTHLY_DRAWDOWN_CRITICAL'
  | 'TRAILING_STOP_WARNING'
  | 'TRAILING_STOP_TRIGGERED'
  | 'LOSING_STREAK_WARNING'
  | 'LOSING_STREAK_CRITICAL'
  | 'SEASONAL_RISK'
  | 'NEW_HIGH_WATER_MARK'
  | 'DAILY_LOSS_WARNING'
  | 'DAILY_LOSS_CRITICAL';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface RiskAlert {
  id: string;
  type: RiskAlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  recommendation: string;
  timestamp: string;
  acknowledged: boolean;
  metrics?: Partial<RiskMetrics>;
}

// 旧版兼容接口
export interface LegacyRiskThresholds {
  leverageWarning: number;
  leverageCritical: number;
  drawdownWarning: number;
  drawdownCritical: number;
  dailyLossWarning: number;
  dailyLossCritical: number;
}

export interface RiskStatus {
  leverage: { value: number; level: 'normal' | 'warning' | 'critical' };
  drawdown: { value: number; level: 'normal' | 'warning' | 'critical' };
  dailyLoss: { value: number; level: 'normal' | 'warning' | 'critical' };
}

// ============ 常量 ============

const LEGACY_DEFAULT_THRESHOLDS: LegacyRiskThresholds = {
  leverageWarning: 2.0,
  leverageCritical: 2.5,
  drawdownWarning: 3,
  drawdownCritical: 5,
  dailyLossWarning: 2,
  dailyLossCritical: 5,
};

// 存储上次警报时间，避免重复通知
const lastAlertTime: Record<string, number> = {};
const ALERT_COOLDOWN = 30 * 60 * 1000; // 30分钟冷却

// ============ 新版警报生成 ============

/**
 * 根据风控指标生成所有警报
 */
export function generateRiskAlerts(
  metrics: RiskMetrics,
  thresholds: MetricsThresholds = DEFAULT_THRESHOLDS
): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  const timestamp = new Date().toISOString();
  
  // 检查所有熔断条件
  const breakerResults = checkAllBreakers(metrics, thresholds);
  
  // 杠杆警报
  const leverageResult = breakerResults.get('leverage');
  if (leverageResult?.triggered) {
    const alertType: RiskAlertType = leverageResult.severity === 'critical' 
      ? 'LEVERAGE_CRITICAL' 
      : 'LEVERAGE_WARNING';
    
    alerts.push({
      id: `${alertType}_${Date.now()}`,
      type: alertType,
      severity: leverageResult.severity,
      title: leverageResult.severity === 'critical' ? '🚨 杠杆率危险' : '⚠️ 杠杆率偏高',
      message: leverageResult.reason,
      recommendation: leverageResult.recommendation,
      timestamp,
      acknowledged: false,
      metrics: { currentLeverage: metrics.currentLeverage },
    });
  }
  
  // 月度回撤警报
  const drawdownResult = breakerResults.get('drawdown');
  if (drawdownResult?.triggered) {
    const alertType: RiskAlertType = drawdownResult.severity === 'critical'
      ? 'MONTHLY_DRAWDOWN_CRITICAL'
      : 'MONTHLY_DRAWDOWN_WARNING';
    
    alerts.push({
      id: `${alertType}_${Date.now()}`,
      type: alertType,
      severity: drawdownResult.severity,
      title: drawdownResult.severity === 'critical' ? '🚨 月度回撤超限' : '⚠️ 月度回撤警告',
      message: drawdownResult.reason,
      recommendation: drawdownResult.recommendation,
      timestamp,
      acknowledged: false,
      metrics: { monthlyDrawdown: metrics.monthlyDrawdown },
    });
  }
  
  // 移动止盈警报
  const trailingResult = breakerResults.get('trailing_stop');
  if (trailingResult?.triggered) {
    const alertType: RiskAlertType = trailingResult.severity === 'critical'
      ? 'TRAILING_STOP_TRIGGERED'
      : 'TRAILING_STOP_WARNING';
    
    alerts.push({
      id: `${alertType}_${Date.now()}`,
      type: alertType,
      severity: trailingResult.severity,
      title: trailingResult.severity === 'critical' ? '🚨 触发移动止盈' : '⚠️ 接近移动止盈线',
      message: trailingResult.reason,
      recommendation: trailingResult.recommendation,
      timestamp,
      acknowledged: false,
      metrics: { 
        highWaterMark: metrics.highWaterMark,
        trailingStopLevel: metrics.trailingStopLevel,
      },
    });
  }
  
  // 连败警报
  const streakResult = breakerResults.get('losing_streak');
  if (streakResult?.triggered) {
    const alertType: RiskAlertType = streakResult.severity === 'critical'
      ? 'LOSING_STREAK_CRITICAL'
      : 'LOSING_STREAK_WARNING';
    
    alerts.push({
      id: `${alertType}_${Date.now()}`,
      type: alertType,
      severity: streakResult.severity,
      title: streakResult.severity === 'critical' ? '🚨 连败天数超限' : '⚠️ 连败天数警告',
      message: streakResult.reason,
      recommendation: streakResult.recommendation,
      timestamp,
      acknowledged: false,
      metrics: { currentLosingStreak: metrics.currentLosingStreak },
    });
  }
  
  return alerts;
}

/**
 * 触发警报并发送通知
 */
export async function triggerRiskAlerts(
  alerts: RiskAlert[],
  userId: number = 1,
  options: { sendEmail?: boolean; showToast?: boolean; browserNotify?: boolean } = {}
): Promise<void> {
  const { sendEmail = true, showToast = true, browserNotify = true } = options;
  
  for (const alert of alerts) {
    const alertId = `${alert.type}_${alert.severity}`;
    const now = Date.now();
    const lastTime = lastAlertTime[alertId] || 0;
    
    // 冷却期内不重复触发
    if (now - lastTime < ALERT_COOLDOWN) {
      continue;
    }
    
    lastAlertTime[alertId] = now;
    
    // 记录到数据库
    await logRiskAlert({
      user_id: userId,
      alert_type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      recommendation: alert.recommendation,
      metrics: alert.metrics,
      acknowledged: false,
    });
    
    // Toast 通知
    if (showToast) {
      if (alert.severity === 'critical') {
        toast.error(alert.title, { description: alert.message, duration: 10000 });
      } else if (alert.severity === 'warning') {
        toast.warning(alert.title, { description: alert.message, duration: 5000 });
      } else {
        toast.info(alert.title, { description: alert.message, duration: 3000 });
      }
    }
    
    // 浏览器通知
    if (browserNotify && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(alert.title, {
        body: alert.message,
        icon: '/favicon.ico',
        tag: alertId,
        requireInteraction: alert.severity === 'critical',
      });
    }
    
    // 邮件通知（仅 critical 级别）
    if (sendEmail && alert.severity === 'critical') {
      await sendCriticalAlert(alert).catch(console.error);
    }
  }
}

/**
 * 发送关键警报邮件
 */
export async function sendCriticalAlert(alert: RiskAlert): Promise<void> {
  try {
    const response = await fetch(API_ENDPOINTS.SEND_EMAIL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'dseirz@gmail.com',
        subject: `[RiskControl 紧急警报] ${alert.title}`,
        content: `
          <div style="font-family: sans-serif; padding: 20px; background: #1a1a2e; color: #eee;">
            <h2 style="color: #ff6b6b;">🚨 风险警报</h2>
            <p style="font-size: 18px; color: #ffd93d;">${alert.title}</p>
            <p>${alert.message}</p>
            <div style="background: #2a2a4e; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <strong style="color: #4ecdc4;">建议操作：</strong>
              <p style="margin: 5px 0 0 0;">${alert.recommendation}</p>
            </div>
            ${alert.metrics ? `
              <div style="background: #2a2a4e; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <strong style="color: #4ecdc4;">相关指标：</strong>
                <div style="margin: 10px 0 0 0; color: #ddd;">
                  ${formatMetricsForEmail(alert.metrics)}
                </div>
              </div>
            ` : ''}
            <p style="color: #888; font-size: 12px; margin-top: 20px;">
              发送时间: ${new Date().toLocaleString('zh-CN')}
            </p>
          </div>
        `,
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to send critical alert email');
    }
  } catch (error) {
    console.error('Critical alert email error:', error);
  }
}

// ============ 旧版兼容函数 ============

/**
 * 检查风险状态并触发警报（旧版兼容）
 */
export function checkRiskAlerts(
  leverage: number,
  drawdownPercent: number,
  dailyPnLPercent: number,
  thresholds: Partial<LegacyRiskThresholds> = {}
): RiskStatus {
  const t = { ...LEGACY_DEFAULT_THRESHOLDS, ...thresholds };
  
  const status: RiskStatus = {
    leverage: { value: leverage, level: 'normal' },
    drawdown: { value: drawdownPercent, level: 'normal' },
    dailyLoss: { value: dailyPnLPercent, level: 'normal' },
  };

  // 检查杠杆率
  if (leverage >= t.leverageCritical) {
    status.leverage.level = 'critical';
    triggerLegacyAlert('leverage_critical', `🚨 杠杆率危险: ${leverage.toFixed(2)}x`, '请立即减仓降低杠杆！', 'critical');
  } else if (leverage >= t.leverageWarning) {
    status.leverage.level = 'warning';
    triggerLegacyAlert('leverage_warning', `⚠️ 杠杆率偏高: ${leverage.toFixed(2)}x`, '建议关注并考虑减仓', 'warning');
  }

  // 检查回撤
  if (drawdownPercent >= t.drawdownCritical) {
    status.drawdown.level = 'critical';
    triggerLegacyAlert('drawdown_critical', `🚨 回撤超限: ${drawdownPercent.toFixed(2)}%`, '已触及最大回撤红线！', 'critical');
  } else if (drawdownPercent >= t.drawdownWarning) {
    status.drawdown.level = 'warning';
    triggerLegacyAlert('drawdown_warning', `⚠️ 回撤警告: ${drawdownPercent.toFixed(2)}%`, '接近最大回撤限制', 'warning');
  }

  // 检查单日亏损
  if (dailyPnLPercent <= -t.dailyLossCritical) {
    status.dailyLoss.level = 'critical';
    triggerLegacyAlert('daily_loss_critical', `🚨 单日大幅亏损: ${dailyPnLPercent.toFixed(2)}%`, '建议暂停交易，冷静分析', 'critical');
  } else if (dailyPnLPercent <= -t.dailyLossWarning) {
    status.dailyLoss.level = 'warning';
    triggerLegacyAlert('daily_loss_warning', `⚠️ 单日亏损: ${dailyPnLPercent.toFixed(2)}%`, '注意风险控制', 'warning');
  }

  return status;
}

/**
 * 触发旧版警报（带冷却机制）
 */
function triggerLegacyAlert(
  alertId: string,
  title: string,
  message: string,
  severity: 'warning' | 'critical'
) {
  const now = Date.now();
  const lastTime = lastAlertTime[alertId] || 0;
  
  if (now - lastTime < ALERT_COOLDOWN) {
    return;
  }
  
  lastAlertTime[alertId] = now;

  if (severity === 'critical') {
    toast.error(title, { description: message, duration: 10000 });
  } else {
    toast.warning(title, { description: message, duration: 5000 });
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      icon: '/favicon.ico',
      tag: alertId,
      requireInteraction: severity === 'critical',
    });
  }

  if (severity === 'critical') {
    sendLegacyEmailAlert(title, message).catch(console.error);
  }
}

/**
 * 发送旧版邮件警报
 */
async function sendLegacyEmailAlert(title: string, message: string): Promise<void> {
  try {
    const response = await fetch(API_ENDPOINTS.SEND_EMAIL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'dseirz@gmail.com',
        subject: `[RiskControl 紧急警报] ${title}`,
        content: `
          <div style="font-family: sans-serif; padding: 20px; background: #1a1a2e; color: #eee;">
            <h2 style="color: #ff6b6b;">🚨 风险警报</h2>
            <p style="font-size: 18px; color: #ffd93d;">${title}</p>
            <p>${message}</p>
            <p style="color: #888; font-size: 12px; margin-top: 20px;">
              发送时间: ${new Date().toLocaleString('zh-CN')}
            </p>
          </div>
        `,
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to send email alert');
    }
  } catch (error) {
    console.error('Email alert error:', error);
  }
}

// ============ 工具函数 ============

/**
 * 格式化指标数据为邮件友好的 HTML
 */
function formatMetricsForEmail(metrics: Partial<RiskMetrics>): string {
  const items: string[] = [];
  
  if (metrics.currentLeverage !== undefined) {
    items.push(`<p style="margin: 5px 0;">📊 杠杆率: <strong style="color: #ffd93d;">${metrics.currentLeverage.toFixed(2)}x</strong></p>`);
  }
  if (metrics.monthlyDrawdown !== undefined) {
    items.push(`<p style="margin: 5px 0;">📉 月度回撤: <strong style="color: #ff6b6b;">${metrics.monthlyDrawdown.toFixed(2)}%</strong></p>`);
  }
  if (metrics.highWaterMark !== undefined) {
    items.push(`<p style="margin: 5px 0;">🏔️ 高水位: <strong style="color: #4ecdc4;">¥${metrics.highWaterMark.toLocaleString()}</strong></p>`);
  }
  if (metrics.trailingStopLevel !== undefined) {
    items.push(`<p style="margin: 5px 0;">🎯 止盈线: <strong style="color: #a78bfa;">¥${metrics.trailingStopLevel.toLocaleString()}</strong></p>`);
  }
  if (metrics.currentLosingStreak !== undefined) {
    items.push(`<p style="margin: 5px 0;">🔥 连败天数: <strong style="color: #ff6b6b;">${metrics.currentLosingStreak} 天</strong></p>`);
  }
  if (metrics.overallRiskScore !== undefined) {
    items.push(`<p style="margin: 5px 0;">🎯 风险评分: <strong style="color: #ffd93d;">${metrics.overallRiskScore.toFixed(0)}/100</strong></p>`);
  }
  
  // 如果有 actionItems（来自 AI 分析）
  const anyMetrics = metrics as Record<string, unknown>;
  if (anyMetrics.riskLevel) {
    const riskColors: Record<string, string> = {
      LOW: '#4ade80',
      MEDIUM: '#fbbf24', 
      HIGH: '#f97316',
      CRITICAL: '#ef4444',
    };
    const color = riskColors[anyMetrics.riskLevel as string] || '#ffd93d';
    items.push(`<p style="margin: 5px 0;">⚠️ 风险等级: <strong style="color: ${color};">${anyMetrics.riskLevel}</strong></p>`);
  }
  
  if (anyMetrics.actionItems && Array.isArray(anyMetrics.actionItems)) {
    items.push(`<p style="margin: 10px 0 5px 0; color: #4ecdc4;"><strong>建议操作:</strong></p>`);
    const actionItems = anyMetrics.actionItems as Array<{ action: string; ticker?: string; rationale?: string; priority?: number }>;
    actionItems.slice(0, 5).forEach((item, index) => {
      const actionEmoji: Record<string, string> = {
        sell: '🔴',
        buy: '🟢',
        hold: '🟡',
        rebalance: '🔄',
        monitor: '👁️',
      };
      const emoji = actionEmoji[item.action?.toLowerCase()] || '📌';
      items.push(`<p style="margin: 3px 0 3px 15px; color: #ccc;">${emoji} ${item.action?.toUpperCase() || 'ACTION'} ${item.ticker || ''}: ${item.rationale || ''}</p>`);
    });
  }
  
  return items.length > 0 ? items.join('') : '<p style="color: #888;">无详细指标</p>';
}

/**
 * 重置警报冷却（用于测试或手动重置）
 */
export function resetAlertCooldown(alertId?: string) {
  if (alertId) {
    delete lastAlertTime[alertId];
  } else {
    Object.keys(lastAlertTime).forEach(key => delete lastAlertTime[key]);
  }
}

/**
 * 获取警报类型的中文名称
 */
export function getAlertTypeName(type: RiskAlertType): string {
  const names: Record<RiskAlertType, string> = {
    LEVERAGE_WARNING: '杠杆警告',
    LEVERAGE_CRITICAL: '杠杆危险',
    LEVERAGE_BLOCKED: '杠杆阻断',
    MONTHLY_DRAWDOWN_WARNING: '月度回撤警告',
    MONTHLY_DRAWDOWN_CRITICAL: '月度回撤危险',
    TRAILING_STOP_WARNING: '移动止盈警告',
    TRAILING_STOP_TRIGGERED: '移动止盈触发',
    LOSING_STREAK_WARNING: '连败警告',
    LOSING_STREAK_CRITICAL: '连败危险',
    SEASONAL_RISK: '季节性风险',
    NEW_HIGH_WATER_MARK: '新高水位',
    DAILY_LOSS_WARNING: '单日亏损警告',
    DAILY_LOSS_CRITICAL: '单日亏损危险',
  };
  return names[type] || type;
}

/**
 * 获取警报严重程度的颜色
 */
export function getAlertSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical':
      return 'text-red-500 bg-red-500/10';
    case 'warning':
      return 'text-yellow-500 bg-yellow-500/10';
    case 'info':
      return 'text-blue-500 bg-blue-500/10';
    default:
      return 'text-gray-500 bg-gray-500/10';
  }
}
