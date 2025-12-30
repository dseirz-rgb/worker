/**
 * 统一搜索服务
 * 整合 Echo 本地搜索和 Khoj 语义搜索能力
 * 
 * 设计原则：
 * 1. 统一接口 - 提供一致的搜索体验，无论数据来源
 * 2. 优雅降级 - Khoj 不可用时自动回退到本地搜索
 * 3. 并行查询 - 同时查询多个数据源，提高响应速度
 */

import { 
  getKhojClient, 
  isKhojClientInitialized,
  KhojClientError 
} from '../khoj/khojClient';
import { searchMemories, type MemorySearchResult } from '../memory';
import type { KhojSearchResult } from '../../types/khoj';
import type { LifeDomain } from '../../types/database';

// ============================================
// 类型定义
// ============================================

/**
 * 统一搜索结果
 * 标准化来自不同数据源的搜索结果
 */
export interface UnifiedSearchResult {
  /** 结果唯一标识 */
  id: string;
  /** 搜索到的内容 */
  content: string;
  /** 相关性分数 (0-1) */
  score: number;
  /** 数据来源 */
  source: 'echo' | 'khoj';
  /** 内容类型 */
  type: 'note' | 'task' | 'memory' | 'document';
  /** 附加元数据 */
  metadata: {
    /** 原始来源 ID */
    sourceId?: string;
    /** 文件路径（Khoj 结果） */
    filePath?: string;
    /** 标题 */
    title?: string;
    /** 分类 */
    category?: string;
    /** 关键词 */
    keywords?: string[];
    /** 生命领域 */
    domain?: LifeDomain;
    /** 创建时间 */
    createdAt?: string;
  };
}

/**
 * 统一搜索选项
 * 控制搜索行为和结果过滤
 */
export interface UnifiedSearchOptions {
  /** 要搜索的数据源 */
  sources?: ('echo' | 'khoj')[];
  /** 要搜索的内容类型 */
  types?: ('note' | 'task' | 'memory' | 'document')[];
  /** 返回结果数量限制 */
  limit?: number;
  /** 生命领域过滤 */
  domain?: LifeDomain;
}

/** 默认搜索选项 */
const DEFAULT_OPTIONS: Required<UnifiedSearchOptions> = {
  sources: ['echo', 'khoj'],
  types: ['note', 'task', 'memory', 'document'],
  limit: 10,
  domain: undefined as unknown as LifeDomain,
};

// ============================================
// 统一搜索服务类
// ============================================

/**
 * 统一搜索服务
 * 整合多个数据源的搜索能力
 */
export class UnifiedSearchService {
  /** Khoj 是否可用 */
  private khojAvailable: boolean = false;
  
  /** 上次 Khoj 健康检查时间 */
  private lastHealthCheck: number = 0;
  
  /** 健康检查间隔（毫秒） */
  private readonly healthCheckInterval = 60000; // 1 分钟

  /**
   * 统一搜索
   * 并行查询 Echo 和 Khoj，合并排序结果
   * 
   * @param query - 搜索查询文本
   * @param options - 搜索选项
   * @returns 统一搜索结果列表
   */
  async search(
    query: string,
    options?: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // 确定要查询的数据源
    const sources = opts.sources || ['echo', 'khoj'];
    const searchPromises: Promise<UnifiedSearchResult[]>[] = [];

    // 并行发起搜索请求
    if (sources.includes('echo')) {
      searchPromises.push(
        this.searchEcho(query, opts).catch(error => {
          console.warn('Echo 搜索失败:', error);
          return [];
        })
      );
    }

    if (sources.includes('khoj')) {
      searchPromises.push(
        this.searchKhoj(query, opts).catch(error => {
          console.warn('Khoj 搜索失败，降级到本地搜索:', error);
          return [];
        })
      );
    }

    // 等待所有搜索完成
    const results = await Promise.all(searchPromises);
    
    // 合并并排序结果
    const allResults = results.flat();
    return this.mergeAndRank(allResults, opts.limit);
  }

  /**
   * Echo 本地搜索
   * 搜索本地记忆数据库
   * 
   * @param query - 搜索查询文本
   * @param options - 搜索选项
   * @returns Echo 搜索结果
   */
  async searchEcho(
    query: string,
    options?: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    try {
      // 调用记忆搜索服务
      const memoryResults = await searchMemories(query, {
        domain: opts.domain,
        limit: opts.limit,
      });

      // 转换为统一格式
      return memoryResults.map(result => this.convertMemoryResult(result));
    } catch (error) {
      console.error('Echo 本地搜索失败:', error);
      return [];
    }
  }

  /**
   * Khoj 搜索
   * 调用 Khoj 服务进行语义搜索
   * 
   * @param query - 搜索查询文本
   * @param options - 搜索选项
   * @returns Khoj 搜索结果
   */
  async searchKhoj(
    query: string,
    options?: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // 检查 Khoj 是否可用
    const isAvailable = await this.checkKhojAvailability();
    if (!isAvailable) {
      console.warn('Khoj 服务不可用，跳过 Khoj 搜索');
      return [];
    }

    try {
      const client = getKhojClient();
      
      // 调用 Khoj 搜索 API
      const khojResults = await client.search(query, {
        limit: opts.limit,
        rerank: true,
      });

      // 转换为统一格式
      return khojResults.map(result => this.convertKhojResult(result));
    } catch (error) {
      // 处理 Khoj 错误
      if (error instanceof KhojClientError) {
        console.warn(`Khoj 搜索错误 [${error.statusCode}]:`, error.message);
      } else {
        console.error('Khoj 搜索失败:', error);
      }
      
      // 标记 Khoj 不可用
      this.khojAvailable = false;
      return [];
    }
  }

  /**
   * 合并并排序结果
   * 根据相关性分数对结果进行排序和去重
   * 
   * @param results - 所有搜索结果
   * @param limit - 返回数量限制
   * @returns 排序后的结果
   */
  mergeAndRank(
    results: UnifiedSearchResult[],
    limit: number = 10
  ): UnifiedSearchResult[] {
    // 去重：基于内容相似度
    const uniqueResults = this.deduplicateResults(results);
    
    // 按分数降序排序
    const sortedResults = uniqueResults.sort((a, b) => b.score - a.score);
    
    // 限制返回数量
    return sortedResults.slice(0, limit);
  }

  /**
   * 检查 Khoj 可用性
   * 带缓存的健康检查
   */
  private async checkKhojAvailability(): Promise<boolean> {
    // 检查客户端是否已初始化
    if (!isKhojClientInitialized()) {
      return false;
    }

    // 检查是否需要重新进行健康检查
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.khojAvailable;
    }

    // 执行健康检查
    try {
      const client = getKhojClient();
      this.khojAvailable = await client.healthCheck();
      this.lastHealthCheck = now;
      return this.khojAvailable;
    } catch (error) {
      console.warn('Khoj 健康检查失败:', error);
      this.khojAvailable = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * 转换 Memory 搜索结果为统一格式
   */
  private convertMemoryResult(result: MemorySearchResult): UnifiedSearchResult {
    const { item, relevance } = result;
    
    return {
      id: `echo_${item.id}`,
      content: item.summary,
      score: relevance,
      source: 'echo',
      type: this.mapSourceTypeToType(item.sourceType),
      metadata: {
        sourceId: item.sourceId,
        category: item.category,
        keywords: item.keywords,
        domain: item.domain,
        createdAt: item.createdAt,
      },
    };
  }

  /**
   * 转换 Khoj 搜索结果为统一格式
   */
  private convertKhojResult(result: KhojSearchResult): UnifiedSearchResult {
    // 生成唯一 ID
    const id = `khoj_${this.hashString(result.file + result.entry)}`;
    
    return {
      id,
      content: result.entry,
      score: this.normalizeKhojScore(result.score),
      source: 'khoj',
      type: this.inferTypeFromFile(result.file),
      metadata: {
        filePath: result.file,
        title: result.additional?.heading,
      },
    };
  }

  /**
   * 映射 sourceType 到统一类型
   */
  private mapSourceTypeToType(
    sourceType: 'note' | 'task' | 'conversation' | 'activity'
  ): 'note' | 'task' | 'memory' | 'document' {
    switch (sourceType) {
      case 'note':
        return 'note';
      case 'task':
        return 'task';
      case 'conversation':
      case 'activity':
        return 'memory';
      default:
        return 'memory';
    }
  }

  /**
   * 从文件路径推断内容类型
   */
  private inferTypeFromFile(filePath: string): 'note' | 'task' | 'memory' | 'document' {
    const lowerPath = filePath.toLowerCase();
    
    if (lowerPath.includes('note') || lowerPath.endsWith('.md')) {
      return 'note';
    }
    if (lowerPath.includes('task') || lowerPath.includes('todo')) {
      return 'task';
    }
    if (lowerPath.endsWith('.pdf') || lowerPath.endsWith('.doc') || lowerPath.endsWith('.docx')) {
      return 'document';
    }
    
    return 'document';
  }

  /**
   * 标准化 Khoj 分数到 0-1 范围
   * Khoj 返回的分数可能超出 0-1 范围
   */
  private normalizeKhojScore(score: number): number {
    // Khoj 分数通常在 0-1 范围，但可能有例外
    // 使用 sigmoid 函数进行标准化
    if (score >= 0 && score <= 1) {
      return score;
    }
    
    // 对于超出范围的分数，使用 sigmoid 标准化
    return 1 / (1 + Math.exp(-score));
  }

  /**
   * 结果去重
   * 基于内容相似度去除重复结果
   */
  private deduplicateResults(results: UnifiedSearchResult[]): UnifiedSearchResult[] {
    const seen = new Map<string, UnifiedSearchResult>();
    
    for (const result of results) {
      // 使用内容的前 100 个字符作为去重键
      const key = result.content.slice(0, 100).toLowerCase().trim();
      
      // 如果已存在相似内容，保留分数更高的
      const existing = seen.get(key);
      if (!existing || result.score > existing.score) {
        seen.set(key, result);
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * 简单字符串哈希
   * 用于生成唯一 ID
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为 32 位整数
    }
    return Math.abs(hash).toString(36);
  }
}

// ============================================
// 单例导出
// ============================================

/** 统一搜索服务单例 */
export const unifiedSearchService = new UnifiedSearchService();
