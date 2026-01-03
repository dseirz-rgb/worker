/**
 * Position Optimizer
 * 
 * 基于风险预算的仓位优化器，提供最优配置建议。
 * 
 * Requirements:
 * - 4.1: 基于用户设定的风险预算（如最大回撤 10%）计算最优仓位
 * - 4.2: 当前仓位偏离最优配置超过 20% 时生成调仓建议
 * - 4.3: 考虑各标的的相关性，避免过度集中
 * - 4.4: 提供"保守"、"平衡"、"激进"三种配置方案
 * - 4.5: 市场状态变化时重新计算最优配置
 * - 4.6: 显示调仓前后的预期风险指标变化
 */

import { getMarketRegime, predictVolatility, MarketRegime } from './qlibClient';
import { getSupabaseClient } from './supabase';

// === Types ===

export type RiskProfile = 'conservative' | 'balanced' | 'aggressive';

export interface Position {
  ticker: string;
  currentWeight: number;  // 当前权重 (0-1)
  currentValue: number;   // 当前市值
  assetClass: 'stock' | 'bond' | 'cash' | 'commodity' | 'crypto';
}

export interface OptimalAllocation {
  ticker: string;
  targetWeight: number;   // 目标权重 (0-1)
  currentWeight: number;  // 当前权重
  deviation: number;      // 偏离度 (target - current)
  action: 'buy' | 'sell' | 'hold';
  suggestedAmount: number; // 建议调整金额
}

export interface PositionOptimizationResult {
  profile: RiskProfile;
  allocations: OptimalAllocation[];
  totalDeviation: number;
  needsRebalancing: boolean;
  riskMetrics: RiskMetrics;
  expectedRiskChange: RiskMetricsChange;
  reasoning: string[];
  generatedAt: Date;
  expiresAt: Date;
}

export interface RiskMetrics {
  expectedReturn: number;      // 预期收益率
  expectedVolatility: number;  // 预期波动率
  maxDrawdown: number;         // 最大回撤
  sharpeRatio: number;         // 夏普比率
  concentrationRisk: number;   // 集中度风险 (0-1)
}

export interface RiskMetricsChange {
  returnChange: number;
  volatilityChange: number;
  drawdownChange: number;
  sharpeChange: number;
  concentrationChange: number;
}

export interface RebalanceSuggestion {
  ticker: string;
  action: 'buy' | 'sell';
  amount: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface UserRiskBudget {
  maxDrawdown: number;         // 最大可接受回撤 (如 0.10 = 10%)
  targetReturn: number;        // 目标收益率
  riskProfile: RiskProfile;    // 风险偏好
}

// === Constants ===

// 风险偏好对应的参数 (Requirement 4.4)
const RISK_PROFILE_PARAMS: Record<RiskProfile, {
  maxEquityWeight: number;
  minCashWeight: number;
  maxSinglePosition: number;
  volatilityMultiplier: number;
}> = {
  conservative: {
    maxEquityWeight: 0.50,      // 最多 50% 股票
    minCashWeight: 0.20,        // 至少 20% 现金
    maxSinglePosition: 0.15,    // 单一持仓最多 15%
    volatilityMultiplier: 0.7,  // 波动率调整系数
  },
  balanced: {
    maxEquityWeight: 0.70,
    minCashWeight: 0.10,
    maxSinglePosition: 0.20,
    volatilityMultiplier: 1.0,
  },
  aggressive: {
    maxEquityWeight: 0.90,
    minCashWeight: 0.05,
    maxSinglePosition: 0.30,
    volatilityMultiplier: 1.3,
  },
};

// 偏离阈值 (Requirement 4.2)
const REBALANCE_THRESHOLD = 0.20; // 20% 偏离触发调仓建议

// 资产类别预期参数（简化模型）
const ASSET_CLASS_PARAMS: Record<string, {
  expectedReturn: number;
  expectedVolatility: number;
  correlationWithMarket: number;
}> = {
  stock: { expectedReturn: 0.10, expectedVolatility: 0.20, correlationWithMarket: 1.0 },
  bond: { expectedReturn: 0.04, expectedVolatility: 0.05, correlationWithMarket: -0.2 },
  cash: { expectedReturn: 0.02, expectedVolatility: 0.01, correlationWithMarket: 0.0 },
  commodity: { expectedReturn: 0.06, expectedVolatility: 0.15, correlationWithMarket: 0.3 },
  crypto: { expectedReturn: 0.15, expectedVolatility: 0.60, correlationWithMarket: 0.4 },
};

// 优化结果缓存有效期
const OPTIMIZATION_TTL_MS = 30 * 60 * 1000; // 30 minutes



// === Helper Functions ===

/**
 * 计算投资组合的集中度风险 (Requirement 4.3)
 * 使用 Herfindahl-Hirschman Index (HHI)
 */
function calculateConcentrationRisk(weights: number[]): number {
  const hhi = weights.reduce((sum, w) => sum + w * w, 0);
  // 归一化到 0-1，其中 1 表示完全集中
  const n = weights.length;
  if (n <= 1) return 1;
  const minHHI = 1 / n;
  return (hhi - minHHI) / (1 - minHHI);
}

/**
 * 计算投资组合预期收益率
 */
function calculateExpectedReturn(
  allocations: { weight: number; assetClass: string }[]
): number {
  return allocations.reduce((sum, a) => {
    const params = ASSET_CLASS_PARAMS[a.assetClass] || ASSET_CLASS_PARAMS.stock;
    return sum + a.weight * params.expectedReturn;
  }, 0);
}

/**
 * 计算投资组合预期波动率（简化模型）
 */
function calculateExpectedVolatility(
  allocations: { weight: number; assetClass: string }[]
): number {
  // 简化：假设资产间相关性为 0.5
  const avgCorrelation = 0.5;
  
  let variance = 0;
  for (const a of allocations) {
    const params = ASSET_CLASS_PARAMS[a.assetClass] || ASSET_CLASS_PARAMS.stock;
    variance += a.weight * a.weight * params.expectedVolatility * params.expectedVolatility;
  }
  
  // 添加协方差项
  for (let i = 0; i < allocations.length; i++) {
    for (let j = i + 1; j < allocations.length; j++) {
      const pi = ASSET_CLASS_PARAMS[allocations[i].assetClass] || ASSET_CLASS_PARAMS.stock;
      const pj = ASSET_CLASS_PARAMS[allocations[j].assetClass] || ASSET_CLASS_PARAMS.stock;
      variance += 2 * allocations[i].weight * allocations[j].weight * 
                  avgCorrelation * pi.expectedVolatility * pj.expectedVolatility;
    }
  }
  
  return Math.sqrt(variance);
}

/**
 * 估算最大回撤（基于波动率的简化模型）
 */
function estimateMaxDrawdown(volatility: number, horizon: number = 252): number {
  // 使用经验公式：MaxDD ≈ 2.5 * σ * √T
  return Math.min(0.5, 2.5 * volatility * Math.sqrt(horizon / 252));
}

/**
 * 计算夏普比率
 */
function calculateSharpeRatio(
  expectedReturn: number,
  volatility: number,
  riskFreeRate: number = 0.04
): number {
  if (volatility === 0) return 0;
  return (expectedReturn - riskFreeRate) / volatility;
}

/**
 * 根据风险预算计算目标权重 (Requirement 4.1)
 */
function calculateTargetWeights(
  positions: Position[],
  riskBudget: UserRiskBudget,
  marketRegime: string
): Map<string, number> {
  const params = RISK_PROFILE_PARAMS[riskBudget.riskProfile];
  const weights = new Map<string, number>();
  
  // 按资产类别分组
  const byClass = new Map<string, Position[]>();
  for (const p of positions) {
    const list = byClass.get(p.assetClass) || [];
    list.push(p);
    byClass.set(p.assetClass, list);
  }
  
  // 根据市场状态调整股票权重 (Requirement 4.5)
  let equityTarget = params.maxEquityWeight;
  if (marketRegime === 'bear') {
    equityTarget *= 0.6; // 熊市减少股票配置
  } else if (marketRegime === 'high_volatility') {
    equityTarget *= 0.7;
  } else if (marketRegime === 'sideways') {
    equityTarget *= 0.85;
  }
  
  // 根据最大回撤约束调整 (Requirement 4.1)
  const maxDrawdownConstraint = riskBudget.maxDrawdown;
  const impliedMaxEquity = maxDrawdownConstraint / 0.25; // 假设股票最大回撤 25%
  equityTarget = Math.min(equityTarget, impliedMaxEquity);
  
  // 分配权重
  const stocks = byClass.get('stock') || [];
  const bonds = byClass.get('bond') || [];
  const cash = byClass.get('cash') || [];
  const others = [...(byClass.get('commodity') || []), ...(byClass.get('crypto') || [])];
  
  // 股票权重分配（等权重，受单一持仓限制）
  const stockCount = stocks.length || 1;
  const perStockWeight = Math.min(
    equityTarget / stockCount,
    params.maxSinglePosition
  );
  for (const s of stocks) {
    weights.set(s.ticker, perStockWeight);
  }
  
  // 计算已分配权重
  let allocated = stocks.length * perStockWeight;
  
  // 其他资产分配
  const otherWeight = Math.min(0.1, (1 - allocated - params.minCashWeight) / 2);
  for (const o of others) {
    weights.set(o.ticker, Math.min(otherWeight / others.length, params.maxSinglePosition));
    allocated += otherWeight / others.length;
  }
  
  // 债券分配
  const bondWeight = Math.max(0, 1 - allocated - params.minCashWeight);
  for (const b of bonds) {
    weights.set(b.ticker, bondWeight / (bonds.length || 1));
  }
  allocated += bondWeight;
  
  // 现金分配
  const cashWeight = Math.max(params.minCashWeight, 1 - allocated);
  for (const c of cash) {
    weights.set(c.ticker, cashWeight / (cash.length || 1));
  }
  
  // 归一化确保总和为 1
  const total = Array.from(weights.values()).reduce((a, b) => a + b, 0);
  if (total > 0) {
    Array.from(weights.entries()).forEach(([ticker, weight]) => {
      weights.set(ticker, weight / total);
    });
  }
  
  return weights;
}

/**
 * 计算风险指标
 */
function calculateRiskMetrics(
  allocations: { weight: number; assetClass: string }[]
): RiskMetrics {
  const expectedReturn = calculateExpectedReturn(allocations);
  const expectedVolatility = calculateExpectedVolatility(allocations);
  const maxDrawdown = estimateMaxDrawdown(expectedVolatility);
  const sharpeRatio = calculateSharpeRatio(expectedReturn, expectedVolatility);
  const concentrationRisk = calculateConcentrationRisk(allocations.map(a => a.weight));
  
  return {
    expectedReturn,
    expectedVolatility,
    maxDrawdown,
    sharpeRatio,
    concentrationRisk,
  };
}



// === Main Class ===

class PositionOptimizer {
  private cachedResults: Map<RiskProfile, PositionOptimizationResult> = new Map();
  private userRiskBudget: UserRiskBudget = {
    maxDrawdown: 0.10,
    targetReturn: 0.08,
    riskProfile: 'balanced',
  };
  private lastMarketRegime: string | null = null;

  /**
   * 优化仓位配置 (Requirements 4.1, 4.4)
   */
  async optimizePositions(
    positions: Position[],
    profile: RiskProfile = this.userRiskBudget.riskProfile,
    market: string = 'us'
  ): Promise<PositionOptimizationResult> {
    // 检查缓存
    const cached = this.cachedResults.get(profile);
    if (cached && new Date() < cached.expiresAt && this.lastMarketRegime === await this.getCurrentRegime(market)) {
      return cached;
    }

    try {
      // 获取市场状态 (Requirement 4.5)
      const regime = await getMarketRegime(market);
      const currentRegime = regime.current_regime;
      this.lastMarketRegime = currentRegime;
      
      // 计算目标权重 (Requirement 4.1)
      const riskBudget = { ...this.userRiskBudget, riskProfile: profile };
      const targetWeights = calculateTargetWeights(positions, riskBudget, currentRegime);
      
      // 计算总市值
      const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
      
      // 生成配置建议
      const allocations: OptimalAllocation[] = positions.map(p => {
        const targetWeight = targetWeights.get(p.ticker) || 0;
        const deviation = targetWeight - p.currentWeight;
        const absDeviation = Math.abs(deviation);
        
        let action: 'buy' | 'sell' | 'hold' = 'hold';
        if (deviation > 0.02) action = 'buy';
        else if (deviation < -0.02) action = 'sell';
        
        return {
          ticker: p.ticker,
          targetWeight,
          currentWeight: p.currentWeight,
          deviation,
          action,
          suggestedAmount: deviation * totalValue,
        };
      });
      
      // 计算总偏离度 (Requirement 4.2)
      const totalDeviation = allocations.reduce(
        (sum, a) => sum + Math.abs(a.deviation),
        0
      ) / 2; // 除以 2 因为买卖是对称的
      
      const needsRebalancing = totalDeviation > REBALANCE_THRESHOLD;
      
      // 计算当前和目标风险指标 (Requirement 4.6)
      const currentMetrics = calculateRiskMetrics(
        positions.map(p => ({ weight: p.currentWeight, assetClass: p.assetClass }))
      );
      const targetMetrics = calculateRiskMetrics(
        allocations.map(a => ({
          weight: a.targetWeight,
          assetClass: positions.find(p => p.ticker === a.ticker)?.assetClass || 'stock',
        }))
      );
      
      const expectedRiskChange: RiskMetricsChange = {
        returnChange: targetMetrics.expectedReturn - currentMetrics.expectedReturn,
        volatilityChange: targetMetrics.expectedVolatility - currentMetrics.expectedVolatility,
        drawdownChange: targetMetrics.maxDrawdown - currentMetrics.maxDrawdown,
        sharpeChange: targetMetrics.sharpeRatio - currentMetrics.sharpeRatio,
        concentrationChange: targetMetrics.concentrationRisk - currentMetrics.concentrationRisk,
      };
      
      // 生成推理说明
      const reasoning = this.generateReasoning(
        profile,
        currentRegime,
        totalDeviation,
        needsRebalancing,
        expectedRiskChange
      );
      
      const now = new Date();
      const result: PositionOptimizationResult = {
        profile,
        allocations,
        totalDeviation,
        needsRebalancing,
        riskMetrics: targetMetrics,
        expectedRiskChange,
        reasoning,
        generatedAt: now,
        expiresAt: new Date(now.getTime() + OPTIMIZATION_TTL_MS),
      };
      
      this.cachedResults.set(profile, result);
      return result;
    } catch (error) {
      console.error('Failed to optimize positions:', error);
      return this.getDefaultResult(positions, profile);
    }
  }

  /**
   * 获取当前市场状态
   */
  private async getCurrentRegime(market: string): Promise<string> {
    try {
      const regime = await getMarketRegime(market);
      return regime.current_regime;
    } catch {
      return 'unknown';
    }
  }

  /**
   * 生成调仓建议 (Requirement 4.2)
   */
  async generateRebalanceSuggestions(
    positions: Position[],
    profile: RiskProfile = this.userRiskBudget.riskProfile
  ): Promise<RebalanceSuggestion[]> {
    const result = await this.optimizePositions(positions, profile);
    
    if (!result.needsRebalancing) {
      return [];
    }
    
    const suggestions: RebalanceSuggestion[] = [];
    
    for (const allocation of result.allocations) {
      if (allocation.action === 'hold') continue;
      
      const absDeviation = Math.abs(allocation.deviation);
      let priority: 'high' | 'medium' | 'low' = 'low';
      if (absDeviation > 0.15) priority = 'high';
      else if (absDeviation > 0.08) priority = 'medium';
      
      suggestions.push({
        ticker: allocation.ticker,
        action: allocation.action,
        amount: Math.abs(allocation.suggestedAmount),
        reason: this.generateSuggestionReason(allocation),
        priority,
      });
    }
    
    // 按优先级排序
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * 生成建议原因说明
   */
  private generateSuggestionReason(allocation: OptimalAllocation): string {
    const deviationPercent = (allocation.deviation * 100).toFixed(1);
    const targetPercent = (allocation.targetWeight * 100).toFixed(1);
    const currentPercent = (allocation.currentWeight * 100).toFixed(1);
    
    if (allocation.action === 'buy') {
      return `当前配置 ${currentPercent}% 低于目标 ${targetPercent}%，建议增持`;
    } else {
      return `当前配置 ${currentPercent}% 高于目标 ${targetPercent}%，建议减持`;
    }
  }

  /**
   * 生成推理说明
   */
  private generateReasoning(
    profile: RiskProfile,
    marketRegime: string,
    totalDeviation: number,
    needsRebalancing: boolean,
    riskChange: RiskMetricsChange
  ): string[] {
    const reasoning: string[] = [];
    
    const profileNames: Record<RiskProfile, string> = {
      conservative: '保守型',
      balanced: '平衡型',
      aggressive: '激进型',
    };
    
    const regimeNames: Record<string, string> = {
      bull: '牛市',
      bear: '熊市',
      sideways: '震荡市',
      high_volatility: '高波动',
    };
    
    reasoning.push(`风险偏好: ${profileNames[profile]}`);
    reasoning.push(`当前市场状态: ${regimeNames[marketRegime] || marketRegime}`);
    reasoning.push(`组合偏离度: ${(totalDeviation * 100).toFixed(1)}%`);
    
    if (needsRebalancing) {
      reasoning.push(`偏离度超过 ${REBALANCE_THRESHOLD * 100}%，建议调仓`);
    } else {
      reasoning.push('当前配置在合理范围内');
    }
    
    // 风险变化说明 (Requirement 4.6)
    if (Math.abs(riskChange.volatilityChange) > 0.01) {
      const direction = riskChange.volatilityChange > 0 ? '增加' : '降低';
      reasoning.push(`调仓后预期波动率${direction} ${(Math.abs(riskChange.volatilityChange) * 100).toFixed(1)}%`);
    }
    
    if (Math.abs(riskChange.sharpeChange) > 0.05) {
      const direction = riskChange.sharpeChange > 0 ? '提升' : '下降';
      reasoning.push(`调仓后夏普比率${direction} ${Math.abs(riskChange.sharpeChange).toFixed(2)}`);
    }
    
    return reasoning;
  }

  /**
   * 获取所有风险偏好的配置方案 (Requirement 4.4)
   */
  async getAllProfiles(
    positions: Position[],
    market: string = 'us'
  ): Promise<Map<RiskProfile, PositionOptimizationResult>> {
    const results = new Map<RiskProfile, PositionOptimizationResult>();
    
    const profiles: RiskProfile[] = ['conservative', 'balanced', 'aggressive'];
    
    await Promise.all(
      profiles.map(async (profile) => {
        const result = await this.optimizePositions(positions, profile, market);
        results.set(profile, result);
      })
    );
    
    return results;
  }

  /**
   * 更新用户风险预算
   */
  async updateRiskBudget(budget: Partial<UserRiskBudget>): Promise<void> {
    this.userRiskBudget = { ...this.userRiskBudget, ...budget };
    
    // 清除缓存
    this.cachedResults.clear();
    
    // 保存到数据库
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from('user_risk_config').upsert({
          user_id: 1,
          max_acceptable_drawdown: this.userRiskBudget.maxDrawdown,
          risk_preference: this.userRiskBudget.riskProfile,
          target_return: this.userRiskBudget.targetReturn,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to save risk budget:', error);
    }
  }

  /**
   * 获取用户风险预算
   */
  getRiskBudget(): UserRiskBudget {
    return { ...this.userRiskBudget };
  }

  /**
   * 加载用户风险预算
   */
  async loadRiskBudget(userId: number = 1): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      
      const { data, error } = await supabase
        .from('user_risk_config')
        .select('max_acceptable_drawdown, risk_preference, target_return')
        .eq('user_id', userId)
        .single();
      
      if (data && !error) {
        this.userRiskBudget = {
          maxDrawdown: data.max_acceptable_drawdown ?? 0.10,
          riskProfile: (data.risk_preference as RiskProfile) ?? 'balanced',
          targetReturn: data.target_return ?? 0.08,
        };
      }
    } catch (error) {
      console.error('Failed to load risk budget:', error);
    }
  }

  /**
   * 获取默认结果（服务不可用时）
   */
  private getDefaultResult(
    positions: Position[],
    profile: RiskProfile
  ): PositionOptimizationResult {
    const now = new Date();
    return {
      profile,
      allocations: positions.map(p => ({
        ticker: p.ticker,
        targetWeight: p.currentWeight,
        currentWeight: p.currentWeight,
        deviation: 0,
        action: 'hold' as const,
        suggestedAmount: 0,
      })),
      totalDeviation: 0,
      needsRebalancing: false,
      riskMetrics: {
        expectedReturn: 0.08,
        expectedVolatility: 0.15,
        maxDrawdown: 0.10,
        sharpeRatio: 0.27,
        concentrationRisk: 0.5,
      },
      expectedRiskChange: {
        returnChange: 0,
        volatilityChange: 0,
        drawdownChange: 0,
        sharpeChange: 0,
        concentrationChange: 0,
      },
      reasoning: ['无法获取市场数据，保持当前配置'],
      generatedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
    };
  }

  /**
   * 强制刷新优化结果
   */
  async refresh(
    positions: Position[],
    profile: RiskProfile = this.userRiskBudget.riskProfile,
    market: string = 'us'
  ): Promise<PositionOptimizationResult> {
    this.cachedResults.delete(profile);
    return this.optimizePositions(positions, profile, market);
  }

  /**
   * 检查是否需要重新优化 (Requirement 4.5)
   */
  async checkNeedsReoptimization(market: string = 'us'): Promise<boolean> {
    try {
      const currentRegime = await this.getCurrentRegime(market);
      if (this.lastMarketRegime && this.lastMarketRegime !== currentRegime) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

// === Export Singleton ===

export const positionOptimizer = new PositionOptimizer();

// === Pure Functions for Testing ===

export const _testing = {
  calculateConcentrationRisk,
  calculateExpectedReturn,
  calculateExpectedVolatility,
  estimateMaxDrawdown,
  calculateSharpeRatio,
  calculateTargetWeights,
  calculateRiskMetrics,
  RISK_PROFILE_PARAMS,
  REBALANCE_THRESHOLD,
  ASSET_CLASS_PARAMS,
};
