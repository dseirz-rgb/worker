/**
 * useRiskDecision Hook
 * 
 * 封装风险决策获取和订阅逻辑。
 * 
 * Requirements: 7.1 - 实时显示当前风险等级
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  riskDecisionEngine, 
  RiskDecision, 
  RiskLevel 
} from '../services/riskDecisionEngine';
import { getLatestStockPositions } from '../services/supabaseData';

// === Types ===

export interface UseRiskDecisionOptions {
  tickers?: string[];
  market?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // ms
  usePortfolioTickers?: boolean; // 是否从持仓获取股票代码
}

export interface UseRiskDecisionResult {
  decision: RiskDecision | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  override: (params: {
    effectiveLeverage?: number;
    effectiveStopLoss?: number;
    tradingAllowed?: boolean;
    reason: string;
    userId: string;
  }) => Promise<void>;
  portfolioTickers: string[]; // 当前使用的股票代码
}

// === Default Values ===

const DEFAULT_TICKERS = ['SPY'];
const DEFAULT_MARKET = 'us';
const DEFAULT_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// === Hook Implementation ===

export function useRiskDecision(
  options: UseRiskDecisionOptions = {}
): UseRiskDecisionResult {
  const {
    tickers: propTickers,
    market = DEFAULT_MARKET,
    autoRefresh = true,
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    usePortfolioTickers = true, // 默认从持仓获取
  } = options;

  const [decision, setDecision] = useState<RiskDecision | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [portfolioTickers, setPortfolioTickers] = useState<string[]>(propTickers || DEFAULT_TICKERS);

  // 从持仓获取股票代码
  const fetchPortfolioTickers = useCallback(async (): Promise<string[]> => {
    if (!usePortfolioTickers) {
      return propTickers || DEFAULT_TICKERS;
    }
    
    try {
      const positions = await getLatestStockPositions();
      if (positions.length > 0) {
        // 按市值排序，取前 10 个主要持仓
        const sortedPositions = positions
          .filter(p => p.market_value > 0)
          .sort((a, b) => b.market_value - a.market_value)
          .slice(0, 10);
        
        const tickers = sortedPositions.map(p => p.ticker);
        console.log('[useRiskDecision] Portfolio tickers:', tickers);
        
        // 如果没有持仓，使用 SPY 作为市场代表
        return tickers.length > 0 ? tickers : DEFAULT_TICKERS;
      }
    } catch (err) {
      console.warn('[useRiskDecision] Failed to fetch portfolio tickers:', err);
    }
    
    return propTickers || DEFAULT_TICKERS;
  }, [usePortfolioTickers, propTickers]);

  // 获取决策
  const fetchDecision = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 先获取持仓股票代码
      const tickers = await fetchPortfolioTickers();
      setPortfolioTickers(tickers);
      
      const result = await riskDecisionEngine.generateDecision(tickers, market);
      setDecision(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('获取风险决策失败'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchPortfolioTickers, market]);

  // 刷新决策
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 重新获取持仓股票代码
      const tickers = await fetchPortfolioTickers();
      setPortfolioTickers(tickers);
      
      const result = await riskDecisionEngine.refresh(tickers, market);
      setDecision(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('刷新风险决策失败'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchPortfolioTickers, market]);

  // 覆盖决策
  const override = useCallback(async (params: {
    effectiveLeverage?: number;
    effectiveStopLoss?: number;
    tradingAllowed?: boolean;
    reason: string;
    userId: string;
  }) => {
    if (!decision) {
      throw new Error('没有可覆盖的决策');
    }
    
    try {
      setIsLoading(true);
      const result = await riskDecisionEngine.overrideDecision(decision.id, params);
      setDecision(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('覆盖决策失败'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [decision]);

  // 初始加载
  useEffect(() => {
    fetchDecision();
  }, [fetchDecision]);

  // 订阅决策更新
  useEffect(() => {
    const unsubscribe = riskDecisionEngine.onDecision((newDecision) => {
      setDecision(newDecision);
    });
    return unsubscribe;
  }, []);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchDecision();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchDecision]);

  return {
    decision,
    isLoading,
    error,
    refresh,
    override,
    portfolioTickers,
  };
}

// === Utility Hooks ===

/**
 * 获取风险等级颜色
 */
export function useRiskLevelColor(level: RiskLevel | undefined): string {
  switch (level) {
    case 'low':
      return 'text-green-500';
    case 'medium':
      return 'text-yellow-500';
    case 'high':
      return 'text-orange-500';
    case 'critical':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * 获取风险等级背景色
 */
export function useRiskLevelBgColor(level: RiskLevel | undefined): string {
  switch (level) {
    case 'low':
      return 'bg-green-500/10';
    case 'medium':
      return 'bg-yellow-500/10';
    case 'high':
      return 'bg-orange-500/10';
    case 'critical':
      return 'bg-red-500/10';
    default:
      return 'bg-muted';
  }
}

/**
 * 获取风险等级标签
 */
export function getRiskLevelLabel(level: RiskLevel | undefined): string {
  switch (level) {
    case 'low':
      return '低风险';
    case 'medium':
      return '中等风险';
    case 'high':
      return '高风险';
    case 'critical':
      return '极高风险';
    default:
      return '未知';
  }
}

export default useRiskDecision;
