/**
 * Investment DB Supabase 客户端 (服务端)
 * 
 * 用于连接 Investment DB，存储投资相关数据：
 * - 持仓、交易、Dashboard 快照
 * - AI 对话、消息
 * - 投资笔记、知识库
 * - AI 分析报告
 * 
 * **禁止与 Echo DB 混用**
 * 
 * 环境变量:
 * - INVESTMENT_SUPABASE_URL
 * - INVESTMENT_SUPABASE_ANON_KEY
 * 
 * @module services/echo-server/lib/investmentDb
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// 客户端管理
// ============================================================================

let investmentDb: SupabaseClient | null = null;

/**
 * 获取 Investment DB Supabase 客户端
 */
export function getInvestmentDb(): SupabaseClient | null {
  if (investmentDb) {
    return investmentDb;
  }

  const supabaseUrl = process.env.INVESTMENT_SUPABASE_URL;
  const supabaseAnonKey = process.env.INVESTMENT_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[InvestmentDb] 缺少 INVESTMENT_SUPABASE_URL 或 INVESTMENT_SUPABASE_ANON_KEY 环境变量');
    return null;
  }

  investmentDb = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log('[InvestmentDb] Investment DB 客户端初始化成功');
  return investmentDb;
}

/**
 * 重置客户端（用于测试）
 */
export function resetInvestmentDb(): void {
  investmentDb = null;
}

// ============================================================================
// 数据查询函数
// ============================================================================

/**
 * 获取最新的 Dashboard 快照
 */
export async function getDashboardSnapshot(accountId?: number): Promise<DashboardSnapshot | null> {
  const client = getInvestmentDb();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('dashboard_snapshots')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('[InvestmentDb] Error fetching dashboard snapshot:', error);
      return null;
    }

    return data as DashboardSnapshot;
  } catch (error) {
    console.error('[InvestmentDb] Exception fetching dashboard snapshot:', error);
    return null;
  }
}

/**
 * 获取最新的股票持仓
 */
export async function getStockPositions(accountId?: number): Promise<StockPosition[]> {
  const client = getInvestmentDb();
  if (!client) return [];

  try {
    // 先找出最新的日期
    const { data: latestDateData, error: dateError } = await client
      .from('stock_positions')
      .select('snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (dateError || !latestDateData) {
      console.warn('[InvestmentDb] No stock positions found');
      return [];
    }

    const targetDate = latestDateData.snapshot_date;

    // 用这个日期去查数据
    const { data, error } = await client
      .from('stock_positions')
      .select('*')
      .eq('snapshot_date', targetDate);

    if (error) {
      console.error('[InvestmentDb] Error fetching stock positions:', error);
      return [];
    }

    // 聚合相同 ticker 的持仓
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

        existing.quantity = newQuantity;
        existing.avg_cost = newAvgCost;
        existing.market_value += pos.market_value;
        existing.unrealized_pnl += pos.unrealized_pnl;
        existing.market_value_cny += pos.market_value_cny;
        existing.unrealized_pnl_cny += pos.unrealized_pnl_cny;
        existing.weight_percent = (existing.weight_percent || 0) + (pos.weight_percent || 0);
        
        const totalCost = newQuantity * newAvgCost;
        existing.unrealized_pnl_percent = totalCost > 0 ? (existing.unrealized_pnl / totalCost) * 100 : 0;
      }
    }

    return Array.from(aggregatedMap.values());
  } catch (error) {
    console.error('[InvestmentDb] Exception fetching stock positions:', error);
    return [];
  }
}

/**
 * 获取最新的期权持仓
 */
export async function getOptionPositions(accountId?: number): Promise<OptionPosition[]> {
  const client = getInvestmentDb();
  if (!client) return [];

  try {
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

    const { data, error } = await client
      .from('option_positions')
      .select('*')
      .eq('snapshot_date', targetDate);

    if (error) {
      console.error('[InvestmentDb] Error fetching option positions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[InvestmentDb] Exception fetching option positions:', error);
    return [];
  }
}

/**
 * 获取最近的交易记录
 */
export async function getRecentTransactions(accountId?: number, limit: number = 10): Promise<Transaction[]> {
  const client = getInvestmentDb();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[InvestmentDb] Error fetching transactions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[InvestmentDb] Exception fetching transactions:', error);
    return [];
  }
}

/**
 * 获取用户档案
 */
export async function getUserProfile(accountId: number): Promise<UserProfile | null> {
  const client = getInvestmentDb();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('user_id', accountId)
      .single();

    if (error) {
      // 表可能不存在，静默返回 null
      if (error.code === '42P01' || error.code === 'PGRST116') {
        return null;
      }
      console.error('[InvestmentDb] Error fetching user profile:', error);
      return null;
    }

    return data as UserProfile;
  } catch (error) {
    console.error('[InvestmentDb] Exception fetching user profile:', error);
    return null;
  }
}

// ============================================================================
// 对话管理
// ============================================================================

/**
 * 获取用户的对话列表
 */
export async function getConversations(accountId: number): Promise<Conversation[]> {
  const client = getInvestmentDb();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('conversations')
      .select('*')
      .eq('user_id', accountId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[InvestmentDb] Error fetching conversations:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[InvestmentDb] Exception fetching conversations:', error);
    return [];
  }
}

/**
 * 创建新对话
 */
export async function createConversation(accountId: number, title?: string): Promise<Conversation | null> {
  const client = getInvestmentDb();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('conversations')
      .insert({
        user_id: accountId,
        title: title || '新对话',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[InvestmentDb] Error creating conversation:', error);
      return null;
    }

    return data as Conversation;
  } catch (error) {
    console.error('[InvestmentDb] Exception creating conversation:', error);
    return null;
  }
}

/**
 * 删除对话
 */
export async function deleteConversation(conversationId: number): Promise<boolean> {
  const client = getInvestmentDb();
  if (!client) return false;

  try {
    // 先删除消息
    await client
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    // 再删除对话
    const { error } = await client
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error('[InvestmentDb] Error deleting conversation:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[InvestmentDb] Exception deleting conversation:', error);
    return false;
  }
}

// ============================================================================
// 消息管理
// ============================================================================

/**
 * 获取对话的消息列表
 */
export async function getMessages(conversationId: number): Promise<Message[]> {
  const client = getInvestmentDb();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[InvestmentDb] Error fetching messages:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[InvestmentDb] Exception fetching messages:', error);
    return [];
  }
}

/**
 * 保存消息
 */
export async function saveMessage(message: Omit<Message, 'id' | 'created_at'>): Promise<Message | null> {
  const client = getInvestmentDb();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('messages')
      .insert({
        ...message,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[InvestmentDb] Error saving message:', error);
      return null;
    }

    // 更新对话的 updated_at
    await client
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', message.conversation_id);

    return data as Message;
  } catch (error) {
    console.error('[InvestmentDb] Exception saving message:', error);
    return null;
  }
}

// ============================================================================
// 文档搜索
// ============================================================================

/**
 * 全文搜索文档
 */
export async function searchDocuments(query: string, limit: number = 5): Promise<Document[]> {
  const client = getInvestmentDb();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('documents')
      .select('*')
      .textSearch('content', query, { type: 'websearch', config: 'english' })
      .limit(limit);

    if (error) {
      console.error('[InvestmentDb] Error searching documents:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[InvestmentDb] Exception searching documents:', error);
    return [];
  }
}

/**
 * 向量搜索文档
 */
export async function vectorSearchDocuments(
  embedding: number[],
  matchThreshold: number = 0.5,
  matchCount: number = 5
): Promise<Document[]> {
  const client = getInvestmentDb();
  if (!client) return [];

  try {
    const { data, error } = await client
      .rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
      });

    if (error) {
      console.error('[InvestmentDb] Error vector searching documents:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[InvestmentDb] Exception vector searching documents:', error);
    return [];
  }
}

// ============================================================================
// AI 分析
// ============================================================================

/**
 * 保存 AI 分析报告
 */
export async function saveAnalysis(analysis: Omit<AIAnalysis, 'id' | 'created_at'>): Promise<AIAnalysis | null> {
  const client = getInvestmentDb();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('ai_analyses')
      .insert({
        ...analysis,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[InvestmentDb] Error saving analysis:', error);
      return null;
    }

    return data as AIAnalysis;
  } catch (error) {
    console.error('[InvestmentDb] Exception saving analysis:', error);
    return null;
  }
}

/**
 * 获取最新的 AI 分析报告
 */
export async function getLatestAnalysis(accountId: number): Promise<AIAnalysis | null> {
  const client = getInvestmentDb();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('ai_analyses')
      .select('*')
      .eq('user_id', accountId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // 没有数据
      }
      console.error('[InvestmentDb] Error fetching latest analysis:', error);
      return null;
    }

    return data as AIAnalysis;
  } catch (error) {
    console.error('[InvestmentDb] Exception fetching latest analysis:', error);
    return null;
  }
}

/**
 * 根据 ID 获取 AI 分析报告
 */
export async function getAnalysisById(id: number): Promise<AIAnalysis | null> {
  const client = getInvestmentDb();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('ai_analyses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[InvestmentDb] Error fetching analysis by id:', error);
      return null;
    }

    return data as AIAnalysis;
  } catch (error) {
    console.error('[InvestmentDb] Exception fetching analysis by id:', error);
    return null;
  }
}

// ============================================================================
// 类型定义
// ============================================================================

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
  margin_loan_usd?: number;
  margin_loan_cny?: number;
  leverage_ratio?: number;
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

export interface Transaction {
  id: string;
  date: string;
  ticker: string;
  name?: string;
  market?: string;
  currency: string;
  action: string;
  price?: number;
  quantity: number;
  amount?: number;
  amount_cny?: number;
  fee?: number;
  strategy_note?: string;
  is_planned?: boolean;
  watchlist_days?: number;
  created_at: string;
}

export interface UserProfile {
  user_id: number;
  investment_style: 'conservative' | 'moderate' | 'aggressive';
  risk_tolerance: number;
  principles: string[];
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  created_at: string;
}

export interface Citation {
  source: string;
  title: string;
  content_snippet?: string;
  url?: string;
}

export interface Document {
  id: number;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  created_at: string;
  updated_at: string;
}

export interface AIAnalysis {
  id: number;
  user_id: number;
  title: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  content: string;
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'REBALANCE' | 'WARNING';
  action_plan: string;
  primary_ticker: string;
  portfolio_snapshot: Record<string, unknown>;
  created_at: string;
}

export default getInvestmentDb;
