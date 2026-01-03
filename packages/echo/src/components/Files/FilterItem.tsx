/**
 * 单个过滤项组件
 * 显示名称、计数、颜色指示器和选中状态
 */

import { memo, useCallback } from 'react';
import { Icon } from '@/components/Common/Iconify/icons';
import { motion } from 'framer-motion';

interface FilterItemProps {
  /** 过滤项标签 */
  label: string;
  /** 计数（可选） */
  count?: number;
  /** 颜色指示器（可选） */
  color?: string;
  /** 是否选中 */
  selected: boolean;
  /** 切换选中状态回调 */
  onToggle: () => void;
  /** 图标（可选，当没有颜色时显示） */
  icon?: string;
  /** 动画延迟索引 */
  animationIndex?: number;
}

export const FilterItem = memo(({
  label,
  count,
  color,
  selected,
  onToggle,
  icon,
  animationIndex = 0,
}: FilterItemProps) => {
  // 处理点击事件
  const handleClick = useCallback(() => {
    onToggle();
  }, [onToggle]);

  // 处理键盘事件（无障碍支持）
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  }, [onToggle]);

  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: animationIndex * 0.03, duration: 0.2 }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      className={`
        w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
        ${selected
          ? 'bg-primary/15 text-primary hover:bg-primary/20'
          : 'hover:bg-default-100 text-foreground/80'
        }
      `}
    >
      {/* 颜色指示器或图标 */}
      {color ? (
        <span
          className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/10"
          style={{ backgroundColor: color }}
        />
      ) : icon ? (
        <Icon
          icon={icon}
          className={`w-4 h-4 shrink-0 ${selected ? 'text-primary' : 'text-foreground/60'}`}
        />
      ) : null}

      {/* 标签文字 */}
      <span className="text-sm truncate flex-1">{label}</span>

      {/* 计数 */}
      {count !== undefined && (
        <span className={`text-xs shrink-0 ${selected ? 'text-primary/70' : 'text-foreground/40'}`}>
          {count}
        </span>
      )}

      {/* 选中指示器 */}
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-primary shrink-0" />
        </motion.div>
      )}
    </motion.button>
  );
});

FilterItem.displayName = 'FilterItem';
