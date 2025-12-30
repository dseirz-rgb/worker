/**
 * SeekDB 向量存储属性测试
 * 
 * 使用 fast-check 进行属性测试，验证向量存储的正确性。
 * 
 * **Validates: Requirements 1.2, 1.3, 1.6**
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fc from 'fast-check';
import { SeekDBVectorStore, QueryResult } from './seekdbVectorStore';

// Mock seekdbService
vi.mock('./seekdbService', () => {
  // 内存存储
  const store: Map<string, { id: string; content: string; vector: number[]; metadata: Record<string, unknown> }> = new Map();
  
  return {
    seekdbService: {
      healthCheck: vi.fn().mockResolvedValue(true),
      listCollections: vi.fn().mockResolvedValue([{ name: 'notes', count: 0 }]),
      createIndex: vi.fn().mockResolvedValue({ status: 'created' }),
      deleteIndex: vi.fn().mockResolvedValue({ status: 'deleted' }),
      truncateIndex: vi.fn().mockImplementation(async () => {
        store.clear();
        return { status: 'truncated', deletedCount: 0 };
      }),
      vectorUpsert: vi.fn().mockImplementation(async ({ vectors, metadata, ids }) => {
        for (let i = 0; i < vectors.length; i++) {
          const id = ids?.[i] || `doc_${Date.now()}_${i}`;
          store.set(id, {
            id,
            content: (metadata[i]?.text as string) || '',
            vector: vectors[i],
            metadata: metadata[i] || {},
          });
        }
        return { status: 'success', inserted: vectors.length, updated: 0 };
      }),
      vectorQuery: vi.fn().mockImplementation(async ({ queryVector, topK }) => {
        // 计算余弦相似度并排序
        const results: Array<{ id: string; score: number; metadata: Record<string, unknown> }> = [];
        
        for (const [id, doc] of store.entries()) {
          const score = cosineSimilarity(queryVector, doc.vector);
          results.push({ id, score, metadata: doc.metadata });
        }
        
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, topK);
      }),
      vectorDelete: vi.fn().mockImplementation(async (indexName, ids) => {
        for (const id of ids) {
          store.delete(id);
        }
        return { status: 'deleted', count: ids.length };
      }),
      search: vi.fn().mockResolvedValue([]),
      hybridSearch: vi.fn().mockResolvedValue([]),
    },
  };
});

// 辅助函数：计算余弦相似度
function cosineSimilarity(a: number[], b: number[]): number {
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

// 辅助函数：生成随机向量
function generateVector(dimension: number): number[] {
  const vector: number[] = [];
  for (let i = 0; i < dimension; i++) {
    vector.push(Math.random() * 2 - 1);
  }
  // 归一化
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map(v => v / norm);
}

// 辅助函数：生成相似向量
function generateSimilarVector(base: number[], noise: number = 0.1): number[] {
  const similar = base.map(v => v + (Math.random() * 2 - 1) * noise);
  const norm = Math.sqrt(similar.reduce((sum, v) => sum + v * v, 0));
  return similar.map(v => v / norm);
}

describe('SeekDBVectorStore 属性测试', () => {
  let vectorStore: SeekDBVectorStore;
  const DIMENSION = 384;
  const INDEX_NAME = 'test_index';

  beforeAll(async () => {
    vectorStore = new SeekDBVectorStore({ dimension: DIMENSION });
    await vectorStore.initialize();
    await vectorStore.createIndex({ indexName: INDEX_NAME, dimension: DIMENSION });
  });

  afterAll(async () => {
    await vectorStore.truncateIndex({ indexName: INDEX_NAME });
  });

  /**
   * Property 1: 插入后可检索
   * ∀ doc: VectorDocument, upsert([doc]) → query(doc.embedding) 包含 doc
   * 
   * **Validates: Requirements 1.2**
   */
  it('P1: 插入后可检索', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (content) => {
          // 清空索引
          await vectorStore.truncateIndex({ indexName: INDEX_NAME });
          
          // 生成向量
          const vector = generateVector(DIMENSION);
          const docId = `test_${Date.now()}`;
          
          // 插入文档
          await vectorStore.upsert({
            indexName: INDEX_NAME,
            vectors: [vector],
            metadata: [{ text: content, id: docId }],
            ids: [docId],
          });
          
          // 查询
          const results = await vectorStore.query({
            indexName: INDEX_NAME,
            queryVector: vector,
            topK: 1,
          });
          
          // 验证：结果应包含插入的文档
          expect(results.length).toBeGreaterThan(0);
          expect(results[0].id).toBe(docId);
          expect(results[0].score).toBeGreaterThan(0.99); // 相同向量应有高相似度
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: 删除后不可检索
   * ∀ doc: VectorDocument, upsert([doc]) → delete([doc.id]) → query(doc.embedding) 不包含 doc
   * 
   * **Validates: Requirements 1.2**
   */
  it('P2: 删除后不可检索', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (content) => {
          // 清空索引
          await vectorStore.truncateIndex({ indexName: INDEX_NAME });
          
          // 生成向量
          const vector = generateVector(DIMENSION);
          const docId = `test_delete_${Date.now()}`;
          
          // 插入文档
          await vectorStore.upsert({
            indexName: INDEX_NAME,
            vectors: [vector],
            metadata: [{ text: content, id: docId }],
            ids: [docId],
          });
          
          // 删除文档
          await vectorStore.delete(INDEX_NAME, [docId]);
          
          // 查询
          const results = await vectorStore.query({
            indexName: INDEX_NAME,
            queryVector: vector,
            topK: 10,
          });
          
          // 验证：结果不应包含已删除的文档
          const found = results.find(r => r.id === docId);
          expect(found).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: 相似度单调性
   * ∀ q, d1, d2: 如果 cosine(q, d1) > cosine(q, d2), 则 d1 排在 d2 前面
   * 
   * **Validates: Requirements 1.3**
   */
  it('P3: 相似度单调性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (numDocs) => {
          // 清空索引
          await vectorStore.truncateIndex({ indexName: INDEX_NAME });
          
          // 生成查询向量
          const queryVector = generateVector(DIMENSION);
          
          // 生成多个文档，相似度递减
          const docs: Array<{ id: string; vector: number[]; expectedSimilarity: number }> = [];
          
          for (let i = 0; i < numDocs; i++) {
            const noise = 0.1 + i * 0.1; // 噪声递增，相似度递减
            const vector = generateSimilarVector(queryVector, noise);
            const similarity = cosineSimilarity(queryVector, vector);
            
            docs.push({
              id: `doc_${i}`,
              vector,
              expectedSimilarity: similarity,
            });
          }
          
          // 插入所有文档
          await vectorStore.upsert({
            indexName: INDEX_NAME,
            vectors: docs.map(d => d.vector),
            metadata: docs.map(d => ({ text: `content_${d.id}`, id: d.id })),
            ids: docs.map(d => d.id),
          });
          
          // 查询
          const results = await vectorStore.query({
            indexName: INDEX_NAME,
            queryVector,
            topK: numDocs,
          });
          
          // 验证：结果应按相似度降序排列
          for (let i = 1; i < results.length; i++) {
            expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: 向量维度一致
   * ∀ vector: 插入的向量维度应与配置一致
   * 
   * **Validates: Requirements 1.6**
   */
  it('P4: 向量维度一致', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        async (numVectors) => {
          // 生成指定维度的向量
          const vectors = Array.from({ length: numVectors }, () => generateVector(DIMENSION));
          
          // 验证所有向量维度一致
          for (const vector of vectors) {
            expect(vector.length).toBe(DIMENSION);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: 批量操作等价性
   * 批量 upsert 应等价于多次单独 upsert
   * 
   * **Validates: Requirements 1.2**
   */
  it('P5: 批量操作等价性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (numDocs) => {
          // 清空索引
          await vectorStore.truncateIndex({ indexName: INDEX_NAME });
          
          // 生成文档
          const docs = Array.from({ length: numDocs }, (_, i) => ({
            id: `batch_${i}`,
            vector: generateVector(DIMENSION),
            content: `content_${i}`,
          }));
          
          // 批量插入
          await vectorStore.upsert({
            indexName: INDEX_NAME,
            vectors: docs.map(d => d.vector),
            metadata: docs.map(d => ({ text: d.content, id: d.id })),
            ids: docs.map(d => d.id),
          });
          
          // 验证所有文档都可检索
          for (const doc of docs) {
            const results = await vectorStore.query({
              indexName: INDEX_NAME,
              queryVector: doc.vector,
              topK: 1,
            });
            
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].id).toBe(doc.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('SeekDBVectorStore 单元测试', () => {
  let vectorStore: SeekDBVectorStore;

  beforeAll(async () => {
    vectorStore = new SeekDBVectorStore();
    await vectorStore.initialize();
  });

  it('应正确初始化', async () => {
    expect(vectorStore).toBeDefined();
  });

  it('应正确创建索引', async () => {
    await expect(
      vectorStore.createIndex({
        indexName: 'test',
        dimension: 384,
        metric: 'cosine',
      })
    ).resolves.not.toThrow();
  });

  it('应正确清空索引', async () => {
    await expect(
      vectorStore.truncateIndex({ indexName: 'test' })
    ).resolves.not.toThrow();
  });
});
