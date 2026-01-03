-- 添加 margin loan 和 leverage 字段到 dashboard_snapshots 表
ALTER TABLE dashboard_snapshots 
ADD COLUMN IF NOT EXISTS margin_loan_usd DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS margin_loan_cny DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS leverage_ratio DECIMAL(10, 4) DEFAULT 1.0;

-- 添加注释
COMMENT ON COLUMN dashboard_snapshots.margin_loan_usd IS 'Margin loan amount in USD (negative cash = debt)';
COMMENT ON COLUMN dashboard_snapshots.margin_loan_cny IS 'Margin loan amount in CNY';
COMMENT ON COLUMN dashboard_snapshots.leverage_ratio IS 'Leverage ratio: (Assets / Net Equity)';
