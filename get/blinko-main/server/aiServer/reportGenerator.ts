/**
 * Echo v3.2: 日报生成服务
 * 负责生成早报和晚报，包含任务摘要、笔记摘要和 AI 建议
 */

import { prisma } from '../prisma';
import { AiModelFactory } from './aiModelFactory';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

// 日报类型定义
export interface TaskSummary {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  topPriority: Array<{ id: number; content: string; isTop: boolean }>;
}

export interface NoteSummary {
  count: number;
  tags: string[];
  highlights: string[];
}

export interface ActivitySummary {
  totalDuration: number;  // 总时长 (分钟)
  topDomains: Array<{ name: string; duration: number }>;
  productiveTime: number; // 高效时间 (分钟)
}

export interface DailyReportContent {
  summary: string;           // AI 生成的摘要
  tasks: TaskSummary;        // 任务统计
  notes: NoteSummary;        // 笔记摘要
  suggestions: Array<{       // 建议列表
    type: string;
    content: string;
    priority: string;
  }>;
  activities?: ActivitySummary; // 活动统计 (可选)
  greeting?: string;         // 问候语
}

export type ReportType = 'morning' | 'evening';

/**
 * 日报生成器类
 */
export class ReportGenerator {
  private accountId: number;

  constructor(accountId: number) {
    this.accountId = accountId;
  }

  /**
   * 生成早报
   * 包含: 今日待办、昨日未完成、AI 建议
   */
  async generateMorningReport(date: Date = new Date()): Promise<DailyReportContent> {
    const today = startOfDay(date);
    const yesterday = subDays(today, 1);

    // 获取今日待办任务 (type=1 表示待办)
    const todayTasks = await this.getTasks(today, endOfDay(date));
    
    // 获取昨日未完成任务
    const yesterdayTasks = await this.getTasks(yesterday, endOfDay(yesterday));
    const overdueTasks = yesterdayTasks.filter(t => !t.isArchived && !t.isRecycle);

    // 获取最近笔记
    const recentNotes = await this.getRecentNotes(7);

    // 构建任务摘要
    const taskSummary: TaskSummary = {
      total: todayTasks.length,
      completed: todayTasks.filter(t => t.isArchived).length,
      pending: todayTasks.filter(t => !t.isArchived && !t.isRecycle).length,
      overdue: overdueTasks.length,
      topPriority: todayTasks
        .filter(t => t.isTop)
        .slice(0, 5)
        .map(t => ({ id: t.id, content: t.content.slice(0, 100), isTop: t.isTop })),
    };

    // 构建笔记摘要
    const noteSummary = await this.buildNoteSummary(recentNotes);

    // 生成 AI 建议
    const suggestions = await this.generateSuggestions('morning', taskSummary, noteSummary);

    // 生成 AI 摘要
    const summary = await this.generateAISummary('morning', taskSummary, noteSummary);

    return {
      summary,
      tasks: taskSummary,
      notes: noteSummary,
      suggestions,
      greeting: this.getMorningGreeting(),
    };
  }

  /**
   * 生成晚报
   * 包含: 今日完成统计、笔记摘要、明日建议
   */
  async generateEveningReport(date: Date = new Date()): Promise<DailyReportContent> {
    const today = startOfDay(date);

    // 获取今日任务
    const todayTasks = await this.getTasks(today, endOfDay(date));
    
    // 获取今日笔记
    const todayNotes = await this.getTodayNotes(date);

    // 获取活动记录
    const activities = await this.getActivitySummary(date);

    // 构建任务摘要
    const taskSummary: TaskSummary = {
      total: todayTasks.length,
      completed: todayTasks.filter(t => t.isArchived).length,
      pending: todayTasks.filter(t => !t.isArchived && !t.isRecycle).length,
      overdue: 0,
      topPriority: todayTasks
        .filter(t => t.isTop && t.isArchived)
        .slice(0, 5)
        .map(t => ({ id: t.id, content: t.content.slice(0, 100), isTop: t.isTop })),
    };

    // 构建笔记摘要
    const noteSummary = await this.buildNoteSummary(todayNotes);

    // 生成 AI 建议 (明日计划)
    const suggestions = await this.generateSuggestions('evening', taskSummary, noteSummary);

    // 生成 AI 摘要
    const summary = await this.generateAISummary('evening', taskSummary, noteSummary, activities);

    return {
      summary,
      tasks: taskSummary,
      notes: noteSummary,
      suggestions,
      activities,
      greeting: this.getEveningGreeting(),
    };
  }

  /**
   * 保存日报到数据库
   */
  async saveReport(type: ReportType, date: Date, content: DailyReportContent) {
    return prisma.dailyReport.upsert({
      where: {
        type_date_accountId: {
          type,
          date: startOfDay(date),
          accountId: this.accountId,
        },
      },
      update: {
        content: content as any,
        generatedAt: new Date(),
      },
      create: {
        type,
        date: startOfDay(date),
        content: content as any,
        accountId: this.accountId,
      },
    });
  }

  // ============ 私有方法 ============

  private async getTasks(startDate: Date, endDate: Date) {
    return prisma.notes.findMany({
      where: {
        accountId: this.accountId,
        type: 1, // 待办类型
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [{ isTop: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async getRecentNotes(days: number) {
    const startDate = subDays(new Date(), days);
    return prisma.notes.findMany({
      where: {
        accountId: this.accountId,
        type: 0, // 笔记类型
        createdAt: { gte: startDate },
        isRecycle: false,
      },
      include: { tags: { include: { tag: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private async getTodayNotes(date: Date) {
    return prisma.notes.findMany({
      where: {
        accountId: this.accountId,
        type: 0,
        createdAt: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
        isRecycle: false,
      },
      include: { tags: { include: { tag: true } } },
    });
  }

  private async buildNoteSummary(notes: any[]): Promise<NoteSummary> {
    const tagSet = new Set<string>();
    notes.forEach(note => {
      note.tags?.forEach((t: any) => tagSet.add(t.tag.name));
    });

    // 提取高亮内容 (前 100 字符)
    const highlights = notes
      .slice(0, 3)
      .map(n => n.content.slice(0, 100));

    return {
      count: notes.length,
      tags: Array.from(tagSet).slice(0, 10),
      highlights,
    };
  }

  private async getActivitySummary(date: Date): Promise<ActivitySummary | undefined> {
    const activities = await prisma.activityRecord.findMany({
      where: {
        accountId: this.accountId,
        startTime: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
      },
      include: { domain: true },
    });

    if (activities.length === 0) return undefined;

    const totalDuration = activities.reduce((sum, a) => sum + a.duration, 0) / 60;
    
    // 按领域分组统计
    const domainMap = new Map<string, number>();
    activities.forEach(a => {
      const name = a.domain?.name || '未分类';
      domainMap.set(name, (domainMap.get(name) || 0) + a.duration);
    });

    const topDomains = Array.from(domainMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, duration]) => ({ name, duration: Math.round(duration / 60) }));

    return {
      totalDuration: Math.round(totalDuration),
      topDomains,
      productiveTime: Math.round(totalDuration * 0.7), // 简单估算
    };
  }

  private async generateSuggestions(
    type: ReportType,
    tasks: TaskSummary,
    notes: NoteSummary
  ): Promise<Array<{ type: string; content: string; priority: string }>> {
    // 基于规则生成建议
    const suggestions: Array<{ type: string; content: string; priority: string }> = [];

    if (type === 'morning') {
      // 早报建议
      if (tasks.overdue > 0) {
        suggestions.push({
          type: 'task',
          content: `你有 ${tasks.overdue} 个昨日未完成的任务，建议优先处理`,
          priority: 'high',
        });
      }
      if (tasks.pending > 5) {
        suggestions.push({
          type: 'insight',
          content: '今日待办较多，建议按优先级逐个完成，避免多任务切换',
          priority: 'medium',
        });
      }
    } else {
      // 晚报建议
      const completionRate = tasks.total > 0 ? tasks.completed / tasks.total : 0;
      if (completionRate >= 0.8) {
        suggestions.push({
          type: 'insight',
          content: '今日完成率很高，继续保持！',
          priority: 'low',
        });
      } else if (completionRate < 0.5 && tasks.total > 0) {
        suggestions.push({
          type: 'habit',
          content: '今日完成率较低，建议明天减少任务数量，提高专注度',
          priority: 'medium',
        });
      }
      if (notes.count > 0) {
        suggestions.push({
          type: 'reminder',
          content: `今日记录了 ${notes.count} 条笔记，记得定期回顾整理`,
          priority: 'low',
        });
      }
    }

    return suggestions;
  }

  private async generateAISummary(
    type: ReportType,
    tasks: TaskSummary,
    notes: NoteSummary,
    activities?: ActivitySummary
  ): Promise<string> {
    try {
      const model = await AiModelFactory.getDefaultModel();
      if (!model) {
        return this.getFallbackSummary(type, tasks, notes);
      }

      const prompt = type === 'morning'
        ? `请用简洁的中文生成一段早报摘要（50字以内）：
           - 今日待办: ${tasks.pending} 项
           - 昨日未完成: ${tasks.overdue} 项
           - 最近笔记标签: ${notes.tags.join(', ') || '无'}`
        : `请用简洁的中文生成一段晚报摘要（50字以内）：
           - 今日完成: ${tasks.completed}/${tasks.total} 项
           - 今日笔记: ${notes.count} 条
           - 活动时长: ${activities?.totalDuration || 0} 分钟`;

      const response = await model.chat([{ role: 'user', content: prompt }]);
      return response.content || this.getFallbackSummary(type, tasks, notes);
    } catch (error) {
      console.warn('AI 摘要生成失败，使用默认摘要:', error);
      return this.getFallbackSummary(type, tasks, notes);
    }
  }

  private getFallbackSummary(type: ReportType, tasks: TaskSummary, notes: NoteSummary): string {
    if (type === 'morning') {
      return `今日有 ${tasks.pending} 项待办${tasks.overdue > 0 ? `，${tasks.overdue} 项昨日未完成` : ''}。`;
    }
    return `今日完成 ${tasks.completed}/${tasks.total} 项任务，记录 ${notes.count} 条笔记。`;
  }

  private getMorningGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 9) return '早安！新的一天开始了';
    if (hour < 12) return '上午好！';
    return '你好！';
  }

  private getEveningGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 18) return '下午好！';
    if (hour < 21) return '晚上好！';
    return '夜深了，注意休息';
  }
}

/**
 * 生成并保存日报
 */
export async function generateDailyReport(
  accountId: number,
  type: ReportType,
  date: Date = new Date()
) {
  const generator = new ReportGenerator(accountId);
  
  const content = type === 'morning'
    ? await generator.generateMorningReport(date)
    : await generator.generateEveningReport(date);

  const report = await generator.saveReport(type, date, content);
  
  return { report, content };
}

/**
 * 获取日报
 */
export async function getDailyReport(
  accountId: number,
  type: ReportType,
  date: Date
) {
  return prisma.dailyReport.findUnique({
    where: {
      type_date_accountId: {
        type,
        date: startOfDay(date),
        accountId,
      },
    },
  });
}

/**
 * 获取日报列表
 */
export async function listDailyReports(
  accountId: number,
  options: {
    type?: ReportType | 'all';
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}
) {
  const { type = 'all', startDate, endDate, limit = 10 } = options;

  return prisma.dailyReport.findMany({
    where: {
      accountId,
      ...(type !== 'all' && { type }),
      ...(startDate && { date: { gte: startOfDay(startDate) } }),
      ...(endDate && { date: { lte: endOfDay(endDate) } }),
    },
    orderBy: { date: 'desc' },
    take: limit,
  });
}

// ============ 日报调度系统 ============

import { automationManager } from './automationManager';

/**
 * 日报调度器类
 * 负责管理早报和晚报的自动生成调度
 */
export class ReportScheduler {
  private accountId: number;

  constructor(accountId: number) {
    this.accountId = accountId;
  }

  /**
   * 设置早报调度
   * @param time - 时间格式 "HH:mm"
   * @param enabled - 是否启用
   */
  async setupMorningReportSchedule(time: string, enabled: boolean): Promise<void> {
    const automationName = `daily_morning_report_${this.accountId}`;
    const [hour, minute] = time.split(':').map(Number);
    const cronSchedule = `${minute} ${hour} * * *`; // 每天指定时间

    // 查找现有的早报自动化任务
    const existingAutomations = await automationManager.getAutomations(this.accountId);
    const existing = existingAutomations.find(a => a.name === automationName);

    if (existing) {
      // 更新现有任务
      await automationManager.updateAutomation(existing.id, {
        schedule: cronSchedule,
        isEnabled: enabled,
      });
    } else if (enabled) {
      // 创建新任务
      await automationManager.createAutomation({
        name: automationName,
        query: '__INTERNAL_MORNING_REPORT__', // 内部标记
        schedule: cronSchedule,
        naturalSchedule: `每天 ${time}`,
        resultStorage: 'note',
        notificationChannels: ['in_app'],
        isEnabled: enabled,
        accountId: this.accountId,
      });
    }
  }

  /**
   * 设置晚报调度
   * @param time - 时间格式 "HH:mm"
   * @param enabled - 是否启用
   */
  async setupEveningReportSchedule(time: string, enabled: boolean): Promise<void> {
    const automationName = `daily_evening_report_${this.accountId}`;
    const [hour, minute] = time.split(':').map(Number);
    const cronSchedule = `${minute} ${hour} * * *`;

    const existingAutomations = await automationManager.getAutomations(this.accountId);
    const existing = existingAutomations.find(a => a.name === automationName);

    if (existing) {
      await automationManager.updateAutomation(existing.id, {
        schedule: cronSchedule,
        isEnabled: enabled,
      });
    } else if (enabled) {
      await automationManager.createAutomation({
        name: automationName,
        query: '__INTERNAL_EVENING_REPORT__',
        schedule: cronSchedule,
        naturalSchedule: `每天 ${time}`,
        resultStorage: 'note',
        notificationChannels: ['in_app'],
        isEnabled: enabled,
        accountId: this.accountId,
      });
    }
  }

  /**
   * 同步日报设置到调度系统
   * 从 userPreference 读取设置并更新调度
   */
  async syncScheduleFromSettings(): Promise<void> {
    // 获取用户设置
    const settings = await prisma.userPreference.findMany({
      where: {
        accountId: this.accountId,
        category: 'report',
      },
    });

    const settingsMap: Record<string, string> = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });

    const morningTime = settingsMap['morningReportTime'] || '08:00';
    const eveningTime = settingsMap['eveningReportTime'] || '21:00';
    const morningEnabled = settingsMap['morningReportEnabled'] !== 'false';
    const eveningEnabled = settingsMap['eveningReportEnabled'] !== 'false';

    await this.setupMorningReportSchedule(morningTime, morningEnabled);
    await this.setupEveningReportSchedule(eveningTime, eveningEnabled);
  }

  /**
   * 获取调度状态
   */
  async getScheduleStatus(): Promise<{
    morning: { enabled: boolean; nextRun?: Date };
    evening: { enabled: boolean; nextRun?: Date };
  }> {
    const automations = await automationManager.getAutomations(this.accountId);
    
    const morningAuto = automations.find(a => a.name === `daily_morning_report_${this.accountId}`);
    const eveningAuto = automations.find(a => a.name === `daily_evening_report_${this.accountId}`);

    return {
      morning: {
        enabled: morningAuto?.isEnabled ?? false,
        nextRun: morningAuto?.lastRun ? new Date(morningAuto.lastRun) : undefined,
      },
      evening: {
        enabled: eveningAuto?.isEnabled ?? false,
        nextRun: eveningAuto?.lastRun ? new Date(eveningAuto.lastRun) : undefined,
      },
    };
  }
}

/**
 * 创建日报调度器实例
 */
export function createReportScheduler(accountId: number): ReportScheduler {
  return new ReportScheduler(accountId);
}

/**
 * 执行日报生成 (供 AutomationManager 调用)
 * 根据内部标记判断生成早报还是晚报
 */
export async function executeReportGeneration(
  accountId: number,
  query: string
): Promise<string> {
  const generator = new ReportGenerator(accountId);
  const date = new Date();

  if (query === '__INTERNAL_MORNING_REPORT__') {
    const content = await generator.generateMorningReport(date);
    await generator.saveReport('morning', date, content);
    
    // 创建通知
    await prisma.notifications.create({
      data: {
        type: 'report',
        title: '早报已生成',
        content: content.summary,
        actionUrl: `/daily-report/morning/${format(date, 'yyyy-MM-dd')}`,
        accountId,
      },
    });

    return `早报生成成功: ${content.summary}`;
  }

  if (query === '__INTERNAL_EVENING_REPORT__') {
    const content = await generator.generateEveningReport(date);
    await generator.saveReport('evening', date, content);

    await prisma.notifications.create({
      data: {
        type: 'report',
        title: '晚报已生成',
        content: content.summary,
        actionUrl: `/daily-report/evening/${format(date, 'yyyy-MM-dd')}`,
        accountId,
      },
    });

    return `晚报生成成功: ${content.summary}`;
  }

  throw new Error('Unknown report type');
}
