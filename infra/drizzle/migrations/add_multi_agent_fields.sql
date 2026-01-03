-- Migration: Add Multi-Agent Analysis Support
-- Date: 2025-06-27
-- Description: Adds execution_trace, orchestrator_state columns to ai_analyses table
--              and creates agent_memories table for long-term memory storage

-- ============================================================================
-- 1. Add execution_trace column to ai_analyses
-- Stores the complete agent execution trace for debugging and analysis
-- ============================================================================
ALTER TABLE ai_analyses 
ADD COLUMN IF NOT EXISTS execution_trace JSONB;

COMMENT ON COLUMN ai_analyses.execution_trace IS 
'Complete multi-agent execution trace including all agent results, timing, and handoff messages';

-- ============================================================================
-- 2. Add orchestrator_state column to ai_analyses
-- Stores the orchestrator state for resuming interrupted analyses
-- ============================================================================
ALTER TABLE ai_analyses 
ADD COLUMN IF NOT EXISTS orchestrator_state JSONB;

COMMENT ON COLUMN ai_analyses.orchestrator_state IS 
'Serialized orchestrator state for resuming interrupted analyses';

-- ============================================================================
-- 3. Add orchestration_mode column to ai_analyses
-- Records which mode was used for the analysis
-- ============================================================================
ALTER TABLE ai_analyses 
ADD COLUMN IF NOT EXISTS orchestration_mode TEXT 
CHECK (orchestration_mode IN ('sequential', 'selector', 'handoff', 'respond_directly'));

COMMENT ON COLUMN ai_analyses.orchestration_mode IS 
'Orchestration mode used: sequential, selector, handoff, or respond_directly';

-- ============================================================================
-- 4. Add agents_used column to ai_analyses
-- Records which agents participated in the analysis
-- ============================================================================
ALTER TABLE ai_analyses 
ADD COLUMN IF NOT EXISTS agents_used TEXT[];

COMMENT ON COLUMN ai_analyses.agents_used IS 
'Array of agent IDs that participated in this analysis';

-- ============================================================================
-- 5. Add total_execution_time_ms column to ai_analyses
-- Records total execution time for performance monitoring
-- ============================================================================
ALTER TABLE ai_analyses 
ADD COLUMN IF NOT EXISTS total_execution_time_ms INTEGER;

COMMENT ON COLUMN ai_analyses.total_execution_time_ms IS 
'Total execution time in milliseconds for the multi-agent analysis';

-- ============================================================================
-- 6. Create agent_memories table for long-term memory storage
-- Inspired by Agno's agentic_memory system
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_memories (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  
  -- Memory identification
  agent_id TEXT NOT NULL,
  user_id BIGINT NOT NULL,
  
  -- Memory content
  memory_type TEXT NOT NULL CHECK (memory_type IN ('insight', 'pattern', 'decision', 'outcome')),
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  
  -- Memory scoring and ranking
  importance NUMERIC(3,2) DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  
  -- Access tracking for retrieval strategies
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Optional: link to the analysis that generated this memory
  source_analysis_id BIGINT REFERENCES ai_analyses(id) ON DELETE SET NULL
);

-- Indexes for efficient memory retrieval
CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_user 
ON agent_memories(agent_id, user_id);

CREATE INDEX IF NOT EXISTS idx_agent_memories_type 
ON agent_memories(memory_type);

CREATE INDEX IF NOT EXISTS idx_agent_memories_importance 
ON agent_memories(importance DESC);

CREATE INDEX IF NOT EXISTS idx_agent_memories_recency 
ON agent_memories(last_accessed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_agent_memories_created 
ON agent_memories(created_at DESC);

-- GIN index for full-text search on content
CREATE INDEX IF NOT EXISTS idx_agent_memories_content_search 
ON agent_memories USING GIN (to_tsvector('english', content));

COMMENT ON TABLE agent_memories IS 
'Long-term memory storage for multi-agent system, enabling cross-session learning';

-- ============================================================================
-- 7. Create agent_alert_history table for tracking AI-triggered alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_alert_history (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  
  -- Alert identification
  user_id BIGINT NOT NULL,
  analysis_id BIGINT REFERENCES ai_analyses(id) ON DELETE CASCADE,
  
  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN ('risk', 'market', 'position', 'advisor')),
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  
  -- Alert content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  agent_findings JSONB DEFAULT '{}',
  
  -- Notification tracking
  notification_sent BOOLEAN DEFAULT FALSE,
  email_sent BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ
);

-- Indexes for alert queries
CREATE INDEX IF NOT EXISTS idx_agent_alerts_user 
ON agent_alert_history(user_id);

CREATE INDEX IF NOT EXISTS idx_agent_alerts_severity 
ON agent_alert_history(severity);

CREATE INDEX IF NOT EXISTS idx_agent_alerts_created 
ON agent_alert_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_alerts_unacknowledged 
ON agent_alert_history(user_id, acknowledged_at) 
WHERE acknowledged_at IS NULL;

COMMENT ON TABLE agent_alert_history IS 
'History of AI-triggered risk alerts from multi-agent analysis';

-- ============================================================================
-- 8. Add index on execution_trace for JSONB queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ai_analyses_execution_trace 
ON ai_analyses USING GIN (execution_trace);

-- ============================================================================
-- 9. Update function to automatically update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to agent_memories table
DROP TRIGGER IF EXISTS update_agent_memories_updated_at ON agent_memories;
CREATE TRIGGER update_agent_memories_updated_at
  BEFORE UPDATE ON agent_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
