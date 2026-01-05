/**
 * Google Drive Client
 * 
 * 封装 Google Drive API 调用，支持：
 * - Service Account 认证
 * - 文件变更检测（Change Token）
 * - 文件内容下载
 * - Google Sheets 导出
 * 
 * @module services/echo-server/lib/googleDriveClient
 */

import { google, drive_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';

// ============================================================================
// 类型定义
// ============================================================================

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  parents?: string[];
  md5Checksum?: string;
  trashed?: boolean;
}

export interface DriveChange {
  type: 'file';
  fileId: string;
  removed: boolean;
  file?: DriveFile;
}

export interface DriveChanges {
  changes: DriveChange[];
  newStartPageToken: string;
}

export interface GoogleDriveClientConfig {
  serviceAccountKey?: string;        // Base64 编码的 JSON
  serviceAccountKeyFile?: string;    // JSON 文件路径
  folderId: string;                  // 要监控的文件夹 ID
}

// 支持的 MIME 类型
export const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'text/plain': 'txt',
  'text/markdown': 'markdown',
  'text/x-markdown': 'markdown',
  'application/pdf': 'pdf',
  'application/vnd.google-apps.spreadsheet': 'google_sheets',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
};

// ============================================================================
// GoogleDriveClient 类
// ============================================================================

export class GoogleDriveClient {
  private drive: drive_v3.Drive | null = null;
  private auth: JWT | null = null;
  private folderId: string;
  private initialized = false;

  constructor(private config: GoogleDriveClientConfig) {
    this.folderId = config.folderId;
  }

  /**
   * 初始化并认证
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const credentials = await this.loadCredentials();
      
      this.auth = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/spreadsheets.readonly',
        ],
      });

      await this.auth.authorize();
      
      this.drive = google.drive({ version: 'v3', auth: this.auth });
      this.initialized = true;
      
      console.log('[GoogleDriveClient] 认证成功');
    } catch (error) {
      console.error('[GoogleDriveClient] 认证失败:', error);
      throw new Error(`Google Drive 认证失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 加载 Service Account 凭证
   */
  private async loadCredentials(): Promise<ServiceAccountCredentials> {
    // 优先使用 Base64 编码的 JSON
    if (this.config.serviceAccountKey) {
      try {
        const decoded = Buffer.from(this.config.serviceAccountKey, 'base64').toString('utf-8');
        return JSON.parse(decoded);
      } catch (error) {
        throw new Error('无法解析 GOOGLE_SERVICE_ACCOUNT_KEY，请确保是有效的 Base64 编码 JSON');
      }
    }

    // 其次使用文件路径
    if (this.config.serviceAccountKeyFile) {
      try {
        const fs = await import('fs/promises');
        const content = await fs.readFile(this.config.serviceAccountKeyFile, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        throw new Error(`无法读取 Service Account 文件: ${this.config.serviceAccountKeyFile}`);
      }
    }

    throw new Error('缺少 Google Service Account 凭证配置');
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.drive) {
      throw new Error('GoogleDriveClient 未初始化，请先调用 initialize()');
    }
  }

  /**
   * 验证凭证是否有效
   * 初始化客户端并返回是否成功
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.initialize();
      return this.initialized;
    } catch (error) {
      console.error('[GoogleDriveClient] 凭证验证失败:', error);
      return false;
    }
  }

  /**
   * 获取初始 Change Token
   */
  async getStartPageToken(): Promise<string> {
    this.ensureInitialized();

    const response = await this.drive!.changes.getStartPageToken();
    return response.data.startPageToken || '';
  }

  /**
   * 获取文件变更列表
   */
  async getChanges(pageToken?: string): Promise<DriveChanges> {
    this.ensureInitialized();

    // 如果没有 token，获取初始 token
    if (!pageToken) {
      const startToken = await this.getStartPageToken();
      return {
        changes: [],
        newStartPageToken: startToken,
      };
    }

    const changes: DriveChange[] = [];
    let nextPageToken = pageToken;
    let newStartPageToken = pageToken;

    try {
      // 分页获取所有变更
      do {
        const response = await this.drive!.changes.list({
          pageToken: nextPageToken,
          spaces: 'drive',
          fields: 'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, modifiedTime, size, parents))',
          includeRemoved: true,
          pageSize: 100,
        });

        const data = response.data;
        
        // 处理变更
        for (const change of data.changes || []) {
          // 只处理目标文件夹中的文件
          if (change.file?.parents?.includes(this.folderId) || change.removed) {
            changes.push({
              type: 'file',
              fileId: change.fileId || '',
              removed: change.removed || false,
              file: change.file ? {
                id: change.file.id || '',
                name: change.file.name || '',
                mimeType: change.file.mimeType || '',
                modifiedTime: change.file.modifiedTime || '',
                size: change.file.size || undefined,
                parents: change.file.parents || undefined,
              } : undefined,
            });
          }
        }

        nextPageToken = data.nextPageToken || '';
        if (data.newStartPageToken) {
          newStartPageToken = data.newStartPageToken;
        }
      } while (nextPageToken);

      return {
        changes,
        newStartPageToken,
      };
    } catch (error: unknown) {
      // 处理 API 错误
      if (this.isGoogleApiError(error) && error.code === 429) {
        throw new RateLimitError('Google Drive API 速率限制');
      }
      throw error;
    }
  }

  /**
   * 列出文件夹中的所有文件
   * @param folderId 可选，覆盖默认文件夹 ID
   */
  async listFiles(folderId?: string): Promise<DriveFile[]> {
    this.ensureInitialized();

    const targetFolderId = folderId || this.folderId;
    const files: DriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.drive!.files.list({
        q: `'${targetFolderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, parents, md5Checksum, trashed)',
        pageSize: 100,
        pageToken,
      });

      for (const file of response.data.files || []) {
        // 只包含支持的文件类型
        if (file.mimeType && SUPPORTED_MIME_TYPES[file.mimeType]) {
          files.push({
            id: file.id || '',
            name: file.name || '',
            mimeType: file.mimeType,
            modifiedTime: file.modifiedTime || '',
            size: file.size || undefined,
            parents: file.parents || undefined,
            md5Checksum: file.md5Checksum || undefined,
            trashed: file.trashed || undefined,
          });
        }
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return files;
  }

  /**
   * 获取文件内容
   */
  async getFileContent(fileId: string): Promise<Buffer> {
    this.ensureInitialized();

    const response = await this.drive!.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    return Buffer.from(response.data as ArrayBuffer);
  }

  /**
   * 导出 Google Sheets 为 CSV
   */
  async exportSheet(fileId: string): Promise<string> {
    this.ensureInitialized();

    // 获取所有 sheet 名称
    const sheets = google.sheets({ version: 'v4', auth: this.auth! });
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: fileId });
    
    const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title || '') || [];
    const allContent: string[] = [];

    for (const sheetName of sheetNames) {
      // 获取每个 sheet 的数据
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: fileId,
        range: sheetName,
      });

      const rows = response.data.values || [];
      if (rows.length === 0) continue;

      // 转换为表格格式
      allContent.push(`## Sheet: ${sheetName}\n`);
      
      // 表头
      const headers = rows[0] as string[];
      allContent.push('| ' + headers.join(' | ') + ' |');
      allContent.push('| ' + headers.map(() => '---').join(' | ') + ' |');
      
      // 数据行
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as string[];
        // 确保每行有足够的列
        while (row.length < headers.length) {
          row.push('');
        }
        allContent.push('| ' + row.join(' | ') + ' |');
      }
      
      allContent.push('');
    }

    return allContent.join('\n');
  }

  /**
   * 获取文件元数据
   */
  async getFileMetadata(fileId: string): Promise<DriveFile> {
    this.ensureInitialized();

    const response = await this.drive!.files.get({
      fileId,
      fields: 'id, name, mimeType, modifiedTime, size, parents',
    });

    const file = response.data;
    return {
      id: file.id || '',
      name: file.name || '',
      mimeType: file.mimeType || '',
      modifiedTime: file.modifiedTime || '',
      size: file.size || undefined,
      parents: file.parents || undefined,
    };
  }

  /**
   * 检查是否是 Google API 错误
   */
  private isGoogleApiError(error: unknown): error is { code: number; message: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code: unknown }).code === 'number'
    );
  }

  /**
   * 检查文件是否在目标文件夹中
   */
  async isFileInFolder(fileId: string): Promise<boolean> {
    try {
      const metadata = await this.getFileMetadata(fileId);
      return metadata.parents?.includes(this.folderId) || false;
    } catch {
      return false;
    }
  }

  /**
   * 获取是否已初始化
   */
  get isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// 错误类型
// ============================================================================

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// ============================================================================
// 辅助类型
// ============================================================================

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// ============================================================================
// 工厂函数
// ============================================================================

let clientInstance: GoogleDriveClient | null = null;

/**
 * 获取 GoogleDriveClient 单例
 */
export function getGoogleDriveClient(): GoogleDriveClient | null {
  if (clientInstance) {
    return clientInstance;
  }

  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const serviceAccountKeyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
    console.warn('[GoogleDriveClient] 缺少 GOOGLE_DRIVE_FOLDER_ID 环境变量');
    return null;
  }

  if (!serviceAccountKey && !serviceAccountKeyFile) {
    console.warn('[GoogleDriveClient] 缺少 Google Service Account 凭证配置');
    return null;
  }

  clientInstance = new GoogleDriveClient({
    serviceAccountKey,
    serviceAccountKeyFile,
    folderId,
  });

  return clientInstance;
}

/**
 * 重置客户端（用于测试）
 */
export function resetGoogleDriveClient(): void {
  clientInstance = null;
}

export default GoogleDriveClient;
