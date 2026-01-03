/**
 * useSupabasePortfolio Hook
 * 
 * Refactored to use @tanstack/react-query for efficient data fetching, caching, and state management.
 * Replaces manual useState/useEffect/setTimeout logic.
 * 
 * @deprecated 请使用 useDashboardStore 替代此 Hook
 * 此 Hook 将在未来版本中移除
 * @see useDashboardStore
 */

import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLatestDashboard,
  getLatestRiskMetrics,
  getLatestStockPositions,
  getLatestOptionPositions,
  getLatestReturnAttribution,
  getYTDReturnAttribution,
  getLatestCostAnalysis,
  getDashboardHistory,
  getDataYear,
  getTransactions as getSupabaseTransactions,
  getWatchlist as getSupabaseWatchlist,
  getUserSettings as getSupabaseSettings,
  addTransaction as addSupabaseTransaction,
  deleteTransaction as deleteSupabaseTransaction,
  addToWatchlist as addSupabaseWatchlistItem,
  removeFromWatchlist as removeSupabaseWatchlistItem,
  updateUserSettings as updateSupabaseSettings,
  type DashboardSnapshot,
  type RiskMetrics,
  type StockPosition,
  type OptionPosition,
} from '../services/supabaseData';
import { fetchMultipleStocks } from '../services/marketData';
import type { Transaction, WatchlistItem, AppSettings } from '../types';
import { toMarket, toCurrency, toAction } from '../services/storage';
import { initSupabase } from '../services/supabase';

// --- Helpers to adapt Supabase data ---

function adaptSupabaseSettings(supabaseSettings: any): AppSettings {
  // 尝试从 LocalStorage 读取 Supabase 配置
  let localConfig = {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    enabled: !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
  };

  try {
    const cached = localStorage.getItem('rc_supabase_config');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.url && parsed.anonKey) {
        localConfig = {
          url: parsed.url,
          anonKey: parsed.anonKey,
          enabled: parsed.enabled !== false,
        };
      }
    }
  } catch (e) {
    console.warn('Failed to parse rc_supabase_config', e);
  }

  // 读取数据年份
  let dataYear = 2025;
  try {
    const cachedYear = localStorage.getItem('rc_data_year');
    if (cachedYear) {
      const year = parseInt(cachedYear);
      if (year >= 2024 && year <= 2030) {
        dataYear = year;
      }
    }
  } catch (e) {
    console.warn('Failed to parse rc_data_year', e);
  }

  if (!supabaseSettings) {
    return {
      supabase: localConfig,
      defaultCurrency: 'CNY',
      dataYear,
      riskLimits: {
        stopLossPercent: -20,
        maxDrawdownPercent: 5,
        positionLimitPercent: 15,
        watchlistCooldownDays: 7,
        positionLimitExceptions: [
          { ticker: 'PDD', name: '拼多多 (PDD Holdings)', limitPercent: 80.1 },
        ],
      },
    };
  }
  
  return {
    supabase: localConfig, // 始终使用本地/Env配置，忽略数据库中的（如果有）
    defaultCurrency: toCurrency(supabaseSettings.default_currency || 'CNY'),
    dataYear,
    riskLimits: {
      stopLossPercent: supabaseSettings.stop_loss_percent || -20,
      maxDrawdownPercent: supabaseSettings.max_drawdown_percent || 5,
      positionLimitPercent: supabaseSettings.position_limit_percent || 15,
      watchlistCooldownDays: supabaseSettings.watchlist_cooldown_days || 7,
      positionLimitExceptions: Array.isArray(supabaseSettings.position_limit_exceptions)
        ? supabaseSettings.position_limit_exceptions
        : [],
    },
    lastSyncTime: supabaseSettings.updated_at,
  };
}

function adaptSupabaseTransaction(tx: any): Transaction {
  let dateStr = tx.date;
  if (!dateStr && tx.created_at) {
    dateStr = tx.created_at.split('T')[0];
  } else if (!dateStr) {
    dateStr = new Date().toISOString().split('T')[0];
  }
  
  return {
    id: tx.id,
    date: dateStr,
    ticker: tx.ticker,
    name: tx.name || '',
    market: toMarket(tx.market),
    currency: toCurrency(tx.currency),
    action: toAction(tx.action),
    price: tx.price || 0,
    quantity: tx.quantity,
    amount: tx.amount || 0,
    amountCNY: tx.amount_cny || 0,
    fee: tx.fee || 0,
    strategyNote: tx.strategy_note || '',
    isPlanned: tx.is_planned || false,
    watchlistDays: tx.watchlist_days || undefined,
    createdAt: tx.created_at || new Date().toISOString(),
  };
}

function adaptSupabaseWatchlist(item: any): WatchlistItem {
  return {
    id: item.id,
    ticker: item.ticker,
    name: item.name || '',
    market: toMarket(item.market),
    currency: toCurrency(item.currency),
    addedDate: item.added_date || new Date().toISOString().split('T')[0],
    targetPrice: item.target_price || undefined,
    notes: item.notes || '',
    currentPrice: item.current_price || undefined,
    changePercent: item.change_percent || undefined,
  };
}

// --- Query Keys ---
// --- Hook ---
export function useSupabasePortfolio() {
  const queryClient = useQueryClient();
  
  // 获取当前数据年份，用于 queryKey
  const dataYear = useMemo(() => getDataYear(), []);
  
  // 动态生成包含年份的 queryKey
  const queryKeys = useMemo(() => ({
    dashboard: ['dashboard', dataYear],
    positions: ['positions', dataYear],
    stockPositions: ['positions', 'stocks', dataYear],
    optionPositions: ['positions', 'options', dataYear],
    riskMetrics: ['riskMetrics', dataYear],
    returnAttribution: ['returnAttribution', dataYear],
    costAnalysis: ['costAnalysis', dataYear],
    history: ['history', dataYear],
    transactions: ['transactions', dataYear],
    watchlist: ['watchlist'],
    settings: ['settings'],
    livePrices: ['livePrices'],
  }), [dataYear]);

  // 0. 初始化 Supabase (从 LocalStorage)
  // 确保在任何查询执行前，Supabase 客户端已准备好
  useEffect(() => {
    try {
      const cached = localStorage.getItem('rc_supabase_config');
      if (cached) {
        const config = JSON.parse(cached);
        if (config.url && config.anonKey && config.enabled) {
          console.log('[useSupabasePortfolio] Auto-initializing Supabase from cache');
          initSupabase(config);
        }
      }
    } catch (e) {
      console.warn('[useSupabasePortfolio] Failed to auto-init Supabase', e);
    }
  }, []);

  // 1. Critical Data
  
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: getLatestDashboard,
    staleTime: 5 * 60 * 1000, // 5 mins
  });

  const stockPositionsQuery = useQuery({
    queryKey: queryKeys.stockPositions,
    queryFn: async () => (await getLatestStockPositions()) || [],
    staleTime: 5 * 60 * 1000,
  });

  const optionPositionsQuery = useQuery({
    queryKey: queryKeys.optionPositions,
    queryFn: async () => (await getLatestOptionPositions()) || [],
    staleTime: 5 * 60 * 1000,
  });

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: async () => {
        const data = await getSupabaseSettings();
        return adaptSupabaseSettings(data);
    },
    staleTime: Infinity,
  });

  // 2. Secondary Data
  
  const riskMetricsQuery = useQuery({
    queryKey: queryKeys.riskMetrics,
    queryFn: getLatestRiskMetrics,
    staleTime: 10 * 60 * 1000,
  });

  const returnAttributionQuery = useQuery({
    queryKey: queryKeys.returnAttribution,
    queryFn: getYTDReturnAttribution, // 使用 YTD 累计数据
    staleTime: 10 * 60 * 1000,
  });

  const costAnalysisQuery = useQuery({
    queryKey: queryKeys.costAnalysis,
    queryFn: getLatestCostAnalysis,
    staleTime: 10 * 60 * 1000,
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.history,
    queryFn: async () => {
        const data = await getDashboardHistory(365); // 获取全年数据
        return (data || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    },
    staleTime: 60 * 60 * 1000,
  });

  // 3. User Data
  
  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions,
    queryFn: async () => {
        const data = await getSupabaseTransactions();
        return (data || []).map(adaptSupabaseTransaction);
    },
    staleTime: 5 * 60 * 1000,
  });

  const watchlistQuery = useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: async () => {
        const data = await getSupabaseWatchlist();
        return (data || []).map(adaptSupabaseWatchlist);
    },
    staleTime: 5 * 60 * 1000,
  });

  // 4. Live Market Data
  
  const tickers = [
    ...(stockPositionsQuery.data?.map(p => p.ticker) || []),
    ...(watchlistQuery.data?.map(w => w.ticker) || [])
  ];
  const uniqueTickers = Array.from(new Set(tickers));

  const livePricesQuery = useQuery({
    queryKey: [...queryKeys.livePrices, ...uniqueTickers.sort()],
    queryFn: async () => {
        if (uniqueTickers.length === 0) return {};
        const map = await fetchMultipleStocks(uniqueTickers);
        const record: Record<string, { currentPrice: number; changePercent: number; lastUpdated: number }> = {};
        map.forEach((value, key) => {
            record[key] = {
                currentPrice: value.currentPrice,
                changePercent: value.changePercent,
                lastUpdated: value.lastUpdated
            };
        });
        return record;
    },
    enabled: uniqueTickers.length > 0,
    refetchInterval: 30 * 1000, // 30s auto-refresh
    staleTime: 10 * 1000,
  });

  // Mutations
  
  const addTransactionMutation = useMutation({
    mutationFn: addSupabaseTransaction,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
        // Force refetch to ensure UI updates immediately
        transactionsQuery.refetch();
    }
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: deleteSupabaseTransaction,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
        // Force refetch
        transactionsQuery.refetch();
    }
  });

  const addToWatchlistMutation = useMutation({
    mutationFn: async (item: Omit<WatchlistItem, 'id' | 'addedDate'>) => {
        const watchlistItem: WatchlistItem = {
            ...item,
            id: `watch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            addedDate: new Date().toISOString().split('T')[0],
        };
        
        const success = await addSupabaseWatchlistItem({
            id: watchlistItem.id,
            ticker: watchlistItem.ticker,
            name: watchlistItem.name,
            market: watchlistItem.market,
            currency: watchlistItem.currency,
            addedDate: watchlistItem.addedDate,
            targetPrice: watchlistItem.targetPrice,
            notes: watchlistItem.notes || '',
            currentPrice: watchlistItem.currentPrice,
            changePercent: watchlistItem.changePercent,
        });
        if (!success) throw new Error('添加观察列表项失败');
        return watchlistItem;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
    }
  });

  const removeFromWatchlistMutation = useMutation({
    mutationFn: async (id: string) => {
        const success = await removeSupabaseWatchlistItem(id);
        if (!success) throw new Error('删除观察列表项失败');
        return id;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<AppSettings>) => {
      const supabaseSettings: any = {};
      if (newSettings.riskLimits) {
        supabaseSettings.stop_loss_percent = newSettings.riskLimits.stopLossPercent;
        supabaseSettings.max_drawdown_percent = newSettings.riskLimits.maxDrawdownPercent;
        supabaseSettings.position_limit_percent = newSettings.riskLimits.positionLimitPercent;
        supabaseSettings.watchlist_cooldown_days = newSettings.riskLimits.watchlistCooldownDays;
        supabaseSettings.position_limit_exceptions = newSettings.riskLimits.positionLimitExceptions;
      }
      if (newSettings.supabase) {
        supabaseSettings.supabase_url = newSettings.supabase.url;
        supabaseSettings.supabase_anon_key = newSettings.supabase.anonKey;
        supabaseSettings.supabase_enabled = newSettings.supabase.enabled;
      }
      if (newSettings.defaultCurrency) {
        supabaseSettings.default_currency = newSettings.defaultCurrency;
      }
      
      const success = await updateSupabaseSettings(supabaseSettings);
      if (!success) throw new Error('更新设置失败');
      return newSettings;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    }
  });

  const isLoading = dashboardQuery.isLoading || stockPositionsQuery.isLoading || settingsQuery.isLoading;
  const error = dashboardQuery.error || stockPositionsQuery.error || settingsQuery.error;

  return {
    dashboard: dashboardQuery.data || null,
    riskMetrics: riskMetricsQuery.data || null,
    stockPositions: stockPositionsQuery.data || [],
    optionPositions: optionPositionsQuery.data || [],
    returnAttribution: returnAttributionQuery.data || null,
    costAnalysis: costAnalysisQuery.data || null,
    history: historyQuery.data || [],
    livePrices: livePricesQuery.data || {},
    transactions: transactionsQuery.data || [],
    watchlist: watchlistQuery.data || [],
    settings: settingsQuery.data || null,
    
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Error loading data') : null,
    lastUpdate: new Date(), 
    
    refresh: async () => {
        await queryClient.invalidateQueries();
    },
    refreshMarketData: async () => {
        await livePricesQuery.refetch();
    },
    
    addTransaction: async (tx: Transaction) => { await addTransactionMutation.mutateAsync(tx); },
    deleteTransaction: async (id: string) => { await deleteTransactionMutation.mutateAsync(id); },
    addToWatchlist: async (item: Omit<WatchlistItem, 'id' | 'addedDate'>) => { await addToWatchlistMutation.mutateAsync(item); },
    removeFromWatchlist: async (id: string) => { await removeFromWatchlistMutation.mutateAsync(id); },
    updateSettings: async (s: Partial<AppSettings>) => { await updateSettingsMutation.mutateAsync(s); },
  };
}
