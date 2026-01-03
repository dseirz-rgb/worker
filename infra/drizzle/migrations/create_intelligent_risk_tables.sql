-- Intelligent Risk Engine Tables
-- Migration for risk decisions, alerts, user config, and emotional trading

-- ============================================
-- 1. Risk Decisions Table
-- Stores all risk control decisions made by the system
-- ============================================
CREATE TABLE IF NOT EXISTS risk_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL DEFAULT 1,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 各模块输出 (JSONB for flexibility)
    leverage_limit JSONB NOT NULL,
    stop_loss_config JSONB NOT NULL,
    risk_forecast JSONB NOT NULL,
    emotional_alerts JSONB,
    
    -- 综合决策
    overall_risk_level VARCHAR(20) NOT NULL,
    effective_leverage DECIMAL(3, 2) NOT NULL,
    effective_stop_loss DECIMAL(5, 4) NOT NULL,
    trading_allowed BOOLEAN NOT NULL DEFAULT true,
    cooldown_until TIMESTAMPTZ,
    
    -- 决策依据
    reasoning TEXT[] NOT NULL,
    confidence DECIMAL(3, 2) NOT NULL,
    
    -- 覆盖信息
    is_overridden BOOLEAN NOT NULL DEFAULT false,
    override_reason TEXT,
    override_by VARCHAR(100),
    override_at TIMESTAMPTZ,
    
    CONSTRAINT valid_risk_level CHECK (overall_risk_level IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_leverage CHECK (effective_leverage >= 1.0 AND effective_leverage <= 2.0),
    CONSTRAINT valid_stop_loss CHECK (effective_stop_loss >= -0.30 AND effective_stop_loss <= 0),
    CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

-- Indexes for risk_decisions
CREATE INDEX IF NOT EXISTS idx_risk_decisions_user ON risk_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_decisions_timestamp ON risk_decisions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_risk_decisions_risk_level ON risk_decisions(overall_risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_decisions_trading ON risk_decisions(trading_allowed);

-- ============================================
-- 2. Risk Alerts History Table
-- Stores all risk alerts and warnings
-- ============================================
CREATE TABLE IF NOT EXISTS risk_alerts_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL DEFAULT 1,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    suggested_action TEXT,
    
    -- Alert metadata
    source_module VARCHAR(50),
    related_ticker VARCHAR(20),
    related_decision_id UUID,
    
    -- Acknowledgment tracking
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    dismissed BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'critical')),
    CONSTRAINT valid_alert_type CHECK (alert_type IN (
        'drawdown_warning', 
        'regime_change', 
        'volatility_spike',
        'leverage_change',
        'stop_loss_change',
        'emotional_trading',
        'cooldown_active'
    ))
);

-- Indexes for risk_alerts_history
CREATE INDEX IF NOT EXISTS idx_risk_alerts_user ON risk_alerts_history(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_created ON risk_alerts_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_severity ON risk_alerts_history(severity);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_acknowledged ON risk_alerts_history(acknowledged);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_type ON risk_alerts_history(alert_type);

-- ============================================
-- 3. User Risk Config Table
-- Stores user-specific risk preferences and settings
-- ============================================
CREATE TABLE IF NOT EXISTS user_risk_config (
    user_id INTEGER PRIMARY KEY DEFAULT 1,
    
    -- Risk preferences
    risk_preference VARCHAR(20) NOT NULL DEFAULT 'balanced',
    max_acceptable_drawdown DECIMAL(5, 4) NOT NULL DEFAULT 0.10,
    
    -- Leverage settings
    custom_max_leverage DECIMAL(3, 2) DEFAULT NULL,
    leverage_auto_adjust BOOLEAN NOT NULL DEFAULT true,
    
    -- Stop loss settings
    custom_stop_loss_min DECIMAL(5, 4) DEFAULT -0.05,
    custom_stop_loss_max DECIMAL(5, 4) DEFAULT -0.20,
    stop_loss_auto_adjust BOOLEAN NOT NULL DEFAULT true,
    
    -- Notification settings
    notification_channels TEXT[] NOT NULL DEFAULT ARRAY['toast', 'email'],
    notification_frequency VARCHAR(20) NOT NULL DEFAULT 'immediate',
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    
    -- Cooldown settings
    cooldown_duration INTEGER NOT NULL DEFAULT 60,
    auto_cooldown_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Feature toggles
    emotional_detection_enabled BOOLEAN NOT NULL DEFAULT true,
    position_optimizer_enabled BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_risk_preference CHECK (risk_preference IN ('conservative', 'balanced', 'aggressive')),
    CONSTRAINT valid_notification_frequency CHECK (notification_frequency IN ('immediate', 'hourly', 'daily')),
    CONSTRAINT valid_drawdown CHECK (max_acceptable_drawdown > 0 AND max_acceptable_drawdown <= 0.50),
    CONSTRAINT valid_cooldown CHECK (cooldown_duration >= 0 AND cooldown_duration <= 1440)
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_risk_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_risk_config_updated ON user_risk_config;
CREATE TRIGGER trigger_user_risk_config_updated
    BEFORE UPDATE ON user_risk_config
    FOR EACH ROW
    EXECUTE FUNCTION update_user_risk_config_timestamp();

-- ============================================
-- 3. User Risk Config Table
-- Stores user-specific risk preferences and settings
-- ============================================
CREATE TABLE IF NOT EXISTS user_risk_config (
    user_id INTEGER PRIMARY KEY DEFAULT 1,
    
    -- Risk preferences
    risk_preference VARCHAR(20) NOT NULL DEFAULT 'balanced',
    max_acceptable_drawdown DECIMAL(5, 4) NOT NULL DEFAULT 0.10,
    
    -- Leverage settings
    custom_max_leverage DECIMAL(3, 2) DEFAULT NULL,
    leverage_auto_adjust BOOLEAN NOT NULL DEFAULT true,
    
    -- Stop loss settings
    custom_stop_loss_min DECIMAL(5, 4) DEFAULT -0.05,
    custom_stop_loss_max DECIMAL(5, 4) DEFAULT -0.20,
    stop_loss_auto_adjust BOOLEAN NOT NULL DEFAULT true,
    
    -- Notification settings
    notification_channels TEXT[] NOT NULL DEFAULT ARRAY['toast', 'email'],
    notification_frequency VARCHAR(20) NOT NULL DEFAULT 'immediate',
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    
    -- Cooldown settings
    cooldown_duration INTEGER NOT NULL DEFAULT 60,
    auto_cooldown_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Feature toggles
    emotional_detection_enabled BOOLEAN NOT NULL DEFAULT true,
    position_optimizer_enabled BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_risk_preference CHECK (risk_preference IN ('conservative', 'balanced', 'aggressive')),
    CONSTRAINT valid_notification_frequency CHECK (notification_frequency IN ('immediate', 'hourly', 'daily')),
    CONSTRAINT valid_drawdown CHECK (max_acceptable_drawdown > 0 AND max_acceptable_drawdown <= 0.50),
    CONSTRAINT valid_cooldown CHECK (cooldown_duration >= 0 AND cooldown_duration <= 1440)
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_risk_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_risk_config_updated ON user_risk_config;
CREATE TRIGGER trigger_user_risk_config_updated
    BEFORE UPDATE ON user_risk_config
    FOR EACH ROW
    EXECUTE FUNCTION update_user_risk_config_timestamp();

-- ============================================
-- 4. Emotional Trading Events Table
-- Records detected emotional trading patterns
-- ============================================
CREATE TABLE IF NOT EXISTS emotional_trading_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL DEFAULT 1,
    
    -- Event classification
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    
    -- Event details
    details JSONB NOT NULL,
    trigger_trades JSONB,
    
    -- Cooldown tracking
    cooldown_applied BOOLEAN NOT NULL DEFAULT false,
    cooldown_duration INTEGER,
    cooldown_started_at TIMESTAMPTZ,
    cooldown_ended_at TIMESTAMPTZ,
    
    -- User response
    user_acknowledged BOOLEAN NOT NULL DEFAULT false,
    user_response VARCHAR(50),
    user_notes TEXT,
    
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_event_type CHECK (event_type IN (
        'revenge_trading',
        'overtrading', 
        'panic_selling',
        'fomo_buying',
        'strategy_deviation'
    )),
    CONSTRAINT valid_event_severity CHECK (severity IN ('warning', 'critical'))
);

-- Indexes for emotional_trading_events
CREATE INDEX IF NOT EXISTS idx_emotional_events_user ON emotional_trading_events(user_id);
CREATE INDEX IF NOT EXISTS idx_emotional_events_detected ON emotional_trading_events(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_emotional_events_type ON emotional_trading_events(event_type);
CREATE INDEX IF NOT EXISTS idx_emotional_events_severity ON emotional_trading_events(severity);
CREATE INDEX IF NOT EXISTS idx_emotional_events_cooldown ON emotional_trading_events(cooldown_applied);

-- ============================================
-- 5. Leverage Change History Table
-- Tracks all leverage limit changes for audit
-- ============================================
CREATE TABLE IF NOT EXISTS leverage_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL DEFAULT 1,
    
    previous_limit DECIMAL(3, 2) NOT NULL,
    new_limit DECIMAL(3, 2) NOT NULL,
    
    market_regime VARCHAR(20) NOT NULL,
    volatility_adjustment DECIMAL(3, 2) DEFAULT 0,
    reason TEXT NOT NULL,
    
    effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    notified BOOLEAN NOT NULL DEFAULT false,
    notified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_leverage_history_user ON leverage_change_history(user_id);
CREATE INDEX IF NOT EXISTS idx_leverage_history_effective ON leverage_change_history(effective_at DESC);

-- ============================================
-- 6. Stop Loss Change History Table
-- Tracks all stop loss adjustments for audit
-- ============================================
CREATE TABLE IF NOT EXISTS stop_loss_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL DEFAULT 1,
    ticker VARCHAR(20),
    
    previous_stop_loss DECIMAL(5, 4) NOT NULL,
    new_stop_loss DECIMAL(5, 4) NOT NULL,
    
    volatility_percentile DECIMAL(5, 2) NOT NULL,
    reason TEXT NOT NULL,
    
    effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    notified BOOLEAN NOT NULL DEFAULT false,
    notified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stoploss_history_user ON stop_loss_change_history(user_id);
CREATE INDEX IF NOT EXISTS idx_stoploss_history_effective ON stop_loss_change_history(effective_at DESC);
CREATE INDEX IF NOT EXISTS idx_stoploss_history_ticker ON stop_loss_change_history(ticker);

-- ============================================
-- 7. Insert default user config
-- ============================================
INSERT INTO user_risk_config (user_id, risk_preference, max_acceptable_drawdown)
VALUES (1, 'balanced', 0.10)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 8. Views for common queries
-- ============================================

-- Latest risk decision view
CREATE OR REPLACE VIEW v_latest_risk_decision AS
SELECT DISTINCT ON (user_id)
    id,
    user_id,
    timestamp,
    overall_risk_level,
    effective_leverage,
    effective_stop_loss,
    trading_allowed,
    cooldown_until,
    reasoning,
    confidence,
    is_overridden
FROM risk_decisions
ORDER BY user_id, timestamp DESC;

-- Active alerts view (unacknowledged, not expired)
CREATE OR REPLACE VIEW v_active_alerts AS
SELECT *
FROM risk_alerts_history
WHERE acknowledged = false
  AND dismissed = false
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY 
    CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'warning' THEN 2 
        ELSE 3 
    END,
    created_at DESC;

-- Recent emotional events view (last 7 days)
CREATE OR REPLACE VIEW v_recent_emotional_events AS
SELECT *
FROM emotional_trading_events
WHERE detected_at > NOW() - INTERVAL '7 days'
ORDER BY detected_at DESC;
