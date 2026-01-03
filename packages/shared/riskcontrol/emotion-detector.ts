/**
 * 情绪交易检测服务 (EmotionTradingDetector)
 * 
 * 检测可能的情绪化交易行为
 * - 报复性交易：亏损后快速加仓
 * - FOMO 交易：追涨杀跌
 * - 恐慌性交易：大幅波动时的冲动操作
 * 
 * **Validates: Requirements 29.1, 29.2, 29.3**
 * 
 * @module @echoai/shared/riskcontrol/emotion-detector
 */

// ============================================
// 类型定义
// ============================================

export type EmotionType = 
  | 'revenge_trading'    // 报复性交易
  | 'fomo'               // 追涨恐惧
  | 'panic_selling'      // 恐慌性抛售
  | 'overconfidence'     // 过度自信
  | 'loss_aversion';     // 损失厌恶

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface EmotionAlert {
  type: EmotionType;
  severity: AlertSeverity;
  message: string;
  detectedAt: Date;
  context: EmotionContext;
  recommendation: string;
}

export interface EmotionContext {
  recentLoss?: number;
  timeSinceLoss?: number;  // 分钟
  positionIncrease?: number;
  priceChange?: number;
  volumeSpike?: number;
  consecutiveActions?: number;
}

export interface TradingAction {
  type: 'buy' | 'sell';
  ticker: string;
  quantity: number;
  price: number;
  timestamp: Date;
  pnl?: number;  // 该笔交易的盈亏
}

export interface EmotionDetectorConfig {
  // 报复性交易检测
  revengeLossThreshold: number;      // 触发检测的亏损阈值（百分比）
  revengeTimeWindow: number;         // 时间窗口（分钟）
  revengePositionIncrease: number;   // 仓位增加阈值（百分比）
  
  // FOMO 检测
  fomopriceChangeThreshold: number;  // 价格变化阈值（百分比）
  fomoVolumeSpike: number;           // 成交量激增倍数
  
  // 恐慌性交易检测
  panicPriceDropThreshold: number;   // 价格下跌阈值（百分比）
  panicSellRatio: number;            // 卖出比例阈值
  
  // 通用配置
  enabled: boolean;
  alertCooldown: number;             // 警报冷却时间（分钟）
}

// ============================================
// 默认配置
// ============================================

/**
 * 默认情绪检测配置
 * **重要**: 这些阈值必须与原 RiskControl 实现保持一致
 * **Validates: Requirements 29.1, 29.2**
 */
export const DEFAULT_EMOTION_CONFIG: EmotionDetectorConfig = {
  // 报复性交易：亏损 > 5% 后 1 小时内仓位增加 > 50%
  revengeLossThreshold: 0.05,
  revengeTimeWindow: 60,
  revengePositionIncrease: 0.50,
  
  // FOMO：价格上涨 > 10% 且成交量激增 > 3 倍
  fomopriceChangeThreshold: 0.10,
  fomoVolumeSpike: 3.0,
  
  // 恐慌性交易：价格下跌 > 5% 时卖出 > 30% 仓位
  panicPriceDropThreshold: 0.05,
  panicSellRatio: 0.30,
  
  enabled: true,
  alertCooldown: 30,
};

// ============================================
// 情绪交易检测服务
// ============================================

export class EmotionTradingDetector {
  private config: EmotionDetectorConfig;
  private recentActions: TradingAction[] = [];
  private recentAlerts: Map<EmotionType, Date> = new Map();
  private maxActionsHistory = 100;

  constructor(config: EmotionDetectorConfig = DEFAULT_EMOTION_CONFIG) {
    this.config = config;
  }

  /**
   * 记录交易行为
   */
  recordAction(action: TradingAction): void {
    this.recentActions.push(action);
    
    // 保持历史记录在限制内
    if (this.recentActions.length > this.maxActionsHistory) {
      this.recentActions.shift();
    }
  }

  /**
   * 检测情绪化交易
   * 
   * **Property 7: 情绪交易检测准确性**
   * **Validates: Requirements 29.2, 29.3**
   */
  detectEmotionalTrading(
    currentAction: TradingAction,
    marketContext?: { priceChange24h?: number; volumeRatio?: number }
  ): EmotionAlert[] {
    if (!this.config.enabled) {
      return [];
    }

    const alerts: EmotionAlert[] = [];

    // 检测报复性交易
    const revengeAlert = this.detectRevengeTading(currentAction);
    if (revengeAlert) alerts.push(revengeAlert);

    // 检测 FOMO
    const fomoAlert = this.detectFOMO(currentAction, marketContext);
    if (fomoAlert) alerts.push(fomoAlert);

    // 检测恐慌性交易
    const panicAlert = this.detectPanicSelling(currentAction, marketContext);
    if (panicAlert) alerts.push(panicAlert);

    // 检测过度自信
    const overconfidenceAlert = this.detectOverconfidence(currentAction);
    if (overconfidenceAlert) alerts.push(overconfidenceAlert);

    // 记录当前行为
    this.recordAction(currentAction);

    return alerts;
  }

  /**
   * 检测报复性交易
   * 
   * 条件：亏损 > 5% 后 1 小时内仓位增加 > 50%
   */
  detectRevengeTading(action: TradingAction): EmotionAlert | null {
    if (action.type !== 'buy') return null;
    if (!this.canAlert('revenge_trading')) return null;

    const now = action.timestamp;
    const windowStart = new Date(now.getTime() - this.config.revengeTimeWindow * 60 * 1000);

    // 查找时间窗口内的亏损交易
    const recentLosses = this.recentActions.filter(a => 
      a.timestamp >= windowStart &&
      a.pnl !== undefined &&
      a.pnl < 0
    );

    if (recentLosses.length === 0) return null;

    // 计算总亏损
    const totalLoss = recentLosses.reduce((sum, a) => sum + (a.pnl || 0), 0);
    const lossRatio = Math.abs(totalLoss);

    if (lossRatio < this.config.revengeLossThreshold) return null;

    // 计算仓位增加
    const recentBuys = this.recentActions.filter(a =>
      a.timestamp >= windowStart &&
      a.type === 'buy' &&
      a.ticker === action.ticker
    );

    const totalBuyValue = recentBuys.reduce((sum, a) => sum + a.quantity * a.price, 0);
    const currentBuyValue = action.quantity * action.price;
    const positionIncrease = currentBuyValue / (totalBuyValue || 1);

    if (positionIncrease < this.config.revengePositionIncrease) return null;

    this.markAlerted('revenge_trading');

    return {
      type: 'revenge_trading',
      severity: 'high',
      message: `检测到可能的报复性交易：近期亏损 ${(lossRatio * 100).toFixed(1)}% 后快速加仓`,
      detectedAt: now,
      context: {
        recentLoss: lossRatio,
        timeSinceLoss: this.config.revengeTimeWindow,
        positionIncrease,
      },
      recommendation: '建议冷静思考，避免情绪化决策。考虑等待 24 小时后再做交易决定。',
    };
  }

  /**
   * 检测 FOMO 交易
   * 
   * 条件：价格上涨 > 10% 且成交量激增时买入
   */
  detectFOMO(
    action: TradingAction,
    marketContext?: { priceChange24h?: number; volumeRatio?: number }
  ): EmotionAlert | null {
    if (action.type !== 'buy') return null;
    if (!marketContext) return null;
    if (!this.canAlert('fomo')) return null;

    const { priceChange24h, volumeRatio } = marketContext;

    if (
      priceChange24h !== undefined &&
      volumeRatio !== undefined &&
      priceChange24h > this.config.fomopriceChangeThreshold &&
      volumeRatio > this.config.fomoVolumeSpike
    ) {
      this.markAlerted('fomo');

      return {
        type: 'fomo',
        severity: 'medium',
        message: `检测到可能的 FOMO 交易：${action.ticker} 24h 涨幅 ${(priceChange24h * 100).toFixed(1)}%，成交量激增 ${volumeRatio.toFixed(1)} 倍`,
        detectedAt: action.timestamp,
        context: {
          priceChange: priceChange24h,
          volumeSpike: volumeRatio,
        },
        recommendation: '追涨有风险，建议评估基本面后再决定。考虑分批建仓降低风险。',
      };
    }

    return null;
  }

  /**
   * 检测恐慌性抛售
   * 
   * 条件：价格下跌 > 5% 时卖出 > 30% 仓位
   */
  detectPanicSelling(
    action: TradingAction,
    marketContext?: { priceChange24h?: number; volumeRatio?: number }
  ): EmotionAlert | null {
    if (action.type !== 'sell') return null;
    if (!marketContext?.priceChange24h) return null;
    if (!this.canAlert('panic_selling')) return null;

    const priceChange = marketContext.priceChange24h;

    // 价格下跌超过阈值
    if (priceChange > -this.config.panicPriceDropThreshold) return null;

    // 检查是否大量卖出（需要持仓信息，这里简化处理）
    // 实际实现中应该比较卖出量与总持仓
    const recentSells = this.recentActions.filter(a =>
      a.type === 'sell' &&
      a.ticker === action.ticker &&
      a.timestamp >= new Date(action.timestamp.getTime() - 60 * 60 * 1000)
    );

    if (recentSells.length >= 2) {
      this.markAlerted('panic_selling');

      return {
        type: 'panic_selling',
        severity: 'high',
        message: `检测到可能的恐慌性抛售：${action.ticker} 下跌 ${(Math.abs(priceChange) * 100).toFixed(1)}% 时连续卖出`,
        detectedAt: action.timestamp,
        context: {
          priceChange,
          consecutiveActions: recentSells.length + 1,
        },
        recommendation: '市场波动时保持冷静。如果基本面没有变化，考虑持有或分批减仓。',
      };
    }

    return null;
  }

  /**
   * 检测过度自信
   * 
   * 条件：连续盈利后大幅加仓
   */
  detectOverconfidence(action: TradingAction): EmotionAlert | null {
    if (action.type !== 'buy') return null;
    if (!this.canAlert('overconfidence')) return null;

    // 检查最近是否连续盈利
    const recentProfits = this.recentActions
      .filter(a => a.pnl !== undefined && a.pnl > 0)
      .slice(-5);

    if (recentProfits.length < 3) return null;

    // 检查是否大幅加仓
    const avgBuyValue = this.recentActions
      .filter(a => a.type === 'buy')
      .slice(-5)
      .reduce((sum, a) => sum + a.quantity * a.price, 0) / 5;

    const currentBuyValue = action.quantity * action.price;

    if (currentBuyValue > avgBuyValue * 2) {
      this.markAlerted('overconfidence');

      return {
        type: 'overconfidence',
        severity: 'medium',
        message: '检测到可能的过度自信：连续盈利后大幅加仓',
        detectedAt: action.timestamp,
        context: {
          consecutiveActions: recentProfits.length,
          positionIncrease: currentBuyValue / avgBuyValue,
        },
        recommendation: '连续盈利可能导致过度自信。建议保持纪律，不要偏离原有策略。',
      };
    }

    return null;
  }

  /**
   * 获取最近的警报
   */
  getRecentAlerts(): EmotionAlert[] {
    // 实际实现中应该从存储中获取
    return [];
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.recentActions = [];
    this.recentAlerts.clear();
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<EmotionDetectorConfig>): void {
    Object.assign(this.config, updates);
  }

  // ============================================
  // 私有方法
  // ============================================

  private canAlert(type: EmotionType): boolean {
    const lastAlert = this.recentAlerts.get(type);
    if (!lastAlert) return true;

    const cooldownMs = this.config.alertCooldown * 60 * 1000;
    return Date.now() - lastAlert.getTime() > cooldownMs;
  }

  private markAlerted(type: EmotionType): void {
    this.recentAlerts.set(type, new Date());
  }
}

// ============================================
// 单例导出
// ============================================

let emotionDetectorInstance: EmotionTradingDetector | null = null;

export function initEmotionDetector(
  config?: EmotionDetectorConfig
): EmotionTradingDetector {
  emotionDetectorInstance = new EmotionTradingDetector(config);
  return emotionDetectorInstance;
}

export function getEmotionDetector(): EmotionTradingDetector | null {
  return emotionDetectorInstance;
}

export default EmotionTradingDetector;
