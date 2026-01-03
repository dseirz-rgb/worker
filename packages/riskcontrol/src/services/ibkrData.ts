// IBKR 数据服务 - 从 Supabase 获取同步的 IBKR 交易数据
import type { Transaction, NetWorthRecord, Market, Currency } from '../types';
import { Action } from '../types';

const SUPABASE_URL = 'https://lyqspnecudllmnajrrlm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5cXNwbmVjdWRsbG1uYWpycmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NDg3MzEsImV4cCI6MjA4MTMyNDczMX0.5HQDtQWmdA_NCHtGeXck34WKDZf7jEw8wDRjsZy3dNU';

// Supabase 表结构
interface SupabaseTransaction {
  id: number;
  ticker: string;
  name: string;
  action: string;
  price: number;
  quantity: number;
  currency: string;
  strategy_note: string;
  created_at: string;
  date?: string; // Optional: Supabase transaction might have a date field
}

interface SupabaseSnapshot {
  id: number;
  date: string;
  net_worth: number;
  cash_ratio: number;
  long_ratio: number;
  short_ratio: number;
  created_at: string;
}

// 汇率常量
const USD_CNY = 7.25;
const HKD_CNY = 0.93;

// 检测市场
function detectMarket(ticker: string): Market {
  if (/^\d{4,6}$/.test(ticker)) {
    return 'HK';
  }
  if (/^\d{6}$/.test(ticker) || /^[036]\d{5}$/.test(ticker)) {
    return 'CN';
  }
  return 'US';
}

// 获取货币
function getCurrency(market: Market): Currency {
  switch (market) {
    case 'HK': return 'HKD';
    case 'CN': return 'CNY';
    default: return 'USD';
  }
}

// 从 Supabase 获取交易记录
export async function fetchIBKRTransactions(): Promise<Transaction[]> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/transactions?select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch transactions:', response.statusText);
      return [];
    }

    const data: SupabaseTransaction[] = await response.json();
    
    return data.map((tx, index) => {
      const market = detectMarket(tx.ticker);
      const currency = tx.currency as Currency || getCurrency(market);
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
        action: tx.action === 'BUY' ? Action.BUY : Action.SELL,
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
      };
    });
  } catch (error) {
    console.error('Error fetching IBKR transactions:', error);
    return [];
  }
}

// 从 Supabase 获取净值历史
export async function fetchIBKRNetWorthHistory(): Promise<NetWorthRecord[]> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/asset_snapshots?select=*&order=date.asc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch snapshots:', response.statusText);
      return [];
    }

    const data: SupabaseSnapshot[] = await response.json();
    
    // 计算高水位线
    let highWaterMark = 0;
    
    return data.map(snapshot => {
      const netWorthCNY = snapshot.net_worth * USD_CNY;
      if (netWorthCNY > highWaterMark) {
        highWaterMark = netWorthCNY;
      }
      
      return {
        date: snapshot.date,
        netWorth: netWorthCNY,
        cashRatio: snapshot.cash_ratio,
        longRatio: snapshot.long_ratio,
        shortRatio: snapshot.short_ratio,
        highWaterMark,
      };
    });
  } catch (error) {
    console.error('Error fetching IBKR net worth history:', error);
    return [];
  }
}

// 获取最新持仓（从交易记录计算）
export interface IBKRPosition {
  ticker: string;
  name: string;
  quantity: number;
  avgCost: number;
  currency: Currency;
  market: Market;
}

export async function fetchIBKRPositions(): Promise<IBKRPosition[]> {
  const transactions = await fetchIBKRTransactions();
  
  // 按股票代码聚合
  const positionMap = new Map<string, {
    ticker: string;
    name: string;
    totalQuantity: number;
    totalCost: number;
    currency: Currency;
    market: Market;
  }>();
  
  for (const tx of transactions) {
    const existing = positionMap.get(tx.ticker);
    const qty = tx.action === Action.BUY ? tx.quantity : -tx.quantity;
    const cost = tx.action === Action.BUY ? tx.price * tx.quantity : 0;
    
    if (existing) {
      existing.totalQuantity += qty;
      if (tx.action === Action.BUY) {
        existing.totalCost += cost;
      }
    } else {
      positionMap.set(tx.ticker, {
        ticker: tx.ticker,
        name: tx.name,
        totalQuantity: qty,
        totalCost: cost,
        currency: tx.currency,
        market: tx.market,
      });
    }
  }
  
  // 过滤出有持仓的股票
  return Array.from(positionMap.values())
    .filter(p => p.totalQuantity > 0)
    .map(p => ({
      ticker: p.ticker,
      name: p.name,
      quantity: p.totalQuantity,
      avgCost: p.totalCost / p.totalQuantity,
      currency: p.currency,
      market: p.market,
    }));
}

// 获取最新净值
export async function fetchLatestNetWorth(): Promise<{
  netWorth: number;
  netWorthCNY: number;
  date: string;
} | null> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/asset_snapshots?select=*&order=date.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data: SupabaseSnapshot[] = await response.json();
    if (data.length === 0) return null;

    const latest = data[0];
    return {
      netWorth: latest.net_worth,
      netWorthCNY: latest.net_worth * USD_CNY,
      date: latest.date,
    };
  } catch (error) {
    console.error('Error fetching latest net worth:', error);
    return null;
  }
}
