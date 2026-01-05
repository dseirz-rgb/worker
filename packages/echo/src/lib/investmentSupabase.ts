/**
 * Investment DB Supabase 客户端
 * 
 * 用于连接 Investment DB (lyqspnecudllmnajrrlm)
 * 存储投资相关数据：持仓、交易、对话、笔记等
 * 
 * **禁止与 Echo DB 混用**
 * 
 * @module @echoai/lib/investmentSupabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let investmentSupabase: SupabaseClient | null = null;

/**
 * 获取 Investment DB Supabase 客户端
 * 
 * 使用 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 环境变量
 * 这些变量指向 Investment DB (lyqspnecudllmnajrrlm)
 */
export function getInvestmentSupabase(): SupabaseClient | null {
  if (investmentSupabase) {
    return investmentSupabase;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[investmentSupabase] 缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY 环境变量');
    return null;
  }

  investmentSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log('[investmentSupabase] Investment DB 客户端初始化成功');
  return investmentSupabase;
}

/**
 * 重置客户端（用于测试）
 */
export function resetInvestmentSupabase(): void {
  investmentSupabase = null;
}

export default getInvestmentSupabase;
