/**
 * 文件存储服务
 * 支持 S3 和本地文件系统两种存储后端
 * 
 * 来源: 自定义实现，参考 AWS S3 SDK 和 Node.js fs 模块
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

// ============ 类型定义 ============

export interface StorageConfig {
  type: 'local' | 's3';
  // 本地存储配置
  localPath?: string;
  // S3 存储配置
  s3Bucket?: string;
  s3Region?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3Endpoint?: string; // 用于 MinIO 等兼容 S3 的服务
}

export interface UploadResult {
  path: string;      // 存储路径
  checksum: string;  // SHA256 校验和
  size: number;      // 文件大小
}

export interface StorageAdapter {
  upload(key: string, data: Buffer, mimeType: string): Promise<UploadResult>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getUrl(key: string): Promise<string>;
}

// ============ 工具函数 ============

/**
 * 计算文件的 SHA256 校验和
 */
export function calculateChecksum(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * 生成唯一的存储路径
 * 格式: {accountId}/{year}/{month}/{uuid}.{ext}
 */
export function generateStoragePath(
  accountId: number,
  filename: string,
  date: Date = new Date()
): string {
  const ext = path.extname(filename).toLowerCase();
  const uuid = crypto.randomUUID();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  return `${accountId}/${year}/${month}/${uuid}${ext}`;
}

// ============ 本地文件系统适配器 ============

export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async upload(key: string, data: Buffer, _mimeType: string): Promise<UploadResult> {
    const fullPath = path.join(this.basePath, key);
    const dir = path.dirname(fullPath);
    
    // 确保目录存在
    await fs.mkdir(dir, { recursive: true });
    
    // 写入文件
    await fs.writeFile(fullPath, data);
    
    return {
      path: key,
      checksum: calculateChecksum(data),
      size: data.length,
    };
  }

  async download(key: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, key);
    
    try {
      return await fs.readFile(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`文件不存在: ${key}`);
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.basePath, key);
    
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // 文件不存在时静默忽略
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, key);
    
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getUrl(key: string): Promise<string> {
    // 本地存储返回相对路径，由 API 层处理
    return `/api/documents/file/${encodeURIComponent(key)}`;
  }
}

// ============ S3 存储适配器 ============

export class S3StorageAdapter implements StorageAdapter {
  private bucket: string;
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private endpoint?: string;
  private client: any; // AWS S3 Client

  constructor(config: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  }) {
    this.bucket = config.bucket;
    this.region = config.region;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.endpoint = config.endpoint;
  }

  private async getClient() {
    if (!this.client) {
      // 动态导入 AWS SDK，避免在不使用 S3 时加载
      const { S3Client } = await import('@aws-sdk/client-s3');
      
      this.client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
        ...(this.endpoint && {
          endpoint: this.endpoint,
          forcePathStyle: true, // MinIO 需要
        }),
      });
    }
    return this.client;
  }

  async upload(key: string, data: Buffer, mimeType: string): Promise<UploadResult> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();
    
    const checksum = calculateChecksum(data);
    
    await client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: mimeType,
      Metadata: {
        checksum,
      },
    }));
    
    return {
      path: key,
      checksum,
      size: data.length,
    };
  }

  async download(key: string): Promise<Buffer> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();
    
    try {
      const response = await client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      
      // 将 ReadableStream 转换为 Buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        throw new Error(`文件不存在: ${key}`);
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();
    
    await client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }

  async exists(key: string): Promise<boolean> {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();
    
    try {
      await client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getUrl(key: string): Promise<string> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = await this.getClient();
    
    // 生成预签名 URL，有效期 1 小时
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    
    return getSignedUrl(client, command, { expiresIn: 3600 });
  }
}

// ============ 存储服务工厂 ============

export class StorageService {
  private adapter: StorageAdapter;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    
    if (config.type === 's3') {
      if (!config.s3Bucket || !config.s3Region || !config.s3AccessKeyId || !config.s3SecretAccessKey) {
        throw new Error('S3 存储配置不完整');
      }
      this.adapter = new S3StorageAdapter({
        bucket: config.s3Bucket,
        region: config.s3Region,
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
        endpoint: config.s3Endpoint,
      });
    } else {
      if (!config.localPath) {
        throw new Error('本地存储路径未配置');
      }
      this.adapter = new LocalStorageAdapter(config.localPath);
    }
  }

  /**
   * 上传文件
   */
  async upload(
    accountId: number,
    filename: string,
    data: Buffer,
    mimeType: string
  ): Promise<UploadResult> {
    const key = generateStoragePath(accountId, filename);
    return this.adapter.upload(key, data, mimeType);
  }

  /**
   * 下载文件
   */
  async download(key: string): Promise<Buffer> {
    return this.adapter.download(key);
  }

  /**
   * 删除文件
   */
  async delete(key: string): Promise<void> {
    return this.adapter.delete(key);
  }

  /**
   * 检查文件是否存在
   */
  async exists(key: string): Promise<boolean> {
    return this.adapter.exists(key);
  }

  /**
   * 获取文件访问 URL
   */
  async getUrl(key: string): Promise<string> {
    return this.adapter.getUrl(key);
  }

  /**
   * 验证文件完整性
   */
  async verifyChecksum(key: string, expectedChecksum: string): Promise<boolean> {
    const data = await this.download(key);
    const actualChecksum = calculateChecksum(data);
    return actualChecksum === expectedChecksum;
  }
}

// ============ 默认实例 ============

let defaultStorageService: StorageService | null = null;

/**
 * 获取默认存储服务实例
 */
export function getStorageService(): StorageService {
  if (!defaultStorageService) {
    // 从环境变量读取配置
    const storageType = process.env.STORAGE_TYPE as 'local' | 's3' || 'local';
    
    const config: StorageConfig = {
      type: storageType,
      localPath: process.env.STORAGE_LOCAL_PATH || './.blinko/documents',
      s3Bucket: process.env.STORAGE_S3_BUCKET,
      s3Region: process.env.STORAGE_S3_REGION,
      s3AccessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID,
      s3SecretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY,
      s3Endpoint: process.env.STORAGE_S3_ENDPOINT,
    };
    
    defaultStorageService = new StorageService(config);
  }
  
  return defaultStorageService;
}

/**
 * 创建自定义存储服务实例
 */
export function createStorageService(config: StorageConfig): StorageService {
  return new StorageService(config);
}
