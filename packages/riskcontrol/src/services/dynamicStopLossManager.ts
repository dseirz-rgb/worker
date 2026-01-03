/**
 * Dynamic StopLoss Manager
 * 
 * 根据波动率动态调整止损线。
 * 
 * Requirements:
 * - 2.1: 波动率 < 30 分位，止损线 -8%
 * - 2.2: 波动率 30-70 分位，止损线 -10%
 * - 2.3: 波动率 > 70 分位，止损线 -12%
 * - 2.4: 波动率 > 90 分位，止损线 -15%
 * - 2.5: 支持用户自定义范围（-5% ~ -20%）
 * - 2.6: 止损变化时通知用户并显示原因
 */

import { predictVolatility } from './qlibClient';
import { getSupabaseClient } from './supabase';

// === Types ===

export interface StopLossConfig {
  stopLossPercent: number;  // 负数，如 -0.10 表示 -10%
  reason: string;
  volatilityPercentile: number;
  predictedVolatility: number;
  ticker: string;
  effectiveAt: Date;
}

export interface StopLossChangeEvent {
  ticker: string;
  previousStopLoss: number;
  newStopLoss: number;
  volatilityPercentile: number;
  reason: string;
  effectiveAt: Date;
}

export interface UserStopLossSettings {
  minStopLoss: number;  // 最小止损（如 -0.05）
  maxStopLoss: number;  // 最大止损（如 -0.20）
  autoAdjust: boolean;
}

// === Constants ===

// 波动率分位数到止损线的映射 (Requirements 2.1-2.4)
const STOP_LOSS_MAP = [
  { maxPercentile: 30, stopLoss: -0.08 },   // 低波动：-8%
  { maxPercentile: 70, stopLoss: -0.10 },   // 中波动：-10%
  { maxPercentile: 90, stopLoss: -0.12 },   // 高波动：-12%
  { maxPercentile: 100, stopLoss: -0.15 },  // 极高波动：-15%
];

// 用户可配置范围 (Requirement 2.5)
const DEFAULT_MIN_STOP_LOSS = -0.05;  // 最小 -5%
const DEFAULT_MAX_STOP_LOSS = -0.20;  // 最大 -20%

// 历史波动率分位数参考值
const HISTORICAL_VOLATILITY_PERCENTILES: Record<number, number> = {
  10: 0.008,
  20: 0.010,
  30: 0.012,
  40: 0.015,
  50: 0.018,
  60: 0.020,
  70: 0.022,
  80: 0.025,
  90: 0.032,
  95: 0.040,
};


// === Helper Functions ===

/**
 * 计算波动率分位数
 */
function calculateVolatilityPercentile(volatility: number): number {
  const percentiles = Object.entries(HISTORICAL_VOLATILITY_PERCENTILES)
    .map(([p, v]) => ({ percentile: Number(p), value: v }))
    .sort((a, b) => a.value - b.value);
  
  // 找到第一个大于当前波动率的分位数
  for (const { percentile, value } of percentiles) {
    if (volatility <= value) {
      return percentile;
    }
  }
  return 99; // 超过所有阈值
}

/**
 * 根据波动率分位数确定止损线 (Requirements 2.1-2.4)
 */
function determineStopLoss(percentile: number): number {
  for (const config of STOP_LOSS_MAP) {
    if (percentile <= config.maxPercentile) {
      return config.stopLoss;
    }
  }
  return -0.15; // 默认最严格
}

/**
 * 应用用户自定义范围限制 (Requirement 2.5)
 */
function applyUserLimits(
  stopLoss: number,
  settings: UserStopLossSettings
): number {
  // 止损是负数，所以 min 实际上是最接近 0 的值
  // max 是最远离 0 的值
  return Math.max(settings.maxStopLoss, Math.min(settings.minStopLoss, stopLoss));
}

/**
 * 生成止损调整原因说明
 */
function generateReason(
  percentile: number,
  baseStopLoss: number,
  finalStopLoss: number,
  userAdjusted: boolean
): string {
  let reason = `预测波动率处于历史 ${percentile} 分位`;
  
  if (percentile <= 30) {
    reason += '（低波动），建议止损线 ' + formatPercent(baseStopLoss);
  } else if (percentile <= 70) {
    reason += '（中等波动），建议止损线 ' + formatPercent(baseStopLoss);
  } else if (percentile <= 90) {
    reason += '（高波动），建议止损线 ' + formatPercent(baseStopLoss);
  } else {
    reason += '（极高波动），建议止损线 ' + formatPercent(baseStopLoss);
  }
  
  if (userAdjusted && baseStopLoss !== finalStopLoss) {
    reason += `，根据用户设置调整为 ${formatPercent(finalStopLoss)}`;
  }
  
  return reason;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

// === Main Class ===

class DynamicStopLossManager {
  private cachedConfigs: Map<string, StopLossConfig> = new Map();
  private userSettings: UserStopLossSettings = {
    minStopLoss: DEFAULT_MIN_STOP_LOSS,
    maxStopLoss: DEFAULT_MAX_STOP_LOSS,
    autoAdjust: true,
  };
  private changeListeners: ((event: StopLossChangeEvent) => void)[] = [];

  /**
   * 计算指定标的的止损线 (Requirements 2.1-2.4)
   */
  async calculateStopLoss(ticker: string): Promise<StopLossConfig> {
    try {
      // 获取波动率预测
      const predictions = await predictVolatility(ticker, [5]);
      
      if (predictions.length === 0) {
        return this.getDefaultConfig(ticker);
      }
      
      const predictedVolatility = predictions[0].predicted_volatility;
      const percentile = calculateVolatilityPercentile(predictedVolatility);
      
      // 确定基础止损线
      const baseStopLoss = determineStopLoss(percentile);
      
      // 应用用户限制 (Requirement 2.5)
      const finalStopLoss = this.userSettings.autoAdjust
        ? applyUserLimits(baseStopLoss, this.userSettings)
        : baseStopLoss;
      
      const userAdjusted = baseStopLoss !== finalStopLoss;
      
      const config: StopLossConfig = {
        stopLossPercent: finalStopLoss,
        reason: generateReason(percentile, baseStopLoss, finalStopLoss, userAdjusted),
        volatilityPercentile: percentile,
        predictedVolatility,
        ticker,
        effectiveAt: new Date(),
      };
      
      // 检测变化并触发通知 (Requirement 2.6)
      const cached = this.cachedConfigs.get(ticker);
      if (cached && cached.stopLossPercent !== finalStopLoss) {
        await this.handleStopLossChange(ticker, cached.stopLossPercent, config);
      }
      
      this.cachedConfigs.set(ticker, config);
      return config;
    } catch (error) {
      console.error(`Failed to calculate stop loss for ${ticker}:`, error);
      return this.getDefaultConfig(ticker);
    }
  }


  /**
   * 处理止损变化 (Requirement 2.6)
   */
  private async handleStopLossChange(
    ticker: string,
    previousStopLoss: number,
    newConfig: StopLossConfig
  ): Promise<void> {
    const event: StopLossChangeEvent = {
      ticker,
      previousStopLoss,
      newStopLoss: newConfig.stopLossPercent,
      volatilityPercentile: newConfig.volatilityPercentile,
      reason: newConfig.reason,
      effectiveAt: newConfig.effectiveAt,
    };
    
    // 记录到数据库
    await this.recordStopLossChange(event);
    
    // 通知监听器
    this.notifyListeners(event);
  }

  /**
   * 记录止损变更历史
   */
  private async recordStopLossChange(event: StopLossChangeEvent): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      
      await supabase.from('stop_loss_change_history').insert({
        ticker: event.ticker,
        previous_stop_loss: event.previousStopLoss,
        new_stop_loss: event.newStopLoss,
        volatility_percentile: event.volatilityPercentile,
        reason: event.reason,
        effective_at: event.effectiveAt.toISOString(),
      });
    } catch (error) {
      console.error('Failed to record stop loss change:', error);
    }
  }

  /**
   * 通知变更监听器
   */
  private notifyListeners(event: StopLossChangeEvent): void {
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Stop loss change listener error:', error);
      }
    }
  }

  /**
   * 注册止损变更监听器
   */
  onStopLossChange(listener: (event: StopLossChangeEvent) => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * 获取默认配置（服务不可用时使用）
   */
  private getDefaultConfig(ticker: string): StopLossConfig {
    return {
      stopLossPercent: -0.10,
      reason: '无法获取波动率数据，使用默认止损线 -10%',
      volatilityPercentile: 50,
      predictedVolatility: 0,
      ticker,
      effectiveAt: new Date(),
    };
  }

  /**
   * 更新用户止损设置 (Requirement 2.5)
   */
  async updateUserSettings(settings: Partial<UserStopLossSettings>): Promise<void> {
    // 验证范围
    if (settings.minStopLoss !== undefined) {
      if (settings.minStopLoss > 0 || settings.minStopLoss < -0.05) {
        throw new Error('最小止损必须在 -5% 到 0% 之间');
      }
    }
    if (settings.maxStopLoss !== undefined) {
      if (settings.maxStopLoss > -0.05 || settings.maxStopLoss < -0.20) {
        throw new Error('最大止损必须在 -20% 到 -5% 之间');
      }
    }
    
    this.userSettings = { ...this.userSettings, ...settings };
    
    // 保存到数据库
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from('user_risk_config').upsert({
          user_id: 1,
          custom_stop_loss_min: this.userSettings.minStopLoss,
          custom_stop_loss_max: this.userSettings.maxStopLoss,
          stop_loss_auto_adjust: this.userSettings.autoAdjust,
        });
      }
    } catch (error) {
      console.error('Failed to save user settings:', error);
    }
    
    // 清除缓存，下次计算时使用新设置
    this.cachedConfigs.clear();
  }

  /**
   * 获取用户止损设置
   */
  getUserSettings(): UserStopLossSettings {
    return { ...this.userSettings };
  }

  /**
   * 加载用户设置
   */
  async loadUserSettings(userId: number = 1): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      
      const { data, error } = await supabase
        .from('user_risk_config')
        .select('custom_stop_loss_min, custom_stop_loss_max, stop_loss_auto_adjust')
        .eq('user_id', userId)
        .single();
      
      if (data && !error) {
        this.userSettings = {
          minStopLoss: data.custom_stop_loss_min ?? DEFAULT_MIN_STOP_LOSS,
          maxStopLoss: data.custom_stop_loss_max ?? DEFAULT_MAX_STOP_LOSS,
          autoAdjust: data.stop_loss_auto_adjust ?? true,
        };
      }
    } catch (error) {
      console.error('Failed to load user settings:', error);
    }
  }

  /**
   * 获取缓存的止损配置
   */
  getCachedConfig(ticker: string): StopLossConfig | null {
    return this.cachedConfigs.get(ticker) || null;
  }

  /**
   * 批量计算多个标的的止损线
   */
  async calculateMultipleStopLoss(tickers: string[]): Promise<Map<string, StopLossConfig>> {
    const results = new Map<string, StopLossConfig>();
    
    await Promise.all(
      tickers.map(async (ticker) => {
        const config = await this.calculateStopLoss(ticker);
        results.set(ticker, config);
      })
    );
    
    return results;
  }

  /**
   * 检查当前回撤是否触发止损
   */
  async checkStopLossTriggered(
    ticker: string,
    currentDrawdown: number
  ): Promise<{
    triggered: boolean;
    config: StopLossConfig;
    excess: number;
  }> {
    const config = await this.calculateStopLoss(ticker);
    const triggered = currentDrawdown <= config.stopLossPercent;
    
    return {
      triggered,
      config,
      excess: triggered ? config.stopLossPercent - currentDrawdown : 0,
    };
  }

  /**
   * 获取止损变更历史
   */
  async getStopLossHistory(
    ticker: string | null = null,
    days: number = 30,
    userId: number = 1
  ): Promise<StopLossChangeEvent[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    let query = supabase
      .from('stop_loss_change_history')
      .select('*')
      .eq('user_id', userId)
      .gte('effective_at', since.toISOString())
      .order('effective_at', { ascending: false });
    
    if (ticker) {
      query = query.eq('ticker', ticker);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Failed to get stop loss history:', error);
      return [];
    }
    
    return (data || []).map((row: Record<string, unknown>) => ({
      ticker: row.ticker as string,
      previousStopLoss: row.previous_stop_loss as number,
      newStopLoss: row.new_stop_loss as number,
      volatilityPercentile: row.volatility_percentile as number,
      reason: row.reason as string,
      effectiveAt: new Date(row.effective_at as string),
    }));
  }
}

// === Export Singleton ===

export const dynamicStopLossManager = new DynamicStopLossManager();

// === Pure Functions for Testing ===

export const _testing = {
  calculateVolatilityPercentile,
  determineStopLoss,
  applyUserLimits,
  generateReason,
  STOP_LOSS_MAP,
  DEFAULT_MIN_STOP_LOSS,
  DEFAULT_MAX_STOP_LOSS,
};
