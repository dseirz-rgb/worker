/**
 * Khoj 客户端服务
 * 封装与 Khoj Server 的所有 HTTP 通信
 * 
 * Khoj 是一个开源的 AI 个人助手，提供知识管理和语义搜索能力
 * 默认运行在 http://localhost:42110
 */

import type {
  KhojConfig,
  KhojSearchResult,
  KhojSearchOptions,
  KhojChatMessage,
  KhojChatOptions,
  KhojAgent,
  KhojIndexStatus,
  KhojConversation,
  KhojIndexResult,
  KhojIndexedDocument,
} from '../../types/khoj';

/** 默认 Khoj 服务器 URL */
const DEFAULT_KHOJ_URL = 'http://localhost:42110';

/** 默认请求超时时间（毫秒） */
const DEFAULT_TIMEOUT = 30000;

/** 健康检查超时时间（毫秒） */
const HEALTH_CHECK_TIMEOUT = 5000;

/**
 * Khoj 客户端错误类
 * 用于封装 Khoj API 调用中的错误
 */
export class KhojClientError extends Error {
  /** HTTP 状态码 */
  public readonly statusCode?: number;
  /** 原始错误 */
  public readonly cause?: Error;

  constructor(message: string, statusCode?: number, cause?: Error) {
    super(message);
    this.name = 'KhojClientError';
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

/**
 * Khoj 客户端服务
 * 封装与 Khoj Server 的所有通信
 */
export class KhojClient {
  /** 客户端配置 */
  private config: Required<Pick<KhojConfig, 'baseUrl' | 'timeout'>> & Omit<KhojConfig, 'baseUrl' | 'timeout'>;
  
  /** 连接状态 */
  private isConnected: boolean = false;

  /**
   * 创建 Khoj 客户端实例
   * @param config - Khoj 配置
   */
  constructor(config: KhojConfig) {
    this.config = {
      baseUrl: config.baseUrl || DEFAULT_KHOJ_URL,
      timeout: config.timeout || DEFAULT_TIMEOUT,
      apiKey: config.apiKey,
      username: config.username,
    };
  }

  /**
   * 健康检查
   * 检测 Khoj 服务器是否可用
   * @returns 服务器是否健康
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/api/health`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        },
        HEALTH_CHECK_TIMEOUT
      );
      
      this.isConnected = response.ok;
      return response.ok;
    } catch (error) {
      // 健康检查失败，标记为未连接
      this.isConnected = false;
      console.warn('Khoj 健康检查失败:', error);
      return false;
    }
  }

  /**
   * 语义搜索
   * 在 Khoj 知识库中进行语义搜索
   * @param query - 搜索查询
   * @param options - 搜索选项
   * @returns 搜索结果列表
   */
  async search(query: string, options?: KhojSearchOptions): Promise<KhojSearchResult[]> {
    // 构建查询参数
    const params = new URLSearchParams({
      q: query,
      n: String(options?.limit || 10),
      r: String(options?.rerank ?? true),
    });

    // 添加类型过滤
    if (options?.type && options.type !== 'all') {
      params.set('t', options.type);
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/api/search?${params}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new KhojClientError(
          `搜索失败: ${response.statusText}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      // 重新抛出 KhojClientError
      if (error instanceof KhojClientError) {
        throw error;
      }
      // 包装其他错误
      throw new KhojClientError(
        `搜索请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 对话
   * 与 Khoj AI 进行对话
   * @param message - 用户消息
   * @param options - 对话选项
   * @returns 对话响应或流式响应
   */
  async chat(
    message: string,
    options?: KhojChatOptions
  ): Promise<KhojChatMessage | ReadableStream<Uint8Array>> {
    // 构建请求体
    const body: Record<string, unknown> = {
      q: message,
      stream: options?.stream ?? false,
    };

    // 添加对话 ID
    if (options?.conversationId) {
      body.conversation_id = options.conversationId;
    }

    // 添加 Agent
    if (options?.agent) {
      body.agent = options.agent;
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/api/chat`,
        {
          method: 'POST',
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new KhojClientError(
          `对话失败: ${response.statusText}`,
          response.status
        );
      }

      // 流式响应
      if (options?.stream) {
        if (!response.body) {
          throw new KhojClientError('无法获取流式响应');
        }
        return response.body;
      }

      // 普通响应
      return await response.json();
    } catch (error) {
      if (error instanceof KhojClientError) {
        throw error;
      }
      throw new KhojClientError(
        `对话请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 获取 Agent 列表
   * 获取 Khoj 服务器上可用的 Agent
   * @returns Agent 列表
   */
  async getAgents(): Promise<KhojAgent[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/api/agents`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new KhojClientError(
          `获取 Agent 列表失败: ${response.statusText}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof KhojClientError) {
        throw error;
      }
      throw new KhojClientError(
        `获取 Agent 列表请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 索引文档
   * 将文档上传到 Khoj 进行索引
   * @param content - 文档内容
   * @param filename - 文件名
   * @param metadata - 元数据（可选）
   * @returns 索引结果
   */
  async indexDocument(
    content: string,
    filename: string,
    metadata?: Record<string, unknown>
  ): Promise<KhojIndexResult> {
    try {
      // 创建 FormData
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, filename);

      // 添加元数据
      if (metadata) {
        formData.append('metadata', JSON.stringify(metadata));
      }

      // 构建请求头（不包含 Content-Type，让浏览器自动设置）
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (this.config.apiKey) {
        headers.Authorization = `Bearer ${this.config.apiKey}`;
      }

      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/api/index/update`,
        {
          method: 'POST',
          headers,
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        return {
          success: false,
          error: `索引失败: ${errorText}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `索引请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 删除文档
   * 从 Khoj 索引中删除文档
   * @param filename - 要删除的文件名
   * @returns 是否删除成功
   */
  async deleteDocument(filename: string): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/api/index/delete?filename=${encodeURIComponent(filename)}`,
        {
          method: 'DELETE',
          headers: this.getHeaders(),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('删除文档失败:', error);
      return false;
    }
  }

  /**
   * 获取索引状态
   * 获取 Khoj 知识库的索引状态
   * @returns 索引状态信息
   */
  async getIndexStatus(): Promise<KhojIndexStatus> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/api/index/status`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new KhojClientError(
          `获取索引状态失败: ${response.statusText}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof KhojClientError) {
        throw error;
      }
      throw new KhojClientError(
        `获取索引状态请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 获取已索引文档列表
   * 获取 Khoj 知识库中所有已索引的文档
   * @returns 已索引文档列表
   */
  async getIndexedDocuments(): Promise<KhojIndexedDocument[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/api/content/files`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        // 如果 API 不存在，尝试备用方法
        if (response.status === 404) {
          return this.getIndexedDocumentsFallback();
        }
        throw new KhojClientError(
          `获取文档列表失败: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      // 处理不同的响应格式
      if (Array.isArray(data)) {
        return data.map(this.normalizeDocument);
      }
      
      // 如果返回的是对象，尝试提取文件列表
      if (data.files && Array.isArray(data.files)) {
        return data.files.map(this.normalizeDocument);
      }

      return [];
    } catch (error) {
      if (error instanceof KhojClientError) {
        throw error;
      }
      // 尝试备用方法
      console.warn('获取文档列表失败，尝试备用方法:', error);
      return this.getIndexedDocumentsFallback();
    }
  }

  /**
   * 备用方法：通过搜索获取文档列表
   * 当 /api/content/files 不可用时使用
   */
  private async getIndexedDocumentsFallback(): Promise<KhojIndexedDocument[]> {
    try {
      // 使用空搜索获取所有文档
      const results = await this.search('*', { limit: 100 });
      
      // 从搜索结果中提取唯一文件
      const fileMap = new Map<string, KhojIndexedDocument>();
      
      for (const result of results) {
        const filename = result.additional?.file || result.file;
        if (filename && !fileMap.has(filename)) {
          fileMap.set(filename, {
            filename: filename.split('/').pop() || filename,
            path: filename,
            type: this.detectFileType(filename),
          });
        }
      }

      return Array.from(fileMap.values());
    } catch {
      return [];
    }
  }

  /**
   * 标准化文档数据
   */
  private normalizeDocument = (doc: unknown): KhojIndexedDocument => {
    if (typeof doc === 'string') {
      return {
        filename: doc.split('/').pop() || doc,
        path: doc,
        type: this.detectFileType(doc),
      };
    }
    
    const d = doc as Record<string, unknown>;
    const path = (d.path || d.filename || d.file || '') as string;
    
    return {
      filename: (d.filename || path.split('/').pop() || '') as string,
      path: path,
      type: this.detectFileType(path),
      size: d.size as number | undefined,
      indexed_at: d.indexed_at as string | undefined,
      metadata: d.metadata as Record<string, unknown> | undefined,
    };
  };

  /**
   * 检测文件类型
   */
  private detectFileType(filename: string): KhojIndexedDocument['type'] {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'pdf':
        return 'pdf';
      case 'org':
        return 'org';
      case 'txt':
        return 'text';
      default:
        return 'unknown';
    }
  }

  /**
   * 获取对话历史
   * 获取用户的对话历史列表
   * @returns 对话历史列表
   */
  async getConversations(): Promise<KhojConversation[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/api/conversations`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new KhojClientError(
          `获取对话历史失败: ${response.statusText}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof KhojClientError) {
        throw error;
      }
      throw new KhojClientError(
        `获取对话历史请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 检查连接状态
   * @returns 是否已连接
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * 获取当前配置的服务器 URL
   * @returns 服务器 URL
   */
  get serverUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * 更新配置
   * @param config - 新的配置（部分）
   */
  updateConfig(config: Partial<KhojConfig>): void {
    if (config.baseUrl !== undefined) {
      this.config.baseUrl = config.baseUrl || DEFAULT_KHOJ_URL;
    }
    if (config.timeout !== undefined) {
      this.config.timeout = config.timeout || DEFAULT_TIMEOUT;
    }
    if (config.apiKey !== undefined) {
      this.config.apiKey = config.apiKey;
    }
    if (config.username !== undefined) {
      this.config.username = config.username;
    }
    // 配置更新后重置连接状态
    this.isConnected = false;
  }

  /**
   * 构建请求头
   * @returns HTTP 请求头
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    // 添加认证头
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  /**
   * 带超时的 fetch 请求
   * @param url - 请求 URL
   * @param options - fetch 选项
   * @param timeout - 超时时间（可选，默认使用配置的超时时间）
   * @returns fetch 响应
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout?: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      timeout || this.config.timeout
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ============================================
// 单例管理
// ============================================

/** Khoj 客户端单例实例 */
let khojClientInstance: KhojClient | null = null;

/**
 * 初始化 Khoj 客户端
 * 创建并返回 Khoj 客户端单例
 * @param config - Khoj 配置
 * @returns Khoj 客户端实例
 */
export function initKhojClient(config: KhojConfig): KhojClient {
  khojClientInstance = new KhojClient(config);
  return khojClientInstance;
}

/**
 * 获取 Khoj 客户端
 * 获取已初始化的 Khoj 客户端单例
 * @throws 如果客户端未初始化则抛出错误
 * @returns Khoj 客户端实例
 */
export function getKhojClient(): KhojClient {
  if (!khojClientInstance) {
    throw new KhojClientError('Khoj 客户端未初始化，请先调用 initKhojClient');
  }
  return khojClientInstance;
}

/**
 * 检查 Khoj 客户端是否已初始化
 * @returns 是否已初始化
 */
export function isKhojClientInitialized(): boolean {
  return khojClientInstance !== null;
}

/**
 * 重置 Khoj 客户端
 * 清除单例实例（主要用于测试）
 */
export function resetKhojClient(): void {
  khojClientInstance = null;
}
