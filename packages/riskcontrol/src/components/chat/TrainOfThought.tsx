/**
 * TrainOfThought - AI 思考过程展示组件
 *
 * 基于: https://github.com/khoj-ai/khoj
 * 改动: 1. 替换 @phosphor-icons/react → lucide-react
 *       2. 添加折叠/展开功能
 *       3. 添加动画效果
 *       4. 适配 RiskControl 主题
 *
 * @module components/chat/TrainOfThought
 * @license AGPL-3.0 (继承自 Khoj)
 */

import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import {
  Brain,
  Cloud,
  Folder,
  Book,
  Search,
  Aperture,
  Palette,
  Code,
  Shapes,
  Globe,
  Wrench,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// --- Types ---
export interface ThoughtStep {
  type: 'status' | 'action' | 'result' | 'error';
  data: string;
  timestamp?: string;
}

export interface TrainOfThoughtProps {
  /** 思考步骤列表 */
  steps: ThoughtStep[];
  /** 是否正在处理 */
  isProcessing?: boolean;
  /** 当前步骤索引 */
  currentStep?: number;
  /** 主题色 */
  accentColor?: string;
  /** 默认折叠 */
  defaultCollapsed?: boolean;
  /** 标题 */
  title?: string;
}

// --- Helper Functions ---

/** 根据标题选择图标 */
function getIconForHeader(header: string) {
  const h = header.toLowerCase();
  const iconClass = 'h-4 w-4';

  if (h.includes('understanding') || h.includes('理解') || h.includes('分析'))
    return <Brain className={iconClass} />;
  if (h.includes('generating') || h.includes('生成'))
    return <Cloud className={iconClass} />;
  if (h.includes('tools') || h.includes('工具'))
    return <Wrench className={iconClass} />;
  if (h.includes('notes') || h.includes('documents') || h.includes('文档') || h.includes('文件'))
    return <Folder className={iconClass} />;
  if (h.includes('browsing') || h.includes('浏览') || h.includes('阅读'))
    return <Book className={iconClass} />;
  if (h.includes('search') || h.includes('搜索') || h.includes('检索'))
    return <Search className={iconClass} />;
  if (h.includes('summary') || h.includes('总结') || h.includes('摘要'))
    return <Aperture className={iconClass} />;
  if (h.includes('diagram') || h.includes('图表'))
    return <Shapes className={iconClass} />;
  if (h.includes('paint') || h.includes('绘制') || h.includes('画'))
    return <Palette className={iconClass} />;
  if (h.includes('code') || h.includes('代码') || h.includes('编程'))
    return <Code className={iconClass} />;
  if (h.includes('web') || h.includes('网页') || h.includes('网络'))
    return <Globe className={iconClass} />;

  return <Brain className={iconClass} />;
}

/** 解析思考步骤内容 */
function parseStepContent(data: string): { header: string; content: string } {
  // 匹配 **header**: content 格式
  const match = data.match(/^\*\*(.*?)\*\*:?\s*([\s\S]*)/);
  if (match) {
    return { header: match[1], content: match[2] };
  }
  return { header: '', content: data };
}

// --- Sub Components ---

/** 单个思考步骤 */
function ThoughtStepItem({
  step,
  index,
  isActive,
  isLast,
  accentColor,
}: {
  step: ThoughtStep;
  index: number;
  isActive: boolean;
  isLast: boolean;
  accentColor: string;
}) {
  const { header, content } = parseStepContent(step.data);
  const icon = getIconForHeader(header || content);

  // 状态图标
  const statusIcon = (() => {
    if (step.type === 'error') return <AlertCircle className="h-3 w-3 text-red-500" />;
    if (isActive) return <Loader2 className="h-3 w-3 animate-spin text-purple-400" />;
    if (!isLast) return <CheckCircle className="h-3 w-3 text-emerald-500" />;
    return null;
  })();

  return (
    <div
      className={cn(
        'flex items-start gap-3 py-2 px-3 rounded-lg transition-all',
        isActive && 'bg-purple-500/10 ring-1 ring-purple-500/30',
        step.type === 'error' && 'bg-red-500/10'
      )}
    >
      {/* 左侧图标 */}
      <div
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 mt-0.5',
          isActive ? 'bg-purple-500/20 text-purple-400' : 'bg-bg-tertiary text-text-muted'
        )}
      >
        {icon}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        {header && (
          <div
            className={cn(
              'text-xs font-medium mb-0.5',
              isActive ? `text-accent-${accentColor}` : 'text-text-secondary'
            )}
          >
            {header}
          </div>
        )}
        <div
          className={cn(
            'text-xs break-words',
            isActive ? 'text-text-primary' : 'text-text-muted'
          )}
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(content.replace(/\n/g, '<br/>')),
          }}
        />
        {step.timestamp && (
          <div className="text-[10px] text-text-tertiary mt-1">{step.timestamp}</div>
        )}
      </div>

      {/* 状态图标 */}
      {statusIcon && <div className="flex-shrink-0 mt-1">{statusIcon}</div>}
    </div>
  );
}

// --- Main Component ---

/**
 * TrainOfThought 展示 AI 的思考过程
 *
 * 特性:
 * - 可折叠/展开
 * - 实时更新动画
 * - 步骤状态指示
 * - 错误状态显示
 *
 * @example
 * ```tsx
 * <TrainOfThought
 *   steps={[
 *     { type: 'status', data: '**分析**: 正在理解您的问题...' },
 *     { type: 'action', data: '**搜索**: 检索相关文档...' },
 *   ]}
 *   isProcessing={true}
 *   currentStep={1}
 * />
 * ```
 */
export function TrainOfThought({
  steps,
  isProcessing = false,
  currentStep,
  accentColor = 'purple',
  defaultCollapsed = false,
  title = 'AI 思考过程',
}: TrainOfThoughtProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // 没有步骤时不渲染
  if (steps.length === 0 && !isProcessing) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden transition-all duration-200',
        'bg-gradient-to-br from-purple-500/5 to-purple-500/10',
        'border border-purple-500/20'
      )}
    >
      {/* 头部 - 始终可见 */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'hover:bg-white/[0.02] transition-colors'
        )}
      >
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-purple-400" />
          <span className="text-sm font-medium text-text-primary">{title}</span>
          {isProcessing && (
            <span className="text-xs text-purple-400 animate-pulse">处理中...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isProcessing && <Loader2 size={14} className="animate-spin text-purple-400" />}
          {steps.length > 0 && (
            <span className="text-xs text-text-muted">{steps.length} 步</span>
          )}
          {isCollapsed ? (
            <ChevronDown size={16} className="text-text-muted" />
          ) : (
            <ChevronUp size={16} className="text-text-muted" />
          )}
        </div>
      </button>

      {/* 内容区域 */}
      {!isCollapsed && (
        <div className="px-3 pb-3 space-y-1">
          {steps.map((step, index) => (
            <ThoughtStepItem
              key={index}
              step={step}
              index={index}
              isActive={currentStep === index || (isProcessing && index === steps.length - 1)}
              isLast={index === steps.length - 1}
              accentColor={accentColor}
            />
          ))}

          {/* 处理中占位 */}
          {isProcessing && steps.length === 0 && (
            <div className="flex items-center gap-2 py-3 px-3 text-xs text-text-muted">
              <Loader2 size={14} className="animate-spin text-purple-400" />
              <span>正在思考...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 紧凑版思考指示器
 */
export function TrainOfThoughtIndicator({
  currentStep,
  totalSteps,
  isProcessing,
}: {
  currentStep?: string;
  totalSteps?: number;
  isProcessing?: boolean;
}) {
  if (!isProcessing) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-text-muted">
      <Loader2 size={12} className="animate-spin text-purple-400" />
      {currentStep && <span className="text-purple-400">{currentStep}</span>}
      {totalSteps !== undefined && (
        <span className="text-text-tertiary">({totalSteps} 步)</span>
      )}
    </div>
  );
}

export default TrainOfThought;
