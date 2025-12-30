/**
 * Agent 选择器组件
 * 用于选择 Khoj Agent
 */

import * as React from 'react';
import { Button } from '../ui/button';
import { Bot, ChevronDown, Check, Loader2 } from 'lucide-react';
import { unifiedChatService } from '../../services/chat/unifiedChat';
import type { KhojAgent } from '../../types/khoj';
import { cn } from '../../lib/utils';

interface AgentSelectorProps {
  /** 选择 Agent 回调 */
  onSelect?: (agent: KhojAgent | null) => void;
  /** 自定义类名 */
  className?: string;
}

export function AgentSelector({ onSelect, className }: AgentSelectorProps) {
  const [agents, setAgents] = React.useState<KhojAgent[]>([]);
  const [selected, setSelected] = React.useState<KhojAgent | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // 加载 Agent 列表
  React.useEffect(() => {
    loadAgents();
  }, []);

  // 点击外部关闭下拉菜单
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAgents = async () => {
    setIsLoading(true);
    try {
      const availableAgents = await unifiedChatService.getAvailableAgents();
      setAgents(availableAgents);
    } catch (error) {
      console.warn('加载 Agent 列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (agent: KhojAgent | null) => {
    setSelected(agent);
    setIsOpen(false);
    unifiedChatService.setAgent(agent?.slug || null);
    onSelect?.(agent);
  };

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
        <span className="max-w-[100px] truncate">
          {selected?.name || '默认助手'}
        </span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
      </Button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-popover border rounded-lg shadow-lg z-50 py-1">
          {/* 默认助手选项 */}
          <button
            className={cn(
              'w-full px-3 py-2 text-left hover:bg-accent flex items-start gap-2',
              !selected && 'bg-accent/50'
            )}
            onClick={() => handleSelect(null)}
          >
            <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">默认助手</p>
              <p className="text-xs text-muted-foreground">Echo 原生 AI 助手</p>
            </div>
            {!selected && <Check className="h-4 w-4 text-primary mt-0.5" />}
          </button>

          {/* Agent 列表 */}
          {agents.length > 0 && (
            <>
              <div className="h-px bg-border my-1" />
              {agents.map((agent) => (
                <button
                  key={agent.slug}
                  className={cn(
                    'w-full px-3 py-2 text-left hover:bg-accent flex items-start gap-2',
                    selected?.slug === agent.slug && 'bg-accent/50'
                  )}
                  onClick={() => handleSelect(agent)}
                >
                  {agent.avatar ? (
                    <img
                      src={agent.avatar}
                      alt={agent.name}
                      className="h-4 w-4 rounded-full mt-0.5 flex-shrink-0"
                    />
                  ) : (
                    <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{agent.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {agent.personality}
                    </p>
                  </div>
                  {selected?.slug === agent.slug && (
                    <Check className="h-4 w-4 text-primary mt-0.5" />
                  )}
                </button>
              ))}
            </>
          )}

          {/* 空状态 */}
          {agents.length === 0 && !isLoading && (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center">
              暂无可用 Agent
            </div>
          )}
        </div>
      )}
    </div>
  );
}
