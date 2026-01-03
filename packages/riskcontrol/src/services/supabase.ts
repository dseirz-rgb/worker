import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { 
  Transaction, 
  WatchlistItem, 
  NetWorthRecord, 
  SupabaseConfig,
  LocalStorageData,
  ExchangeRates,
  TradeReview
} from '../types';
import { loadData, saveData } from './storage';

let supabaseClient: SupabaseClient | null = null;

// 初始化 Supabase 客户端
export function initSupabase(config: SupabaseConfig): boolean {
  if (!config.url || !config.anonKey) {
    console.warn('Supabase config incomplete');
    return false;
  }

  try {
    supabaseClient = createClient(config.url, config.anonKey);
    return true;
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
    return false;
  }
}

// 获取 Supabase 客户端
export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}

// 检查连接状态
export async function checkConnection(): Promise<boolean> {
  if (!supabaseClient) return false;

  try {
    const { error } = await supabaseClient.from('asset_snapshots').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

// 从云端获取交易记录（新表结构）
export async function fetchTransactionsFromCloud(): Promise<Transaction[]> {
  if (!supabaseClient) return [];

  try {
    const { data, error } = await supabaseClient
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch transactions:', error);
      return [];
    }

    // 转换为应用格式
    const USD_CNY = 7.25;
    const HKD_CNY = 0.93;
    
    return (data || []).map(tx => {
      const currency = tx.currency || 'USD';
      const market = currency === 'HKD' ? 'HK' : currency === 'CNY' ? 'CN' : 'US';
      const amount = tx.price * tx.quantity;
      const amountCNY = currency === 'CNY' 
        ? amount 
        : currency === 'USD' 
          ? amount * USD_CNY 
          : amount * HKD_CNY;
      
      // 重要：使用 tx.date（实际交易日期），而不是 tx.created_at（导入时间）
      let dateStr = tx.date;
      if (!dateStr && tx.created_at) {
        dateStr = tx.created_at.split('T')[0];
      } else if (!dateStr) {
        dateStr = new Date().toISOString().split('T')[0];
      }
      
      return {
        id: `ibkr-${tx.id}`,
        date: dateStr, // 使用实际交易日期，不是导入时间
        ticker: tx.ticker,
        name: tx.name,
        action: tx.action,
        price: tx.price,
        quantity: tx.quantity,
        amount,
        amountCNY,
        fee: 0,
        currency,
        market,
        strategyNote: tx.strategy_note || '',
        isPlanned: true,
        createdAt: tx.created_at,
      } as Transaction;
    });
  } catch (error) {
    console.error('Fetch transactions error:', error);
    return [];
  }
}

// 从云端获取净值历史
export async function fetchNetWorthHistoryFromCloud(exchangeRates?: ExchangeRates): Promise<NetWorthRecord[]> {
  if (!supabaseClient) return [];

  try {
    const { data, error } = await supabaseClient
      .from('asset_snapshots')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      console.error('Failed to fetch snapshots:', error);
      return [];
    }

    // 使用传入的汇率或从本地数据获取
    let USD_CNY = 7.25; // 默认值
    if (exchangeRates) {
      USD_CNY = exchangeRates.USD_CNY;
    } else {
      const localData = loadData();
      USD_CNY = localData.exchangeRates.USD_CNY;
    }
    
    console.log(`[Supabase] 使用汇率 USD_CNY = ${USD_CNY} 转换净值历史`);
    
    let highWaterMark = 0;
    
    return (data || []).map(s => {
      const netWorthCNY = s.net_worth * USD_CNY;
      if (netWorthCNY > highWaterMark) {
        highWaterMark = netWorthCNY;
      }
      return {
        date: s.date,
        netWorth: netWorthCNY,
        cashRatio: s.cash_ratio,
        longRatio: s.long_ratio,
        shortRatio: s.short_ratio,
        highWaterMark,
      } as NetWorthRecord;
    });
  } catch (error) {
    console.error('Fetch net worth history error:', error);
    return [];
  }
}

// 从云端获取观察列表（暂不支持，返回空）
export async function fetchWatchlistFromCloud(): Promise<WatchlistItem[]> {
  // 观察列表表结构不同，暂时返回空
  return [];
}

// 同步交易记录到云端（暂不支持）
export async function syncTransactionsToCloud(transactions: Transaction[]): Promise<boolean> {
  // 新表结构不同，暂不支持上传
  console.log('Transaction sync to cloud not supported with new schema');
  return true;
}

// 同步观察列表到云端（暂不支持）
export async function syncWatchlistToCloud(watchlist: WatchlistItem[]): Promise<boolean> {
  console.log('Watchlist sync to cloud not supported with new schema');
  return true;
}

// 同步高水位线（暂不支持）
export async function syncHighWaterMark(hwm: number): Promise<boolean> {
  console.log('HWM sync to cloud not supported with new schema');
  return true;
}

// 获取云端高水位线
export async function fetchHighWaterMarkFromCloud(): Promise<number | null> {
  if (!supabaseClient) return null;

  try {
    const history = await fetchNetWorthHistoryFromCloud();
    if (history.length === 0) return null;
    
    return Math.max(...history.map(h => h.netWorth));
  } catch (error) {
    console.error('Fetch HWM error:', error);
    return null;
  }
}

// 智能合并数据
export async function smartMerge(exchangeRates?: ExchangeRates): Promise<{
  success: boolean;
  merged: {
    transactions: number;
    watchlist: number;
    hwmUpdated: boolean;
  };
}> {
  const result = {
    success: false,
    merged: {
      transactions: 0,
      watchlist: 0,
      hwmUpdated: false,
    },
  };

  if (!supabaseClient) return result;

  try {
    const localData = loadData();

    // 1. 获取云端净值历史（传入汇率以确保一致性）
    const cloudNetWorthHistory = await fetchNetWorthHistoryFromCloud(exchangeRates || localData.exchangeRates);
    if (cloudNetWorthHistory.length > 0) {
      localData.netWorthHistory = cloudNetWorthHistory;
      
      // 更新高水位线（以云端数据为准）
      const cloudHWM = Math.max(...cloudNetWorthHistory.map(h => h.netWorth));
      localData.highWaterMark = cloudHWM;
      result.merged.hwmUpdated = true;
    }

    // 2. 获取云端交易记录（仅用于统计，不覆盖本地建仓记录）
    const cloudTransactions = await fetchTransactionsFromCloud();
    if (cloudTransactions.length > 0) {
      // 过滤出 2025 年的交易记录
      const recentTransactions = cloudTransactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate.getFullYear() >= 2025;
      });
      
      // 保留本地的初始记录
      const localInitialRecords = localData.transactions.filter(
        t => t.action === 'SYNC_BALANCE' || t.id.startsWith('tx-')
      );
      
      // 合并
      const existingIds = new Set(localInitialRecords.map(t => t.id));
      const newTransactions = recentTransactions.filter(t => !existingIds.has(t.id));
      
      localData.transactions = [...localInitialRecords, ...newTransactions];
      result.merged.transactions = newTransactions.length;
    }

    // 更新同步时间
    localData.settings.lastSyncTime = new Date().toISOString();

    // 保存合并后的数据
    saveData(localData);

    result.success = true;
    return result;
  } catch (error) {
    console.error('Smart merge error:', error);
    return result;
  }
}

// 完整同步（从云端拉取数据）
export async function fullSync(): Promise<boolean> {
  if (!supabaseClient) return false;

  try {
    const mergeResult = await smartMerge();
    return mergeResult.success;
  } catch (error) {
    console.error('Full sync error:', error);
    return false;
  }
}

// 保存交易复盘
export async function saveTradeReview(review: Omit<TradeReview, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; error?: any }> {
  if (!supabaseClient) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { error } = await supabaseClient
      .from('trade_reviews')
      .upsert(review, { onConflict: 'transaction_id' });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Failed to save trade review:', error);
    return { success: false, error };
  }
}

// 获取交易复盘
export async function getTradeReview(transactionId: string): Promise<TradeReview | null> {
  if (!supabaseClient) return null;

  try {
    const { data, error } = await supabaseClient
      .from('trade_reviews')
      .select('*')
      .eq('transaction_id', transactionId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" error
    return data;
  } catch (error) {
    console.error('Failed to get trade review:', error);
    return null;
  }
}
