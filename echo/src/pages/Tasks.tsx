/**
 * 任务页面
 * 待办事项管理
 */

import * as React from "react";
import { TaskInput, TaskList } from "@/components/tasks";
import {
  createTask,
  getTasks,
  deleteTask,
  updateTask,
} from "@/services/database/taskService";
import type { Task, CreateTaskInput, TaskStatus } from "@/types/database";

export function TasksPage() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentStatus, setCurrentStatus] = React.useState<TaskStatus | undefined>();

  // 加载任务
  const loadTasks = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getTasks({ status: currentStatus });
      if (result.success && result.data) {
        setTasks(result.data);
      }
    } catch (error) {
      console.error("加载任务失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentStatus]);

  // 初始加载
  React.useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // 创建任务
  const handleCreate = async (input: CreateTaskInput) => {
    const result = await createTask(input);
    if (result.success && result.data) {
      setTasks((prev) => [result.data!, ...prev]);
    }
  };

  // 完成任务
  const handleComplete = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    // 切换完成状态
    const newStatus = task.status === "completed" ? "pending" : "completed";
    const result = await updateTask(id, { status: newStatus });
    
    if (result.success && result.data) {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? result.data! : t))
      );
    }
  };

  // 删除任务
  const handleDelete = async (id: string) => {
    const result = await deleteTask(id);
    if (result.success) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  };

  // 筛选状态
  const handleFilterStatus = (status: TaskStatus | undefined) => {
    setCurrentStatus(status);
  };

  // 编辑任务（暂时只打印）
  const handleEdit = (task: Task) => {
    console.log("编辑任务:", task);
    // TODO: 实现编辑弹窗
  };

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">待办事项</h1>
        <p className="text-muted-foreground">管理你的任务</p>
      </div>

      {/* 任务输入 */}
      <TaskInput onSubmit={handleCreate} />

      {/* 任务列表 */}
      <TaskList
        tasks={tasks}
        isLoading={isLoading}
        onFilterStatus={handleFilterStatus}
        onComplete={handleComplete}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}

export default TasksPage;
