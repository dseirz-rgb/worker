/**
 * 投资数据库恢复脚本
 * 
 * 用途：恢复被覆盖的投资数据库表结构，并从 IBKR 同步数据
 * 
 * 运行方式：npx tsx scripts/restore-investment-db.ts
 */

import { createClient } from '@supabase/supabase-js';

// 投资数据库配置 (lyqspnecudllmnajrrlm)
const INVESTMENT_DB_URL = 'https://lyqspnecudllmnajrrlm.supabase.co';
const INVESTMENT_DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5cXNwbmVjdWRsbG1uYWpycmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE0NDU4NSwiZXhwIjoyMDgxNTA0NTg1fQ.-ekqAI1NyEw7s-1pQKLa7m3Eq6ZF9F3E6XCJN9vjwko';

const supabase = createClient(INVESTMENT_DB_URL, INVESTMENT_DB_KEY);

// 创建投资相关表的 SQL
const CREATE_TABLES_SQL = `
-- 1. 净值快照表 (asset_snapshots) - 存储每日净值
CREATE TABLE IF NOT EXISTS asset_snapshots (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  net_worth DECIMAL(15, 2) NOT NULL,  -- USD 净值
  cash_ratio DECIMAL(5, 2),
  long_ratio DECIMAL(5, 2),
  short_ratio DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 每日驾驶舱快照表 (dashboard_snapshots)
CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  net_worth_cny DECIMAL(15, 2) NOT NULL,
  net_worth_usd DECIMAL(15, 2) NOT NULL,
  high_water_mark DECIMAL(15, 2) NOT NULL,
  drawdown_amount DECIMAL(15, 2),
  drawdown_percent DECIMAL(10, 4),
  max_drawdown_percent DECIMAL(10, 4),
  daily_pnl DECIMAL(15, 2),
  daily_pnl_percent DECIMAL(10, 4),
  cash_usd DECIMAL(15, 2) DEFAULT 0,
  cash_hkd DECIMAL(15, 2) DEFAULT 0,
  cash_cny DECIMAL(15, 2) DEFAULT 0,
  cash_total_cny DECIMAL(15, 2) DEFAULT 0,
  long_ratio DECIMAL(5, 2),
  short_ratio DECIMAL(5, 2),
  cash_ratio DECIMAL(5, 2),
  long_value_cny DECIMAL(15, 2),
  short_value_cny DECIMAL(15, 2),
  margin_loan_usd DECIMAL(15, 2) DEFAULT 0,
  margin_loan_cny DECIMAL(15, 2) DEFAULT 0,
  leverage_ratio DECIMAL(10, 4) DEFAULT 1.0,
  usd_cny_rate DECIMAL(10, 4),
  hkd_cny_rate DECIMAL(10, 4),
  total_positions INTEGER DEFAULT 0,
  stock_positions INTEGER DEFAULT 0,
  winning_positions INTEGER DEFAULT 0,
  losing_positions INTEGER DEFAULT 0,
  data_source VARCHAR(20) DEFAULT 'IBKR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 净值变化记录表 (nav_changes)
CREATE TABLE IF NOT EXISTS nav_changes (
  id BIGSERIAL PRIMARY KEY,
  account_id VARCHAR(50),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  starting_value DECIMAL(15, 2),
  ending_value DECIMAL(15, 2),
  twr DECIMAL(10, 6),
  mtm DECIMAL(15, 2),
  realized DECIMAL(15, 2),
  change_in_unrealized DECIMAL(15, 2),
  deposits_withdrawals DECIMAL(15, 2),
  dividends DECIMAL(15, 2),
  interest DECIMAL(15, 2),
  change_in_interest_accruals DECIMAL(15, 2),
  commissions DECIMAL(15, 2),
  broker_fees DECIMAL(15, 2),
  withholding_tax DECIMAL(15, 2),
  other_fees DECIMAL(15, 2),
  fx_translation DECIMAL(15, 2),
  corporate_action_proceeds DECIMAL(15, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, to_date)
);

-- 4. 现金报告表 (cash_reports)
CREATE TABLE IF NOT EXISTS cash_reports (
  id BIGSERIAL PRIMARY KEY,
  account_id VARCHAR(50),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  currency VARCHAR(20),
  starting_cash DECIMAL(15, 2),
  ending_cash DECIMAL(15, 2),
  ending_settled_cash DECIMAL(15, 2),
  commissions DECIMAL(15, 2),
  net_trades_sales DECIMAL(15, 2),
  net_trades_purchases DECIMAL(15, 2),
  dividends DECIMAL(15, 2),
  broker_interest DECIMAL(15, 2),
  bond_interest DECIMAL(15, 2),
  broker_fees DECIMAL(15, 2),
  advisor_fees DECIMAL(15, 2),
  transaction_tax DECIMAL(15, 2),
  withholding_tax DECIMAL(15, 2),
  other_fees DECIMAL(15, 2),
  deposit_withdrawals DECIMAL(15, 2),
  internal_transfers DECIMAL(15, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, to_date, currency)
);

-- 5. 交易记录表 (transactions)
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(255) PRIMARY KEY,
  date DATE NOT NULL,
  ticker VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  market VARCHAR(10),
  currency VARCHAR(3),
  action VARCHAR(20) NOT NULL,
  price DECIMAL(15, 4),
  quantity INTEGER NOT NULL DEFAULT 0,
  fee DECIMAL(15, 2) DEFAULT 0,
  strategy_note TEXT,
  is_planned BOOLEAN DEFAULT FALSE,
  watchlist_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 股票持仓表 (stock_positions)
CREATE TABLE IF NOT EXISTS stock_positions (
  id BIGSERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  ticker VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  market VARCHAR(10),
  currency VARCHAR(3),
  quantity INTEGER NOT NULL,
  avg_cost DECIMAL(15, 4),
  current_price DECIMAL(15, 4),
  market_value DECIMAL(15, 2),
  unrealized_pnl DECIMAL(15, 2),
  unrealized_pnl_percent DECIMAL(10, 4),
  market_value_cny DECIMAL(15, 2),
  unrealized_pnl_cny DECIMAL(15, 2),
  position_type VARCHAR(10),
  weight_percent DECIMAL(5, 2),
  stop_loss_price DECIMAL(15, 4),
  stop_loss_triggered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 观察列表表 (watchlist)
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255),
  market VARCHAR(10),
  currency VARCHAR(3),
  added_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_price DECIMAL(15, 4),
  notes TEXT,
  current_price DECIMAL(15, 4),
  change_percent DECIMAL(10, 4),
  last_price_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 用户设置表 (user_settings)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  risk_limits JSONB DEFAULT '{"stopLossPercent": -20, "maxDrawdownPercent": 5, "positionLimitPercent": 15, "watchlistCooldownDays": 7, "positionLimitExceptions": []}',
  ibkr_last_refresh TIMESTAMPTZ,
  ibkr_sync_enabled BOOLEAN DEFAULT TRUE,
  panic_lockdown JSONB,
  default_currency VARCHAR(3) DEFAULT 'CNY',
  theme VARCHAR(20) DEFAULT 'light',
  sidebar_width INTEGER DEFAULT 280,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 风险指标表 (risk_metrics)
CREATE TABLE IF NOT EXISTS risk_metrics (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  var_1day_95 DECIMAL(10, 4),
  var_1day_99 DECIMAL(10, 4),
  var_10day_95 DECIMAL(10, 4),
  current_drawdown_percent DECIMAL(10, 4),
  max_drawdown_percent DECIMAL(10, 4),
  max_drawdown_duration_days INTEGER,
  annualized_return DECIMAL(10, 4),
  annualized_volatility DECIMAL(10, 4),
  sharpe_ratio DECIMAL(10, 4),
  sortino_ratio DECIMAL(10, 4),
  calmar_ratio DECIMAL(10, 4),
  win_rate DECIMAL(10, 4),
  profit_factor DECIMAL(10, 4),
  avg_win DECIMAL(15, 2),
  avg_loss DECIMAL(15, 2),
  market_beta DECIMAL(10, 4),
  correlation_sp500 DECIMAL(10, 4),
  top_position_concentration DECIMAL(10, 4),
  top5_concentration DECIMAL(10, 4),
  herfindahl_index DECIMAL(10, 4),
  calculation_period_days INTEGER DEFAULT 365,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. 交易复盘表 (trade_reviews)
CREATE TABLE IF NOT EXISTS trade_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(255) NOT NULL UNIQUE,
  review_date DATE,
  entry_reason TEXT,
  exit_reason TEXT,
  lessons_learned TEXT,
  emotion_state VARCHAR(50),
  followed_plan BOOLEAN,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_asset_snapshots_date ON asset_snapshots(date);
CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_date ON dashboard_snapshots(date);
CREATE INDEX IF NOT EXISTS idx_nav_changes_to_date ON nav_changes(to_date);
CREATE INDEX IF NOT EXISTS idx_cash_reports_to_date ON cash_reports(to_date);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_ticker ON transactions(ticker);
CREATE INDEX IF NOT EXISTS idx_stock_positions_date ON stock_positions(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_risk_metrics_date ON risk_metrics(date);
`;

async function checkExistingTables() {
  console.log('检查现有表...');
  
  const tables = [
    'asset_snapshots',
    'dashboard_snapshots', 
    'nav_changes',
    'cash_reports',
    'transactions',
    'stock_positions',
    'watchlist',
    'user_settings',
    'risk_metrics',
    'trade_reviews'
  ];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`  ❌ ${table}: 不存在或无法访问 (${error.message})`);
    } else {
      console.log(`  ✅ ${table}: 存在`);
    }
  }
}

async function createTables() {
  console.log('\n创建投资数据库表...');
  console.log('注意：需要在 Supabase Dashboard SQL Editor 中手动执行以下 SQL：\n');
  console.log('='.repeat(80));
  console.log(CREATE_TABLES_SQL);
  console.log('='.repeat(80));
  console.log('\n请复制上述 SQL 到 Supabase Dashboard 执行');
}

async function main() {
  console.log('投资数据库恢复工具');
  console.log('='.repeat(50));
  console.log(`数据库: ${INVESTMENT_DB_URL}`);
  console.log('');
  
  await checkExistingTables();
  await createTables();
  
  console.log('\n下一步：');
  console.log('1. 在 Supabase Dashboard 执行上述 SQL 创建表');
  console.log('2. 运行 IBKR 同步：在 RiskControl 前端点击"刷新数据"按钮');
  console.log('   或访问 http://localhost:5173 并触发 IBKR 同步');
}

main().catch(console.error);
