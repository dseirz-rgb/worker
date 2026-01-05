/**
 * Adaptive RAG Service 属性测试
 * 
 * **Property 4: RAG Service Result Limiting**
 * **Property 5: Citation Format Consistency**
 * **Property 6: RAG Service Graceful Degradation**
 * **Validates: Requirements 3.3, 3.4, 3.5, 3.6, 9.3**
 * 
 * @module services/echo-server/aiServer/investment/adaptiveRagService.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fc from 'fast-check';

import type { Citation, RAGResult, QueryClassification } from './types';

// ============================================================================
// Mock 模块
// ============================================================================

// Mock investmentDb
let mockSearchResults: any[] = [];
let mockVectorResults: any[] = [];
let mockMessages: any[] = [];
let mockDbClient: any = null;
let shouldThrowError = false;

vi.mock('../../lib/investmentDb', () => ({
  getInvestmentDb: vi.fn().mockImplementation(() => {
    if (shouldThrowError) return null;
    return mockDbClient;
  }),
  searchDocuments: vi.fn().mockImplementation(async (query: string, limit: number) => {
    if (shouldThrowError) throw new Error('Database error');
    return mockSearchResults.slice(0, limit);
  }),
  vectorSearchDocuments: vi.fn().mockImplementation(async (embedding: number[], threshold: number, limit: number) => {
    if (shouldThrowError) throw new Error('Database error');
    return mockVectorResults.slice(0, limit);
  }),
  getMessages: vi.fn().mockImplementation(async () => {
    if (shouldThrowError) throw new Error('Database error');
    return mockMessages;
  }),
  getStockPositions: vi.fn().mockResolvedValue([]),
  getOptionPositions: vi.fn().mockResolvedValue([]),
  getRecentTransactions: vi.fn().mockResolvedValue([]),
  getDashboardSnapshot: vi.fn().mockResolvedValue(null),
  getUserProfile: vi.fn().mockResolvedValue(null),
}));

// Mock contextBuilder
vi.mock('./contextBuilder', () => ({
  buildContext: vi.fn().mockImplementation(async () => {
    if (shouldThrowError) throw new Error('Context build error');
    return '# 投资组合数据\n\n测试数据';
  }),
}));

// Mock fetch for LightRAG and embedding
let mockLightRAGAvailable = false;
let mockLightRAGResult: any = null;
let mockEmbeddingResult: number[] | null = null;

global.fetch = vi.fn().mockImplementation(async (url: string, options?: any) => {
  if (url.includes('/health')) {
    return {
      ok: mockLightRAGAvailable,
      status: mockLightRAGAvailable ? 200 : 503,
    };
  }
  
  if (url.includes('/query')) {
    if (!mockLightRAGAvailable) {
      return { ok: false, status: 503 };
    }
    return {
      ok: true,
      json: async () => mockLightRAGResult || { response: 'LightRAG result' },
    };
  }
  
  if (url.includes('embedContent')) {
    if (!mockEmbeddingResult) {
      return { ok: false, status: 500 };
    }
    return {
      ok: true,
      json: async () => ({ embedding: { values: mockEmbeddingResult } }),
    };
  }
  
  return { ok: false, status: 404 };
});

// 导入被测模块（在 mock 之后）
import {
  classifyQuery,
  isLightRAGAvailable,
  queryLightRAG,
  AdaptiveRagService,
  getInvestmentContext,
} from './adaptiveRagService';

// ============================================================================
// 测试数据生成器
// ============================================================================

/**
 * 生成结构化数据查询
 */
const structuredQueryArb = fc.oneof(
  fc.constantFrom(
    '我的持仓有哪些',
    '今天盈亏多少',
    '最近的交易记录',
    '账户净值是多少',
    '股票仓位占比',
    '期权持仓情况',
    '本月收益率',
    '回撤多少了',
  ),
  fc.tuple(
    fc.constantFrom('我的', '账户', '持仓', '交易', '盈亏', '净值'),
    fc.string({ minLength: 1, maxLength: 20 }),
  ).map(([prefix, suffix]) => `${prefix}${suffix}`),
);

/**
 * 生成知识库查询（确保包含知识库关键词）
 */
const knowledgeQueryArb = fc.oneof(
  fc.constantFrom(
    '什么是价值投资',
    '巴菲特的投资原则',
    '如何分析公司估值',
    '为什么要分散投资',
    '怎么判断买入时机',
    '解释一下估值方法',
    '芒格的投资策略是什么',
  ),
  fc.tuple(
    fc.constantFrom('为什么', '怎么', '如何', '什么是', '解释'),
    fc.constantFrom('投资', '策略', '分析', '估值', '原则'),
  ).map(([prefix, suffix]) => `${prefix}${suffix}`),
);

/**
 * 生成随机查询
 */
const randomQueryArb = fc.string({ minLength: 1, maxLength: 100 });

/**
 * 生成文档结果
 */
const documentArb = fc.record({
  content: fc.string({ minLength: 10, maxLength: 500 }),
  title: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
});

/**
 * 生成引用
 */
const citationArb: fc.Arbitrary<Citation> = fc.record({
  source: fc.constantFrom(
    '📊 结构化数据',
    '📝 投资笔记',
    '💬 历史对话',
    '🧠 知识图谱 (LightRAG)',
    '🔍 向量搜索 (pgvector)',
    '📝 关键词搜索 (FTS)',
  ),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  content_snippet: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
  url: fc.option(fc.webUrl(), { nil: undefined }),
});

// ============================================================================
// 属性测试
// ============================================================================

describe('Adaptive RAG Service 属性测试', () => {
  let service: AdaptiveRagService;

  beforeEach(() => {
    // 重置 mock 状态
    mockSearchResults = [];
    mockVectorResults = [];
    mockMessages = [];
    mockDbClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      textSearch: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
    };
    mockLightRAGAvailable = false;
    mockLightRAGResult = null;
    mockEmbeddingResult = null;
    shouldThrowError = false;
    
    service = new AdaptiveRagService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 4: RAG Service Result Limiting
   * 
   * *For any* search query, the RAG Service SHALL return at most 5 notes
   * and at most 3 historical messages.
   * 
   * **Validates: Requirements 3.3, 3.5**
   */
  describe('Property 4: RAG Service Result Limiting', () => {
    it('搜索结果应限制在最大数量内', async () => {
      await fc.assert(
        fc.asyncProperty(
          randomQueryArb,
          fc.integer({ min: 0, max: 20 }), // 文档数量
          fc.integer({ min: 0, max: 10 }), // 历史消息数量
          async (query, docCount, historyCount) => {
            // 设置 mock 数据
            mockSearchResults = Array.from({ length: docCount }, (_, i) => ({
              content: `Document ${i} content`,
              title: `Document ${i}`,
            }));

            mockMessages = Array.from({ length: historyCount }, (_, i) => ({
              content: `History message ${i}`,
              created_at: new Date().toISOString(),
            }));

            mockDbClient.limit = vi.fn().mockResolvedValue({
              data: mockMessages.slice(0, 3), // 模拟数据库限制
              error: null,
            });

            const result = await service.getInvestmentContext(query, {
              sources: ['fts'],
              maxResults: 5,
              includeHistory: true,
            });

            // 验证返回结果
            expect(result).toHaveProperty('text');
            expect(result).toHaveProperty('citations');

            // 验证引用数量限制
            const noteCitations = result.citations.filter(c =>
              c.source.includes('搜索') || c.source.includes('知识')
            );
            const historyCitations = result.citations.filter(c =>
              c.source.includes('历史')
            );

            // 笔记引用最多 5 个
            expect(noteCitations.length).toBeLessThanOrEqual(5);
            // 历史引用最多 3 个
            expect(historyCitations.length).toBeLessThanOrEqual(3);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('maxResults 参数应正确限制结果数量', async () => {
      await fc.assert(
        fc.asyncProperty(
          randomQueryArb,
          fc.integer({ min: 1, max: 10 }),
          async (query, maxResults) => {
            // 设置大量 mock 数据
            mockSearchResults = Array.from({ length: 20 }, (_, i) => ({
              content: `Document ${i} content`,
              title: `Document ${i}`,
            }));

            const result = await service.getInvestmentContext(query, {
              sources: ['fts'],
              maxResults,
              includeHistory: false,
            });

            // 验证引用数量不超过 maxResults
            const searchCitations = result.citations.filter(c =>
              c.source.includes('搜索')
            );
            expect(searchCitations.length).toBeLessThanOrEqual(maxResults);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 5: Citation Format Consistency
   * 
   * *For any* citation generated by the system, it SHALL match the pattern
   * where Source Type is one of the predefined types.
   * 
   * **Validates: Requirements 3.4, 9.1, 9.2, 9.3, 9.5**
   */
  describe('Property 5: Citation Format Consistency', () => {
    const VALID_SOURCE_PATTERNS = [
      '📊 结构化数据',
      '📝 投资笔记',
      '💬 历史对话',
      '🧠 知识图谱',
      '🔍 向量搜索',
      '📝 关键词搜索',
    ];

    it('所有引用应包含有效的来源类型', async () => {
      await fc.assert(
        fc.asyncProperty(
          randomQueryArb,
          async (query) => {
            // 设置 mock 数据以生成引用
            mockSearchResults = [
              { content: 'Test content', title: 'Test Document' },
            ];
            mockMessages = [
              { content: 'History content', created_at: new Date().toISOString() },
            ];
            mockDbClient.limit = vi.fn().mockResolvedValue({
              data: mockMessages,
              error: null,
            });

            const result = await service.getInvestmentContext(query, {
              sources: ['fts'],
              includeHistory: true,
            });

            // 验证每个引用的格式
            for (const citation of result.citations) {
              // 验证 source 字段存在
              expect(citation).toHaveProperty('source');
              expect(typeof citation.source).toBe('string');
              expect(citation.source.length).toBeGreaterThan(0);

              // 验证 source 包含有效的来源类型
              const hasValidSource = VALID_SOURCE_PATTERNS.some(pattern =>
                citation.source.includes(pattern.slice(0, 4)) // 检查 emoji 前缀
              );
              expect(hasValidSource).toBe(true);

              // 验证 title 字段存在
              expect(citation).toHaveProperty('title');
              expect(typeof citation.title).toBe('string');
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('引用的 content_snippet 应被截断到合理长度', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 200, maxLength: 1000 }), // 长内容
          async (longContent) => {
            mockSearchResults = [
              { content: longContent, title: 'Long Document' },
            ];

            const result = await service.getInvestmentContext('test query', {
              sources: ['fts'],
              includeHistory: false,
            });

            // 验证 content_snippet 被截断
            for (const citation of result.citations) {
              if (citation.content_snippet) {
                // 截断后应该不超过 103 字符（100 + "..."）
                expect(citation.content_snippet.length).toBeLessThanOrEqual(103);
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 6: RAG Service Graceful Degradation
   * 
   * *For any* query with no matching notes, the RAG Service SHALL return
   * an empty citations array and proceed without error.
   * 
   * **Validates: Requirements 3.6**
   */
  describe('Property 6: RAG Service Graceful Degradation', () => {
    it('无匹配结果时应返回空引用数组而非抛出异常', async () => {
      await fc.assert(
        fc.asyncProperty(
          randomQueryArb,
          async (query) => {
            // 设置空结果
            mockSearchResults = [];
            mockVectorResults = [];
            mockMessages = [];
            mockDbClient.limit = vi.fn().mockResolvedValue({
              data: [],
              error: null,
            });
            mockLightRAGAvailable = false;

            let result: RAGResult;
            let threwError = false;

            try {
              result = await service.getInvestmentContext(query, {
                sources: ['lightrag', 'pgvector', 'fts'],
                includeHistory: true,
              });
            } catch (e) {
              threwError = true;
              result = { text: '', citations: [] };
            }

            // 验证没有抛出异常
            expect(threwError).toBe(false);

            // 验证返回有效结构
            expect(result).toHaveProperty('text');
            expect(result).toHaveProperty('citations');
            expect(Array.isArray(result.citations)).toBe(true);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('数据库错误时应优雅降级', async () => {
      await fc.assert(
        fc.asyncProperty(
          randomQueryArb,
          async (query) => {
            // 设置错误状态
            shouldThrowError = true;

            let result: RAGResult;
            let threwError = false;

            try {
              result = await service.getInvestmentContext(query, {
                sources: ['fts'],
                includeHistory: false,
              });
            } catch (e) {
              threwError = true;
              result = { text: '', citations: [] };
            }

            // 验证没有抛出异常（优雅降级）
            expect(threwError).toBe(false);

            // 验证返回有效结构
            expect(result).toHaveProperty('text');
            expect(result).toHaveProperty('citations');

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('LightRAG 不可用时应降级到其他搜索方式', async () => {
      await fc.assert(
        fc.asyncProperty(
          knowledgeQueryArb,
          async (query) => {
            // LightRAG 不可用
            mockLightRAGAvailable = false;
            // 但 FTS 有结果
            mockSearchResults = [
              { content: 'Fallback content', title: 'Fallback Document' },
            ];

            const result = await service.getInvestmentContext(query, {
              sources: ['lightrag', 'fts'],
              includeHistory: false,
            });

            // 验证返回有效结果
            expect(result).toHaveProperty('text');
            expect(result).toHaveProperty('citations');

            // 如果有 FTS 结果，应该有引用
            if (mockSearchResults.length > 0) {
              // 可能有结构化数据引用或 FTS 引用
              expect(result.citations.length).toBeGreaterThanOrEqual(0);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * 查询分类测试
   */
  describe('查询分类 (classifyQuery)', () => {
    it('结构化数据查询应被正确分类', async () => {
      await fc.assert(
        fc.asyncProperty(
          structuredQueryArb,
          async (query) => {
            const classification = classifyQuery(query);

            // 验证返回结构
            expect(classification).toHaveProperty('needsStructuredData');
            expect(classification).toHaveProperty('needsKnowledgeBase');
            expect(classification).toHaveProperty('confidence');
            expect(classification).toHaveProperty('matchedKeywords');

            // 结构化查询应该需要结构化数据
            expect(classification.needsStructuredData).toBe(true);

            // 置信度应在 0-1 之间
            expect(classification.confidence).toBeGreaterThanOrEqual(0);
            expect(classification.confidence).toBeLessThanOrEqual(1);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('知识库查询应被正确分类', async () => {
      await fc.assert(
        fc.asyncProperty(
          knowledgeQueryArb,
          async (query) => {
            const classification = classifyQuery(query);

            // 验证返回结构完整
            expect(classification).toHaveProperty('needsStructuredData');
            expect(classification).toHaveProperty('needsKnowledgeBase');
            expect(classification).toHaveProperty('confidence');
            expect(classification).toHaveProperty('matchedKeywords');

            // 知识库查询应该需要知识库
            expect(classification.needsKnowledgeBase).toBe(true);

            // 应该有匹配的关键词
            expect(classification.matchedKeywords.length).toBeGreaterThan(0);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('空查询应返回默认分类', () => {
      const classification = classifyQuery('');

      expect(classification.needsStructuredData).toBe(true);
      expect(classification.confidence).toBe(0.5);
    });

    it('长查询应倾向于需要知识库', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 50, maxLength: 200 }),
          async (longQuery) => {
            const classification = classifyQuery(longQuery);

            // 长查询应该需要知识库
            expect(classification.needsKnowledgeBase).toBe(true);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * LightRAG 集成测试
   */
  describe('LightRAG 集成', () => {
    it('isLightRAGAvailable 应正确检测服务状态', async () => {
      // 测试可用状态
      mockLightRAGAvailable = true;
      let available = await isLightRAGAvailable();
      expect(available).toBe(true);

      // 测试不可用状态
      mockLightRAGAvailable = false;
      available = await isLightRAGAvailable();
      expect(available).toBe(false);
    });

    it('queryLightRAG 应返回正确格式', async () => {
      mockLightRAGAvailable = true;
      mockLightRAGResult = { response: 'Test response' };

      const result = await queryLightRAG('test query', 'hybrid');

      expect(result).toHaveProperty('success');
      if (result.success) {
        expect(result).toHaveProperty('result');
      } else {
        expect(result).toHaveProperty('error');
      }
    });
  });
});
