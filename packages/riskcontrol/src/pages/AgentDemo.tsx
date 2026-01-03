/**
 * Multi-Agent Analysis Demo Page
 * 
 * 演示多 Agent 投资分析系统的功能
 */

import React, { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  Bot,
  Play,
  Loader2,
  ArrowLeft,
  Brain,
  TrendingUp,
  Shield,
  Globe,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useSupabasePortfolio } from '@/hooks/useSupabasePortfolio';
import {
  createMultiAgentService,
  type ProgressStatus,
  type AgentAlertEvent,
  type OrchestratorResult,
  type OrchestrationMode,
  type PortfolioState,
  type Position,
} from '@/services/agents';

// Agent 图标映射
const agentIcons: Record<string, React.ReactNode> = {
  'position-analyst': <TrendingUp className="w-4 h-4" />,
  'risk-analyst': <Shield className="w-4 h-4" />,
  'market-analyst': <Globe className="w-4 h-4" />,
  'advisor': <Sparkles className="w-4 h-4" />,
};

// Agent 名称映射
const agentNames: Record<string, string> = {
  'position-analyst': '持仓分析师',
  'risk-analyst': '风险分析师',
  'market-analyst': '市场分析师',
  'advisor': '投资顾问',
};

// 模式描述
const modeDescriptions: Record<OrchestrationMode, string> = {
  sequential: '顺序执行所有 Agent，完整分析',
  selector: 'LLM 动态选择下一个 Agent',
  handoff: 'Agent 之间显式交接控制权',
  respond_directly: '简单问题快速响应，复杂问题走完整流程',
};

// 进度状态类型
interface ProgressItem {
  agentId: string;
  phase: string;
  progress: number;
  message?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export default function AgentDemo() {
  const [, setLocation] = useLocation();
  const { stockPositions, dashboard, loading: portfolioLoading } = useSupabasePortfolio();
  
  // 状态
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<OrchestrationMode>('sequential');
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [alerts, setAlerts] = useState<AgentAlertEvent[]>([]);
  const [result, setResult] = useState<OrchestratorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  // 处理进度更新
  const handleProgress = useCallback((status: ProgressStatus) => {
    setProgress(prev => {
      // 查找是否已有该 agent 的进度
      const existingIndex = prev.findIndex(p => p.agentId === status.currentAgent);
      const newItem: ProgressItem = {
        agentId: status.currentAgent,
        phase: status.phase,
        progress: status.progress,
        message: status.message,
        status: status.progress >= 100 ? 'completed' : 'running',
      };
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newItem;
        return updated;
      }
      return [...prev, newItem];
    });
  }, []);

  // 处理告警
  const handleAlert = useCallback((alert: AgentAlertEvent) => {
    setAlerts(prev => [...prev, alert]);
  }, []);

  // 运行分析
  const runAnalysis = async () => {
    if (!stockPositions || stockPositions.length === 0) {
      setError('没有持仓数据，无法分析');
      return;
    }

    setIsRunning(true);
    setProgress([]);
    setAlerts([]);
    setResult(null);
    setError(null);

    try {
      // 构建 PortfolioState - 从 StockPosition 转换为 Position
      const positions: Position[] = stockPositions.map(p => ({
        ticker: p.ticker,
        weight: p.weight_percent || 0,
        marketValue: p.market_value,
        costBasis: p.avg_cost * p.quantity,
        unrealizedPnL: p.unrealized_pnl,
        market: p.market || 'US',
        sector: 'Unknown',
      }));

      const totalValue = dashboard?.net_worth_usd || positions.reduce((sum, p) => sum + p.marketValue, 0);

      const portfolioState: PortfolioState = {
        positions,
        totalValue,
        cashBalance: dashboard?.cash_usd || 0,
        marginLoan: dashboard?.margin_loan_usd || 0,
        highWaterMark: dashboard?.high_water_mark || totalValue,
        timestamp: Date.now(),
      };

      // 创建服务
      const service = createMultiAgentService({
        mode,
        enableMemory: true,
        enableAlerts: true,
        onProgress: handleProgress,
        onAlert: handleAlert,
      });

      // 执行分析
      const analysisResult = await service.analyze({
        portfolio: portfolioState,
        query: '请分析我的投资组合风险',
        mode,
      });

      setResult(analysisResult);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      setIsRunning(false);
    }
  };

  // 切换展开状态
  const toggleAgent = (agentId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  const totalValue = dashboard?.net_worth_usd || 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setLocation('/dashboard')}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Bot className="w-7 h-7 text-purple-400" />
              多 Agent 分析系统
            </h1>
            <p className="text-white/50 text-sm mt-1">
              协调多个 AI Agent 进行投资组合分析
            </p>
          </div>
        </div>

        {/* 控制面板 */}
        <Card className="bg-white/[0.02] border-white/10 p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* 模式选择 */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-white/50 mb-2 block">编排模式</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as OrchestrationMode)}
                disabled={isRunning}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="sequential">顺序模式 (Sequential)</option>
                <option value="respond_directly">快速响应 (Respond Directly)</option>
                <option value="selector">选择器模式 (Selector)</option>
                <option value="handoff">交接模式 (Handoff)</option>
              </select>
              <p className="text-xs text-white/30 mt-1">{modeDescriptions[mode]}</p>
            </div>

            {/* 运行按钮 */}
            <Button
              onClick={runAnalysis}
              disabled={isRunning || portfolioLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 h-auto"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  开始分析
                </>
              )}
            </Button>
          </div>

          {/* 持仓信息 */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-6 text-sm">
              <span className="text-white/50">
                持仓数量: <span className="text-white">{stockPositions?.length || 0}</span>
              </span>
              <span className="text-white/50">
                总市值: <span className="text-white">${totalValue.toLocaleString()}</span>
              </span>
            </div>
          </div>
        </Card>

        {/* 进度显示 */}
        {progress.length > 0 && (
          <Card className="bg-white/[0.02] border-white/10 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              执行进度
            </h3>
            <div className="space-y-3">
              {progress.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    p.status === 'completed' ? 'bg-emerald-500/20' :
                    p.status === 'running' ? 'bg-blue-500/20' :
                    p.status === 'error' ? 'bg-red-500/20' : 'bg-white/10'
                  )}>
                    {agentIcons[p.agentId] || <Bot className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {agentNames[p.agentId] || p.agentId}
                      </span>
                      <Badge variant={
                        p.status === 'completed' ? 'success' :
                        p.status === 'running' ? 'info' :
                        p.status === 'error' ? 'danger' : 'default'
                      }>
                        {p.status === 'completed' ? '完成' :
                         p.status === 'running' ? '运行中' :
                         p.status === 'error' ? '错误' : p.status}
                      </Badge>
                    </div>
                    {p.message && (
                      <p className="text-sm text-white/50">{p.message}</p>
                    )}
                    {/* 进度条 */}
                    <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-300",
                          p.status === 'completed' ? 'bg-emerald-500' :
                          p.status === 'running' ? 'bg-blue-500' : 'bg-white/30'
                        )}
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                  </div>
                  {p.status === 'running' && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  )}
                  {p.status === 'completed' && (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 告警显示 */}
        {alerts.length > 0 && (
          <Card className="bg-red-500/5 border-red-500/20 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              风险告警 ({alerts.length})
            </h3>
            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <div key={i} className="bg-red-500/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="danger">{alert.severity}</Badge>
                    <span className="font-medium">{alert.sourceAgent}</span>
                  </div>
                  <p className="text-sm text-white/70">{alert.message}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 错误显示 */}
        {error && (
          <Card className="bg-red-500/10 border-red-500/30 p-6 mb-6">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </Card>
        )}

        {/* 结果显示 */}
        {result && (
          <div className="space-y-6">
            {/* 最终报告 */}
            {result.finalReport && (
              <Card className="bg-white/[0.02] border-white/10 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  分析报告
                </h3>
                <div className="space-y-4">
                  {/* 风险等级 */}
                  <div className="flex items-center gap-4">
                    <span className="text-white/50">风险等级:</span>
                    <Badge variant={
                      result.finalReport.risk_level === 'LOW' ? 'success' :
                      result.finalReport.risk_level === 'MEDIUM' ? 'warning' :
                      result.finalReport.risk_level === 'HIGH' ? 'danger' : 'danger'
                    } className="text-base px-3 py-1">
                      {result.finalReport.risk_level}
                    </Badge>
                  </div>

                  {/* 摘要 */}
                  <div>
                    <h4 className="text-sm text-white/50 mb-2">摘要</h4>
                    <p className="text-white/80 whitespace-pre-wrap">
                      {result.finalReport.summary}
                    </p>
                  </div>

                  {/* 行动计划 */}
                  {result.finalReport.action_plan && (
                    <div>
                      <h4 className="text-sm text-white/50 mb-2">行动计划</h4>
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-white/80 whitespace-pre-wrap">
                          {result.finalReport.action_plan}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 建议 */}
                  <div className="flex items-center gap-4">
                    <span className="text-white/50">建议:</span>
                    <Badge variant={
                      result.finalReport.recommendation === 'BUY' ? 'success' :
                      result.finalReport.recommendation === 'SELL' ? 'danger' :
                      result.finalReport.recommendation === 'HOLD' ? 'info' : 'warning'
                    }>
                      {result.finalReport.recommendation}
                    </Badge>
                  </div>
                </div>
              </Card>
            )}

            {/* Agent 详细结果 */}
            <Card className="bg-white/[0.02] border-white/10 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-400" />
                Agent 执行详情
              </h3>
              <div className="space-y-3">
                {result.executionTrace.agentTraces.map((agent, i) => (
                  <div key={i} className="border border-white/10 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleAgent(agent.agentId)}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                          {agentIcons[agent.agentId] || <Bot className="w-4 h-4" />}
                        </div>
                        <span className="font-medium">
                          {agentNames[agent.agentId] || agent.agentId}
                        </span>
                        <Badge variant={agent.status === 'success' ? 'success' : 'danger'}>
                          {agent.status}
                        </Badge>
                        <span className="text-sm text-white/50">
                          {agent.durationMs}ms
                        </span>
                      </div>
                      {expandedAgents.has(agent.agentId) ? (
                        <ChevronUp className="w-4 h-4 text-white/50" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-white/50" />
                      )}
                    </button>
                    {expandedAgents.has(agent.agentId) && (
                      <div className="p-4 pt-0 border-t border-white/10">
                        <div className="text-sm text-white/60 space-y-2">
                          <p>Tokens: {agent.tokensUsed}</p>
                          <p>数据源: {agent.dataSources.join(', ') || '无'}</p>
                          {agent.error && (
                            <p className="text-red-400">错误: {agent.error}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 执行统计 */}
              <div className="mt-4 pt-4 border-t border-white/10 text-sm text-white/50">
                <span>总耗时: {result.executionTrace.totalDurationMs}ms</span>
                <span className="mx-4">|</span>
                <span>模式: {result.mode}</span>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
