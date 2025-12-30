/**
 * 同步服务
 * 实现 SeekDB ↔ Supabase 双向同步
 */

import type {
  SyncStatus,
  SyncStatusType,
  SyncResult,
  SyncError,
  SyncConflict,
  SyncQueueItem,
  SyncCollection,
  SyncOperation,
  SyncConfig,
  SupabaseNote,
  SupabaseTask,
  SupabaseMemory,
} from '../../types/sync';
import type { Note, Task } from '../../types/database';
import {
  getSupabaseClient,
  getSupabaseConfig,
  saveSupabaseConfig,
  SupabaseClient,
} from './supabaseClient';
import { seekdbService } from '../database/seekdbService';

// ============== 存储键 ==============

const SYNC_QUEUE_KEY = 'echo_sync_queue';
const SYNC_STATUS_KEY = 'echo_sync_status';
const SYNC_CONFIG_KEY = 'echo_sync_config';
const LAST_SYNC_KEY = 'echo_last_sync';

// ============== 默认配置 ==============

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  supabase: { url: '', anonKey: '', enabled: false },
  autoSync: true,
  syncInterval: 5 * 60 * 1000, // 5 分钟
  syncOnReconnect: true,
  conflictResolution: 'newest',
};

// ============== 同步服务类 ==============

export class SyncService {
  private client: SupabaseClient | null = null;
  private status: SyncStatus;
  private config: SyncConfig;
  private queue: SyncQueueItem[] = [];
  private conflicts: SyncConflict[] = [];
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isOnline: boolean = navigator.onLine;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  constructor() {
    this.status = this.loadStatus();
    this.config = this.loadConfig();
    this.queue = this.loadQueue();
    this.client = getSupabaseClient();

    // 监听网络状态
    this.setupNetworkListeners();
  }

  // ============== 初始化 ==============

  /**
   * 初始化同步服务
   */
  async initialize(): Promise<void> {
    console.log('[Sync] 初始化同步服务...');

    // 检查网络状态
    this.isOnline = navigator.onLine;
    this.updateStatus({ isOnline: this.isOnline });

    // 检查 Supabase 配置
    const supabaseConfig = getSupabaseConfig();
    if (supabaseConfig.enabled && supabaseConfig.url && supabaseConfig.anonKey) {
      this.client = getSupabaseClient();
      
      if (this.client) {
        const isHealthy = await this.client.healthCheck();
        if (isHealthy) {
          console.log('[Sync] Supabase 连接成功');
          this.updateStatus({ status: 'idle' });
          
          // 启动自动同步
          if (this.config.autoSync) {
            this.startAutoSync();
          }
          
          // 处理离线队列
          if (this.queue.length > 0 && this.isOnline) {
            await this.processQueue();
          }
        } else {
          console.warn('[Sync] Supabase 连接失败');
          this.updateStatus({ status: 'offline', error: '无法连接到 Supabase' });
        }
      }
    } else {
      console.log('[Sync] Supabase 未配置，同步功能已禁用');
      this.updateStatus({ status: 'offline' });
    }
  }

  // ============== 网络监听 ==============

  /**
   * 设置网络状态监听
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('[Sync] 网络已连接');
      this.isOnline = true;
      this.updateStatus({ isOnline: true, status: 'idle' });
      
      // 重连后自动同步
      if (this.config.syncOnReconnect && this.client) {
        this.processQueue().then(() => this.sync());
      }
    });

    window.addEventListener('offline', () => {
      console.log('[Sync] 网络已断开');
      this.isOnline = false;
      this.updateStatus({ isOnline: false, status: 'offline' });
    });
  }

  // ============== 状态管理 ==============

  /**
   * 加载同步状态
   */
  private loadStatus(): SyncStatus {
    try {
      const saved = localStorage.getItem(SYNC_STATUS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('[Sync] 加载状态失败:', error);
    }
    
    return {
      status: 'idle',
      isOnline: navigator.onLine,
      pendingChanges: 0,
      conflicts: 0,
    };
  }

  /**
   * 更新同步状态
   */
  private updateStatus(updates: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...updates };
    this.saveStatus();
    this.notifyListeners();
  }

  /**
   * 保存同步状态
   */
  private saveStatus(): void {
    try {
      localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(this.status));
    } catch (error) {
      console.error('[Sync] 保存状态失败:', error);
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.status));
  }

  // ============== 配置管理 ==============

  /**
   * 加载同步配置
   */
  private loadConfig(): SyncConfig {
    try {
      const saved = localStorage.getItem(SYNC_CONFIG_KEY);
      if (saved) {
        return { ...DEFAULT_SYNC_CONFIG, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('[Sync] 加载配置失败:', error);
    }
    return DEFAULT_SYNC_CONFIG;
  }

  /**
   * 保存同步配置
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('[Sync] 保存配置失败:', error);
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): SyncConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();

    // 如果更新了 Supabase 配置，重新初始化客户端
    if (updates.supabase) {
      saveSupabaseConfig(updates.supabase);
      this.client = getSupabaseClient();
    }

    // 如果更新了自动同步设置
    if (updates.autoSync !== undefined) {
      if (updates.autoSync) {
        this.startAutoSync();
      } else {
        this.stopAutoSync();
      }
    }
  }

  // ============== 离线队列管理 ==============

  /**
   * 加载离线队列
   */
  private loadQueue(): SyncQueueItem[] {
    try {
      const saved = localStorage.getItem(SYNC_QUEUE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('[Sync] 加载队列失败:', error);
    }
    return [];
  }

  /**
   * 保存离线队列
   */
  private saveQueue(): void {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.queue));
      this.updateStatus({ pendingChanges: this.queue.length });
    } catch (error) {
      console.error('[Sync] 保存队列失败:', error);
    }
  }

  /**
   * 添加到离线队列
   */
  addToQueue(
    collection: SyncCollection,
    recordId: string,
    operation: SyncOperation,
    data: Record<string, unknown>
  ): void {
    // 检查是否已存在相同记录的操作
    const existingIndex = this.queue.findIndex(
      item => item.collection === collection && item.recordId === recordId
    );

    const queueItem: SyncQueueItem = {
      id: `${collection}_${recordId}_${Date.now()}`,
      collection,
      recordId,
      operation,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    if (existingIndex >= 0) {
      // 合并操作：如果已有 create，后续 update 保持 create
      const existing = this.queue[existingIndex];
      if (existing.operation === 'create' && operation === 'update') {
        queueItem.operation = 'create';
        queueItem.data = { ...existing.data, ...data };
      }
      // 如果是 delete，移除之前的操作
      if (operation === 'delete') {
        if (existing.operation === 'create') {
          // 创建后删除，直接移除
          this.queue.splice(existingIndex, 1);
          this.saveQueue();
          return;
        }
      }
      this.queue[existingIndex] = queueItem;
    } else {
      this.queue.push(queueItem);
    }

    this.saveQueue();
    console.log(`[Sync] 添加到队列: ${collection}/${recordId} (${operation})`);
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  // ============== 处理离线队列 ==============

  /**
   * 处理离线队列
   */
  async processQueue(): Promise<SyncResult> {
    if (!this.client || !this.isOnline) {
      return this.createEmptyResult();
    }

    if (this.queue.length === 0) {
      return this.createEmptyResult();
    }

    console.log(`[Sync] 处理离线队列，共 ${this.queue.length} 项`);
    this.updateStatus({ status: 'syncing' });

    const startTime = Date.now();
    const errors: SyncError[] = [];
    let uploaded = 0;

    // 按时间顺序处理队列
    const sortedQueue = [...this.queue].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const item of sortedQueue) {
      try {
        await this.processQueueItem(item);
        uploaded++;
        
        // 从队列中移除成功的项
        const index = this.queue.findIndex(q => q.id === item.id);
        if (index >= 0) {
          this.queue.splice(index, 1);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        console.error(`[Sync] 处理队列项失败:`, item, error);
        
        // 增加重试计数
        const index = this.queue.findIndex(q => q.id === item.id);
        if (index >= 0) {
          this.queue[index].retryCount++;
          this.queue[index].lastError = errorMessage;
          
          // 超过最大重试次数，移除
          if (this.queue[index].retryCount >= 3) {
            errors.push({
              collection: item.collection,
              recordId: item.recordId,
              operation: item.operation,
              message: errorMessage,
              timestamp: new Date().toISOString(),
            });
            this.queue.splice(index, 1);
          }
        }
      }
    }

    this.saveQueue();
    
    const result: SyncResult = {
      success: errors.length === 0,
      uploaded,
      downloaded: 0,
      conflicts: [],
      errors,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    this.updateStatus({
      status: errors.length > 0 ? 'error' : 'success',
      lastSyncAt: result.timestamp,
      error: errors.length > 0 ? `${errors.length} 个错误` : undefined,
    });

    return result;
  }

  /**
   * 处理单个队列项
   */
  private async processQueueItem(item: SyncQueueItem): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化');

    const tableMap: Record<SyncCollection, string> = {
      notes: 'notes',
      tasks: 'tasks',
      memories: 'memories',
      reminders: 'reminders',
    };

    const table = tableMap[item.collection];

    switch (item.operation) {
      case 'create':
      case 'update':
        await this.client.upsert(table, [item.data]);
        break;
      case 'delete':
        await this.client.softDelete(table, item.recordId);
        break;
    }
  }

  // ============== 核心同步逻辑 ==============

  /**
   * 执行完整同步
   */
  async sync(): Promise<SyncResult> {
    if (!this.client) {
      console.warn('[Sync] 客户端未配置，跳过同步');
      return this.createEmptyResult();
    }

    if (!this.isOnline) {
      console.warn('[Sync] 离线状态，跳过同步');
      return this.createEmptyResult();
    }

    console.log('[Sync] 开始同步...');
    this.updateStatus({ status: 'syncing' });

    const startTime = Date.now();
    const errors: SyncError[] = [];
    const conflicts: SyncConflict[] = [];
    let uploaded = 0;
    let downloaded = 0;

    try {
      // 1. 先处理离线队列
      const queueResult = await this.processQueue();
      uploaded += queueResult.uploaded;
      errors.push(...queueResult.errors);

      // 2. 同步各个集合
      const collections: SyncCollection[] = ['notes', 'tasks', 'memories'];
      
      for (const collection of collections) {
        try {
          const result = await this.syncCollection(collection);
          uploaded += result.uploaded;
          downloaded += result.downloaded;
          conflicts.push(...result.conflicts);
          errors.push(...result.errors);
        } catch (error) {
          console.error(`[Sync] 同步 ${collection} 失败:`, error);
          errors.push({
            collection,
            recordId: '*',
            operation: 'update',
            message: error instanceof Error ? error.message : '同步失败',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // 更新冲突列表
      this.conflicts = conflicts;
      
      const result: SyncResult = {
        success: errors.length === 0,
        uploaded,
        downloaded,
        conflicts,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      // 保存最后同步时间
      localStorage.setItem(LAST_SYNC_KEY, result.timestamp);

      this.updateStatus({
        status: conflicts.length > 0 ? 'conflict' : (errors.length > 0 ? 'error' : 'success'),
        lastSyncAt: result.timestamp,
        conflicts: conflicts.length,
        error: errors.length > 0 ? `${errors.length} 个错误` : undefined,
      });

      console.log(`[Sync] 同步完成: 上传 ${uploaded}, 下载 ${downloaded}, 冲突 ${conflicts.length}`);
      return result;

    } catch (error) {
      console.error('[Sync] 同步失败:', error);
      
      this.updateStatus({
        status: 'error',
        error: error instanceof Error ? error.message : '同步失败',
      });

      return {
        success: false,
        uploaded,
        downloaded,
        conflicts,
        errors: [{
          collection: 'notes',
          recordId: '*',
          operation: 'update',
          message: error instanceof Error ? error.message : '同步失败',
          timestamp: new Date().toISOString(),
        }],
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 同步单个集合
   */
  async syncCollection(collection: SyncCollection): Promise<SyncResult> {
    if (!this.client) {
      return this.createEmptyResult();
    }

    const startTime = Date.now();
    const errors: SyncError[] = [];
    const conflicts: SyncConflict[] = [];
    let uploaded = 0;
    let downloaded = 0;

    try {
      // 获取最后同步时间
      const lastSync = localStorage.getItem(LAST_SYNC_KEY) || '1970-01-01T00:00:00Z';

      // 1. 从 Supabase 获取更新的数据
      const remoteData = await this.fetchRemoteUpdates(collection, lastSync);
      
      // 2. 从本地获取数据
      const localData = await this.fetchLocalData(collection);

      // 3. 比较并合并
      for (const remote of remoteData) {
        const local = localData.find(l => l.id === remote.id);
        
        if (!local) {
          // 远程有，本地没有 -> 下载
          await this.saveToLocal(collection, remote);
          downloaded++;
        } else {
          // 两边都有 -> 检查冲突
          const conflict = this.detectConflict(collection, local, remote);
          if (conflict) {
            conflicts.push(conflict);
          } else if (new Date(remote.updated_at) > new Date(local.updatedAt || local.createdAt)) {
            // 远程更新 -> 下载
            await this.saveToLocal(collection, remote);
            downloaded++;
          }
        }
      }

      // 4. 上传本地新数据
      for (const local of localData) {
        const remote = remoteData.find(r => r.id === local.id);
        
        if (!remote) {
          // 本地有，远程没有 -> 上传
          await this.uploadToRemote(collection, local);
          uploaded++;
        } else if (new Date(local.updatedAt || local.createdAt) > new Date(remote.updated_at)) {
          // 本地更新 -> 上传
          await this.uploadToRemote(collection, local);
          uploaded++;
        }
      }

    } catch (error) {
      errors.push({
        collection,
        recordId: '*',
        operation: 'update',
        message: error instanceof Error ? error.message : '同步失败',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: errors.length === 0,
      uploaded,
      downloaded,
      conflicts,
      errors,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  // ============== 数据获取与保存 ==============

  /**
   * 从远程获取更新
   */
  private async fetchRemoteUpdates(
    collection: SyncCollection,
    since: string
  ): Promise<Array<Record<string, unknown>>> {
    if (!this.client) return [];

    const tableMap: Record<SyncCollection, string> = {
      notes: 'notes',
      tasks: 'tasks',
      memories: 'memories',
      reminders: 'reminders',
    };

    try {
      return await this.client.getUpdatedSince(tableMap[collection], since);
    } catch (error) {
      console.error(`[Sync] 获取远程 ${collection} 失败:`, error);
      return [];
    }
  }

  /**
   * 从本地获取数据
   */
  private async fetchLocalData(
    collection: SyncCollection
  ): Promise<Array<Record<string, unknown>>> {
    try {
      switch (collection) {
        case 'notes':
          const notes = await seekdbService.listNotes(1000);
          return notes.map(n => ({
            id: n.id,
            content: n.content,
            ...n.metadata,
            createdAt: (n.metadata as Record<string, unknown>)?.created_at,
            updatedAt: (n.metadata as Record<string, unknown>)?.updated_at,
          }));
        
        case 'tasks':
          const tasks = await seekdbService.listTasks(1000);
          return tasks.map(t => ({
            id: t.id,
            content: t.content,
            ...t.metadata,
            createdAt: (t.metadata as Record<string, unknown>)?.created_at,
            updatedAt: (t.metadata as Record<string, unknown>)?.updated_at,
          }));
        
        case 'memories':
          const memories = await seekdbService.listMemories(1000);
          return memories.map(m => ({
            id: m.id,
            content: m.content,
            ...m.metadata,
            createdAt: (m.metadata as Record<string, unknown>)?.created_at,
            updatedAt: (m.metadata as Record<string, unknown>)?.updated_at,
          }));
        
        default:
          return [];
      }
    } catch (error) {
      console.error(`[Sync] 获取本地 ${collection} 失败:`, error);
      return [];
    }
  }

  /**
   * 保存到本地
   */
  private async saveToLocal(
    collection: SyncCollection,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      switch (collection) {
        case 'notes':
          await seekdbService.createNote({
            id: data.id as string,
            content: data.content as string,
            domain: (data.domain as string) || 'general',
            tags: (data.tags as string[]) || [],
            createdAt: (data.created_at as string) || new Date().toISOString(),
          });
          break;
        
        case 'tasks':
          await seekdbService.createTask({
            id: data.id as string,
            title: data.title as string,
            description: (data.description as string) || '',
            priority: (data.priority as string) || 'medium',
            status: (data.status as string) || 'pending',
            deadline: data.deadline as string | undefined,
            domain: (data.domain as string) || 'general',
            createdAt: (data.created_at as string) || new Date().toISOString(),
          });
          break;
        
        case 'memories':
          await seekdbService.createMemory({
            id: data.id as string,
            content: data.content as string,
            userId: (data.user_id as string) || 'default',
            source: (data.source as string) || 'sync',
            sourceId: data.source_id as string | undefined,
            category: (data.category as string) || 'general',
            domain: (data.domain as string) || 'general',
            createdAt: (data.created_at as string) || new Date().toISOString(),
          });
          break;
      }
    } catch (error) {
      console.error(`[Sync] 保存到本地失败:`, collection, data.id, error);
      throw error;
    }
  }

  /**
   * 上传到远程
   */
  private async uploadToRemote(
    collection: SyncCollection,
    data: Record<string, unknown>
  ): Promise<void> {
    if (!this.client) return;

    const tableMap: Record<SyncCollection, string> = {
      notes: 'notes',
      tasks: 'tasks',
      memories: 'memories',
      reminders: 'reminders',
    };

    try {
      // 转换为 Supabase 格式
      const remoteData = this.convertToRemoteFormat(collection, data);
      await this.client.upsert(tableMap[collection], [remoteData]);
    } catch (error) {
      console.error(`[Sync] 上传到远程失败:`, collection, data.id, error);
      throw error;
    }
  }

  /**
   * 转换为远程格式
   */
  private convertToRemoteFormat(
    collection: SyncCollection,
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const base = {
      id: data.id,
      version: ((data.version as number) || 0) + 1,
      created_at: data.createdAt || data.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    switch (collection) {
      case 'notes':
        return {
          ...base,
          content: data.content,
          type: data.type || 'text',
          domain: data.domain || 'general',
          tags: data.tags || [],
          is_pinned: data.isPinned || false,
          is_archived: data.isArchived || false,
          ai_summary: data.aiSummary,
          parent_id: data.parentId,
        };
      
      case 'tasks':
        return {
          ...base,
          title: data.title,
          description: data.description,
          priority: data.priority || 'medium',
          status: data.status || 'pending',
          deadline: data.deadline,
          domain: data.domain || 'general',
          parent_id: data.parentId,
          completed_at: data.completedAt,
        };
      
      case 'memories':
        return {
          ...base,
          content: data.content,
          source: data.source || 'manual',
          source_id: data.sourceId,
          category: data.category || 'general',
          domain: data.domain || 'general',
          importance: data.importance || 5,
        };
      
      default:
        return { ...base, ...data };
    }
  }

  // ============== 冲突检测与解决 ==============

  /**
   * 检测冲突
   */
  private detectConflict(
    collection: SyncCollection,
    local: Record<string, unknown>,
    remote: Record<string, unknown>
  ): SyncConflict | null {
    const localUpdated = new Date(local.updatedAt as string || local.createdAt as string);
    const remoteUpdated = new Date(remote.updated_at as string);
    
    // 如果时间差在 1 秒内，认为是同一次更新
    if (Math.abs(localUpdated.getTime() - remoteUpdated.getTime()) < 1000) {
      return null;
    }

    // 检查内容是否不同
    const localContent = JSON.stringify(this.getNormalizedContent(local));
    const remoteContent = JSON.stringify(this.getNormalizedContent(remote));
    
    if (localContent === remoteContent) {
      return null;
    }

    // 如果两边都有更新且内容不同，则存在冲突
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    if (lastSync) {
      const lastSyncTime = new Date(lastSync);
      if (localUpdated > lastSyncTime && remoteUpdated > lastSyncTime) {
        return {
          id: `conflict_${collection}_${local.id}_${Date.now()}`,
          collection,
          recordId: local.id as string,
          localData: local,
          remoteData: remote,
          localUpdatedAt: localUpdated.toISOString(),
          remoteUpdatedAt: remoteUpdated.toISOString(),
          detectedAt: new Date().toISOString(),
          resolved: false,
        };
      }
    }

    return null;
  }

  /**
   * 获取标准化内容（用于比较）
   */
  private getNormalizedContent(data: Record<string, unknown>): Record<string, unknown> {
    const { id, createdAt, created_at, updatedAt, updated_at, version, ...content } = data;
    return content;
  }

  /**
   * 解决冲突
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote'
  ): Promise<void> {
    const conflict = this.conflicts.find(c => c.id === conflictId);
    if (!conflict) {
      throw new Error('冲突不存在');
    }

    try {
      if (resolution === 'local') {
        // 使用本地数据覆盖远程
        await this.uploadToRemote(conflict.collection, conflict.localData);
      } else {
        // 使用远程数据覆盖本地
        await this.saveToLocal(conflict.collection, conflict.remoteData);
      }

      // 标记冲突已解决
      conflict.resolved = true;
      conflict.resolution = resolution;
      
      // 从冲突列表中移除
      this.conflicts = this.conflicts.filter(c => c.id !== conflictId);
      this.updateStatus({ conflicts: this.conflicts.length });
      
      console.log(`[Sync] 冲突已解决: ${conflictId} -> ${resolution}`);
    } catch (error) {
      console.error('[Sync] 解决冲突失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有冲突
   */
  getConflicts(): SyncConflict[] {
    return [...this.conflicts];
  }

  /**
   * 自动解决冲突
   */
  private autoResolveConflict(conflict: SyncConflict): 'local' | 'remote' {
    switch (this.config.conflictResolution) {
      case 'local':
        return 'local';
      case 'remote':
        return 'remote';
      case 'newest':
      default:
        const localTime = new Date(conflict.localUpdatedAt).getTime();
        const remoteTime = new Date(conflict.remoteUpdatedAt).getTime();
        return localTime > remoteTime ? 'local' : 'remote';
    }
  }

  // ============== 自动同步 ==============

  /**
   * 启动自动同步
   */
  startAutoSync(): void {
    if (this.syncTimer) {
      return;
    }

    console.log(`[Sync] 启动自动同步，间隔 ${this.config.syncInterval / 1000} 秒`);
    
    this.syncTimer = setInterval(() => {
      if (this.isOnline && this.client) {
        this.sync().catch(error => {
          console.error('[Sync] 自动同步失败:', error);
        });
      }
    }, this.config.syncInterval);
  }

  /**
   * 停止自动同步
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('[Sync] 已停止自动同步');
    }
  }

  // ============== 辅助方法 ==============

  /**
   * 创建空结果
   */
  private createEmptyResult(): SyncResult {
    return {
      success: true,
      uploaded: 0,
      downloaded: 0,
      conflicts: [],
      errors: [],
      duration: 0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    const config = getSupabaseConfig();
    return config.enabled && !!config.url && !!config.anonKey;
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.stopAutoSync();
    this.listeners.clear();
    window.removeEventListener('online', () => {});
    window.removeEventListener('offline', () => {});
  }
}

// ============== 单例导出 ==============

let syncServiceInstance: SyncService | null = null;

/**
 * 获取同步服务实例
 */
export function getSyncService(): SyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new SyncService();
  }
  return syncServiceInstance;
}

/**
 * 初始化同步服务
 */
export async function initSyncService(): Promise<SyncService> {
  const service = getSyncService();
  await service.initialize();
  return service;
}

// ============== 便捷方法导出 ==============

/**
 * 添加笔记到同步队列
 */
export function queueNoteSync(
  noteId: string,
  operation: SyncOperation,
  data: Record<string, unknown>
): void {
  getSyncService().addToQueue('notes', noteId, operation, data);
}

/**
 * 添加任务到同步队列
 */
export function queueTaskSync(
  taskId: string,
  operation: SyncOperation,
  data: Record<string, unknown>
): void {
  getSyncService().addToQueue('tasks', taskId, operation, data);
}

/**
 * 添加记忆到同步队列
 */
export function queueMemorySync(
  memoryId: string,
  operation: SyncOperation,
  data: Record<string, unknown>
): void {
  getSyncService().addToQueue('memories', memoryId, operation, data);
}

/**
 * 手动触发同步
 */
export async function triggerSync(): Promise<SyncResult> {
  return getSyncService().sync();
}

/**
 * 获取同步状态
 */
export function getSyncStatus(): SyncStatus {
  return getSyncService().getStatus();
}
