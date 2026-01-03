/**
 * 日报生成定时任务 - Echo on Blinko 扩展
 * 
 * 每天 21:00 自动汇总当日活动数据，使用 AI 生成日报
 * 并创建一条笔记保存日报内容
 */

import { BaseScheduleJob } from './baseScheduleJob';
import { prisma } from '../prisma';
import { AiModelFactory } from '@server/aiServer/aiModelFactory';
import { RuntimeContext } from '@mastra/core/di';
import { CreateNotification } from '../routerTrpc/notification';
import { NotificationType } from '@shared/lib/prismaZodType';

// 任务名称常量
export const DAILY_REPORT_TASK_NAME = 'dailyReport';

// 日报数据接口
interface DailyReportData {
  date: string;
  totalDuration: number;
  activityCount: number;
  uniqueApps: number;
  topApps: Array<{ appName: string; duration: number; count: number }>;
  topDomains: Array<{ domainName: string; duration: number; count: number }>;
  notesCreated: number;
  translationsCount: number;
}

// 格式化时长为可读字符串
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
}

export class DailyReportJob extends BaseScheduleJob {
  protected static taskName = DAILY_REPORT_TASK_NAME;
  // 每天 21:00 (UTC+8 = 13:00 UTC)
  protected static cronSchedule = '0 13 * * *';

  /**
   * 初始化日报任务
   */
  static async initialize(): Promise<void> {
    try {
      console.log(`[${this.taskName}] Initializing daily report job...`);
      
      // 注册 worker
      await this.registerWorker();
      
      // 检查是否已调度
      const isAlreadyScheduled = await this.isScheduled();
      
      if (!isAlreadyScheduled) {
        // 启动调度，但不立即执行
        await this.Start(this.cronSchedule, false);
      }
      
      console.log(`[${this.taskName}] Initialized with schedule: ${this.cronSchedule}`);
    } catch (error) {
      console.error(`[${this.taskName}] Failed to initialize:`, error);
    }
  }

  /**
   * 执行日报生成任务
   */
  protected static async RunTask(): Promise<any> {
    console.log(`[${this.taskName}] Running at`, new Date().toISOString());
    
    try {
      // 获取所有用户
      const accounts = await prisma.accounts.findMany({
        select: { id: true, name: true, nickname: true }
      });
      
      const results: Array<{ accountId: number; success: boolean; error?: string }> = [];
      
      for (const account of accounts) {
        try {
          await this.generateReportForUser(account.id);
          results.push({ accountId: account.id, success: true });
          console.log(`[${this.taskName}] Generated report for user ${account.id}`);
        } catch (error: any) {
          console.error(`[${this.taskName}] Failed for user ${account.id}:`, error);
          results.push({ accountId: account.id, success: false, error: error.message });
        }
      }
      
      return { 
        success: true, 
        processedUsers: accounts.length,
        results 
      };
    } catch (error) {
      console.error(`[${this.taskName}] Failed:`, error);
      throw error;
    }
  }

  /**
   * 为单个用户生成日报
   */
  private static async generateReportForUser(accountId: number): Promise<void> {
    // 获取今日数据
    const reportData = await this.collectDailyData(accountId);
    
    // 如果没有活动数据，跳过
    if (reportData.activityCount === 0 && reportData.notesCreated === 0) {
      console.log(`[${this.taskName}] No activity for user ${accountId}, skipping`);
      return;
    }
    
    // 使用 AI 生成日报内容
    const reportContent = await this.generateReportContent(reportData, accountId);
    
    // 创建笔记保存日报
    await this.saveReportAsNote(accountId, reportData.date, reportContent);
    
    // 发送通知
    await CreateNotification({
      type: NotificationType.SYSTEM,
      title: '📊 今日日报已生成',
      content: `您的 ${reportData.date} 日报已生成，共记录 ${reportData.activityCount} 条活动`,
      accountId,
    });
  }

  /**
   * 收集当日数据
   */
  private static async collectDailyData(accountId: number): Promise<DailyReportData> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateStr = today.toISOString().split('T')[0];
    
    // 获取活动记录 (如果表存在)
    let activities: any[] = [];
    try {
      if (prisma.activityRecord) {
        activities = await prisma.activityRecord.findMany({
          where: {
            accountId,
            startTime: { gte: today },
            endTime: { lt: tomorrow },
          },
          include: { domain: true },
        });
      }
    } catch (e) {
      console.warn(`[${this.taskName}] activityRecord not available`);
    }
    
    // 统计应用使用时长
    const appStats: Record<string, { duration: number; count: number }> = {};
    const domainStats: Record<string, { duration: number; count: number }> = {};
    let totalDuration = 0;
    
    for (const activity of activities) {
      totalDuration += activity.duration;
      
      // 应用统计
      if (!appStats[activity.appName]) {
        appStats[activity.appName] = { duration: 0, count: 0 };
      }
      appStats[activity.appName].duration += activity.duration;
      appStats[activity.appName].count += 1;
      
      // 领域统计
      const domainName = activity.domain?.name || '未分类';
      if (!domainStats[domainName]) {
        domainStats[domainName] = { duration: 0, count: 0 };
      }
      domainStats[domainName].duration += activity.duration;
      domainStats[domainName].count += 1;
    }
    
    // 获取今日创建的笔记数
    const notesCreated = await prisma.notes.count({
      where: {
        accountId,
        createdAt: { gte: today, lt: tomorrow },
      },
    });
    
    // 获取今日翻译数 (如果表存在)
    let translationsCount = 0;
    try {
      if (prisma.translationHistory) {
        translationsCount = await prisma.translationHistory.count({
          where: {
            accountId,
            createdAt: { gte: today, lt: tomorrow },
          },
        });
      }
    } catch (e) {
      console.warn(`[${this.taskName}] translationHistory not available`);
    }
    
    // 排序获取 Top 应用和领域
    const topApps = Object.entries(appStats)
      .map(([appName, stats]) => ({ appName, ...stats }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);
    
    const topDomains = Object.entries(domainStats)
      .map(([domainName, stats]) => ({ domainName, ...stats }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);
    
    return {
      date: dateStr,
      totalDuration,
      activityCount: activities.length,
      uniqueApps: Object.keys(appStats).length,
      topApps,
      topDomains,
      notesCreated,
      translationsCount,
    };
  }

  /**
   * 使用 AI 生成日报内容
   */
  private static async generateReportContent(
    data: DailyReportData,
    accountId: number
  ): Promise<string> {
    // 构建数据摘要
    const dataSummary = `
## 今日数据摘要 (${data.date})

### 活动概览
- 总活动时长: ${formatDuration(data.totalDuration)}
- 活动记录数: ${data.activityCount} 条
- 使用应用数: ${data.uniqueApps} 个
- 创建笔记数: ${data.notesCreated} 条
- 翻译次数: ${data.translationsCount} 次

### Top 5 应用使用时长
${data.topApps.map((app, i) => `${i + 1}. ${app.appName}: ${formatDuration(app.duration)} (${app.count}次)`).join('\n')}

### 领域分布
${data.topDomains.map((d, i) => `${i + 1}. ${d.domainName}: ${formatDuration(d.duration)} (${d.count}次)`).join('\n')}
`;

    // 如果数据很少，直接返回摘要
    if (data.activityCount < 3 && data.notesCreated < 2) {
      return `# 📊 日报 - ${data.date}\n\n${dataSummary}\n\n> 今日活动较少，继续加油！`;
    }

    // 使用 AI 生成分析和建议
    const prompt = `你是一个个人效率助手。请根据以下用户今日的活动数据，生成一份简洁的日报分析。

${dataSummary}

请生成一份日报，包含：
1. 今日亮点（1-2句话总结）
2. 时间分配分析（简短）
3. 明日建议（1-2条具体建议）

要求：
- 使用中文
- 语气友好、鼓励
- 总字数控制在 200 字以内
- 使用 Markdown 格式`;

    try {
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('accountId', accountId);
      
      const agent = await AiModelFactory.BaseChatAgent({ 
        withTools: false,
        withOnlineSearch: false 
      });
      
      const result = await agent.generate([
        { role: 'user' as const, content: prompt }
      ], { runtimeContext });
      
      const aiAnalysis = result.text || '';
      
      return `# 📊 日报 - ${data.date}\n\n${dataSummary}\n\n---\n\n## AI 分析\n\n${aiAnalysis}`;
    } catch (error) {
      console.error(`[${this.taskName}] AI generation failed:`, error);
      // 降级：返回纯数据摘要
      return `# 📊 日报 - ${data.date}\n\n${dataSummary}`;
    }
  }

  /**
   * 将日报保存为笔记
   */
  private static async saveReportAsNote(
    accountId: number,
    date: string,
    content: string
  ): Promise<void> {
    // 检查是否已存在当日日报
    const existingNote = await prisma.notes.findFirst({
      where: {
        accountId,
        content: { contains: `日报 - ${date}` },
        createdAt: {
          gte: new Date(date),
          lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });
    
    if (existingNote) {
      // 更新现有日报
      await prisma.notes.update({
        where: { id: existingNote.id },
        data: { content, updatedAt: new Date() },
      });
      console.log(`[${this.taskName}] Updated existing report note ${existingNote.id}`);
    } else {
      // 创建新日报笔记
      const note = await prisma.notes.create({
        data: {
          content,
          accountId,
          type: 0, // 普通笔记
          isTop: false,
          isArchived: false,
          isRecycle: false,
          isShare: false,
        },
      });
      console.log(`[${this.taskName}] Created new report note ${note.id}`);
    }
  }

  /**
   * 手动触发为指定用户生成日报
   */
  static async generateForUser(accountId: number): Promise<string> {
    const reportData = await this.collectDailyData(accountId);
    const reportContent = await this.generateReportContent(reportData, accountId);
    await this.saveReportAsNote(accountId, reportData.date, reportContent);
    return reportContent;
  }
}
