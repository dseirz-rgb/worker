/**
 * SeekDB API 客户端
 * 实现与 PaperlessClient 相同的接口，连接 SeekDB 后端
 * 
 * SeekDB: https://github.com/oceanbase/seekdb
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// ============ 类型定义 ============

export interface SeekDBConfig {
  baseUrl: string;  // 默认 http://localhost:8765
}

// 复用 Paperless 的类型定义，保持兼容
export interface PaperlessDocument {
  id: number;
  title: string;
  content: string;
  created: string;
  modified: string;
  added: string;
  correspondent: number | null;
  document_type: number | null;
  tags: number[];
  archive_serial_number: number | null;
  original_file_name: string;
  archived_file_name: string;
}

export interface PaperlessTag {
  id: number;
  name: string;
  color: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
}

export interface PaperlessDocumentType {
  id: number;
  name: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
}

export interface PaperlessCorrespondent {
  id: number;
  name: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DocumentListParams {
  page?: number;
  page_size?: number;
  ordering?: string;
  tags__id__in?: number[];
  document_type__id?: number;
  correspondent__id?: number;
  created__date__gt?: string;
  created__date__lt?: string;
}

export interface SearchParams {
  page?: number;
  page_size?: number;
}

// 混合搜索相关类型
export interface HybridSearchParams {
  query: string;
  alpha?: number;  // 0=纯文本, 1=纯向量, 默认 0.5
  source_type?: string;
  limit?: number;
}

export interface HybridSearchResult {
  id: string;
  content: string;
  source_type: string;
  source_path: string;
  metadata: Record<string, unknown>;
  score: number;
  text_score?: number;
  vector_score?: number;
  created_at?: string;
}

export interface HybridSearchResponse {
  results: HybridSearchResult[];
  total: number;
  query: string;
  alpha: number;
  embedding_available: boolean;
}

// v2 API 类型定义
export interface SearchResponseV2 {
  results: HybridSearchResult[];
  total: number;
  query: string;
  alpha: number;
  backend_used: 'postgres' | 'seekdb' | 'hybrid';
  embedding_available: boolean;
  postgres_latency_ms?: number;
  seekdb_latency_ms?: number;
  total_latency_ms: number;
  degraded: boolean;
  degraded_reason?: string;
}

export interface SyncRequest {
  doc_id: number;
  operation: 'create' | 'update' | 'delete';
  content?: string;
  source_type?: string;
  source_path?: string;
  metadata?: Record<string, unknown>;
}

export interface SyncResponse {
  task_id: string;
  status: string;
}

export interface HealthResponseV2 {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    postgres?: { status: string; url?: string; error?: string };
    seekdb?: { status: string; error?: string };
    embedding?: { status: string; model?: string; host?: string };
    sync?: { status: string; queue_depth?: number };
  };
  degraded_reason?: string;
}

export interface MetricsResponse {
  timestamp: string;
  uptime_seconds: number;
  search: {
    total_requests: number;
    postgres_requests: number;
    seekdb_requests: number;
    hybrid_requests: number;
    degraded_requests: number;
    avg_postgres_latency_ms: number;
    avg_seekdb_latency_ms: number;
  };
  sync: {
    queue_depth: number;
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    avg_sync_time_ms: number;
    running: boolean;
  };
  cache: {
    size: number;
    capacity: number;
    hits: number;
    misses: number;
    hit_rate: number;
  };
}

export interface EmbeddingStatusResponse {
  available: boolean;
  model: string;
  host: string;
}

export interface UploadMetadata {
  title?: string;
  correspondent?: number;
  document_type?: number;
  tags?: number[];
}

// ============ 错误类 ============

export class SeekDBError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SeekDBError';
  }
}

// ============ 客户端类 ============

export class SeekDBClient {
  private client: AxiosInstance;
  private config: SeekDBConfig;

  constructor(config: SeekDBConfig) {
    this.config = config;
    
    // 确保 baseUrl 没有尾部斜杠
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 秒超时（减少等待时间）
      // 启用 keep-alive 复用连接
      httpAgent: new (require('http').Agent)({ keepAlive: true }),
    });
  }

  // ============ 私有方法 ============

  private handleError(error: unknown, operation: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      
      if (status === 404) {
        throw new SeekDBError('资源不存在', status, error);
      }
      if (status === 500) {
        throw new SeekDBError('SeekDB 服务器错误', status, error);
      }
      if (axiosError.code === 'ECONNREFUSED') {
        throw new SeekDBError('无法连接到 SeekDB 服务', undefined, error);
      }
      if (axiosError.code === 'ETIMEDOUT') {
        throw new SeekDBError('连接 SeekDB 超时', undefined, error);
      }
      
      throw new SeekDBError(
        `${operation} 失败: ${axiosError.message}`,
        status,
        error
      );
    }
    
    throw new SeekDBError(
      `${operation} 失败: ${error instanceof Error ? error.message : '未知错误'}`,
      undefined,
      error instanceof Error ? error : undefined
    );
  }

  // ============ 文档操作 ============

  /**
   * 获取文档列表
   */
  async listDocuments(params?: DocumentListParams): Promise<PaginatedResponse<PaperlessDocument>> {
    try {
      const queryParams: Record<string, string | number> = {};
      
      if (params?.page) queryParams.page = params.page;
      if (params?.page_size) queryParams.page_size = params.page_size;
      if (params?.ordering) queryParams.ordering = params.ordering;
      if (params?.document_type__id) queryParams.document_type__id = params.document_type__id;
      if (params?.correspondent__id) queryParams.correspondent__id = params.correspondent__id;
      if (params?.created__date__gt) queryParams.created__date__gt = params.created__date__gt;
      if (params?.created__date__lt) queryParams.created__date__lt = params.created__date__lt;
      if (params?.tags__id__in?.length) {
        queryParams.tags__id__in = params.tags__id__in.join(',');
      }
      
      const response = await this.client.get('/api/documents/', { params: queryParams });
      return response.data;
    } catch (error) {
      this.handleError(error, '获取文档列表');
    }
  }

  /**
   * 搜索文档 (全文搜索)
   */
  async searchDocuments(query: string, params?: SearchParams): Promise<PaginatedResponse<PaperlessDocument>> {
    try {
      const queryParams: Record<string, string | number> = {
        query,
      };
      
      if (params?.page) queryParams.page = params.page;
      if (params?.page_size) queryParams.page_size = params.page_size;
      
      const response = await this.client.get('/api/documents/', { params: queryParams });
      return response.data;
    } catch (error) {
      this.handleError(error, '搜索文档');
    }
  }

  /**
   * 获取单个文档详情
   */
  async getDocument(id: number): Promise<PaperlessDocument> {
    try {
      const response = await this.client.get(`/api/documents/${id}/`);
      return response.data;
    } catch (error) {
      this.handleError(error, '获取文档详情');
    }
  }

  /**
   * 上传文档
   */
  async uploadDocument(
    file: Buffer,
    filename: string,
    metadata?: UploadMetadata
  ): Promise<{ task_id: string }> {
    try {
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      
      formData.append('document', file, { filename });
      
      if (metadata?.title) formData.append('title', metadata.title);
      if (metadata?.document_type) formData.append('document_type', metadata.document_type.toString());
      if (metadata?.tags?.length) {
        formData.append('tags', metadata.tags.join(','));
      }
      
      const response = await this.client.post('/api/documents/post_document/', formData, {
        headers: formData.getHeaders(),
        timeout: 120000, // 上传超时 2 分钟
      });
      
      return response.data;
    } catch (error) {
      this.handleError(error, '上传文档');
    }
  }

  /**
   * 下载原始文档
   */
  async downloadDocument(id: number): Promise<Buffer> {
    try {
      const response = await this.client.get(`/api/documents/${id}/download/`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      this.handleError(error, '下载文档');
    }
  }

  /**
   * 获取文档预览 (PDF)
   */
  async getDocumentPreview(id: number): Promise<Buffer> {
    try {
      const response = await this.client.get(`/api/documents/${id}/preview/`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      this.handleError(error, '获取文档预览');
    }
  }

  /**
   * 获取文档缩略图
   */
  async getDocumentThumbnail(id: number): Promise<Buffer> {
    try {
      const response = await this.client.get(`/api/documents/${id}/thumb/`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      this.handleError(error, '获取文档缩略图');
    }
  }

  /**
   * 更新文档
   */
  async updateDocument(id: number, data: Partial<PaperlessDocument>): Promise<PaperlessDocument> {
    try {
      const response = await this.client.patch(`/api/documents/${id}/`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, '更新文档');
    }
  }

  /**
   * 删除文档
   */
  async deleteDocument(id: number): Promise<void> {
    try {
      await this.client.delete(`/api/documents/${id}/`);
    } catch (error) {
      this.handleError(error, '删除文档');
    }
  }

  // ============ 标签操作 ============

  /**
   * 获取所有标签
   */
  async listTags(): Promise<PaperlessTag[]> {
    try {
      const response = await this.client.get('/api/tags/');
      return response.data.results || response.data;
    } catch (error) {
      this.handleError(error, '获取标签列表');
    }
  }

  /**
   * 创建标签
   */
  async createTag(data: { name: string; color?: string }): Promise<PaperlessTag> {
    try {
      const response = await this.client.post('/api/tags/', {
        name: data.name,
        color: data.color || '#a6cee3',
      });
      return response.data;
    } catch (error) {
      this.handleError(error, '创建标签');
    }
  }

  /**
   * 更新标签
   */
  async updateTag(id: number, data: Partial<PaperlessTag>): Promise<PaperlessTag> {
    try {
      const response = await this.client.patch(`/api/tags/${id}/`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, '更新标签');
    }
  }

  /**
   * 删除标签
   */
  async deleteTag(id: number): Promise<void> {
    try {
      await this.client.delete(`/api/tags/${id}/`);
    } catch (error) {
      this.handleError(error, '删除标签');
    }
  }

  // ============ 文档类型操作 ============

  /**
   * 获取所有文档类型
   */
  async listDocumentTypes(): Promise<PaperlessDocumentType[]> {
    try {
      const response = await this.client.get('/api/document_types/');
      return response.data.results || response.data;
    } catch (error) {
      this.handleError(error, '获取文档类型列表');
    }
  }

  /**
   * 创建文档类型
   */
  async createDocumentType(data: { name: string }): Promise<PaperlessDocumentType> {
    try {
      const response = await this.client.post('/api/document_types/', data);
      return response.data;
    } catch (error) {
      this.handleError(error, '创建文档类型');
    }
  }

  /**
   * 删除文档类型
   */
  async deleteDocumentType(id: number): Promise<void> {
    try {
      await this.client.delete(`/api/document_types/${id}/`);
    } catch (error) {
      this.handleError(error, '删除文档类型');
    }
  }

  // ============ 通讯者操作 ============

  /**
   * 获取所有通讯者
   */
  async listCorrespondents(): Promise<PaperlessCorrespondent[]> {
    try {
      const response = await this.client.get('/api/correspondents/');
      return response.data.results || response.data;
    } catch (error) {
      this.handleError(error, '获取通讯者列表');
    }
  }

  // ============ 连接测试 ============

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 10000 });
      return response.data.status === 'healthy';
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new SeekDBError('无法连接到 SeekDB 服务，请检查服务是否启动', undefined, error);
        }
      }
      throw new SeekDBError('连接测试失败', undefined, error instanceof Error ? error : undefined);
    }
  }

  // ============ 混合搜索 API ============

  /**
   * 混合搜索（向量 + 全文）
   * 
   * @param params 搜索参数
   * @param params.query 搜索查询
   * @param params.alpha 向量权重 (0=纯文本, 1=纯向量, 默认 0.5)
   * @param params.source_type 来源类型过滤
   * @param params.limit 返回结果数量
   */
  async hybridSearch(params: HybridSearchParams): Promise<HybridSearchResponse> {
    try {
      const response = await this.client.post('/search', {
        query: params.query,
        alpha: params.alpha ?? 0.5,
        source_type: params.source_type,
        limit: params.limit ?? 20,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, '混合搜索');
    }
  }

  /**
   * 获取 embedding 服务状态
   */
  async getEmbeddingStatus(): Promise<EmbeddingStatusResponse> {
    try {
      const response = await this.client.get('/embedding/status');
      return response.data;
    } catch (error) {
      // 如果端点不存在，返回不可用状态
      return {
        available: false,
        model: 'unknown',
        host: 'unknown',
      };
    }
  }

  /**
   * 生成文本 embedding
   */
  async generateEmbedding(text: string): Promise<{ embedding: number[] | null; success: boolean; error?: string }> {
    try {
      const response = await this.client.post('/embedding', { text });
      return response.data;
    } catch (error) {
      return {
        embedding: null,
        success: false,
        error: error instanceof Error ? error.message : '生成 embedding 失败',
      };
    }
  }

  // ============ v2 API (双数据库架构) ============

  /**
   * v2 搜索接口
   * 
   * 使用双数据库架构：PostgreSQL (FTS) + SeekDB (向量)
   * 
   * @param params 搜索参数
   * @param params.query 搜索查询
   * @param params.alpha 向量权重 (0=纯FTS, 1=纯向量, 默认 0.5)
   * @param params.source_type 来源类型过滤
   * @param params.limit 返回结果数量
   */
  async searchV2(params: HybridSearchParams): Promise<SearchResponseV2> {
    try {
      const response = await this.client.post('/search', {
        query: params.query,
        alpha: params.alpha ?? 0.5,
        source_type: params.source_type,
        limit: params.limit ?? 20,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'v2 搜索');
    }
  }

  /**
   * 同步文档到 SeekDB
   * 
   * 当 PostgreSQL 中的文档发生变更时，调用此接口同步到 SeekDB 向量索引
   */
  async syncDocument(request: SyncRequest): Promise<SyncResponse> {
    try {
      const response = await this.client.post('/sync', request);
      return response.data;
    } catch (error) {
      this.handleError(error, '同步文档');
    }
  }

  /**
   * 获取同步服务状态
   */
  async getSyncStatus(): Promise<Record<string, unknown>> {
    try {
      const response = await this.client.get('/sync/status');
      return response.data;
    } catch (error) {
      this.handleError(error, '获取同步状态');
    }
  }

  /**
   * v2 健康检查
   * 
   * 检查所有服务状态：PostgreSQL、SeekDB、Embedding、Sync
   */
  async healthCheckV2(): Promise<HealthResponseV2> {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      this.handleError(error, 'v2 健康检查');
    }
  }

  /**
   * 获取性能指标
   */
  async getMetrics(): Promise<MetricsResponse> {
    try {
      const response = await this.client.get('/metrics');
      return response.data;
    } catch (error) {
      this.handleError(error, '获取性能指标');
    }
  }

  /**
   * 获取降级模式状态
   */
  async getDegradedStatus(): Promise<{ degraded: boolean; reasons?: string[]; fallback?: string }> {
    try {
      const response = await this.client.get('/degraded');
      return response.data;
    } catch (error) {
      return { degraded: false };
    }
  }
}

// ============ 工厂函数 ============

/**
 * 创建 SeekDB 客户端实例
 */
export function createSeekDBClient(config: SeekDBConfig): SeekDBClient {
  if (!config.baseUrl) {
    throw new SeekDBError('SeekDB URL 未配置');
  }
  return new SeekDBClient(config);
}

// 默认配置
export const DEFAULT_SEEKDB_CONFIG: SeekDBConfig = {
  baseUrl: process.env.SEEKDB_API_URL || 'http://localhost:8765',
};
