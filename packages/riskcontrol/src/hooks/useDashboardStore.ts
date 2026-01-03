/**
 * 统一数据层 Hook
 * 解决 Dashboard 各卡片数据不一致的问题
 * 
 * 核心特性：
 * 1. 使用 useQueries 并行获取所有静态数据
 * 2. 统一缓存策略（3 分钟 staleTime）
 * 3. 数据一致性验证
 * 4. 实时价格独立管理
 */

import { useCallback, useMemo } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getLatestDashboard,
  getLatestRiskMetrics,
  getLatestStockPositions,
  getLatestOptionPositions,
  getYTDReturnAttribution,
  getLatestCostAnalysis,
  getDashboardHistory,
  getDataYear,
  type StockPosition,
  type OptionPosition,
} from '../services/supabaseData';
import { fetchMultipleStocks } from '../services/marketData';
import type { 
  DashboardSnapshot, 
  DashboardStoreResult, 
  ConsistencyValidationResult,
  LivePriceData,
  ReturnAttributionData,
  CostAnalysisData,
} from '../types/dashboard';

/**
 * 统一缓存配置
 */
const CACHE_CONFIG = {
  static: {
    staleTime: 3 * 60 * 1000,  // 3 分钟
    gcTime: 10 * 60 * 1000,    // 10 分钟
  },
  live: {
    staleTime: 30 * 1000,      // 30 秒
    refetchInterval: 30 * 1000,
  },
};

/**
 * 统一数据层 Hook
 * 
 * @returns DashboardStoreResult
 */
export function useDashboardStore(): DashboardStoreResult {
  const queryClient = useQueryClient();
  const dataYear = useMemo(() => getDataYear(), []);
  
  // 使用 useQueries 并行获取所有静态数据
  const staticQueries = useQueries({
    queries: [
      {
        queryKey: ['unified', 'dashboard', dataYear],
        queryFn: getLatestDashboard,
        ...CACHE_CONFIG.static,
      },
      {
        queryKey: ['unified', 'stockPositions', dataYear],
        queryFn: async (): Promise<StockPosition[]> => (await getLatestStockPositions()) || [],
        ...CACHE_CONFIG.static,
      },
      {
        queryKey: ['unified', 'optionPositions', dataYear],
        queryFn: async (): Promise<OptionPosition[]> => (await getLatestOptionPositions()) || [],
        ...CACHE_CONFIG.static,
      },
      {
        queryKey: ['unified', 'riskMetrics', dataYear],
        queryFn: getLatestRiskMetrics,
        ...CACHE_CONFIG.static,
      },
      {
        queryKey: ['unified', 'history', dataYear],
        queryFn: async () => {
          const data = await getDashboardHistory(365);
          return (data || []).sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );
        },
        ...CACHE_CONFIG.static,
      },
      {
        queryKey: ['unified', 'returnAttribution', dataYear],
        queryFn: async (): Promise<ReturnAttributionData | null> => {
          const data = await getYTDReturnAttribution();
          return data as ReturnAttributionData | null;
        },
        ...CACHE_CONFIG.static,
      },
      {
        queryKey: ['unified', 'costAnalysis', dataYear],
        queryFn: async (): Promise<CostAnalysisData | null> => {
          const data = await getLatestCostAnalysis();
          return data as CostAnalysisData | null;
        },
        ...CACHE_CONFIG.static,
      },
    ],
    combine: (results) => {
      // 计算统一的时间戳（取最新的 dataUpdatedAt）
      const timestamps = results
        .map(r => r.dataUpdatedAt)
        .filter((t): t is number => t !== undefined && t > 0);
      const latestTimestamp = timestamps.length > 0 
        ? Math.max(...timestamps) 
        : Date.now();
      
      const snapshot: DashboardSnapshot = {
        timestamp: latestTimestamp,
        dashboard: results[0].data ?? null,
        stockPositions: (results[1].data ?? []) as StockPosition[],
        optionPositions: (results[2].data ?? []) as OptionPosition[],
        riskMetrics: results[3].data ?? null,
        history: results[4].data ?? [],
        returnAttribution: (results[5].data ?? null) as ReturnAttributionData | null,
        costAnalysis: (results[6].data ?? null) as CostAnalysisData | null,
      };
      
      return {
        snapshot,
        isLoading: results.some(r => r.isLoading),
        isError: results.some(r => r.isError),
        errors: results.map(r => r.error ?? null),
      };
    },
  });
  
  // 实时价格（独立查询）
  const tickers = useMemo(() => {
    const allTickers = [
      ...staticQueries.snapshot.stockPositions.map((p: StockPosition) => p.ticker),
    ];
    return Array.from(new Set(allTickers.filter(Boolean)));
  }, [staticQueries.snapshot.stockPositions]);
  
  const livePricesQuery = useQuery({
    queryKey: ['unified', 'livePrices', ...tickers.sort()],
    queryFn: async (): Promise<LivePriceData> => {
      if (tickers.length === 0) return {};
      const map = await fetchMultipleStocks(tickers);
      const record: LivePriceData = {};
      map.forEach((value, key) => {
        record[key] = {
          currentPrice: value.currentPrice,
          changePercent: value.changePercent,
          lastUpdated: value.lastUpdated,
        };
      });
      return record;
    },
    enabled: tickers.length > 0,
    ...CACHE_CONFIG.live,
  });
  
  // 数据一致性验证
  const validateConsistency = useCallback((): ConsistencyValidationResult => {
    const { snapshot } = staticQueries;
    const { dashboard, stockPositions, optionPositions } = snapshot;
    
    if (!dashboard) return { valid: true, issues: [] };
    
    const issues: string[] = [];
    
    // 验证持仓数量
    const actualPositions = stockPositions.length + optionPositions.length;
    if (dashboard.total_positions !== actualPositions) {
      issues.push(
        `持仓数量不一致: dashboard.total_positions=${dashboard.total_positions}, actual=${actualPositions}`
      );
    }
    
    // 验证股票持仓数
    if (dashboard.stock_positions !== stockPositions.length) {
      issues.push(
        `股票持仓数不一致: dashboard.stock_positions=${dashboard.stock_positions}, actual=${stockPositions.length}`
      );
    }
    
    // 验证期权持仓数
    if (dashboard.option_positions !== optionPositions.length) {
      issues.push(
        `期权持仓数不一致: dashboard.option_positions=${dashboard.option_positions}, actual=${optionPositions.length}`
      );
    }
    
    if (issues.length > 0) {
      console.warn('[DashboardStore] 数据一致性问题:', issues);
    }
    
    return { valid: issues.length === 0, issues };
  }, [staticQueries]);
  
  // 刷新所有数据
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ 
      predicate: (query) => 
        Array.isArray(query.queryKey) && query.queryKey[0] === 'unified'
    });
  }, [queryClient]);
  
  return {
    snapshot: staticQueries.snapshot,
    livePrices: livePricesQuery.data ?? {},
    isLoading: staticQueries.isLoading,
    isError: staticQueries.isError,
    errors: staticQueries.errors,
    refresh,
    validateConsistency,
    lastUpdated: new Date(staticQueries.snapshot.timestamp),
  };
}

// 导出类型
export type { 
  DashboardSnapshot, 
  DashboardStoreResult, 
  ConsistencyValidationResult, 
  LivePriceData,
  EnrichedStockPosition,
};

// 导出工具函数
export { enrichWithLivePrices } from '../types/dashboard';
