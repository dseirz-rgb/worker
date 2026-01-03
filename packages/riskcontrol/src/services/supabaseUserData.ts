/**
 * Supabase 用户数据服务
 * 处理交易记录、观察列表、用户设置等用户数据
 * 这些数据之前存储在 localStorage，现在迁移到 Supabase
 */

import { getClient } from './supabaseData';
import type { Transaction, WatchlistItem, AppSettings, StockInfo, ExchangeRates } from '../types';

// ============================================
// 交易记录操作
// ============================================

export async function getTransactions(): Promise<Transaction[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('[SupabaseUserData] Error fetching transactions:', error);
      return [];
    }

    return (data || []).map(tx => ({
      id: tx.id,
      date: tx.date,
      ticker: tx.ticker,
      name: tx.name || '',
      market: (tx.market || 'US') as 'US' | 'HK' | 'CN',
      currency: (tx.currency || 'USD') as 'USD' | 'HKD' | 'CNY',
      action: tx.action as any,
      price: tx.price || 0,
      quantity: tx.quantity || 0,
      amount: tx.amount || 0,
      amountCNY: tx.amount_cny || 0,
      fee: tx.fee || 0,
      strategyNote: tx.strategy_note || '',
      isPlanned: tx.is_planned || false,
      watchlistDays: tx.watchlist_days || undefined,
      createdAt: tx.created_at || tx.date,
    }));
  } catch (error) {
    console.error('[SupabaseUserData] Exception fetching transactions:', error);
    return [];
  }
}

export async function addTransaction(transaction: Transaction): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('transactions')
      .insert({
        id: transaction.id,
        date: transaction.date,
        ticker: transaction.ticker,
        name: transaction.name,
        market: transaction.market,
        currency: transaction.currency,
        action: transaction.action,
        price: transaction.price,
        quantity: transaction.quantity,
        amount: transaction.amount,
        amount_cny: transaction.amountCNY,
        fee: transaction.fee,
        strategy_note: transaction.strategyNote,
        is_planned: transaction.isPlanned,
        watchlist_days: transaction.watchlistDays,
      });

    if (error) {
      console.error('[SupabaseUserData] Error adding transaction:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SupabaseUserData] Exception adding transaction:', error);
    return false;
  }
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const updateData: any = {};
    if (updates.price !== undefined) updateData.price = updates.price;
    if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
    if (updates.strategyNote !== undefined) updateData.strategy_note = updates.strategyNote;
    if (updates.isPlanned !== undefined) updateData.is_planned = updates.isPlanned;

    const { error } = await client
      .from('transactions')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('[SupabaseUserData] Error updating transaction:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SupabaseUserData] Exception updating transaction:', error);
    return false;
  }
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SupabaseUserData] Error deleting transaction:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SupabaseUserData] Exception deleting transaction:', error);
    return false;
  }
}

// ============================================
// 观察列表操作
// ============================================

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('watchlist')
      .select('*')
      .order('added_date', { ascending: false });

    if (error) {
      console.error('[SupabaseUserData] Error fetching watchlist:', error);
      return [];
    }

    return (data || []).map(item => ({
      id: item.id,
      ticker: item.ticker,
      name: item.name || '',
      market: (item.market || 'US') as 'US' | 'HK' | 'CN',
      currency: (item.currency || 'USD') as 'USD' | 'HKD' | 'CNY',
      addedDate: item.added_date,
      targetPrice: item.target_price || undefined,
      notes: item.notes || undefined,
      currentPrice: item.current_price || undefined,
      changePercent: item.change_percent || undefined,
    }));
  } catch (error) {
    console.error('[SupabaseUserData] Exception fetching watchlist:', error);
    return [];
  }
}

export async function addToWatchlist(item: WatchlistItem): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('watchlist')
      .upsert({
        id: item.id,
        ticker: item.ticker,
        name: item.name,
        market: item.market,
        currency: item.currency,
        added_date: item.addedDate,
        target_price: item.targetPrice,
        notes: item.notes,
      }, { onConflict: 'ticker' });

    if (error) {
      console.error('[SupabaseUserData] Error adding to watchlist:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SupabaseUserData] Exception adding to watchlist:', error);
    return false;
  }
}

export async function removeFromWatchlist(id: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('watchlist')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SupabaseUserData] Error removing from watchlist:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SupabaseUserData] Exception removing from watchlist:', error);
    return false;
  }
}

export async function updateWatchlistItem(id: string, updates: Partial<WatchlistItem>): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const updateData: any = {};
    if (updates.targetPrice !== undefined) updateData.target_price = updates.targetPrice;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.currentPrice !== undefined) updateData.current_price = updates.currentPrice;
    if (updates.changePercent !== undefined) updateData.change_percent = updates.changePercent;
    if (updates.currentPrice !== undefined) updateData.last_price_update = new Date().toISOString();

    const { error } = await client
      .from('watchlist')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('[SupabaseUserData] Error updating watchlist item:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SupabaseUserData] Exception updating watchlist item:', error);
    return false;
  }
}

// ============================================
// 用户设置操作
// ============================================

export async function getUserSettings(): Promise<AppSettings | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('user_settings')
      .select('*')
      .is('user_id', null) // 获取默认设置（user_id 为 null）
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // 如果没有设置记录，创建默认设置
      if (error.code === 'PGRST116') {
        return await createDefaultSettings();
      }
      console.error('[SupabaseUserData] Error fetching user settings:', error);
      return null;
    }

    return adaptSettingsFromSupabase(data);
  } catch (error) {
    console.error('[SupabaseUserData] Exception fetching user settings:', error);
    return null;
  }
}

export async function updateUserSettings(settings: Partial<AppSettings>): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    // 先确保设置记录存在
    await ensureDefaultSettings();

    const updateData: any = {};
    if (settings.riskLimits) updateData.risk_limits = settings.riskLimits;
    if (settings.defaultCurrency) updateData.default_currency = settings.defaultCurrency;
    if (settings.supabase) {
      // Supabase 配置通常不需要存储在数据库中
      // 但可以存储启用状态
    }

    const { error } = await client
      .from('user_settings')
      .update(updateData)
      .is('user_id', null);

    if (error) {
      console.error('[SupabaseUserData] Error updating user settings:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SupabaseUserData] Exception updating user settings:', error);
    return false;
  }
}

export async function updateIBKRRefreshTime(timestamp: Date): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    await ensureDefaultSettings();

    const { error } = await client
      .from('user_settings')
      .update({ ibkr_last_refresh: timestamp.toISOString() })
      .is('user_id', null);

    if (error) {
      console.error('[SupabaseUserData] Error updating IBKR refresh time:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SupabaseUserData] Exception updating IBKR refresh time:', error);
    return false;
  }
}

export async function getIBKRRefreshTime(): Promise<Date | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('user_settings')
      .select('ibkr_last_refresh')
      .is('user_id', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data?.ibkr_last_refresh) return null;

    return new Date(data.ibkr_last_refresh);
  } catch (error) {
    console.error('[SupabaseUserData] Exception getting IBKR refresh time:', error);
    return null;
  }
}

// ============================================
// 辅助函数
// ============================================

async function ensureDefaultSettings(): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    await client.rpc('ensure_default_settings');
  } catch (error) {
    console.error('[SupabaseUserData] Error ensuring default settings:', error);
  }
}

async function createDefaultSettings(): Promise<AppSettings> {
  const client = getClient();
  if (!client) {
    // 返回默认设置
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
        positionLimitExceptions: [
          { ticker: 'PDD', name: '拼多多 (PDD Holdings)', limitPercent: 80.1 },
        ],
      },
    };
  }

  try {
    await ensureDefaultSettings();
    const settings = await getUserSettings();
    return settings || {
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
  } catch (error) {
    console.error('[SupabaseUserData] Error creating default settings:', error);
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
        positionLimitExceptions: [
          { ticker: 'PDD', name: '拼多多 (PDD Holdings)', limitPercent: 80.1 },
        ],
      },
    };
  }
}

function adaptSettingsFromSupabase(data: any): AppSettings {
  return {
    supabase: {
      url: import.meta.env.VITE_SUPABASE_URL || '',
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      enabled: !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
    },
    defaultCurrency: data.default_currency || 'CNY',
    riskLimits: data.risk_limits || {
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

