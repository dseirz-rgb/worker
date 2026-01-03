/**
 * 活动过滤器显示组件
 * 显示当前活动的过滤器 chips，支持单个清除和全部清除
 */

import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Iconify/icons';
import { Chip, Button } from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';

/** 过滤器类型 */
type FilterType = 'tag' | 'documentType' | 'correspondent' | 'date';

/** 单个过滤器项 */
interface FilterItem {
  /** 过滤器类型 */
  type: FilterType;
  /** 过滤器 ID */
  id: number | string;
  /** 显示标签 */
  label: string;
  /** 颜色（可选，用于标签） */
  color?: string;
}

interface ActiveFiltersProps {
  /** 当前活动的过滤器列表 */
  filters: FilterItem[];
  /** 移除单个过滤器回调 */
  onRemove: (type: FilterType, id: number | string) => void;
  /** 清除全部过滤器回调 */
  onClearAll: () => void;
}

// 根据过滤器类型获取图标
const getFilterIcon = (type: FilterType): string => {
  switch (type) {
    case 'tag':
      return 'solar:tag-bold';
    case 'documentType':
      return 'solar:document-bold';
    case 'correspondent':
      return 'solar:user-bold';
    case 'date':
      return 'solar:calendar-bold';
    default:
      return 'solar:filter-bold';
  }
};

// 根据过滤器类型获取颜色类名
const getFilterColorClass = (type: FilterType): string => {
  switch (type) {
    case 'tag':
      return 'bg-primary/10 text-primary';
    case 'documentType':
      return 'bg-secondary/10 text-secondary';
    case 'correspondent':
      return 'bg-success/10 text-success';
    case 'date':
      return 'bg-warning/10 text-warning';
    default:
      return 'bg-default-100 text-foreground';
  }
};

export const ActiveFilters = memo(({
  filters,
  onRemove,
  onClearAll,
}: ActiveFiltersProps) => {
  const { t } = useTranslation();

  // 处理移除单个过滤器
  const handleRemove = useCallback((type: FilterType, id: number | string) => {
    onRemove(type, id);
  }, [onRemove]);

  // 如果没有活动过滤器，不渲染
  if (filters.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-wrap items-center gap-2 p-3 bg-default-50 rounded-lg border border-divider"
    >
      {/* 过滤器标签 */}
      <div className="flex items-center gap-1 text-sm text-foreground/60 mr-1">
        <Icon icon="solar:filter-bold" className="w-4 h-4" />
        <span>{t('active-filters') || '活动过滤器'}:</span>
      </div>

      {/* 过滤器 chips */}
      <div className="flex flex-wrap gap-1.5 flex-1">
        <AnimatePresence mode="popLayout">
          {filters.map((filter) => (
            <motion.div
              key={`${filter.type}-${filter.id}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              layout
            >
              <Chip
                size="sm"
                variant="flat"
                onClose={() => handleRemove(filter.type, filter.id)}
                classNames={{
                  base: `${filter.color ? '' : getFilterColorClass(filter.type)} cursor-default`,
                  closeButton: 'text-current opacity-70 hover:opacity-100',
                }}
                style={filter.color ? {
                  backgroundColor: filter.color + '20',
                  color: filter.color,
                } : undefined}
                startContent={
                  filter.color ? (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: filter.color }}
                    />
                  ) : (
                    <Icon icon={getFilterIcon(filter.type)} className="w-3 h-3" />
                  )
                }
              >
                {filter.label}
              </Chip>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 清除全部按钮 */}
      {filters.length > 1 && (
        <Button
          size="sm"
          variant="light"
          color="danger"
          className="h-6 px-2 min-w-0"
          startContent={<Icon icon="solar:trash-bin-minimalistic-linear" className="w-3.5 h-3.5" />}
          onPress={onClearAll}
        >
          {t('clear-all') || '清除全部'}
        </Button>
      )}
    </motion.div>
  );
});

ActiveFilters.displayName = 'ActiveFilters';

// 导出类型供外部使用
export type { FilterType, FilterItem, ActiveFiltersProps };
