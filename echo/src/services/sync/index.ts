/**
 * 同步服务模块导出
 */

// Supabase 客户端
export {
  SupabaseClient,
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  getSupabaseClient,
  initSupabaseClient,
  resetSupabaseClient,
  testSupabaseConnection,
} from './supabaseClient';

// 同步服务
export {
  SyncService,
  getSyncService,
  initSyncService,
  queueNoteSync,
  queueTaskSync,
  queueMemorySync,
  triggerSync,
  getSyncStatus,
} from './syncService';

// 类型重导出
export type {
  SyncStatus,
  SyncStatusType,
  SyncResult,
  SyncError,
  SyncConflict,
  SyncQueueItem,
  SyncCollection,
  SyncOperation,
  SyncConfig,
  SupabaseConfig,
  SupabaseNote,
  SupabaseTask,
  SupabaseMemory,
  UseSyncReturn,
} from '../../types/sync';
