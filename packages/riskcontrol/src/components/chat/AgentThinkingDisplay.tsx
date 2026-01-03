/**
 * AgentThinkingDisplay - Collapsible Agent Thinking Process Display
 *
 * Shows the current agent thinking process during multi-agent analysis,
 * including current agent, phase, and intermediate results.
 *
 * @module components/chat/AgentThinkingDisplay
 * @see {@link .kiro/specs/unified-intelligence/design.md}
 * @see Requirements 5.3
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  Brain,
  Loader2,
  CheckCircle,
  TrendingUp,
  Shield,
  Globe,
  Lightbulb,
} from 'lucide-react';
import type { AgentResult, ProgressStatus } from '@/services/agents/types';

// Agent configuration
const AGENT_CONFIG: Record<string, { name: string; icon: React.ReactNode; color: string }> = {
  position_analyst: {
    name: '持仓分析',
    icon: <TrendingUp size={12} />,
    color: 'text-cyan-400',
  },
  risk_analyst: {
    name: '风险分析',
    icon: <Shield size={12} />,
    color: 'text-amber-400',
  },
  market_analyst: {
    name: '市场分析',
    icon: <Globe size={12} />,
    color: 'text-emerald-400',
  },
  web_surfer: {
    name: '网络搜索',
    icon: <Globe size={12} />,
    color: 'text-blue-400',
  },
  advisor: {
    name: '投资建议',
    icon: <Lightbulb size={12} />,
    color: 'text-purple-400',
  },
};

interface AgentThinkingDisplayProps {
  /** Current progress status */
  progress: ProgressStatus | null;
  /** Current agent ID */
  currentAgent: string | null;
  /** Agent results so far */
  agentResults: Map<string, AgentResult>;
  /** Whether analysis is in progress */
  isProcessing: boolean;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
}

/**
 * AgentThinkingDisplay shows the multi-agent thinking process in a collapsible section.
 *
 * Features:
 * - Collapsible section for agent thinking
 * - Current agent and phase display
 * - Intermediate results from completed agents
 * - Animated indicators for active processing
 *
 * @example
 * ```tsx
 * <AgentThinkingDisplay
 *   progress={progress}
 *   currentAgent="risk_analyst"
 *   agentResults={agentResults}
 *   isProcessing={true}
 * />
 * ```
 */
export function AgentThinkingDisplay({
  progress,
  currentAgent,
  agentResults,
  isProcessing,
  defaultCollapsed = true,
}: AgentThinkingDisplayProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Don't render if no processing and no results
  if (!isProcessing && agentResults.size === 0) {
    return null;
  }

  const currentConfig = currentAgent ? AGENT_CONFIG[currentAgent] : null;

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden transition-all duration-200',
        'bg-gradient-to-br from-purple-500/5 to-purple-500/10',
        'border border-purple-500/20'
      )}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2',
          'hover:bg-white/[0.02] transition-colors'
        )}
      >
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-purple-400" />
          <span className="text-xs font-medium text-white/70">
            {isProcessing ? 'AI 分析中...' : '分析过程'}
          </span>
          {isProcessing && currentConfig && (
            <span className={cn('text-xs', currentConfig.color)}>
              {currentConfig.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isProcessing && (
            <Loader2 size={12} className="animate-spin text-purple-400" />
          )}
          {agentResults.size > 0 && (
            <span className="text-[10px] text-white/40">
              {agentResults.size} 个智能体
            </span>
          )}
          {isCollapsed ? (
            <ChevronDown size={14} className="text-white/40" />
          ) : (
            <ChevronUp size={14} className="text-white/40" />
          )}
        </div>
      </button>

      {/* Collapsed content */}
      {!isCollapsed && (
        <div className="px-3 pb-3 space-y-2">
          {/* Current phase */}
          {isProcessing && progress && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span>{progress.phase}</span>
              <span className="text-purple-400 tabular-nums">
                {progress.progress}%
              </span>
            </div>
          )}

          {/* Agent results */}
          {agentResults.size > 0 && (
            <div className="space-y-1.5">
              {Array.from(agentResults.entries()).map(([agentId, result]) => {
                const config = AGENT_CONFIG[agentId];
                if (!config) return null;

                return (
                  <AgentResultItem
                    key={agentId}
                    agentId={agentId}
                    result={result}
                    config={config}
                    isActive={currentAgent === agentId}
                  />
                );
              })}
            </div>
          )}

          {/* Extended thinking indicator */}
          {progress?.extendedThinkingActive && (
            <div className="flex items-center gap-2 text-xs text-amber-400 mt-2">
              <Brain size={12} className="animate-pulse" />
              <span>深度思考模式</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface AgentResultItemProps {
  agentId: string;
  result: AgentResult;
  config: { name: string; icon: React.ReactNode; color: string };
  isActive: boolean;
}

/**
 * Individual agent result item in the thinking display.
 */
function AgentResultItem({ result, config, isActive }: AgentResultItemProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 p-2 rounded-md',
        'bg-white/[0.02]',
        isActive && 'ring-1 ring-purple-500/30'
      )}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        {result.status === 'success' ? (
          <CheckCircle size={12} className="text-emerald-400" />
        ) : isActive ? (
          <Loader2 size={12} className="animate-spin text-purple-400" />
        ) : (
          <span className={config.color}>{config.icon}</span>
        )}
        <span className={cn('text-[10px] font-medium', config.color)}>
          {config.name}
        </span>
      </div>
      <p className="text-[10px] text-white/50 line-clamp-2 flex-1">
        {result.summary || '分析中...'}
      </p>
    </div>
  );
}

/**
 * Compact inline indicator for agent thinking.
 */
export function AgentThinkingIndicator({
  currentAgent,
  progress,
}: {
  currentAgent: string | null;
  progress: ProgressStatus | null;
}) {
  const config = currentAgent ? AGENT_CONFIG[currentAgent] : null;

  if (!config) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <Loader2 size={12} className="animate-spin text-purple-400" />
      <span className={config.color}>{config.name}</span>
      {progress && (
        <span className="text-white/40 tabular-nums">{progress.progress}%</span>
      )}
    </div>
  );
}

export default AgentThinkingDisplay;
