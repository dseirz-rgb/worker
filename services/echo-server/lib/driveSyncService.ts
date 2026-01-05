/**
 * Drive Sync Service
 * 
 * 核心同步服务，负责：
 * - 检测 Google Drive 文件变更
 * - 解析文件内容
 * - 生成嵌入向量
 * - 写入数据库
 * 
 * @module services/echo-server/lib/driveSyncService
 */

import { GoogleDriveClient, DriveFile } from './googleDriveClient';
import { SyncStateManager, syncStateManager } from './syncStateManager';
import { parseFile, chunkText, generateTitle, getSourceType, type SourceType } from './fileParser';
import { getInvestmentDb } from './investmentDb';

// ============================================================================
// 类型定义
// ============================================================================

export interface SyncResult {
  success: boolean;
  filesProcessed: number;
  filesAdded: number;
  filesUpdated: number;
  filesDeleted: number;
  errors: SyncError[];
  duration: number;
}

export interface SyncError {
  fileId: string;
  fileName: string;
  error: string;
}

export interface SyncOptions {
  forceFullSync?: boolean;  // 强制全量同步
  dryRun?: boolean;         // 只检测变更，不实际同步
}

interface DocumentRecord {
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  source_type: SourceType;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 指数退避重试
 * 
 * @param fn 要执行的异步函数
 * @param maxRetries 最大重试次数
 * @param baseDelay 基础延迟（毫秒）
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // 检查是否是可重试的错误（429 或 5xx）
      const isRetryable = 
        lastError.message.includes('429') ||
        lastError.message.includes('500') ||
        lastError.message.includes('502') ||
        lastError.message.includes('503') ||
        lastError.message.includes('504') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('ETIMEDOUT');
      
      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }
      
      // 指数退避：1s, 2s, 4s, 8s
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[DriveSyncService] Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// ============================================================================
// DriveSyncService 类
// ============================================================================

export class DriveSyncService {
  private driveClient: GoogleDriveClient | null;
  private stateManager: SyncStateManager;
  private isSyncing: boolean = false;

  constructor(
    driveClient?: GoogleDriveClient,
    stateManager?: SyncStateManager
  ) {
    this.driveClient = driveClient || null;
    this.stateManager = stateManager || syncStateManager;
  }

  /**
   * 获取或创建 Drive 客户端
   */
  private getDriveClient(): GoogleDriveClient {
    if (this.driveClient) {
      return this.driveClient;
    }

    // 从环境变量创建客户端
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID not configured');
    }

    this.driveClient = new GoogleDriveClient({
      serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      serviceAccountKeyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
      folderId,
    });

    return this.driveClient;
  }

  /**
   * 初始化服务
   * 验证配置并获取初始 change token
   */
  async initialize(): Promise<boolean> {
    try {
      // 获取 Drive 客户端
      const client = this.getDriveClient();
      
      // 验证 Drive 客户端
      const isValid = await client.validateCredentials();
      if (!isValid) {
        console.error('[DriveSyncService] Invalid Google Drive credentials');
        return false;
      }

      // 检查是否有 change token，没有则获取初始 token
      const existingToken = await this.stateManager.getChangeToken();
      if (!existingToken) {
        console.log('[DriveSyncService] No change token found, getting initial token...');
        const startPageToken = await client.getStartPageToken();
        if (startPageToken) {
          await this.stateManager.saveChangeToken(startPageToken);
          console.log('[DriveSyncService] Initial change token saved');
        }
      }

      console.log('[DriveSyncService] Service initialized successfully');
      return true;
    } catch (error) {
      console.error('[DriveSyncService] Initialization error:', error);
      return false;
    }
  }

  /**
   * 执行同步
   */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      filesProcessed: 0,
      filesAdded: 0,
      filesUpdated: 0,
      filesDeleted: 0,
      errors: [],
      duration: 0,
    };

    // 防止并发同步
    if (this.isSyncing) {
      console.warn('[DriveSyncService] Sync already in progress, skipping...');
      result.errors.push({
        fileId: '',
        fileName: '',
        error: 'Sync already in progress',
      });
      result.duration = Date.now() - startTime;
      return result;
    }

    this.isSyncing = true;

    try {
      await this.stateManager.updateStatus('syncing');

      if (options.forceFullSync) {
        // 全量同步：列出所有文件
        await this.performFullSync(result, options.dryRun);
      } else {
        // 增量同步：使用 change token
        await this.performIncrementalSync(result, options.dryRun);
      }

      result.success = result.errors.length === 0;
      await this.stateManager.updateStatus('idle');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[DriveSyncService] Sync error:', errorMsg);
      result.errors.push({
        fileId: '',
        fileName: '',
        error: errorMsg,
      });
      await this.stateManager.updateStatus('error', errorMsg);
    } finally {
      this.isSyncing = false;
      result.duration = Date.now() - startTime;
    }

    console.log(`[DriveSyncService] Sync completed: ${result.filesProcessed} files processed, ` +
      `${result.filesAdded} added, ${result.filesUpdated} updated, ${result.filesDeleted} deleted, ` +
      `${result.errors.length} errors, ${result.duration}ms`);

    return result;
  }

  /**
   * 全量同步
   */
  private async performFullSync(result: SyncResult, dryRun?: boolean): Promise<void> {
    console.log('[DriveSyncService] Performing full sync...');

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID not configured');
    }

    const client = this.getDriveClient();

    // 列出文件夹中的所有文件
    const files = await client.listFiles(folderId);
    console.log(`[DriveSyncService] Found ${files.length} files in folder`);

    for (const file of files) {
      result.filesProcessed++;
      
      try {
        const needsUpdate = await this.stateManager.needsUpdate(
          file.id,
          file.md5Checksum || null,
          file.modifiedTime
        );

        if (!needsUpdate) {
          console.log(`[DriveSyncService] File unchanged: ${file.name}`);
          continue;
        }

        if (dryRun) {
          console.log(`[DriveSyncService] [DRY RUN] Would process: ${file.name}`);
          result.filesAdded++;
          continue;
        }

        const isNew = !(await this.stateManager.getFileSyncRecord(file.id));
        await this.processFile(file);

        if (isNew) {
          result.filesAdded++;
        } else {
          result.filesUpdated++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[DriveSyncService] Error processing ${file.name}:`, errorMsg);
        result.errors.push({
          fileId: file.id,
          fileName: file.name,
          error: errorMsg,
        });
      }
    }

    // 更新 change token
    const newToken = await client.getStartPageToken();
    if (newToken) {
      await this.stateManager.saveChangeToken(newToken);
    }
  }

  /**
   * 增量同步
   */
  private async performIncrementalSync(result: SyncResult, dryRun?: boolean): Promise<void> {
    console.log('[DriveSyncService] Performing incremental sync...');

    const pageToken = await this.stateManager.getChangeToken();
    if (!pageToken) {
      console.log('[DriveSyncService] No change token, falling back to full sync');
      return this.performFullSync(result, dryRun);
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID not configured');
    }

    const client = this.getDriveClient();

    // 获取变更
    const { changes, newStartPageToken } = await client.getChanges(pageToken);
    console.log(`[DriveSyncService] Found ${changes.length} changes`);

    for (const change of changes) {
      result.filesProcessed++;

      try {
        if (change.removed || change.file?.trashed) {
          // 文件被删除
          if (dryRun) {
            console.log(`[DriveSyncService] [DRY RUN] Would delete: ${change.fileId}`);
          } else {
            await this.handleFileDeleted(change.fileId);
          }
          result.filesDeleted++;
          continue;
        }

        const file = change.file;
        if (!file) continue;

        // 检查文件是否在目标文件夹中
        if (!file.parents?.includes(folderId)) {
          console.log(`[DriveSyncService] File not in target folder: ${file.name}`);
          continue;
        }

        if (dryRun) {
          console.log(`[DriveSyncService] [DRY RUN] Would process: ${file.name}`);
          result.filesUpdated++;
          continue;
        }

        const isNew = !(await this.stateManager.getFileSyncRecord(file.id));
        await this.processFile(file);

        if (isNew) {
          result.filesAdded++;
        } else {
          result.filesUpdated++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[DriveSyncService] Error processing change:`, errorMsg);
        result.errors.push({
          fileId: change.fileId,
          fileName: change.file?.name || 'unknown',
          error: errorMsg,
        });
      }
    }

    // 保存新的 change token
    if (newStartPageToken) {
      await this.stateManager.saveChangeToken(newStartPageToken);
    }
  }

  /**
   * 处理单个文件
   */
  private async processFile(file: DriveFile): Promise<void> {
    console.log(`[DriveSyncService] Processing file: ${file.name} (${file.mimeType})`);

    const client = this.getDriveClient();

    // 获取文件内容
    let content: Buffer;
    let mimeType = file.mimeType;

    if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
      // Google Sheets 需要导出
      const exported = await client.exportSheet(file.id);
      content = Buffer.from(exported);
      mimeType = 'text/plain'; // 导出为文本
    } else {
      content = await client.getFileContent(file.id);
    }

    // 解析文件
    const parsed = await parseFile(content, mimeType, file.name);
    const sourceType = getSourceType(file.mimeType);

    // 分片处理大文件
    const chunks = chunkText(parsed.text, { chunkSize: 2000, overlap: 200 });
    const documentIds: number[] = [];

    // 删除旧的文档记录
    const existingRecord = await this.stateManager.getFileSyncRecord(file.id);
    if (existingRecord && existingRecord.document_ids.length > 0) {
      await this.deleteDocuments(existingRecord.document_ids);
    }

    // 为每个分片创建文档
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const title = generateTitle(file.name, i, chunks.length);

      // 生成嵌入向量
      const embedding = await this.generateEmbedding(chunk.content);

      // 创建文档记录
      const docRecord: DocumentRecord = {
        title,
        content: chunk.content,
        metadata: {
          ...parsed.metadata,
          driveFileId: file.id,
          chunkIndex: i,
          totalChunks: chunks.length,
        },
        embedding: embedding || undefined,
        source_type: sourceType,
      };

      const docId = await this.saveDocument(docRecord);
      if (docId) {
        documentIds.push(docId);
      }
    }

    // 更新同步记录
    if (existingRecord) {
      await this.stateManager.updateFileSyncRecord(file.id, {
        file_name: file.name,
        mime_type: file.mimeType,
        md5_checksum: file.md5Checksum || null,
        modified_time: file.modifiedTime,
        document_ids: documentIds,
        source_type: sourceType,
        sync_status: 'synced',
        error_message: null,
      });
    } else {
      await this.stateManager.createFileSyncRecord({
        drive_file_id: file.id,
        file_name: file.name,
        mime_type: file.mimeType,
        md5_checksum: file.md5Checksum || null,
        modified_time: file.modifiedTime,
        document_ids: documentIds,
        source_type: sourceType,
        sync_status: 'synced',
      });
    }

    console.log(`[DriveSyncService] File processed: ${file.name}, ${documentIds.length} documents created`);
  }

  /**
   * 处理文件删除
   */
  private async handleFileDeleted(fileId: string): Promise<void> {
    const record = await this.stateManager.getFileSyncRecord(fileId);
    if (!record) return;

    // 删除关联的文档
    if (record.document_ids.length > 0) {
      await this.deleteDocuments(record.document_ids);
    }

    // 删除同步记录
    await this.stateManager.deleteFileSyncRecord(fileId);
    console.log(`[DriveSyncService] File deleted: ${record.file_name}`);
  }

  /**
   * 生成文本嵌入向量（带重试）
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[DriveSyncService] GEMINI_API_KEY not configured');
      return null;
    }

    try {
      return await withRetry(async () => {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'models/text-embedding-004',
              content: { parts: [{ text }] },
              taskType: 'RETRIEVAL_DOCUMENT',
            }),
          }
        );

        if (!response.ok) {
          const status = response.status;
          // 抛出错误以触发重试
          throw new Error(`Embedding API error: ${status}`);
        }

        const data = await response.json();
        return data.embedding?.values || null;
      }, 3, 1000);
    } catch (error) {
      // 重试失败后优雅降级，返回 null
      console.error('[DriveSyncService] Embedding failed after retries:', error);
      return null;
    }
  }

  /**
   * 保存文档到数据库
   */
  private async saveDocument(doc: DocumentRecord): Promise<number | null> {
    const client = getInvestmentDb();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('documents')
        .insert({
          title: doc.title,
          content: doc.content,
          metadata: doc.metadata,
          embedding: doc.embedding,
          source_type: doc.source_type,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[DriveSyncService] Error saving document:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('[DriveSyncService] Exception saving document:', error);
      return null;
    }
  }

  /**
   * 删除文档
   */
  private async deleteDocuments(ids: number[]): Promise<void> {
    const client = getInvestmentDb();
    if (!client || ids.length === 0) return;

    try {
      const { error } = await client
        .from('documents')
        .delete()
        .in('id', ids);

      if (error) {
        console.error('[DriveSyncService] Error deleting documents:', error);
      }
    } catch (error) {
      console.error('[DriveSyncService] Exception deleting documents:', error);
    }
  }

  /**
   * 获取当前同步状态
   */
  async getStatus(): Promise<{
    status: 'idle' | 'syncing' | 'error';
    lastSyncAt: string | null;
    errorMessage: string | null;
    fileCount: number;
  }> {
    const state = await this.stateManager.getSyncState();
    const records = await this.stateManager.getAllFileSyncRecords();

    return {
      status: state?.status || 'idle',
      lastSyncAt: state?.last_sync_at || null,
      errorMessage: state?.error_message || null,
      fileCount: records.length,
    };
  }

  /**
   * 检查是否正在同步
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }
}

// 导出工厂函数而非单例（因为需要配置）
export function createDriveSyncService(
  driveClient?: GoogleDriveClient,
  stateManager?: SyncStateManager
): DriveSyncService {
  return new DriveSyncService(driveClient, stateManager);
}

export default DriveSyncService;
