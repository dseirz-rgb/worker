/**
 * Sync State Manager
 * 
 * 管理 Google Drive 同步状态，包括：
 * - Change Token 持久化
 * - 文件同步记录 CRUD
 * 
 * @module services/echo-server/lib/syncStateManager
 */

import { getInvestmentDb } from './investmentDb';

// ============================================================================
// 类型定义
// ============================================================================

export interface SyncState {
  id: number;
  sync_type: string;
  change_token: string | null;
  last_sync_at: string | null;
  status: 'idle' | 'syncing' | 'error';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileSyncRecord {
  id: number;
  drive_file_id: string;
  file_name: string;
  mime_type: string;
  md5_checksum: string | null;
  modified_time: string;
  document_ids: number[];
  source_type: string;
  sync_status: 'synced' | 'pending' | 'error';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFileSyncRecord {
  drive_file_id: string;
  file_name: string;
  mime_type: string;
  md5_checksum?: string | null;
  modified_time: string;
  document_ids?: number[];
  source_type: string;
  sync_status?: 'synced' | 'pending' | 'error';
  error_message?: string | null;
}

export interface UpdateFileSyncRecord {
  file_name?: string;
  mime_type?: string;
  md5_checksum?: string | null;
  modified_time?: string;
  document_ids?: number[];
  source_type?: string;
  sync_status?: 'synced' | 'pending' | 'error';
  error_message?: string | null;
}

// ============================================================================
// SyncStateManager 类
// ============================================================================

const SYNC_TYPE = 'google_drive';

export class SyncStateManager {
  /**
   * 获取当前同步状态
   */
  async getSyncState(): Promise<SyncState | null> {
    const client = getInvestmentDb();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('sync_state')
        .select('*')
        .eq('sync_type', SYNC_TYPE)
        .single();

      if (error) {
        // 如果记录不存在，创建一个
        if (error.code === 'PGRST116') {
          return this.initializeSyncState();
        }
        console.error('[SyncStateManager] Error getting sync state:', error);
        return null;
      }

      return data as SyncState;
    } catch (error) {
      console.error('[SyncStateManager] Exception getting sync state:', error);
      return null;
    }
  }

  /**
   * 初始化同步状态记录
   */
  private async initializeSyncState(): Promise<SyncState | null> {
    const client = getInvestmentDb();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('sync_state')
        .insert({
          sync_type: SYNC_TYPE,
          status: 'idle',
        })
        .select()
        .single();

      if (error) {
        console.error('[SyncStateManager] Error initializing sync state:', error);
        return null;
      }

      return data as SyncState;
    } catch (error) {
      console.error('[SyncStateManager] Exception initializing sync state:', error);
      return null;
    }
  }

  /**
   * 获取 Change Token
   */
  async getChangeToken(): Promise<string | null> {
    const state = await this.getSyncState();
    return state?.change_token ?? null;
  }

  /**
   * 保存 Change Token
   */
  async saveChangeToken(token: string): Promise<boolean> {
    const client = getInvestmentDb();
    if (!client) return false;

    try {
      // 确保记录存在
      await this.getSyncState();

      const { error } = await client
        .from('sync_state')
        .update({
          change_token: token,
          updated_at: new Date().toISOString(),
        })
        .eq('sync_type', SYNC_TYPE);

      if (error) {
        console.error('[SyncStateManager] Error saving change token:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SyncStateManager] Exception saving change token:', error);
      return false;
    }
  }

  /**
   * 更新同步状态
   */
  async updateStatus(
    status: 'idle' | 'syncing' | 'error',
    errorMessage?: string
  ): Promise<boolean> {
    const client = getInvestmentDb();
    if (!client) return false;

    try {
      // 确保记录存在
      await this.getSyncState();

      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'idle') {
        updateData.last_sync_at = new Date().toISOString();
        updateData.error_message = null;
      } else if (status === 'error') {
        updateData.error_message = errorMessage || 'Unknown error';
      } else if (status === 'syncing') {
        updateData.error_message = null;
      }

      const { error } = await client
        .from('sync_state')
        .update(updateData)
        .eq('sync_type', SYNC_TYPE);

      if (error) {
        console.error('[SyncStateManager] Error updating status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SyncStateManager] Exception updating status:', error);
      return false;
    }
  }

  // ==========================================================================
  // 文件同步记录管理
  // ==========================================================================

  /**
   * 根据 Drive 文件 ID 获取同步记录
   */
  async getFileSyncRecord(driveFileId: string): Promise<FileSyncRecord | null> {
    const client = getInvestmentDb();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('file_sync_records')
        .select('*')
        .eq('drive_file_id', driveFileId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // 记录不存在
        }
        console.error('[SyncStateManager] Error getting file sync record:', error);
        return null;
      }

      return data as FileSyncRecord;
    } catch (error) {
      console.error('[SyncStateManager] Exception getting file sync record:', error);
      return null;
    }
  }

  /**
   * 获取所有文件同步记录
   */
  async getAllFileSyncRecords(): Promise<FileSyncRecord[]> {
    const client = getInvestmentDb();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('file_sync_records')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[SyncStateManager] Error getting all file sync records:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[SyncStateManager] Exception getting all file sync records:', error);
      return [];
    }
  }

  /**
   * 创建文件同步记录
   */
  async createFileSyncRecord(record: CreateFileSyncRecord): Promise<FileSyncRecord | null> {
    const client = getInvestmentDb();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('file_sync_records')
        .insert({
          ...record,
          document_ids: record.document_ids || [],
          sync_status: record.sync_status || 'pending',
        })
        .select()
        .single();

      if (error) {
        console.error('[SyncStateManager] Error creating file sync record:', error);
        return null;
      }

      return data as FileSyncRecord;
    } catch (error) {
      console.error('[SyncStateManager] Exception creating file sync record:', error);
      return null;
    }
  }

  /**
   * 更新文件同步记录
   */
  async updateFileSyncRecord(
    driveFileId: string,
    updates: UpdateFileSyncRecord
  ): Promise<FileSyncRecord | null> {
    const client = getInvestmentDb();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('file_sync_records')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('drive_file_id', driveFileId)
        .select()
        .single();

      if (error) {
        console.error('[SyncStateManager] Error updating file sync record:', error);
        return null;
      }

      return data as FileSyncRecord;
    } catch (error) {
      console.error('[SyncStateManager] Exception updating file sync record:', error);
      return null;
    }
  }

  /**
   * 删除文件同步记录
   */
  async deleteFileSyncRecord(driveFileId: string): Promise<boolean> {
    const client = getInvestmentDb();
    if (!client) return false;

    try {
      const { error } = await client
        .from('file_sync_records')
        .delete()
        .eq('drive_file_id', driveFileId);

      if (error) {
        console.error('[SyncStateManager] Error deleting file sync record:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SyncStateManager] Exception deleting file sync record:', error);
      return false;
    }
  }

  /**
   * 检查文件是否需要更新
   * 比较 MD5 校验和或修改时间
   */
  async needsUpdate(
    driveFileId: string,
    newMd5: string | null,
    newModifiedTime: string
  ): Promise<boolean> {
    const record = await this.getFileSyncRecord(driveFileId);
    
    if (!record) {
      return true; // 新文件，需要同步
    }

    // 优先比较 MD5
    if (newMd5 && record.md5_checksum) {
      return newMd5 !== record.md5_checksum;
    }

    // 比较修改时间
    const recordTime = new Date(record.modified_time).getTime();
    const newTime = new Date(newModifiedTime).getTime();
    return newTime > recordTime;
  }
}

// 导出单例
export const syncStateManager = new SyncStateManager();

export default SyncStateManager;
