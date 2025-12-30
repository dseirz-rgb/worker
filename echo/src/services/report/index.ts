/**
 * 报告服务
 * 生成日报和周报
 */

import { getGeminiClient } from '../ai/gemini';
import { getNotes } from '../notes';
import { getTasks } from '../database/taskService';
import type { Note, Task, LifeDomain } from '../../types/database';

// 日报数据
export interface DailyReport {
  date: string;
  summary: string;
  highlights: string[];
  completedTasks: Task[];
  pendingTasks: Task[];
  notes: Note[];
  suggestions: Suggestion[];
  stats: DailyStats;
}

// 周报数据
export interface WeeklyReport {
  startDate: string;
  endDate: string;
  summary: string;
  achievements: Achievement[];
  taskStats: TaskStats;
  domainBreakdown: DomainBreakdown[];
  insights: string[];
  nextWeekGoals: string[];
}

// 建议
export interface Suggestion {
  id: string;
  content: string;
  type: 'task' | 'habit' | 'reminder' | 'insight';
  priority: 'low' | 'medium' | 'high';
  accepted?: boolean;
}

// 成就
export interface Achievement {
  title: string;
  description: string;
  metric?: string;
}

// 每日统计
export interface DailyStats {
  tasksCompleted: number;
  tasksCreated: number;
  notesCreated: number;
  focusTime?: number;
}

// 任务统计
export interface TaskStats {
  total: number;
  completed: number;
  completionRate: number;
  byPriority: Record<string, number>;
}

// 领域分布
export interface DomainBreakdown {
  domain: LifeDomain;
  taskCount: number;
  noteCount: number;
  percentage: number;
}

/**
 * 生成日报
 */
export async function generateDailyReport(date?: Date): Promise<DailyReport> {
  const targetDate = date || new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // 获取当天数据
  const [notesResult, tasksResult] = await Promise.all([
    getNotes({ limit: 100 }),
    getTasks({ limit: 100 }),
  ]);

  const notes = (notesResult.data || []).filter((n) => {
    const created = new Date(n.createdAt);
    return created >= startOfDay && created <= endOfDay;
  });

  const allTasks = tasksResult.data || [];
  const completedTasks = allTasks.filter((t) => {
    if (t.status !== 'completed' || !t.completedAt) return false;
    const completed = new Date(t.completedAt);
    return completed >= startOfDay && completed <= endOfDay;
  });

  const pendingTasks = allTasks.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress'
  );

  // 生成 AI 总结
  const client = getGeminiClient();
  const context = buildDailyContext(notes, completedTasks, pendingTasks);

  let summary = '';
  let highlights: string[] = [];
  let suggestions: Suggestion[] = [];

  try {
    const prompt = `基于以下今日数据，生成一份简洁的日报总结：

${context}

请以 JSON 格式返回：
{
  "summary": "今日总结（2-3句话）",
  "highlights": ["亮点1", "亮点2"],
  "suggestions": [
    {"content": "建议内容", "type": "task/habit/reminder/insight", "priority": "low/medium/high"}
  ]
}

只返回 JSON，不要其他内容。`;

    const response = await client.generateContent(prompt, {
      generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      summary = parsed.summary || '';
      highlights = parsed.highlights || [];
      suggestions = (parsed.suggestions || []).map((s: Suggestion, i: number) => ({
        ...s,
        id: `suggestion-${i}`,
      }));
    }
  } catch (error) {
    console.error('生成日报 AI 总结失败:', error);
    summary = `今日完成 ${completedTasks.length} 个任务，记录 ${notes.length} 条笔记。`;
  }

  return {
    date: targetDate.toISOString().split('T')[0],
    summary,
    highlights,
    completedTasks,
    pendingTasks: pendingTasks.slice(0, 5),
    notes: notes.slice(0, 10),
    suggestions,
    stats: {
      tasksCompleted: completedTasks.length,
      tasksCreated: allTasks.filter((t) => {
        const created = new Date(t.createdAt);
        return created >= startOfDay && created <= endOfDay;
      }).length,
      notesCreated: notes.length,
    },
  };
}

/**
 * 生成周报
 */
export async function generateWeeklyReport(endDate?: Date): Promise<WeeklyReport> {
  const end = endDate || new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 7);

  // 获取一周数据
  const [notesResult, tasksResult] = await Promise.all([
    getNotes({ limit: 500 }),
    getTasks({ limit: 500 }),
  ]);

  const notes = (notesResult.data || []).filter((n) => {
    const created = new Date(n.createdAt);
    return created >= start && created <= end;
  });

  const allTasks = tasksResult.data || [];
  const weekTasks = allTasks.filter((t) => {
    const created = new Date(t.createdAt);
    return created >= start && created <= end;
  });

  const completedTasks = weekTasks.filter((t) => t.status === 'completed');

  // 计算领域分布
  const domainBreakdown = calculateDomainBreakdown(notes, weekTasks);

  // 计算任务统计
  const taskStats: TaskStats = {
    total: weekTasks.length,
    completed: completedTasks.length,
    completionRate: weekTasks.length > 0 ? completedTasks.length / weekTasks.length : 0,
    byPriority: {
      urgent: weekTasks.filter((t) => t.priority === 'urgent').length,
      high: weekTasks.filter((t) => t.priority === 'high').length,
      medium: weekTasks.filter((t) => t.priority === 'medium').length,
      low: weekTasks.filter((t) => t.priority === 'low').length,
    },
  };

  // 生成 AI 总结
  const client = getGeminiClient();
  let summary = '';
  let achievements: Achievement[] = [];
  let insights: string[] = [];
  let nextWeekGoals: string[] = [];

  try {
    const context = buildWeeklyContext(notes, weekTasks, completedTasks, taskStats);
    const prompt = `基于以下本周数据，生成一份专业的周报：

${context}

请以 JSON 格式返回：
{
  "summary": "本周总结（3-4句话，专业语言）",
  "achievements": [
    {"title": "成就标题", "description": "描述", "metric": "量化指标（可选）"}
  ],
  "insights": ["洞察1", "洞察2"],
  "nextWeekGoals": ["目标1", "目标2"]
}

只返回 JSON，不要其他内容。`;

    const response = await client.generateContent(prompt, {
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      summary = parsed.summary || '';
      achievements = parsed.achievements || [];
      insights = parsed.insights || [];
      nextWeekGoals = parsed.nextWeekGoals || [];
    }
  } catch (error) {
    console.error('生成周报 AI 总结失败:', error);
    summary = `本周完成 ${completedTasks.length} 个任务，完成率 ${(taskStats.completionRate * 100).toFixed(0)}%。`;
  }

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    summary,
    achievements,
    taskStats,
    domainBreakdown,
    insights,
    nextWeekGoals,
  };
}

/**
 * 构建日报上下文
 */
function buildDailyContext(notes: Note[], completedTasks: Task[], pendingTasks: Task[]): string {
  let context = '';

  if (completedTasks.length > 0) {
    context += `完成的任务 (${completedTasks.length}):\n`;
    completedTasks.forEach((t) => {
      context += `- ${t.title} [${t.domain}]\n`;
    });
  }

  if (pendingTasks.length > 0) {
    context += `\n待办任务 (${pendingTasks.length}):\n`;
    pendingTasks.slice(0, 5).forEach((t) => {
      context += `- ${t.title} [${t.priority}]\n`;
    });
  }

  if (notes.length > 0) {
    context += `\n今日笔记 (${notes.length}):\n`;
    notes.slice(0, 5).forEach((n) => {
      context += `- ${n.content.slice(0, 50)}... [${n.domain}]\n`;
    });
  }

  return context || '今日暂无数据';
}

/**
 * 构建周报上下文
 */
function buildWeeklyContext(
  notes: Note[],
  _tasks: Task[],
  completedTasks: Task[],
  stats: TaskStats
): string {
  return `
任务统计:
- 总任务数: ${stats.total}
- 完成数: ${stats.completed}
- 完成率: ${(stats.completionRate * 100).toFixed(0)}%

笔记数量: ${notes.length}

主要完成的任务:
${completedTasks.slice(0, 10).map((t) => `- ${t.title}`).join('\n')}
`;
}

/**
 * 计算领域分布
 */
function calculateDomainBreakdown(notes: Note[], tasks: Task[]): DomainBreakdown[] {
  const domains: LifeDomain[] = ['work', 'investment', 'development', 'learning', 'family', 'health', 'entertainment', 'general'];
  const total = notes.length + tasks.length;

  return domains.map((domain) => {
    const noteCount = notes.filter((n) => n.domain === domain).length;
    const taskCount = tasks.filter((t) => t.domain === domain).length;
    return {
      domain,
      noteCount,
      taskCount,
      percentage: total > 0 ? (noteCount + taskCount) / total : 0,
    };
  }).filter((d) => d.noteCount > 0 || d.taskCount > 0);
}
