/**
 * Emotional Trading Detector
 * 
 * 检测情绪化交易行为，提供冷静期建议。
 * 
 * Requirements:
 * - 5.1: 检测报复性交易、过度交易、恐慌/贪婪
 * - 5.2: 检测到情绪化交易时显示警告并建议冷静期
 * - 5.3: 提供交易行为分析报告
 * - 5.4: 支持用户设置冷静期
 * - 5.5: 记录检测历史用于自我反思
 */

import { getSupabaseClient } from './supabase';

// === Types ===

export type EmotionalEventType = 
  | 'revenge_trading' 
  | 'overtrading' 
  | 'panic_selling' 
  | 'fomo_buying'
  | 'strategy_deviation';

export type EventSeverity = 'warning' | 'critical';

export interface TradingBehavior {
  id?: string;
  timestamp: Date;
  action: 'buy' | 'sell';
  ticker: string;
  amount: number;
  price: number;
  pnlBefore: number;  // 交易前的累计盈亏百分比
  portfolioValue: number;
}

export interface EmotionalTradingAlert {
  type: EmotionalEventType;
  severity: EventSeverity;
  message: string;
  suggestedCooldown: number;  // 建议冷静期（分钟）
  detectedAt: Date;
  triggerTrades: TradingBehavior[];
}

export interface CooldownStatus {
  active: boolean;
  endsAt: Date | null;
  remainingMinutes: number;
  reason: string | null;
}

export interface TradingBehaviorReport {
  period: { start: Date; end: Date };
  totalTrades: number;
  buyCount: number;
  sellCount: number;
  avgTradesPerDay: number;
  emotionalEvents: EmotionalTradingAlert[];
  riskScore: number;  // 0-100
  recommendations: string[];
}

// === Constants ===

// 检测阈值 (Requirement 5.1)
const DETECTION_THRESHOLDS = {
  revengeTrading: {
    lossThreshold: -0.05,      // 亏损 5% 后
    positionIncrease: 1.5,     // 仓位增加 50%
    timeWindowMs: 60 * 60 * 1000, // 1 小时内
  },
  overtrading: {
    maxTradesPerHour: 5,
    maxTradesPerDay: 15,
    timeWindowMs: 60 * 60 * 1000,
  },
  panicSelling: {
    sellRatio: 0.5,            // 卖出 50% 以上仓位
    timeWindowMs: 30 * 60 * 1000, // 30 分钟内
    priceDropThreshold: -0.03, // 价格下跌 3%
  },
  fomoBuying: {
    buyRatio: 0.3,             // 买入 30% 以上仓位
    timeWindowMs: 30 * 60 * 1000,
    priceRiseThreshold: 0.05,  // 价格上涨 5%
  },
};

// 默认冷静期（分钟）
const DEFAULT_COOLDOWN_MINUTES = 60;


// === Main Class ===

class EmotionalTradingDetector {
  private recentTrades: TradingBehavior[] = [];
  private cooldownUntil: Date | null = null;
  private cooldownReason: string | null = null;
  private userCooldownDuration: number = DEFAULT_COOLDOWN_MINUTES;
  private alertListeners: ((alert: EmotionalTradingAlert) => void)[] = [];

  /**
   * 记录交易行为
   */
  recordTrade(trade: TradingBehavior): EmotionalTradingAlert[] {
    this.recentTrades.push(trade);
    
    // 清理超过 24 小时的记录
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.recentTrades = this.recentTrades.filter(
      t => t.timestamp.getTime() > cutoff
    );
    
    // 检测情绪化交易
    return this.detect();
  }

  /**
   * 检测情绪化交易 (Requirement 5.1)
   */
  detect(): EmotionalTradingAlert[] {
    const alerts: EmotionalTradingAlert[] = [];
    
    // 检测报复性交易
    const revengeAlert = this.detectRevengeTrading();
    if (revengeAlert) alerts.push(revengeAlert);
    
    // 检测过度交易
    const overtradingAlert = this.detectOvertrading();
    if (overtradingAlert) alerts.push(overtradingAlert);
    
    // 检测恐慌性卖出
    const panicAlert = this.detectPanicSelling();
    if (panicAlert) alerts.push(panicAlert);
    
    // 检测 FOMO 买入
    const fomoAlert = this.detectFomoBuying();
    if (fomoAlert) alerts.push(fomoAlert);
    
    // 处理检测到的预警
    for (const alert of alerts) {
      this.handleAlert(alert);
    }
    
    return alerts;
  }

  /**
   * 检测报复性交易 (Requirement 5.1)
   */
  private detectRevengeTrading(): EmotionalTradingAlert | null {
    const { lossThreshold, positionIncrease, timeWindowMs } = DETECTION_THRESHOLDS.revengeTrading;
    const now = Date.now();
    
    // 查找最近的亏损交易
    const recentLoss = this.recentTrades.find(
      t => t.pnlBefore < lossThreshold && 
           now - t.timestamp.getTime() < timeWindowMs
    );
    
    if (!recentLoss) return null;
    
    // 检查亏损后是否加大仓位
    const tradesAfterLoss = this.recentTrades.filter(
      t => t.timestamp > recentLoss.timestamp && t.action === 'buy'
    );
    
    const totalBuyAmount = tradesAfterLoss.reduce((sum, t) => sum + t.amount * t.price, 0);
    const lossTradeValue = recentLoss.amount * recentLoss.price;
    
    if (totalBuyAmount > lossTradeValue * positionIncrease) {
      return {
        type: 'revenge_trading',
        severity: 'critical',
        message: '检测到报复性交易：亏损后大幅加仓，这可能导致更大损失',
        suggestedCooldown: 120,
        detectedAt: new Date(),
        triggerTrades: [recentLoss, ...tradesAfterLoss],
      };
    }
    
    return null;
  }

  /**
   * 检测过度交易 (Requirement 5.1)
   */
  private detectOvertrading(): EmotionalTradingAlert | null {
    const { maxTradesPerHour, maxTradesPerDay, timeWindowMs } = DETECTION_THRESHOLDS.overtrading;
    const now = Date.now();
    
    // 检查每小时交易次数
    const hourlyTrades = this.recentTrades.filter(
      t => now - t.timestamp.getTime() < timeWindowMs
    );
    
    if (hourlyTrades.length > maxTradesPerHour) {
      return {
        type: 'overtrading',
        severity: 'warning',
        message: `过去 1 小时内交易 ${hourlyTrades.length} 次，超过建议频率（${maxTradesPerHour} 次）`,
        suggestedCooldown: 60,
        detectedAt: new Date(),
        triggerTrades: hourlyTrades,
      };
    }
    
    // 检查每日交易次数
    const dailyTrades = this.recentTrades.filter(
      t => now - t.timestamp.getTime() < 24 * 60 * 60 * 1000
    );
    
    if (dailyTrades.length > maxTradesPerDay) {
      return {
        type: 'overtrading',
        severity: 'critical',
        message: `今日交易 ${dailyTrades.length} 次，超过建议频率（${maxTradesPerDay} 次）`,
        suggestedCooldown: 120,
        detectedAt: new Date(),
        triggerTrades: dailyTrades.slice(-10), // 最近 10 笔
      };
    }
    
    return null;
  }

  /**
   * 检测恐慌性卖出 (Requirement 5.1)
   */
  private detectPanicSelling(): EmotionalTradingAlert | null {
    const { sellRatio, timeWindowMs } = DETECTION_THRESHOLDS.panicSelling;
    const now = Date.now();
    
    // 查找短时间内的大量卖出
    const recentSells = this.recentTrades.filter(
      t => t.action === 'sell' && now - t.timestamp.getTime() < timeWindowMs
    );
    
    if (recentSells.length === 0) return null;
    
    const totalSellValue = recentSells.reduce((sum, t) => sum + t.amount * t.price, 0);
    const avgPortfolioValue = recentSells[0].portfolioValue;
    
    if (avgPortfolioValue > 0 && totalSellValue / avgPortfolioValue > sellRatio) {
      return {
        type: 'panic_selling',
        severity: 'critical',
        message: `短时间内卖出超过 ${(sellRatio * 100).toFixed(0)}% 仓位，可能是恐慌性卖出`,
        suggestedCooldown: 90,
        detectedAt: new Date(),
        triggerTrades: recentSells,
      };
    }
    
    return null;
  }

  /**
   * 检测 FOMO 买入 (Requirement 5.1)
   */
  private detectFomoBuying(): EmotionalTradingAlert | null {
    const { buyRatio, timeWindowMs } = DETECTION_THRESHOLDS.fomoBuying;
    const now = Date.now();
    
    // 查找短时间内的大量买入
    const recentBuys = this.recentTrades.filter(
      t => t.action === 'buy' && now - t.timestamp.getTime() < timeWindowMs
    );
    
    if (recentBuys.length === 0) return null;
    
    const totalBuyValue = recentBuys.reduce((sum, t) => sum + t.amount * t.price, 0);
    const avgPortfolioValue = recentBuys[0].portfolioValue;
    
    if (avgPortfolioValue > 0 && totalBuyValue / avgPortfolioValue > buyRatio) {
      return {
        type: 'fomo_buying',
        severity: 'warning',
        message: `短时间内买入超过 ${(buyRatio * 100).toFixed(0)}% 仓位，可能是追涨行为`,
        suggestedCooldown: 60,
        detectedAt: new Date(),
        triggerTrades: recentBuys,
      };
    }
    
    return null;
  }


  /**
   * 处理检测到的预警 (Requirement 5.2)
   */
  private async handleAlert(alert: EmotionalTradingAlert): Promise<void> {
    // 保存到数据库
    await this.saveAlert(alert);
    
    // 如果是 critical 级别，自动启动冷静期
    if (alert.severity === 'critical') {
      this.startCooldown(alert.suggestedCooldown, alert.message);
    }
    
    // 通知监听器
    this.notifyListeners(alert);
  }

  /**
   * 保存预警到数据库 (Requirement 5.5)
   */
  private async saveAlert(alert: EmotionalTradingAlert): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    try {
      await supabase.from('emotional_trading_events').insert({
        event_type: alert.type,
        severity: alert.severity,
        details: {
          message: alert.message,
          suggestedCooldown: alert.suggestedCooldown,
        },
        trigger_trades: alert.triggerTrades.map(t => ({
          timestamp: t.timestamp.toISOString(),
          action: t.action,
          ticker: t.ticker,
          amount: t.amount,
          price: t.price,
        })),
        cooldown_applied: alert.severity === 'critical',
        cooldown_duration: alert.severity === 'critical' ? alert.suggestedCooldown : null,
        detected_at: alert.detectedAt.toISOString(),
      });
    } catch (error) {
      console.error('Failed to save emotional trading alert:', error);
    }
  }

  /**
   * 启动冷静期 (Requirement 5.4)
   */
  startCooldown(minutes: number, reason: string): void {
    const duration = minutes || this.userCooldownDuration;
    this.cooldownUntil = new Date(Date.now() + duration * 60 * 1000);
    this.cooldownReason = reason;
    
    console.log(`Cooldown started: ${duration} minutes, reason: ${reason}`);
  }

  /**
   * 结束冷静期
   */
  endCooldown(): void {
    this.cooldownUntil = null;
    this.cooldownReason = null;
  }

  /**
   * 获取冷静期状态 (Requirement 5.4)
   */
  getCooldownStatus(): CooldownStatus {
    if (!this.cooldownUntil) {
      return {
        active: false,
        endsAt: null,
        remainingMinutes: 0,
        reason: null,
      };
    }
    
    const now = Date.now();
    const endsAt = this.cooldownUntil.getTime();
    
    if (now >= endsAt) {
      this.endCooldown();
      return {
        active: false,
        endsAt: null,
        remainingMinutes: 0,
        reason: null,
      };
    }
    
    return {
      active: true,
      endsAt: this.cooldownUntil,
      remainingMinutes: Math.ceil((endsAt - now) / (60 * 1000)),
      reason: this.cooldownReason,
    };
  }

  /**
   * 检查是否允许交易
   */
  isTradingAllowed(): boolean {
    return !this.getCooldownStatus().active;
  }

  /**
   * 设置用户冷静期时长 (Requirement 5.4)
   */
  async setUserCooldownDuration(minutes: number): Promise<void> {
    if (minutes < 0 || minutes > 1440) {
      throw new Error('冷静期时长必须在 0-1440 分钟之间');
    }
    
    this.userCooldownDuration = minutes;
    
    // 保存到数据库
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('user_risk_config').upsert({
          user_id: 1,
          cooldown_duration: minutes,
        });
      } catch (error) {
        console.error('Failed to save cooldown duration:', error);
      }
    }
  }

  /**
   * 加载用户设置
   */
  async loadUserSettings(userId: number = 1): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('user_risk_config')
        .select('cooldown_duration, auto_cooldown_enabled')
        .eq('user_id', userId)
        .single();
      
      if (data && !error) {
        this.userCooldownDuration = data.cooldown_duration ?? DEFAULT_COOLDOWN_MINUTES;
      }
    } catch (error) {
      console.error('Failed to load user settings:', error);
    }
  }

  /**
   * 生成交易行为分析报告 (Requirement 5.3)
   */
  async generateReport(days: number = 7): Promise<TradingBehaviorReport> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    
    // 获取历史事件
    const events = await this.getHistoricalEvents(days);
    
    // 统计交易数据
    const trades = this.recentTrades.filter(
      t => t.timestamp >= startDate && t.timestamp <= endDate
    );
    
    const buyCount = trades.filter(t => t.action === 'buy').length;
    const sellCount = trades.filter(t => t.action === 'sell').length;
    const avgTradesPerDay = trades.length / days;
    
    // 计算风险分数
    const riskScore = this.calculateRiskScore(events, avgTradesPerDay);
    
    // 生成建议
    const recommendations = this.generateRecommendations(events, avgTradesPerDay);
    
    return {
      period: { start: startDate, end: endDate },
      totalTrades: trades.length,
      buyCount,
      sellCount,
      avgTradesPerDay,
      emotionalEvents: events,
      riskScore,
      recommendations,
    };
  }

  /**
   * 获取历史情绪化交易事件 (Requirement 5.5)
   */
  async getHistoricalEvents(days: number = 30): Promise<EmotionalTradingAlert[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    try {
      const { data, error } = await supabase
        .from('emotional_trading_events')
        .select('*')
        .gte('detected_at', since.toISOString())
        .order('detected_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((row: Record<string, unknown>) => ({
        type: row.event_type as EmotionalEventType,
        severity: row.severity as EventSeverity,
        message: (row.details as Record<string, unknown>)?.message as string || '',
        suggestedCooldown: (row.details as Record<string, unknown>)?.suggestedCooldown as number || 60,
        detectedAt: new Date(row.detected_at as string),
        triggerTrades: [],
      }));
    } catch (error) {
      console.error('Failed to get historical events:', error);
      return [];
    }
  }

  /**
   * 计算风险分数
   */
  private calculateRiskScore(events: EmotionalTradingAlert[], avgTradesPerDay: number): number {
    let score = 0;
    
    // 基于事件数量
    score += events.length * 10;
    
    // 基于事件严重程度
    const criticalCount = events.filter(e => e.severity === 'critical').length;
    score += criticalCount * 15;
    
    // 基于交易频率
    if (avgTradesPerDay > 10) score += 20;
    else if (avgTradesPerDay > 5) score += 10;
    
    return Math.min(100, score);
  }

  /**
   * 生成建议
   */
  private generateRecommendations(
    events: EmotionalTradingAlert[], 
    avgTradesPerDay: number
  ): string[] {
    const recommendations: string[] = [];
    
    const hasRevenge = events.some(e => e.type === 'revenge_trading');
    const hasOvertrading = events.some(e => e.type === 'overtrading');
    const hasPanic = events.some(e => e.type === 'panic_selling');
    const hasFomo = events.some(e => e.type === 'fomo_buying');
    
    if (hasRevenge) {
      recommendations.push('建议在亏损后暂停交易，避免报复性加仓');
    }
    
    if (hasOvertrading || avgTradesPerDay > 5) {
      recommendations.push('建议减少交易频率，专注于高质量的交易机会');
    }
    
    if (hasPanic) {
      recommendations.push('建议设置止损单，避免在恐慌中做出决策');
    }
    
    if (hasFomo) {
      recommendations.push('建议制定买入计划，避免追涨');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('交易行为良好，继续保持理性决策');
    }
    
    return recommendations;
  }

  /**
   * 注册预警监听器
   */
  onAlert(listener: (alert: EmotionalTradingAlert) => void): () => void {
    this.alertListeners.push(listener);
    return () => {
      const index = this.alertListeners.indexOf(listener);
      if (index > -1) {
        this.alertListeners.splice(index, 1);
      }
    };
  }

  /**
   * 通知监听器
   */
  private notifyListeners(alert: EmotionalTradingAlert): void {
    for (const listener of this.alertListeners) {
      try {
        listener(alert);
      } catch (error) {
        console.error('Alert listener error:', error);
      }
    }
  }

  /**
   * 清除交易记录（用于测试）
   */
  clearTrades(): void {
    this.recentTrades = [];
  }
}

// === Export Singleton ===

export const emotionalTradingDetector = new EmotionalTradingDetector();

// === Pure Functions for Testing ===

export const _testing = {
  DETECTION_THRESHOLDS,
  DEFAULT_COOLDOWN_MINUTES,
};
