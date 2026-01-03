/**
 * 本地嵌入服务 - Echo on Blinko 扩展
 * 
 * 使用 Transformers.js 在浏览器/Node.js 本地生成向量嵌入
 * 模型: all-MiniLM-L6-v2 (384 维向量，~23MB)
 * 
 * 优势: 离线可用、更快、更私密、无需 API Key
 */

// 嵌入结果接口
export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
}

// 嵌入配置
export interface LocalEmbeddingConfig {
  enabled: boolean;
  model: string;
  cacheEnabled: boolean;
}

// 默认配置
const DEFAULT_CONFIG: LocalEmbeddingConfig = {
  enabled: true,
  model: 'Xenova/all-MiniLM-L6-v2',
  cacheEnabled: true,
};

// 模型实例缓存
let pipelineInstance: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

/**
 * 获取或初始化嵌入管道
 */
async function getEmbeddingPipeline(modelName: string = DEFAULT_CONFIG.model): Promise<any> {
  // 如果已有实例，直接返回
  if (pipelineInstance) {
    return pipelineInstance;
  }

  // 如果正在加载，等待加载完成
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  // 开始加载
  isLoading = true;
  loadPromise = (async () => {
    try {
      console.log('[LocalEmbedding] 正在加载模型:', modelName);
      
      // 动态导入 transformers.js
      const { pipeline } = await import('@huggingface/transformers');
      
      // 创建特征提取管道
      // Transformers.js 默认使用量化模型 (ONNX)
      pipelineInstance = await pipeline('feature-extraction', modelName);
      
      console.log('[LocalEmbedding] 模型加载完成');
      return pipelineInstance;
    } catch (error) {
      console.error('[LocalEmbedding] 模型加载失败:', error);
      throw error;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

/**
 * 生成文本嵌入
 */
export async function generateLocalEmbedding(text: string): Promise<EmbeddingResult> {
  const extractor = await getEmbeddingPipeline();
  
  // 生成嵌入
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  
  // 转换为普通数组
  const embedding = Array.from(output.data as Float32Array);
  
  return {
    embedding,
    model: DEFAULT_CONFIG.model,
    dimensions: embedding.length,
  };
}

/**
 * 批量生成嵌入
 */
export async function generateLocalEmbeddingsBatch(texts: string[]): Promise<EmbeddingResult[]> {
  const extractor = await getEmbeddingPipeline();
  
  const results: EmbeddingResult[] = [];
  
  // 逐个处理 (transformers.js 批处理有时不稳定)
  for (const text of texts) {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data as Float32Array);
    
    results.push({
      embedding,
      model: DEFAULT_CONFIG.model,
      dimensions: embedding.length,
    });
  }
  
  return results;
}

/**
 * 计算余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('向量维度不匹配');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 本地嵌入服务类
 */
export class LocalEmbeddingService {
  private config: LocalEmbeddingConfig;
  private initialized = false;

  constructor(config?: Partial<LocalEmbeddingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化服务 (预加载模型)
   */
  async initialize(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      await getEmbeddingPipeline(this.config.model);
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('[LocalEmbedding] 初始化失败:', error);
      return false;
    }
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.initialized && pipelineInstance !== null;
  }

  /**
   * 生成嵌入
   */
  async embed(text: string): Promise<number[]> {
    if (!this.config.enabled) {
      throw new Error('本地嵌入未启用');
    }
    const result = await generateLocalEmbedding(text);
    return result.embedding;
  }

  /**
   * 批量生成嵌入
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.config.enabled) {
      throw new Error('本地嵌入未启用');
    }
    const results = await generateLocalEmbeddingsBatch(texts);
    return results.map(r => r.embedding);
  }

  /**
   * 查找最相似的文本
   */
  async findMostSimilar(
    query: string,
    candidates: string[],
    topK: number = 5
  ): Promise<Array<{ text: string; similarity: number; index: number }>> {
    // 生成查询嵌入
    const queryEmbedding = await this.embed(query);

    // 生成候选嵌入
    const candidateEmbeddings = await this.embedBatch(candidates);

    // 计算相似度
    const similarities = candidateEmbeddings.map((emb, i) => ({
      text: candidates[i],
      similarity: cosineSimilarity(queryEmbedding, emb),
      index: i,
    }));

    // 排序并返回 top-k
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * 语义搜索
   */
  async semanticSearch(
    query: string,
    documents: Array<{ id: string | number; text: string }>,
    options?: { topK?: number; minScore?: number }
  ): Promise<Array<{ id: string | number; text: string; score: number }>> {
    const { topK = 5, minScore = 0.3 } = options || {};

    // 生成查询嵌入
    const queryEmbedding = await this.embed(query);

    // 生成文档嵌入
    const docTexts = documents.map(d => d.text);
    const docEmbeddings = await this.embedBatch(docTexts);

    // 计算相似度并过滤
    const results = documents
      .map((doc, i) => ({
        ...doc,
        score: cosineSimilarity(queryEmbedding, docEmbeddings[i]),
      }))
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }

  /**
   * 释放模型资源
   */
  dispose(): void {
    pipelineInstance = null;
    this.initialized = false;
    console.log('[LocalEmbedding] 模型已释放');
  }
}

// 导出单例
export const localEmbedding = new LocalEmbeddingService();

// 导出便捷函数
export { generateLocalEmbedding as embed, generateLocalEmbeddingsBatch as embedBatch };
