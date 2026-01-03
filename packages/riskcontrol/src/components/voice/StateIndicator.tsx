/**
 * StateIndicator 组件 - 颜色编码的状态指示器
 * 
 * 显示语音助手的当前状态，使用颜色编码区分不同状态：
 * - listening: 绿色 - 正在聆听用户输入
 * - thinking: 蓝色 - AI 正在处理
 * - speaking: 紫色 - AI 正在说话
 * - 其他状态: 灰色 - 未激活状态
 */

import { cn } from '@/lib/utils';

export type ConnectionState = 'disconnected' | 'connecting' | 'initializing' | 'listening' | 'thinking' | 'speaking';

export interface StateIndicatorProps {
  /** 当前状态 */
  state: ConnectionState;
  /** 自定义类名 */
  className?: string;
}

/** 状态标签映射（中文） */
const STATE_LABELS: Record<ConnectionState, string> = {
  disconnected: '未连接',
  connecting: '连接中...',
  initializing: '初始化中...',
  listening: '聆听中',
  thinking: '思考中',
  speaking: '说话中',
};

/** 状态颜色映射 */
const STATE_COLORS: Record<ConnectionState, string> = {
  disconnected: 'text-muted-foreground',
  connecting: 'text-muted-foreground',
  initializing: 'text-muted-foreground',
  listening: 'text-green-500',
  thinking: 'text-blue-500',
  speaking: 'text-purple-500',
};

/**
 * StateIndicator - 状态指示器组件
 * 
 * 使用颜色编码显示当前语音助手状态，支持平滑的颜色过渡动画。
 */
export function StateIndicator({ state, className }: StateIndicatorProps) {
  const label = STATE_LABELS[state];
  const colorClass = STATE_COLORS[state];

  return (
    <span
      className={cn(
        // 基础样式
        'inline-flex items-center font-medium text-sm',
        // 颜色过渡动画
        'transition-colors duration-300 ease-in-out',
        // 状态颜色
        colorClass,
        // 自定义类名
        className
      )}
      role="status"
      aria-live="polite"
    >
      {label}
    </span>
  );
}

export default StateIndicator;
