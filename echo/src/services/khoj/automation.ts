/**
 * Khoj 自动化服务
 * 管理 Khoj 自动化任务和研究功能
 */

import { getKhojClient, isKhojClientInitialized } from './khojClient';

/**
 * 自动化任务类型
 */
export type AutomationType = 'research' | 'summary' | 'reminder' | 'custom';

/**
 * 自动化任务状态
 */
export type AutomationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * 自动化任务配置
 */
export interface AutomationConfig {
  /** 任务 ID */
  id: string;
  /** 任务名称 */
  name: string;
  /** 任务类型 */
  type: AutomationType;
  /** 任务描述/查询 */
  query: string;
  /** 调度配置 */
  schedule?: {
    /** 是否启用 */
    enabled: boolean;
    /** Cron 表达式 */
    cron?: string;
    /** 间隔（分钟） */
    interval?: number;
  };
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: string;
  /** 最后运行时间 */
  lastRunAt?: string;
}

/**
 * 自动化任务结果
 */
export interface AutomationResult {
  /** 任务 ID */
  taskId: string;
  /** 状态 */
  status: AutomationStatus;
  /** 结果内容 */
  content?: string;
  /** 来源引用 */
  sources?: Array<{
    title: string;
    url?: string;
    snippet: string;
  }>;
  /** 完成时间 */
  completedAt?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * Khoj 通知
 */
export interface KhojNotification {
  /** 通知 ID */
  id: string;
  /** 通知类型 */
  type: 'research' | 'reminder' | 'system';
  /** 标题 */
  title: string;
  /** 内容 */
  content: string;
  /** 关联任务 ID */
  taskId?: string;
  /** 创建时间 */
  createdAt: string;
  /** 是否已读 */
  read: boolean;
}

/** 存储键 */
const STORAGE_KEY_AUTOMATIONS = 'khoj_automations';
const STORAGE_KEY_NOTIFICATIONS = 'khoj_notifications';

/**
 * Khoj 自动化服务
 */
export class KhojAutomationService {
  /** 自动化任务列表 */
  private automations: AutomationConfig[] = [];
  /** 通知列表 */
  private notifications: KhojNotification[] = [];
  /** 运行中的任务 */
  private runningTasks: Map<string, AbortController> = new Map();
  /** 定时器 */
  private schedulers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * 从存储加载数据
   */
  private loadFromStorage(): void {
    try {
      const automationsJson = localStorage.getItem(STORAGE_KEY_AUTOMATIONS);
      if (automationsJson) {
        this.automations = JSON.parse(automationsJson);
      }

      const notificationsJson = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
      if (notificationsJson) {
        this.notifications = JSON.parse(notificationsJson);
      }
    } catch (error) {
      console.error('加载自动化配置失败:', error);
    }
  }

  /**
   * 保存到存储
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_AUTOMATIONS, JSON.stringify(this.automations));
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(this.notifications));
    } catch (error) {
      console.error('保存自动化配置失败:', error);
    }
  }

  /**
   * 获取所有自动化任务
   */
  getAutomations(): AutomationConfig[] {
    return [...this.automations];
  }

  /**
   * 获取单个自动化任务
   */
  getAutomation(id: string): AutomationConfig | undefined {
    return this.automations.find(a => a.id === id);
  }

  /**
   * 创建自动化任务
   */
  createAutomation(config: Omit<AutomationConfig, 'id' | 'createdAt'>): AutomationConfig {
    const automation: AutomationConfig = {
      ...config,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    this.automations.push(automation);
    this.saveToStorage();

    // 如果启用了调度，设置定时器
    if (automation.enabled && automation.schedule?.enabled) {
      this.scheduleAutomation(automation);
    }

    return automation;
  }

  /**
   * 更新自动化任务
   */
  updateAutomation(id: string, updates: Partial<AutomationConfig>): AutomationConfig | null {
    const index = this.automations.findIndex(a => a.id === id);
    if (index === -1) return null;

    const automation = {
      ...this.automations[index],
      ...updates,
      id, // 确保 ID 不变
    };

    this.automations[index] = automation;
    this.saveToStorage();

    // 更新调度
    this.cancelSchedule(id);
    if (automation.enabled && automation.schedule?.enabled) {
      this.scheduleAutomation(automation);
    }

    return automation;
  }

  /**
   * 删除自动化任务
   */
  deleteAutomation(id: string): boolean {
    const index = this.automations.findIndex(a => a.id === id);
    if (index === -1) return false;

    this.automations.splice(index, 1);
    this.saveToStorage();

    // 取消调度和运行中的任务
    this.cancelSchedule(id);
    this.cancelTask(id);

    return true;
  }

  /**
   * 运行自动化任务
   */
  async runAutomation(id: string): Promise<AutomationResult> {
    const automation = this.getAutomation(id);
    if (!automation) {
      return {
        taskId: id,
        status: 'failed',
        error: '任务不存在',
      };
    }

    if (!isKhojClientInitialized()) {
      return {
        taskId: id,
        status: 'failed',
        error: 'Khoj 未连接',
      };
    }

    // 创建取消控制器
    const controller = new AbortController();
    this.runningTasks.set(id, controller);

    try {
      const client = getKhojClient();
      
      // 检查连接
      const healthy = await client.healthCheck();
      if (!healthy) {
        throw new Error('Khoj 服务不可用');
      }

      // 根据任务类型执行
      let result: AutomationResult;

      switch (automation.type) {
        case 'research':
          result = await this.runResearchTask(automation, controller.signal);
          break;
        case 'summary':
          result = await this.runSummaryTask(automation, controller.signal);
          break;
        default:
          result = await this.runCustomTask(automation, controller.signal);
      }

      // 更新最后运行时间
      this.updateAutomation(id, { lastRunAt: new Date().toISOString() });

      // 创建通知
      if (result.status === 'completed') {
        this.addNotification({
          type: 'research',
          title: `${automation.name} 完成`,
          content: result.content?.slice(0, 200) || '任务已完成',
          taskId: id,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      return {
        taskId: id,
        status: 'failed',
        error: errorMessage,
      };
    } finally {
      this.runningTasks.delete(id);
    }
  }

  /**
   * 运行研究任务
   */
  private async runResearchTask(
    automation: AutomationConfig,
    signal: AbortSignal
  ): Promise<AutomationResult> {
    const client = getKhojClient();

    // 使用 Khoj 对话进行研究
    const response = await client.chat(
      `请帮我研究以下主题并提供详细分析：${automation.query}`,
      { stream: false }
    );

    if (signal.aborted) {
      return { taskId: automation.id, status: 'cancelled' };
    }

    // 处理响应
    if ('message' in response) {
      return {
        taskId: automation.id,
        status: 'completed',
        content: response.message,
        sources: response.context?.map((ctx, i) => ({
          title: `来源 ${i + 1}`,
          snippet: ctx.slice(0, 200),
        })),
        completedAt: new Date().toISOString(),
      };
    }

    return {
      taskId: automation.id,
      status: 'failed',
      error: '无法解析响应',
    };
  }

  /**
   * 运行摘要任务
   */
  private async runSummaryTask(
    automation: AutomationConfig,
    signal: AbortSignal
  ): Promise<AutomationResult> {
    const client = getKhojClient();

    // 先搜索相关内容
    const searchResults = await client.search(automation.query, { limit: 10 });

    if (signal.aborted) {
      return { taskId: automation.id, status: 'cancelled' };
    }

    // 生成摘要
    const context = searchResults.map(r => r.entry).join('\n\n');
    const response = await client.chat(
      `请根据以下内容生成摘要：\n\n${context}\n\n主题：${automation.query}`,
      { stream: false }
    );

    if (signal.aborted) {
      return { taskId: automation.id, status: 'cancelled' };
    }

    if ('message' in response) {
      return {
        taskId: automation.id,
        status: 'completed',
        content: response.message,
        sources: searchResults.map(r => ({
          title: r.additional?.heading || r.file,
          snippet: r.entry.slice(0, 200),
        })),
        completedAt: new Date().toISOString(),
      };
    }

    return {
      taskId: automation.id,
      status: 'failed',
      error: '无法生成摘要',
    };
  }

  /**
   * 运行自定义任务
   */
  private async runCustomTask(
    automation: AutomationConfig,
    signal: AbortSignal
  ): Promise<AutomationResult> {
    const client = getKhojClient();

    const response = await client.chat(automation.query, { stream: false });

    if (signal.aborted) {
      return { taskId: automation.id, status: 'cancelled' };
    }

    if ('message' in response) {
      return {
        taskId: automation.id,
        status: 'completed',
        content: response.message,
        completedAt: new Date().toISOString(),
      };
    }

    return {
      taskId: automation.id,
      status: 'failed',
      error: '无法执行任务',
    };
  }

  /**
   * 取消运行中的任务
   */
  cancelTask(id: string): boolean {
    const controller = this.runningTasks.get(id);
    if (controller) {
      controller.abort();
      this.runningTasks.delete(id);
      return true;
    }
    return false;
  }

  /**
   * 设置任务调度
   */
  private scheduleAutomation(automation: AutomationConfig): void {
    if (!automation.schedule?.enabled) return;

    const interval = automation.schedule.interval;
    if (!interval || interval <= 0) return;

    // 设置定时器（转换为毫秒）
    const timer = setInterval(() => {
      this.runAutomation(automation.id);
    }, interval * 60 * 1000);

    this.schedulers.set(automation.id, timer);
  }

  /**
   * 取消任务调度
   */
  private cancelSchedule(id: string): void {
    const timer = this.schedulers.get(id);
    if (timer) {
      clearInterval(timer);
      this.schedulers.delete(id);
    }
  }

  /**
   * 获取所有通知
   */
  getNotifications(): KhojNotification[] {
    return [...this.notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * 获取未读通知数量
   */
  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  /**
   * 添加通知
   */
  addNotification(notification: Omit<KhojNotification, 'id' | 'createdAt' | 'read'>): KhojNotification {
    const newNotification: KhojNotification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      read: false,
    };

    this.notifications.unshift(newNotification);
    
    // 限制通知数量
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100);
    }

    this.saveToStorage();
    return newNotification;
  }

  /**
   * 标记通知为已读
   */
  markAsRead(id: string): boolean {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * 标记所有通知为已读
   */
  markAllAsRead(): void {
    this.notifications.forEach(n => (n.read = true));
    this.saveToStorage();
  }

  /**
   * 删除通知
   */
  deleteNotification(id: string): boolean {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      this.notifications.splice(index, 1);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * 清空所有通知
   */
  clearNotifications(): void {
    this.notifications = [];
    this.saveToStorage();
  }

  /**
   * 启动所有已启用的调度任务
   */
  startAllSchedulers(): void {
    for (const automation of this.automations) {
      if (automation.enabled && automation.schedule?.enabled) {
        this.scheduleAutomation(automation);
      }
    }
  }

  /**
   * 停止所有调度任务
   */
  stopAllSchedulers(): void {
    for (const [id] of this.schedulers) {
      this.cancelSchedule(id);
    }
  }
}

// 单例实例
export const khojAutomationService = new KhojAutomationService();
