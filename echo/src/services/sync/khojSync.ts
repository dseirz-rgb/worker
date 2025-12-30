/**
 * Khoj 同步服务
 * 将 Echo 数据同步到 Khoj 知识库
 * 
 * 功能：
 * - 同步笔记和任务到 Khoj
 * - 离线队列管理
 * - 自动重试机制
 */

import {
  getKhojClient,
  isKhojClientInitialized,
} from '../khoj/khojClient';
import { loadKhojSettings } from '../khoj/khojConfig';
import type { Note, Task } from '../../types/database';

// ============================================
// 类型定义
// ============================================

/**
 * 同步状态
 */
export interface KhojSyncStatus {
  /** 最后同步时间 */
  lastSyncAt: string | null;
  /** 待同步数量 */
  pendingCount: number;
  /** Khoj 是否在线 */
  isOnline: boolean;
  /** 是否正在同步 */
  isSyncing: boolean;
}

/**
 * 同步队列项
 */
interface SyncQueueItem {
  /** 项目 ID */
  id: string;
  /** 项目类型 */
  type: 'note' | 'task';
  /** 操作类型 */
  action: 'create' | 'update' | 'delete';
  /** 数据内容 */
  data: Note | Task;
  /** 创建时间 */
  createdAt: string;
  /** 重试次数 */
  retryCount: number;
}

/** localStorage 存储键 */
const QUEUE_STORAGE_KEY = 'echo_khoj_sync_queue';
const LAST_SYNC_KEY = 'echo_khoj_last_sync';

/** 最大重试次数 */
const MAX_RETRY_COUNT = 3;

/** 重试延迟（毫秒） */
const RETRY_DELAY = 5000;

// ============================================
// Khoj 同步服务类
// ============================================

/**
 * Khoj 同步服务
 * 将 Echo 数据同步到 Khoj 知识库
 */
export class KhojSyncService {
  /** 同步队列 */
  private syncQueue: SyncQueueItem[] = [];
  
  /** 是否正在同步 */
  private isSyncing: boolean = false;
  
  /** 最后同步时间 */
  private lastSyncAt: string | null = null;
  
  /** 重试定时器 */
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // 从 localStorage 恢复队列
    this.loadQueue();
    this.lastSyncAt = localStorage.getItem(LAST_SYNC_KEY);
  }

  /**
   * 同步笔记到 Khoj
   * @param note - 笔记数据
   * @param action - 操作类型
   */
  async syncNote(note: Note, action: 'create' | 'update' | 'delete'): Promise<void> {
    // 检查是否启用同步
    const settings = loadKhojSettings();
    if (!settings.connection.enabled || !settings.connection.autoSync) {
      return;
    }

    const queueItem: SyncQueueItem = {
      id: note.id,
      type: 'note',
      action,
      data: note,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    this.addToQueue(queueItem);
    await this.processSyncQueue();
  }

  /**
   * 同步任务到 Khoj
   * @param task - 任务数据
   * @param action - 操作类型
   */
  async syncTask(task: Task, action: 'create' | 'update' | 'delete'): Promise<void> {
    // 检查是否启用同步
    const settings = loadKhojSettings();
    if (!settings.connection.enabled || !settings.connection.autoSync) {
      return;
    }

    const queueItem: SyncQueueItem = {
      id: task.id,
      type: 'task',
      action,
      data: task,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    this.addToQueue(queueItem);
    await this.processSyncQueue();
  }

  /**
   * 处理同步队列
   */
  async processSyncQueue(): Promise<void> {
    // 防止并发处理
    if (this.isSyncing || this.syncQueue.length === 0) {
      return;
    }

    // 检查 Khoj 是否可用
    if (!isKhojClientInitialized()) {
      this.scheduleRetry();
      return;
    }

    this.isSyncing = true;

    try {
      const khojClient = getKhojClient();
      const isHealthy = await khojClient.healthCheck();

      if (!isHealthy) {
        console.warn('Khoj 服务不可用，稍后重试');
        this.scheduleRetry();
        return;
      }

      // 处理队列中的每个项目
      while (this.syncQueue.length > 0) {
        const item = this.syncQueue[0];

        try {
          await this.syncItem(item);
          // 成功，从队列移除
          this.syncQueue.shift();
          this.saveQueue();
        } catch (error) {
          console.error('同步项目失败:', error);
          item.retryCount++;

          if (item.retryCount >= MAX_RETRY_COUNT) {
            // 达到最大重试次数，丢弃
            console.error('达到最大重试次数，丢弃项目:', item);
            this.syncQueue.shift();
            this.saveQueue();
          } else {
            // 移到队列末尾，稍后重试
            this.syncQueue.shift();
            this.syncQueue.push(item);
            this.saveQueue();
            break;
          }
        }
      }

      // 更新最后同步时间
      this.lastSyncAt = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, this.lastSyncAt);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 同步单个项目
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    const khojClient = getKhojClient();

    // 删除操作
    if (item.action === 'delete') {
      const filename = `echo_${item.type}_${item.id}.md`;
      await khojClient.deleteDocument(filename);
      return;
    }

    // 创建或更新
    const content = this.formatForKhoj(item);
    const filename = `echo_${item.type}_${item.id}.md`;

    const result = await khojClient.indexDocument(content, filename, {
      source: 'echo',
      type: item.type,
      id: item.id,
      action: item.action,
    });

    if (!result.success) {
      throw new Error(result.error || '索引失败');
    }
  }

  /**
   * 格式化数据为 Khoj 可索引格式
   */
  private formatForKhoj(item: SyncQueueItem): string {
    if (item.type === 'note') {
      const note = item.data as Note;
      return [
        `# Echo 笔记`,
        '',
        `**领域:** ${note.domain || '通用'}`,
        `**创建时间:** ${note.createdAt}`,
        `**更新时间:** ${note.updatedAt}`,
        '',
        '---',
        '',
        note.content,
      ].join('\n');
    }

    if (item.type === 'task') {
      const task = item.data as Task;
      return [
        `# Echo 任务: ${task.title}`,
        '',
        `**状态:** ${task.status}`,
        `**优先级:** ${task.priority}`,
        `**领域:** ${task.domain || '通用'}`,
        `**截止日期:** ${task.deadline || '无'}`,
        `**创建时间:** ${task.createdAt}`,
        '',
        '---',
        '',
        task.description || '无描述',
      ].join('\n');
    }

    return JSON.stringify(item.data, null, 2);
  }

  /**
   * 获取同步状态
   */
  async getStatus(): Promise<KhojSyncStatus> {
    let isOnline = false;

    if (isKhojClientInitialized()) {
      try {
        const khojClient = getKhojClient();
        isOnline = await khojClient.healthCheck();
      } catch {
        isOnline = false;
      }
    }

    return {
      lastSyncAt: this.lastSyncAt,
      pendingCount: this.syncQueue.length,
      isOnline,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * 获取待同步数量
   */
  getPendingCount(): number {
    return this.syncQueue.length;
  }

  /**
   * 添加到队列
   */
  private addToQueue(item: SyncQueueItem): void {
    // 检查是否已存在相同项目，如果存在则更新
    const existingIndex = this.syncQueue.findIndex(
      (q) => q.id === item.id && q.type === item.type
    );

    if (existingIndex >= 0) {
      // 更新现有项目
      this.syncQueue[existingIndex] = item;
    } else {
      // 添加新项目
      this.syncQueue.push(item);
    }

    this.saveQueue();
  }

  /**
   * 保存队列到 localStorage
   */
  private saveQueue(): void {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('保存同步队列失败:', error);
    }
  }

  /**
   * 从 localStorage 加载队列
   */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.syncQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('加载同步队列失败:', error);
      this.syncQueue = [];
    }
  }

  /**
   * 安排重试
   */
  private scheduleRetry(): void {
    if (this.retryTimer) {
      return;
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.processSyncQueue();
    }, RETRY_DELAY);
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.syncQueue = [];
    this.saveQueue();
  }
}

// ============================================
// 单例导出
// ============================================

/** Khoj 同步服务单例 */
export const khojSyncService = new KhojSyncService();
