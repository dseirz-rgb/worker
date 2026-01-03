/**
 * Risk Integration Service - 风控集成层
 * Feature: realtime-market-platform
 * 
 * 将实时行情与风控系统集成，实现实时风控指标计算和阈值检查
 * 
 * Property 7: 风控阈值触发
 * Validates: Requirements 5.1, 5.2, 5.3, 5.5
 */

import { DEFAULT_THRESHOLDS as RISK_METRICS_THRESHOLDS } from './riskMetricsService';
import { checkRiskAlerts } from './riskAlertService';

// ============ 类型定义 ============

export type RiskAlertType = 
  | 'leverage_exceeded'
  | 'leverage_warning'
  | 'loss_limit_exceeded'
  | 'loss_warning'
  | 'trailing_stop_triggered';

export interface QuoteUpdate {
  ticker: string;
  price: number;
  changePercent: number;
  previousClose: number;
  timestamp: number;
}

export interface RealTimeRiskMetrics {
  // 实时杠杆率
  currentLeverage: number;
  leverageLimit: number;
  leverageUtilization: number; // 杠杆使用率 (0-1)
  
  // 实时盈亏
  dailyPnL: number;
  dailyPnLPercent: number;
  dailyLossLimit: number;
  lossUtilization: number; // 亏损使用率 (0-1)
  
  // 移动止盈
  trailingStopLevel: number | null;
  currentHighWaterMark: number;
  
  // 风控状态
  isLeverageExceeded: boolean;
  isLossLimitExceeded: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // 时间戳
  lastUpdated: number;
}

export interface PositionUpdate {
  ticker: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export interface RiskThresholdConfig {
  leverageWarning: number;  // 杠杆警告阈值 (如 1.5)
  leverageLimit: number;    // 杠杆限制阈值 (如 2.0)
  dailyLossWarning: number; // 日亏损警告阈值 (如 -3%)
  dailyLossLimit: number;   // 日亏损限制阈值 (如 -5%)
  trailingStopPercent: number; // 移动止盈回撤比例 (如 10%)
}

// ============ 默认配置 ============

const DEFAULT_THRESHOLDS: RiskThresholdConfig = {
  leverageWarning: 1.5,
  leverageLimit: 2.0,
  dailyLossWarning: -3,
  dailyLossLimit: -5,
  trailingStopPercent: 10,
};

// ============ 风控集成服务类 ============

class RiskIntegrationService {
  private positions: Map<string, PositionUpdate> = new Map();
  private thresholds: RiskThresholdConfig = DEFAULT_THRESHOLDS;
  private highWaterMark: number = 0;
  private lastMetrics: RealTimeRiskMetrics | null = null;
  private onRiskAlertCallbacks: Array<(alert: RiskAlertType, message: string) => void> = [];

  /**
   * 设置风控阈值配置
   */
  setThresholds(config: Partial<RiskThresholdConfig>): void {
    this.thresholds = { ...this.thresholds, ...config };
  }

  /**
   * 获取当前阈值配置
   */
  getThresholds(): RiskThresholdConfig {
    return { ...this.thresholds };
  }

  /**
   * 更新持仓信息
   */
  updatePosition(position: PositionUpdate): void {
    this.positions.set(position.ticker, position);
  }

  /**
   * 批量更新持仓
   */
  updatePositions(positions: PositionUpdate[]): void {
    positions.forEach(p => this.positions.set(p.ticker, p));
  }

  /**
   * 清除持仓
   */
  clearPositions(): void {
    this.positions.clear();
  }

  /**
   * 处理行情更新
   * Property 7: 风控阈值触发
   * Requirements: 5.1
   */
  onQuoteUpdate(quote: QuoteUpdate): RealTimeRiskMetrics {
    // 更新对应持仓的当前价格
    const position = this.positions.get(quote.ticker);
    if (position) {
      position.currentPrice = quote.price;
      position.marketValue = position.quantity * quote.price;
      position.unrealizedPnL = (quote.price - position.avgCost) * position.quantity;
      position.unrealizedPnLPercent = ((quote.price - position.avgCost) / position.avgCost) * 100;
    }

    // 计算实时风控指标
    const metrics = this.calculateRealTimeMetrics();
    
    // 检查阈值并触发警报
    this.checkThresholds(metrics);
    
    this.lastMetrics = metrics;
    return metrics;
  }

  /**
   * 获取实时风控指标
   * Requirements: 5.1
   */
  getRealTimeMetrics(): RealTimeRiskMetrics {
    if (this.lastMetrics) {
      return this.lastMetrics;
    }
    return this.calculateRealTimeMetrics();
  }

  /**
   * 计算实时风控指标
   */
  private calculateRealTimeMetrics(): RealTimeRiskMetrics {
    // 计算总市值和总盈亏
    let totalMarketValue = 0;
    let totalUnrealizedPnL = 0;
    let totalCost = 0;

    this.positions.forEach(position => {
      totalMarketValue += position.marketValue;
      totalUnrealizedPnL += position.unrealizedPnL;
      totalCost += position.avgCost * position.quantity;
    });
    
    // 计算杠杆率 (假设净资产为总成本)
    const netAssets = totalCost > 0 ? totalCost : 1;
    const currentLeverage = totalMarketValue / netAssets;
    const leverageUtilization = currentLeverage / this.thresholds.leverageLimit;

    // 计算日盈亏百分比
    const dailyPnLPercent = totalCost > 0 ? (totalUnrealizedPnL / totalCost) * 100 : 0;
    const lossUtilization = dailyPnLPercent < 0 
      ? Math.abs(dailyPnLPercent) / Math.abs(this.thresholds.dailyLossLimit)
      : 0;

    // 更新高水位
    if (totalMarketValue > this.highWaterMark) {
      this.highWaterMark = totalMarketValue;
    }

    // 计算移动止盈线
    const trailingStopLevel = this.highWaterMark > 0
      ? this.highWaterMark * (1 - this.thresholds.trailingStopPercent / 100)
      : null;

    // 判断风控状态
    const isLeverageExceeded = currentLeverage > this.thresholds.leverageLimit;
    const isLossLimitExceeded = dailyPnLPercent < this.thresholds.dailyLossLimit;

    // 计算风险等级
    const riskLevel = this.calculateRiskLevel(
      leverageUtilization,
      lossUtilization,
      isLeverageExceeded,
      isLossLimitExceeded
    );

    return {
      currentLeverage,
      leverageLimit: this.thresholds.leverageLimit,
      leverageUtilization: Math.min(leverageUtilization, 1),
      dailyPnL: totalUnrealizedPnL,
      dailyPnLPercent,
      dailyLossLimit: this.thresholds.dailyLossLimit,
      lossUtilization: Math.min(lossUtilization, 1),
      trailingStopLevel,
      currentHighWaterMark: this.highWaterMark,
      isLeverageExceeded,
      isLossLimitExceeded,
      riskLevel,
      lastUpdated: Date.now(),
    };
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(
    leverageUtilization: number,
    lossUtilization: number,
    isLeverageExceeded: boolean,
    isLossLimitExceeded: boolean
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (isLeverageExceeded || isLossLimitExceeded) {
      return 'critical';
    }
    
    const maxUtilization = Math.max(leverageUtilization, lossUtilization);
    
    if (maxUtilization >= 0.8) {
      return 'high';
    } else if (maxUtilization >= 0.5) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * 检查阈值并触发警报
   * Property 7: 风控阈值触发
   * Requirements: 5.2, 5.3
   */
  private checkThresholds(metrics: RealTimeRiskMetrics): void {
    // 杠杆率超限检查
    if (metrics.isLeverageExceeded) {
      this.triggerAlert(
        'leverage_exceeded',
        `杠杆率超限！当前杠杆: ${metrics.currentLeverage.toFixed(2)}x，限制: ${metrics.leverageLimit}x`
      );
    } else if (metrics.currentLeverage > this.thresholds.leverageWarning) {
      this.triggerAlert(
        'leverage_warning',
        `杠杆率警告！当前杠杆: ${metrics.currentLeverage.toFixed(2)}x，警告阈值: ${this.thresholds.leverageWarning}x`
      );
    }

    // 日亏损超限检查
    if (metrics.isLossLimitExceeded) {
      this.triggerAlert(
        'loss_limit_exceeded',
        `日亏损超限！当前亏损: ${metrics.dailyPnLPercent.toFixed(2)}%，限制: ${metrics.dailyLossLimit}%`
      );
    } else if (metrics.dailyPnLPercent < this.thresholds.dailyLossWarning) {
      this.triggerAlert(
        'loss_warning',
        `日亏损警告！当前亏损: ${metrics.dailyPnLPercent.toFixed(2)}%，警告阈值: ${this.thresholds.dailyLossWarning}%`
      );
    }

    // 移动止盈检查
    if (metrics.trailingStopLevel !== null) {
      const totalMarketValue = Array.from(this.positions.values())
        .reduce((sum, p) => sum + p.marketValue, 0);
      
      if (totalMarketValue < metrics.trailingStopLevel) {
        this.triggerAlert(
          'trailing_stop_triggered',
          `移动止盈触发！当前市值: ${totalMarketValue.toFixed(2)}，止盈线: ${metrics.trailingStopLevel.toFixed(2)}`
        );
      }
    }
  }

  /**
   * 触发风控警报
   */
  private triggerAlert(type: RiskAlertType, message: string): void {
    console.warn(`[RiskIntegration] Alert: ${type} - ${message}`);
    
    // 通知回调
    this.onRiskAlertCallbacks.forEach(cb => cb(type, message));
    
    // 使用 checkRiskAlerts 发送通知（兼容现有系统）
    // 这里简化处理，直接调用回调
  }

  /**
   * 注册风控警报回调
   */
  onRiskAlert(callback: (alert: RiskAlertType, message: string) => void): () => void {
    this.onRiskAlertCallbacks.push(callback);
    return () => {
      const index = this.onRiskAlertCallbacks.indexOf(callback);
      if (index > -1) {
        this.onRiskAlertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 重置高水位
   */
  resetHighWaterMark(): void {
    this.highWaterMark = 0;
  }

  /**
   * 计算移动止盈线
   * Requirements: 5.5
   */
  calculateTrailingStop(currentValue: number, highWaterMark: number): number | null {
    if (highWaterMark <= 0) return null;
    return highWaterMark * (1 - this.thresholds.trailingStopPercent / 100);
  }
}

// ============ 单例导出 ============

export const riskIntegrationService = new RiskIntegrationService();

// ============ 辅助函数 ============

/**
 * 检查杠杆率是否超限
 * Property 7: 风控阈值触发
 */
export function checkLeverageLimit(
  currentLeverage: number,
  limit: number
): { exceeded: boolean; utilization: number } {
  return {
    exceeded: currentLeverage > limit,
    utilization: Math.min(currentLeverage / limit, 1),
  };
}

/**
 * 检查日亏损是否超限
 * Property 7: 风控阈值触发
 */
export function checkDailyLossLimit(
  dailyPnLPercent: number,
  limit: number
): { exceeded: boolean; utilization: number } {
  const absLimit = Math.abs(limit);
  return {
    exceeded: dailyPnLPercent < -absLimit,
    utilization: dailyPnLPercent < 0 ? Math.min(Math.abs(dailyPnLPercent) / absLimit, 1) : 0,
  };
}
