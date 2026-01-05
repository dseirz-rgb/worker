/**
 * GoogleDriveClient 单元测试
 * 
 * 测试 Google Drive API 封装的核心功能
 * 使用 mock 避免实际 API 调用
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  GoogleDriveClient, 
  RateLimitError,
  SUPPORTED_MIME_TYPES,
  getGoogleDriveClient,
  resetGoogleDriveClient,
} from './googleDriveClient';

// Mock googleapis
vi.mock('googleapis', () => ({
  google: {
    drive: vi.fn(() => ({
      changes: {
        getStartPageToken: vi.fn(),
        list: vi.fn(),
      },
      files: {
        list: vi.fn(),
        get: vi.fn(),
      },
    })),
    sheets: vi.fn(() => ({
      spreadsheets: {
        get: vi.fn(),
        values: {
          get: vi.fn(),
        },
      },
    })),
  },
}));

// Mock google-auth-library
vi.mock('google-auth-library', () => ({
  JWT: vi.fn().mockImplementation(() => ({
    authorize: vi.fn().mockResolvedValue({}),
  })),
}));

describe('GoogleDriveClient', () => {
  const mockConfig = {
    serviceAccountKey: Buffer.from(JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key_id: 'key-id',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n',
      client_email: 'test@test-project.iam.gserviceaccount.com',
      client_id: '123456789',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/test',
    })).toString('base64'),
    folderId: 'test-folder-id',
  };

  let client: GoogleDriveClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient(mockConfig);
  });

  afterEach(() => {
    resetGoogleDriveClient();
  });

  describe('initialize', () => {
    it('应该成功初始化并认证', async () => {
      await client.initialize();
      expect(client.isInitialized).toBe(true);
    });

    it('重复初始化应该跳过', async () => {
      await client.initialize();
      await client.initialize(); // 第二次调用
      expect(client.isInitialized).toBe(true);
    });

    it('缺少凭证应该抛出错误', async () => {
      const invalidClient = new GoogleDriveClient({
        folderId: 'test-folder',
      });
      
      await expect(invalidClient.initialize()).rejects.toThrow('缺少 Google Service Account 凭证配置');
    });

    it('无效的 Base64 凭证应该抛出错误', async () => {
      const invalidClient = new GoogleDriveClient({
        serviceAccountKey: 'invalid-base64!!!',
        folderId: 'test-folder',
      });
      
      await expect(invalidClient.initialize()).rejects.toThrow('无法解析 GOOGLE_SERVICE_ACCOUNT_KEY');
    });
  });

  describe('SUPPORTED_MIME_TYPES', () => {
    it('应该包含所有支持的文件类型', () => {
      expect(SUPPORTED_MIME_TYPES['text/plain']).toBe('txt');
      expect(SUPPORTED_MIME_TYPES['text/markdown']).toBe('markdown');
      expect(SUPPORTED_MIME_TYPES['application/pdf']).toBe('pdf');
      expect(SUPPORTED_MIME_TYPES['application/vnd.google-apps.spreadsheet']).toBe('google_sheets');
      expect(SUPPORTED_MIME_TYPES['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']).toBe('xlsx');
      expect(SUPPORTED_MIME_TYPES['application/vnd.ms-excel']).toBe('xls');
    });
  });

  describe('getStartPageToken', () => {
    it('未初始化时应该抛出错误', async () => {
      await expect(client.getStartPageToken()).rejects.toThrow('GoogleDriveClient 未初始化');
    });
  });

  describe('getChanges', () => {
    it('未初始化时应该抛出错误', async () => {
      await expect(client.getChanges('token')).rejects.toThrow('GoogleDriveClient 未初始化');
    });
  });

  describe('listFiles', () => {
    it('未初始化时应该抛出错误', async () => {
      await expect(client.listFiles()).rejects.toThrow('GoogleDriveClient 未初始化');
    });
  });

  describe('getFileContent', () => {
    it('未初始化时应该抛出错误', async () => {
      await expect(client.getFileContent('file-id')).rejects.toThrow('GoogleDriveClient 未初始化');
    });
  });

  describe('exportSheet', () => {
    it('未初始化时应该抛出错误', async () => {
      await expect(client.exportSheet('sheet-id')).rejects.toThrow('GoogleDriveClient 未初始化');
    });
  });

  describe('getFileMetadata', () => {
    it('未初始化时应该抛出错误', async () => {
      await expect(client.getFileMetadata('file-id')).rejects.toThrow('GoogleDriveClient 未初始化');
    });
  });
});

describe('RateLimitError', () => {
  it('应该是 Error 的实例', () => {
    const error = new RateLimitError('Rate limit exceeded');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RateLimitError');
    expect(error.message).toBe('Rate limit exceeded');
  });
});

describe('getGoogleDriveClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    resetGoogleDriveClient();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetGoogleDriveClient();
  });

  it('缺少 GOOGLE_DRIVE_FOLDER_ID 应该返回 null', () => {
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    const client = getGoogleDriveClient();
    expect(client).toBeNull();
  });

  it('缺少凭证配置应该返回 null', () => {
    process.env.GOOGLE_DRIVE_FOLDER_ID = 'test-folder';
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
    
    const client = getGoogleDriveClient();
    expect(client).toBeNull();
  });

  it('配置完整时应该返回客户端实例', () => {
    process.env.GOOGLE_DRIVE_FOLDER_ID = 'test-folder';
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(JSON.stringify({
      type: 'service_account',
      project_id: 'test',
      private_key: 'key',
      client_email: 'test@test.iam.gserviceaccount.com',
    })).toString('base64');
    
    const client = getGoogleDriveClient();
    expect(client).not.toBeNull();
    expect(client).toBeInstanceOf(GoogleDriveClient);
  });

  it('应该返回单例', () => {
    process.env.GOOGLE_DRIVE_FOLDER_ID = 'test-folder';
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(JSON.stringify({
      type: 'service_account',
      project_id: 'test',
      private_key: 'key',
      client_email: 'test@test.iam.gserviceaccount.com',
    })).toString('base64');
    
    const client1 = getGoogleDriveClient();
    const client2 = getGoogleDriveClient();
    expect(client1).toBe(client2);
  });
});
