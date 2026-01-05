/**
 * Drive Sync Job
 * 
 * 定时同步 Google Drive 文件到知识库
 * 默认每 5 分钟执行一次增量同步
 * 
 * @module services/echo-server/jobs/driveSyncJob
 */

import { BaseScheduleJob } from './baseScheduleJob';
import { DriveSyncService, createDriveSyncService } from '../lib/driveSyncService';
import { GoogleDriveClient } from '../lib/googleDriveClient';
import { syncStateManager } from '../lib/syncStateManager';

export class DriveSyncJob extends BaseScheduleJob {
  protected static taskName = 'drive-sync';
  protected static cronSchedule = '*/5 * * * *'; // 每 5 分钟
  
  private static serviceInstance: DriveSyncService | null = null;

  /**
   * 获取或创建 DriveSyncService 实例
   */
  private static getService(): DriveSyncService | null {
    if (this.serviceInstance) {
      return this.serviceInstance;
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!folderId || !serviceAccountKey) {
      console.log('[DriveSyncJob] Google Drive 配置不完整，跳过同步');
      return null;
    }

    try {
      const driveClient = new GoogleDriveClient({
        folderId,
        serviceAccountKey,
      });

      this.serviceInstance = createDriveSyncService(driveClient, syncStateManager);
      return this.serviceInstance;
    } catch (error) {
      console.error('[DriveSyncJob] 创建服务实例失败:', error);
      return null;
    }
  }

  /**
   * 执行同步任务
   */
  protected static async RunTask(): Promise<{
    success: boolean;
    filesProcessed: number;
    errors: number;
    duration: number;
  }> {
    console.log('[DriveSyncJob] 开始执行同步任务...');

    const service = this.getService();
    if (!service) {
      return {
        success: false,
        filesProcessed: 0,
        errors: 0,
        duration: 0,
      };
    }

    // 检查是否正在同步
    if (service.isSyncInProgress()) {
      console.log('[DriveSyncJob] 同步正在进行中，跳过本次执行');
      return {
        success: true,
        filesProcessed: 0,
        errors: 0,
        duration: 0,
      };
    }

    try {
      // 初始化服务
      const initialized = await service.initialize();
      if (!initialized) {
        console.error('[DriveSyncJob] 服务初始化失败');
        return {
          success: false,
          filesProcessed: 0,
          errors: 1,
          duration: 0,
        };
      }

      // 执行增量同步
      const result = await service.sync();

      console.log(`[DriveSyncJob] 同步完成: ${result.filesProcessed} 文件处理, ` +
        `${result.filesAdded} 新增, ${result.filesUpdated} 更新, ` +
        `${result.filesDeleted} 删除, ${result.errors.length} 错误, ` +
        `耗时 ${result.duration}ms`);

      return {
        success: result.success,
        filesProcessed: result.filesProcessed,
        errors: result.errors.length,
        duration: result.duration,
      };
    } catch (error) {
      console.error('[DriveSyncJob] 同步任务执行失败:', error);
      return {
        success: false,
        filesProcessed: 0,
        errors: 1,
        duration: 0,
      };
    }
  }

  /**
   * 启动定时同步
   * 
   * @param cronTime 自定义 cron 表达式，默认每 5 分钟
   * @param immediate 是否立即执行一次，默认 true
   */
  static async Start(cronTime?: string, immediate: boolean = true): Promise<void> {
    // 检查配置
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!folderId || !serviceAccountKey) {
      console.log('[DriveSyncJob] Google Drive 配置不完整，不启动定时同步');
      return;
    }

    await super.Start(cronTime, immediate);
  }

  /**
   * 重置服务实例（用于配置变更后）
   */
  static resetService(): void {
    this.serviceInstance = null;
    console.log('[DriveSyncJob] 服务实例已重置');
  }
}

export default DriveSyncJob;
