-- Qlib Analytics Tables Migration
-- Feature: qlib-analytics
-- Requirements: 3.5, 5.3, 9.3

-- ============================================
-- 1. qlib_predictions - 预测历史记录
-- ============================================
CREATE TABLE IF NOT EXISTS qlib_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_type VARCHAR(20) NOT NULL, -- volatility, drawdown, regime
  ticker VARCHAR(20),
  market VARCHAR(10),
  horizon INTEGER,
  threshold DECIMAL(5, 4),
  predicted_value DECIMAL(10, 6) NOT NULL,
  confidence_lower DECIMAL(10, 6),
  confidence_upper DECIMAL(10, 6),
  actual_value DECIMAL(10, 6), -- 事后填充，用于评估
  model_version VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_qlib_predictions_ticker ON qlib_predictions(ticker);
CREATE INDEX IF NOT EXISTS idx_qlib_predictions_type ON qlib_predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_qlib_predictions_created ON qlib_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_qlib_predictions_model ON qlib_predictions(model_version);

-- 注释
COMMENT ON TABLE qlib_predictions IS '存储所有预测历史记录，用于模型评估和审计';
COMMENT ON COLUMN qlib_predictions.prediction_type IS '预测类型：volatility, drawdown, regime';
COMMENT ON COLUMN qlib_predictions.actual_value IS '实际值，事后填充用于计算预测误差';

-- ============================================
-- 2. qlib_model_registry - 模型注册表
-- ============================================
CREATE TABLE IF NOT EXISTS qlib_model_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name VARCHAR(50) NOT NULL,
  model_version VARCHAR(20) NOT NULL,
  model_path VARCHAR(255) NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  training_data_start DATE,
  training_data_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  UNIQUE(model_name, model_version)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_qlib_model_registry_name ON qlib_model_registry(model_name);
CREATE INDEX IF NOT EXISTS idx_qlib_model_registry_active ON qlib_model_registry(is_active);

-- 注释
COMMENT ON TABLE qlib_model_registry IS '模型版本注册表，管理模型生命周期';
COMMENT ON COLUMN qlib_model_registry.metrics IS '模型性能指标 JSON，如 {"mse": 0.01, "mae": 0.02}';
COMMENT ON COLUMN qlib_model_registry.is_active IS '是否为当前激活的模型版本';

-- ============================================
-- 3. qlib_market_regimes - 市场状态历史
-- ============================================
CREATE TABLE IF NOT EXISTS qlib_market_regimes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market VARCHAR(10) NOT NULL, -- us, hk, cn
  regime VARCHAR(20) NOT NULL, -- bull, bear, sideways, high_volatility
  regime_probabilities JSONB NOT NULL DEFAULT '{}',
  transition_probabilities JSONB,
  model_version VARCHAR(20),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_qlib_market_regimes_market ON qlib_market_regimes(market);
CREATE INDEX IF NOT EXISTS idx_qlib_market_regimes_detected ON qlib_market_regimes(detected_at);
CREATE INDEX IF NOT EXISTS idx_qlib_market_regimes_regime ON qlib_market_regimes(regime);

-- 注释
COMMENT ON TABLE qlib_market_regimes IS '市场状态历史记录';
COMMENT ON COLUMN qlib_market_regimes.regime IS '市场状态：bull, bear, sideways, high_volatility';
COMMENT ON COLUMN qlib_market_regimes.regime_probabilities IS '各状态概率分布 JSON';

-- ============================================
-- 4. qlib_training_jobs - 训练任务记录
-- ============================================
CREATE TABLE IF NOT EXISTS qlib_training_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metrics JSONB,
  error_message TEXT,
  mlflow_run_id VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_qlib_training_jobs_model ON qlib_training_jobs(model_name);
CREATE INDEX IF NOT EXISTS idx_qlib_training_jobs_status ON qlib_training_jobs(status);

-- 注释
COMMENT ON TABLE qlib_training_jobs IS '模型训练任务记录';

-- ============================================
-- 5. qlib_model_alerts - 模型告警记录
-- ============================================
CREATE TABLE IF NOT EXISTS qlib_model_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name VARCHAR(50) NOT NULL,
  alert_type VARCHAR(30) NOT NULL, -- accuracy_drop, data_drift, training_failed
  severity VARCHAR(10) NOT NULL DEFAULT 'warning', -- info, warning, critical
  message TEXT NOT NULL,
  details JSONB,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_qlib_model_alerts_model ON qlib_model_alerts(model_name);
CREATE INDEX IF NOT EXISTS idx_qlib_model_alerts_type ON qlib_model_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_qlib_model_alerts_ack ON qlib_model_alerts(acknowledged);

-- 注释
COMMENT ON TABLE qlib_model_alerts IS '模型性能告警记录';
COMMENT ON COLUMN qlib_model_alerts.alert_type IS '告警类型：accuracy_drop, data_drift, training_failed';
