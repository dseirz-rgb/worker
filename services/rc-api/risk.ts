/**
 * Risk API - 风控综合接口
 * 
 * GET /api/risk?action=status    - 获取当前风控状态
 * GET /api/risk?action=decision  - 获取完整决策详情
 * GET /api/risk?action=history   - 获取历史记录
 * 
 * Requirements: 10.1, 10.3, 10.4
 * 
 * @module api/risk
 */

import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// === Types ===

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface RiskDecisionRow {
  id: string;
  timestamp: string;
  overall_risk_level: RiskLevel;
  effective_leverage: number;
  effective_stop_loss: number;
  trading_allowed: boolean;
  cooldown_until: string | null;
  confidence: number;
  leverage_limit: Record<string, unknown> | null;
  stop_loss_config: Record<string, unknown> | null;
  risk_forecast: Record<string, unknown> | null;
  reasoning: string[] | null;
  is_overridden: boolean;
  override_reason: string | null;
  override_by: string | null;
  override_at: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientType = ReturnType<typeof createClient>;

// === Helper Functions ===

function getSupabaseClient(): SupabaseClientType | null {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    return null;
  }
  
  return createClient(url, key);
}

function calculateAvgRiskLevel(decisions: Array<{ overallRiskLevel: RiskLevel }>): string {
  if (decisions.length === 0) return 'medium';
  
  const levelValues: Record<RiskLevel, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  
  const avg = decisions.reduce((sum, d) => sum + levelValues[d.overallRiskLevel], 0) / decisions.length;
  
  if (avg < 1.5) return 'low';
  if (avg < 2.5) return 'medium';
  if (avg < 3.5) return 'high';
  return 'critical';
}

// === Handlers ===

async function handleStatus(_req: VercelRequest, res: VercelResponse, supabase: SupabaseClientType) {
  // 获取最新决策
  const { data, error: decisionError } = await supabase
    .from('risk_decisions')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  if (decisionError && decisionError.code !== 'PGRST116') {
    throw decisionError;
  }

  // 获取活跃预警数量
  const { count: alertCount } = await supabase
    .from('risk_alerts_history')
    .select('*', { count: 'exact', head: true })
    .eq('acknowledged', false)
    .eq('dismissed', false);

  if (!data) {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      data: {
        overallRiskLevel: 'medium',
        effectiveLeverage: 1.0,
        effectiveStopLoss: -0.10,
        tradingAllowed: true,
        cooldownUntil: null,
        confidence: 0.5,
        alertCount: alertCount || 0,
        lastUpdated: new Date().toISOString(),
      },
    });
  }

  const decision = data as RiskDecisionRow;
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    data: {
      overallRiskLevel: decision.overall_risk_level,
      effectiveLeverage: decision.effective_leverage,
      effectiveStopLoss: decision.effective_stop_loss,
      tradingAllowed: decision.trading_allowed,
      cooldownUntil: decision.cooldown_until,
      confidence: decision.confidence,
      alertCount: alertCount || 0,
      lastUpdated: decision.timestamp,
    },
  });
}

async function handleDecision(req: VercelRequest, res: VercelResponse, supabase: SupabaseClientType) {
  const { id } = req.query;

  let query = supabase.from('risk_decisions').select('*');

  if (id && typeof id === 'string') {
    query = query.eq('id', id);
  } else {
    query = query.order('timestamp', { ascending: false }).limit(1);
  }

  const { data, error: decisionError } = await query.single();

  if (decisionError) {
    if (decisionError.code === 'PGRST116') {
      return res.status(404).json({
        status: 'error',
        error: 'Decision not found',
        timestamp: new Date().toISOString(),
      });
    }
    throw decisionError;
  }

  const decision = data as RiskDecisionRow;
  const leverageLimit = (decision.leverage_limit || {}) as Record<string, unknown>;
  const stopLossConfig = (decision.stop_loss_config || {}) as Record<string, unknown>;
  const riskForecast = (decision.risk_forecast || {}) as Record<string, unknown>;

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    data: {
      id: decision.id,
      timestamp: decision.timestamp,
      overallRiskLevel: decision.overall_risk_level,
      effectiveLeverage: decision.effective_leverage,
      effectiveStopLoss: decision.effective_stop_loss,
      tradingAllowed: decision.trading_allowed,
      cooldownUntil: decision.cooldown_until,
      leverageLimit: {
        maxLeverage: leverageLimit.maxLeverage || 1.0,
        reason: leverageLimit.reason || '',
        marketRegime: leverageLimit.marketRegime || 'unknown',
      },
      stopLossConfig: {
        stopLossPercent: stopLossConfig.stopLossPercent || -0.10,
        reason: stopLossConfig.reason || '',
        volatilityPercentile: stopLossConfig.volatilityPercentile || 50,
      },
      riskForecast: {
        level: riskForecast.level || 'medium',
        horizonDays: riskForecast.horizonDays || 5,
        alertCount: riskForecast.alertCount || 0,
        confidence: riskForecast.confidence || 0.5,
      },
      reasoning: decision.reasoning || [],
      confidence: decision.confidence,
      isOverridden: decision.is_overridden,
      overrideReason: decision.override_reason,
      overrideBy: decision.override_by,
      overrideAt: decision.override_at,
    },
  });
}

async function handleHistory(req: VercelRequest, res: VercelResponse, supabase: SupabaseClientType) {
  const days = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 90);
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  const type = (req.query.type as string) || 'all';

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();

  const response: {
    status: string;
    timestamp: string;
    data: {
      decisions?: Array<{
        id: string;
        timestamp: string;
        overallRiskLevel: RiskLevel;
        effectiveLeverage: number;
        effectiveStopLoss: number;
        tradingAllowed: boolean;
        confidence: number;
        isOverridden: boolean;
      }>;
      alerts?: Array<{
        id: string;
        createdAt: string;
        alertType: string;
        severity: string;
        message: string;
        suggestedAction: string | null;
        acknowledged: boolean;
      }>;
      summary?: {
        totalDecisions: number;
        totalAlerts: number;
        avgRiskLevel: string;
        avgLeverage: number;
        avgStopLoss: number;
      };
    };
    pagination?: { limit: number; offset: number; total: number };
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    data: {},
  };

  if (type === 'decisions' || type === 'all') {
    const { data: decisions, count } = await supabase
      .from('risk_decisions')
      .select('*', { count: 'exact' })
      .gte('timestamp', sinceISO)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    response.data.decisions = (decisions || []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      timestamp: d.timestamp as string,
      overallRiskLevel: d.overall_risk_level as RiskLevel,
      effectiveLeverage: d.effective_leverage as number,
      effectiveStopLoss: d.effective_stop_loss as number,
      tradingAllowed: d.trading_allowed as boolean,
      confidence: d.confidence as number,
      isOverridden: d.is_overridden as boolean,
    }));

    response.pagination = { limit, offset, total: count || 0 };
  }

  if (type === 'alerts' || type === 'all') {
    const { data: alerts } = await supabase
      .from('risk_alerts_history')
      .select('*')
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: false })
      .limit(limit);

    response.data.alerts = (alerts || []).map((a: Record<string, unknown>) => ({
      id: a.id as string,
      createdAt: a.created_at as string,
      alertType: a.alert_type as string,
      severity: a.severity as string,
      message: a.message as string,
      suggestedAction: a.suggested_action as string | null,
      acknowledged: a.acknowledged as boolean,
    }));
  }

  if (response.data.decisions && response.data.decisions.length > 0) {
    const decisions = response.data.decisions;
    response.data.summary = {
      totalDecisions: decisions.length,
      totalAlerts: response.data.alerts?.length || 0,
      avgRiskLevel: calculateAvgRiskLevel(decisions),
      avgLeverage: decisions.reduce((sum, d) => sum + d.effectiveLeverage, 0) / decisions.length,
      avgStopLoss: decisions.reduce((sum, d) => sum + d.effectiveStopLoss, 0) / decisions.length,
    };
  }

  return res.status(200).json(response);
}

// === Main Handler ===

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-cache, max-age=0');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      status: 'error', 
      error: 'Method not allowed',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        status: 'error',
        error: 'Database configuration missing',
        timestamp: new Date().toISOString(),
      });
    }

    const action = (req.query.action as string) || 'status';

    switch (action) {
      case 'status':
        return handleStatus(req, res, supabase);
      case 'decision':
        return handleDecision(req, res, supabase);
      case 'history':
        return handleHistory(req, res, supabase);
      default:
        return res.status(400).json({
          status: 'error',
          error: `Unknown action: ${action}. Valid actions: status, decision, history`,
          timestamp: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error('Risk API error:', error);
    return res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}
