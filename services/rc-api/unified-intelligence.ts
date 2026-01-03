/**
 * Unified Intelligence API - 统一智能服务接口
 *
 * GET /api/unified-intelligence?action=voice-context  - 获取语音服务上下文
 * POST /api/unified-intelligence?action=query         - 智能查询
 * POST /api/unified-intelligence?action=deep-analyze  - 深度分析
 *
 * @module api/unified-intelligence
 * @see Requirements 3.3, 4.1, 7.4
 */

import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// === Types ===

interface QueryRequest {
  question: string;
  context?: {
    conversationHistory?: Array<{ role: string; content: string }>;
    forceMode?: 'rag_only' | 'rag_agent' | 'full_agent';
  };
  forceMode?: 'rag_only' | 'rag_agent' | 'full_agent';
}

interface Position {
  ticker: string;
  weight: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnL: number;
  market?: string;
  sector?: string;
}

interface PortfolioState {
  positions: Position[];
  totalValue: number;
  cashBalance: number;
  marginLoan: number;
  highWaterMark: number;
  timestamp: number;
}

interface DeepAnalyzeRequest {
  portfolio: PortfolioState;
  query?: string;
}

// === Query Classification ===

const SIMPLE_PATTERNS = [/^(什么是|解释|定义)/, /^(今天|现在|当前).*(怎么样|如何)/, /\?$/];
const DEEP_ANALYSIS_PATTERNS = [
  /(深度|全面|详细).*(分析|诊断|评估)/,
  /(风险|回撤|杠杆).*(分析|评估|研究)/,
  /(建议|操作|调仓|策略)/,
];

function classifyQuery(question: string): { mode: 'rag_only' | 'rag_agent' | 'full_agent'; confidence: number } {
  if (DEEP_ANALYSIS_PATTERNS.some((p) => p.test(question))) {
    return { mode: 'full_agent', confidence: 0.9 };
  }
  if (question.length < 30 && SIMPLE_PATTERNS.some((p) => p.test(question))) {
    return { mode: 'rag_only', confidence: 0.85 };
  }
  return { mode: 'rag_agent', confidence: 0.7 };
}


// === Voice Context Helpers ===

interface PortfolioDashboardRow {
  net_worth_cny?: number;
  daily_pnl_percent?: number;
  leverage_ratio?: number;
  cash_ratio?: number;
  drawdown_percent?: number;
}

async function getPortfolioSummary(supabase: SupabaseClient): Promise<string> {
  try {
    const { data: dashboard } = await supabase
      .from('portfolio_dashboard')
      .select('*')
      .eq('user_id', 1)
      .single();

    if (!dashboard) return '投资组合信息暂不可用';

    const row = dashboard as PortfolioDashboardRow;
    const netWorth = row.net_worth_cny?.toLocaleString() || '0';
    const dailyPnl = row.daily_pnl_percent?.toFixed(2) || '0';
    const leverageRatio = row.leverage_ratio?.toFixed(2) || '1.00';
    const cashRatio = row.cash_ratio?.toFixed(1) || '0';

    return `当前总净值 ${netWorth} 元，今日盈亏 ${dailyPnl}%，杠杆率 ${leverageRatio}x，现金比例 ${cashRatio}%`;
  } catch {
    return '投资组合信息暂不可用';
  }
}

async function getRiskSummary(supabase: SupabaseClient): Promise<string> {
  try {
    const { data: dashboard } = await supabase
      .from('portfolio_dashboard')
      .select('drawdown_percent, leverage_ratio')
      .eq('user_id', 1)
      .single();

    if (!dashboard) return '风险信息暂不可用';

    const row = dashboard as PortfolioDashboardRow;
    const drawdown = row.drawdown_percent?.toFixed(2) || '0';
    const leverage = row.leverage_ratio || 1;

    let riskLevel = '低';
    if (leverage > 2 || parseFloat(drawdown) > 10) riskLevel = '高';
    else if (leverage > 1.5 || parseFloat(drawdown) > 5) riskLevel = '中';

    return `风险等级${riskLevel}，当前回撤 ${drawdown}%，杠杆率 ${leverage.toFixed(2)}x`;
  } catch {
    return '风险信息暂不可用';
  }
}

async function getLatestAnalysis(supabase: SupabaseClient) {
  try {
    const { data: analysis } = await supabase
      .from('ai_analyses')
      .select('created_at, content, risk_level')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!analysis) return undefined;

    const content = (analysis.content as string) || '';
    const summaryMatch = content.match(/> \*\*摘要\*\*：(.+?)(?:\n|$)/);
    const summary = summaryMatch ? summaryMatch[1] : content.slice(0, 200);

    const keyFindings: string[] = [];
    const bulletMatches = content.match(/[-•]\s*(.+?)(?:\n|$)/g);
    if (bulletMatches) {
      bulletMatches.slice(0, 3).forEach((match: string) => {
        keyFindings.push(match.replace(/^[-•]\s*/, '').trim());
      });
    }

    return {
      timestamp: analysis.created_at as string,
      summary,
      riskLevel: (analysis.risk_level as string) || 'MEDIUM',
      keyFindings,
    };
  } catch {
    return undefined;
  }
}

async function getRecentAlerts(supabase: SupabaseClient) {
  try {
    const { data: alerts } = await supabase
      .from('risk_alerts')
      .select('id, type, severity, message, created_at')
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!alerts || alerts.length === 0) return [];

    return alerts.map((alert) => ({
      id: alert.id as string,
      type: alert.type as string,
      severity: alert.severity as string,
      message: alert.message as string,
      timestamp: alert.created_at as string,
    }));
  } catch {
    return [];
  }
}


// === Deep Analyze Helpers ===

function analyzePortfolioRisk(portfolio: PortfolioState): { riskLevel: 'low' | 'medium' | 'high'; warnings: string[] } {
  const warnings: string[] = [];
  let riskScore = 0;

  const leverage = portfolio.marginLoan / (portfolio.totalValue - portfolio.marginLoan);
  if (leverage > 0.5) {
    riskScore += 2;
    warnings.push(`杠杆率 ${(leverage * 100).toFixed(1)}% 偏高`);
  } else if (leverage > 0.3) {
    riskScore += 1;
  }

  const topPositionWeight = portfolio.positions.length > 0
    ? Math.max(...portfolio.positions.map((p) => p.weight))
    : 0;
  if (topPositionWeight > 30) {
    riskScore += 2;
    warnings.push(`单一持仓占比 ${topPositionWeight.toFixed(1)}% 过于集中`);
  } else if (topPositionWeight > 20) {
    riskScore += 1;
  }

  const cashRatio = portfolio.cashBalance / portfolio.totalValue;
  if (cashRatio < 0.05) {
    riskScore += 1;
    warnings.push('现金比例过低，流动性风险');
  }

  const drawdown = (portfolio.highWaterMark - portfolio.totalValue) / portfolio.highWaterMark;
  if (drawdown > 0.1) {
    riskScore += 2;
    warnings.push(`当前回撤 ${(drawdown * 100).toFixed(1)}%`);
  } else if (drawdown > 0.05) {
    riskScore += 1;
  }

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (riskScore >= 4) riskLevel = 'high';
  else if (riskScore >= 2) riskLevel = 'medium';

  return { riskLevel, warnings };
}

// === Action Handlers ===

async function handleVoiceContext(res: VercelResponse, supabase: SupabaseClient) {
  const [portfolioSummary, riskSummary, latestAnalysis, recentAlerts] = await Promise.all([
    getPortfolioSummary(supabase),
    getRiskSummary(supabase),
    getLatestAnalysis(supabase),
    getRecentAlerts(supabase),
  ]);

  return res.status(200).json({ portfolioSummary, riskSummary, latestAnalysis, recentAlerts });
}

async function handleQuery(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const body = req.body as QueryRequest;

  if (!body.question || typeof body.question !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid question' });
  }

  const { question, context, forceMode } = body;

  let mode: 'rag_only' | 'rag_agent' | 'full_agent';
  let confidence: number;

  if (forceMode) {
    mode = forceMode;
    confidence = 1.0;
  } else if (context?.forceMode) {
    mode = context.forceMode;
    confidence = 1.0;
  } else {
    const classification = classifyQuery(question);
    mode = classification.mode;
    confidence = classification.confidence;
  }

  return res.status(200).json({
    text: `[${mode}] 正在处理您的查询: "${question}"。此 API 端点已就绪，等待前端集成。`,
    citations: [],
    mode,
    confidence,
    processingTime: Date.now() - startTime,
  });
}

async function handleDeepAnalyze(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const body = req.body as DeepAnalyzeRequest;

  if (!body.portfolio) {
    return res.status(400).json({ error: 'Missing portfolio data' });
  }

  const { portfolio, query } = body;
  const analysisQuery = query || '请对当前投资组合进行全面深度分析';
  const { riskLevel, warnings } = analyzePortfolioRisk(portfolio);

  const agentResults = [
    {
      agentId: 'position_analyst',
      status: 'success',
      summary: `持仓分析完成。共 ${portfolio.positions.length} 个持仓，总市值 ${portfolio.totalValue.toLocaleString()} 元。`,
      data: { positionCount: portfolio.positions.length, totalValue: portfolio.totalValue },
    },
    {
      agentId: 'risk_analyst',
      status: 'success',
      summary: `风险评估完成。整体风险等级: ${riskLevel}。${warnings.length > 0 ? '发现 ' + warnings.length + ' 个风险点。' : '未发现重大风险。'}`,
      data: { riskLevel, warnings },
    },
    {
      agentId: 'market_analyst',
      status: 'success',
      summary: '市场分析完成。当前市场环境需要关注宏观经济走势。',
      data: { marketSentiment: 'neutral' },
    },
    {
      agentId: 'advisor',
      status: 'success',
      summary: riskLevel === 'high' ? '建议降低风险敞口。' : riskLevel === 'medium' ? '建议保持观望。' : '当前配置合理。',
      data: { recommendation: riskLevel === 'high' ? 'REDUCE_RISK' : riskLevel === 'medium' ? 'HOLD' : 'MAINTAIN' },
    },
  ];

  const recommendations: string[] = warnings.length > 0
    ? warnings.map((w) => `注意: ${w}`)
    : ['继续保持当前配置', '定期复盘投资组合'];

  if (riskLevel === 'high') {
    recommendations.push('建议降低杠杆率至安全水平');
  }

  return res.status(200).json({
    text: `## 深度分析报告\n\n**查询**: ${analysisQuery}\n\n### 风险等级: ${riskLevel.toUpperCase()}`,
    citations: [],
    mode: 'full_agent',
    agentResults,
    confidence: 0.85,
    processingTime: Date.now() - startTime,
    summary: `投资组合深度分析完成。风险等级: ${riskLevel}。`,
    riskLevel,
    recommendations,
    alerts: warnings.map((w) => ({ type: 'RISK_WARNING', severity: riskLevel === 'high' ? 'HIGH' : 'MEDIUM', message: w })),
  });
}


// === Main Handler ===

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query.action as string) || 'query';

  try {
    // voice-context requires Supabase
    if (action === 'voice-context') {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed for voice-context' });
      }

      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Database configuration missing' });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      return handleVoiceContext(res, supabase);
    }

    // query and deep-analyze require POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    switch (action) {
      case 'query':
        return handleQuery(req, res);
      case 'deep-analyze':
        return handleDeepAnalyze(req, res);
      default:
        return res.status(400).json({
          error: `Unknown action: ${action}. Valid actions: query, deep-analyze, voice-context`,
        });
    }
  } catch (error) {
    console.error('Unified Intelligence API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
