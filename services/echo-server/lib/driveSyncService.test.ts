/**
 * DriveSyncService 属性测试
 * 
 * 使用 fast-check 进行属性测试，验证：
 * - Property 1: Source Type Assignment
 * - Property 5: Concurrent Sync Prevention
 * - Property 6: Graceful Error Handling
 * 
 * **Validates: Requirements 3.5, 4.3, 5.3, 6.4, 7.2**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { DriveSyncService, type SyncResult } from './driveSyncService';
import type { GoogleDriveClient, DriveFile } from './googleDriveClient';
import type { SyncStateManager } from './syncStateManager';

// Mock fetch for embedding API
global.fetch = vi.fn();

describe('DriveSyncService Property Tests', () => {
  let service: DriveSyncService;
  let mockDriveClient: Partial<GoogleDriveClient>;
  let mockStateManager: Partial<SyncStateManager>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Drive Client
    mockDriveClient = {
      validateCredentials: vi.fn().mockResolvedValue(true),
      getStartPageToken: vi.fn().mockResolvedValue('initial-token'),
      listFiles: vi.fn().mockResolvedValue([]),
      getChanges: vi.fn().mockResolvedValue({ changes: [], newPageToken: 'new-token' }),
      getFileContent: vi.fn().mockResolvedValue(Buffer.from('test content')),
      exportSheet: vi.fn().mockResolvedValue('sheet content'),
    };

    // Mock State Manager
    mockStateManager = {
      getSyncState: vi.fn().mockResolvedValue({
        id: 1,
        sync_type: 'google_drive',
        change_token: 'test-token',
        status: 'idle',
        last_sync_at: null,
        error_message: null,
      }),
      getChangeToken: vi.fn().mockResolvedValue('test-token'),
      saveChangeToken: vi.fn().mockResolvedValue(true),
      updateStatus: vi.fn().mockResolvedValue(true),
      getFileSyncRecord: vi.fn().mockResolvedValue(null),
      createFileSyncRecord: vi.fn().mockResolvedValue({ id: 1 }),
      updateFileSyncRecord: vi.fn().mockResolvedValue({ id: 1 }),
      deleteFileSyncRecord: vi.fn().mockResolvedValue(true),
      getAllFileSyncRecords: vi.fn().mockResolvedValue([]),
      needsUpdate: vi.fn().mockResolvedValue(true),
    };

    // Mock fetch for embedding
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ embedding: { values: [0.1, 0.2, 0.3] } }),
    });

    // Mock environment
    process.env.GOOGLE_DRIVE_FOLDER_ID = 'test-folder-id';
    process.env.GEMINI_API_KEY = 'test-api-key';

    service = new DriveSyncService(
      mockDriveClient as GoogleDriveClient,
      mockStateManager as SyncStateManager
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * **Feature: google-drive-sync, Property 1: Source Type Assignment**
   * 
   * *For any* file with a given MIME type, the assigned source_type SHALL match 
   * the expected mapping (Google Sheets → strategy_sheet, Excel → financial_model, 
   * others → uploaded_file).
   * 
   * **Validates: Requirements 3.5, 4.3, 5.3**
   */
  describe('Property 1: Source Type Assignment', () => {
    it('MIME 类型应该正确映射到 source_type', () => {
      // 这个测试验证 getSourceType 函数的映射逻辑
      const { getSourceType } = require('./fileParser.ts');

      fc.assert(
        fc.property(
          fc.constantFrom(
            'application/vnd.google-apps.spreadsheet',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/plain',
            'application/pdf',
            'text/markdown',
          ),
          (mimeType) => {
            const sourceType = getSourceType(mimeType);

            switch (mimeType) {
              case 'application/vnd.google-apps.spreadsheet':
                expect(sourceType).toBe('strategy_sheet');
                break;
              case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
              case 'application/vnd.ms-excel':
                expect(sourceType).toBe('financial_model');
                break;
              default:
                expect(sourceType).toBe('uploaded_file');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: google-drive-sync, Property 5: Concurrent Sync Prevention**
   * 
   * *For any* number of concurrent sync requests, only one sync operation 
   * SHALL execute at a time.
   * 
   * **Validates: Requirements 6.4**
   */
  describe('Property 5: Concurrent Sync Prevention', () => {
    it('并发同步请求应该只执行一个', async () => {
      let syncCount = 0;

      // 模拟慢速同步 - 使用 forceFullSync 来触发 listFiles
      mockDriveClient.listFiles = vi.fn().mockImplementation(async () => {
        syncCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return [];
      });

      // 同时发起多个同步请求
      const promises = [
        service.sync({ forceFullSync: true }),
        service.sync({ forceFullSync: true }),
        service.sync({ forceFullSync: true }),
      ];

      const results = await Promise.all(promises);

      // 只有一个应该成功执行 listFiles
      expect(syncCount).toBe(1);
      
      // 其他两个应该报告 "Sync already in progress"
      const blockedSyncs = results.filter(r => 
        r.errors.some(e => e.error === 'Sync already in progress')
      );
      expect(blockedSyncs.length).toBe(2);
    });

    it('同步完成后应该允许新的同步', async () => {
      mockDriveClient.listFiles = vi.fn().mockResolvedValue([]);

      // 第一次同步
      const result1 = await service.sync();
      expect(result1.errors.filter(e => e.error === 'Sync already in progress')).toHaveLength(0);

      // 第二次同步
      const result2 = await service.sync();
      expect(result2.errors.filter(e => e.error === 'Sync already in progress')).toHaveLength(0);
    });
  });

  /**
   * **Feature: google-drive-sync, Property 6: Graceful Error Handling**
   * 
   * *For any* file processing error, the sync SHALL continue processing 
   * remaining files and report errors without crashing.
   * 
   * **Validates: Requirements 7.2**
   */
  describe('Property 6: Graceful Error Handling', () => {
    it('单个文件错误不应该中断整体同步', async () => {
      const files: DriveFile[] = [
        { id: 'file1', name: 'good1.txt', mimeType: 'text/plain', modifiedTime: '2024-01-01T00:00:00Z' },
        { id: 'file2', name: 'bad.txt', mimeType: 'text/plain', modifiedTime: '2024-01-01T00:00:00Z' },
        { id: 'file3', name: 'good2.txt', mimeType: 'text/plain', modifiedTime: '2024-01-01T00:00:00Z' },
      ];

      mockDriveClient.listFiles = vi.fn().mockResolvedValue(files);
      
      // 第二个文件抛出错误
      let callCount = 0;
      mockDriveClient.getFileContent = vi.fn().mockImplementation(async (fileId: string) => {
        callCount++;
        if (fileId === 'file2') {
          throw new Error('File read error');
        }
        return Buffer.from('test content');
      });

      const result = await service.sync({ forceFullSync: true });

      // 应该处理了所有文件
      expect(result.filesProcessed).toBe(3);
      
      // 应该有一个错误
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].fileId).toBe('file2');
      
      // 其他文件应该成功
      expect(callCount).toBe(3);
    });

    it('API 错误应该被捕获并记录', async () => {
      mockDriveClient.listFiles = vi.fn().mockRejectedValue(new Error('API Error'));

      const result = await service.sync({ forceFullSync: true });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('API Error');
    });

    it('embedding 失败不应该阻止文档保存', async () => {
      const files: DriveFile[] = [
        { id: 'file1', name: 'test.txt', mimeType: 'text/plain', modifiedTime: '2024-01-01T00:00:00Z' },
      ];

      mockDriveClient.listFiles = vi.fn().mockResolvedValue(files);
      mockDriveClient.getFileContent = vi.fn().mockResolvedValue(Buffer.from('test content'));

      // Embedding API 失败
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.sync({ forceFullSync: true });

      // 同步应该继续（embedding 失败是优雅降级）
      expect(result.filesProcessed).toBe(1);
      expect(mockStateManager.createFileSyncRecord).toHaveBeenCalled();
    });
  });
});

describe('DriveSyncService Unit Tests', () => {
  let service: DriveSyncService;
  let mockDriveClient: Partial<GoogleDriveClient>;
  let mockStateManager: Partial<SyncStateManager>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDriveClient = {
      validateCredentials: vi.fn().mockResolvedValue(true),
      getStartPageToken: vi.fn().mockResolvedValue('initial-token'),
      listFiles: vi.fn().mockResolvedValue([]),
      getChanges: vi.fn().mockResolvedValue({ changes: [], newPageToken: 'new-token' }),
      getFileContent: vi.fn().mockResolvedValue(Buffer.from('test content')),
      exportSheet: vi.fn().mockResolvedValue('sheet content'),
    };

    mockStateManager = {
      getSyncState: vi.fn().mockResolvedValue({ status: 'idle' }),
      getChangeToken: vi.fn().mockResolvedValue('test-token'),
      saveChangeToken: vi.fn().mockResolvedValue(true),
      updateStatus: vi.fn().mockResolvedValue(true),
      getFileSyncRecord: vi.fn().mockResolvedValue(null),
      createFileSyncRecord: vi.fn().mockResolvedValue({ id: 1 }),
      updateFileSyncRecord: vi.fn().mockResolvedValue({ id: 1 }),
      deleteFileSyncRecord: vi.fn().mockResolvedValue(true),
      getAllFileSyncRecords: vi.fn().mockResolvedValue([]),
      needsUpdate: vi.fn().mockResolvedValue(true),
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ embedding: { values: [0.1, 0.2, 0.3] } }),
    });

    process.env.GOOGLE_DRIVE_FOLDER_ID = 'test-folder-id';
    process.env.GEMINI_API_KEY = 'test-api-key';

    service = new DriveSyncService(
      mockDriveClient as GoogleDriveClient,
      mockStateManager as SyncStateManager
    );
  });

  describe('initialize', () => {
    it('应该验证凭据并获取初始 token', async () => {
      mockStateManager.getChangeToken = vi.fn().mockResolvedValue(null);

      const result = await service.initialize();

      expect(result).toBe(true);
      expect(mockDriveClient.validateCredentials).toHaveBeenCalled();
      expect(mockDriveClient.getStartPageToken).toHaveBeenCalled();
      expect(mockStateManager.saveChangeToken).toHaveBeenCalledWith('initial-token');
    });

    it('凭据无效应该返回 false', async () => {
      mockDriveClient.validateCredentials = vi.fn().mockResolvedValue(false);

      const result = await service.initialize();

      expect(result).toBe(false);
    });

    it('已有 token 时不应该重新获取', async () => {
      mockStateManager.getChangeToken = vi.fn().mockResolvedValue('existing-token');

      await service.initialize();

      expect(mockDriveClient.getStartPageToken).not.toHaveBeenCalled();
    });
  });

  describe('sync', () => {
    it('dry run 不应该实际处理文件', async () => {
      const files: DriveFile[] = [
        { id: 'file1', name: 'test.txt', mimeType: 'text/plain', modifiedTime: '2024-01-01T00:00:00Z' },
      ];

      mockDriveClient.listFiles = vi.fn().mockResolvedValue(files);

      const result = await service.sync({ forceFullSync: true, dryRun: true });

      expect(result.filesProcessed).toBe(1);
      expect(result.filesAdded).toBe(1);
      expect(mockDriveClient.getFileContent).not.toHaveBeenCalled();
      expect(mockStateManager.createFileSyncRecord).not.toHaveBeenCalled();
    });

    it('无 change token 时应该回退到全量同步', async () => {
      mockStateManager.getChangeToken = vi.fn().mockResolvedValue(null);
      mockDriveClient.listFiles = vi.fn().mockResolvedValue([]);

      await service.sync();

      expect(mockDriveClient.listFiles).toHaveBeenCalled();
    });

    it('文件未变更时不应该重新处理', async () => {
      const files: DriveFile[] = [
        { id: 'file1', name: 'test.txt', mimeType: 'text/plain', modifiedTime: '2024-01-01T00:00:00Z' },
      ];

      mockDriveClient.listFiles = vi.fn().mockResolvedValue(files);
      mockStateManager.needsUpdate = vi.fn().mockResolvedValue(false);

      const result = await service.sync({ forceFullSync: true });

      expect(result.filesProcessed).toBe(1);
      expect(result.filesAdded).toBe(0);
      expect(result.filesUpdated).toBe(0);
      expect(mockDriveClient.getFileContent).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('应该返回当前状态', async () => {
      mockStateManager.getSyncState = vi.fn().mockResolvedValue({
        status: 'idle',
        last_sync_at: '2024-01-01T00:00:00Z',
        error_message: null,
      });
      mockStateManager.getAllFileSyncRecords = vi.fn().mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);

      const status = await service.getStatus();

      expect(status.status).toBe('idle');
      expect(status.lastSyncAt).toBe('2024-01-01T00:00:00Z');
      expect(status.errorMessage).toBeNull();
      expect(status.fileCount).toBe(2);
    });
  });

  describe('isSyncInProgress', () => {
    it('同步时应该返回 true', async () => {
      mockDriveClient.listFiles = vi.fn().mockImplementation(async () => {
        // 在同步过程中检查状态
        expect(service.isSyncInProgress()).toBe(true);
        return [];
      });

      expect(service.isSyncInProgress()).toBe(false);
      await service.sync({ forceFullSync: true });
      expect(service.isSyncInProgress()).toBe(false);
    });
  });
});
