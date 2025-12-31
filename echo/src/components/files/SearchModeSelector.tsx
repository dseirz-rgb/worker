/**
 * 搜索模式选择器
 * 
 * 支持四种模式：
 * - auto: 自动智能路由（根据查询特征选择）
 * - fast: 快速搜索 (PostgreSQL FTS, alpha=0)
 * - hybrid: 混合搜索 (alpha=0.5)
 * - semantic: 语义搜索 (SeekDB 向量, alpha=1)
 */

import { useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip } from '../ui/tooltip';
import { 
  Zap, 
  Sparkles, 
  Blend,
  Wand2,
  Info,
} from 'lucide-react';

// 搜索模式类型
export type SearchMode = 'auto' | 'fast' | 'hybrid' | 'semantic';

// 模式配置
interface ModeConfig {
  label: string;
  description: string;
  icon: React.ReactNode;
  alpha: number | 'auto';
  color: string;
}

const MODE_CONFIG: Record<SearchMode, ModeConfig> = {
  auto: {
    label: '自动',
    description: '根据查询智能选择最佳搜索方式',
    icon: <Wand2 className="h-4 w-4" />,
    alpha: 'auto',
    color: 'text-violet-500',
  },
  fast: {
    label: '快速',
    description: '全文搜索，响应 <100ms',
    icon: <Zap className="h-4 w-4" />,
    alpha: 0,
    color: 'text-yellow-500',
  },
  hybrid: {
    label: '混合',
    description: '结合全文和语义搜索',
    icon: <Blend className="h-4 w-4" />,
    alpha: 0.5,
    color: 'text-blue-500',
  },
  semantic: {
    label: '语义',
    description: '向量搜索，理解语义',
    icon: <Sparkles className="h-4 w-4" />,
    alpha: 1,
    color: 'text-emerald-500',
  },
};

// 自动模式的智能路由逻辑
export function getAutoAlpha(query: string): number {
  const trimmed = query.trim();
  
  // 空查询 → 快速
  if (!trimmed) return 0;
  
  // 问句模式（包含问号或疑问词）→ 语义
  const questionPatterns = [
    /[？?]$/,
    /^(什么|怎么|如何|为什么|哪个|哪些|谁|何时|何地|是否)/,
    /^(what|how|why|when|where|who|which|is|are|can|could|would|should)/i,
  ];
  if (questionPatterns.some(p => p.test(trimmed))) {
    return 0.8; // 偏向语义
  }
  
  // 短查询（<= 3 字符）→ 快速
  if (trimmed.length <= 3) return 0;
  
  // 中等长度（4-10 字符）→ 混合
  if (trimmed.length <= 10) return 0.3;
  
  // 长查询（> 10 字符）→ 偏向语义
  if (trimmed.length <= 20) return 0.5;
  
  // 很长的查询 → 语义
  return 0.7;
}

// 获取自动模式下实际使用的模式名称
export function getAutoModeLabel(alpha: number): string {
  if (alpha === 0) return '快速';
  if (alpha < 0.4) return '偏快速';
  if (alpha < 0.6) return '混合';
  if (alpha < 0.9) return '偏语义';
  return '语义';
}

interface SearchModeSelectorProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  currentQuery?: string;
  className?: string;
}

export function SearchModeSelector({
  mode,
  onModeChange,
  currentQuery = '',
  className = '',
}: SearchModeSelectorProps) {
  // 计算自动模式下的实际 alpha
  const autoAlpha = mode === 'auto' ? getAutoAlpha(currentQuery) : null;
  const autoLabel = autoAlpha !== null ? getAutoModeLabel(autoAlpha) : null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex items-center bg-muted rounded-lg p-0.5">
        {Object.entries(MODE_CONFIG).map(([key, cfg]) => (
          <Tooltip 
            key={key} 
            content={
              <div>
                <p className="font-medium">{cfg.label}搜索</p>
                <p className="text-xs text-muted-foreground">{cfg.description}</p>
                {cfg.alpha !== 'auto' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    alpha = {cfg.alpha}
                  </p>
                )}
              </div>
            }
            side="bottom"
          >
            <Button
              variant={mode === key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onModeChange(key as SearchMode)}
              className={`gap-1 h-7 px-2 ${mode === key ? '' : 'hover:bg-background'}`}
            >
              <span className={mode === key ? '' : cfg.color}>{cfg.icon}</span>
              <span className="text-xs">{cfg.label}</span>
            </Button>
          </Tooltip>
        ))}
      </div>
      
      {/* 自动模式下显示当前策略 */}
      {mode === 'auto' && currentQuery && (
        <Badge variant="outline" className="text-xs gap-1 h-6">
          <Info className="h-3 w-3" />
          {autoLabel} (α={autoAlpha?.toFixed(1)})
        </Badge>
      )}
    </div>
  );
}

// Hook: 使用搜索模式
export function useSearchMode(defaultMode: SearchMode = 'auto') {
  const [mode, setMode] = useState<SearchMode>(defaultMode);
  
  // 获取实际的 alpha 值
  const getAlpha = useCallback((query: string): number => {
    if (mode === 'auto') {
      return getAutoAlpha(query);
    }
    return MODE_CONFIG[mode].alpha as number;
  }, [mode]);
  
  return {
    mode,
    setMode,
    getAlpha,
    config: MODE_CONFIG[mode],
  };
}

export default SearchModeSelector;
