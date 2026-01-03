/**
 * Risk Decision Engine
 * 
 * 综合各模块输出做出最终风控决策。
 * 
 * Requirements:
 * - 6.1: 综合杠杆控制、止损管理、风险预警、仓位建议的输出
 * - 6.2: 多模块冲突时采用最保守决策
 * - 6.3: 生成统一的风控状态报告
 * - 6.4: 支持手动覆盖自动决策（需要确认）
 * - 6.5: 记录所有决策和覆盖操作用于审计
 */

import { dynamicLeverageController, LeverageLimit } from './dynamicLeverageController';
import { dynamicStopLossManager, StopLossConfig } from './dynamicStopLossManager';
import { riskForecaster, RiskForecast, RiskAlert } from './riskForecaster';
import { emotionalTradingDetector, EmotionalTradingAlert, CooldownStatus } from './emotionalTradingDetector';
import { getSupabaseClient } from './supabase';

// === Types ===

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskDecision {
  id: string;
  timestamp: Date;
  
  // 各模块输出
  leverageLimit: LeverageLimit;
  stopLossConfig: StopLossConfig;
  riskForecast: RiskForecast;
  emotionalAlerts: EmotionalTradingAlert[];
  cooldownStatus: CooldownStatus;
  
  // 综合决策
  overallRiskLevel: RiskLevel;
  effectiveLeverage: number;
  effectiveStopLoss: number;
  tradingAllowed: boolean;
  cooldownUntil: Date | null;
  
  // 决策依据
  reasoning: string[];
  confidence: number;
  
  // 覆盖信息
  isOverridden: boolean;
  overrideReason?: string;
  overrideBy?: string;
  overrideAt?: Date;
}

export interface DecisionOverride {
  effectiveLeverage?: number;
  effectiveStopLoss?: number;
  tradingAllowed?: boolean;
  reason: string;
  userId: string;
}

// === Constants ===

const RISK_LEVEL_ORDER: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

// 决策缓存有效期
const DECISION_TTL_MS = 5 * 60 * 1000; // 5 minutes


// === Helper Functions ===

/**
 * 获取最高风险等级 (Requirement 6.2)
 */
function getHighestRiskLevel(levels: RiskLevel[]): RiskLevel {
  let highest = 0;
  for (const level of levels) {
    const idx = RISK_LEVEL_ORDER.indexOf(level);
    if (idx > highest) highest = idx;
  }
  return RISK_LEVEL_ORDER[highest];
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// === Main Class ===

class RiskDecisionEngine {
  private cachedDecision: RiskDecision | null = null;
  private decisionListeners: ((decision: RiskDecision) => void)[] = [];

  /**
   * 生成综合风控决策 (Requirement 6.1)
   */
  async generateDecision(
    tickers: string[],
    market: string = 'us'
  ): Promise<RiskDecision> {
    // 检查缓存
    if (this.cachedDecision && 
        Date.now() - this.cachedDecision.timestamp.getTime() < DECISION_TTL_MS) {
      return this.cachedDecision;
    }

    try {
      // 并行获取各模块输出
      const [leverageLimit, stopLossConfig, riskForecast] = await Promise.all([
        dynamicLeverageController.calculateLeverageLimit(market),
        dynamicStopLossManager.calculateStopLoss(tickers[0] || 'SPY'),
        riskForecaster.generateForecast(tickers, market),
      ]);
      
      // 获取情绪化交易检测结果
      const emotionalAlerts = emotionalTradingDetector.detect();
      const cooldownStatus = emotionalTradingDetector.getCooldownStatus();
      
      // 综合决策
      const decision = this.synthesizeDecision(
        leverageLimit,
        stopLossConfig,
        riskForecast,
        emotionalAlerts,
        cooldownStatus
      );
      
      // 保存决策记录 (Requirement 6.5)
      await this.saveDecision(decision);
      
      // 通知监听器
      this.notifyListeners(decision);
      
      this.cachedDecision = decision;
      return decision;
    } catch (error) {
      console.error('Failed to generate risk decision:', error);
      return this.getDefaultDecision();
    }
  }

  /**
   * 综合各模块输出生成决策 (Requirements 6.1, 6.2)
   */
  private synthesizeDecision(
    leverageLimit: LeverageLimit,
    stopLossConfig: StopLossConfig,
    riskForecast: RiskForecast,
    emotionalAlerts: EmotionalTradingAlert[],
    cooldownStatus: CooldownStatus
  ): RiskDecision {
    const reasoning: string[] = [];
    
    // 收集所有风险等级
    const riskLevels: RiskLevel[] = [riskForecast.level];
    
    // 情绪化交易增加风险等级
    if (emotionalAlerts.some(a => a.severity === 'critical')) {
      riskLevels.push('high');
      reasoning.push('检测到严重情绪化交易行为');
    } else if (emotionalAlerts.some(a => a.severity === 'warning')) {
      riskLevels.push('medium');
      reasoning.push('检测到情绪化交易倾向');
    }
    
    // 确定综合风险等级（取最高）(Requirement 6.2)
    const overallRiskLevel = getHighestRiskLevel(riskLevels);
    reasoning.push(`综合风险等级: ${overallRiskLevel}`);
    
    // 确定有效杠杆（取最低）(Requirement 6.2)
    let effectiveLeverage = leverageLimit.maxLeverage;
    if (overallRiskLevel === 'critical') {
      effectiveLeverage = Math.min(effectiveLeverage, 1.0);
      reasoning.push('风险等级为 critical，杠杆限制为 1.0x');
    } else if (overallRiskLevel === 'high') {
      effectiveLeverage = Math.min(effectiveLeverage, 1.1);
      reasoning.push('风险等级为 high，杠杆限制为 1.1x');
    }
    reasoning.push(`有效杠杆限制: ${effectiveLeverage}x (${leverageLimit.reason})`);
    
    // 确定有效止损（取最严格）(Requirement 6.2)
    let effectiveStopLoss = stopLossConfig.stopLossPercent;
    if (overallRiskLevel === 'critical') {
      effectiveStopLoss = Math.max(effectiveStopLoss, -0.08); // 更严格
      reasoning.push('风险等级为 critical，止损线收紧至 -8%');
    }
    reasoning.push(`有效止损线: ${(effectiveStopLoss * 100).toFixed(0)}% (${stopLossConfig.reason})`);
    
    // 确定是否允许交易
    let tradingAllowed = true;
    let cooldownUntil: Date | null = null;
    
    // 冷静期检查
    if (cooldownStatus.active) {
      tradingAllowed = false;
      cooldownUntil = cooldownStatus.endsAt;
      reasoning.push(`冷静期生效中，剩余 ${cooldownStatus.remainingMinutes} 分钟`);
    }
    
    // Critical 情绪化交易检查
    const criticalEmotional = emotionalAlerts.find(a => a.severity === 'critical');
    if (criticalEmotional && !cooldownStatus.active) {
      tradingAllowed = false;
      cooldownUntil = new Date(Date.now() + criticalEmotional.suggestedCooldown * 60 * 1000);
      reasoning.push(`检测到情绪化交易，建议冷静 ${criticalEmotional.suggestedCooldown} 分钟`);
    }
    
    // 添加风险预警信息
    for (const alert of riskForecast.alerts) {
      reasoning.push(`预警: ${alert.message}`);
    }
    
    // 计算综合置信度
    const confidence = this.calculateConfidence(
      leverageLimit,
      stopLossConfig,
      riskForecast
    );
    
    return {
      id: generateId(),
      timestamp: new Date(),
      leverageLimit,
      stopLossConfig,
      riskForecast,
      emotionalAlerts,
      cooldownStatus,
      overallRiskLevel,
      effectiveLeverage,
      effectiveStopLoss,
      tradingAllowed,
      cooldownUntil,
      reasoning,
      confidence,
      isOverridden: false,
    };
  }


  /**
   * 计算综合置信度
   */
  private calculateConfidence(
    leverageLimit: LeverageLimit,
    stopLossConfig: StopLossConfig,
    riskForecast: RiskForecast
  ): number {
    // 基于各模块的数据质量计算置信度
    let confidence = 0.8;
    
    // 如果使用了默认值，降低置信度
    if (leverageLimit.marketRegime === 'unknown') {
      confidence -= 0.2;
    }
    if (stopLossConfig.predictedVolatility === 0) {
      confidence -= 0.1;
    }
    
    // 结合风险预测的置信度
    confidence = (confidence + riskForecast.confidence) / 2;
    
    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * 手动覆盖决策 (Requirement 6.4)
   */
  async overrideDecision(
    decisionId: string,
    override: DecisionOverride
  ): Promise<RiskDecision> {
    // 获取原决策
    const originalDecision = this.cachedDecision;
    if (!originalDecision || originalDecision.id !== decisionId) {
      throw new Error('Decision not found or expired');
    }
    
    // 创建覆盖后的决策
    const overriddenDecision: RiskDecision = {
      ...originalDecision,
      effectiveLeverage: override.effectiveLeverage ?? originalDecision.effectiveLeverage,
      effectiveStopLoss: override.effectiveStopLoss ?? originalDecision.effectiveStopLoss,
      tradingAllowed: override.tradingAllowed ?? originalDecision.tradingAllowed,
      isOverridden: true,
      overrideReason: override.reason,
      overrideBy: override.userId,
      overrideAt: new Date(),
      reasoning: [
        ...originalDecision.reasoning,
        `[手动覆盖] ${override.reason} (by ${override.userId})`,
      ],
    };
    
    // 保存覆盖记录 (Requirement 6.5)
    await this.saveOverride(originalDecision, overriddenDecision, override);
    
    // 更新缓存
    this.cachedDecision = overriddenDecision;
    
    // 通知监听器
    this.notifyListeners(overriddenDecision);
    
    return overriddenDecision;
  }

  /**
   * 保存决策记录 (Requirement 6.5)
   */
  private async saveDecision(decision: RiskDecision): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    try {
      await supabase.from('risk_decisions').insert({
        leverage_limit: decision.leverageLimit,
        stop_loss_config: decision.stopLossConfig,
        risk_forecast: {
          level: decision.riskForecast.level,
          horizonDays: decision.riskForecast.horizonDays,
          drawdownProbabilities: decision.riskForecast.drawdownProbabilities,
          regimeTransition: decision.riskForecast.regimeTransition,
          alertCount: decision.riskForecast.alerts.length,
          confidence: decision.riskForecast.confidence,
        },
        emotional_alerts: decision.emotionalAlerts.map(a => ({
          type: a.type,
          severity: a.severity,
          message: a.message,
        })),
        overall_risk_level: decision.overallRiskLevel,
        effective_leverage: decision.effectiveLeverage,
        effective_stop_loss: decision.effectiveStopLoss,
        trading_allowed: decision.tradingAllowed,
        cooldown_until: decision.cooldownUntil?.toISOString() || null,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        is_overridden: decision.isOverridden,
      });
    } catch (error) {
      console.error('Failed to save decision:', error);
    }
  }

  /**
   * 保存覆盖记录 (Requirement 6.5)
   */
  private async saveOverride(
    original: RiskDecision,
    overridden: RiskDecision,
    override: DecisionOverride
  ): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    try {
      // 更新原决策记录
      await supabase
        .from('risk_decisions')
        .update({
          is_overridden: true,
          override_reason: override.reason,
          override_by: override.userId,
          override_at: new Date().toISOString(),
        })
        .eq('id', original.id);
      
      // 记录覆盖详情到预警历史
      await supabase.from('risk_alerts_history').insert({
        alert_type: 'leverage_change',
        severity: 'info',
        message: `决策被手动覆盖: ${override.reason}`,
        suggested_action: `原决策: 杠杆 ${original.effectiveLeverage}x, 止损 ${(original.effectiveStopLoss * 100).toFixed(0)}%`,
        source_module: 'risk_decision_engine',
      });
    } catch (error) {
      console.error('Failed to save override:', error);
    }
  }

  /**
   * 获取默认决策（服务不可用时）
   */
  private getDefaultDecision(): RiskDecision {
    const now = new Date();
    return {
      id: generateId(),
      timestamp: now,
      leverageLimit: {
        maxLeverage: 1.0,
        reason: '无法获取市场数据，使用保守默认值',
        marketRegime: 'unknown',
        volatilityAdjustment: 0,
        volatilityPercentile: null,
        effectiveAt: now,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      },
      stopLossConfig: {
        stopLossPercent: -0.10,
        reason: '使用默认止损线',
        volatilityPercentile: 50,
        predictedVolatility: 0,
        ticker: 'SPY',
        effectiveAt: now,
      },
      riskForecast: {
        level: 'medium',
        horizonDays: 5,
        drawdownProbabilities: [],
        regimeTransition: null,
        alerts: [],
        confidence: 0.5,
        generatedAt: now,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      },
      emotionalAlerts: [],
      cooldownStatus: {
        active: false,
        endsAt: null,
        remainingMinutes: 0,
        reason: null,
      },
      overallRiskLevel: 'medium',
      effectiveLeverage: 1.0,
      effectiveStopLoss: -0.10,
      tradingAllowed: true,
      cooldownUntil: null,
      reasoning: ['无法获取完整数据，使用保守默认决策'],
      confidence: 0.5,
      isOverridden: false,
    };
  }

  /**
   * 强制刷新决策
   */
  async refresh(tickers: string[], market: string = 'us'): Promise<RiskDecision> {
    this.cachedDecision = null;
    return this.generateDecision(tickers, market);
  }

  /**
   * 获取缓存的决策
   */
  getCachedDecision(): RiskDecision | null {
    if (this.cachedDecision && 
        Date.now() - this.cachedDecision.timestamp.getTime() < DECISION_TTL_MS) {
      return this.cachedDecision;
    }
    return null;
  }

  /**
   * 获取决策历史
   */
  async getDecisionHistory(
    days: number = 7,
    userId: number = 1
  ): Promise<RiskDecision[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    try {
      const { data, error } = await supabase
        .from('risk_decisions')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', since.toISOString())
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      return (data || []).map((row: Record<string, unknown>) => this.mapRowToDecision(row));
    } catch (error) {
      console.error('Failed to get decision history:', error);
      return [];
    }
  }

  /**
   * 映射数据库行到决策对象
   */
  private mapRowToDecision(row: Record<string, unknown>): RiskDecision {
    return {
      id: row.id as string,
      timestamp: new Date(row.timestamp as string),
      leverageLimit: row.leverage_limit as LeverageLimit,
      stopLossConfig: row.stop_loss_config as StopLossConfig,
      riskForecast: row.risk_forecast as RiskForecast,
      emotionalAlerts: (row.emotional_alerts as EmotionalTradingAlert[]) || [],
      cooldownStatus: {
        active: false,
        endsAt: null,
        remainingMinutes: 0,
        reason: null,
      },
      overallRiskLevel: row.overall_risk_level as RiskLevel,
      effectiveLeverage: row.effective_leverage as number,
      effectiveStopLoss: row.effective_stop_loss as number,
      tradingAllowed: row.trading_allowed as boolean,
      cooldownUntil: row.cooldown_until ? new Date(row.cooldown_until as string) : null,
      reasoning: row.reasoning as string[],
      confidence: row.confidence as number,
      isOverridden: row.is_overridden as boolean,
      overrideReason: row.override_reason as string | undefined,
      overrideBy: row.override_by as string | undefined,
      overrideAt: row.override_at ? new Date(row.override_at as string) : undefined,
    };
  }

  /**
   * 注册决策监听器
   */
  onDecision(listener: (decision: RiskDecision) => void): () => void {
    this.decisionListeners.push(listener);
    return () => {
      const index = this.decisionListeners.indexOf(listener);
      if (index > -1) {
        this.decisionListeners.splice(index, 1);
      }
    };
  }

  /**
   * 通知监听器
   */
  private notifyListeners(decision: RiskDecision): void {
    for (const listener of this.decisionListeners) {
      try {
        listener(decision);
      } catch (error) {
        console.error('Decision listener error:', error);
      }
    }
  }

  /**
   * 生成风控状态报告 (Requirement 6.3)
   */
  async generateStatusReport(): Promise<{
    currentDecision: RiskDecision;
    summary: string;
    recommendations: string[];
  }> {
    const decision = await this.generateDecision(['SPY']);
    
    const summary = this.generateSummary(decision);
    const recommendations = this.generateRecommendations(decision);
    
    return {
      currentDecision: decision,
      summary,
      recommendations,
    };
  }

  /**
   * 生成状态摘要
   */
  private generateSummary(decision: RiskDecision): string {
    const riskLabels: Record<RiskLevel, string> = {
      low: '低风险',
      medium: '中等风险',
      high: '高风险',
      critical: '极高风险',
    };
    
    let summary = `当前风险等级: ${riskLabels[decision.overallRiskLevel]}`;
    summary += `\n杠杆限制: ${decision.effectiveLeverage}x`;
    summary += `\n止损线: ${(decision.effectiveStopLoss * 100).toFixed(0)}%`;
    summary += `\n交易状态: ${decision.tradingAllowed ? '允许' : '暂停'}`;
    
    if (decision.cooldownUntil) {
      const remaining = Math.ceil((decision.cooldownUntil.getTime() - Date.now()) / 60000);
      summary += `\n冷静期剩余: ${remaining} 分钟`;
    }
    
    return summary;
  }

  /**
   * 生成建议
   */
  private generateRecommendations(decision: RiskDecision): string[] {
    const recommendations: string[] = [];
    
    if (decision.overallRiskLevel === 'critical') {
      recommendations.push('建议立即降低仓位至安全水平');
      recommendations.push('考虑对冲现有风险敞口');
    } else if (decision.overallRiskLevel === 'high') {
      recommendations.push('建议减少高风险持仓');
      recommendations.push('密切关注市场动态');
    }
    
    if (!decision.tradingAllowed) {
      recommendations.push('当前处于冷静期，建议等待后再做交易决策');
    }
    
    for (const alert of decision.riskForecast.alerts) {
      recommendations.push(alert.suggestedAction);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('当前风险可控，可正常交易');
    }
    
    return recommendations;
  }
}

// === Export Singleton ===

export const riskDecisionEngine = new RiskDecisionEngine();

// === Pure Functions for Testing ===

export const _testing = {
  getHighestRiskLevel,
  RISK_LEVEL_ORDER,
};
