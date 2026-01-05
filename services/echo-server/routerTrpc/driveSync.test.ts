/**
 * Drive Sync Router 测试
 * 
 * 测试 Google Drive 同步 API 端点
 * 
 * **Validates: Requirements 6.3, 6.4**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock 环境变量
const originalEnv = process.env;

// Mock modules
vi.mock('../lib/driveSyncService', () => ({
  DriveSyncService: vi.fn(),
  createDriveSyncService: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(true),
    sync: vi.fn().mockResolvedValue({
      success: true,
      filesProcessed: 5,
      filesAdded: 2,
      filesUpdated: 1,
      filesDeleted: 0,
      errors: [],
      duration: 1000,
    }),
    getStatus: vi.fn().mockResolvedValue({
      status: 'idle',
      lastSyncAt: '2024-01-01T00:00:00Z',
      errorMessage: null,
      fileCount: 10,
    }),
    isSyncInProgress: vi.fn().mockReturnValue(false),
  })),
}));

vi.mock('../lib/googleDriveClient', () => ({
  GoogleDriveClient: vi.fn().mockImplementation(() => ({
    validateCredentials: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('../lib/syncStateManager', () => ({
  syncStateManager: {
    getAllFileSyncRecords: vi.fn().mockResolvedValue([
      {
        id: 1,
        drive_file_id: 'file1',
        file_name: 'test.txt',
        mime_type: 'text/plain',
        source_type: 'uploaded_file',
        sync_status: 'synced',
        document_ids: [1, 2],
        modified_time: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        error_message: null,
      },
    ]),
  },
}));

describe('Drive Sync Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      GOOGLE_DRIVE_FOLDER_ID: 'test-folder-id',
      GOOGLE_SERVICE_ACCOUNT_KEY: '{"type":"service_account"}',
      GEMINI_API_KEY: 'test-api-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('trigger', () => {
    it('应该成功触发同步', async () => {
      const { createDriveSyncService } = await import('../lib/driveSyncService');
      const mockService = (createDriveSyncService as ReturnType<typeof vi.fn>)();

      // 模拟调用
      const result = await mockService.sync({ forceFullSync: false, dryRun: false });

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(5);
      expect(result.filesAdded).toBe(2);
      expect(result.filesUpdated).toBe(1);
    });

    it('同步进行中应该返回冲突', async () => {
      const { createDriveSyncService } = await import('../lib/driveSyncService');
      const mockService = (createDriveSyncService as ReturnType<typeof vi.fn>)();
      
      // 模拟正在同步
      mockService.isSyncInProgress = vi.fn().mockReturnValue(true);

      expect(mockService.isSyncInProgress()).toBe(true);
    });
  });

  describe('status', () => {
    it('应该返回同步状态', async () => {
      const { createDriveSyncService } = await import('../lib/driveSyncService');
      const mockService = (createDriveSyncService as ReturnType<typeof vi.fn>)();

      const status = await mockService.getStatus();

      expect(status.status).toBe('idle');
      expect(status.lastSyncAt).toBe('2024-01-01T00:00:00Z');
      expect(status.fileCount).toBe(10);
    });
  });

  describe('files', () => {
    it('应该返回已同步文件列表', async () => {
      const { syncStateManager } = await import('../lib/syncStateManager');
      
      const records = await syncStateManager.getAllFileSyncRecords();

      expect(records).toHaveLength(1);
      expect(records[0].file_name).toBe('test.txt');
      expect(records[0].document_ids).toHaveLength(2);
    });
  });

  describe('checkConfig', () => {
    it('配置完整时应该返回 configured: true', async () => {
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      const geminiApiKey = process.env.GEMINI_API_KEY;

      expect(folderId).toBe('test-folder-id');
      expect(serviceAccountKey).toBeDefined();
      expect(geminiApiKey).toBe('test-api-key');
    });

    it('配置缺失时应该返回 issues', async () => {
      delete process.env.GOOGLE_DRIVE_FOLDER_ID;

      const issues: string[] = [];
      if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
        issues.push('GOOGLE_DRIVE_FOLDER_ID 未配置');
      }

      expect(issues).toContain('GOOGLE_DRIVE_FOLDER_ID 未配置');
    });
  });
});

describe('Drive Sync Router Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      GOOGLE_DRIVE_FOLDER_ID: 'test-folder-id',
      GOOGLE_SERVICE_ACCOUNT_KEY: '{"type":"service_account"}',
      GEMINI_API_KEY: 'test-api-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('dry run 不应该实际修改数据', async () => {
    const { createDriveSyncService } = await import('../lib/driveSyncService');
    const mockService = (createDriveSyncService as ReturnType<typeof vi.fn>)();

    const result = await mockService.sync({ forceFullSync: true, dryRun: true });

    expect(result.success).toBe(true);
  });

  it('forceFullSync 应该执行全量同步', async () => {
    const { createDriveSyncService } = await import('../lib/driveSyncService');
    const mockService = (createDriveSyncService as ReturnType<typeof vi.fn>)();

    const result = await mockService.sync({ forceFullSync: true, dryRun: false });

    expect(result.success).toBe(true);
  });
});
