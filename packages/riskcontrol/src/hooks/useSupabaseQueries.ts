/**
 * 使用 React Query 的 Supabase 数据 Hooks
 * 
 * @deprecated 请使用 useDashboardStore 替代此文件中的 Hooks
 * 此文件中的所有 Hooks 将在未来版本中移除
 * @see useDashboardStore
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLatestDashboard,
  getLatestRiskMetrics,
  getLatestStockPositions,
  getLatestOptionPositions,
  getLatestReturnAttribution,
  getDashboardHistory,
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
import type { Transaction, WatchlistItem, AppSettings } from '../types';
import { toMarket, toCurrency, toAction } from '../services/storage';

// React Query 缓存配置（不再使用 localStorage）
const CACHE_TIMES = {
  // 关键数据：2分钟缓存，5分钟过期（确保数据及时更新）
  critical: {
    staleTime: 2 * 60 * 1000, // 2分钟内不重新请求
    gcTime: 5 * 60 * 1000, // 5分钟后才从内存清除
  },
  // 次要数据：5分钟缓存，10分钟过期
  secondary: {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  },
  // 历史数据：5分钟缓存，10分钟过期
  history: {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 60 * 1000,
  },
};

// 转换函数
function adaptSupabaseSettings(supabaseSettings: any): AppSettings | null {
  if (!supabaseSettings) return null;
  
  return {
    supabase: {
      url: supabaseSettings.supabase_url || '',
      anonKey: supabaseSettings.supabase_anon_key || '',
      enabled: supabaseSettings.supabase_enabled || false,
    },
    defaultCurrency: toCurrency(supabaseSettings.default_currency || 'CNY'),
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
    notes: item.notes || undefined,
    currentPrice: item.current_price || undefined,
    changePercent: item.change_percent || undefined,
  };
}

// ============================================
// Query Hooks - 关键数据（立即加载，使用缓存）
// ============================================

/**
 * 获取最新驾驶舱数据
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'latest'],
    queryFn: async () => {
      const data = await getLatestDashboard();
      if (data) {
        const dataDate = new Date(data.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today.getTime() - dataDate.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`[useDashboard] 获取数据日期: ${data.date}, 距今 ${daysDiff} 天`);
      }
      return data;
    },
    staleTime: 0,
    gcTime: 1 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

/**
 * 获取最新股票持仓
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useStockPositions() {
  return useQuery({
    queryKey: ['positions', 'stocks', 'latest'],
    queryFn: async () => {
      const data = await getLatestStockPositions();
      return data || [];
    },
    ...CACHE_TIMES.critical,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * 获取最新期权持仓
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useOptionPositions() {
  return useQuery({
    queryKey: ['positions', 'options', 'latest'],
    queryFn: async () => {
      const data = await getLatestOptionPositions();
      return data || [];
    },
    ...CACHE_TIMES.critical,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * 获取用户设置
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const data = await getSupabaseSettings();
      return adaptSupabaseSettings(data);
    },
    ...CACHE_TIMES.critical,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

// ============================================
// Query Hooks - 次要数据（延迟加载）
// ============================================

/**
 * 获取最新风险指标（延迟加载）
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useRiskMetrics() {
  return useQuery({
    queryKey: ['risk', 'metrics', 'latest'],
    queryFn: async () => {
      const data = await getLatestRiskMetrics();
      return data;
    },
    ...CACHE_TIMES.secondary,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: false,
  });
}

/**
 * 获取收益归因（延迟加载）
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useReturnAttribution() {
  return useQuery({
    queryKey: ['return', 'attribution', 'latest'],
    queryFn: async () => {
      const data = await getLatestReturnAttribution();
      return data;
    },
    ...CACHE_TIMES.secondary,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: false,
  });
}

// ============================================
// Query Hooks - 历史数据（延迟加载，初始只加载7天）
// ============================================

/**
 * 获取历史数据（延迟加载）
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useDashboardHistory(days: number = 7, enabled: boolean = false) {
  return useQuery({
    queryKey: ['dashboard', 'history', days],
    queryFn: async () => {
      const data = await getDashboardHistory(days);
      return data || [];
    },
    ...CACHE_TIMES.history,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled,
  });
}

// ============================================
// Query Hooks - 用户数据（延迟加载）
// ============================================

/**
 * 获取交易记录（延迟加载）
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const data = await getSupabaseTransactions();
      const adapted = data.map(adaptSupabaseTransaction);
      return adapted || [];
    },
    ...CACHE_TIMES.critical,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: false,
  });
}

/**
 * 获取观察列表（延迟加载）
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useWatchlist() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: async () => {
      try {
        const data = await getSupabaseWatchlist();
        const adapted = data.map(adaptSupabaseWatchlist);
        return adapted || [];
      } catch (error) {
        console.warn('[useWatchlist] Error, returning empty array:', error);
        return [];
      }
    },
    ...CACHE_TIMES.critical,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: false,
  });
}

// ============================================
// Mutation Hooks - 数据修改
// ============================================

/**
 * 添加交易记录
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useAddTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (transaction: Transaction) => {
      const success = await addSupabaseTransaction(transaction);
      if (!success) {
        throw new Error('添加交易记录失败');
      }
      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * 删除交易记录
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteSupabaseTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * 添加观察列表项
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useAddToWatchlist() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (item: Omit<WatchlistItem, 'id' | 'addedDate'>) => {
      const watchlistItem: WatchlistItem = {
        ...item,
        id: `watch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        addedDate: new Date().toISOString().split('T')[0],
      };
      
      return addSupabaseWatchlistItem({
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });
}

/**
 * 删除观察列表项
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: removeSupabaseWatchlistItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });
}

/**
 * 更新设置
 * @deprecated 请使用 useDashboardStore 替代
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: Partial<AppSettings>) => {
      const supabaseSettings: any = {};
      if (settings.riskLimits) {
        supabaseSettings.stop_loss_percent = settings.riskLimits.stopLossPercent;
        supabaseSettings.max_drawdown_percent = settings.riskLimits.maxDrawdownPercent;
        supabaseSettings.position_limit_percent = settings.riskLimits.positionLimitPercent;
        supabaseSettings.watchlist_cooldown_days = settings.riskLimits.watchlistCooldownDays;
        supabaseSettings.position_limit_exceptions = settings.riskLimits.positionLimitExceptions;
      }
      if (settings.supabase) {
        supabaseSettings.supabase_url = settings.supabase.url;
        supabaseSettings.supabase_anon_key = settings.supabase.anonKey;
        supabaseSettings.supabase_enabled = settings.supabase.enabled;
      }
      if (settings.defaultCurrency) {
        supabaseSettings.default_currency = settings.defaultCurrency;
      }
      
      return updateSupabaseSettings(supabaseSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

// ============================================
// 组合 Hook - 统一接口（秒加载版本）
// ============================================

/**
 * 统一的 Supabase 数据 Hook
 * @deprecated 请使用 useDashboardStore 替代此 Hook
 * 此 Hook 将在未来版本中移除
 * @see useDashboardStore
 */
export function useSupabasePortfolioWithQuery() {
  const queryClient = useQueryClient();
  
  // 关键数据 - 立即加载
  const dashboard = useDashboard();
  const stockPositions = useStockPositions();
  const optionPositions = useOptionPositions();
  const settings = useSettings();
  
  // 次要数据 - 延迟加载（需要时启用）
  const riskMetrics = useRiskMetrics();
  const returnAttribution = useReturnAttribution();
  
  // 历史数据 - 延迟加载
  const history = useDashboardHistory(7, false);
  
  // 用户数据 - 延迟加载
  const transactions = useTransactions();
  const watchlist = useWatchlist();
  
  // Mutations
  const addTransaction = useAddTransaction();
  const deleteTransaction = useDeleteTransaction();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const updateSettings = useUpdateSettings();
  
  // 计算加载状态（只考虑关键数据）
  const isLoading = dashboard.isLoading || stockPositions.isLoading || 
                   optionPositions.isLoading || settings.isLoading;
  
  // 计算错误
  const error = dashboard.error || stockPositions.error || 
               optionPositions.error || settings.error;
  
  return {
    // 数据
    dashboard: dashboard.data,
    riskMetrics: riskMetrics.data,
    stockPositions: stockPositions.data || [],
    optionPositions: optionPositions.data || [],
    returnAttribution: returnAttribution.data,
    history: history.data || [],
    transactions: transactions.data || [],
    watchlist: watchlist.data || [],
    settings: settings.data,
    
    // 状态
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : '加载失败') : null,
    lastUpdate: new Date(),
    
    // 操作
    refresh: async () => {
      // 失效所有查询
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['positions'] }),
        queryClient.invalidateQueries({ queryKey: ['risk'] }),
        queryClient.invalidateQueries({ queryKey: ['return'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
        queryClient.invalidateQueries({ queryKey: ['settings'] }),
      ]);
    },
    addTransaction: addTransaction.mutateAsync,
    deleteTransaction: deleteTransaction.mutateAsync,
    addToWatchlist: addToWatchlist.mutateAsync,
    removeFromWatchlist: removeFromWatchlist.mutateAsync,
    updateSettings: updateSettings.mutateAsync,
    
    // 启用延迟加载的查询
    enableSecondaryData: () => {
      try {
        queryClient.setQueryData(['risk', 'metrics', 'latest'], undefined);
        queryClient.setQueryData(['return', 'attribution', 'latest'], undefined);
        queryClient.refetchQueries({ queryKey: ['risk', 'metrics', 'latest'] }).catch(() => {});
        queryClient.refetchQueries({ queryKey: ['return', 'attribution', 'latest'] }).catch(() => {});
      } catch (error) {
        console.error('[useSupabaseQueries] Failed to enable secondary data:', error);
      }
    },
    enableHistory: (days: number = 30) => {
      try {
        queryClient.setQueryData(['dashboard', 'history', days], undefined);
        queryClient.refetchQueries({ queryKey: ['dashboard', 'history', days] }).catch(() => {});
      } catch (error) {
        console.error('[useSupabaseQueries] Failed to enable history:', error);
      }
    },
    enableTransactions: () => {
      try {
        queryClient.setQueryData(['transactions'], undefined);
        queryClient.refetchQueries({ queryKey: ['transactions'] }).catch(() => {});
      } catch (error) {
        console.error('[useSupabaseQueries] Failed to enable transactions:', error);
      }
    },
    enableWatchlist: () => {
      try {
        queryClient.setQueryData(['watchlist'], undefined);
        queryClient.refetchQueries({ queryKey: ['watchlist'] }).catch(() => {});
      } catch (error) {
        console.error('[useSupabaseQueries] Failed to enable watchlist:', error);
      }
    },
  };
}
