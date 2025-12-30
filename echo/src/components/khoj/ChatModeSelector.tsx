/**
 * 对话模式选择器组件
 * 用于切换 Echo/Khoj/混合 三种对话模式
 */

import * as React from 'react';
import { Button } from '../ui/button';
import { Brain, Sparkles, Zap } from 'lucide-react';
import { unifiedChatService, type ChatMode } from '../../services/chat/unifiedChat';
import { cn } from '../../lib/utils';

interface ChatModeSelectorProps {
  /** 模式变更回调 */
  onChange?: (mode: ChatMode) => void;
  /** 自定义类名 */
  className?: string;
}

/** 模式配置 */
const MODES: { value: ChatMode; label: string; icon: React.ElementType; description: string }[] = [
  {
    value: 'echo',
    label: 'Echo',
    icon: Sparkles,
    description: '使用 Echo 原生 AI',
  },
  {
    value: 'khoj',
    label: 'Khoj',
    icon: Brain,
    description: '使用 Khoj 知识库',
  },
  {
    value: 'hybrid',
    label: '混合',
    icon: Zap,
    description: '智能选择最佳模式',
  },
];

export function ChatModeSelector({ onChange, className }: ChatModeSelectorProps) {
  const [mode, setMode] = React.useState<ChatMode>(() => unifiedChatService.getMode());

  const handleModeChange = (newMode: ChatMode) => {
    setMode(newMode);
    unifiedChatService.setMode(newMode);
    onChange?.(newMode);
  };

  return (
    <div className={cn('flex gap-1 p-1 bg-muted rounded-lg', className)}>
      {MODES.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          variant={mode === value ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            'flex-1 gap-1.5 h-8',
            mode === value && 'shadow-sm'
          )}
          onClick={() => handleModeChange(value)}
          title={MODES.find(m => m.value === value)?.description}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="text-xs">{label}</span>
        </Button>
      ))}
    </div>
  );
}
