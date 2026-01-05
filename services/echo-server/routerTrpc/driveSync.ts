/**
 * Drive Sync Router
 * 
 * Google Drive 同步 API 端点：
 * - 手动触发同步
 * - 查询同步状态
 * - 获取同步文件列表
 * 
 * @module services/echo-server/routerTrpc/driveSync
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod/v3';
import { TRPCError } from '@trpc/server';
import { DriveSyncService, createDriveSyncService } from '../lib/driveSyncService';
import { GoogleDriveClient } from '../lib/googleDriveClient';
import { syncStateManager } from '../lib/syncStateManager';

// ============================================================================
// 服务实例管理
// ============================================================================

let driveSyncServiceInstance: DriveSyncService | null = null;

/**
 * 获取或创建 DriveSyncService 实例
 */
function getDriveSyncService(): DriveSyncService {
  if (!driveSyncServiceInstance) {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!folderId) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'GOOGLE_DRIVE_FOLDER_ID 未配置',
      });
    }

    if (!serviceAccountKey) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'GOOGLE_SERVICE_ACCOUNT_KEY 未配置',
      });
    }

    const driveClient = new GoogleDriveClient({
      folderId,
      serviceAccountKey,
    });

    driveSyncServiceInstance = createDriveSyncService(driveClient, syncStateManager);
  }

  return driveSyncServiceInstance;
}

// ============================================================================
// Router 定义
// ============================================================================

export const driveSyncRouter = router({
  /**
   * 手动触发同步
   * 
   * POST /api/trpc/driveSync.trigger
   */
  trigger: authProcedure
    .input(z.object({
      forceFullSync: z.boolean().default(false),
      dryRun: z.boolean().default(false),
    }).optional())
    .mutation(async ({ input }) => {
      const service = getDriveSyncService();

      // 检查是否正在同步
      if (service.isSyncInProgress()) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '同步正在进行中，请稍后再试',
        });
      }

      // 初始化服务（如果需要）
      const initialized = await service.initialize();
      if (!initialized) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Drive 同步服务初始化失败',
        });
      }

      // 执行同步
      const result = await service.sync({
        forceFullSync: input?.forceFullSync ?? false,
        dryRun: input?.dryRun ?? false,
      });

      return {
        success: result.success,
        filesProcessed: result.filesProcessed,
        filesAdded: result.filesAdded,
        filesUpdated: result.filesUpdated,
        filesDeleted: result.filesDeleted,
        errorCount: result.errors.length,
        errors: result.errors.map(e => ({
          fileName: e.fileName,
          error: e.error,
        })),
        duration: result.duration,
      };
    }),

  /**
   * 获取同步状态
   * 
   * GET /api/trpc/driveSync.status
   */
  status: authProcedure
    .query(async () => {
      try {
        const service = getDriveSyncService();
        const status = await service.getStatus();

        return {
          status: status.status,
          lastSyncAt: status.lastSyncAt,
          errorMessage: status.errorMessage,
          fileCount: status.fileCount,
          isSyncing: service.isSyncInProgress(),
        };
      } catch (error) {
        // 如果服务未配置，返回未配置状态
        if (error instanceof TRPCError && error.code === 'PRECONDITION_FAILED') {
          return {
            status: 'not_configured' as const,
            lastSyncAt: null,
            errorMessage: error.message,
            fileCount: 0,
            isSyncing: false,
          };
        }
        throw error;
      }
    }),

  /**
   * 获取已同步的文件列表
   * 
   * GET /api/trpc/driveSync.files
   */
  files: authProcedure
    .query(async () => {
      const records = await syncStateManager.getAllFileSyncRecords();

      return records.map(record => ({
        id: record.id,
        driveFileId: record.drive_file_id,
        fileName: record.file_name,
        mimeType: record.mime_type,
        sourceType: record.source_type,
        syncStatus: record.sync_status,
        documentCount: record.document_ids.length,
        modifiedTime: record.modified_time,
        updatedAt: record.updated_at,
        errorMessage: record.error_message,
      }));
    }),

  /**
   * 检查配置状态
   * 
   * GET /api/trpc/driveSync.checkConfig
   */
  checkConfig: authProcedure
    .query(async () => {
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      const geminiApiKey = process.env.GEMINI_API_KEY;

      const issues: string[] = [];

      if (!folderId) {
        issues.push('GOOGLE_DRIVE_FOLDER_ID 未配置');
      }

      if (!serviceAccountKey) {
        issues.push('GOOGLE_SERVICE_ACCOUNT_KEY 未配置');
      }

      if (!geminiApiKey) {
        issues.push('GEMINI_API_KEY 未配置（嵌入向量生成需要）');
      }

      // 如果配置完整，尝试验证凭据
      let credentialsValid = false;
      if (folderId && serviceAccountKey) {
        try {
          const driveClient = new GoogleDriveClient({
            folderId,
            serviceAccountKey,
          });
          credentialsValid = await driveClient.validateCredentials();
          if (!credentialsValid) {
            issues.push('Google Drive 凭据验证失败');
          }
        } catch (error) {
          issues.push(`凭据验证错误: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return {
        configured: issues.length === 0,
        credentialsValid,
        issues,
        config: {
          hasFolderId: !!folderId,
          hasServiceAccountKey: !!serviceAccountKey,
          hasGeminiApiKey: !!geminiApiKey,
        },
      };
    }),
});

export default driveSyncRouter;
