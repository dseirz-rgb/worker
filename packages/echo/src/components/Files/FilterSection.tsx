/**
 * 可折叠的过滤区域组件
 * 支持展开/折叠、标题显示和可选的添加按钮
 */

import { memo, useState, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import { Button } from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';

interface FilterSectionProps {
  /** 区域标题 */
  title: string;
  /** 子内容 */
  children: ReactNode;
  /** 默认是否展开 */
  defaultExpanded?: boolean;
  /** 添加按钮点击回调 */
  onAddClick?: () => void;
  /** 添加按钮标签 */
  addButtonLabel?: string;
  /** 标题图标 */
  icon?: string;
  /** 计数显示 */
  count?: number;
}

export const FilterSection = memo(({
  title,
  children,
  defaultExpanded = true,
  onAddClick,
  addButtonLabel,
  icon = 'solar:filter-bold',
  count,
}: FilterSectionProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 切换展开/折叠状态
  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return (
    <div className="space-y-2">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 group cursor-pointer"
        >
          {/* 展开/折叠图标 */}
          <motion.div
            animate={{ rotate: isExpanded ? 0 : -90 }}
            transition={{ duration: 0.2 }}
          >
            <Icon
              icon="solar:alt-arrow-down-linear"
              className="w-4 h-4 text-foreground/50 group-hover:text-foreground/80 transition-colors"
            />
          </motion.div>
          
          {/* 标题图标 */}
          <Icon icon={icon} className="w-4 h-4 text-primary" />
          
          {/* 标题文字 */}
          <span className="font-semibold text-sm text-foreground/90 group-hover:text-foreground transition-colors">
            {title}
          </span>
          
          {/* 计数 */}
          {count !== undefined && (
            <span className="text-xs text-foreground/50">({count})</span>
          )}
        </button>

        {/* 添加按钮 */}
        {onAddClick && (
          <Button
            size="sm"
            variant="light"
            isIconOnly
            className="w-6 h-6 min-w-0"
            onPress={onAddClick}
            aria-label={addButtonLabel || t('add') || '添加'}
          >
            <Icon icon="solar:add-circle-linear" className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* 内容区域 - 带动画 */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.25, ease: 'easeInOut' },
              opacity: { duration: 0.2 },
            }}
            className="overflow-hidden"
          >
            <div className="pl-6">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

FilterSection.displayName = 'FilterSection';
