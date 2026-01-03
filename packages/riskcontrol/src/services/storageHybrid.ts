/**
 * 混合存储服务
 * 优先使用 Supabase，失败时回退到 localStorage
 * 逐步迁移策略：新数据写入 Supabase，旧数据从 localStorage 读取
 */

import type { 
  Transaction, 
  WatchlistItem, 
  AppSettings
} from '../types';
import {
  getTransactions as getSupabaseTransactions,
  addTransaction as addSupabaseTransaction,
  updateTransaction as updateSupabaseTransaction,
  deleteTransaction as deleteSupabaseTransaction,
  getWatchlist as getSupabaseWatchlist,
  addToWatchlist as addSupabaseToWatchlist,
  removeFromWatchlist as removeSupabaseFromWatchlist,
  updateWatchlistItem as updateSupabaseWatchlistItem,
  getUserSettings as getSupabaseSettings,
  updateUserSettings as updateSupabaseSettings,
  getIBKRRefreshTime as getSupabaseIBKRRefreshTime,
  updateIBKRRefreshTime as updateSupabaseIBKRRefreshTime,
} from './supabaseUserData';
import { loadData, saveData } from './storage';
import { getClient } from './supabaseData';

// 检查 Supabase 是否可用
function isSupabaseAvailable(): boolean {
  const client = getClient();
  return client !== null;
}

// ============================================
// 本地操作辅助函数 (基于 loadData/saveData)
// ============================================

function getLocalTransactions(): Transaction[] {
  return loadData().transactions;
}

function addLocalTransaction(transaction: Transaction): void {
  const data = loadData();
  data.transactions = [transaction, ...data.transactions];
  saveData(data);
}

function updateLocalTransaction(id: string, updates: Partial<Transaction>): void {
  const data = loadData();
  data.transactions = data.transactions.map(t => 
    t.id === id ? { ...t, ...updates } : t
  );
  saveData(data);
}

function deleteLocalTransaction(id: string): void {
  const data = loadData();
  data.transactions = data.transactions.filter(t => t.id !== id);
  saveData(data);
}

function getLocalWatchlist(): WatchlistItem[] {
  return loadData().watchlist;
}

function addLocalToWatchlist(item: WatchlistItem): void {
  const data = loadData();
  // 检查是否存在
  if (!data.watchlist.find(w => w.ticker === item.ticker)) {
    data.watchlist = [...data.watchlist, item];
    saveData(data);
  }
}

function removeLocalFromWatchlist(id: string): void {
  const data = loadData();
  data.watchlist = data.watchlist.filter(w => w.id !== id);
  saveData(data);
}

function updateLocalWatchlistItem(id: string, updates: Partial<WatchlistItem>): void {
  const data = loadData();
  data.watchlist = data.watchlist.map(w => 
    w.id === id ? { ...w, ...updates } : w
  );
  saveData(data);
}

function getLocalSettings(): AppSettings {
  return loadData().settings;
}

function updateLocalSettings(settings: Partial<AppSettings>): void {
  const data = loadData();
  data.settings = {
    ...data.settings,
    ...settings,
    riskLimits: { ...data.settings.riskLimits, ...settings.riskLimits },
    supabase: { ...data.settings.supabase, ...settings.supabase },
  };
  saveData(data);
}

// ============================================
// 交易记录操作（混合模式）
// ============================================

export async function getTransactions(): Promise<Transaction[]> {
  if (isSupabaseAvailable()) {
    try {
      const transactions = await getSupabaseTransactions();
      if (transactions.length > 0) {
        return transactions;
      }
      // 如果 Supabase 为空，尝试从 localStorage 读取并迁移
      const localTransactions = getLocalTransactions();
      if (localTransactions.length > 0) {
        // 异步迁移到 Supabase（不阻塞）
        migrateTransactionsToSupabase(localTransactions).catch(console.error);
        return localTransactions;
      }
      return [];
    } catch (error) {
      console.warn('[StorageHybrid] Supabase 获取交易记录失败，使用 localStorage:', error);
      return getLocalTransactions();
    }
  }
  return getLocalTransactions();
}

export async function addTransaction(transaction: Transaction): Promise<void> {
  if (isSupabaseAvailable()) {
    try {
      const success = await addSupabaseTransaction(transaction);
      if (success) {
        // 同时写入 localStorage 作为备份
        addLocalTransaction(transaction);
        return;
      }
    } catch (error) {
      console.warn('[StorageHybrid] Supabase 添加交易失败，使用 localStorage:', error);
    }
  }
  addLocalTransaction(transaction);
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
  if (isSupabaseAvailable()) {
    try {
      const success = await updateSupabaseTransaction(id, updates);
      if (success) {
        updateLocalTransaction(id, updates);
        return;
      }
    } catch (error) {
      console.warn('[StorageHybrid] Supabase 更新交易失败，使用 localStorage:', error);
    }
  }
  updateLocalTransaction(id, updates);
}

export async function deleteTransaction(id: string): Promise<void> {
  if (isSupabaseAvailable()) {
    try {
      const success = await deleteSupabaseTransaction(id);
      if (success) {
        deleteLocalTransaction(id);
        return;
      }
    } catch (error) {
      console.warn('[StorageHybrid] Supabase 删除交易失败，使用 localStorage:', error);
    }
  }
  deleteLocalTransaction(id);
}

// ============================================
// 观察列表操作（混合模式）
// ============================================

export async function getWatchlist(): Promise<WatchlistItem[]> {
  if (isSupabaseAvailable()) {
    try {
      const watchlist = await getSupabaseWatchlist();
      if (watchlist.length > 0) {
        return watchlist;
      }
      // 如果 Supabase 为空，尝试从 localStorage 读取并迁移
      const localWatchlist = getLocalWatchlist();
      if (localWatchlist.length > 0) {
        migrateWatchlistToSupabase(localWatchlist).catch(console.error);
        return localWatchlist;
      }
      return [];
    } catch (error) {
      console.warn('[StorageHybrid] Supabase 获取观察列表失败，使用 localStorage:', error);
      return getLocalWatchlist();
    }
  }
  return getLocalWatchlist();
}

export async function addToWatchlist(item: WatchlistItem): Promise<void> {
  if (isSupabaseAvailable()) {
    try {
      const success = await addSupabaseToWatchlist(item);
      if (success) {
        addLocalToWatchlist(item);
        return;
      }
    } catch (error) {
      console.warn('[StorageHybrid] Supabase 添加观察列表失败，使用 localStorage:', error);
    }
  }
  addLocalToWatchlist(item);
}

export async function removeFromWatchlist(id: string): Promise<void> {
  if (isSupabaseAvailable()) {
    try {
      const success = await removeSupabaseFromWatchlist(id);
      if (success) {
        removeLocalFromWatchlist(id);
        return;
      }
    } catch (error) {
      console.warn('[StorageHybrid] Supabase 删除观察列表失败，使用 localStorage:', error);
    }
  }
  removeLocalFromWatchlist(id);
}

export async function updateWatchlistItem(id: string, updates: Partial<WatchlistItem>): Promise<void> {
  if (isSupabaseAvailable()) {
    try {
      const success = await updateSupabaseWatchlistItem(id, updates);
      if (success) {
        updateLocalWatchlistItem(id, updates);
        return;
      }
    } catch (error) {
      console.warn('[StorageHybrid] Supabase 更新观察列表失败，使用 localStorage:', error);
    }
  }
  updateLocalWatchlistItem(id, updates);
}

// ============================================
// 用户设置操作（混合模式）
// ============================================

export async function getSettings(): Promise<AppSettings> {
  if (isSupabaseAvailable()) {
    try {
      const settings = await getSupabaseSettings();
      if (settings) {
        return settings;
      }
    } catch (error) {
      console.warn('[StorageHybrid] Supabase 获取设置失败，使用 localStorage:', error);
    }
  }
  return getLocalSettings();
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<void> {
  if (isSupabaseAvailable()) {
    try {
      const success = await updateSupabaseSettings(settings);
      if (success) {
        updateLocalSettings(settings);
        return;
      }
    } catch (error) {
      console.warn('[StorageHybrid] Supabase 更新设置失败，使用 localStorage:', error);
    }
  }
  updateLocalSettings(settings);
}

// ============================================
// IBKR 刷新时间操作（混合模式）
// ============================================

export async function getIBKRRefreshTime(): Promise<Date | null> {
  if (isSupabaseAvailable()) {
    try {
      const time = await getSupabaseIBKRRefreshTime();
      if (time) {
        return time;
      }
    } catch (error) {
      console.warn('[StorageHybrid] Supabase 获取 IBKR 刷新时间失败，使用 localStorage:', error);
    }
  }
  
  // 从 localStorage 读取
  try {
    const lastRefresh = localStorage.getItem('ibkr_last_refresh_timestamp');
    if (lastRefresh) {
      return new Date(parseInt(lastRefresh));
    }
  } catch (error) {
    console.error('[StorageHybrid] 读取 localStorage IBKR 刷新时间失败:', error);
  }
  
  return null;
}

export async function updateIBKRRefreshTime(timestamp: Date): Promise<void> {
  // 同时更新 Supabase 和 localStorage
  if (isSupabaseAvailable()) {
    try {
      await updateSupabaseIBKRRefreshTime(timestamp);
    } catch (error) {
      console.warn('[StorageHybrid] Supabase 更新 IBKR 刷新时间失败:', error);
    }
  }
  
  // 始终更新 localStorage
  try {
    localStorage.setItem('ibkr_last_refresh_timestamp', timestamp.getTime().toString());
  } catch (error) {
    console.error('[StorageHybrid] 更新 localStorage IBKR 刷新时间失败:', error);
  }
}

// ============================================
// 迁移辅助函数
// ============================================

async function migrateTransactionsToSupabase(transactions: Transaction[]): Promise<void> {
  console.log(`[StorageHybrid] 开始迁移 ${transactions.length} 条交易记录到 Supabase...`);
  
  for (const tx of transactions) {
    try {
      await addSupabaseTransaction(tx);
    } catch (error) {
      console.error(`[StorageHybrid] 迁移交易记录失败 (${tx.id}):`, error);
    }
  }
  
  console.log('[StorageHybrid] 交易记录迁移完成');
}

async function migrateWatchlistToSupabase(watchlist: WatchlistItem[]): Promise<void> {
  console.log(`[StorageHybrid] 开始迁移 ${watchlist.length} 条观察列表到 Supabase...`);
  
  for (const item of watchlist) {
    try {
      await addSupabaseToWatchlist(item);
    } catch (error) {
      console.error(`[StorageHybrid] 迁移观察列表失败 (${item.id}):`, error);
    }
  }
  
  console.log('[StorageHybrid] 观察列表迁移完成');
}
