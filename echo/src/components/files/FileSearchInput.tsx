/**
 * 文件搜索输入框
 * 
 * 集成搜索模式选择器，支持：
 * - 自动智能路由
 * - 快速搜索 (PostgreSQL FTS)
 * - 混合搜索
 * - 语义搜索 (SeekDB 向量)
 */

import { useState, useCallback } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Search, Loader2, X } from 'lucide-react';
import { 
  SearchModeSelector, 
  useSearchMode, 
  type SearchMode,
} from './SearchModeSelector';
import { Badge } from '../ui/badge';

export interface SearchOptions {
  query: string;
  alpha: number;
  mode: SearchMode;
}

interface FileSearchInputProps {
  /** 搜索回调，返回查询和 alpha 值 */
  onSearch: (options: SearchOptions) => void;
  /** 加载状态 */
  loading?: boolean;
  /** 默认搜索模式 */
  defaultMode?: SearchMode;
  /** 占位符文本 */
  placeholder?: string;
  /** 显示搜索统计 */
  showStats?: boolean;
  /** 上次搜索的延迟 */
  lastLatency?: number;
  /** 上次搜索使用的后端 */
  lastBackend?: string;
}

export function FileSearchInput({ 
  onSearch, 
  loading,
  defaultMode = 'fast',  // 默认使用快速搜索
  placeholder = '搜索文件...',
  showStats = true,
  lastLatency,
  lastBackend,
}: FileSearchInputProps) {
  const [query, setQuery] = useState('');
  const { mode, setMode, getAlpha } = useSearchMode(defaultMode);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const alpha = getAlpha(query);
      onSearch({
        query: query.trim(),
        alpha,
        mode,
      });
    }
  }, [query, mode, getAlpha, onSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
  }, []);

  return (
    <div className="space-y-2">
      {/* 搜索模式选择器 */}
      <SearchModeSelector
        mode={mode}
        onModeChange={setMode}
        currentQuery={query}
      />
      
      {/* 搜索输入框 */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-8"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Search className="h-4 w-4 mr-1" />
              搜索
            </>
          )}
        </Button>
      </form>

      {/* 搜索统计 */}
      {showStats && (lastLatency !== undefined || lastBackend) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lastBackend && (
            <Badge variant="outline" className="text-xs h-5">
              {lastBackend === 'postgres' && '全文搜索'}
              {lastBackend === 'seekdb' && '向量搜索'}
              {lastBackend === 'hybrid' && '混合搜索'}
            </Badge>
          )}
          {lastLatency !== undefined && (
            <span>{lastLatency.toFixed(0)}ms</span>
          )}
        </div>
      )}
    </div>
  );
}

export default FileSearchInput;
