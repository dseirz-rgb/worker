/**
 * 任务列表组件
 * 支持筛选和排序
 */

import * as React from "react";
import { TaskCard } from "./TaskCard";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types/database";

// 状态筛选选项
const STATUS_OPTIONS: { value: TaskStatus | "all"; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "全部", icon: null },
  { value: "pending", label: "待办", icon: <Circle className="h-3.5 w-3.5" /> },
  { value: "in_progress", label: "进行中", icon: <Clock className="h-3.5 w-3.5" /> },
  { value: "completed", label: "已完成", icon: <CheckCircle className="h-3.5 w-3.5" /> },
];

interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  onFilterStatus?: (status: TaskStatus | undefined) => void;
  onComplete?: (id: string) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function TaskList({
  tasks,
  isLoading = false,
  onFilterStatus,
  onComplete,
  onEdit,
  onDelete,
  className,
}: TaskListProps) {
  const [selectedStatus, setSelectedStatus] = React.useState<TaskStatus | "all">("all");

  // 处理状态筛选
  const handleStatusFilter = (status: TaskStatus | "all") => {
    setSelectedStatus(status);
    onFilterStatus?.(status === "all" ? undefined : status);
  };

  // 分组任务
  const groupedTasks = React.useMemo(() => {
    const overdue: Task[] = [];
    const today: Task[] = [];
    const upcoming: Task[] = [];
    const noDeadline: Task[] = [];
    const completed: Task[] = [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    tasks.forEach((task) => {
      if (task.status === "completed") {
        completed.push(task);
        return;
      }

      if (!task.deadline) {
        noDeadline.push(task);
        return;
      }

      const deadline = new Date(task.deadline);
      if (deadline < now) {
        overdue.push(task);
      } else if (deadline <= todayEnd) {
        today.push(task);
      } else {
        upcoming.push(task);
      }
    });

    return { overdue, today, upcoming, noDeadline, completed };
  }, [tasks]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* 状态筛选 */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={selectedStatus === option.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleStatusFilter(option.value)}
            className="gap-1"
          >
            {option.icon}
            {option.label}
          </Button>
        ))}
      </div>

      {/* 加载状态 */}
      {isLoading && tasks.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && tasks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>还没有任务</p>
          <p className="text-sm mt-1">添加你的第一个任务吧</p>
        </div>
      )}

      {/* 任务分组显示 */}
      {tasks.length > 0 && (
        <div className="space-y-6">
          {/* 已过期 */}
          {groupedTasks.overdue.length > 0 && (
            <TaskGroup
              title="已过期"
              tasks={groupedTasks.overdue}
              titleClassName="text-red-500"
              onComplete={onComplete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}

          {/* 今天 */}
          {groupedTasks.today.length > 0 && (
            <TaskGroup
              title="今天"
              tasks={groupedTasks.today}
              titleClassName="text-orange-500"
              onComplete={onComplete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}

          {/* 即将到来 */}
          {groupedTasks.upcoming.length > 0 && (
            <TaskGroup
              title="即将到来"
              tasks={groupedTasks.upcoming}
              onComplete={onComplete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}

          {/* 无截止日期 */}
          {groupedTasks.noDeadline.length > 0 && (
            <TaskGroup
              title="无截止日期"
              tasks={groupedTasks.noDeadline}
              titleClassName="text-muted-foreground"
              onComplete={onComplete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}

          {/* 已完成 */}
          {groupedTasks.completed.length > 0 && selectedStatus !== "pending" && selectedStatus !== "in_progress" && (
            <TaskGroup
              title="已完成"
              tasks={groupedTasks.completed}
              titleClassName="text-green-500"
              onComplete={onComplete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}
        </div>
      )}
    </div>
  );
}

// 任务分组组件
interface TaskGroupProps {
  title: string;
  tasks: Task[];
  titleClassName?: string;
  onComplete?: (id: string) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
}

function TaskGroup({ title, tasks, titleClassName, onComplete, onEdit, onDelete }: TaskGroupProps) {
  return (
    <div>
      <h3 className={cn("text-sm font-medium mb-2", titleClassName)}>
        {title} ({tasks.length})
      </h3>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
