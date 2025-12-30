/**
 * Dashboard 主页面
 * 显示 Echo 的主界面，包含快速笔记输入和概览
 */

import * as React from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NoteInput } from "@/components/notes";
import { createNote, getNotesCount } from "@/services/notes";
import { getTasksCount } from "@/services/database/taskService";
import { StickyNote, CheckSquare, MessageCircle, Sparkles } from "lucide-react";
import type { CreateNoteInput } from "@/types/database";

function Dashboard() {
  const [notesCount, setNotesCount] = React.useState(0);
  const [tasksCount, setTasksCount] = React.useState(0);
  const [pendingTasksCount, setPendingTasksCount] = React.useState(0);

  // 加载统计数据
  React.useEffect(() => {
    const loadStats = async () => {
      try {
        const [notes, tasks, pending] = await Promise.all([
          getNotesCount(),
          getTasksCount(),
          getTasksCount({ status: "pending" }),
        ]);
        if (notes.success) setNotesCount(notes.data || 0);
        if (tasks.success) setTasksCount(tasks.data || 0);
        if (pending.success) setPendingTasksCount(pending.data || 0);
      } catch (error) {
        console.warn("加载统计数据失败:", error);
      }
    };
    loadStats();
  }, []);

  // 创建笔记
  const handleCreateNote = async (input: CreateNoteInput) => {
    const result = await createNote(input);
    if (result.success) {
      setNotesCount((prev) => prev + 1);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      {/* 头部 */}
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Echo</h1>
        </div>
        <p className="text-muted-foreground">你的 AI 第二大脑</p>
      </header>

      {/* 快速笔记输入 */}
      <section className="mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">快速记录</CardTitle>
          </CardHeader>
          <CardContent>
            <NoteInput onSubmit={handleCreateNote} placeholder="记录一个想法..." />
          </CardContent>
        </Card>
      </section>

      {/* 功能卡片 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/notes">
          <FeatureCard
            title="笔记"
            description="快速捕捉想法"
            icon={<StickyNote className="h-6 w-6" />}
            count={notesCount}
            color="text-blue-500"
          />
        </Link>
        <Link href="/tasks">
          <FeatureCard
            title="任务"
            description={`${pendingTasksCount} 个待办`}
            icon={<CheckSquare className="h-6 w-6" />}
            count={tasksCount}
            color="text-green-500"
          />
        </Link>
        <Link href="/chat">
          <FeatureCard
            title="对话"
            description="与 AI 交流"
            icon={<MessageCircle className="h-6 w-6" />}
            color="text-purple-500"
          />
        </Link>
      </section>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  count?: number;
  color?: string;
}

function FeatureCard({ title, description, icon, count, color }: FeatureCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className={color}>{icon}</span>
          {count !== undefined && (
            <span className="text-2xl font-bold">{count}</span>
          )}
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default Dashboard;
