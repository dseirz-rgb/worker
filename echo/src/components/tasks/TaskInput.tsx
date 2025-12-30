/**
 * 任务输入组件
 * 快速创建任务
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreateTaskInput, TaskPriority, LifeDomain } from "@/types/database";

// 优先级选项
const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "low", label: "低", color: "bg-gray-400" },
  { value: "medium", label: "中", color: "bg-yellow-500" },
  { value: "high", label: "高", color: "bg-orange-500" },
  { value: "urgent", label: "紧急", color: "bg-red-500" },
];

// 领域选项
const DOMAIN_OPTIONS: { value: LifeDomain; label: string }[] = [
  { value: "work", label: "工作" },
  { value: "investment", label: "投资" },
  { value: "development", label: "开发" },
  { value: "learning", label: "学习" },
  { value: "family", label: "家庭" },
  { value: "health", label: "健康" },
  { value: "entertainment", label: "娱乐" },
  { value: "general", label: "通用" },
];

interface TaskInputProps {
  onSubmit: (input: CreateTaskInput) => Promise<void>;
  className?: string;
}

export function TaskInput({ onSubmit, className }: TaskInputProps) {
  const [title, setTitle] = React.useState("");
  const [priority, setPriority] = React.useState<TaskPriority>("medium");
  const [domain, setDomain] = React.useState<LifeDomain>("general");
  const [deadline, setDeadline] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showOptions, setShowOptions] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 提交任务
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: trimmedTitle,
        priority,
        domain,
        deadline: deadline || undefined,
      });
      // 清空输入
      setTitle("");
      setDeadline("");
      setShowOptions(false);
      inputRef.current?.focus();
    } catch (error) {
      console.error("创建任务失败:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowOptions(true)}
          placeholder="添加新任务..."
          className="flex-1"
          disabled={isSubmitting}
        />
        <Button type="submit" disabled={!title.trim() || isSubmitting}>
          <Plus className="h-4 w-4 mr-1" />
          添加
        </Button>
      </form>

      {/* 选项面板 */}
      {showOptions && (
        <div className="flex items-center gap-4 flex-wrap p-3 bg-muted/50 rounded-lg">
          {/* 优先级 */}
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-1">
              {PRIORITY_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={priority === option.value ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setPriority(option.value)}
                >
                  <span className={cn("w-2 h-2 rounded-full mr-1", option.color)} />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 截止日期 */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="h-7 w-36"
            />
          </div>

          {/* 领域 */}
          <div className="flex items-center gap-1 flex-wrap">
            {DOMAIN_OPTIONS.map((option) => (
              <Badge
                key={option.value}
                variant={domain === option.value ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setDomain(option.value)}
              >
                {option.label}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
