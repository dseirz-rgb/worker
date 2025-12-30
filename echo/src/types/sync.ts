/**
 * 同步相关类型定义
 * 定义 Supabase 云同步所需的所有类型
 */

// ============== 同步状态 ==============

/**
 * 同步状态枚举
 */
export type SyncStatusType = 
  | 'idle'           // 空闲
  | 'syncing'        // 同步中
  | 'success'        // 同步成功
  | 'error'          // 同步失败
  | 'offline'        // 离线
  | 'conflict';      // 存在冲突

/**
 * 同步方向
 */
export type SyncDirection = 'upload' | 'download' | 'bidirectional';

/**
 * 同步操作类型
 */
export type SyncOperation = 'create' | 'update' | 'delete';

/**
 * 数据集合类型
 */
export type SyncCollection = 'notes' | 'tasks' | 'memories' | 'reminders';

// ============== 同步配置 ==============

/**
 * Supabase 配置
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
}

/**
 * 同步配置
 */
export interface SyncConfig {
  supabase: SupabaseConfig;
  autoSync: boolean;           // 是否自动同步
  syncInterval: number;        // 自动同步间隔（毫秒）
  syncOnReconnect: boolean;    // 重连后是否自动同步
  conflictResolution: 'local' | 'remote' | 'newest'; // 冲突解决策略
}

// ============== 同步项 ==============

/**
 * 同步队列项
 */
export interface SyncQueueItem {
  id: string;
  collection: SyncCollection;
  recordId: string;
  operation: SyncOperation;
  data: Record<string, unknown>;
  timestamp: string;
  retryCount: number;
  lastError?: string;
}

/**
 * 同步记录（用于追踪变更）
 */
export interface SyncRecord {
  id: string;
  collection: SyncCollection;
  recordId: string;
  localVersion: number;
  remoteVersion: number;
  localUpdatedAt: string;
  remoteUpdatedAt?: string;
  syncedAt?: string;
  status: 'synced' | 'pending' | 'conflict';
}

// ============== 同步冲突 ==============

/**
 * 同步冲突
 */
export interface SyncConflict {
  id: string;
  collection: SyncCollection;
  recordId: string;
  localData: Record<string, unknown>;
  remoteData: Record<string, unknown>;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  detectedAt: string;
  resolved: boolean;
  resolution?: 'local' | 'remote' | 'merged';
}

// ============== 同步状态 ==============

/**
 * 同步状态信息
 */
export interface SyncStatus {
  status: SyncStatusType;
  isOnline: boolean;
  lastSyncAt?: string;
  pendingChanges: number;
  conflicts: number;
  error?: string;
  progress?: {
    total: number;
    completed: number;
    current?: string;
  };
}

/**
 * 同步结果
 */
export interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  conflicts: SyncConflict[];
  errors: SyncError[];
  duration: number;
  timestamp: string;
}

/**
 * 同步错误
 */
export interface SyncError {
  collection: SyncCollection;
  recordId: string;
  operation: SyncOperation;
  message: string;
  code?: string;
  timestamp: string;
}

// ============== 同步事件 ==============

/**
 * 同步事件类型
 */
export type SyncEventType = 
  | 'sync:start'
  | 'sync:progress'
  | 'sync:complete'
  | 'sync:error'
  | 'sync:conflict'
  | 'sync:online'
  | 'sync:offline';

/**
 * 同步事件
 */
export interface SyncEvent {
  type: SyncEventType;
  timestamp: string;
  data?: unknown;
}

// ============== Supabase 数据模型 ==============

/**
 * Supabase 笔记表结构
 */
export interface SupabaseNote {
  id: string;
  user_id: string;
  content: string;
  type: string;
  domain: string;
  tags: string[];
  is_pinned: boolean;
  is_archived: boolean;
  ai_summary?: string;
  parent_id?: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * Supabase 任务表结构
 */
export interface SupabaseTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  deadline?: string;
  domain: string;
  parent_id?: string;
  version: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  deleted_at?: string;
}

/**
 * Supabase 记忆表结构
 */
export interface SupabaseMemory {
  id: string;
  user_id: string;
  content: string;
  source: string;
  source_id?: string;
  category: string;
  domain: string;
  importance: number;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * Supabase 提醒表结构
 */
export interface SupabaseReminder {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  scheduled_at: string;
  status: string;
  context: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ============== 同步钩子类型 ==============

/**
 * 同步钩子返回类型
 */
export interface UseSyncReturn {
  status: SyncStatus;
  config: SyncConfig;
  isConfigured: boolean;
  sync: () => Promise<SyncResult>;
  syncCollection: (collection: SyncCollection) => Promise<SyncResult>;
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote') => Promise<void>;
  updateConfig: (config: Partial<SyncConfig>) => void;
  clearQueue: () => void;
  getConflicts: () => SyncConflict[];
}
