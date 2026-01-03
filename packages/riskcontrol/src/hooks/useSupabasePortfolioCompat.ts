/**
 * 向后兼容适配器
 * 将新的 useDashboardStore 适配为旧的 useSupabasePortfolio 接口
 * 
 * 用途：
 * 1. 允许渐进式迁移，新旧 Hook 可以共存
 * 2. 保持与现有组件的兼容性
 * 3. 迁移完成后可以标记为 deprecated
 * 
 * @deprecated 请使用 useDashboardStore 替代
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardStore } from './useDashboardStore';
import {
  getTransactions as getSupabaseTransactions,
  getWatchlist as getSupabaseWatchlist,
  getUserSettings as getSupabaseSettings,
  addTransaction as addSupabaseTransaction,
  deleteTransaction as deleteSupabaseTransaction,
  addToWatchlist as addSupabaseWatchlistItem,
  removeFromWatchlist as removeSupabaseWatchlistItem,
  updateUserSettings as updateSupabaseSettings,
  getDataYear,
} from '../services/supabaseData';
import type { Transaction, WatchlistItem, AppSettings } from '../types';
import { toMarket, toCurrency, toAction } from '../services/storage';

// 缓存配置
const USER_CACHE_CONFIG = {
  staleTime: 5 * 60 * 1000,  // 5 分钟
  gcTime: 10 * 60 * 1000,    // 10 分钟
};

// 适配 Supabase 设置到 AppSettings
function adaptSupabaseSettings(supabaseSettings: any): AppSettings {
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
    supabase: localConfig,
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

// 适配 Supabase 交易记录
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

// 适配 Supabase 观察列表
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

/**
 * 向后兼容适配器 Hook
 * 保持与现有 useSupabasePortfolio 相同的返回类型
 * 
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useSupabasePortfolioCompat() {
  const queryClient = useQueryClient();
  const dataYear = useMemo(() => getDataYear(), []);
  
  // 使用新的统一数据层
  const { snapshot, livePrices, isLoading, isError, refresh } = useDashboardStore();
  
  // 用户数据查询（独立于 snapshot）
  const settingsQuery = useQuery({
    queryKey: ['compat', 'settings'],
    queryFn: async () => {
      const data = await getSupabaseSettings();
      return adaptSupabaseSettings(data);
    },
    staleTime: Infinity,
  });
  
  const transactionsQuery = useQuery({
    queryKey: ['compat', 'transactions', dataYear],
    queryFn: async () => {
      const data = await getSupabaseTransactions();
      return (data || []).map(adaptSupabaseTransaction);
    },
    ...USER_CACHE_CONFIG,
  });
  
  const watchlistQuery = useQuery({
    queryKey: ['compat', 'watchlist'],
    queryFn: async () => {
      const data = await getSupabaseWatchlist();
      return (data || []).map(adaptSupabaseWatchlist);
    },
    ...USER_CACHE_CONFIG,
  });
  
  // Mutations
  const addTransactionMutation = useMutation({
    mutationFn: addSupabaseTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compat', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['unified', 'dashboard'] });
    },
  });
  
  const deleteTransactionMutation = useMutation({
    mutationFn: deleteSupabaseTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compat', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['unified', 'dashboard'] });
    },
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
      queryClient.invalidateQueries({ queryKey: ['compat', 'watchlist'] });
    },
  });
  
  const removeFromWatchlistMutation = useMutation({
    mutationFn: async (id: string) => {
      const success = await removeSupabaseWatchlistItem(id);
      if (!success) throw new Error('删除观察列表项失败');
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compat', 'watchlist'] });
    },
  });
  
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<AppSettings>) => {
      const supabaseSettings: Record<string, unknown> = {};
      if (newSettings.riskLimits) {
        supabaseSettings.stop_loss_percent = newSettings.riskLimits.stopLossPercent;
        supabaseSettings.max_drawdown_percent = newSettings.riskLimits.maxDrawdownPercent;
        supabaseSettings.position_limit_percent = newSettings.riskLimits.positionLimitPercent;
        supabaseSettings.watchlist_cooldown_days = newSettings.riskLimits.watchlistCooldownDays;
        supabaseSettings.position_limit_exceptions = newSettings.riskLimits.positionLimitExceptions;
      }
      if (newSettings.defaultCurrency) {
        supabaseSettings.default_currency = newSettings.defaultCurrency;
      }
      
      const success = await updateSupabaseSettings(supabaseSettings);
      if (!success) throw new Error('更新设置失败');
      return newSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compat', 'settings'] });
    },
  });
  
  // 计算 loading 和 error 状态
  const loading = isLoading || settingsQuery.isLoading;
  const error = isError || settingsQuery.isError 
    ? 'Error loading data' 
    : null;
  
  // 转换 livePrices 为旧格式
  const livePricesCompat = useMemo(() => {
    const result: Record<string, { currentPrice: number; changePercent: number; lastUpdated: number }> = {};
    for (const [key, value] of Object.entries(livePrices)) {
      result[key] = {
        currentPrice: value.currentPrice,
        changePercent: value.changePercent,
        lastUpdated: value.lastUpdated,
      };
    }
    return result;
  }, [livePrices]);
  
  return {
    // 从 snapshot 获取的数据
    dashboard: snapshot.dashboard,
    riskMetrics: snapshot.riskMetrics,
    stockPositions: snapshot.stockPositions,
    optionPositions: snapshot.optionPositions,
    returnAttribution: snapshot.returnAttribution,
    costAnalysis: snapshot.costAnalysis,
    history: snapshot.history,
    livePrices: livePricesCompat,
    
    // 用户数据
    transactions: transactionsQuery.data || [],
    watchlist: watchlistQuery.data || [],
    settings: settingsQuery.data || null,
    
    // 状态
    loading,
    error,
    lastUpdate: new Date(snapshot.timestamp),
    
    // 操作
    refresh,
    refreshMarketData: async () => {
      await queryClient.invalidateQueries({ queryKey: ['unified', 'livePrices'] });
    },
    
    // Mutations
    addTransaction: async (tx: Transaction) => { 
      await addTransactionMutation.mutateAsync(tx); 
    },
    deleteTransaction: async (id: string) => { 
      await deleteTransactionMutation.mutateAsync(id); 
    },
    addToWatchlist: async (item: Omit<WatchlistItem, 'id' | 'addedDate'>) => { 
      await addToWatchlistMutation.mutateAsync(item); 
    },
    removeFromWatchlist: async (id: string) => { 
      await removeFromWatchlistMutation.mutateAsync(id); 
    },
    updateSettings: async (s: Partial<AppSettings>) => { 
      await updateSettingsMutation.mutateAsync(s); 
    },
  };
}
