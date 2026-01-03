/**
 * 文本预览组件
 * 支持文本显示（保留格式）、复制按钮、搜索高亮
 */

import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button, Tooltip, Input, Chip } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { cn } from '@heroui/react';
import copy from 'copy-to-clipboard';

// ========== 类型定义 ==========

export interface TextViewerProps {
  /** 文本内容 */
  content: string;
  /** 自定义样式类名 */
  className?: string;
  /** 是否启用搜索功能 */
  enableSearch?: boolean;
  /** 是否显示行号 */
  showLineNumbers?: boolean;
}

// ========== 工具函数 ==========

/**
 * 高亮搜索关键词
 */
function highlightText(text: string, keyword: string): React.ReactNode[] {
  if (!keyword.trim()) {
    return [text];
  }

  const parts: React.ReactNode[] = [];
  const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi');
  const segments = text.split(regex);

  segments.forEach((segment, index) => {
    if (segment.toLowerCase() === keyword.toLowerCase()) {
      parts.push(
        <mark 
          key={index} 
          className="bg-warning/40 text-foreground rounded px-0.5"
        >
          {segment}
        </mark>
      );
    } else {
      parts.push(segment);
    }
  });

  return parts;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 统计匹配数量
 */
function countMatches(text: string, keyword: string): number {
  if (!keyword.trim()) return 0;
  const regex = new RegExp(escapeRegExp(keyword), 'gi');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

// ========== 主组件 ==========

export const TextViewer = memo(({ 
  content, 
  className,
  enableSearch = true,
  showLineNumbers = true,
}: TextViewerProps) => {
  // 状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const contentRef = useRef<HTMLPreElement>(null);

  // 文本行
  const lines = useMemo(() => content.split('\n'), [content]);

  // 匹配数量
  const matchCount = useMemo(
    () => countMatches(content, searchKeyword),
    [content, searchKeyword]
  );

  // 复制文本
  const handleCopy = useCallback(() => {
    const success = copy(content);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  }, [content]);

  // 切换搜索
  const handleToggleSearch = useCallback(() => {
    setIsSearchOpen(prev => !prev);
    if (isSearchOpen) {
      setSearchKeyword('');
    }
  }, [isSearchOpen]);

  // 清除搜索
  const handleClearSearch = useCallback(() => {
    setSearchKeyword('');
  }, []);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && enableSearch) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      // Escape 关闭搜索
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        setSearchKeyword('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableSearch, isSearchOpen]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 bg-default-100 border-b border-divider shrink-0">
        {/* 文件信息 */}
        <div className="flex items-center gap-2 text-sm text-foreground/70">
          <Icon icon="solar:text-linear" className="w-4 h-4" />
          <span>{lines.length} 行</span>
          <span className="text-foreground/40">·</span>
          <span>{content.length} 字符</span>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center gap-1">
          {/* 搜索按钮 */}
          {enableSearch && (
            <Tooltip content="搜索 (Ctrl+F)">
              <Button
                isIconOnly
                size="sm"
                variant={isSearchOpen ? 'flat' : 'light'}
                color={isSearchOpen ? 'primary' : 'default'}
                onPress={handleToggleSearch}
              >
                <Icon icon="solar:magnifer-linear" className="w-4 h-4" />
              </Button>
            </Tooltip>
          )}
          
          {/* 复制按钮 */}
          <Tooltip content={isCopied ? '已复制!' : '复制全部'}>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color={isCopied ? 'success' : 'default'}
              onPress={handleCopy}
            >
              <Icon 
                icon={isCopied ? 'solar:check-circle-bold' : 'solar:copy-linear'} 
                className="w-4 h-4" 
              />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* 搜索栏 */}
      {isSearchOpen && (
        <div className="flex items-center gap-2 px-3 py-2 bg-default-50 border-b border-divider">
          <Input
            size="sm"
            placeholder="搜索..."
            value={searchKeyword}
            onValueChange={setSearchKeyword}
            startContent={
              <Icon icon="solar:magnifer-linear" className="w-4 h-4 text-foreground/40" />
            }
            endContent={
              searchKeyword && (
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  className="min-w-6 w-6 h-6"
                  onPress={handleClearSearch}
                >
                  <Icon icon="solar:close-circle-linear" className="w-4 h-4" />
                </Button>
              )
            }
            classNames={{
              inputWrapper: 'h-8 min-h-8',
            }}
            autoFocus
          />
          
          {searchKeyword && (
            <Chip size="sm" variant="flat" color={matchCount > 0 ? 'success' : 'default'}>
              {matchCount} 个匹配
            </Chip>
          )}
        </div>
      )}

      {/* 文本内容 */}
      <div className="flex-1 overflow-auto bg-background">
        <pre
          ref={contentRef}
          className={cn(
            'font-mono text-sm leading-relaxed p-4 min-h-full',
            showLineNumbers && 'pl-0'
          )}
        >
          {showLineNumbers ? (
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index} className="hover:bg-default-100/50">
                    {/* 行号 */}
                    <td className="w-12 pr-4 text-right text-foreground/30 select-none align-top sticky left-0 bg-background">
                      {index + 1}
                    </td>
                    {/* 内容 */}
                    <td className="whitespace-pre-wrap break-all">
                      {searchKeyword 
                        ? highlightText(line, searchKeyword)
                        : line || '\u00A0' // 空行显示不可见字符保持高度
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <code className="whitespace-pre-wrap break-all">
              {searchKeyword 
                ? highlightText(content, searchKeyword)
                : content
              }
            </code>
          )}
        </pre>
      </div>
    </div>
  );
});

TextViewer.displayName = 'TextViewer';

export default TextViewer;
