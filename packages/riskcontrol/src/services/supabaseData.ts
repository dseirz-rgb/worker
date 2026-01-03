/**
 * Supabase 数据服务
 * 直接从 Supabase 读取所有数据，前端不做计算
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lyqspnecudllmnajrrlm.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ⚠️ 安全警告：在前端代码中绝对不要使用 Service Key。
// 如果需要管理员权限，请通过后端 API 代理请求。
// const SERVICE_KEY_OVERRIDE = '...'; // 已移除

let supabase: SupabaseClient | null = null;

/**
 * 获取当前选择的数据年份
 */
export function getDataYear(): number {
  try {
    const cached = localStorage.getItem('rc_data_year');
    if (cached) {
      const year = parseInt(cached);
      if (year >= 2024 && year <= 2030) {
        return year;
      }
    }
  } catch (e) {
    console.warn('Failed to parse rc_data_year', e);
  }
  return 2025; // 默认 2025 年
}

/**
 * 获取数据年份的起始日期
 */
export function getDataYearStartDate(): string {
  const year = getDataYear();
  return `${year}-01-01`;
}

export function getClient() {
  if (supabase) return supabase;

  if (!SUPABASE_ANON_KEY) {
    console.error('Missing VITE_SUPABASE_ANON_KEY');
    return null;
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false, // 禁用持久化，避免本地脏 Token 导致请求被中止
      autoRefreshToken: false,
    },
  });

  return supabase;
}

// ============================================
// 数据类型定义
// ============================================

export interface DashboardSnapshot {
  id: number;
  date: string;
  net_worth_cny: number;
  net_worth_usd: number;
  high_water_mark: number;
  drawdown_amount: number;
  drawdown_percent: number;
  max_drawdown_percent: number;
  daily_pnl: number;
  daily_pnl_percent: number;
  cash_usd: number;
  cash_hkd: number;
  cash_cny: number;
  cash_total_cny: number;
  long_ratio: number;
  short_ratio: number;
  cash_ratio: number;
  options_ratio: number;
  long_value_cny: number;
  short_value_cny: number;
  options_value_cny: number;
  usd_cny_rate: number;
  hkd_cny_rate: number;
  total_positions: number;
  stock_positions: number;
  option_positions: number;
  winning_positions: number;
  losing_positions: number;
  data_source: string;
  created_at: string;
  updated_at: string;
  // 添加债务字段
  margin_loan_usd?: number;  // Margin loan in USD
  margin_loan_cny?: number;  // Margin loan in CNY
  leverage_ratio?: number;   // Leverage ratio (Assets / Equity)
}

export interface StockPosition {
  id: number;
  snapshot_date: string;
  ticker: string;
  name: string;
  market: string;
  currency: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  market_value_cny: number;
  unrealized_pnl_cny: number;
  position_type: string;
  weight_percent: number;
  stop_loss_price: number;
  stop_loss_triggered: boolean;
  created_at: string;
  updated_at: string;
}

export interface OptionPosition {
  id: number;
  snapshot_date: string;
  symbol: string;
  underlying_ticker: string;
  underlying_name: string;
  option_type: string;
  strike_price: number;
  expiry_date: string;
  multiplier: number;
  market: string;
  currency: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  market_value_cny: number;
  unrealized_pnl_cny: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  implied_volatility: number;
  weight_percent: number;
  days_to_expiry: number;
  in_the_money: boolean;
  created_at: string;
  updated_at: string;
}

export interface RiskMetrics {
  id: number;
  date: string;
  var_1day_95: number;
  var_1day_99: number;
  var_10day_95: number;
  current_drawdown_percent: number;
  max_drawdown_percent: number;
  max_drawdown_duration_days: number;
  annualized_return: number;
  annualized_volatility: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  win_rate: number;
  profit_factor: number;
  avg_win: number;
  avg_loss: number;
  market_beta: number;
  correlation_sp500: number;
  top_position_concentration: number;
  top5_concentration: number;
  herfindahl_index: number;
  calculation_period_days: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// 数据查询函数
// ============================================

/**
 * 获取最新的驾驶舱数据
 */
export async function getLatestDashboard(): Promise<DashboardSnapshot | null> {
  const client = getClient();
  if (!client) return null;

  const startDate = getDataYearStartDate();

  try {
    // 直接查询最新数据，不使用缓存视图，确保获取最新日期
    // 添加年份过滤
    const { data, error } = await client
      .from('dashboard_snapshots')
      .select('*')
      .gte('date', startDate) // 只获取指定年份开始的数据
      .order('date', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.error('[SupabaseData] Error fetching latest dashboard:', error);
      return null;
    }
    
    // 验证日期：确保不是旧数据
    if (data) {
      const dataDate = new Date(data.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((today.getTime() - dataDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 3) {
        console.warn(`[SupabaseData] ⚠️ 最新数据日期较旧: ${data.date}, 距今 ${daysDiff} 天`);
      } else {
        console.log(`[SupabaseData] ✅ 获取最新数据: ${data.date}`);
      }
      return data;
    } else {
        // Fallback: 如果没有 Dashboard Snapshot，尝试从持仓数据估算一个临时的
        console.warn('[SupabaseData] No dashboard snapshot found, calculating from positions...');
        const positions = await getLatestStockPositions();
        if (positions.length > 0) {
            const totalMarketValue = positions.reduce((sum, p) => sum + (p.market_value_cny || 0), 0);
            const totalPnL = positions.reduce((sum, p) => sum + (p.unrealized_pnl_cny || 0), 0);
            
            // 构造一个临时对象 (注意：缺少 cash 和 account balance，只能作为近似)
            return {
                id: 0,
                date: new Date().toISOString().split('T')[0],
                net_worth_cny: totalMarketValue, // 假设无现金 (保守估计)
                net_worth_usd: totalMarketValue / 7.2,
                high_water_mark: totalMarketValue,
                drawdown_amount: 0,
                drawdown_percent: 0,
                max_drawdown_percent: 0,
                daily_pnl: 0,
                daily_pnl_percent: 0,
                cash_usd: 0,
                cash_hkd: 0,
                cash_cny: 0,
                cash_total_cny: 0,
                long_ratio: 100,
                short_ratio: 0,
                cash_ratio: 0,
                options_ratio: 0,
                long_value_cny: totalMarketValue,
                short_value_cny: 0,
                options_value_cny: 0,
                usd_cny_rate: 7.2,
                hkd_cny_rate: 0.92,
                total_positions: positions.length,
                stock_positions: positions.length,
                option_positions: 0,
                winning_positions: positions.filter(p => p.unrealized_pnl > 0).length,
                losing_positions: positions.filter(p => p.unrealized_pnl < 0).length,
                data_source: 'CALCULATED',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
        }
        return null;
    }
  } catch (error) {
    console.error('[SupabaseData] Exception fetching latest dashboard:', error);
    return null;
  }
}

/**
 * 获取驾驶舱历史数据（确保包含最新日期）
 */
export async function getDashboardHistory(days: number = 365): Promise<DashboardSnapshot[]> {
  const client = getClient();
  if (!client) return [];

  const startDate = getDataYearStartDate();

  try {
    // 先获取最新一条数据，确保包含今天的数据
    const latest = await getLatestDashboard();
    
    // 获取历史数据（降序，最新在前）
    // 添加年份过滤
    const { data, error } = await client
      .from('dashboard_snapshots')
      .select('*')
      .gte('date', startDate) // 只获取指定年份开始的数据
      .order('date', { ascending: false })
      .limit(days + 1); // 多取一条，确保包含最新

    if (error) {
      console.error('[SupabaseData] Error fetching dashboard history:', error);
      // 如果查询失败，至少返回最新数据
      return latest ? [latest] : [];
    }

    const history = (data || []).reverse(); // 反转成时间顺序（从旧到新）
    
    // 确保最新数据在历史中：如果最新数据不在历史中，添加到末尾
    if (latest) {
      const latestInHistory = history.find(h => h.date === latest.date);
      if (!latestInHistory) {
        history.push(latest);
        console.log('[SupabaseData] 添加最新数据到历史:', latest.date);
      }
    }
    
    // 返回最后 days 条数据（确保包含最新日期）
    return history.slice(-days);
  } catch (error) {
    console.error('[SupabaseData] Exception fetching dashboard history:', error);
    // 出错时至少返回最新数据
    const latest = await getLatestDashboard();
    return latest ? [latest] : [];
  }
}

/**
 * 获取最新的股票持仓
 */
export async function getLatestStockPositions(): Promise<StockPosition[]> {
  const client = getClient();
  if (!client) return [];

  try {
    // 1. 先找出股票表里最新的日期
    const { data: latestDateData, error: dateError } = await client
      .from('stock_positions')
      .select('snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (dateError || !latestDateData) {
       console.warn('[SupabaseData] No stock positions found');
       return [];
    }

    const targetDate = latestDateData.snapshot_date;
    console.log('[SupabaseData] Fetching stocks for date:', targetDate);

    // 2. 用这个日期去查数据
    const { data, error } = await client
      .from('stock_positions')
      .select('*')
      .eq('snapshot_date', targetDate);

    if (error) {
      console.error('[SupabaseData] Error fetching stock positions:', error);
      return [];
    }

    // 3. 聚合逻辑 (Aggregation)
    // 防止出现多个相同 Ticker 的行 (例如 IBKR 返回了多个 Lots)
    const aggregatedMap = new Map<string, StockPosition>();

    for (const pos of (data || [])) {
        if (!aggregatedMap.has(pos.ticker)) {
            aggregatedMap.set(pos.ticker, { ...pos });
        } else {
            const existing = aggregatedMap.get(pos.ticker)!;
            
            // 计算加权平均成本
            const totalCostExisting = existing.quantity * existing.avg_cost;
            const totalCostNew = pos.quantity * pos.avg_cost;
            const newQuantity = existing.quantity + pos.quantity;
            const newAvgCost = newQuantity > 0 ? (totalCostExisting + totalCostNew) / newQuantity : 0;

            // 累加其他数值
            existing.quantity = newQuantity;
            existing.avg_cost = newAvgCost;
            existing.market_value += pos.market_value;
            existing.unrealized_pnl += pos.unrealized_pnl;
            existing.market_value_cny += pos.market_value_cny;
            existing.unrealized_pnl_cny += pos.unrealized_pnl_cny;
            existing.weight_percent = (existing.weight_percent || 0) + (pos.weight_percent || 0);
            
            // 重新计算百分比 (加权平均有点复杂，这里简单用总盈亏/总成本)
            const totalCost = newQuantity * newAvgCost;
            existing.unrealized_pnl_percent = totalCost > 0 ? (existing.unrealized_pnl / totalCost) * 100 : 0;
        }
    }

    return Array.from(aggregatedMap.values());
  } catch (error) {
    console.error('[SupabaseData] Exception fetching stock positions:', error);
    return [];
  }
}

/**
 * 获取最新的期权持仓
 */
export async function getLatestOptionPositions(): Promise<OptionPosition[]> {
  const client = getClient();
  if (!client) return [];

  try {
    // 1. 先找出期权表里最新的日期
    const { data: latestDateData, error: dateError } = await client
      .from('option_positions')
      .select('snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (dateError || !latestDateData) {
       return [];
    }

    const targetDate = latestDateData.snapshot_date;

    // 2. 用这个日期去查数据
    const { data, error } = await client
      .from('option_positions')
      .select('*')
      .eq('snapshot_date', targetDate);

    if (error) {
      console.error('[SupabaseData] Error fetching option positions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[SupabaseData] Exception fetching option positions:', error);
    return [];
  }
}

/**
 * 获取最新的风险指标
 */
export async function getLatestRiskMetrics(): Promise<RiskMetrics | null> {
  const client = getClient();
  if (!client) return null;

  try {
    // 尝试使用视图
    const { data, error } = await client
      .from('latest_risk_metrics')
      .select('*')
      .single();

    if (error) {
      // 如果视图不存在，回退到直接查询
      const { data: fallbackData, error: fallbackError } = await client
        .from('risk_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .single();
      
      if (fallbackError) {
        console.error('[SupabaseData] Error fetching risk metrics:', fallbackError);
        return null;
      }
      
      return fallbackData as unknown as RiskMetrics;
    }

    return data as unknown as RiskMetrics;
  } catch (error) {
    console.error('[SupabaseData] Exception fetching risk metrics:', error);
    return null;
  }
}

/**
 * 检查数据是否为最新（今天的数据）
 */
export async function isDataUpToDate(): Promise<boolean> {
  const latest = await getLatestDashboard();
  if (!latest) return false;

  const latestDate = new Date(latest.date);
  const today = new Date();
  
  return latestDate.toDateString() === today.toDateString();
}

/**
 * 获取所有数据（用于初始化）
 */
export async function getAllData() {
  const [dashboard, stocks, options, risk, history] = await Promise.all([
    getLatestDashboard(),
    getLatestStockPositions(),
    getLatestOptionPositions(),
    getLatestRiskMetrics(),
    getDashboardHistory(),
  ]);

  return {
    dashboard,
    stocks,
    options,
    risk,
    history,
  };
}

/**
 * 获取最新的收益归因数据
 */
export async function getLatestReturnAttribution() {
  const client = getClient();
  if (!client) return null;

  try {
    // 尝试使用视图
    const { data, error } = await client
      .from('latest_return_attribution')
      .select('*')
      .single();

    if (error) {
      // 如果视图不存在，回退到直接查询
      const { data: fallbackData, error: fallbackError } = await client
        .from('return_attribution')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .single();
      
      if (fallbackError) {
        console.error('[SupabaseData] Error fetching return attribution:', fallbackError);
        return null;
      }
      
      return fallbackData;
    }

    return data;
  } catch (error) {
    console.error('[SupabaseData] Exception fetching return attribution:', error);
    return null;
  }
}

/**
 * 获取 YTD 收益归因累计数据
 */
export async function getYTDReturnAttribution() {
  const client = getClient();
  if (!client) return null;

  try {
    const currentYear = new Date().getFullYear();
    const startDate = `${currentYear}-01-01`;
    
    const { data, error } = await client
      .from('return_attribution')
      .select('*')
      .gte('date', startDate);

    if (error) {
      console.error('[SupabaseData] Error fetching YTD return attribution:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // 累加所有数据
    const ytd = {
      trading_pnl: data.reduce((sum, d) => sum + (Number(d.trading_pnl) || 0), 0),
      position_pnl: data.reduce((sum, d) => sum + (Number(d.position_pnl) || 0), 0),
      dividend_income: data.reduce((sum, d) => sum + (Number(d.dividend_income) || 0), 0),
      interest_income: data.reduce((sum, d) => sum + (Number(d.interest_income) || 0), 0),
      option_pnl: data.reduce((sum, d) => sum + (Number(d.option_pnl) || 0), 0),
      fx_pnl: data.reduce((sum, d) => sum + (Number(d.fx_pnl) || 0), 0),
      total_return: data.reduce((sum, d) => sum + (Number(d.total_return) || 0), 0),
      record_count: data.length,
    };

    return ytd;
  } catch (error) {
    console.error('[SupabaseData] Exception fetching YTD return attribution:', error);
    return null;
  }
}

/**
 * 获取最新的成本分析
 */
export async function getLatestCostAnalysis() {
  const client = getClient();
  if (!client) return null;

  try {
    // 尝试使用视图
    const { data, error } = await client
      .from('latest_cost_analysis')
      .select('*')
      .single();

    if (error) {
      // 如果视图不存在，回退到直接查询
      const { data: fallbackData, error: fallbackError } = await client
        .from('cost_analysis')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .single();
      
      if (fallbackError) {
        console.error('[SupabaseData] Error fetching cost analysis:', fallbackError);
        return null;
      }
      
      return fallbackData;
    }

    return data;
  } catch (error) {
    console.error('[SupabaseData] Exception fetching cost analysis:', error);
    return null;
  }
}

// ============================================
// 用户数据查询函数（从 localStorage 迁移）
// ============================================

/**
 * 获取所有交易记录
 */
export async function getTransactions(): Promise<any[]> {
  const client = getClient();
  if (!client) return [];

  const startDate = getDataYearStartDate();

  try {
    const { data, error } = await client
      .from('transactions')
      .select('*')
      .gte('date', startDate) // 只获取指定年份开始的数据
      .order('date', { ascending: false }); // Sort by date primarily

    if (error) {
      console.error('[SupabaseData] Error fetching transactions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[SupabaseData] Exception fetching transactions:', error);
    return [];
  }
}

/**
 * 添加交易记录
 */
export async function addTransaction(transaction: any): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('transactions')
      .insert({
        id: transaction.id,
        date: transaction.date.split('T')[0],
        ticker: transaction.ticker,
        name: transaction.name || null,
        market: transaction.market || null,
        currency: transaction.currency || 'USD',
        action: transaction.action,
        price: transaction.price || null,
        quantity: transaction.quantity,
        amount: transaction.amount || null,
        amount_cny: transaction.amountCNY || null,
        fee: transaction.fee || 0,
        strategy_note: transaction.strategyNote || null,
        is_planned: transaction.isPlanned || false,
        watchlist_days: transaction.watchlistDays || null,
        created_at: transaction.createdAt || new Date().toISOString(),
      });

    if (error) {
      console.error('[SupabaseData] Error adding transaction:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SupabaseData] Exception adding transaction:', error);
    return false;
  }
}

/**
 * 删除交易记录
 */
export async function deleteTransaction(id: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SupabaseData] Error deleting transaction:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SupabaseData] Exception deleting transaction:', error);
    return false;
  }
}

/**
 * 获取观察列表
 */
export async function getWatchlist(): Promise<any[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('watchlist')
      .select('*')
      .order('added_at', { ascending: false }); // 修正字段名为 added_at

    if (error) {
      // 如果排序失败，尝试不使用排序
      if (error.code === '42703' || error.message?.includes('column')) {
        console.warn('[SupabaseData] Order by added_at failed, trying without order:', error);
        const { data: fallbackData, error: fallbackError } = await client
          .from('watchlist')
          .select('*');
        
        if (fallbackError) {
          console.error('[SupabaseData] Error fetching watchlist:', fallbackError);
          return [];
        }
        
        // 手动排序
        return (fallbackData || []).sort((a, b) => {
          const dateA = new Date(a.added_date || a.created_at || 0).getTime();
          const dateB = new Date(b.added_date || b.created_at || 0).getTime();
          return dateB - dateA;
        });
      }
      
      console.error('[SupabaseData] Error fetching watchlist:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[SupabaseData] Exception fetching watchlist:', error);
    return [];
  }
}

/**
 * 添加观察列表项
 */
export async function addToWatchlist(item: any): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('watchlist')
      .insert({
        id: item.id,
        ticker: item.ticker,
        name: item.name || null,
        market: item.market || null,
        currency: item.currency || 'USD',
        added_date: item.addedDate.split('T')[0],
        target_price: item.targetPrice || null,
        notes: item.notes || null,
        current_price: item.currentPrice || null,
        change_percent: item.changePercent || null,
      });

    if (error) {
      console.error('[SupabaseData] Error adding watchlist item:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SupabaseData] Exception adding watchlist item:', error);
    return false;
  }
}

/**
 * 删除观察列表项
 */
export async function removeFromWatchlist(id: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('watchlist')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SupabaseData] Error removing watchlist item:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SupabaseData] Exception removing watchlist item:', error);
    return false;
  }
}

/**
 * 获取用户设置
 */
export async function getUserSettings(): Promise<any | null> {
  const client = getClient();
  if (!client) return null;

  try {
    // 获取当前用户
    const { data: { user } } = await client.auth.getUser();
    
    // 如果没有用户，直接返回 null (使用默认设置)，不要尝试查询数据库
    // 因为数据库 id 是 uuid 类型，'default' 会导致语法错误
    if (!user?.id) {
      console.log('[SupabaseData] No authenticated user, using default settings');
      return null;
    }

    const { data, error } = await client
      .from('user_settings')
      .select('*')
      // 避免使用 'default' 查询 UUID 列
      .limit(1)
      .maybeSingle();

    if (error) {
      // 如果是表不存在的错误，返回 null 而不是抛出错误
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[SupabaseData] user_settings table does not exist, returning null');
        return null;
      }
      console.error('[SupabaseData] Error fetching user settings:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[SupabaseData] Exception fetching user settings:', error);
    return null;
  }
}

// ============================================
// 实时行情数据（长桥 API 写入）
// ============================================

export interface LiveQuote {
  id: number;
  ticker: string;
  price: number;
  prev_close?: number;
  change_percent?: number;
  volume?: number;
  timestamp: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 从 live 表获取实时行情数据（长桥 API 写入）
 * 这是主要的实时数据源
 */
export async function getLiveQuotes(tickers?: string[]): Promise<LiveQuote[]> {
  const client = getClient();
  if (!client) return [];

  try {
    let query = client
      .from('live')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (tickers && tickers.length > 0) {
      query = query.in('ticker', tickers);
    }

    const { data, error } = await query;

    if (error) {
      // 如果表不存在，静默返回空数组
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[SupabaseData] live table does not exist yet');
        return [];
      }
      console.error('[SupabaseData] Error fetching live quotes:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[SupabaseData] Exception fetching live quotes:', error);
    return [];
  }
}

/**
 * 获取单个股票的实时行情
 */
export async function getLiveQuote(ticker: string): Promise<LiveQuote | null> {
  const quotes = await getLiveQuotes([ticker]);
  return quotes.length > 0 ? quotes[0] : null;
}

/**
 * 批量获取实时行情（返回 Map 方便查找）
 */
export async function getLiveQuotesMap(tickers: string[]): Promise<Map<string, LiveQuote>> {
  const quotes = await getLiveQuotes(tickers);
  const map = new Map<string, LiveQuote>();
  
  for (const quote of quotes) {
    map.set(quote.ticker, quote);
  }
  
  return map;
}

/**
 * 更新用户设置
 */
export async function updateUserSettings(settings: Partial<any>): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    // 过滤掉不应该保存到数据库的字段
    const { 
      supabase_url, 
      supabase_anon_key, 
      supabase_enabled, 
      ...safeSettings 
    } = settings;

    // 如果过滤后没有要更新的字段，直接返回成功
    if (Object.keys(safeSettings).length === 0) {
      return true;
    }

    // 获取当前用户
    const { data: { user } } = await client.auth.getUser();
    
    // 只有已认证用户才能保存设置
    if (!user?.id) {
      console.warn('[SupabaseData] Cannot update settings: No authenticated user');
      return false;
    }

    const { error } = await client
      .from('user_settings')
      .upsert({
        id: user.id, // 使用用户 ID
        ...safeSettings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) {
      console.error('[SupabaseData] Error updating user settings:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SupabaseData] Exception updating user settings:', error);
    return false;
  }
}
