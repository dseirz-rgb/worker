/**
 * 统一搜索组件
 * 整合 Echo 本地搜索和 Khoj 语义搜索
 */

import * as React from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import {
  Search,
  Brain,
  FileText,
  CheckSquare,
  Sparkles,
  Filter,
  X,
  Loader2,
} from 'lucide-react';
import { unifiedSearchService, type UnifiedSearchResult } from '../../services/search/unifiedSearch';
import { cn } from '../../lib/utils';

interface UnifiedSearchProps {
  /** 搜索结果点击回调 */
  onResultClick?: (result: UnifiedSearchResult) => void;
  /** 自定义类名 */
  className?: string;
  /** 占位符文本 */
  placeholder?: string;
}

/** 来源过滤选项 */
type SourceFilter = 'all' | 'echo' | 'khoj';

/** 类型过滤选项 */
type TypeFilter = 'all' | 'note' | 'task' | 'memory' | 'document';

export function UnifiedSearch({
  onResultClick,
  className,
  placeholder = '搜索笔记、任务、文档...',
}: UnifiedSearchProps) {
  // 搜索状态
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<UnifiedSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  
  // 过滤状态
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>('all');
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all');
  const [showFilters, setShowFilters] = React.useState(false);

  // 防抖搜索
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 执行搜索
  const performSearch = React.useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    
    try {
      // 构建搜索选项
      const sources: ('echo' | 'khoj')[] = sourceFilter === 'all' 
        ? ['echo', 'khoj']
        : [sourceFilter];
      
      const types: ('note' | 'task' | 'memory' | 'document')[] | undefined = typeFilter === 'all'
        ? undefined
        : [typeFilter];

      const searchResults = await unifiedSearchService.search(searchQuery, {
        sources,
        types,
        limit: 20,
      });
      
      setResults(searchResults);
    } catch (error) {
      console.error('搜索失败:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [sourceFilter, typeFilter]);

  // 输入变化时防抖搜索
  React.useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, performSearch]);

  // 清除搜索
  const handleClear = () => {
    setQuery('');
    setResults([]);
  };

  // 获取类型图标
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'note':
        return FileText;
      case 'task':
        return CheckSquare;
      case 'memory':
        return Sparkles;
      case 'document':
        return FileText;
      default:
        return FileText;
    }
  };

  // 获取来源标签样式
  const getSourceStyle = (source: string) => {
    return source === 'khoj'
      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 搜索输入框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-10 pr-20"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6', showFilters && 'bg-accent')}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* 过滤器 */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
          {/* 来源过滤 */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">来源:</span>
            {(['all', 'echo', 'khoj'] as const).map((source) => (
              <Button
                key={source}
                variant={sourceFilter === source ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setSourceFilter(source)}
              >
                {source === 'all' ? '全部' : source === 'echo' ? 'Echo' : 'Khoj'}
              </Button>
            ))}
          </div>
          
          {/* 类型过滤 */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">类型:</span>
            {(['all', 'note', 'task', 'document'] as const).map((type) => (
              <Button
                key={type}
                variant={typeFilter === type ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setTypeFilter(type)}
              >
                {type === 'all' ? '全部' : type === 'note' ? '笔记' : type === 'task' ? '任务' : '文档'}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* 搜索状态 */}
      {isSearching && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">搜索中...</span>
        </div>
      )}

      {/* 搜索结果 */}
      {!isSearching && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            找到 {results.length} 个结果
          </p>
          {results.map((result) => {
            const TypeIcon = getTypeIcon(result.type);
            return (
              <Card
                key={result.id}
                className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => onResultClick?.(result)}
              >
                <div className="flex items-start gap-3">
                  {/* 来源图标 */}
                  <div className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                    result.source === 'khoj' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                  )}>
                    {result.source === 'khoj' ? (
                      <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  
                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-2">{result.content}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {/* 来源标签 */}
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded',
                        getSourceStyle(result.source)
                      )}>
                        {result.source === 'khoj' ? 'Khoj' : 'Echo'}
                      </span>
                      
                      {/* 类型标签 */}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <TypeIcon className="h-3 w-3" />
                        {result.type === 'note' ? '笔记' : 
                         result.type === 'task' ? '任务' : 
                         result.type === 'memory' ? '记忆' : '文档'}
                      </span>
                      
                      {/* 相关度 */}
                      <span className="text-xs text-muted-foreground">
                        {(result.score * 100).toFixed(0)}% 相关
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 空状态 */}
      {!isSearching && query && results.length === 0 && (
        <div className="text-center py-8">
          <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">未找到相关结果</p>
          <p className="text-xs text-muted-foreground mt-1">
            尝试使用不同的关键词搜索
          </p>
        </div>
      )}
    </div>
  );
}
