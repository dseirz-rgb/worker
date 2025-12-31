/**
 * Paperless-ngx API 客户端
 * 来源: 基于 Paperless-ngx REST API 文档
 * 文档: https://docs.paperless-ngx.com/api/
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// ============ 类型定义 ============

export interface PaperlessConfig {
  baseUrl: string;
  apiToken: string;
}

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

export interface UploadMetadata {
  title?: string;
  correspondent?: number;
  document_type?: number;
  tags?: number[];
}

// ============ 错误类 ============

export class PaperlessError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'PaperlessError';
  }
}

// ============ 客户端类 ============

export class PaperlessClient {
  private client: AxiosInstance;
  private config: PaperlessConfig;

  constructor(config: PaperlessConfig) {
    this.config = config;
    
    // 确保 baseUrl 没有尾部斜杠
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    
    this.client = axios.create({
      baseURL: `${baseUrl}/api`,
      headers: {
        'Authorization': `Token ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 秒超时
    });
  }

  // ============ 私有方法 ============

  private handleError(error: unknown, operation: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      
      if (status === 401) {
        throw new PaperlessError('认证失败，请检查 API Token', status, error);
      }
      if (status === 403) {
        throw new PaperlessError('权限不足，无法执行此操作', status, error);
      }
      if (status === 404) {
        throw new PaperlessError('资源不存在', status, error);
      }
      if (status === 500) {
        throw new PaperlessError('Paperless-ngx 服务器错误', status, error);
      }
      if (axiosError.code === 'ECONNREFUSED') {
        throw new PaperlessError('无法连接到 Paperless-ngx 服务', undefined, error);
      }
      if (axiosError.code === 'ETIMEDOUT') {
        throw new PaperlessError('连接 Paperless-ngx 超时', undefined, error);
      }
      
      throw new PaperlessError(
        `${operation} 失败: ${axiosError.message}`,
        status,
        error
      );
    }
    
    throw new PaperlessError(
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
      
      const response = await this.client.get('/documents/', { params: queryParams });
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
      
      const response = await this.client.get('/documents/', { params: queryParams });
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
      const response = await this.client.get(`/documents/${id}/`);
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
      if (metadata?.correspondent) formData.append('correspondent', metadata.correspondent.toString());
      if (metadata?.document_type) formData.append('document_type', metadata.document_type.toString());
      if (metadata?.tags?.length) {
        metadata.tags.forEach(tagId => formData.append('tags', tagId.toString()));
      }
      
      const response = await this.client.post('/documents/post_document/', formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Token ${this.config.apiToken}`,
        },
        timeout: 120000, // 上传超时 2 分钟
      });
      
      return { task_id: response.data };
    } catch (error) {
      this.handleError(error, '上传文档');
    }
  }

  /**
   * 下载原始文档
   */
  async downloadDocument(id: number): Promise<Buffer> {
    try {
      const response = await this.client.get(`/documents/${id}/download/`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      this.handleError(error, '下载文档');
    }
  }

  /**
   * 获取文档预览 (缩略图)
   */
  async getDocumentPreview(id: number): Promise<Buffer> {
    try {
      const response = await this.client.get(`/documents/${id}/preview/`, {
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
      const response = await this.client.get(`/documents/${id}/thumb/`, {
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
      const response = await this.client.patch(`/documents/${id}/`, data);
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
      await this.client.delete(`/documents/${id}/`);
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
      const response = await this.client.get('/tags/');
      // Paperless API 返回分页结果，但标签通常不多，直接返回所有
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
      const response = await this.client.post('/tags/', {
        name: data.name,
        color: data.color || '#a6cee3', // 默认颜色
        match: '',
        matching_algorithm: 0,
        is_insensitive: true,
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
      const response = await this.client.patch(`/tags/${id}/`, data);
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
      await this.client.delete(`/tags/${id}/`);
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
      const response = await this.client.get('/document_types/');
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
      const response = await this.client.post('/document_types/', {
        name: data.name,
        match: '',
        matching_algorithm: 0,
        is_insensitive: true,
      });
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
      await this.client.delete(`/document_types/${id}/`);
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
      const response = await this.client.get('/correspondents/');
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
      // 尝试获取标签列表来验证连接和认证
      await this.client.get('/tags/', { timeout: 10000 });
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          throw new PaperlessError('API Token 无效', status, error);
        }
        if (error.code === 'ECONNREFUSED') {
          throw new PaperlessError('无法连接到 Paperless-ngx 服务，请检查 URL', undefined, error);
        }
      }
      throw new PaperlessError('连接测试失败', undefined, error instanceof Error ? error : undefined);
    }
  }
}

// ============ 工厂函数 ============

/**
 * 创建 Paperless 客户端实例
 */
export function createPaperlessClient(config: PaperlessConfig): PaperlessClient {
  if (!config.baseUrl) {
    throw new PaperlessError('Paperless-ngx URL 未配置');
  }
  if (!config.apiToken) {
    throw new PaperlessError('Paperless-ngx API Token 未配置');
  }
  return new PaperlessClient(config);
}
