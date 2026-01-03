/**
 * 价格警报服务 (PriceAlertService)
 * 
 * 管理价格警报规则和通知
 * - 支持多种警报类型（价格突破、百分比变化、技术指标）
 * - 警报去重（冷却期内不重复触发）
 * - 多渠道通知（邮件、推送、语音）
 * 
 * **Validates: Requirements 30.1, 30.2, 30.3**
 * 
 * @module @echoai/shared/riskcontrol/price-alert
 */

// ============================================
// 类型定义
// ============================================

export type AlertType = 
  | 'price_above'        // 价格高于
  | 'price_below'        // 价格低于
  | 'percent_change'     // 百分比变化
  | 'volume_spike'       // 成交量激增
  | 'ma_cross'           // 均线交叉
  | 'rsi_overbought'     // RSI 超买
  | 'rsi_oversold';      // RSI 超卖

export type NotificationChannel = 'email' | 'push' | 'voice' | 'sms';

export interface PriceAlertRule {
  id: string;
  ticker: string;
  type: AlertType;
  threshold: number;
  enabled: boolean;
  channels: NotificationChannel[];
  createdAt: Date;
  lastTriggeredAt: Date | null;
  triggerCount: number;
  cooldownMinutes: number;
  metadata?: Record<string, unknown>;
}

export interface AlertTrigger {
  ruleId: string;
  ticker: string;
  type: AlertType;
  currentValue: number;
  threshold: number;
  triggeredAt: Date;
  message: string;
}

export interface PriceData {
  ticker: string;
  price: number;
  volume?: number;
  change24h?: number;
  ma20?: number;
  ma50?: number;
  rsi?: number;
  timestamp: Date;
}

export interface AlertServiceConfig {
  defaultCooldownMinutes: number;
  maxAlertsPerTicker: number;
  enabled: boolean;
}

// ============================================
// 默认配置
// ============================================

/**
 * 默认警报配置
 * **Validates: Requirements 30.1, 30.2**
 */
export const DEFAULT_ALERT_CONFIG: AlertServiceConfig = {
  defaultCooldownMinutes: 5,  // 5 分钟冷却期
  maxAlertsPerTicker: 10,     // 每个股票最多 10 个警报
  enabled: true,
};

// ============================================
// 价格警报服务
// ============================================

export class PriceAlertService {
  private config: AlertServiceConfig;
  private rules: Map<string, PriceAlertRule> = new Map();
  private recentTriggers: Map<string, Date> = new Map(); // ruleId -> lastTriggerTime

  constructor(config: AlertServiceConfig = DEFAULT_ALERT_CONFIG) {
    this.config = config;
  }

  /**
   * 添加警报规则
   */
  addRule(rule: Omit<PriceAlertRule, 'id' | 'createdAt' | 'lastTriggeredAt' | 'triggerCount'>): PriceAlertRule {
    // 检查是否超过限制
    const tickerRules = this.getRulesByTicker(rule.ticker);
    if (tickerRules.length >= this.config.maxAlertsPerTicker) {
      throw new AlertError(
        'MAX_ALERTS_EXCEEDED',
        `Maximum alerts (${this.config.maxAlertsPerTicker}) exceeded for ${rule.ticker}`
      );
    }

    const newRule: PriceAlertRule = {
      ...rule,
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: new Date(),
      lastTriggeredAt: null,
      triggerCount: 0,
      cooldownMinutes: rule.cooldownMinutes || this.config.defaultCooldownMinutes,
    };

    this.rules.set(newRule.id, newRule);
    return newRule;
  }

  /**
   * 删除警报规则
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * 更新警报规则
   */
  updateRule(ruleId: string, updates: Partial<PriceAlertRule>): PriceAlertRule | null {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    const updatedRule = { ...rule, ...updates, id: ruleId };
    this.rules.set(ruleId, updatedRule);
    return updatedRule;
  }

  /**
   * 检查价格数据并触发警报
   * 
   * **Property 11: 价格警报去重**
   * **Validates: Requirements 30.3**
   */
  checkPriceData(data: PriceData): AlertTrigger[] {
    if (!this.config.enabled) {
      return [];
    }

    const triggers: AlertTrigger[] = [];
    const tickerRules = this.getRulesByTicker(data.ticker);

    for (const rule of tickerRules) {
      if (!rule.enabled) continue;

      // 检查冷却期
      if (!this.canTrigger(rule.id, rule.cooldownMinutes)) {
        continue;
      }

      const trigger = this.evaluateRule(rule, data);
      if (trigger) {
        // 更新规则状态
        rule.lastTriggeredAt = trigger.triggeredAt;
        rule.triggerCount++;
        this.recentTriggers.set(rule.id, trigger.triggeredAt);

        triggers.push(trigger);
      }
    }

    return triggers;
  }

  /**
   * 检查是否可以触发（冷却期检查）
   * 
   * **Property 11: 价格警报去重**
   */
  canTrigger(ruleId: string, cooldownMinutes: number): boolean {
    const lastTrigger = this.recentTriggers.get(ruleId);
    if (!lastTrigger) return true;

    const cooldownMs = cooldownMinutes * 60 * 1000;
    return Date.now() - lastTrigger.getTime() > cooldownMs;
  }

  /**
   * 获取所有规则
   */
  getAllRules(): PriceAlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取指定股票的规则
   */
  getRulesByTicker(ticker: string): PriceAlertRule[] {
    return this.getAllRules().filter(r => r.ticker === ticker);
  }

  /**
   * 获取规则
   */
  getRule(ruleId: string): PriceAlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * 启用/禁用规则
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    rule.enabled = enabled;
    return true;
  }

  /**
   * 清除所有规则
   */
  clearAllRules(): void {
    this.rules.clear();
    this.recentTriggers.clear();
  }

  /**
   * 重置规则的触发状态
   */
  resetTriggerState(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    rule.lastTriggeredAt = null;
    this.recentTriggers.delete(ruleId);
    return true;
  }

  // ============================================
  // 私有方法
  // ============================================

  private evaluateRule(rule: PriceAlertRule, data: PriceData): AlertTrigger | null {
    let triggered = false;
    let currentValue = 0;
    let message = '';

    switch (rule.type) {
      case 'price_above':
        triggered = data.price > rule.threshold;
        currentValue = data.price;
        message = `${data.ticker} 价格突破 ${rule.threshold}，当前 ${data.price.toFixed(2)}`;
        break;

      case 'price_below':
        triggered = data.price < rule.threshold;
        currentValue = data.price;
        message = `${data.ticker} 价格跌破 ${rule.threshold}，当前 ${data.price.toFixed(2)}`;
        break;

      case 'percent_change':
        if (data.change24h !== undefined) {
          triggered = Math.abs(data.change24h) > rule.threshold;
          currentValue = data.change24h;
          const direction = data.change24h > 0 ? '上涨' : '下跌';
          message = `${data.ticker} 24h ${direction} ${(Math.abs(data.change24h) * 100).toFixed(1)}%`;
        }
        break;

      case 'volume_spike':
        if (data.volume !== undefined) {
          triggered = data.volume > rule.threshold;
          currentValue = data.volume;
          message = `${data.ticker} 成交量激增至 ${data.volume.toLocaleString()}`;
        }
        break;

      case 'ma_cross':
        if (data.ma20 !== undefined && data.ma50 !== undefined) {
          // 简化：检查 MA20 是否在 MA50 上方
          const crossUp = data.ma20 > data.ma50;
          triggered = crossUp && rule.threshold > 0; // threshold > 0 表示检测金叉
          currentValue = data.ma20 - data.ma50;
          message = crossUp 
            ? `${data.ticker} MA20 上穿 MA50（金叉）`
            : `${data.ticker} MA20 下穿 MA50（死叉）`;
        }
        break;

      case 'rsi_overbought':
        if (data.rsi !== undefined) {
          triggered = data.rsi > rule.threshold;
          currentValue = data.rsi;
          message = `${data.ticker} RSI 超买：${data.rsi.toFixed(1)}`;
        }
        break;

      case 'rsi_oversold':
        if (data.rsi !== undefined) {
          triggered = data.rsi < rule.threshold;
          currentValue = data.rsi;
          message = `${data.ticker} RSI 超卖：${data.rsi.toFixed(1)}`;
        }
        break;
    }

    if (triggered) {
      return {
        ruleId: rule.id,
        ticker: data.ticker,
        type: rule.type,
        currentValue,
        threshold: rule.threshold,
        triggeredAt: new Date(),
        message,
      };
    }

    return null;
  }
}

// ============================================
// 错误类
// ============================================

export class AlertError extends Error {
  constructor(
    public code: 'MAX_ALERTS_EXCEEDED' | 'RULE_NOT_FOUND' | 'INVALID_RULE',
    message: string
  ) {
    super(message);
    this.name = 'AlertError';
  }
}

// ============================================
// 单例导出
// ============================================

let alertServiceInstance: PriceAlertService | null = null;

export function initAlertService(config?: AlertServiceConfig): PriceAlertService {
  alertServiceInstance = new PriceAlertService(config);
  return alertServiceInstance;
}

export function getAlertService(): PriceAlertService | null {
  return alertServiceInstance;
}

export default PriceAlertService;
