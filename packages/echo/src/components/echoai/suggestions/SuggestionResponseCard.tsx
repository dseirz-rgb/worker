/**
 * Echo v3.2: 建议响应卡片组件
 * 用于显示系统建议并允许用户响应 (接受/推迟/拒绝)
 */

import { useState } from 'react';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Input,
  Select,
  SelectItem,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';

// ============================================
// 类型定义
// ============================================

export interface Suggestion {
  id: number;
  type: 'task' | 'reminder' | 'habit' | 'insight';
  content: string;
  source: string | null;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'postponed' | 'rejected';
  createdAt: Date;
}

interface SuggestionResponseCardProps {
  suggestion: Suggestion;
  onRespond: (action: 'accept' | 'postpone' | 'reject', options?: {
    reason?: string;
    postponeDuration?: number;
  }) => void;
  isLoading?: boolean;
}

// 推迟时长选项
const POSTPONE_OPTIONS = [
  { key: '30', label: '30 分钟' },
  { key: '60', label: '1 小时' },
  { key: '180', label: '3 小时' },
  { key: '1440', label: '明天' },
  { key: '10080', label: '下周' },
];

// 类型图标映射
const TYPE_ICONS: Record<string, string> = {
  task: 'mdi:clipboard-check-outline',
  reminder: 'mdi:bell-outline',
  habit: 'mdi:repeat',
  insight: 'mdi:lightbulb-outline',
};

// 类型颜色映射
const TYPE_COLORS: Record<string, 'primary' | 'secondary' | 'success' | 'warning'> = {
  task: 'primary',
  reminder: 'warning',
  habit: 'success',
  insight: 'secondary',
};

// 优先级颜色映射
const PRIORITY_COLORS: Record<string, 'danger' | 'warning' | 'default'> = {
  high: 'danger',
  medium: 'warning',
  low: 'default',
};

// ============================================
// 组件
// ============================================

export function SuggestionResponseCard({
  suggestion,
  onRespond,
  isLoading = false,
}: SuggestionResponseCardProps) {
  const [isPostponeOpen, setIsPostponeOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [postponeDuration, setPostponeDuration] = useState('60');
  const [rejectReason, setRejectReason] = useState('');

  // 处理接受
  const handleAccept = () => {
    onRespond('accept');
  };

  // 处理推迟
  const handlePostpone = () => {
    onRespond('postpone', { postponeDuration: Number(postponeDuration) });
    setIsPostponeOpen(false);
  };

  // 处理拒绝
  const handleReject = () => {
    onRespond('reject', { reason: rejectReason || undefined });
    setIsRejectOpen(false);
    setRejectReason('');
  };

  return (
    <Card
      className={`w-full border-l-4 ${
        suggestion.priority === 'high'
          ? 'border-l-danger'
          : suggestion.priority === 'medium'
          ? 'border-l-warning'
          : 'border-l-default'
      }`}
      shadow="sm"
    >
      <CardBody className="p-4 space-y-3">
        {/* 头部: 类型和优先级 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${TYPE_COLORS[suggestion.type]}/10`}>
              <Icon
                icon={TYPE_ICONS[suggestion.type]}
                className={`w-4 h-4 text-${TYPE_COLORS[suggestion.type]}`}
              />
            </div>
            <Chip size="sm" variant="flat" color={TYPE_COLORS[suggestion.type]}>
              {suggestion.type === 'task' && '任务'}
              {suggestion.type === 'reminder' && '提醒'}
              {suggestion.type === 'habit' && '习惯'}
              {suggestion.type === 'insight' && '洞察'}
            </Chip>
          </div>
          <Chip size="sm" variant="dot" color={PRIORITY_COLORS[suggestion.priority]}>
            {suggestion.priority === 'high' && '高优先'}
            {suggestion.priority === 'medium' && '中优先'}
            {suggestion.priority === 'low' && '低优先'}
          </Chip>
        </div>

        {/* 内容 */}
        <p className="text-sm text-foreground/90">{suggestion.content}</p>

        {/* 来源 */}
        {suggestion.source && (
          <p className="text-xs text-foreground/50 flex items-center gap-1">
            <Icon icon="mdi:information-outline" className="w-3 h-3" />
            来源: {suggestion.source}
          </p>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 pt-2">
          {/* 接受按钮 */}
          <Button
            size="sm"
            color="success"
            variant="flat"
            onPress={handleAccept}
            isLoading={isLoading}
            startContent={!isLoading && <Icon icon="mdi:check" className="w-4 h-4" />}
          >
            接受
          </Button>

          {/* 推迟按钮 */}
          <Popover
            isOpen={isPostponeOpen}
            onOpenChange={setIsPostponeOpen}
            placement="bottom"
          >
            <PopoverTrigger>
              <Button
                size="sm"
                variant="flat"
                startContent={<Icon icon="mdi:clock-outline" className="w-4 h-4" />}
              >
                稍后
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-3 w-48">
              <div className="space-y-3">
                <Select
                  size="sm"
                  label="推迟时间"
                  selectedKeys={[postponeDuration]}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) setPostponeDuration(selected);
                  }}
                >
                  {POSTPONE_OPTIONS.map((option) => (
                    <SelectItem key={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </Select>
                <Button
                  size="sm"
                  color="primary"
                  className="w-full"
                  onPress={handlePostpone}
                >
                  确认推迟
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* 拒绝按钮 */}
          <Popover
            isOpen={isRejectOpen}
            onOpenChange={setIsRejectOpen}
            placement="bottom"
          >
            <PopoverTrigger>
              <Button
                size="sm"
                variant="light"
                color="danger"
                startContent={<Icon icon="mdi:close" className="w-4 h-4" />}
              >
                忽略
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-3 w-56">
              <div className="space-y-3">
                <Input
                  size="sm"
                  label="原因 (可选)"
                  placeholder="为什么忽略这个建议?"
                  value={rejectReason}
                  onValueChange={setRejectReason}
                />
                <Button
                  size="sm"
                  color="danger"
                  variant="flat"
                  className="w-full"
                  onPress={handleReject}
                >
                  确认忽略
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardBody>
    </Card>
  );
}

export default SuggestionResponseCard;
