import type { 
  LocalStorageData, 
  Transaction, 
  WatchlistItem, 
  CashBalance, 
  NetWorthRecord, 
  AppSettings, 
  StockInfo, 
  ExchangeRates,
  Market,
  Currency,
} from '../types';
import { Action } from '../types';
import {
  getTransactions as getSupabaseTransactions,
  addTransaction as addSupabaseTransaction,
  deleteTransaction as deleteSupabaseTransaction,
  getWatchlist as getSupabaseWatchlist,
  addToWatchlist as addSupabaseWatchlist,
  removeFromWatchlist as removeSupabaseWatchlist,
  getUserSettings as getSupabaseSettings,
  updateUserSettings as updateSupabaseSettings,
} from './supabaseData';
import { getClient } from './supabaseData';

const STORAGE_KEY = 'riskcontrol_data';

// 检查是否使用 Supabase
function useSupabase(): boolean {
  const client = getClient();
  return client !== null;
}

// 类型守卫函数，替代类型断言
export function toAction(value: string): Action {
  const upperValue = value.toUpperCase();
  // 检查是否是有效的 Action 枚举值
  if (upperValue === 'BUY' || upperValue === 'SELL' || upperValue === 'SHORT' || 
      upperValue === 'COVER' || upperValue === 'DEPOSIT' || upperValue === 'WITHDRAW' ||
      upperValue === 'SYNC_BALANCE') {
    return upperValue as Action;
  }
  return Action.BUY; // 默认值
}

export function toMarket(value: string | null | undefined): Market {
  if (value === 'HK' || value === 'CN') return value;
  return 'US'; // 默认值
}

export function toCurrency(value: string | null | undefined): Currency {
  if (value === 'HKD' || value === 'CNY') return value;
  return 'USD'; // 默认值
}

// 默认设置
const defaultSettings: AppSettings = {
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    enabled: !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
  },
  defaultCurrency: 'CNY',
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

// 默认现金余额
const defaultCashBalance: CashBalance = {
  USD: 0,
  HKD: 0,
  CNY: 0,
  totalCNY: 0,
};

// 默认汇率
const defaultExchangeRates: ExchangeRates = {
  USD_CNY: 7.25,
  HKD_CNY: 0.93,
  timestamp: Date.now(),
};

// 获取默认数据
function getDefaultData(): LocalStorageData {
  return {
    transactions: [],
    watchlist: [],
    cashBalance: defaultCashBalance,
    highWaterMark: 0,
    netWorthHistory: [],
    settings: defaultSettings,
    stockCache: {},
    exchangeRates: defaultExchangeRates,
  };
}

// 读取所有数据
export function loadData(): LocalStorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultData();
    
    const data = JSON.parse(raw) as Partial<LocalStorageData>;
    
    // 合并默认值，确保所有字段存在
    return {
      transactions: data.transactions || [],
      watchlist: data.watchlist || [],
      cashBalance: { ...defaultCashBalance, ...data.cashBalance },
      highWaterMark: data.highWaterMark || 0,
      netWorthHistory: data.netWorthHistory || [],
      settings: { 
        ...defaultSettings, 
        ...data.settings,
        riskLimits: { ...defaultSettings.riskLimits, ...data.settings?.riskLimits },
        supabase: { ...defaultSettings.supabase, ...data.settings?.supabase },
      },
      stockCache: data.stockCache || {},
      exchangeRates: { ...defaultExchangeRates, ...data.exchangeRates },
    };
  } catch (error) {
    console.error('Failed to load data from localStorage:', error);
    return getDefaultData();
  }
}

// 保存所有数据
export function saveData(data: LocalStorageData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save data to localStorage:', error);
  }
}

// 交易记录操作 - 完全使用 Supabase，不再使用 localStorage
export async function getTransactions(): Promise<Transaction[]> {
  if (!useSupabase()) {
    console.warn('[Storage] Supabase 未配置，无法获取交易记录');
    return [];
  }
  
  try {
    const supabaseData = await getSupabaseTransactions();
    // 转换为应用格式（使用类型守卫）
    return supabaseData.map(tx => {
      // 处理 date 字段：如果不存在，使用 created_at 的日期部分
      let dateStr = tx.date;
      if (!dateStr && tx.created_at) {
        // 从 created_at 提取日期部分（YYYY-MM-DD）
        dateStr = tx.created_at.split('T')[0];
      } else if (!dateStr) {
        // 如果都没有，使用当前日期
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
    });
  } catch (error) {
    console.error('[Storage] Failed to load transactions from Supabase:', error);
    throw error; // 抛出错误，不再回退到 localStorage
  }
}

export async function addTransaction(transaction: Transaction): Promise<void> {
  if (!useSupabase()) {
    throw new Error('Supabase 未配置，无法添加交易记录');
  }
  
  const success = await addSupabaseTransaction(transaction);
  if (!success) {
    throw new Error('添加交易记录到 Supabase 失败');
  }
  // 不再更新 localStorage
}

export function updateTransaction(id: string, updates: Partial<Transaction>): void {
  // 注意：Supabase 暂不支持更新交易记录
  console.warn('[Storage] Supabase 暂不支持更新交易记录');
  // 不再更新 localStorage
}

export async function deleteTransaction(id: string): Promise<void> {
  if (!useSupabase()) {
    throw new Error('Supabase 未配置，无法删除交易记录');
  }
  
  const success = await deleteSupabaseTransaction(id);
  if (!success) {
    throw new Error('从 Supabase 删除交易记录失败');
  }
  // 不再更新 localStorage
}

// 观察列表操作 - 完全使用 Supabase，不再使用 localStorage
export async function getWatchlist(): Promise<WatchlistItem[]> {
  if (!useSupabase()) {
    console.warn('[Storage] Supabase 未配置，无法获取观察列表');
    return [];
  }
  
  try {
    const supabaseData = await getSupabaseWatchlist();
    // 转换为应用格式
    return supabaseData.map(item => ({
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
    }));
  } catch (error) {
    console.error('[Storage] Failed to load watchlist from Supabase:', error);
    throw error; // 抛出错误，不再回退到 localStorage
  }
}

export async function addToWatchlist(item: WatchlistItem): Promise<void> {
  if (!useSupabase()) {
    throw new Error('Supabase 未配置，无法添加观察列表项');
  }
  
  const success = await addSupabaseWatchlist(item);
  if (!success) {
    throw new Error('添加观察列表项到 Supabase 失败');
  }
  // 不再更新 localStorage
}

export async function removeFromWatchlist(id: string): Promise<void> {
  if (!useSupabase()) {
    throw new Error('Supabase 未配置，无法删除观察列表项');
  }
  
  const success = await removeSupabaseWatchlist(id);
  if (!success) {
    throw new Error('从 Supabase 删除观察列表项失败');
  }
  // 不再更新 localStorage
}

export function updateWatchlistItem(id: string, updates: Partial<WatchlistItem>): void {
  // 注意：Supabase 暂不支持更新观察列表项
  console.warn('[Storage] Supabase 暂不支持更新观察列表项');
  // 不再更新 localStorage
}

// 现金余额操作
export function getCashBalance(): CashBalance {
  return loadData().cashBalance;
}

export function updateCashBalance(balance: Partial<CashBalance>): void {
  const data = loadData();
  data.cashBalance = { ...data.cashBalance, ...balance };
  saveData(data);
}

// 高水位线操作
export function getHighWaterMark(): number {
  return loadData().highWaterMark;
}

export function updateHighWaterMark(hwm: number): void {
  const data = loadData();
  // 只能上升，不能下降
  if (hwm > data.highWaterMark) {
    data.highWaterMark = hwm;
    saveData(data);
  }
}

// 净值历史操作
export function getNetWorthHistory(): NetWorthRecord[] {
  return loadData().netWorthHistory;
}

export function addNetWorthRecord(record: NetWorthRecord): void {
  const data = loadData();
  // 检查今天是否已有记录
  const today = record.date.split('T')[0];
  const existingIndex = data.netWorthHistory.findIndex(
    r => r.date.split('T')[0] === today
  );
  
  if (existingIndex !== -1) {
    // 更新今天的记录
    data.netWorthHistory[existingIndex] = record;
  } else {
    // 添加新记录
    data.netWorthHistory.push(record);
  }
  
  // 保持最近365天的记录
  if (data.netWorthHistory.length > 365) {
    data.netWorthHistory = data.netWorthHistory.slice(-365);
  }
  
  saveData(data);
}

// 设置操作 - 完全使用 Supabase，不再使用 localStorage
export async function getSettings(): Promise<AppSettings> {
  if (!useSupabase()) {
    // 如果 Supabase 未配置，返回默认设置
    return {
      supabase: {
        url: import.meta.env.VITE_SUPABASE_URL || '',
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        enabled: !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
      },
      defaultCurrency: 'CNY',
      riskLimits: {
        stopLossPercent: -20,
        maxDrawdownPercent: 5,
        positionLimitPercent: 15,
        watchlistCooldownDays: 7,
        positionLimitExceptions: [],
      },
    };
  }
  
  try {
    const supabaseData = await getSupabaseSettings();
    if (supabaseData) {
      // 转换为应用格式
      return {
        supabase: {
          url: supabaseData.supabase_url || '',
          anonKey: supabaseData.supabase_anon_key || '',
          enabled: supabaseData.supabase_enabled || false,
        },
        defaultCurrency: toCurrency(supabaseData.default_currency || 'CNY'),
        riskLimits: {
          stopLossPercent: supabaseData.stop_loss_percent || -20,
          maxDrawdownPercent: supabaseData.max_drawdown_percent || 5,
          positionLimitPercent: supabaseData.position_limit_percent || 15,
          watchlistCooldownDays: supabaseData.watchlist_cooldown_days || 7,
          positionLimitExceptions: Array.isArray(supabaseData.position_limit_exceptions) 
            ? supabaseData.position_limit_exceptions 
            : [],
        },
      };
    }
    throw new Error('无法从 Supabase 获取设置');
  } catch (error) {
    console.error('[Storage] Failed to load settings from Supabase:', error);
    throw error; // 抛出错误，不再回退到 localStorage
  }
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<void> {
  if (!useSupabase()) {
    throw new Error('Supabase 未配置，无法更新设置');
  }
  
  // 转换为 Supabase 格式
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

  const success = await updateSupabaseSettings(supabaseSettings);
  if (!success) {
    throw new Error('更新设置到 Supabase 失败');
  }
  // 不再更新 localStorage
}

// 股票缓存操作
export function getStockCache(): Record<string, StockInfo> {
  return loadData().stockCache;
}

export function getCachedStock(ticker: string): StockInfo | null {
  const cache = getStockCache();
  const stock = cache[ticker];
  
  if (!stock) return null;
  
  // 缓存有效期：交易时段5分钟，非交易时段1小时
  const now = Date.now();
  const cacheAge = now - stock.lastUpdated;
  const maxAge = isMarketOpen() ? 5 * 60 * 1000 : 60 * 60 * 1000;
  
  if (cacheAge > maxAge) return null;
  
  return stock;
}

export function cacheStock(stock: StockInfo): void {
  const data = loadData();
  data.stockCache[stock.ticker] = stock;
  saveData(data);
}

export function clearStockCache(): void {
  const data = loadData();
  data.stockCache = {};
  saveData(data);
}

// 汇率操作
export function getExchangeRates(): ExchangeRates {
  return loadData().exchangeRates;
}

export function updateExchangeRates(rates: ExchangeRates): void {
  const data = loadData();
  data.exchangeRates = rates;
  saveData(data);
}

// 辅助函数：判断是否在交易时段
function isMarketOpen(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  
  // 周末不开市
  if (day === 0 || day === 6) return false;
  
  // 简化判断：9:00-16:00 视为交易时段
  return hour >= 9 && hour < 16;
}

// 导出/导入数据
export function exportData(): string {
  return JSON.stringify(loadData(), null, 2);
}

export function importData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString) as LocalStorageData;
    saveData(data);
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}

// 清除所有数据
export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// 初始化示例数据（从 Activity Statement 导入）
export function initializeWithSampleData(): void {
  // 动态导入避免循环依赖
  import('../data/initialData').then(({ 
    initialTransactions, 
    initialWatchlist, 
    initialNetWorthHistory, 
    initialHighWaterMark,
    initialCashBalance 
  }) => {
    const data = loadData();
    
    // 只在数据为空时初始化
    if (data.transactions.length === 0) {
      data.transactions = initialTransactions;
      data.watchlist = initialWatchlist;
      data.netWorthHistory = initialNetWorthHistory;
      data.highWaterMark = initialHighWaterMark;
      data.cashBalance = initialCashBalance;
      saveData(data);
      console.log('Initialized with sample data from Activity Statement');
    }
  });
}

// 强制重置为示例数据
export function resetToSampleData(): void {
  import('../data/initialData').then(({ 
    initialTransactions, 
    initialWatchlist, 
    initialNetWorthHistory, 
    initialHighWaterMark,
    initialCashBalance 
  }) => {
    const data = getDefaultData();
    data.transactions = initialTransactions;
    data.watchlist = initialWatchlist;
    data.netWorthHistory = initialNetWorthHistory;
    data.highWaterMark = initialHighWaterMark;
    data.cashBalance = initialCashBalance;
    saveData(data);
    console.log('Reset to sample data from Activity Statement');
  });
}

// 从 Supabase 加载 IBKR 数据
export async function loadIBKRDataFromSupabase(): Promise<{
  transactions: Transaction[];
  netWorthHistory: NetWorthRecord[];
  highWaterMark: number;
} | null> {
  try {
    const { fetchIBKRTransactions, fetchIBKRNetWorthHistory } = await import('./ibkrData');
    
    const [transactions, netWorthHistory] = await Promise.all([
      fetchIBKRTransactions(),
      fetchIBKRNetWorthHistory(),
    ]);
    
    // 计算高水位线
    const highWaterMark = netWorthHistory.reduce(
      (max, record) => Math.max(max, record.netWorth),
      0
    );
    
    return {
      transactions,
      netWorthHistory,
      highWaterMark,
    };
  } catch (error) {
    console.error('Failed to load IBKR data from Supabase:', error);
    return null;
  }
}

// 同步 IBKR 数据到本地存储
export async function syncIBKRData(): Promise<boolean> {
  const ibkrData = await loadIBKRDataFromSupabase();
  if (!ibkrData) return false;
  
  const data = loadData();
  
  // 合并交易记录（IBKR 数据优先）
  const existingIds = new Set(data.transactions.map(t => t.id));
  const newTransactions = ibkrData.transactions.filter(t => !existingIds.has(t.id));
  data.transactions = [...newTransactions, ...data.transactions];
  
  // 更新净值历史（使用 IBKR 数据）
  data.netWorthHistory = ibkrData.netWorthHistory;
  
  // 更新高水位线（以云端数据为准）
  data.highWaterMark = ibkrData.highWaterMark;
  
  saveData(data);
  console.log('IBKR data synced from Supabase');
  return true;
}
