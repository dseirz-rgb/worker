/**
 * 完整检查 IBKR 数据中枢的所有数据
 * 对比前端实现，确保没有遗漏
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lyqspnecudllmnajrrlm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5cXNwbmVjdWRsbG1uYWpycmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE0NDU4NSwiZXhwIjoyMDgxNTA0NTg1fQ.-ekqAI1NyEw7s-1pQKLa7m3Eq6ZF9F3E6XCJN9vjwko';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkData() {
  console.log('=== IBKR 数据中枢完整检查 ===\n');

  // 1. dashboard_snapshots - 账户汇总数据（最重要）
  console.log('1. dashboard_snapshots（账户汇总 - 数据中枢核心）:');
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
    console.log('  --- 净值 ---');
    console.log('  净值 USD:', dashboard?.net_worth_usd?.toLocaleString());
    console.log('  净值 CNY:', dashboard?.net_worth_cny?.toLocaleString());
    console.log('  高水位:', dashboard?.high_water_mark?.toLocaleString());
    console.log('  --- 盈亏 ---');
    console.log('  日盈亏:', dashboard?.daily_pnl?.toLocaleString());
    console.log('  日盈亏%:', dashboard?.daily_pnl_percent);
    console.log('  回撤金额:', dashboard?.drawdown_amount?.toLocaleString());
    console.log('  回撤%:', dashboard?.drawdown_percent);
    console.log('  最大回撤%:', dashboard?.max_drawdown_percent);
    console.log('  --- 现金 ---');
    console.log('  现金 USD:', dashboard?.cash_usd?.toLocaleString());
    console.log('  现金 HKD:', dashboard?.cash_hkd?.toLocaleString());
    console.log('  现金 CNY:', dashboard?.cash_cny?.toLocaleString());
    console.log('  现金总计 CNY:', dashboard?.cash_total_cny?.toLocaleString());
    console.log('  --- 仓位比例 ---');
    console.log('  现金比例%:', dashboard?.cash_ratio);
    console.log('  多头比例%:', dashboard?.long_ratio);
    console.log('  空头比例%:', dashboard?.short_ratio);
    console.log('  --- 仓位价值 ---');
    console.log('  多头价值 CNY:', dashboard?.long_value_cny?.toLocaleString());
    console.log('  空头价值 CNY:', dashboard?.short_value_cny?.toLocaleString());
    console.log('  --- 杠杆 ---');
    console.log('  保证金贷款 USD:', dashboard?.margin_loan_usd?.toLocaleString());
    console.log('  保证金贷款 CNY:', dashboard?.margin_loan_cny?.toLocaleString());
    console.log('  杠杆率:', dashboard?.leverage_ratio);
    console.log('  --- 汇率 ---');
    console.log('  USD/CNY:', dashboard?.usd_cny_rate);
    console.log('  HKD/CNY:', dashboard?.hkd_cny_rate);
    console.log('  --- 持仓统计 ---');
    console.log('  总持仓数:', dashboard?.total_positions);
    console.log('  股票持仓数:', dashboard?.stock_positions);
    console.log('  盈利持仓数:', dashboard?.winning_positions);
    console.log('  亏损持仓数:', dashboard?.losing_positions);
    console.log('  数据来源:', dashboard?.data_source);
  }

  // 2. stock_positions - 持仓明细
  console.log('\n2. stock_positions（持仓明细）:');
  const { data: positions, error: posError } = await supabase
    .from('stock_positions')
    .select('*')
    .order('snapshot_date', { ascending: false });

  if (posError) {
    console.error('  错误:', posError.message);
  } else {
    const latestDate = positions?.[0]?.snapshot_date;
    const latestPositions = positions?.filter(p => p.snapshot_date === latestDate) || [];
    console.log('  最新快照日期:', latestDate);
    console.log('  持仓数量:', latestPositions.length);
    
    // 计算汇总
    let totalMarketValueUSD = 0;
    let totalMarketValueCNY = 0;
    let totalUnrealizedPnLUSD = 0;
    let totalUnrealizedPnLCNY = 0;
    
    console.log('\n  持仓明细:');
    latestPositions.forEach(p => {
      totalMarketValueUSD += Number(p.market_value || 0);
      totalMarketValueCNY += Number(p.market_value_cny || 0);
      totalUnrealizedPnLUSD += Number(p.unrealized_pnl || 0);
      totalUnrealizedPnLCNY += Number(p.unrealized_pnl_cny || 0);
      
      console.log(`    ${p.ticker}:`);
      console.log(`      数量: ${p.quantity}, 均价: ${p.avg_cost}, 现价: ${p.current_price}`);
      console.log(`      市值 USD: ${Number(p.market_value).toLocaleString()}, CNY: ${Number(p.market_value_cny).toLocaleString()}`);
      console.log(`      盈亏 USD: ${Number(p.unrealized_pnl).toLocaleString()}, CNY: ${Number(p.unrealized_pnl_cny).toLocaleString()}`);
      console.log(`      盈亏%: ${p.unrealized_pnl_percent}%, 权重: ${p.weight_percent}%`);
    });
    
    console.log('\n  持仓汇总:');
    console.log(`    总市值 USD: ${totalMarketValueUSD.toLocaleString()}`);
    console.log(`    总市值 CNY: ${totalMarketValueCNY.toLocaleString()}`);
    console.log(`    总盈亏 USD: ${totalUnrealizedPnLUSD.toLocaleString()}`);
    console.log(`    总盈亏 CNY: ${totalUnrealizedPnLCNY.toLocaleString()}`);
  }

  // 3. nav_changes - 净值变化
  console.log('\n3. nav_changes（净值变化 - 最近3条）:');
  const { data: navChanges, error: navError } = await supabase
    .from('nav_changes')
    .select('*')
    .order('to_date', { ascending: false })
    .limit(3);

  if (navError) {
    console.error('  错误:', navError.message);
  } else {
    navChanges?.forEach(nav => {
      console.log(`  ${nav.to_date}:`);
      console.log(`    起始: ${Number(nav.starting_value).toLocaleString()} -> 结束: ${Number(nav.ending_value).toLocaleString()}`);
      console.log(`    MTM: ${nav.mtm}, 已实现: ${nav.realized}, 未实现变化: ${nav.change_in_unrealized}`);
    });
  }

  // 4. asset_snapshots - 每日净值
  console.log('\n4. asset_snapshots（每日净值 - 最近5条）:');
  const { data: assets, error: assetError } = await supabase
    .from('asset_snapshots')
    .select('*')
    .order('date', { ascending: false })
    .limit(5);

  if (assetError) {
    console.error('  错误:', assetError.message);
  } else {
    assets?.forEach(a => {
      console.log(`  ${a.date}: 净值 ${Number(a.net_worth).toLocaleString()}`);
    });
  }

  // 5. transactions - 交易记录
  console.log('\n5. transactions（交易记录 - 最近5条）:');
  const { data: trades, error: tradeError } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .limit(5);

  if (tradeError) {
    console.error('  错误:', tradeError.message);
  } else {
    trades?.forEach(t => {
      console.log(`  ${t.date} ${t.action} ${t.ticker}: ${t.quantity} @ ${t.price}`);
    });
  }

  console.log('\n=== 数据对比分析 ===');
  if (dashboard && positions) {
    const latestDate = positions?.[0]?.snapshot_date;
    const latestPositions = positions?.filter(p => p.snapshot_date === latestDate) || [];
    const positionsMarketValueCNY = latestPositions.reduce((sum, p) => sum + Number(p.market_value_cny || 0), 0);
    
    console.log('dashboard_snapshots.net_worth_cny:', dashboard.net_worth_cny?.toLocaleString());
    console.log('stock_positions 累加市值 CNY:', positionsMarketValueCNY.toLocaleString());
    console.log('差异（现金等）:', (dashboard.net_worth_cny - positionsMarketValueCNY).toLocaleString());
    console.log('\n结论: 前端应使用 dashboard_snapshots.net_worth_cny 作为账户净值');
    console.log('      stock_positions 的市值仅代表持仓市值，不包含现金');
  }
}

checkData().catch(console.error);
