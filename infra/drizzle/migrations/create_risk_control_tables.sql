-- 风控系统2026升级 - 数据库迁移
-- 创建风控相关表

-- 1. 风控配置表 - 存储用户自定义的风控阈值
CREATE TABLE IF NOT EXISTS risk_thresholds (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1,
  
  -- 杠杆阈值
  leverage_warning DECIMAL(4,2) DEFAULT 1.5,
  leverage_critical DECIMAL(4,2) DEFAULT 2.0,
  leverage_in_drawdown DECIMAL(4,2) DEFAULT 1.2,
  
  -- 月度回撤阈值 (百分比)
  monthly_drawdown_warning DECIMAL(5,2) DEFAULT 10,
  monthly_drawdown_critical DECIMAL(5,2) DEFAULT 15,
  
  -- 移动止盈阈值 (百分比)
  trailing_stop_percent DECIMAL(5,2) DEFAULT 15,
  
  -- 连败阈值 (天数)
  losing_streak_warning INTEGER DEFAULT 3,
  losing_streak_critical INTEGER DEFAULT 5,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- 2. 风控日志表 - 记录所有风控警报和事件
CREATE TABLE IF NOT EXISTS risk_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1,
  
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'
  title VARCHAR(200),
  message TEXT,
  recommendation TEXT,
  
  -- 触发时的指标快照
  metrics JSONB,
  
  -- 确认状态
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 月度快照表 - 用于月度回撤计算
CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1,
  
  year_month VARCHAR(7) NOT NULL, -- '2026-01' 格式
  
  -- 月初净值 (用于计算月度回撤)
  start_nav DECIMAL(15,2) NOT NULL,
  
  -- 月末净值 (月底更新)
  end_nav DECIMAL(15,2),
  
  -- 月度统计
  max_drawdown DECIMAL(5,2),
  max_leverage DECIMAL(4,2),
  losing_streak_days INTEGER DEFAULT 0,
  rule_breaches INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, year_month)
);

-- 4. 熔断事件表 - 记录熔断触发和解除
CREATE TABLE IF NOT EXISTS circuit_breaker_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1,
  
  breaker_type VARCHAR(50) NOT NULL, -- 'leverage', 'drawdown', 'trailing_stop', 'losing_streak'
  reason VARCHAR(200) NOT NULL,
  severity VARCHAR(20) NOT NULL, -- 'warning', 'critical'
  
  -- 熔断时间
  activated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE, -- 冷静期结束时间
  
  -- 触发时的指标
  trigger_value DECIMAL(10,2),
  threshold_value DECIMAL(10,2),
  
  -- 解除状态
  is_active BOOLEAN DEFAULT TRUE,
  deactivated_at TIMESTAMP WITH TIME ZONE,
  
  -- 手动覆盖
  overridden BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  overridden_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_risk_logs_user_created ON risk_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_logs_type ON risk_logs(alert_type);
CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_user_month ON monthly_snapshots(user_id, year_month);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_active ON circuit_breaker_events(user_id, is_active);

-- 插入默认风控配置
INSERT INTO risk_thresholds (user_id) 
VALUES (1) 
ON CONFLICT (user_id) DO NOTHING;
