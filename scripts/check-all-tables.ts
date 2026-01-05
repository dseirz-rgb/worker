/**
 * 检查 Investment DB 所有相关表的数据
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lyqspnecudllmnajrrlm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5cXNwbmVjdWRsbG1uYWpycmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE0NDU4NSwiZXhwIjoyMDgxNTA0NTg1fQ.-ekqAI1NyEw7s-1pQKLa7m3Eq6ZF9F3E6XCJN9vjwko';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAllTables() {
  console.log('=== 检查 Investment DB 所有表 ===\n');

  // 1. stock_positions - 检查所有日期
  console.log('1. stock_positions 表:');
  const { data: allPos, error: posErr } = await supabase
    .from('stock_positions')
    .select('snapshot_date, ticker, market_value, unrealized_pnl')
    .order('snapshot_date', { ascending: false });

  if (posErr) {
    console.log('  错误:', posErr.message);
  } else {
    const dates = [...new Set(allPos?.map(p => p.snapshot_date))];
    console.log('  所有快照日期:', dates);
    
    // 按日期汇总
    for (const date of dates.slice(0, 3)) {
      const dayData = allPos?.filter(p => p.snapshot_date === date) || [];
      const total = dayData.reduce((s, p) => s + Number(p.market_value || 0), 0);
      console.log(`  ${date}: ${dayData.length} 个持仓, 总市值 ¥${total.toLocaleString()}`);
    }
  }

  // 2. sync_logs - 检查同步记录
  console.log('\n2. sync_logs 表 (最近同步):');
  const { data: logs, error: logErr } = await supabase
    .from('sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (logErr) {
    console.log('  错误:', logErr.message);
  } else if (!logs?.length) {
    console.log('  无同步记录');
  } else {
    logs.forEach(l => {
      console.log(`  - ${l.created_at}: ${l.sync_type} - ${l.status}`);
    });
  }

  // 3. 检查表结构
  console.log('\n3. 检查表是否存在:');
  const tables = ['stock_positions', 'option_positions', 'transactions', 'asset_snapshots', 'nav_changes', 'dashboard_snapshots'];
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`  ${table}: 错误 - ${error.message}`);
    } else {
      console.log(`  ${table}: ${count} 条记录`);
    }
  }
}

checkAllTables().catch(console.error);
