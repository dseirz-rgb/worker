import React, { useState, useMemo } from 'react';
import { 
  Brain, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Target,
  Shield,
  Zap,
  BarChart3,
  Clock,
  Lightbulb,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Card, Badge, Button, Modal } from '../ui';
import { analyzeStrategy, type StrategyAnalysis as StrategyAnalysisType, type RiskPoint, type Suggestion } from '../../services/strategyAnalysis';
import type { Transaction, TradingStats, PortfolioState, NetWorthRecord } from '../../types';

interface StrategyAnalysisProps {
  transactions: Transaction[];
  tradingStats: TradingStats;
  portfolioState: PortfolioState;
  netWorthHistory: NetWorthRecord[];
}

export function StrategyAnalysisCard({ 
  transactions, 
  tradingStats, 
  portfolioState, 
  netWorthHistory 
}: StrategyAnalysisProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRiskPoint, setSelectedRiskPoint] = useState<RiskPoint | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 执行分析
  const analysis = useMemo(() => {
    return analyzeStrategy(transactions, tradingStats, portfolioState, netWorthHistory);
  }, [transactions, tradingStats, portfolioState, netWorthHistory, refreshKey]);

  // 刷新分析
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setRefreshKey(k => k + 1);
      setIsRefreshing(false);
    }, 500);
  };

  // 获取评分颜色
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-accent-green';
    if (score >= 60) return 'text-accent-yellow';
    if (score >= 40) return 'text-accent-orange';
    return 'text-accent-red';
  };

  // 获取风险等级颜色
  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-accent-green/20 text-accent-green';
      case 'medium': return 'bg-accent-yellow/20 text-accent-yellow';
      case 'high': return 'bg-accent-orange/20 text-accent-orange';
      case 'critical': return 'bg-accent-red/20 text-accent-red';
      default: return 'bg-bg-tertiary text-text-secondary';
    }
  };

  // 获取严重程度图标
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle size={16} className="text-accent-red" />;
      case 'high': return <AlertTriangle size={16} className="text-accent-orange" />;
      case 'medium': return <AlertCircle size={16} className="text-accent-yellow" />;
      case 'low': return <CheckCircle size={16} className="text-accent-green" />;
      default: return null;
    }
  };

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-accent-red/20 text-accent-red border-accent-red/30';
      case 'important': return 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30';
      case 'recommended': return 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30';
      default: return 'bg-bg-tertiary text-text-secondary';
    }
  };

  const riskLevelText = {
    low: '低风险',
    medium: '中等风险',
    high: '高风险',
    critical: '极高风险',
  };

  return (
    <>
      <Card className="relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-accent-cyan/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4 relative">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-accent-cyan" />
            <span className="text-sm font-medium text-text-primary">策略分析</span>
            <Badge variant={analysis.summary.riskLevel === 'low' ? 'success' : analysis.summary.riskLevel === 'critical' ? 'danger' : 'warning'}>
              {riskLevelText[analysis.summary.riskLevel]}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="刷新分析"
            >
              <RefreshCw size={14} />
            </button>
            <button
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* 综合评分 */}
        <div className="flex items-center gap-6 mb-4">
          <div className="flex-shrink-0">
            <div className={`text-4xl font-bold mono-nums ${getScoreColor(analysis.summary.overallScore)}`}>
              {analysis.summary.overallScore}
            </div>
            <div className="text-xs text-text-muted">综合评分</div>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-accent-yellow" />
              <span className="text-sm text-text-secondary">主要问题</span>
            </div>
            <div className="text-sm text-text-primary font-medium">
              {analysis.summary.mainIssue}
            </div>
          </div>
        </div>

        {/* 关键指标 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-2 bg-bg-tertiary rounded-lg text-center">
            <div className={`text-lg font-bold mono-nums ${analysis.metrics.winRate >= 45 ? 'text-accent-green' : 'text-accent-red'}`}>
              {analysis.metrics.winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-text-muted">胜率</div>
          </div>
          <div className="p-2 bg-bg-tertiary rounded-lg text-center">
            <div className={`text-lg font-bold mono-nums ${analysis.metrics.profitFactor >= 1 ? 'text-accent-green' : 'text-accent-red'}`}>
              {analysis.metrics.profitFactor.toFixed(2)}
            </div>
            <div className="text-xs text-text-muted">盈亏比</div>
          </div>
          <div className="p-2 bg-bg-tertiary rounded-lg text-center">
            <div className={`text-lg font-bold mono-nums ${analysis.metrics.maxDrawdown < 10 ? 'text-accent-green' : 'text-accent-red'}`}>
              {analysis.metrics.maxDrawdown.toFixed(1)}%
            </div>
            <div className="text-xs text-text-muted">最大回撤</div>
          </div>
        </div>

        {/* 风险点摘要 */}
        {analysis.riskPoints.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Shield size={12} />
              风险点 ({analysis.riskPoints.length})
            </div>
            {analysis.riskPoints.slice(0, isExpanded ? undefined : 3).map((rp) => (
              <div
                key={rp.id}
                className="p-2 bg-bg-tertiary rounded-lg hover:bg-bg-tertiary/80 transition-colors cursor-pointer"
                onClick={() => setSelectedRiskPoint(rp)}
              >
                <div className="flex items-center gap-2">
                  {getSeverityIcon(rp.severity)}
                  <span className="text-sm text-text-primary flex-1">{rp.title}</span>
                  <Badge variant={rp.severity === 'critical' ? 'danger' : rp.severity === 'high' ? 'warning' : 'default'}>
                    {rp.dataPoint}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 展开后显示改进建议 */}
        {isExpanded && analysis.suggestions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <div className="text-xs text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Lightbulb size={12} />
              改进建议 ({analysis.suggestions.length})
            </div>
            {analysis.suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors hover:opacity-80 ${getPriorityColor(suggestion.priority)}`}
                onClick={() => setSelectedSuggestion(suggestion)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{suggestion.title}</span>
                  <Badge variant={suggestion.priority === 'urgent' ? 'danger' : suggestion.priority === 'important' ? 'warning' : 'info'}>
                    {suggestion.priority === 'urgent' ? '紧急' : suggestion.priority === 'important' ? '重要' : '建议'}
                  </Badge>
                </div>
                <p className="text-xs opacity-80">{suggestion.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* 展开/收起提示 */}
        {!isExpanded && (analysis.riskPoints.length > 3 || analysis.suggestions.length > 0) && (
          <button
            className="w-full mt-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
            onClick={() => setIsExpanded(true)}
          >
            展开查看更多分析 ({analysis.riskPoints.length} 个风险点, {analysis.suggestions.length} 条建议)
          </button>
        )}

        {/* 更新时间 */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            分析时间: {new Date(analysis.timestamp).toLocaleString('zh-CN')}
          </span>
          <span>基于 {transactions.filter(t => ['BUY', 'SELL'].includes(t.action)).length} 笔交易</span>
        </div>
      </Card>

      {/* 风险点详情弹窗 */}
      <Modal
        isOpen={!!selectedRiskPoint}
        onClose={() => setSelectedRiskPoint(null)}
        title="风险点详情"
        size="md"
      >
        {selectedRiskPoint && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-bg-tertiary rounded-lg">
              {getSeverityIcon(selectedRiskPoint.severity)}
              <div>
                <div className="text-lg font-bold text-text-primary">{selectedRiskPoint.title}</div>
                <Badge variant={selectedRiskPoint.severity === 'critical' ? 'danger' : selectedRiskPoint.severity === 'high' ? 'warning' : 'default'}>
                  {selectedRiskPoint.severity === 'critical' ? '严重' : selectedRiskPoint.severity === 'high' ? '高' : selectedRiskPoint.severity === 'medium' ? '中' : '低'}
                </Badge>
              </div>
            </div>

            <div className="p-4 bg-bg-tertiary rounded-lg">
              <div className="text-xs text-text-muted mb-2">问题描述</div>
              <p className="text-sm text-text-primary">{selectedRiskPoint.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-bg-tertiary rounded-lg">
                <div className="text-xs text-text-muted mb-1">当前数据</div>
                <div className="text-sm font-medium text-accent-red">{selectedRiskPoint.dataPoint}</div>
              </div>
              <div className="p-3 bg-bg-tertiary rounded-lg">
                <div className="text-xs text-text-muted mb-1">健康基准</div>
                <div className="text-sm font-medium text-accent-green">{selectedRiskPoint.benchmark}</div>
              </div>
            </div>

            <div className="p-4 border border-accent-yellow/30 bg-accent-yellow/5 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-accent-yellow" />
                <span className="text-sm font-medium text-accent-yellow">潜在影响</span>
              </div>
              <p className="text-sm text-text-secondary">{selectedRiskPoint.impact}</p>
            </div>

            <Button variant="secondary" className="w-full" onClick={() => setSelectedRiskPoint(null)}>
              关闭
            </Button>
          </div>
        )}
      </Modal>

      {/* 建议详情弹窗 */}
      <Modal
        isOpen={!!selectedSuggestion}
        onClose={() => setSelectedSuggestion(null)}
        title="改进建议"
        size="md"
      >
        {selectedSuggestion && (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border ${getPriorityColor(selectedSuggestion.priority)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold">{selectedSuggestion.title}</span>
                <Badge variant={selectedSuggestion.priority === 'urgent' ? 'danger' : selectedSuggestion.priority === 'important' ? 'warning' : 'info'}>
                  {selectedSuggestion.priority === 'urgent' ? '紧急' : selectedSuggestion.priority === 'important' ? '重要' : '建议'}
                </Badge>
              </div>
              <p className="text-sm opacity-80">{selectedSuggestion.description}</p>
            </div>

            <div className="p-4 bg-bg-tertiary rounded-lg">
              <div className="text-xs text-text-muted mb-3">行动清单</div>
              <ul className="space-y-2">
                {selectedSuggestion.actionItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-text-primary">
                    <CheckCircle size={14} className="text-accent-cyan mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 border border-accent-green/30 bg-accent-green/5 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target size={16} className="text-accent-green" />
                <span className="text-sm font-medium text-accent-green">预期效果</span>
              </div>
              <p className="text-sm text-text-secondary">{selectedSuggestion.expectedOutcome}</p>
            </div>

            <Button variant="secondary" className="w-full" onClick={() => setSelectedSuggestion(null)}>
              关闭
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
