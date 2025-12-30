/**
 * 提醒卡片组件
 */

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Reminder } from "@/types/database";

// 优先级配置
const PRIORITY_CONFIG = {
  urgent: { label: "紧急", color: "bg-red-500 text-white" },
  high: { label: "高", color: "bg-orange-500 text-white" },
  medium: { label: "中", color: "bg-yellow-500 text-black" },
  low: { label: "低", color: "bg-gray-400 text-white" },
};

// 类型标签
const TYPE_LABELS: Record<Reminder["type"], string> = {
  task_deadline: "任务截止",
  habit_reminder: "习惯提醒",
  emotional_feedback: "情绪反馈",
  family_care: "家庭关怀",
  health_alert: "健康提醒",
  learning_prompt: "学习提示",
  investment_warning: "投资警告",
};

interface ReminderCardProps {
  reminder: Reminder;
  onDismiss?: (id: string) => void;
  onSnooze?: (id: string) => void;
  onAction?: (reminder: Reminder) => void;
  className?: string;
}

export function ReminderCard({
  reminder,
  onDismiss,
  onSnooze,
  onAction,
  className,
}: ReminderCardProps) {
  const priorityConfig = PRIORITY_CONFIG[reminder.priority];

  return (
    <Card className={cn("border-l-4", `border-l-${reminder.priority === 'urgent' ? 'red' : reminder.priority === 'high' ? 'orange' : 'yellow'}-500`, className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* 图标 */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            {/* 标题和标签 */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{reminder.title}</h3>
              <Badge className={cn("text-xs", priorityConfig.color)}>
                {priorityConfig.label}
              </Badge>
            </div>

            {/* 消息 */}
            <p className="text-sm text-muted-foreground mb-2">
              {reminder.message}
            </p>

            {/* 类型和时间 */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{TYPE_LABELS[reminder.type]}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(reminder.scheduledAt).toLocaleString("zh-CN")}
              </span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-1">
            {onAction && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onAction(reminder)}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            {onSnooze && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onSnooze(reminder.id)}
              >
                <Clock className="h-4 w-4" />
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDismiss(reminder.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
