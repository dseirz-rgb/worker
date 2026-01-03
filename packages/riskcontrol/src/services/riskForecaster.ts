/**
 * Risk Forecaster
 * 
 * 风险预测器，预测未来风险水平并生成预警。
 * 
 * Requirements:
 * - 3.1: 每日生成未来 1/3/5 天的风险预测报告
 * - 3.2: >10% 回撤概率 >50% 触发"中等风险"预警
 * - 3.3: >15% 回撤概率 >30% 触发"高风险"预警
 * - 3.4: bull → bear 转换概率 >40% 触发"趋势转换"预警
 * - 3.5: 通过 Toast、邮件、推送通知用户
 * - 3.6: 提供预警的置信度和建议操作
 */

import { getMarketRegime, predictDrawdown, MarketRegime } from './qlibClient';
import { getSupabaseClient } from './supabase';

// === Types ===

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AlertType = 'drawdown_warning' | 'regime_change' | 'volatility_spike';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface DrawdownProbability {
  threshold: number;  // 如 0.10 表示 10%
  probability: number;  // 概率值 0-1
  horizon: number;  // 预测天数
}

export interface RegimeTransition {
  from: string;
  to: string;
  probability: number;
}

export interface RiskAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  suggestedAction: string;
  confidence: number;
}

export interface RiskForecast {
  level: RiskLevel;
  horizonDays: number;
  drawdownProbabilities: DrawdownProbability[];
  regimeTransition: RegimeTransition | null;
  alerts: RiskAlert[];
  confidence: number;
  generatedAt: Date;
  expiresAt: Date;
}

// === Constants ===

// 预警阈值 (Requirements 3.2, 3.3, 3.4)
const ALERT_THRESHOLDS = {
  mediumRisk: {
    drawdownThreshold: 0.10,  // 10% 回撤
    probabilityThreshold: 0.50,  // 50% 概率
  },
  highRisk: {
    drawdownThreshold: 0.15,  // 15% 回撤
    probabilityThreshold: 0.30,  // 30% 概率
  },
  regimeChange: {
    probabilityThreshold: 0.40,  // 40% 转换概率
  },
};

// 预测有效期
const FORECAST_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours


// === Helper Functions ===

/**
 * 检测市场状态转换 (Requirement 3.4)
 */
function detectRegimeTransition(regime: MarketRegime): RegimeTransition | null {
  const currentRegime = regime.current_regime;
  const transitions = regime.transition_probabilities;
  
  // 检测从 bull 转 bear 的概率
  if (currentRegime === 'bull' && transitions['bear'] > ALERT_THRESHOLDS.regimeChange.probabilityThreshold) {
    return {
      from: 'bull',
      to: 'bear',
      probability: transitions['bear'],
    };
  }
  
  // 检测从 sideways 转 bear 的概率
  if (currentRegime === 'sideways' && transitions['bear'] > ALERT_THRESHOLDS.regimeChange.probabilityThreshold) {
    return {
      from: 'sideways',
      to: 'bear',
      probability: transitions['bear'],
    };
  }
  
  // 检测转向高波动的概率
  if (currentRegime !== 'high_volatility' && transitions['high_volatility'] > ALERT_THRESHOLDS.regimeChange.probabilityThreshold) {
    return {
      from: currentRegime,
      to: 'high_volatility',
      probability: transitions['high_volatility'],
    };
  }
  
  return null;
}

/**
 * 生成风险预警 (Requirements 3.2, 3.3, 3.4)
 */
function generateAlerts(
  drawdownProbs: DrawdownProbability[],
  regimeTransition: RegimeTransition | null
): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  
  // 检查高风险预警 (Requirement 3.3)
  const prob15 = drawdownProbs.find(
    p => p.threshold === 0.15 && p.horizon === 5
  );
  if (prob15 && prob15.probability > ALERT_THRESHOLDS.highRisk.probabilityThreshold) {
    alerts.push({
      type: 'drawdown_warning',
      severity: 'critical',
      message: `未来 5 天内发生 >15% 回撤的概率为 ${formatPercent(prob15.probability)}`,
      suggestedAction: '强烈建议减仓并设置严格止损，考虑对冲风险敞口',
      confidence: 0.8,
    });
  }
  
  // 检查中等风险预警 (Requirement 3.2)
  const prob10 = drawdownProbs.find(
    p => p.threshold === 0.10 && p.horizon === 5
  );
  if (prob10 && prob10.probability > ALERT_THRESHOLDS.mediumRisk.probabilityThreshold) {
    alerts.push({
      type: 'drawdown_warning',
      severity: 'warning',
      message: `未来 5 天内发生 >10% 回撤的概率为 ${formatPercent(prob10.probability)}`,
      suggestedAction: '建议降低仓位或设置止损，密切关注市场动态',
      confidence: 0.75,
    });
  }
  
  // 检查趋势转换预警 (Requirement 3.4)
  if (regimeTransition) {
    const regimeNames: Record<string, string> = {
      bull: '牛市',
      bear: '熊市',
      sideways: '震荡市',
      high_volatility: '高波动',
    };
    
    alerts.push({
      type: 'regime_change',
      severity: regimeTransition.to === 'bear' ? 'critical' : 'warning',
      message: `市场可能从${regimeNames[regimeTransition.from]}转为${regimeNames[regimeTransition.to]}，概率 ${formatPercent(regimeTransition.probability)}`,
      suggestedAction: regimeTransition.to === 'bear' 
        ? '建议调整为防御性策略，增加现金比例'
        : '建议调整策略以适应新的市场状态',
      confidence: 0.7,
    });
  }
  
  return alerts;
}

/**
 * 计算综合风险等级
 */
function calculateRiskLevel(
  drawdownProbs: DrawdownProbability[],
  regimeTransition: RegimeTransition | null
): RiskLevel {
  const prob15 = drawdownProbs.find(p => p.threshold === 0.15 && p.horizon === 5);
  const prob10 = drawdownProbs.find(p => p.threshold === 0.10 && p.horizon === 5);
  
  // Critical: >15% 回撤概率 >30%
  if (prob15 && prob15.probability > ALERT_THRESHOLDS.highRisk.probabilityThreshold) {
    return 'critical';
  }
  
  // High: >10% 回撤概率 >50%
  if (prob10 && prob10.probability > ALERT_THRESHOLDS.mediumRisk.probabilityThreshold) {
    return 'high';
  }
  
  // Medium: 有趋势转换风险
  if (regimeTransition && regimeTransition.probability > ALERT_THRESHOLDS.regimeChange.probabilityThreshold) {
    return 'medium';
  }
  
  return 'low';
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}


// === Main Class ===

class RiskForecaster {
  private cachedForecast: RiskForecast | null = null;
  private alertListeners: ((alerts: RiskAlert[]) => void)[] = [];

  /**
   * 生成风险预测报告 (Requirement 3.1)
   */
  async generateForecast(
    tickers: string[],
    market: string = 'us'
  ): Promise<RiskForecast> {
    // 检查缓存
    if (this.cachedForecast && new Date() < this.cachedForecast.expiresAt) {
      return this.cachedForecast;
    }

    try {
      // 获取回撤概率
      const drawdownProbs = await this.getDrawdownProbabilities(tickers);
      
      // 获取市场状态转换概率
      const regime = await getMarketRegime(market);
      const regimeTransition = detectRegimeTransition(regime);
      
      // 生成警报
      const alerts = generateAlerts(drawdownProbs, regimeTransition);
      
      // 计算综合风险等级
      const level = calculateRiskLevel(drawdownProbs, regimeTransition);
      
      const now = new Date();
      const forecast: RiskForecast = {
        level,
        horizonDays: 5,
        drawdownProbabilities: drawdownProbs,
        regimeTransition,
        alerts,
        confidence: this.calculateOverallConfidence(alerts),
        generatedAt: now,
        expiresAt: new Date(now.getTime() + FORECAST_TTL_MS),
      };
      
      // 如果有新预警，触发通知
      if (alerts.length > 0) {
        await this.handleNewAlerts(alerts);
      }
      
      // 保存预测记录
      await this.saveForecast(forecast);
      
      this.cachedForecast = forecast;
      return forecast;
    } catch (error) {
      console.error('Failed to generate risk forecast:', error);
      return this.getDefaultForecast();
    }
  }

  /**
   * 获取回撤概率
   * 分析多个持仓的综合回撤风险
   */
  private async getDrawdownProbabilities(tickers: string[]): Promise<DrawdownProbability[]> {
    const results: DrawdownProbability[] = [];
    
    // 如果没有持仓，使用 SPY 作为市场代表
    const tickersToAnalyze = tickers.length > 0 ? tickers : ['SPY'];
    
    // 取前 5 个主要持仓进行分析
    const mainTickers = tickersToAnalyze.slice(0, 5);
    
    console.log('[RiskForecaster] Analyzing tickers:', mainTickers);
    
    try {
      // 并行获取所有持仓的回撤概率
      const allPredictions = await Promise.all(
        mainTickers.map(ticker => 
          predictDrawdown(ticker, [1, 3, 5], [0.05, 0.10, 0.15])
            .catch(err => {
              console.warn(`[RiskForecaster] Failed to get drawdown for ${ticker}:`, err);
              return null;
            })
        )
      );
      
      // 过滤掉失败的请求
      const validPredictions = allPredictions.filter(p => p !== null);
      
      if (validPredictions.length === 0) {
        // 如果所有请求都失败，返回默认值
        console.warn('[RiskForecaster] All drawdown predictions failed, using defaults');
        return [
          { threshold: 0.05, probability: 0.2, horizon: 5 },
          { threshold: 0.10, probability: 0.1, horizon: 5 },
          { threshold: 0.15, probability: 0.05, horizon: 5 },
        ];
      }
      
      // 聚合所有持仓的回撤概率（取最大值，最保守估计）
      const aggregated = new Map<string, DrawdownProbability>();
      
      for (const predictions of validPredictions) {
        if (!predictions) continue;
        
        for (const pred of predictions) {
          const key = `${pred.horizon}-${pred.threshold}`;
          const existing = aggregated.get(key);
          
          if (!existing || pred.probability > existing.probability) {
            aggregated.set(key, {
              threshold: pred.threshold,
              probability: pred.probability,
              horizon: pred.horizon,
            });
          }
        }
      }
      
      results.push(...Array.from(aggregated.values()));
      
      console.log('[RiskForecaster] Aggregated drawdown probabilities:', results);
      
    } catch (error) {
      console.error('Failed to get drawdown probabilities:', error);
      // 返回默认值
      results.push(
        { threshold: 0.05, probability: 0.2, horizon: 5 },
        { threshold: 0.10, probability: 0.1, horizon: 5 },
        { threshold: 0.15, probability: 0.05, horizon: 5 }
      );
    }
    
    return results;
  }

  /**
   * 计算整体置信度
   */
  private calculateOverallConfidence(alerts: RiskAlert[]): number {
    if (alerts.length === 0) return 0.8;
    
    const avgConfidence = alerts.reduce((sum, a) => sum + a.confidence, 0) / alerts.length;
    return Math.round(avgConfidence * 100) / 100;
  }

  /**
   * 处理新预警 (Requirement 3.5)
   */
  private async handleNewAlerts(alerts: RiskAlert[]): Promise<void> {
    // 保存到数据库
    await this.saveAlerts(alerts);
    
    // 通知监听器
    this.notifyListeners(alerts);
  }

  /**
   * 保存预警到数据库
   */
  private async saveAlerts(alerts: RiskAlert[]): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    try {
      const records = alerts.map(alert => ({
        alert_type: alert.type,
        severity: alert.severity,
        message: alert.message,
        suggested_action: alert.suggestedAction,
        source_module: 'risk_forecaster',
      }));
      
      await supabase.from('risk_alerts_history').insert(records);
    } catch (error) {
      console.error('Failed to save alerts:', error);
    }
  }

  /**
   * 保存预测记录
   */
  private async saveForecast(forecast: RiskForecast): Promise<void> {
    // 预测记录可以保存到单独的表，这里简化处理
    console.log('Risk forecast generated:', {
      level: forecast.level,
      alertCount: forecast.alerts.length,
      confidence: forecast.confidence,
    });
  }

  /**
   * 通知预警监听器
   */
  private notifyListeners(alerts: RiskAlert[]): void {
    for (const listener of this.alertListeners) {
      try {
        listener(alerts);
      } catch (error) {
        console.error('Alert listener error:', error);
      }
    }
  }

  /**
   * 注册预警监听器
   */
  onAlerts(listener: (alerts: RiskAlert[]) => void): () => void {
    this.alertListeners.push(listener);
    return () => {
      const index = this.alertListeners.indexOf(listener);
      if (index > -1) {
        this.alertListeners.splice(index, 1);
      }
    };
  }

  /**
   * 获取默认预测（服务不可用时）
   */
  private getDefaultForecast(): RiskForecast {
    const now = new Date();
    return {
      level: 'medium',
      horizonDays: 5,
      drawdownProbabilities: [
        { threshold: 0.05, probability: 0.2, horizon: 5 },
        { threshold: 0.10, probability: 0.1, horizon: 5 },
        { threshold: 0.15, probability: 0.05, horizon: 5 },
      ],
      regimeTransition: null,
      alerts: [{
        type: 'volatility_spike',
        severity: 'info',
        message: '无法获取实时预测数据，使用默认风险评估',
        suggestedAction: '建议手动检查市场状态',
        confidence: 0.5,
      }],
      confidence: 0.5,
      generatedAt: now,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour
    };
  }

  /**
   * 强制刷新预测
   */
  async refresh(tickers: string[], market: string = 'us'): Promise<RiskForecast> {
    this.cachedForecast = null;
    return this.generateForecast(tickers, market);
  }

  /**
   * 获取缓存的预测
   */
  getCachedForecast(): RiskForecast | null {
    if (this.cachedForecast && new Date() < this.cachedForecast.expiresAt) {
      return this.cachedForecast;
    }
    return null;
  }

  /**
   * 获取活跃预警
   */
  async getActiveAlerts(userId: number = 1): Promise<RiskAlert[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    
    try {
      const { data, error } = await supabase
        .from('risk_alerts_history')
        .select('*')
        .eq('user_id', userId)
        .eq('acknowledged', false)
        .eq('dismissed', false)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      return (data || []).map((row: Record<string, unknown>) => ({
        type: row.alert_type as AlertType,
        severity: row.severity as AlertSeverity,
        message: row.message as string,
        suggestedAction: row.suggested_action as string || '',
        confidence: 0.75,
      }));
    } catch (error) {
      console.error('Failed to get active alerts:', error);
      return [];
    }
  }

  /**
   * 确认预警
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    try {
      await supabase
        .from('risk_alerts_history')
        .update({ 
          acknowledged: true, 
          acknowledged_at: new Date().toISOString() 
        })
        .eq('id', alertId);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  }

  /**
   * 忽略预警
   */
  async dismissAlert(alertId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    try {
      await supabase
        .from('risk_alerts_history')
        .update({ dismissed: true })
        .eq('id', alertId);
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    }
  }
}

// === Export Singleton ===

export const riskForecaster = new RiskForecaster();

// === Pure Functions for Testing ===

export const _testing = {
  detectRegimeTransition,
  generateAlerts,
  calculateRiskLevel,
  ALERT_THRESHOLDS,
};
