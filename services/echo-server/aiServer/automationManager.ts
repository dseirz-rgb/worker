/**
 * 自动化任务管理系统 - AI 服务统一迁移
 * 
 * 支持:
 * - 自动化任务 CRUD
 * - 自然语言调度解析
 * - 任务执行和结果存储
 * - 重试和通知机制
 */

import { prisma } from '@server/prisma';
import { AiModelFactory } from './aiModelFactory';
import { ResearchAgent } from './researchAgent';
import { agentManager } from './agentManager';
import * as schedule from 'node-schedule';

// 自动化配置接口
export interface AutomationConfig {
  id: number;
  name: string;
  query: string;
  schedule: string;              // cron 表达式
  naturalSchedule?: string;      // 自然语言调度
  agentId?: number;
  resultStorage: 'note' | 'memory' | 'both';
  notificationChannels: string[];
  isEnabled: boolean;
  accountId: number;
  lastRun?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 创建自动化输入
export interface CreateAutomationInput {
  name: string;
  query: string;
  schedule?: string;
  naturalSchedule?: string;
  agentId?: number;
  resultStorage?: 'note' | 'memory' | 'both';
  notificationChannels?: string[];
  isEnabled?: boolean;
  accountId: number;
}

// 更新自动化输入
export interface UpdateAutomationInput {
  name?: string;
  query?: string;
  schedule?: string;
  naturalSchedule?: string;
  agentId?: number;
  resultStorage?: 'note' | 'memory' | 'both';
  notificationChannels?: string[];
  isEnabled?: boolean;
}

// 自动化运行记录
export interface AutomationRun {
  id: number;
  automationId: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  result?: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

// 调度任务映射
const scheduledJobs: Map<number, schedule.Job> = new Map();

/**
 * 自动化管理器类
 */
export class AutomationManager {
  private maxRetries = 3;

  /**
   * 创建自动化任务
   */
  async createAutomation(data: CreateAutomationInput): Promise<AutomationConfig> {
    // 解析自然语言调度
    let cronSchedule = data.schedule;
    if (data.naturalSchedule && !cronSchedule) {
      cronSchedule = await this.parseNaturalSchedule(data.naturalSchedule);
    }

    if (!cronSchedule) {
      throw new Error('Schedule is required. Provide either schedule or naturalSchedule.');
    }

    // 验证 cron 表达式
    if (!this.isValidCron(cronSchedule)) {
      throw new Error(`Invalid cron expression: ${cronSchedule}`);
    }

    const automation = await prisma.aiScheduledTask.create({
      data: {
        name: data.name,
        prompt: data.query,
        schedule: cronSchedule,
        isEnabled: data.isEnabled ?? true,
        accountId: data.accountId,
        lastResult: {
          agentId: data.agentId,
          resultStorage: data.resultStorage || 'note',
          notificationChannels: data.notificationChannels || [],
          naturalSchedule: data.naturalSchedule,
        },
      },
    });

    // 如果启用，注册调度
    if (automation.isEnabled) {
      this.scheduleTask(automation);
    }

    return this.mapToAutomationConfig(automation);
  }

  /**
   * 获取自动化任务
   */
  async getAutomation(id: number): Promise<AutomationConfig | null> {
    const automation = await prisma.aiScheduledTask.findUnique({
      where: { id },
    });

    return automation ? this.mapToAutomationConfig(automation) : null;
  }

  /**
   * 获取自动化任务列表
   */
  async getAutomations(accountId: number): Promise<AutomationConfig[]> {
    const automations = await prisma.aiScheduledTask.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });

    return automations.map(a => this.mapToAutomationConfig(a));
  }

  /**
   * 更新自动化任务
   */
  async updateAutomation(id: number, data: UpdateAutomationInput): Promise<AutomationConfig> {
    const existing = await prisma.aiScheduledTask.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Automation not found');
    }

    // 解析自然语言调度
    let cronSchedule = data.schedule;
    if (data.naturalSchedule && !cronSchedule) {
      cronSchedule = await this.parseNaturalSchedule(data.naturalSchedule);
    }

    // 获取现有元数据
    const existingMetadata = (existing.lastResult as any) || {};

    const automation = await prisma.aiScheduledTask.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.query && { prompt: data.query }),
        ...(cronSchedule && { schedule: cronSchedule }),
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        lastResult: {
          ...existingMetadata,
          ...(data.agentId !== undefined && { agentId: data.agentId }),
          ...(data.resultStorage && { resultStorage: data.resultStorage }),
          ...(data.notificationChannels && { notificationChannels: data.notificationChannels }),
          ...(data.naturalSchedule && { naturalSchedule: data.naturalSchedule }),
        },
      },
    });

    // 更新调度
    this.cancelTask(id);
    if (automation.isEnabled) {
      this.scheduleTask(automation);
    }

    return this.mapToAutomationConfig(automation);
  }

  /**
   * 删除自动化任务
   */
  async deleteAutomation(id: number): Promise<void> {
    this.cancelTask(id);
    
    // 删除运行记录
    await prisma.automationRun.deleteMany({
      where: { automationId: id },
    });

    await prisma.aiScheduledTask.delete({
      where: { id },
    });
  }

  /**
   * 切换自动化任务状态
   */
  async toggleAutomation(id: number, enabled: boolean): Promise<AutomationConfig> {
    const automation = await prisma.aiScheduledTask.update({
      where: { id },
      data: { isEnabled: enabled },
    });

    if (enabled) {
      this.scheduleTask(automation);
    } else {
      this.cancelTask(id);
    }

    return this.mapToAutomationConfig(automation);
  }

  /**
   * 执行自动化任务
   */
  async runAutomation(automationId: number, retryCount = 0): Promise<AutomationRun> {
    const automation = await prisma.aiScheduledTask.findUnique({
      where: { id: automationId },
    });

    if (!automation) {
      throw new Error('Automation not found');
    }

    // 创建运行记录
    const run = await prisma.automationRun.create({
      data: {
        automationId,
        status: 'running',
        startedAt: new Date(),
      },
    });

    try {
      const metadata = (automation.lastResult as any) || {};
      let result: string;

      // 使用指定的 Agent 或 Research Agent
      if (metadata.agentId) {
        const response = await agentManager.chat(metadata.agentId, [
          { role: 'user', content: automation.prompt },
        ], { accountId: automation.accountId });
        result = response.text;
      } else {
        // 使用 Research Agent
        const researchAgent = new ResearchAgent(automation.accountId, {
          maxIterations: 3,
          timeout: 60000,
        });

        let finalResult: any;
        for await (const iteration of researchAgent.research(automation.prompt)) {
          console.log(`[Automation] Research iteration ${iteration.iteration}`);
        }
        
        // 获取最终结果需要重新执行（简化处理）
        const agent = await AiModelFactory.BaseChatAgent({ withTools: true });
        const response = await agent.generate([
          { role: 'user', content: automation.prompt },
        ]);
        result = response.text || '';
      }

      // 存储结果
      await this.storeResult(automation, result, metadata);

      // 发送通知
      await this.sendNotifications(automation, result, metadata);

      // 更新运行记录
      const completedRun = await prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: 'success',
          result,
          completedAt: new Date(),
        },
      });

      // 更新最后运行时间
      await prisma.aiScheduledTask.update({
        where: { id: automationId },
        data: { lastRun: new Date() },
      });

      return this.mapToAutomationRun(completedRun);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 重试逻辑
      if (retryCount < this.maxRetries) {
        console.log(`[Automation] Retry ${retryCount + 1}/${this.maxRetries} for automation ${automationId}`);
        await new Promise(resolve => setTimeout(resolve, 5000 * (retryCount + 1)));
        return this.runAutomation(automationId, retryCount + 1);
      }

      // 更新运行记录为失败
      const failedRun = await prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: errorMessage,
          completedAt: new Date(),
        },
      });

      // 发送失败通知
      const metadata = (automation.lastResult as any) || {};
      await this.sendFailureNotification(automation, errorMessage, metadata);

      return this.mapToAutomationRun(failedRun);
    }
  }

  /**
   * 获取运行历史
   */
  async getRunHistory(automationId: number, limit = 20): Promise<AutomationRun[]> {
    const runs = await prisma.automationRun.findMany({
      where: { automationId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return runs.map(r => this.mapToAutomationRun(r));
  }

  /**
   * 解析自然语言调度
   */
  async parseNaturalSchedule(text: string): Promise<string> {
    try {
      const agent = await AiModelFactory.BaseChatAgent({ withTools: false });
      const result = await agent.generate([
        {
          role: 'system',
          content: `将自然语言时间描述转换为 cron 表达式。只返回 cron 表达式，不要其他内容。

示例:
- "每天早上9点" -> "0 9 * * *"
- "每周一下午3点" -> "0 15 * * 1"
- "每小时" -> "0 * * * *"
- "每天中午12点" -> "0 12 * * *"
- "每周五晚上8点" -> "0 20 * * 5"
- "每月1号上午10点" -> "0 10 1 * *"
- "每30分钟" -> "*/30 * * * *"`,
        },
        { role: 'user', content: text },
      ]);

      const cron = result.text?.trim() || '';
      
      // 验证结果
      if (!this.isValidCron(cron)) {
        throw new Error(`Invalid cron expression generated: ${cron}`);
      }

      return cron;
    } catch (error) {
      console.error('[AutomationManager] Failed to parse natural schedule:', error);
      throw new Error(`Failed to parse schedule: ${text}`);
    }
  }

  /**
   * 验证 cron 表达式
   */
  private isValidCron(cron: string): boolean {
    try {
      // 简单验证：5 个部分，用空格分隔
      const parts = cron.trim().split(/\s+/);
      if (parts.length !== 5) return false;

      // 尝试创建调度（不实际运行）
      const job = schedule.scheduleJob(cron, () => {});
      if (job) {
        job.cancel();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 注册调度任务
   */
  private scheduleTask(automation: any): void {
    const job = schedule.scheduleJob(automation.schedule, async () => {
      console.log(`[Automation] Running scheduled task: ${automation.name}`);
      try {
        await this.runAutomation(automation.id);
      } catch (error) {
        console.error(`[Automation] Failed to run task ${automation.name}:`, error);
      }
    });

    if (job) {
      scheduledJobs.set(automation.id, job);
      console.log(`[Automation] Scheduled task: ${automation.name} (${automation.schedule})`);
    }
  }

  /**
   * 取消调度任务
   */
  private cancelTask(automationId: number): void {
    const job = scheduledJobs.get(automationId);
    if (job) {
      job.cancel();
      scheduledJobs.delete(automationId);
      console.log(`[Automation] Cancelled task: ${automationId}`);
    }
  }

  /**
   * 存储结果
   */
  private async storeResult(
    automation: any,
    result: string,
    metadata: any
  ): Promise<void> {
    const storage = metadata.resultStorage || 'note';

    if (storage === 'note' || storage === 'both') {
      // 创建笔记
      await prisma.notes.create({
        data: {
          content: `## ${automation.name} - 自动化结果\n\n${result}\n\n---\n*生成时间: ${new Date().toLocaleString()}*`,
          type: 1, // note
          accountId: automation.accountId,
        },
      });
    }

    if (storage === 'memory' || storage === 'both') {
      // 存储到记忆系统
      await prisma.memory.create({
        data: {
          type: 'long_term',
          content: `自动化任务 "${automation.name}" 结果: ${result.slice(0, 500)}`,
          importance: 0.6,
          accountId: automation.accountId,
          metadata: {
            automationId: automation.id,
            automationName: automation.name,
          },
        },
      });
    }
  }

  /**
   * 发送通知
   */
  private async sendNotifications(
    automation: any,
    result: string,
    metadata: any
  ): Promise<void> {
    const channels = metadata.notificationChannels || [];

    for (const channel of channels) {
      try {
        if (channel === 'in_app') {
          // 创建应用内通知
          await prisma.notifications.create({
            data: {
              type: 'automation',
              title: `自动化完成: ${automation.name}`,
              content: result.slice(0, 200),
              accountId: automation.accountId,
              metadata: {
                automationId: automation.id,
              },
            },
          });
        }
        // 可以扩展其他通知渠道：email, webhook 等
      } catch (error) {
        console.error(`[Automation] Failed to send notification to ${channel}:`, error);
      }
    }
  }

  /**
   * 发送失败通知
   */
  private async sendFailureNotification(
    automation: any,
    error: string,
    metadata: any
  ): Promise<void> {
    const channels = metadata.notificationChannels || [];

    for (const channel of channels) {
      try {
        if (channel === 'in_app') {
          await prisma.notifications.create({
            data: {
              type: 'automation_error',
              title: `自动化失败: ${automation.name}`,
              content: `任务执行失败: ${error.slice(0, 200)}`,
              accountId: automation.accountId,
              metadata: {
                automationId: automation.id,
                error,
              },
            },
          });
        }
      } catch (err) {
        console.error(`[Automation] Failed to send failure notification:`, err);
      }
    }
  }

  /**
   * 初始化所有启用的调度任务
   */
  async initializeScheduledTasks(): Promise<void> {
    const automations = await prisma.aiScheduledTask.findMany({
      where: { isEnabled: true },
    });

    for (const automation of automations) {
      this.scheduleTask(automation);
    }

    console.log(`[Automation] Initialized ${automations.length} scheduled tasks`);
  }

  /**
   * 映射到 AutomationConfig
   */
  private mapToAutomationConfig(automation: any): AutomationConfig {
    const metadata = (automation.lastResult as any) || {};
    
    return {
      id: automation.id,
      name: automation.name,
      query: automation.prompt,
      schedule: automation.schedule,
      naturalSchedule: metadata.naturalSchedule,
      agentId: metadata.agentId,
      resultStorage: metadata.resultStorage || 'note',
      notificationChannels: metadata.notificationChannels || [],
      isEnabled: automation.isEnabled,
      accountId: automation.accountId,
      lastRun: automation.lastRun,
      createdAt: automation.createdAt,
      updatedAt: automation.updatedAt,
    };
  }

  /**
   * 映射到 AutomationRun
   */
  private mapToAutomationRun(run: any): AutomationRun {
    return {
      id: run.id,
      automationId: run.automationId,
      status: run.status,
      result: run.result,
      error: run.error,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    };
  }
}

// 导出单例
export const automationManager = new AutomationManager();
