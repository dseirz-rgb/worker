/**
 * 语音笔记卡片组件
 * 
 * 功能：
 * - 显示语音笔记信息
 * - 转写文本展示
 * - 行动项列表
 * - 关联任务状态
 * - 播放音频（如果有）
 */

import * as React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Mic,
  User,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Trash2,
  ExternalLink,
  Sparkles,
  ListTodo,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/services/voice';
import type { VoiceNote, ActionItem, LifeDomain, TaskPriority } from '@/types/database';

// ==================
// 类型定义
// ==================

interface VoiceNoteCardProps {
  voiceNote: VoiceNote;
  onDelete?: (id: string) => void;
  onActionItemToggle?: (voiceNoteId: string, actionItemId: string, completed: boolean) => void;
  onViewTask?: (taskId: string) => void;
  className?: string;
  variant?: 'default' | 'compact';
}

// 领域配置
const DOMAIN_CONFIG: Record<LifeDomain, { color: string; bgColor: string; label: string; emoji: string }> = {
  work: { color: 'text-blue-600', bgColor: 'bg-blue-500', label: '工作', emoji: '💼' },
  investment: { color: 'text-green-600', bgColor: 'bg-green-500', label: '投资', emoji: '📈' },
  development: { color: 'text-purple-600', bgColor: 'bg-purple-500', label: '开发', emoji: '💻' },
  learning: { color: 'text-yellow-600', bgColor: 'bg-yellow-500', label: '学习', emoji: '📚' },
  family: { color: 'text-pink-600', bgColor: 'bg-pink-500', label: '家庭', emoji: '👨‍👩‍👧' },
  health: { color: 'text-red-600', bgColor: 'bg-red-500', label: '健康', emoji: '🏃' },
  entertainment: { color: 'text-orange-600', bgColor: 'bg-orange-500', label: '娱乐', emoji: '🎮' },
  general: { color: 'text-gray-600', bgColor: 'bg-gray-500', label: '通用', emoji: '📝' },
};

// 优先级配置
const PRIORITY_CONFIG: Record<TaskPriority, { color: string; label: string }> = {
  low: { color: 'text-gray-500', label: '低' },
  medium: { color: 'text-blue-500', label: '中' },
  high: { color: 'text-orange-500', label: '高' },
  urgent: { color: 'text-red-500', label: '紧急' },
};

// ==================
// 组件实现
// ==================

export function VoiceNoteCard({
  voiceNote,
  onDelete,
  onActionItemToggle,
  onViewTask,
  className,
  variant = 'default',
}: VoiceNoteCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const domainConfig = DOMAIN_CONFIG[voiceNote.domain];
  const completedActions = voiceNote.actionItems.filter(a => a.isCompleted).length;
  const totalActions = voiceNote.actionItems.length;

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // 处理删除
  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(voiceNote.id);
    } finally {
      setIsDeleting(false);
    }
  };

  // 紧凑模式
  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer',
          className
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={cn('p-1.5 rounded-full', domainConfig.bgColor, 'bg-opacity-20')}>
          <Mic className={cn('h-4 w-4', domainConfig.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm line-clamp-2">{voiceNote.transcript}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {formatDuration(voiceNote.audioDuration)}
            </span>
            {totalActions > 0 && (
              <span className="text-xs text-muted-foreground">
                {completedActions}/{totalActions} 行动项
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatTime(voiceNote.createdAt)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 默认模式
  return (
    <Card className={cn('group hover:shadow-md transition-all', className)}>
      <CardHeader className="pb-2">
        {/* 头部：领域 + 时长 + 时间 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded-full', domainConfig.bgColor, 'bg-opacity-20')}>
              <Mic className={cn('h-4 w-4', domainConfig.color)} />
            </div>
            <span className={cn('text-xs font-medium', domainConfig.color)}>
              {domainConfig.emoji} {domainConfig.label}
            </span>
            <Badge variant="outline" className="text-xs">
              {formatDuration(voiceNote.audioDuration)}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formatTime(voiceNote.createdAt)}
            </span>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* AI 摘要 */}
        {voiceNote.summary && (
          <div className="p-2 bg-primary/5 rounded-md border border-primary/10">
            <div className="flex items-center gap-1 text-xs text-primary mb-1">
              <Sparkles className="h-3 w-3" />
              AI 摘要
            </div>
            <p className="text-sm">{voiceNote.summary}</p>
          </div>
        )}

        {/* 转写文本 */}
        <div>
          <p className={cn('text-sm', !isExpanded && 'line-clamp-3')}>
            {voiceNote.transcript}
          </p>
          {voiceNote.transcript.length > 150 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-6 px-2 text-xs"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  展开
                </>
              )}
            </Button>
          )}
        </div>

        {/* 行动项 */}
        {voiceNote.actionItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">
                行动项 ({completedActions}/{totalActions})
              </span>
            </div>
            <div className="space-y-1.5">
              {voiceNote.actionItems.map((item) => (
                <ActionItemRow
                  key={item.id}
                  item={item}
                  onToggle={(completed) =>
                    onActionItemToggle?.(voiceNote.id, item.id, completed)
                  }
                  onViewTask={onViewTask}
                />
              ))}
            </div>
          </div>
        )}

        {/* 提及的人员 */}
        {voiceNote.mentions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            {voiceNote.mentions.map((name) => (
              <Badge key={name} variant="secondary" className="text-xs">
                {name}
              </Badge>
            ))}
          </div>
        )}

        {/* 关键词 */}
        {voiceNote.keywords.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {voiceNote.keywords.map((keyword) => (
              <Badge key={keyword} variant="outline" className="text-xs">
                <Hash className="h-2.5 w-2.5 mr-0.5" />
                {keyword}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        {/* 关联信息 */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {voiceNote.noteId && (
            <span className="flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              已创建笔记
            </span>
          )}
          {voiceNote.taskIds.length > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              已创建 {voiceNote.taskIds.length} 个任务
            </span>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

// ==================
// 行动项行组件
// ==================

interface ActionItemRowProps {
  item: ActionItem;
  onToggle?: (completed: boolean) => void;
  onViewTask?: (taskId: string) => void;
}

function ActionItemRow({ item, onToggle, onViewTask }: ActionItemRowProps) {
  const priorityConfig = PRIORITY_CONFIG[item.priority];

  return (
    <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
      <Checkbox
        checked={item.isCompleted}
        onCheckedChange={(checked) => onToggle?.(checked as boolean)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm',
            item.isCompleted && 'line-through text-muted-foreground'
          )}
        >
          {item.content}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {/* 优先级 */}
          <span className={cn('text-xs', priorityConfig.color)}>
            {priorityConfig.label}优先级
          </span>
          
          {/* 负责人 */}
          {item.assignee && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <User className="h-3 w-3" />
              {item.assignee}
            </span>
          )}
          
          {/* 截止日期 */}
          {item.deadline && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              {new Date(item.deadline).toLocaleDateString('zh-CN', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
          
          {/* 查看任务 */}
          {item.taskId && onViewTask && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs"
              onClick={() => onViewTask(item.taskId!)}
            >
              <ExternalLink className="h-3 w-3 mr-0.5" />
              查看任务
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================
// 语音笔记列表组件
// ==================

interface VoiceNoteListProps {
  voiceNotes: VoiceNote[];
  onDelete?: (id: string) => void;
  onActionItemToggle?: (voiceNoteId: string, actionItemId: string, completed: boolean) => void;
  onViewTask?: (taskId: string) => void;
  emptyMessage?: string;
  className?: string;
}

export function VoiceNoteList({
  voiceNotes,
  onDelete,
  onActionItemToggle,
  onViewTask,
  emptyMessage = '暂无语音笔记',
  className,
}: VoiceNoteListProps) {
  if (voiceNotes.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <Mic className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {voiceNotes.map((voiceNote) => (
        <VoiceNoteCard
          key={voiceNote.id}
          voiceNote={voiceNote}
          onDelete={onDelete}
          onActionItemToggle={onActionItemToggle}
          onViewTask={onViewTask}
        />
      ))}
    </div>
  );
}

export default VoiceNoteCard;
