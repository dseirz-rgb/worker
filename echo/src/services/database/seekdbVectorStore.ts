/**
 * SeekDB 向量存储适配器
 * 
 * 实现与 Blinko LibSQLVector 兼容的接口，
 * 通过 Python Sidecar 与 ChromaDB/SeekDB 通信。
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */

import { seekdbService, SearchResult } from './seekdbService';

// ============== 类型定义 ==============

/** 向量存储配置 */
export interface SeekDBVectorConfig {
  /** Sidecar 服务地址 */
  baseUrl?: string;
  /** 默认向量维度 (fastembed all-MiniLM-L6-v2 = 384) */
  dimension?: number;
  /** 默认索引名称 */
  defaultIndexName?: string;
}

/** 向量文档 */
export interface VectorDocument {
  /** 文档 ID */
  id: string;
  /** 文档内容 */
  content: string;
  /** 向量嵌入 (可选，由 sidecar 自动生成) */
  embedding?: number[];
  /** 元数据 */
  metadata: Record<string, unknown>;
}

/** 查询参数 (Blinko 兼容) */
export interface QueryParams {
  /** 索引名称 */
  indexName: string;
  /** 查询向量 */
  queryVector: number[];
  /** 返回结果数量 */
  topK: number;
  /** 过滤条件 */
  filter?: Record<string, unknown>;
}

/** 查询结果 */
export interface QueryResult {
  /** 文档 ID */
  id: string;
  /** 相似度分数 */
  score: number;
  /** 元数据 */
  metadata: Record<string, unknown>;
}

/** Upsert 参数 (Blinko 兼容) */
export interface UpsertParams {
  /** 索引名称 */
  indexName: string;
  /** 向量数组 */
  vectors: number[][];
  /** 元数据数组 */
  metadata: Array<Record<string, unknown>>;
  /** 文档 ID 数组 (可选) */
  ids?: string[];
}

/** 创建索引参数 */
export interface CreateIndexParams {
  /** 索引名称 */
  indexName: string;
  /** 向量维度 */
  dimension: number;
  /** 距离度量 */
  metric?: 'cosine' | 'l2' | 'ip';
}

/** 删除索引参数 */
export interface DeleteIndexParams {
  /** 索引名称 */
  indexName: string;
}

/** 截断索引参数 */
export interface TruncateIndexParams {
  /** 索引名称 */
  indexName: string;
}

// ============== SeekDB 向量存储类 ==============

/**
 * SeekDB 向量存储适配器
 * 
 * 提供与 Blinko LibSQLVector 兼容的接口，
 * 底层通过 HTTP 调用 Python Sidecar 服务。
 */
export class SeekDBVectorStore {
  private config: Required<SeekDBVectorConfig>;
  private initialized: boolean = false;
  private indexes: Map<string, { dimension: number; metric: string }> = new Map();

  constructor(config: SeekDBVectorConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:8765',
      dimension: config.dimension || 384,
      defaultIndexName: config.defaultIndexName || 'blinko',
    };
  }

  // ============== 初始化 ==============

  /**
   * 初始化向量存储
   * 检查 sidecar 服务是否可用
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const isHealthy = await seekdbService.healthCheck();
    if (!isHealthy) {
      throw new Error('SeekDB Sidecar 服务不可用');
    }

    // 获取现有集合
    const collections = await seekdbService.listCollections();
    for (const col of collections) {
      this.indexes.set(col.name, {
        dimension: this.config.dimension,
        metric: 'cosine',
      });
    }

    this.initialized = true;
    console.log('[SeekDBVectorStore] 初始化完成');
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // ============== 索引管理 (Blinko 兼容) ==============

  /**
   * 创建向量索引
   * 
   * @param params 创建参数
   */
  async createIndex(params: CreateIndexParams): Promise<void> {
    await this.ensureInitialized();

    const { indexName, dimension, metric = 'cosine' } = params;

    await seekdbService.createIndex({
      indexName,
      dimension,
      metric,
    });

    this.indexes.set(indexName, { dimension, metric });
    console.log(`[SeekDBVectorStore] 索引 '${indexName}' 已创建 (维度: ${dimension}, 度量: ${metric})`);
  }

  /**
   * 删除向量索引
   * 
   * @param params 删除参数
   */
  async deleteIndex(params: DeleteIndexParams): Promise<void> {
    await this.ensureInitialized();

    const { indexName } = params;

    await seekdbService.deleteIndex({ indexName });
    this.indexes.delete(indexName);
    console.log(`[SeekDBVectorStore] 索引 '${indexName}' 已删除`);
  }

  /**
   * 清空向量索引
   * 
   * @param params 截断参数
   */
  async truncateIndex(params: TruncateIndexParams): Promise<void> {
    await this.ensureInitialized();

    const { indexName } = params;

    await seekdbService.truncateIndex({ indexName });
    console.log(`[SeekDBVectorStore] 索引 '${indexName}' 已清空`);
  }

  // ============== 向量操作 (Blinko 兼容) ==============

  /**
   * 插入或更新向量
   * 
   * @param params Upsert 参数
   */
  async upsert(params: UpsertParams): Promise<void> {
    await this.ensureInitialized();

    const { indexName, vectors, metadata, ids } = params;

    await seekdbService.vectorUpsert({
      indexName,
      vectors,
      metadata,
      ids,
    });
  }

  /**
   * 删除向量
   * 
   * @param indexName 索引名称
   * @param ids 要删除的文档 ID 数组
   */
  async delete(indexName: string, ids: string[]): Promise<void> {
    await this.ensureInitialized();

    await seekdbService.vectorDelete(indexName, ids);
  }

  /**
   * 向量相似度查询 (Blinko 兼容接口)
   * 
   * @param params 查询参数
   * @returns 查询结果数组
   */
  async query(params: QueryParams): Promise<QueryResult[]> {
    await this.ensureInitialized();

    const { indexName, queryVector, topK, filter } = params;

    const results = await seekdbService.vectorQuery({
      indexName,
      queryVector,
      topK,
      filter,
    });

    return results.map((r: SearchResult) => ({
      id: r.id,
      score: r.score,
      metadata: r.metadata,
    }));
  }

  /**
   * 文本相似度搜索
   * 
   * @param indexName 索引名称
   * @param queryText 查询文本
   * @param topK 返回结果数量
   * @param filter 过滤条件
   * @returns 查询结果数组
   */
  async similaritySearch(
    indexName: string,
    queryText: string,
    topK: number,
    filter?: Record<string, unknown>
  ): Promise<QueryResult[]> {
    await this.ensureInitialized();

    // 使用文本搜索 API
    const results = await seekdbService.search({
      query: queryText,
      collection: this.mapIndexToCollection(indexName),
      limit: topK,
      domain: filter?.domain as string,
      searchType: 'hybrid',
    });

    return results.map((r: SearchResult) => ({
      id: r.id,
      score: r.score,
      metadata: r.metadata,
    }));
  }

  /**
   * 混合搜索 (向量 + 全文 + SQL)
   * 
   * @param params 搜索参数
   * @returns 查询结果数组
   */
  async hybridSearch(params: {
    indexName: string;
    queryVector?: number[];
    queryText?: string;
    sqlFilter?: string;
    topK: number;
  }): Promise<QueryResult[]> {
    await this.ensureInitialized();

    const { indexName, queryVector, queryText, topK } = params;

    // 优先使用向量查询
    if (queryVector && queryVector.length > 0) {
      return this.query({
        indexName,
        queryVector,
        topK,
      });
    }

    // 回退到文本搜索
    const results = await seekdbService.hybridSearch({
      query: queryText || '',
      collection: this.mapIndexToCollection(indexName),
      limit: topK,
    });

    return results.map((r: SearchResult) => ({
      id: r.id,
      score: r.score,
      metadata: r.metadata,
    }));
  }

  // ============== 辅助方法 ==============

  /**
   * 将索引名称映射到 collection 名称
   */
  private mapIndexToCollection(indexName: string): string {
    const mapping: Record<string, string> = {
      blinko: 'notes',
      memories: 'memories',
      tasks: 'tasks',
    };
    return mapping[indexName] || indexName;
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }
}

// ============== 单例导出 ==============

let vectorStoreInstance: SeekDBVectorStore | null = null;

/**
 * 获取 SeekDB 向量存储实例
 */
export function getSeekDBVectorStore(config?: SeekDBVectorConfig): SeekDBVectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new SeekDBVectorStore(config);
  }
  return vectorStoreInstance;
}

/**
 * 重置向量存储实例 (用于测试)
 */
export function resetSeekDBVectorStore(): void {
  vectorStoreInstance = null;
}

export default SeekDBVectorStore;
