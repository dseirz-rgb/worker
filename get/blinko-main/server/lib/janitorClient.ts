/**
 * Janitor API 客户端
 * 连接 Echo Janitor 服务（基于 LlamaFS）
 * 
 * Janitor 功能：
 * - AI 驱动的文件分类和重命名
 * - 批量处理和实时监控
 * - 操作历史和撤销功能
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// ============ 类型定义 ============

export interface JanitorConfig {
  baseUrl: string;  // 默认 http://localhost:8000
}

// ============ 完整配置类型 ============

// Groq API 配置
export interface GroqConfig {
  model: string;
}

// Ollama 本地模型配置
export interface OllamaConfig {
  host: string;
  model: string;
}

// SeekDB 配置
export interface SeekDBConfig {
  auto_index: boolean;
}

// 单个分类配置
export interface CategoryConfig {
  id?: string;
  name?: string;
  path: string;
  keywords: string[];
  color?: string;
}

// Janitor 完整配置
export interface JanitorFullConfig {
  groq: GroqConfig;
  ollama: OllamaConfig;
  inbox_dirs: string[];
  output_base: string;
  confidence_threshold: number;
  categories: Record<string, CategoryConfig>;
  seekdb: SeekDBConfig;
}

// 路径验证结果
export interface PathValidationResult {
  path: string;
  expanded_path: string;
  exists: boolean;
  is_dir: boolean;
  is_file: boolean;
  is_writable: boolean;
  parent_exists: boolean;
}

// 文件分类建议
export interface FileSuggestion {
  src_path: string;      // 原始路径（相对于 base_path）
  dst_path: string;      // 建议的目标路径
  category: string;      // 分类类别
  confidence: number;    // 置信度 0-1
  reason: string;        // 分类原因
  summary: string;       // 文件摘要
}

// 提交请求
export interface CommitRequest {
  base_path: string;
  src_path: string;
  dst_path: string;
  category?: string;
  confidence?: number;
  reason?: string;
}

// 操作历史记录
export interface HistoryRecord {
  timestamp: string;
  src_path: string;
  dst_path: string;
  original_name: string;
  new_name: string;
  category: string;
  confidence: number;
  reason: string;
}

// 撤销结果
export interface UndoResult {
  success: boolean;
  src_path: string;
  dst_path: string;
  error?: string;
}

// ============ 错误类 ============

export class JanitorError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'JanitorError';
  }
}

// ============ 客户端类 ============

export class JanitorClient {
  private client: AxiosInstance;

  constructor(config: JanitorConfig) {
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 秒超时（AI 处理可能较慢）
    });
  }

  // ============ 私有方法 ============

  private handleError(error: unknown, operation: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      
      if (status === 400) {
        const data = axiosError.response?.data as { detail?: string };
        throw new JanitorError(data?.detail || '请求参数错误', status, error);
      }
      if (status === 500) {
        throw new JanitorError('Janitor 服务器错误', status, error);
      }
      if (axiosError.code === 'ECONNREFUSED') {
        throw new JanitorError('无法连接到 Janitor 服务', undefined, error);
      }
      if (axiosError.code === 'ETIMEDOUT') {
        throw new JanitorError('连接 Janitor 超时', undefined, error);
      }
      
      throw new JanitorError(
        `${operation} 失败: ${axiosError.message}`,
        status,
        error
      );
    }
    
    throw new JanitorError(
      `${operation} 失败: ${error instanceof Error ? error.message : '未知错误'}`,
      undefined,
      error instanceof Error ? error : undefined
    );
  }

  // ============ 核心操作 ============

  /**
   * 批量分析目录中的文件
   * 返回 AI 建议的分类和重命名方案
   */
  async analyzeDirectory(
    path: string, 
    instruction?: string
  ): Promise<FileSuggestion[]> {
    try {
      const response = await this.client.post('/batch', {
        path,
        instruction,
        incognito: false,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, '分析目录');
    }
  }

  /**
   * 提交单个文件移动操作
   */
  async commitMove(request: CommitRequest): Promise<{ message: string }> {
    try {
      const response = await this.client.post('/commit', request);
      return response.data;
    } catch (error) {
      this.handleError(error, '提交移动');
    }
  }

  /**
   * 批量提交文件移动
   */
  async commitBatch(
    basePath: string, 
    suggestions: FileSuggestion[]
  ): Promise<{ success: number; failed: number; results: Array<{ success: boolean; error?: string }> }> {
    const results: Array<{ success: boolean; error?: string }> = [];
    
    for (const suggestion of suggestions) {
      try {
        await this.commitMove({
          base_path: basePath,
          src_path: suggestion.src_path,
          dst_path: suggestion.dst_path,
          category: suggestion.category,
          confidence: suggestion.confidence,
          reason: suggestion.reason,
        });
        results.push({ success: true });
      } catch (error) {
        results.push({ 
          success: false, 
          error: error instanceof Error ? error.message : '未知错误' 
        });
      }
    }
    
    return {
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  /**
   * 获取操作历史
   */
  async getHistory(limit: number = 100): Promise<{
    count: number;
    records: HistoryRecord[];
  }> {
    try {
      const response = await this.client.get('/history', {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      this.handleError(error, '获取历史');
    }
  }

  /**
   * 撤销最近的操作
   */
  async undoLast(count: number = 1): Promise<{
    total: number;
    success: number;
    failed: number;
    results: UndoResult[];
  }> {
    try {
      const response = await this.client.post('/undo', { count });
      return response.data;
    } catch (error) {
      this.handleError(error, '撤销操作');
    }
  }

  /**
   * 撤销指定时间之后的所有操作
   */
  async undoSince(timestamp: string): Promise<{
    total: number;
    success: number;
    failed: number;
    results: UndoResult[];
  }> {
    try {
      const response = await this.client.post('/undo', { since: timestamp });
      return response.data;
    } catch (error) {
      this.handleError(error, '撤销操作');
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
          throw new JanitorError('无法连接到 Janitor 服务，请检查服务是否启动', undefined, error);
        }
      }
      throw new JanitorError('连接测试失败', undefined, error instanceof Error ? error : undefined);
    }
  }

  /**
   * 获取服务状态
   */
  async getHealth(): Promise<{
    status: string;
    service: string;
    version: string;
  }> {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      this.handleError(error, '获取服务状态');
    }
  }

  // ============ 配置管理 ============

  /**
   * 获取完整配置
   */
  async getFullConfig(): Promise<JanitorFullConfig> {
    try {
      const response = await this.client.get('/config');
      return response.data;
    } catch (error) {
      this.handleError(error, '获取配置');
    }
  }

  /**
   * 更新配置
   * 注意：服务端期望的是扁平化的字段名，如 groq_model 而不是 groq.model
   */
  async updateConfig(config: Partial<JanitorFullConfig>): Promise<JanitorFullConfig> {
    try {
      // 转换为服务端期望的格式
      const requestData: Record<string, unknown> = {};
      
      if (config.inbox_dirs !== undefined) {
        requestData.inbox_dirs = config.inbox_dirs;
      }
      if (config.output_base !== undefined) {
        requestData.output_base = config.output_base;
      }
      if (config.confidence_threshold !== undefined) {
        requestData.confidence_threshold = config.confidence_threshold;
      }
      if (config.groq?.model !== undefined) {
        requestData.groq_model = config.groq.model;
      }
      if (config.ollama?.host !== undefined) {
        requestData.ollama_host = config.ollama.host;
      }
      if (config.ollama?.model !== undefined) {
        requestData.ollama_model = config.ollama.model;
      }
      if (config.seekdb?.auto_index !== undefined) {
        requestData.seekdb_auto_index = config.seekdb.auto_index;
      }
      
      const response = await this.client.post('/config', requestData);
      return response.data;
    } catch (error) {
      this.handleError(error, '更新配置');
    }
  }

  /**
   * 验证单个路径
   */
  async validatePath(path: string): Promise<PathValidationResult> {
    try {
      const response = await this.client.post('/config/validate-path', { path });
      return response.data;
    } catch (error) {
      this.handleError(error, '验证路径');
    }
  }

  /**
   * 批量验证路径
   */
  async validatePaths(paths: string[]): Promise<PathValidationResult[]> {
    try {
      const response = await this.client.post('/config/validate-paths', { paths });
      return response.data;
    } catch (error) {
      this.handleError(error, '批量验证路径');
    }
  }

  // ============ 分类管理 ============

  /**
   * 获取所有分类
   */
  async getCategories(): Promise<Record<string, CategoryConfig>> {
    try {
      const response = await this.client.get('/config/categories');
      // 服务端返回 { count, categories: [...] }，需要转换为 Record 格式
      const data = response.data;
      if (data.categories && Array.isArray(data.categories)) {
        const result: Record<string, CategoryConfig> = {};
        for (const cat of data.categories) {
          result[cat.id] = cat;
        }
        return result;
      }
      return data;
    } catch (error) {
      this.handleError(error, '获取分类');
    }
  }

  /**
   * 添加分类
   */
  async addCategory(categoryId: string, category: CategoryConfig): Promise<CategoryConfig> {
    try {
      const response = await this.client.post('/config/categories', {
        id: categoryId,
        name: category.name,
        path: category.path,
        keywords: category.keywords || [],
        color: category.color || '#808080',
      });
      return response.data.category || response.data;
    } catch (error) {
      this.handleError(error, '添加分类');
    }
  }

  /**
   * 更新分类
   */
  async updateCategory(categoryId: string, updates: Partial<CategoryConfig>): Promise<CategoryConfig> {
    try {
      const response = await this.client.put(`/config/categories/${categoryId}`, updates);
      return response.data.category || response.data;
    } catch (error) {
      this.handleError(error, '更新分类');
    }
  }

  /**
   * 删除分类
   */
  async deleteCategory(categoryId: string): Promise<{ success: boolean }> {
    try {
      const response = await this.client.delete(`/config/categories/${categoryId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, '删除分类');
    }
  }
}

// ============ 工厂函数 ============

/**
 * 创建 Janitor 客户端实例
 */
export function createJanitorClient(config: JanitorConfig): JanitorClient {
  if (!config.baseUrl) {
    throw new JanitorError('Janitor URL 未配置');
  }
  return new JanitorClient(config);
}

// 默认配置
export const DEFAULT_JANITOR_CONFIG: JanitorConfig = {
  baseUrl: process.env.JANITOR_API_URL || 'http://localhost:8766',
};
