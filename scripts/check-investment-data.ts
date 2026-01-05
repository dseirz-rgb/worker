/**
 * 检查 Investment DB 中的数据
 * 用于调试数据不正确的问题
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lyqspnecudllmnajrrlm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5cXNwbmVjdWRsbG1uYWpycmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE0NDU4NSwiZXhwIjoyMDgxNTA0NTg1fQ.-ekqAI1NyEw7s-1pQKLa7m3Eq6ZF9F3E6XCJN9vjwko';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkData() {
  console.log('=== 检查 Investment DB 数据 ===\n');

  // 1. 检查 dashboard_snapshots 表（这是前端显示的数据来源）
  console.log('1. dashboard_snapshots 表（前端数据来源）:');
  const { data: dashboard, error: dashError } = await supabase
    .from('dashboard_snapshots')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (dashError) {
    console.error('  错误:', dashError.message);
  } else {
    console.log('  日期:', dashboard?.date);
    console.log('  净值 USD:', dashboard?.net_worth_usd);
    console.log('  净值 CNY:', dashboard?.net_worth_cny);
    console.log('  日盈亏:', dashboard?.daily_pnl);
    console.log('  日盈亏%:', dashboard?.daily_pnl_percent);
    console.log('  回撤%:', dashboard?.drawdown_percent);
    console.log('  现金 USD:', dashboard?.cash_usd);
    console.log('  现金比例:', dashboard?.cash_ratio);
    console.log('  多头比例:', dashboard?.long_ratio);
  }

  // 2. 检查 stock_positions 表
  console.log('\n2. stock_positions 表（最新快照）:');
  const { data: positions, error: posError } = await supabase
    .from('stock_positions')
    .select('*')
    .order('snapshot_date', { ascending: false });

  if (posError) {
    console.error('  错误:', posError.message);
  } else {
    const latestDate = positions?.[0]?.snapshot_date;
    console.log('  最新快照日期:', latestDate);
    
    const latestPositions = positions?.filter(p => p.snapshot_date === latestDate) || [];
    console.log('  持仓数量:', latestPositions.length);
    
    // 使用 CNY 字段
    const totalMarketValueCNY = latestPositions.reduce((sum, p) => sum + Number(p.market_value_cny || 0), 0);
    console.log('  总市值 CNY:', totalMarketValueCNY.toLocaleString());
    
    const totalUnrealizedPnLCNY = latestPositions.reduce((sum, p) => sum + Number(p.unrealized_pnl_cny || 0), 0);
    console.log('  总未实现盈亏 CNY:', totalUnrealizedPnLCNY.toLocaleString());
    
    console.log('\n  所有持仓:');
    latestPositions.forEach(p => {
      console.log(`    - ${p.ticker}: 市值CNY ${Number(p.market_value_cny).toLocaleString()}, 盈亏CNY ${Number(p.unrealized_pnl_cny).toLocaleString()}`);
    });
  }

  // 3. 检查 asset_snapshots 表
  console.log('\n3. asset_snapshots 表:');
  const { data: assets, error: assetError } = await supabase
    .from('asset_snapshots')
    .select('*')
    .order('date', { ascending: false })
    .limit(3);

  if (assetError) {
    console.error('  错误:', assetError.message);
  } else {
    assets?.forEach(a => {
      console.log(`  ${a.date}: 净值 ${a.net_worth}`);
    });
  }
}

checkData().catch(console.error);
