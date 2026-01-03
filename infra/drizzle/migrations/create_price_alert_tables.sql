-- 价格警报系统数据库表
-- 用于 realtime-market-platform spec

-- 1. 价格警报规则表
CREATE TABLE IF NOT EXISTS price_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL DEFAULT 1,
  ticker VARCHAR(20) NOT NULL,
  condition_type VARCHAR(20) NOT NULL CHECK (condition_type IN ('price_above', 'price_below', 'change_above', 'change_below', 'break_ma')),
  target_value DECIMAL(18, 4) NOT NULL,
  notification_channels TEXT[] NOT NULL DEFAULT ARRAY['toast'],
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  
  -- 额外字段
  name VARCHAR(100),  -- 规则名称（可选）
  notes TEXT          -- 备注（可选）
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_price_alert_rules_user ON price_alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alert_rules_ticker ON price_alert_rules(ticker);
CREATE INDEX IF NOT EXISTS idx_price_alert_rules_enabled ON price_alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_price_alert_rules_user_ticker ON price_alert_rules(user_id, ticker);

-- 2. 价格警报历史表
CREATE TABLE IF NOT EXISTS price_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES price_alert_rules(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL DEFAULT 1,
  ticker VARCHAR(20) NOT NULL,
  triggered_price DECIMAL(18, 4) NOT NULL,
  condition_type VARCHAR(20) NOT NULL,
  target_value DECIMAL(18, 4) NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  notification_channels TEXT[],
  
  -- 额外上下文
  prev_close DECIMAL(18, 4),
  change_percent DECIMAL(8, 4),
  volume BIGINT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_price_alert_history_user ON price_alert_history(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alert_history_ticker ON price_alert_history(ticker);
CREATE INDEX IF NOT EXISTS idx_price_alert_history_triggered_at ON price_alert_history(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_alert_history_rule ON price_alert_history(rule_id);

-- 3. 数据源健康状态表（可选，用于持久化监控数据）
CREATE TABLE IF NOT EXISTS data_source_health (
  id SERIAL PRIMARY KEY,
  source VARCHAR(20) NOT NULL UNIQUE,
  is_healthy BOOLEAN NOT NULL DEFAULT true,
  success_rate DECIMAL(5, 4) NOT NULL DEFAULT 1.0,
  avg_latency_ms INTEGER NOT NULL DEFAULT 0,
  total_requests INTEGER NOT NULL DEFAULT 0,
  successful_requests INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 插入默认数据源
INSERT INTO data_source_health (source) 
VALUES ('longport'), ('openbb'), ('tencent')
ON CONFLICT (source) DO NOTHING;

-- 4. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为 price_alert_rules 添加触发器
DROP TRIGGER IF EXISTS update_price_alert_rules_updated_at ON price_alert_rules;
CREATE TRIGGER update_price_alert_rules_updated_at
  BEFORE UPDATE ON price_alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为 data_source_health 添加触发器
DROP TRIGGER IF EXISTS update_data_source_health_updated_at ON data_source_health;
CREATE TRIGGER update_data_source_health_updated_at
  BEFORE UPDATE ON data_source_health
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
