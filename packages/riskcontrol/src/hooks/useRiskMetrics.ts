/**
 * 风控指标 Hook
 * Task 11.2: 集成实时风控检查
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  calculateRiskMetrics, 
  type RiskMetrics, 
  type RiskThresholds,
  type DailyPnL,
  DEFAULT_THRESHOLDS 
} from '@/services/riskMetricsService';
import { 
  getBreakerSummary,
  triggerBreaker,
  type BreakerType 
} from '@/services/circuitBreakerService';
import { 
  getRiskThresholds as getRiskThresholdsDB, 
  getMonthlySnapshot,
  recordMonthlySnapshot 
} from '@/services/riskDataService';
import { useSupabasePortfolio } from './useSupabasePortfolio';

interface UseRiskMetricsResult {
  metrics: RiskMetrics | null;
  thresholds: RiskThresholds;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  tradingAllowed: boolean;
  requiresConfirmation: boolean;
  activeBreakers: Array<{ type: BreakerType; reason: string }>;
}

export function useRiskMetrics(userId: number = 1): UseRiskMetricsResult {
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [thresholds, setThresholds] = useState<RiskThresholds>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { dashboard, history, loading: portfolioLoading } = useSupabasePortfolio();
  
  // 检查并记录月度快照
  const checkMonthlySnapshot = useCallback(async (currentNAV: number) => {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    try {
      const snapshot = await getMonthlySnapshot(userId, yearMonth);
      
      if (!snapshot) {
        // 当月没有快照，记录一个
        await recordMonthlySnapshot(userId, yearMonth, currentNAV);
        return currentNAV;
      }
      
      return snapshot.start_nav;
    } catch (err) {
      console.error('Failed to check monthly snapshot:', err);
      return currentNAV; // 失败时使用当前NAV
    }
  }, [userId]);
  
  // 计算风控指标
  const calculateMetrics = useCallback(async () => {
    if (portfolioLoading || !dashboard) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // 获取用户风控配置
      const dbThresholds = await getRiskThresholdsDB(userId);
      const userThresholds: RiskThresholds = dbThresholds ? {
        leverageWarning: dbThresholds.leverage_warning,
        leverageCritical: dbThresholds.leverage_critical,
        leverageInDrawdown: dbThresholds.leverage_in_drawdown,
        monthlyDrawdownWarning: dbThresholds.monthly_drawdown_warning,
        monthlyDrawdownCritical: dbThresholds.monthly_drawdown_critical,
        trailingStopPercent: dbThresholds.trailing_stop_percent,
        losingStreakWarning: dbThresholds.losing_streak_warning,
        losingStreakCritical: dbThresholds.losing_streak_critical,
      } : DEFAULT_THRESHOLDS;
      
      setThresholds(userThresholds);
      
      // 获取当前数据
      const currentNAV = Number(dashboard.net_worth_cny) || 0;
      const currentLeverage = Number(dashboard.leverage_ratio) || 1;
      const highWaterMark = Number(dashboard.high_water_mark) || currentNAV;
      
      // 获取月初NAV
      const monthStartNAV = await checkMonthlySnapshot(currentNAV);
      
      // 转换日收益历史
      const dailyPnLHistory: DailyPnL[] = (history || []).map((d: any) => ({
        date: d.date,
        pnl: Number(d.daily_pnl) || 0,
        pnlPercent: Number(d.daily_pnl_percent) || 0,
      }));
      
      // 计算风控指标
      const calculatedMetrics = calculateRiskMetrics(
        currentNAV,
        currentLeverage,
        monthStartNAV,
        highWaterMark,
        dailyPnLHistory,
        userThresholds
      );
      
      setMetrics(calculatedMetrics);
      
      // 检查并触发熔断
      const breakerSummary = getBreakerSummary(calculatedMetrics, userThresholds);
      
      // 记录触发的熔断事件
      for (const { type, result } of breakerSummary.activeBreakers) {
        if (result.severity === 'critical') {
          await triggerBreaker(userId, type, result);
        }
      }
      
    } catch (err) {
      console.error('Failed to calculate risk metrics:', err);
      setError(err instanceof Error ? err.message : '计算风控指标失败');
    } finally {
      setLoading(false);
    }
  }, [dashboard, history, portfolioLoading, userId, checkMonthlySnapshot]);
  
  // 初始加载和数据变化时重新计算
  useEffect(() => {
    calculateMetrics();
  }, [calculateMetrics]);
  
  // 获取熔断摘要
  const breakerSummary = metrics 
    ? getBreakerSummary(metrics, thresholds)
    : { tradingAllowed: true, requiresConfirmation: false, activeBreakers: [] };
  
  return {
    metrics,
    thresholds,
    loading: loading || portfolioLoading,
    error,
    refresh: calculateMetrics,
    tradingAllowed: breakerSummary.tradingAllowed,
    requiresConfirmation: breakerSummary.requiresConfirmation,
    activeBreakers: breakerSummary.activeBreakers.map(({ type, result }) => ({
      type,
      reason: result.reason,
    })),
  };
}

export default useRiskMetrics;
