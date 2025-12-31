/**
 * Khoj 客户端
 * 封装与 Khoj Server 的所有通信
 * 
 * 功能：
 * - 健康检查
 * - 聊天 API
 * - 搜索 API
 * - Agent 管理
 * - 自动化任务
 * - 文档索引
 */

import axios, { AxiosInstance } from 'axios';
import { serviceRegistry } from './serviceRegistry';

// ============ 类型定义 ============

/**
 * Khoj 聊天消息
 */
export interface KhojChatMessage {
  role: 'user' | 'assistant' | 'khoj';
  message: string;
  context?: string[];
  created: string;
}

/**
 * Khoj 搜索结果
 */
export interface KhojSearchResult {
  entry: string;
  score: number;
  file: string;
  compiled: string;
  additional: {
    file: string;
    heading?: string;
  };
}

/**
 * Khoj Agent
 */
export interface KhojAgent {
  slug: string;
  name: string;
  personality: string;
  avatar?: string;
  tools: string[];
  public: boolean;
}

/**
 * Khoj 自动化任务
 */
export interface KhojAutomation {
  id: string;
  subject: string;
  query_to_run: string;
  scheduling_request: string;
  schedule: string;
  next_run_at: string;
}

/**
 * Khoj 对话
 */
export interface KhojConversation {
  id: string;
  title: string;
  created: string;
}

/**
 * Khoj 索引状态
 */
export interface KhojIndexStatus {
  indexed_files: number;
  last_updated: string;
}

// ============ 错误类 ============

/**
 * Khoj 客户端错误
 */
export class KhojClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'KhojClientError';
  }
}

// ============ 客户端类 ============

/**
 * Khoj 客户端
 * 封装与 Khoj Server 的所有通信
 */
export class KhojClient {
  private client: AxiosInstance;

  constructor() {
    const config = serviceRegistry.getConfig('khoj');
    const baseUrl = config?.baseUrl || 'http://localhost:42110';

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 60000, // 60 秒（AI 响应可能较慢）
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // ============ 健康检查 ============

  /**
   * 检查 Khoj 服务健康状态
   */
  async healthCheck(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.get('/api/health', { timeout: 10000 });
      return { success: response.status === 200, message: 'Khoj 服务正常' };
    } catch (error) {
      return { success: false, message: this.getErrorMessage(error) };
    }
  }

  // ============ 聊天 API ============

  /**
   * 发送聊天消息（非流式）
   */
  async chat(
    message: string,
    conversationId: string,
    agentSlug?: string
  ): Promise<{ response: string }> {
    try {
      // Khoj API 使用 POST 方法，参数通过 query string 传递
      const params = new URLSearchParams({
        stream: 'false',
        client: 'web',
      });

      const response = await this.client.post(`/api/chat?${params}`, {
        q: message,
        conversation_id: conversationId,
        ...(agentSlug && { agent: agentSlug }),
      });
      return response.data;
    } catch (error) {
      throw new KhojClientError('聊天请求失败', undefined, error as Error);
    }
  }

  /**
   * 发送聊天消息（流式）
   * 返回可读流，用于 SSE 响应
   */
  async chatStream(
    message: string,
    conversationId: string,
    agentSlug?: string
  ): Promise<NodeJS.ReadableStream> {
    try {
      // Khoj API 使用 POST 方法，参数通过 request body 传递
      const params = new URLSearchParams({
        stream: 'true',
        client: 'web',
      });

      const response = await this.client.post(
        `/api/chat?${params}`,
        {
          q: message,
          conversation_id: conversationId,
          ...(agentSlug && { agent: agentSlug }),
        },
        {
          responseType: 'stream',
        }
      );

      return response.data;
    } catch (error) {
      throw new KhojClientError('聊天流请求失败', undefined, error as Error);
    }
  }

  /**
   * 获取对话历史列表
   */
  async getConversations(): Promise<KhojConversation[]> {
    try {
      const response = await this.client.get('/api/chat/sessions');
      return response.data;
    } catch (error) {
      throw new KhojClientError('获取对话历史失败', undefined, error as Error);
    }
  }

  /**
   * 获取单个对话详情
   */
  async getConversation(id: string): Promise<KhojChatMessage[]> {
    try {
      const response = await this.client.get(`/api/chat/session/${id}`);
      return response.data;
    } catch (error) {
      throw new KhojClientError('获取对话失败', undefined, error as Error);
    }
  }

  /**
   * 创建新对话
   */
  async createConversation(agentSlug?: string): Promise<{ conversation_id: string }> {
    try {
      const params = new URLSearchParams({ client: 'web' });
      if (agentSlug) params.set('agent_slug', agentSlug);
      
      const response = await this.client.post(`/api/chat/sessions?${params}`);
      return response.data;
    } catch (error) {
      throw new KhojClientError('创建对话失败', undefined, error as Error);
    }
  }

  /**
   * 删除对话
   */
  async deleteConversation(id: string): Promise<void> {
    try {
      await this.client.delete(`/api/chat/session/${id}`);
    } catch (error) {
      throw new KhojClientError('删除对话失败', undefined, error as Error);
    }
  }

  // ============ 搜索 API ============

  /**
   * 语义搜索
   */
  async search(
    query: string,
    options?: {
      type?: 'all' | 'org' | 'markdown' | 'pdf';
      limit?: number;
      rerank?: boolean;
    }
  ): Promise<KhojSearchResult[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        n: String(options?.limit || 10),
        r: String(options?.rerank ?? true),
      });
      if (options?.type && options.type !== 'all') {
        params.set('t', options.type);
      }

      const response = await this.client.get(`/api/search?${params}`);
      return response.data;
    } catch (error) {
      throw new KhojClientError('搜索失败', undefined, error as Error);
    }
  }

  // ============ Agent API ============

  /**
   * 获取 Agent 列表
   */
  async getAgents(): Promise<KhojAgent[]> {
    try {
      const response = await this.client.get('/api/agents');
      return response.data;
    } catch (error) {
      throw new KhojClientError('获取 Agent 列表失败', undefined, error as Error);
    }
  }

  /**
   * 获取单个 Agent
   */
  async getAgent(slug: string): Promise<KhojAgent> {
    try {
      const response = await this.client.get(`/api/agents/${slug}`);
      return response.data;
    } catch (error) {
      throw new KhojClientError('获取 Agent 失败', undefined, error as Error);
    }
  }

  /**
   * 创建 Agent
   */
  async createAgent(data: Partial<KhojAgent>): Promise<KhojAgent> {
    try {
      const response = await this.client.post('/api/agents', data);
      return response.data;
    } catch (error) {
      throw new KhojClientError('创建 Agent 失败', undefined, error as Error);
    }
  }

  /**
   * 更新 Agent
   */
  async updateAgent(slug: string, data: Partial<KhojAgent>): Promise<KhojAgent> {
    try {
      const response = await this.client.patch(`/api/agents/${slug}`, data);
      return response.data;
    } catch (error) {
      throw new KhojClientError('更新 Agent 失败', undefined, error as Error);
    }
  }

  /**
   * 删除 Agent
   */
  async deleteAgent(slug: string): Promise<void> {
    try {
      await this.client.delete(`/api/agents/${slug}`);
    } catch (error) {
      throw new KhojClientError('删除 Agent 失败', undefined, error as Error);
    }
  }

  // ============ 自动化 API ============

  /**
   * 获取自动化任务列表
   */
  async getAutomations(): Promise<KhojAutomation[]> {
    try {
      const response = await this.client.get('/api/automations');
      return response.data;
    } catch (error) {
      throw new KhojClientError('获取自动化任务失败', undefined, error as Error);
    }
  }

  /**
   * 创建自动化任务
   */
  async createAutomation(data: Partial<KhojAutomation>): Promise<KhojAutomation> {
    try {
      const response = await this.client.post('/api/automations', data);
      return response.data;
    } catch (error) {
      throw new KhojClientError('创建自动化任务失败', undefined, error as Error);
    }
  }

  /**
   * 删除自动化任务
   */
  async deleteAutomation(id: string): Promise<void> {
    try {
      await this.client.delete(`/api/automations/${id}`);
    } catch (error) {
      throw new KhojClientError('删除自动化任务失败', undefined, error as Error);
    }
  }

  // ============ 索引 API ============

  /**
   * 索引文档
   */
  async indexDocument(content: string, filename: string): Promise<{ success: boolean }> {
    try {
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, filename);

      const response = await this.client.post('/api/index/update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { success: response.status === 200 };
    } catch (error) {
      throw new KhojClientError('索引文档失败', undefined, error as Error);
    }
  }

  /**
   * 获取索引状态
   */
  async getIndexStatus(): Promise<KhojIndexStatus> {
    try {
      const response = await this.client.get('/api/index/status');
      return response.data;
    } catch (error) {
      throw new KhojClientError('获取索引状态失败', undefined, error as Error);
    }
  }

  // ============ 私有方法 ============

  /**
   * 获取错误消息
   */
  private getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') return '无法连接到 Khoj 服务';
      if (error.code === 'ETIMEDOUT') return '连接 Khoj 超时';
      return error.message;
    }
    return error instanceof Error ? error.message : '未知错误';
  }
}

// ============ 单例导出 ============

let khojClientInstance: KhojClient | null = null;

/**
 * 获取 Khoj 客户端单例
 */
export function getKhojClient(): KhojClient {
  if (!khojClientInstance) {
    khojClientInstance = new KhojClient();
  }
  return khojClientInstance;
}
