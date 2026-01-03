/**
 * AgentResultsAccordion - Expandable Agent Results Display
 *
 * Displays results from each agent in expandable sections with
 * summary, key findings, and status indicators.
 *
 * @module components/agents/AgentResultsAccordion
 * @see {@link .kiro/specs/unified-intelligence/design.md} for design details
 * @see Requirements 4.3
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Shield,
  Globe,
  Lightbulb,
  Zap,
} from 'lucide-react';
import type { AgentResult, AgentResultStatus } from '@/services/agents/types';

// Agent configuration with icons and display names
const AGENT_CONFIG: Record<
  string,
  { name: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  position_analyst: {
    name: '持仓分析师',
    icon: <TrendingUp size={16} />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
  },
  risk_analyst: {
    name: '风险分析师',
    icon: <Shield size={16} />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
  },
  market_analyst: {
    name: '市场分析师',
    icon: <Globe size={16} />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
  },
  web_surfer: {
    name: '网络搜索',
    icon: <Globe size={16} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  advisor: {
    name: '投资顾问',
    icon: <Lightbulb size={16} />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
};

// Status configuration
const STATUS_CONFIG: Record<
  AgentResultStatus,
  { icon: React.ReactNode; color: string; label: string }
> = {
  success: {
    icon: <CheckCircle size={14} />,
    color: 'text-emerald-400',
    label: '完成',
  },
  partial: {
    icon: <AlertTriangle size={14} />,
    color: 'text-amber-400',
    label: '部分完成',
  },
  failed: {
    icon: <XCircle size={14} />,
    color: 'text-red-400',
    label: '失败',
  },
};

interface AgentResultsAccordionProps {
  /** Map of agent results keyed by agent ID */
  results: Map<string, AgentResult>;
  /** Initially expanded agent IDs */
  defaultExpanded?: string[];
  /** Show execution metadata */
  showMetadata?: boolean;
  /** Compact mode */
  compact?: boolean;
}

/**
 * AgentResultsAccordion displays agent analysis results in expandable sections.
 *
 * Features:
 * - Expandable sections for each agent
 * - Summary and key findings display
 * - Status indicators (success/partial/failed)
 * - Agent icons and colors
 * - Execution metadata (time, tokens, data sources)
 *
 * @example
 * ```tsx
 * <AgentResultsAccordion
 *   results={agentResults}
 *   defaultExpanded={['advisor']}
 *   showMetadata={true}
 * />
 * ```
 */
export function AgentResultsAccordion({
  results,
  defaultExpanded = [],
  showMetadata = true,
  compact = false,
}: AgentResultsAccordionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(defaultExpanded)
  );

  const toggleExpanded = (agentId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(Array.from(results.keys())));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  if (results.size === 0) {
    return (
      <div className="text-center py-8 text-white/40">
        <Clock size={32} className="mx-auto mb-2 opacity-50" />
        <p>暂无分析结果</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header with expand/collapse controls */}
      {!compact && results.size > 1 && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-white/50">
            {results.size} 个智能体分析结果
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              全部展开
            </button>
            <span className="text-white/20">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              全部收起
            </button>
          </div>
        </div>
      )}

      {/* Agent result items */}
      {Array.from(results.entries()).map(([agentId, result]) => (
        <AgentResultItem
          key={agentId}
          agentId={agentId}
          result={result}
          isExpanded={expandedIds.has(agentId)}
          onToggle={() => toggleExpanded(agentId)}
          showMetadata={showMetadata}
          compact={compact}
        />
      ))}
    </div>
  );
}

interface AgentResultItemProps {
  agentId: string;
  result: AgentResult;
  isExpanded: boolean;
  onToggle: () => void;
  showMetadata: boolean;
  compact: boolean;
}

/**
 * Individual agent result item with expandable content.
 */
function AgentResultItem({
  agentId,
  result,
  isExpanded,
  onToggle,
  showMetadata,
  compact,
}: AgentResultItemProps) {
  const config = AGENT_CONFIG[agentId] ?? {
    name: agentId,
    icon: <Zap size={16} />,
    color: 'text-white/60',
    bgColor: 'bg-white/10',
  };
  const statusConfig = STATUS_CONFIG[result.status];

  // Extract key findings from result data
  const keyFindings = extractKeyFindings(result);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl transition-all duration-200',
        'bg-gradient-to-br from-white/[0.04] to-white/[0.01]',
        'border hover:border-white/[0.12]',
        result.status === 'failed'
          ? 'border-red-500/30'
          : result.status === 'partial'
          ? 'border-amber-500/30'
          : 'border-white/[0.08]'
      )}
    >
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between',
          compact ? 'p-3' : 'p-4',
          'hover:bg-white/[0.02] transition-colors'
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              config.bgColor
            )}
          >
            <span className={config.color}>{config.icon}</span>
          </div>
          <div className="text-left">
            <span className={cn('font-medium', config.color)}>
              {config.name}
            </span>
            {!compact && (
              <p className="text-xs text-white/50 mt-0.5 line-clamp-1 max-w-md">
                {result.summary}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status badge */}
          <span
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium',
              result.status === 'success' && 'bg-emerald-500/20 text-emerald-400',
              result.status === 'partial' && 'bg-amber-500/20 text-amber-400',
              result.status === 'failed' && 'bg-red-500/20 text-red-400'
            )}
          >
            {statusConfig.icon}
            {statusConfig.label}
          </span>

          {/* Expand/collapse icon */}
          {isExpanded ? (
            <ChevronDown size={16} className="text-white/40" />
          ) : (
            <ChevronRight size={16} className="text-white/40" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div
          className={cn(
            'border-t border-white/[0.05]',
            compact ? 'p-3' : 'p-4',
            'space-y-3'
          )}
        >
          {/* Summary */}
          <div>
            <h4 className="text-xs font-medium text-white/50 mb-1">分析摘要</h4>
            <p className="text-sm text-white/80">{result.summary}</p>
          </div>

          {/* Key findings */}
          {keyFindings.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-white/50 mb-2">
                关键发现
              </h4>
              <ul className="space-y-1">
                {keyFindings.map((finding, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-white/70"
                  >
                    <span className={cn('mt-1', config.color)}>•</span>
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Metadata */}
          {showMetadata && result.metadata && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-white/[0.05]">
              <MetadataItem
                label="耗时"
                value={`${result.metadata.executionTimeMs}ms`}
              />
              <MetadataItem
                label="Token"
                value={result.metadata.tokensUsed.toString()}
              />
              {result.metadata.dataSources.length > 0 && (
                <MetadataItem
                  label="数据源"
                  value={result.metadata.dataSources.join(', ')}
                />
              )}
              {result.metadata.error && (
                <MetadataItem
                  label="错误"
                  value={result.metadata.error}
                  isError
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MetadataItemProps {
  label: string;
  value: string;
  isError?: boolean;
}

/**
 * Metadata display item.
 */
function MetadataItem({ label, value, isError = false }: MetadataItemProps) {
  return (
    <div
      className={cn(
        'px-2 py-1 rounded-lg text-[10px]',
        isError ? 'bg-red-500/10 text-red-400' : 'bg-white/[0.03] text-white/50'
      )}
    >
      <span className="font-medium">{label}:</span>{' '}
      <span className={isError ? 'text-red-300' : 'text-white/70'}>{value}</span>
    </div>
  );
}

/**
 * Extract key findings from agent result data.
 */
function extractKeyFindings(result: AgentResult): string[] {
  const findings: string[] = [];
  const data = result.data;

  // Position Analyst findings
  if (data.concentration_analysis) {
    const ca = data.concentration_analysis as {
      top3_total_weight?: number;
      high_concentration_flags?: string[];
    };
    if (ca.top3_total_weight && ca.top3_total_weight > 50) {
      findings.push(`前三大持仓占比 ${ca.top3_total_weight.toFixed(1)}%`);
    }
    if (ca.high_concentration_flags?.length) {
      findings.push(`高集中度标的: ${ca.high_concentration_flags.join(', ')}`);
    }
  }

  // Risk Analyst findings
  if (data.drawdown_analysis) {
    const da = data.drawdown_analysis as {
      current_drawdown?: number;
      days_since_peak?: number;
    };
    if (da.current_drawdown && da.current_drawdown > 5) {
      findings.push(`当前回撤 ${da.current_drawdown.toFixed(1)}%`);
    }
    if (da.days_since_peak && da.days_since_peak > 30) {
      findings.push(`距高点已 ${da.days_since_peak} 天`);
    }
  }

  if (data.leverage_assessment) {
    const la = data.leverage_assessment as {
      current_leverage?: number;
      margin_safety?: string;
    };
    if (la.current_leverage && la.current_leverage > 1.5) {
      findings.push(`杠杆率 ${la.current_leverage.toFixed(2)}x`);
    }
    if (la.margin_safety === 'danger') {
      findings.push('保证金安全等级: 危险');
    }
  }

  // Market Analyst findings
  if (data.market_sentiment) {
    const ms = data.market_sentiment as {
      overall?: string;
      score?: number;
    };
    if (ms.overall) {
      findings.push(`市场情绪: ${ms.overall}`);
    }
  }

  if (data.news_summary) {
    const ns = data.news_summary as { key_headlines?: string[] };
    if (ns.key_headlines?.length) {
      findings.push(...ns.key_headlines.slice(0, 2));
    }
  }

  // Advisor findings
  if (data.recommendations) {
    const recs = data.recommendations as string[];
    findings.push(...recs.slice(0, 3));
  }

  if (data.action_items) {
    const items = data.action_items as Array<{ action: string; ticker?: string; rationale?: string; priority?: number }>;
    items.slice(0, 3).forEach((item) => {
      const actionText = item.action?.toUpperCase() || 'ACTION';
      const tickerText = item.ticker ? ` ${item.ticker}` : '';
      const rationaleText = item.rationale ? `: ${item.rationale}` : '';
      findings.push(`${actionText}${tickerText}${rationaleText}`);
    });
  }

  // Fallback: use summary if no specific findings
  if (findings.length === 0 && result.summary) {
    // Split summary into sentences
    const sentences = result.summary.split(/[。；]/).filter((s) => s.trim());
    findings.push(...sentences.slice(0, 3));
  }

  return findings.slice(0, 5); // Limit to 5 findings
}

/**
 * Compact summary view of all agent results.
 */
export function AgentResultsSummary({
  results,
}: {
  results: Map<string, AgentResult>;
}) {
  const successCount = Array.from(results.values()).filter(
    (r) => r.status === 'success'
  ).length;
  const totalCount = results.size;

  return (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle
        size={14}
        className={
          successCount === totalCount ? 'text-emerald-400' : 'text-amber-400'
        }
      />
      <span className="text-white/60">
        {successCount}/{totalCount} 智能体分析完成
      </span>
    </div>
  );
}

export default AgentResultsAccordion;
