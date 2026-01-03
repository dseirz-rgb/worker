/**
 * Dynamic Leverage Controller
 * 
 * 根据市场状态和波动率动态调整杠杆限制。
 * 
 * Requirements:
 * - 1.1: bull 市场允许最高 1.5x 杠杆
 * - 1.2: sideways 市场允许最高 1.3x 杠杆
 * - 1.3: bear/high_volatility 市场允许最高 1.0x（禁止杠杆）
 * - 1.4: 波动率超过 80 分位额外降低 0.2x
 * - 1.5: 市场状态变化后 1 小时内更新
 * - 1.6: 杠杆变化时通知用户并记录历史
 */

import { getMarketRegime, predictVolatility, MarketRegime } from './qlibClient';
import { getSupabaseClient } from './supabase';

// === Types ===

export interface LeverageLimit {
  maxLeverage: number;
  reason: string;
  marketRegime: string;
  volatilityAdjustment: number;
  volatilityPercentile: number | null;
  effectiveAt: Date;
  expiresAt: Date;
}

export interface LeverageChangeEvent {
  previousLimit: number;
  newLimit: number;
  marketRegime: string;
  volatilityAdjustment: number;
  reason: string;
  effectiveAt: Date;
}

// === Constants ===

// 基础杠杆限制映射 (Requirements 1.1, 1.2, 1.3)
const BASE_LEVERAGE_LIMITS: Record<string, number> = {
  bull: 1.5,
  sideways: 1.3,
  bear: 1.0,
  high_volatility: 1.0,
};

// 波动率分位数阈值 (Requirement 1.4)
const HIGH_VOLATILITY_PERCENTILE = 80;
const VOLATILITY_ADJUSTMENT = -0.2;

// 杠杆限制有效期 (Requirement 1.5)
const LEVERAGE_LIMIT_TTL_MS = 60 * 60 * 1000; // 1 hour

// 历史波动率分位数参考值（实际应从数据库获取）
const HISTORICAL_VOLATILITY_PERCENTILES: Record<number, number> = {
  30: 0.012,  // 30th percentile
  50: 0.018,  // 50th percentile
  70: 0.022,  // 70th percentile
  80: 0.025,  // 80th percentile
  90: 0.032,  // 90th percentile
};


// === Helper Functions ===

/**
 * 计算波动率分位数
 */
function calculateVolatilityPercentile(volatility: number): number {
  const percentiles = Object.entries(HISTORICAL_VOLATILITY_PERCENTILES)
    .map(([p, v]) => ({ percentile: Number(p), value: v }))
    .sort((a, b) => a.value - b.value);
  
  for (const { percentile, value } of percentiles) {
    if (volatility <= value) {
      return percentile;
    }
  }
  return 95; // 超过所有阈值
}

/**
 * 判断是否为高波动率 (Requirement 1.4)
 */
function isHighVolatility(volatility: number): boolean {
  const percentile = calculateVolatilityPercentile(volatility);
  return percentile >= HIGH_VOLATILITY_PERCENTILE;
}

/**
 * 生成杠杆限制原因说明
 */
function generateReason(
  regime: string,
  baseLeverage: number,
  volatilityAdjustment: number,
  volatilityPercentile: number | null
): string {
  const regimeNames: Record<string, string> = {
    bull: '牛市',
    sideways: '震荡市',
    bear: '熊市',
    high_volatility: '高波动',
  };
  
  let reason = `市场状态: ${regimeNames[regime] || regime}，基础杠杆限制 ${baseLeverage}x`;
  
  if (volatilityAdjustment < 0 && volatilityPercentile !== null) {
    reason += `；波动率处于 ${volatilityPercentile} 分位（超过 ${HIGH_VOLATILITY_PERCENTILE} 分位），额外降低 ${Math.abs(volatilityAdjustment)}x`;
  }
  
  return reason;
}

// === Main Class ===

class DynamicLeverageController {
  private cachedLimit: LeverageLimit | null = null;
  private lastRegime: string | null = null;
  private changeListeners: ((event: LeverageChangeEvent) => void)[] = [];

  /**
   * 计算当前杠杆限制 (Requirements 1.1-1.4)
   */
  async calculateLeverageLimit(market: string = 'us'): Promise<LeverageLimit> {
    // 检查缓存是否有效
    if (this.cachedLimit && new Date() < this.cachedLimit.expiresAt) {
      return this.cachedLimit;
    }

    try {
      // 获取市场状态
      const regime = await getMarketRegime(market);
      const currentRegime = regime.current_regime;
      
      // 获取波动率预测
      let predictedVolatility = 0;
      let volatilityPercentile: number | null = null;
      
      try {
        const volatilityPredictions = await predictVolatility('SPY', [5]);
        if (volatilityPredictions.length > 0) {
          predictedVolatility = volatilityPredictions[0].predicted_volatility;
          volatilityPercentile = calculateVolatilityPercentile(predictedVolatility);
        }
      } catch (error) {
        console.warn('Failed to get volatility prediction, using regime only:', error);
      }
      
      // 计算基础杠杆限制
      const baseLeverage = BASE_LEVERAGE_LIMITS[currentRegime] ?? 1.0;
      
      // 波动率调整 (Requirement 1.4)
      let volatilityAdjustment = 0;
      if (volatilityPercentile !== null && isHighVolatility(predictedVolatility)) {
        volatilityAdjustment = VOLATILITY_ADJUSTMENT;
      }
      
      // 最终杠杆限制（不低于 1.0）
      const maxLeverage = Math.max(1.0, baseLeverage + volatilityAdjustment);
      
      const now = new Date();
      const limit: LeverageLimit = {
        maxLeverage,
        reason: generateReason(currentRegime, baseLeverage, volatilityAdjustment, volatilityPercentile),
        marketRegime: currentRegime,
        volatilityAdjustment,
        volatilityPercentile,
        effectiveAt: now,
        expiresAt: new Date(now.getTime() + LEVERAGE_LIMIT_TTL_MS),
      };
      
      // 检测变化并触发通知 (Requirement 1.6)
      if (this.cachedLimit && this.cachedLimit.maxLeverage !== maxLeverage) {
        await this.handleLeverageChange(this.cachedLimit.maxLeverage, limit);
      }
      
      this.cachedLimit = limit;
      this.lastRegime = currentRegime;
      
      return limit;
    } catch (error) {
      console.error('Failed to calculate leverage limit:', error);
      // 返回保守默认值
      return this.getConservativeDefault();
    }
  }


  /**
   * 处理杠杆限制变化 (Requirement 1.6)
   */
  private async handleLeverageChange(
    previousLimit: number,
    newLimit: LeverageLimit
  ): Promise<void> {
    const event: LeverageChangeEvent = {
      previousLimit,
      newLimit: newLimit.maxLeverage,
      marketRegime: newLimit.marketRegime,
      volatilityAdjustment: newLimit.volatilityAdjustment,
      reason: newLimit.reason,
      effectiveAt: newLimit.effectiveAt,
    };
    
    // 记录到数据库
    await this.recordLeverageChange(event);
    
    // 通知监听器
    this.notifyListeners(event);
  }

  /**
   * 记录杠杆变更历史
   */
  private async recordLeverageChange(event: LeverageChangeEvent): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      
      await supabase.from('leverage_change_history').insert({
        previous_limit: event.previousLimit,
        new_limit: event.newLimit,
        market_regime: event.marketRegime,
        volatility_adjustment: event.volatilityAdjustment,
        reason: event.reason,
        effective_at: event.effectiveAt.toISOString(),
        expires_at: new Date(event.effectiveAt.getTime() + LEVERAGE_LIMIT_TTL_MS).toISOString(),
      });
    } catch (error) {
      console.error('Failed to record leverage change:', error);
    }
  }

  /**
   * 通知变更监听器
   */
  private notifyListeners(event: LeverageChangeEvent): void {
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Leverage change listener error:', error);
      }
    }
  }

  /**
   * 注册杠杆变更监听器
   */
  onLeverageChange(listener: (event: LeverageChangeEvent) => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * 获取保守默认值（服务不可用时使用）
   */
  private getConservativeDefault(): LeverageLimit {
    const now = new Date();
    return {
      maxLeverage: 1.0,
      reason: '无法获取市场数据，使用保守默认值',
      marketRegime: 'unknown',
      volatilityAdjustment: 0,
      volatilityPercentile: null,
      effectiveAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000), // 5 分钟后重试
    };
  }

  /**
   * 强制刷新杠杆限制
   */
  async refresh(market: string = 'us'): Promise<LeverageLimit> {
    this.cachedLimit = null;
    return this.calculateLeverageLimit(market);
  }

  /**
   * 获取缓存的杠杆限制（不触发 API 调用）
   */
  getCachedLimit(): LeverageLimit | null {
    if (this.cachedLimit && new Date() < this.cachedLimit.expiresAt) {
      return this.cachedLimit;
    }
    return null;
  }

  /**
   * 检查当前杠杆是否超限
   */
  async isLeverageExceeded(currentLeverage: number, market: string = 'us'): Promise<{
    exceeded: boolean;
    limit: LeverageLimit;
    excess: number;
  }> {
    const limit = await this.calculateLeverageLimit(market);
    const exceeded = currentLeverage > limit.maxLeverage;
    return {
      exceeded,
      limit,
      excess: exceeded ? currentLeverage - limit.maxLeverage : 0,
    };
  }

  /**
   * 获取杠杆变更历史
   */
  async getLeverageHistory(
    days: number = 30,
    userId: number = 1
  ): Promise<LeverageChangeEvent[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const { data, error } = await supabase
      .from('leverage_change_history')
      .select('*')
      .eq('user_id', userId)
      .gte('effective_at', since.toISOString())
      .order('effective_at', { ascending: false });
    
    if (error) {
      console.error('Failed to get leverage history:', error);
      return [];
    }
    
    return (data || []).map((row: Record<string, unknown>) => ({
      previousLimit: row.previous_limit as number,
      newLimit: row.new_limit as number,
      marketRegime: row.market_regime as string,
      volatilityAdjustment: row.volatility_adjustment as number,
      reason: row.reason as string,
      effectiveAt: new Date(row.effective_at as string),
    }));
  }
}

// === Export Singleton ===

export const dynamicLeverageController = new DynamicLeverageController();

// === Pure Functions for Testing ===

export const _testing = {
  calculateVolatilityPercentile,
  isHighVolatility,
  generateReason,
  BASE_LEVERAGE_LIMITS,
  HIGH_VOLATILITY_PERCENTILE,
  VOLATILITY_ADJUSTMENT,
};
