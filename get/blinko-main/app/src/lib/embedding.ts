/**
 * 本地嵌入服务 TypeScript 绑定 - Echo on Blinko 扩展
 * 
 * 提供本地向量嵌入生成功能的前端接口
 */

import { invoke } from '@tauri-apps/api/core';
import { isDesktop } from './tauriHelper';

// 嵌入配置接口
export interface EmbeddingConfig {
  ollama_url: string;
  model: string;
  enabled: boolean;
}

// 嵌入结果接口
export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
}

/**
 * 获取嵌入配置
 */
export async function getEmbeddingConfig(): Promise<EmbeddingConfig> {
  if (!isDesktop()) {
    throw new Error('本地嵌入仅支持桌面端');
  }
  return await invoke<EmbeddingConfig>('get_embedding_config');
}

/**
 * 设置嵌入配置
 */
export async function setEmbeddingConfig(config: EmbeddingConfig): Promise<void> {
  if (!isDesktop()) {
    throw new Error('本地嵌入仅支持桌面端');
  }
  await invoke('set_embedding_config', { config });
}

/**
 * 检查 Ollama 是否可用
 */
export async function checkOllamaAvailable(): Promise<boolean> {
  if (!isDesktop()) {
    return false;
  }
  try {
    return await invoke<boolean>('check_ollama_available');
  } catch {
    return false;
  }
}

/**
 * 列出可用的嵌入模型
 */
export async function listEmbeddingModels(): Promise<string[]> {
  if (!isDesktop()) {
    return [];
  }
  try {
    return await invoke<string[]>('list_embedding_models');
  } catch {
    return [];
  }
}

/**
 * 生成文本嵌入
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!isDesktop()) {
    throw new Error('本地嵌入仅支持桌面端');
  }
  return await invoke<EmbeddingResult>('generate_embedding', { text });
}

/**
 * 批量生成嵌入
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<EmbeddingResult[]> {
  if (!isDesktop()) {
    throw new Error('本地嵌入仅支持桌面端');
  }
  return await invoke<EmbeddingResult[]>('generate_embeddings_batch', { texts });
}

/**
 * 计算余弦相似度
 */
export async function cosineSimilarity(a: number[], b: number[]): Promise<number> {
  if (!isDesktop()) {
    // 在非桌面端使用 JS 实现
    return cosineSimilarityJS(a, b);
  }
  return await invoke<number>('cosine_similarity', { a, b });
}

/**
 * JS 实现的余弦相似度计算
 */
function cosineSimilarityJS(a: number[], b: number[]): number {
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
  private config: EmbeddingConfig | null = null;

  /**
   * 初始化服务
   */
  async initialize(): Promise<boolean> {
    if (!isDesktop()) {
      return false;
    }

    try {
      this.config = await getEmbeddingConfig();
      
      // 检查 Ollama 是否可用
      const available = await checkOllamaAvailable();
      if (!available) {
        console.warn('[LocalEmbedding] Ollama 服务不可用');
        return false;
      }

      return this.config.enabled;
    } catch (e) {
      console.error('[LocalEmbedding] 初始化失败:', e);
      return false;
    }
  }

  /**
   * 启用本地嵌入
   */
  async enable(model?: string): Promise<void> {
    if (!this.config) {
      await this.initialize();
    }

    const newConfig: EmbeddingConfig = {
      ...this.config!,
      enabled: true,
      model: model || this.config?.model || 'nomic-embed-text',
    };

    await setEmbeddingConfig(newConfig);
    this.config = newConfig;
  }

  /**
   * 禁用本地嵌入
   */
  async disable(): Promise<void> {
    if (!this.config) {
      await this.initialize();
    }

    const newConfig: EmbeddingConfig = {
      ...this.config!,
      enabled: false,
    };

    await setEmbeddingConfig(newConfig);
    this.config = newConfig;
  }

  /**
   * 生成嵌入
   */
  async embed(text: string): Promise<number[]> {
    const result = await generateEmbedding(text);
    return result.embedding;
  }

  /**
   * 批量生成嵌入
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results = await generateEmbeddingsBatch(texts);
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
    const similarities = await Promise.all(
      candidateEmbeddings.map(async (emb, i) => ({
        text: candidates[i],
        similarity: await cosineSimilarity(queryEmbedding, emb),
        index: i,
      }))
    );

    // 排序并返回 top-k
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}

// 导出单例
export const localEmbedding = new LocalEmbeddingService();
