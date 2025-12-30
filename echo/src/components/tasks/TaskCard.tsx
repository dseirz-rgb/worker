/**
 * 任务卡片组件
 * 显示单个任务，支持完成、编辑和删除
 */

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Edit2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, TaskPriority, LifeDomain } from "@/types/database";

// 优先级配置
const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  urgent: { label: "紧急", color: "bg-red-500 text-white" },
  high: { label: "高", color: "bg-orange-500 text-white" },
  medium: { label: "中", color: "bg-yellow-500 text-black" },
  low: { label: "低", color: "bg-gray-400 text-white" },
};

// 领域颜色
const DOMAIN_COLORS: Record<LifeDomain, string> = {
  work: "bg-blue-100 text-blue-700",
  investment: "bg-green-100 text-green-700",
  development: "bg-purple-100 text-purple-700",
  learning: "bg-yellow-100 text-yellow-700",
  family: "bg-pink-100 text-pink-700",
  health: "bg-red-100 text-red-700",
  entertainment: "bg-orange-100 text-orange-700",
  general: "bg-gray-100 text-gray-700",
};

const DOMAIN_LABELS: Record<LifeDomain, string> = {
  work: "工作",
  investment: "投资",
  development: "开发",
  learning: "学习",
  family: "家庭",
  health: "健康",
  entertainment: "娱乐",
  general: "通用",
};

interface TaskCardProps {
  task: Task;
  onComplete?: (id: string) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function TaskCard({ task, onComplete, onEdit, onDelete, className }: TaskCardProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const isCompleted = task.status === "completed";

  // 计算截止日期状态
  const getDeadlineStatus = () => {
    if (!task.deadline || isCompleted) return null;
    const deadline = new Date(task.deadline);
    const now = new Date();
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: "已过期", color: "text-red-500" };
    if (diffDays === 0) return { text: "今天", color: "text-orange-500" };
    if (diffDays === 1) return { text: "明天", color: "text-yellow-600" };
    if (diffDays <= 7) return { text: `${diffDays} 天后`, color: "text-blue-500" };
    return { text: deadline.toLocaleDateString("zh-CN"), color: "text-muted-foreground" };
  };

  const deadlineStatus = getDeadlineStatus();

  // 处理完成
  const handleComplete = () => {
    onComplete?.(task.id);
  };

  // 处理删除
  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(task.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const priorityConfig = PRIORITY_CONFIG[task.priority];

  return (
    <Card className={cn("group hover:shadow-md transition-shadow", isCompleted && "opacity-60", className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* 完成复选框 */}
          <Checkbox
            checked={isCompleted}
            onCheckedChange={handleComplete}
            className="mt-1"
          />

          <div className="flex-1 min-w-0">
            {/* 标题 */}
            <h3 className={cn("font-medium", isCompleted && "line-through text-muted-foreground")}>
              {task.title}
            </h3>

            {/* 描述 */}
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* 标签行 */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* 优先级 */}
              <Badge className={cn("text-xs", priorityConfig.color)}>
                {priorityConfig.label}
              </Badge>

              {/* 领域 */}
              <Badge variant="outline" className={cn("text-xs", DOMAIN_COLORS[task.domain])}>
                {DOMAIN_LABELS[task.domain]}
              </Badge>

              {/* 截止日期 */}
              {deadlineStatus && (
                <span className={cn("flex items-center gap-1 text-xs", deadlineStatus.color)}>
                  {deadlineStatus.color === "text-red-500" ? (
                    <AlertCircle className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  {deadlineStatus.text}
                </span>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(task)}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
