/**
 * 搜索模式选择器
 * 
 * 简化版本 - 仅支持 PostgreSQL FTS 搜索
 */

import { useState, useCallback } from 'react';
import { Button, ButtonGroup, Tooltip } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';

// 搜索模式类型 - 简化为仅支持快速搜索
export type SearchMode = 'fast';

// 模式配置
interface ModeConfig {
  label: string;
  description: string;
  icon: string;
}

const MODE_CONFIG: Record<SearchMode, ModeConfig> = {
  fast: {
    label: '快速',
    description: '全文搜索，响应 <100ms',
    icon: 'solar:bolt-bold',
  },
};

// 保留 getAutoAlpha 函数以保持向后兼容，但始终返回 0
export function getAutoAlpha(_query: string): number {
  return 0;
}

// 保留 getAutoModeLabel 函数以保持向后兼容
export function getAutoModeLabel(_alpha: number): string {
  return '快速';
}

interface SearchModeSelectorProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  currentQuery?: string;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * 搜索模式选择器组件
 * 
 * 简化版本：仅显示快速搜索模式
 * 保留组件结构以便将来扩展
 */
export function SearchModeSelector({
  mode,
  onModeChange,
  currentQuery: _currentQuery = '',
  className = '',
  size = 'sm',
}: SearchModeSelectorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ButtonGroup size={size} variant="flat">
        {(Object.entries(MODE_CONFIG) as [SearchMode, ModeConfig][]).map(([key, cfg]) => (
          <Tooltip 
            key={key} 
            content={
              <div className="p-1">
                <p className="font-medium">{cfg.label}搜索</p>
                <p className="text-xs text-foreground/60">{cfg.description}</p>
              </div>
            }
            placement="bottom"
          >
            <Button
              isIconOnly={size === 'sm'}
              color={mode === key ? 'primary' : 'default'}
              variant={mode === key ? 'solid' : 'flat'}
              onPress={() => onModeChange(key)}
              className="min-w-0"
            >
              <Icon icon={cfg.icon} className="w-4 h-4" />
              {size === 'md' && <span className="ml-1">{cfg.label}</span>}
            </Button>
          </Tooltip>
        ))}
      </ButtonGroup>
    </div>
  );
}

// Hook: 使用搜索模式 - 简化版本
export function useSearchMode(defaultMode: SearchMode = 'fast') {
  const [mode, setMode] = useState<SearchMode>(defaultMode);
  
  // 始终返回 0（PostgreSQL FTS）
  const getAlpha = useCallback((_query: string): number => {
    return 0;
  }, []);
  
  return {
    mode,
    setMode,
    getAlpha,
    config: MODE_CONFIG[mode],
  };
}

export default SearchModeSelector;
