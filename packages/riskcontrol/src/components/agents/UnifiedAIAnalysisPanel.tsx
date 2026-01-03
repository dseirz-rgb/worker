/**
 * UnifiedAIAnalysisPanel - AI Analysis Panel using Unified Intelligence
 *
 * Refactored AI analysis panel that uses the Unified Intelligence Service
 * for multi-agent analysis with progress tracking and alert integration.
 *
 * @module components/agents/UnifiedAIAnalysisPanel
 * @see {@link .kiro/specs/unified-intelligence/design.md}
 * @see Requirements 4.1, 4.2, 4.3, 4.5
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUnifiedIntelligence } from '@/hooks/useUnifiedIntelligence';
import { AgentProgressBar } from './AgentProgressBar';
import { AgentResultsAccordion } from './AgentResultsAccordion';
import type { PortfolioState, AgentAlertEvent } from '@/services/agents/types';
import type { RiskMetrics } from '@/services/riskMetricsService';

// =============================================================================
// Types
// =============================================================================

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface UnifiedAIAnalysisPanelProps {
  /** Risk metrics for context */
  riskMetrics: RiskMetrics | null;
  /** Risk thresholds for context */
  thresholds: Record<string, number> | null;
  /** Breaker summary for context */
  breakerSummary: {
    tradingAllowed: boolean;
    activeBreakers: Array<{ type: string; result: { triggered: boolean; reason: string } }>;
  } | null;
  /** Dashboard data for portfolio construction */
  dashboard: {
    net_worth_cny?: number;
    leverage_ratio?: number;
    long_ratio?: number;
    margin_loan?: number;
    cash_balance?: number;
  } | null;
  /** Historical data */
  history: Array<{
    date: string;
    net_worth_cny: number;
    daily_pnl_percent?: number;
  }>;
  /** Callback when alerts are triggered */
  onAlert?: (alert: AgentAlertEvent) => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * UnifiedAIAnalysisPanel provides AI-powered risk analysis using the
 * Unified Intelligence Service with multi-agent orchestration.
 *
 * Features:
 * - Multi-agent deep analysis with progress tracking
 * - Agent results accordion display
 * - Alert integration with risk log
 * - Follow-up question support
 * - Quick question suggestions
 */
export function UnifiedAIAnalysisPanel({
  riskMetrics,
  thresholds,
  breakerSummary,
  dashboard,
  history,
  onAlert,
}: UnifiedAIAnalysisPanelProps) {
  // Local state
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAgentResults, setShowAgentResults] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Unified Intelligence hook
  const {
    deepAnalyze,
    query,
    isProcessing,
    mode,
    progress,
    result,
    error,
    agentResults,
    currentAgent,
    alerts,
    reset,
  } = useUnifiedIntelligence({
    enableProgress: true,
    onAlert: (alert) => {
      onAlert?.(alert);
      toast.warning(alert.title, {
        description: alert.message,
      });
    },
    onError: (err) => {
      toast.error('分析失败', {
        description: err.message,
      });
    },
  });

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Update messages when result changes
  useEffect(() => {
    if (result && result.text) {
      setMessages((prev) => {
        // Check if last message is from assistant and empty (placeholder)
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'assistant' && !lastMsg.content) {
          return [
            ...prev.slice(0, -1),
            { role: 'assistant', content: result.text, timestamp: new Date() },
          ];
        }
        // Otherwise add new message
        if (!prev.some((m) => m.content === result.text)) {
          return [
            ...prev,
            { role: 'assistant', content: result.text, timestamp: new Date() },
          ];
        }
        return prev;
      });
    }
  }, [result]);

  // Build portfolio state from dashboard data
  const buildPortfolioState = useCallback((): PortfolioState => {
    const currentNAV = Number(dashboard?.net_worth_cny) || 0;
    const marginLoan = Number(dashboard?.margin_loan) || 0;
    const cashBalance = Number(dashboard?.cash_balance) || 0;

    // Get high water mark from history
    const hwm = history?.reduce((max, h) => {
      const nav = Number(h.net_worth_cny) || 0;
      return nav > max ? nav : max;
    }, 0) || currentNAV;

    return {
      positions: [], // Will be populated by agents from data sources
      totalValue: currentNAV,
      cashBalance,
      marginLoan,
      highWaterMark: hwm,
      timestamp: Date.now(),
    };
  }, [dashboard, history]);

  // Build risk context string for follow-up questions
  const buildRiskContext = useCallback(() => {
    if (!riskMetrics || !thresholds) return '';

    return `
当前风控状态:
- 综合风险评分: ${riskMetrics.overallRiskScore.toFixed(0)}/100
- 杠杆率: ${riskMetrics.currentLeverage.toFixed(2)}x
- 月度回撤: ${riskMetrics.monthlyDrawdown.toFixed(2)}%
- 连败天数: ${riskMetrics.currentLosingStreak}天
- 交易状态: ${breakerSummary?.tradingAllowed ? '允许' : '禁止'}
`;
  }, [riskMetrics, thresholds, breakerSummary]);

  // Start deep analysis
  const handleStartAnalysis = useCallback(async () => {
    setIsExpanded(true);
    setMessages([]);
    reset();

    // Add user message
    setMessages([
      { role: 'user', content: '请对我的投资组合进行深度风控分析', timestamp: new Date() },
    ]);

    // Add placeholder for assistant response
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '', timestamp: new Date() },
    ]);

    const portfolio = buildPortfolioState();
    await deepAnalyze(portfolio, '深度风控分析');
  }, [buildPortfolioState, deepAnalyze, reset]);

  // Send follow-up message
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // Add user message
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage, timestamp: new Date() },
    ]);

    // Add placeholder for assistant response
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '', timestamp: new Date() },
    ]);

    // Query with context
    await query(userMessage, {
      portfolio: buildPortfolioState(),
      userPreferences: { language: 'zh' },
    });
  }, [inputValue, isProcessing, query, buildPortfolioState]);

  // Quick questions
  const quickQuestions = [
    '当前最大的风险是什么？',
    '我应该降低杠杆吗？',
    '连败期间应该怎么操作？',
    '如何优化风控配置？',
  ];

  // Completed agents for progress bar
  const completedAgents = Array.from(agentResults.keys());

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-5',
        'bg-gradient-to-br from-purple-500/10 to-purple-500/5',
        'border border-purple-500/30'
      )}
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/20 rounded-full blur-[60px]" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Sparkles className="text-purple-400" size={20} />
            </div>
            AI 风控分析
            {mode !== 'idle' && (
              <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
                {mode === 'full_agent' ? '多智能体' : mode === 'rag_agent' ? 'RAG+Agent' : 'RAG'}
              </span>
            )}
          </h3>
          <button
            onClick={handleStartAnalysis}
            disabled={isProcessing || !riskMetrics}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300',
              'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                {messages.length > 0 ? '重新分析' : '开始分析'}
              </>
            )}
          </button>
        </div>

        {/* Initial state */}
        {!isExpanded && messages.length === 0 && (
          <p className="text-sm text-white/50">
            点击"开始分析"启动多智能体深度风控分析，AI 将从持仓、风险、市场等多个维度为您提供专业建议。
          </p>
        )}

        {/* Progress bar during analysis */}
        {isProcessing && mode === 'full_agent' && (
          <div className="mb-4">
            <AgentProgressBar
              progress={progress}
              currentAgent={currentAgent}
              completedAgents={completedAgents}
            />
          </div>
        )}

        {/* Expanded content */}
        {(isExpanded || messages.length > 0) && (
          <div className="space-y-4">
            {/* Agent results accordion */}
            {agentResults.size > 0 && (
              <div>
                <button
                  onClick={() => setShowAgentResults(!showAgentResults)}
                  className="flex items-center gap-2 text-sm text-white/60 hover:text-white/80 mb-2"
                >
                  {showAgentResults ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  智能体分析详情
                </button>
                {showAgentResults && (
                  <AgentResultsAccordion
                    results={agentResults}
                    defaultExpanded={['advisor']}
                    showMetadata={true}
                    compact={false}
                  />
                )}
              </div>
            )}

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="space-y-2">
                {alerts.map((alert, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3 rounded-xl flex items-start gap-3',
                      alert.severity === 'critical'
                        ? 'bg-red-500/10 border border-red-500/30'
                        : alert.severity === 'warning'
                        ? 'bg-amber-500/10 border border-amber-500/30'
                        : 'bg-cyan-500/10 border border-cyan-500/30'
                    )}
                  >
                    <AlertTriangle
                      size={16}
                      className={cn(
                        'mt-0.5',
                        alert.severity === 'critical'
                          ? 'text-red-400'
                          : alert.severity === 'warning'
                          ? 'text-amber-400'
                          : 'text-cyan-400'
                      )}
                    />
                    <div>
                      <span
                        className={cn(
                          'font-medium text-sm',
                          alert.severity === 'critical'
                            ? 'text-red-400'
                            : alert.severity === 'warning'
                            ? 'text-amber-400'
                            : 'text-cyan-400'
                        )}
                      >
                        {alert.title}
                      </span>
                      <p className="text-xs text-white/60 mt-1">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Messages */}
            <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Bot size={16} className="text-purple-400" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] p-3 rounded-xl text-sm',
                      msg.role === 'user'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'bg-white/[0.05] text-white/80'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      msg.content ? (
                        <div
                          className="prose prose-sm prose-invert max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: msg.content
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/\n/g, '<br/>')
                              .replace(/- /g, '• '),
                          }}
                        />
                      ) : (
                        <Loader2 size={16} className="animate-spin text-purple-400" />
                      )
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
                      <User size={16} className="text-cyan-400" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick questions */}
            {messages.length > 0 && !isProcessing && (
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputValue(q);
                      inputRef.current?.focus();
                    }}
                    className="text-xs px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] rounded-full transition-colors text-white/60 hover:text-white/80"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            {messages.length > 0 && (
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="追问 AI..."
                  disabled={isProcessing}
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-xl text-sm',
                    'bg-white/[0.05] border border-white/[0.08]',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/30',
                    'placeholder:text-white/30 text-white',
                    'disabled:opacity-50'
                  )}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isProcessing || !inputValue.trim()}
                  className={cn(
                    'px-4 py-2.5 rounded-xl transition-all duration-300',
                    'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Send size={16} />
                </button>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                分析出错: {error.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default UnifiedAIAnalysisPanel;
