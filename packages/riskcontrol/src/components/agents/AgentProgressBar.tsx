/**
 * AgentProgressBar - Multi-Agent Analysis Progress Display
 *
 * Shows overall progress percentage, highlights current agent with animation,
 * displays phase description, and shows agent step indicators.
 *
 * @module components/agents/AgentProgressBar
 * @see {@link .kiro/specs/unified-intelligence/design.md} for design details
 * @see Requirements 4.2, 8.4
 */

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Loader2,
  CheckCircle,
  Circle,
  Brain,
  TrendingUp,
  Shield,
  Globe,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react';
import type { ProgressStatus } from '@/services/agents/types';

// Agent configuration with icons and display names
const AGENT_CONFIG: Record<string, { name: string; icon: React.ReactNode; color: string }> = {
  position_analyst: {
    name: '持仓分析',
    icon: <TrendingUp size={14} />,
    color: 'text-cyan-400',
  },
  risk_analyst: {
    name: '风险分析',
    icon: <Shield size={14} />,
    color: 'text-amber-400',
  },
  market_analyst: {
    name: '市场分析',
    icon: <Globe size={14} />,
    color: 'text-emerald-400',
  },
  web_surfer: {
    name: '网络搜索',
    icon: <Globe size={14} />,
    color: 'text-blue-400',
  },
  advisor: {
    name: '投资建议',
    icon: <Lightbulb size={14} />,
    color: 'text-purple-400',
  },
};

// Default agent execution order
const DEFAULT_AGENT_ORDER = [
  'position_analyst',
  'risk_analyst',
  'market_analyst',
  'advisor',
];

interface AgentProgressBarProps {
  /** Current progress status from orchestrator */
  progress: ProgressStatus | null;
  /** Currently executing agent ID */
  currentAgent: string | null;
  /** Completed agent IDs */
  completedAgents?: string[];
  /** Custom agent order (optional) */
  agentOrder?: string[];
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Show extended thinking indicator */
  showExtendedThinking?: boolean;
}

/**
 * AgentProgressBar displays multi-agent analysis progress with visual indicators.
 *
 * Features:
 * - Overall progress percentage with animated bar
 * - Current agent highlight with pulse animation
 * - Phase description display
 * - Agent step indicators (pending/active/complete)
 * - Extended thinking mode indicator
 *
 * @example
 * ```tsx
 * <AgentProgressBar
 *   progress={{ currentAgent: 'risk_analyst', phase: '分析风险指标', progress: 45 }}
 *   currentAgent="risk_analyst"
 *   completedAgents={['position_analyst']}
 * />
 * ```
 */
export function AgentProgressBar({
  progress,
  currentAgent,
  completedAgents = [],
  agentOrder = DEFAULT_AGENT_ORDER,
  compact = false,
  showExtendedThinking = true,
}: AgentProgressBarProps) {
  const progressPercent = progress?.progress ?? 0;
  const phase = progress?.phase ?? '准备中...';
  const isExtendedThinking = progress?.extendedThinkingActive ?? false;

  // Get agent status
  const getAgentStatus = (agentId: string): 'pending' | 'active' | 'complete' => {
    if (completedAgents.includes(agentId)) return 'complete';
    if (currentAgent === agentId) return 'active';
    return 'pending';
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl',
        'bg-gradient-to-br from-white/[0.04] to-white/[0.01]',
        'border border-white/[0.08]',
        compact ? 'p-3' : 'p-4'
      )}
    >
      {/* Background glow effect */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[40px]" />

      <div className="relative space-y-3">
        {/* Header with progress percentage */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Brain className="text-purple-400" size={16} />
            </div>
            <div>
              <span className="text-sm font-medium text-white/80">
                多智能体分析
              </span>
              {showExtendedThinking && isExtendedThinking && (
                <span className="ml-2 text-xs text-amber-400 animate-pulse">
                  深度思考中...
                </span>
              )}
            </div>
          </div>
          <span className="text-lg font-bold text-purple-400 tabular-nums">
            {progressPercent}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
              'bg-gradient-to-r from-purple-500 to-cyan-500'
            )}
            style={{ width: `${progressPercent}%` }}
          />
          {/* Animated shimmer effect */}
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent',
              'animate-shimmer'
            )}
            style={{
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s infinite linear',
            }}
          />
        </div>

        {/* Phase description */}
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Loader2 size={14} className="animate-spin text-purple-400" />
          <span>{phase}</span>
        </div>

        {/* Agent step indicators */}
        {!compact && (
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
            {agentOrder.map((agentId, index) => {
              const config = AGENT_CONFIG[agentId];
              const status = getAgentStatus(agentId);

              if (!config) return null;

              return (
                <React.Fragment key={agentId}>
                  <AgentStepIndicator
                    agentId={agentId}
                    name={config.name}
                    icon={config.icon}
                    color={config.color}
                    status={status}
                  />
                  {index < agentOrder.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2',
                        status === 'complete' || getAgentStatus(agentOrder[index + 1]) !== 'pending'
                          ? 'bg-gradient-to-r from-purple-500/50 to-cyan-500/50'
                          : 'bg-white/[0.08]'
                      )}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* CSS for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

interface AgentStepIndicatorProps {
  agentId: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  status: 'pending' | 'active' | 'complete';
}

/**
 * Individual agent step indicator showing status.
 */
function AgentStepIndicator({
  name,
  icon,
  color,
  status,
}: AgentStepIndicatorProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300',
          status === 'complete' && 'bg-emerald-500/20',
          status === 'active' && 'bg-purple-500/20 animate-pulse ring-2 ring-purple-500/50',
          status === 'pending' && 'bg-white/[0.05]'
        )}
      >
        {status === 'complete' ? (
          <CheckCircle size={14} className="text-emerald-400" />
        ) : status === 'active' ? (
          <Loader2 size={14} className={cn('animate-spin', color)} />
        ) : (
          <span className={cn('opacity-50', color)}>{icon}</span>
        )}
      </div>
      <span
        className={cn(
          'text-[10px] font-medium transition-colors',
          status === 'complete' && 'text-emerald-400',
          status === 'active' && color,
          status === 'pending' && 'text-white/40'
        )}
      >
        {name}
      </span>
    </div>
  );
}

/**
 * Compact version of progress bar for inline use.
 */
export function AgentProgressBarCompact({
  progress,
  currentAgent,
}: Pick<AgentProgressBarProps, 'progress' | 'currentAgent'>) {
  const progressPercent = progress?.progress ?? 0;
  const config = currentAgent ? AGENT_CONFIG[currentAgent] : null;

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-white/[0.03] rounded-lg">
      <Loader2 size={14} className="animate-spin text-purple-400" />
      <div className="flex-1">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-white/60">
            {config?.name ?? '分析中'}
          </span>
          <span className="text-purple-400 tabular-nums">{progressPercent}%</span>
        </div>
        <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default AgentProgressBar;
