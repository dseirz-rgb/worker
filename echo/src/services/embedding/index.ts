/**
 * fastembed-rs 本地嵌入服务 TypeScript 绑定
 * 
 * 封装 Tauri invoke 调用，提供类型安全的嵌入 API。
 * 使用 all-MiniLM-L6-v2 模型，生成 384 维向量。
 * 
 * **Validates: Requirements 2.1**
 */

import { invoke } from '@tauri-apps/api/core';

// ============== 类型定义 ==============

/** 嵌入配置 */
export interface EmbeddingConfig {
  /** 模型名称 (默认 "all-MiniLM-L6-v2") */
  modelName?: string;
  /** 模型缓存目录 */
  cacheDir?: string;
  /** 是否显示下载进度 */
  showDownloadProgress?: boolean;
}

/** 嵌入结果 */
export interface EmbeddingResult {
  /** 向量数组 */
  embedding: number[];
  /** 向量维度 */
  dimension: number;
  /** 模型名称 */
  model: string;
}

/** 批量嵌入结果 */
export interface BatchEmbeddingResult {
  /** 向量数组列表 */
  embeddings: number[][];
  /** 向量维度 */
  dimension: number;
  /** 模型名称 */
  model: string;
  /** 处理的文本数量 */
  count: number;
}

/** 嵌入服务状态 */
export interface EmbeddingServiceStatus {
  /** 是否已初始化 */
  isInitialized: boolean;
  /** 模型是否已加载 */
  modelLoaded: boolean;
  /** 模型名称 */
  modelName: string;
  /** 向量维度 */
  dimension: number;
}

// ============== 常量 ==============

/** 默认向量维度 (all-MiniLM-L6-v2) */
export const EMBEDDING_DIMENSION = 384;

/** 默认模型名称 */
export const DEFAULT_MODEL = 'all-MiniLM-L6-v2';

// ============== 服务类 ==============

/**
 * 嵌入服务类
 * 
 * 提供本地文本向量嵌入功能，完全离线工作。
 */
export class EmbeddingService {
  private initialized: boolean = false;
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig = {}) {
    this.config = {
      modelName: config.modelName || DEFAULT_MODEL,
      showDownloadProgress: config.showDownloadProgress ?? true,
      cacheDir: config.cacheDir,
    };
  }

  /**
   * 初始化嵌入服务
   * 
   * 首次调用会下载模型 (~90MB)，后续调用使用缓存。
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      const result = await invoke<boolean>('init_embedding_service', {
        config: {
          model_name: this.config.modelName,
          cache_dir: this.config.cacheDir,
          show_download_progress: this.config.showDownloadProgress,
        },
      });
      
      this.initialized = result;
      console.log('[EmbeddingService] 初始化完成');
      return result;
    } catch (error) {
      console.error('[EmbeddingService] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 生成单条文本的向量嵌入
   * 
   * @param text 要嵌入的文本
   * @returns 384 维向量
   */
  async embed(text: string): Promise<number[]> {
    await this.ensureInitialized();

    try {
      const result = await invoke<EmbeddingResult>('embed_text', { text });
      return result.embedding;
    } catch (error) {
      console.error('[EmbeddingService] 嵌入失败:', error);
      throw error;
    }
  }

  /**
   * 批量生成文本向量嵌入
   * 
   * @param texts 要嵌入的文本数组
   * @returns 384 维向量数组
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    
    await this.ensureInitialized();

    try {
      const result = await invoke<BatchEmbeddingResult>('embed_batch', { texts });
      return result.embeddings;
    } catch (error) {
      console.error('[EmbeddingService] 批量嵌入失败:', error);
      throw error;
    }
  }

  /**
   * 获取服务状态
   */
  async getStatus(): Promise<EmbeddingServiceStatus> {
    try {
      const result = await invoke<{
        is_initialized: boolean;
        model_loaded: boolean;
        model_name: string;
        dimension: number;
      }>('get_embedding_status');
      
      return {
        isInitialized: result.is_initialized,
        modelLoaded: result.model_loaded,
        modelName: result.model_name,
        dimension: result.dimension,
      };
    } catch (error) {
      console.error('[EmbeddingService] 获取状态失败:', error);
      return {
        isInitialized: false,
        modelLoaded: false,
        modelName: DEFAULT_MODEL,
        dimension: EMBEDDING_DIMENSION,
      };
    }
  }

  /**
   * 获取向量维度
   */
  getDimension(): number {
    return EMBEDDING_DIMENSION;
  }

  /**
   * 确保服务已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// ============== 便捷函数 ==============

let defaultService: EmbeddingService | null = null;

/**
 * 获取默认嵌入服务实例
 */
export function getEmbeddingService(): EmbeddingService {
  if (!defaultService) {
    defaultService = new EmbeddingService();
  }
  return defaultService;
}

/**
 * 生成单条文本的向量嵌入 (便捷函数)
 * 
 * @param text 要嵌入的文本
 * @returns 384 维向量
 */
export async function embedText(text: string): Promise<number[]> {
  return getEmbeddingService().embed(text);
}

/**
 * 批量生成文本向量嵌入 (便捷函数)
 * 
 * @param texts 要嵌入的文本数组
 * @returns 384 维向量数组
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  return getEmbeddingService().embedBatch(texts);
}

/**
 * 计算两个向量的余弦相似度
 * 
 * @param a 向量 A
 * @param b 向量 B
 * @returns 相似度分数 (0-1)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`向量维度不匹配: ${a.length} vs ${b.length}`);
  }

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

/**
 * 在向量集合中查找最相似的向量
 * 
 * @param query 查询向量
 * @param vectors 向量集合
 * @param topK 返回数量
 * @returns 最相似的向量索引和分数
 */
export function findMostSimilar(
  query: number[],
  vectors: number[][],
  topK: number = 5
): Array<{ index: number; score: number }> {
  const scores = vectors.map((vector, index) => ({
    index,
    score: cosineSimilarity(query, vector),
  }));

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
}

// ============== 导出 ==============

export default EmbeddingService;
