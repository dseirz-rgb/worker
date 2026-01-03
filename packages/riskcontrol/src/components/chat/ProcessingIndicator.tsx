/**
 * ProcessingIndicator - Shows current processing mode during query execution
 *
 * Displays an animated indicator showing whether the system is using
 * RAG-only, RAG+Agent, or Full Agent mode for processing.
 *
 * @module components/chat/ProcessingIndicator
 * @see {@link .kiro/specs/unified-intelligence/design.md}
 * @see Requirements 5.1, 5.2
 */

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Zap,
  Brain,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { ProcessingMode } from '@/services/unifiedIntelligence/types';

interface ProcessingIndicatorProps {
  /** Current processing mode */
  mode: ProcessingMode | 'idle';
  /** Whether processing is active */
  isProcessing: boolean;
  /** Optional className */
  className?: string;
}

// Mode configuration
const MODE_CONFIG: Record<ProcessingMode, {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  rag_only: {
    label: '快速检索',
    description: '知识库检索中...',
    icon: <Zap size={14} />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
  },
  rag_agent: {
    label: '智能分析',
    description: '检索 + 单智能体分析...',
    icon: <Brain size={14} />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  full_agent: {
    label: '深度分析',
    description: '多智能体协同分析...',
    icon: <Sparkles size={14} />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
};

/**
 * ProcessingIndicator shows the current processing mode with animation.
 *
 * @example
 * ```tsx
 * <ProcessingIndicator
 *   mode="rag_only"
 *   isProcessing={true}
 * />
 * ```
 */
export function ProcessingIndicator({
  mode,
  isProcessing,
  className,
}: ProcessingIndicatorProps) {
  if (!isProcessing || mode === 'idle') {
    return null;
  }

  const config = MODE_CONFIG[mode];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
        'border transition-all duration-300',
        config.bgColor,
        config.borderColor,
        'animate-in fade-in slide-in-from-bottom-2',
        className
      )}
    >
      {/* Animated icon */}
      <div className={cn('relative', config.color)}>
        {config.icon}
        <div
          className={cn(
            'absolute inset-0 rounded-full animate-ping opacity-30',
            config.bgColor
          )}
        />
      </div>

      {/* Label */}
      <span className={cn('text-xs font-medium', config.color)}>
        {config.label}
      </span>

      {/* Spinner */}
      <Loader2 size={12} className={cn('animate-spin', config.color)} />
    </div>
  );
}

/**
 * Compact processing indicator for inline use.
 */
export function ProcessingIndicatorCompact({
  mode,
  isProcessing,
  className,
}: ProcessingIndicatorProps) {
  if (!isProcessing || mode === 'idle') {
    return null;
  }

  const config = MODE_CONFIG[mode];

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs',
        config.color,
        className
      )}
    >
      <Loader2 size={12} className="animate-spin" />
      <span>{config.description}</span>
    </div>
  );
}

/**
 * Processing mode badge for display in messages.
 */
export function ProcessingModeBadge({
  mode,
  className,
}: {
  mode: ProcessingMode;
  className?: string;
}) {
  const config = MODE_CONFIG[mode];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]',
        config.bgColor,
        config.color,
        className
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

export default ProcessingIndicator;
