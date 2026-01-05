-- ============================================
-- 投资数据库 Schema (lyqspnecudllmnajrrlm)
-- ============================================
-- 在 Supabase Dashboard SQL Editor 中执行此脚本
-- https://supabase.com/dashboard/project/lyqspnecudllmnajrrlm/sql/new

-- 1. 净值快照表 (asset_snapshots) - 存储每日净值
CREATE TABLE IF NOT EXISTS asset_snapshots (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  net_worth DECIMAL(15, 2) NOT NULL,
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

-- 启用 RLS (Row Level Security) - 可选
-- ALTER TABLE asset_snapshots ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE dashboard_snapshots ENABLE ROW LEVEL SECURITY;
-- ... 其他表

-- 授权匿名用户访问（用于前端）
GRANT SELECT, INSERT, UPDATE, DELETE ON asset_snapshots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_snapshots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON nav_changes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON cash_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_positions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON watchlist TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON risk_metrics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON trade_reviews TO anon;

-- 授权序列使用权限
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
