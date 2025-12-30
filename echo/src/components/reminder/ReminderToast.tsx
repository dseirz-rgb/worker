/**
 * 提醒弹窗组件
 * 用于显示实时提醒通知
 */

import { Button } from "@/components/ui/button";
import { Bell, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Reminder } from "@/types/database";

interface ReminderToastProps {
  reminder: Reminder;
  onDismiss: () => void;
  onSnooze: () => void;
  onAction?: () => void;
  className?: string;
}

export function ReminderToast({
  reminder,
  onDismiss,
  onSnooze,
  onAction,
  className,
}: ReminderToastProps) {
  return (
    <div
      className={cn(
        "fixed bottom-20 right-4 z-50 w-80 bg-background border rounded-lg shadow-lg p-4 animate-in slide-in-from-right",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* 图标 */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Bell className="h-5 w-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <h4 className="font-medium text-sm">{reminder.title}</h4>
          {/* 消息 */}
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {reminder.message}
          </p>

          {/* 操作按钮 */}
          <div className="flex gap-2 mt-3">
            {onAction && (
              <Button size="sm" onClick={onAction}>
                查看
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onSnooze}>
              <Clock className="h-3 w-3 mr-1" />
              稍后
            </Button>
          </div>
        </div>

        {/* 关闭按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -mt-1 -mr-1"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
