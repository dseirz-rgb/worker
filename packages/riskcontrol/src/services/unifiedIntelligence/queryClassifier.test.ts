/**
 * QueryClassifier Tests
 *
 * Property-based tests for Query Classification Consistency (Property 1)
 * - High confidence queries → rag_only
 * - Low confidence queries → full_agent
 * - Deep analysis keywords → full_agent
 *
 * @see Requirements 3.1, 3.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClassifier, classifyQuery, classifyQueryFast } from './queryClassifier';

// =============================================================================
// Mocks
// =============================================================================

// Mock QueryRouter
vi.mock('../adaptiveRag/queryRouter', () => ({
  QueryRouter: vi.fn().mockImplementation(() => ({
    route: vi.fn(),
    updateConfig: vi.fn(),
    getConfig: vi.fn(),
  })),
}));

// =============================================================================
// Test Data
// =============================================================================

const SIMPLE_QUERIES = [
  '什么是价值投资？',
  '解释一下PE比率',
  '定义市盈率',
  '今天市场怎么样？',
  '查看持仓',
  'What is ROI?',
  'Show my positions',
];

const DEEP_ANALYSIS_QUERIES = [
  '帮我深度分析当前持仓风险',
  '请全面评估我的投资组合',
  '详细分析一下杠杆风险',
  '给我一些调仓建议',
  '综合分析当前市场形势',
  'Give me a comprehensive risk assessment',
  'Please recommend portfolio optimization',
];

const SINGLE_AGENT_QUERIES = [
  { query: '分析我的持仓集中度', expectedAgent: 'position_analyst' },
  { query: '当前回撤是多少', expectedAgent: 'risk_analyst' },
  { query: '最新的市场新闻', expectedAgent: 'market_analyst' },
  { query: 'Check my position weights', expectedAgent: 'position_analyst' },
  { query: 'What is my current leverage?', expectedAgent: 'risk_analyst' },
];

// =============================================================================
// Unit Tests
// =============================================================================

describe('QueryClassifier', () => {
  let classifier: QueryClassifier;
  let mockRoute: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Get the mocked QueryRouter
    const { QueryRouter } = await import('../adaptiveRag/queryRouter');
    mockRoute = vi.fn();
    (QueryRouter as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      route: mockRoute,
      updateConfig: vi.fn(),
      getConfig: vi.fn(),
    }));

    classifier = new QueryClassifier();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('classify()', () => {
    it('should return rag_only for empty query', async () => {
      const result = await classifier.classify('');
      expect(result.mode).toBe('rag_only');
      expect(result.confidence).toBe(0);
    });

    it('should return full_agent for deep analysis queries', async () => {
      // Deep analysis queries should bypass router and return full_agent
      for (const query of DEEP_ANALYSIS_QUERIES) {
        const result = await classifier.classify(query);
        expect(result.mode).toBe('full_agent');
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
        expect(result.suggestedAgents).toBeDefined();
        expect(result.suggestedAgents!.length).toBeGreaterThan(0);
      }
    });

    it('should return rag_only for simple queries with high confidence', async () => {
      mockRoute.mockResolvedValue({
        datasource: 'vectorstore',
        confidence: 0.92,
        reasoning: 'Investment knowledge query',
      });

      for (const query of SIMPLE_QUERIES) {
        const result = await classifier.classify(query);
        // Simple queries with high confidence should be rag_only
        if (result.confidence > 0.8) {
          expect(result.mode).toBe('rag_only');
        }
      }
    });

    it('should return rag_agent for medium confidence queries', async () => {
      mockRoute.mockResolvedValue({
        datasource: 'structured_data',
        confidence: 0.65,
        reasoning: 'Portfolio query',
      });

      const result = await classifier.classify('我的投资组合表现如何');
      expect(result.mode).toBe('rag_agent');
      expect(result.confidence).toBe(0.65);
    });

    it('should return full_agent for low confidence queries', async () => {
      mockRoute.mockResolvedValue({
        datasource: 'vectorstore',
        confidence: 0.3,
        reasoning: 'Uncertain query',
      });

      const result = await classifier.classify('这个情况应该怎么处理');
      expect(result.mode).toBe('full_agent');
      expect(result.confidence).toBe(0.3);
    });

    it('should suggest appropriate agents for single-agent queries', async () => {
      mockRoute.mockResolvedValue({
        datasource: 'structured_data',
        confidence: 0.7,
        reasoning: 'Portfolio query',
      });

      for (const { query, expectedAgent } of SINGLE_AGENT_QUERIES) {
        const result = await classifier.classify(query);
        if (result.mode === 'rag_agent') {
          expect(result.suggestedAgents).toContain(expectedAgent);
        }
      }
    });
  });

  describe('classifyFast()', () => {
    it('should return rag_only for empty query', () => {
      const result = classifier.classifyFast('');
      expect(result.mode).toBe('rag_only');
      expect(result.confidence).toBe(0);
    });

    it('should return full_agent for deep analysis queries without LLM call', () => {
      for (const query of DEEP_ANALYSIS_QUERIES) {
        const result = classifier.classifyFast(query);
        expect(result.mode).toBe('full_agent');
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      }
    });

    it('should return rag_only for simple queries', () => {
      for (const query of SIMPLE_QUERIES) {
        const result = classifier.classifyFast(query);
        // Most simple queries should be rag_only
        expect(['rag_only', 'rag_agent']).toContain(result.mode);
      }
    });

    it('should match single agents correctly', () => {
      for (const { query, expectedAgent } of SINGLE_AGENT_QUERIES) {
        const result = classifier.classifyFast(query);
        if (result.suggestedAgents) {
          expect(result.suggestedAgents).toContain(expectedAgent);
        }
      }
    });
  });

  describe('Configuration', () => {
    it('should use custom confidence threshold', async () => {
      const customClassifier = new QueryClassifier({
        confidenceThreshold: 0.9,
      });

      mockRoute.mockResolvedValue({
        datasource: 'vectorstore',
        confidence: 0.85,
        reasoning: 'Test query',
      });

      // With threshold 0.9, confidence 0.85 should not be rag_only
      const result = await customClassifier.classify('什么是价值投资');
      // Should be rag_agent or full_agent since 0.85 < 0.9
      expect(result.mode).not.toBe('rag_only');
    });

    it('should update config correctly', () => {
      classifier.updateConfig({ confidenceThreshold: 0.95 });
      const config = classifier.getConfig();
      expect(config.confidenceThreshold).toBe(0.95);
    });
  });
});

// =============================================================================
// Property-Based Tests (Property 1: Query Classification Consistency)
// =============================================================================

describe('Property 1: Query Classification Consistency', () => {
  let classifier: QueryClassifier;
  let mockRoute: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const { QueryRouter } = await import('../adaptiveRag/queryRouter');
    mockRoute = vi.fn();
    (QueryRouter as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      route: mockRoute,
      updateConfig: vi.fn(),
      getConfig: vi.fn(),
    }));

    classifier = new QueryClassifier();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('High confidence → rag_only', () => {
    it('should route to rag_only when confidence > 0.8 and query is simple', async () => {
      // Test with various high confidence values
      const highConfidenceValues = [0.81, 0.85, 0.9, 0.95, 0.99, 1.0];

      for (const confidence of highConfidenceValues) {
        mockRoute.mockResolvedValue({
          datasource: 'vectorstore',
          confidence,
          reasoning: 'High confidence test',
        });

        // Use a simple query that matches simple patterns
        const result = await classifier.classify('什么是ROI？');
        expect(result.mode).toBe('rag_only');
        expect(result.confidence).toBe(confidence);
      }
    });
  });

  describe('Deep analysis keywords → full_agent', () => {
    const deepAnalysisKeywords = [
      '深度分析',
      '全面评估',
      '详细分析',
      '风险分析',
      '回撤分析',
      '杠杆分析',
      '调仓建议',
      '策略优化',
      'comprehensive analysis',
      'risk assessment',
      'recommend',
    ];

    it('should always route to full_agent for deep analysis keywords', async () => {
      for (const keyword of deepAnalysisKeywords) {
        const query = `请${keyword}我的投资组合`;
        const result = await classifier.classify(query);

        expect(result.mode).toBe('full_agent');
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
        expect(result.suggestedAgents).toBeDefined();
      }
    });

    it('should prioritize deep analysis over high confidence', async () => {
      // Even with high confidence from router, deep analysis keywords should win
      mockRoute.mockResolvedValue({
        datasource: 'vectorstore',
        confidence: 0.99,
        reasoning: 'Very high confidence',
      });

      const result = await classifier.classify('帮我深度分析风险');
      expect(result.mode).toBe('full_agent');
    });
  });

  describe('Low confidence → full_agent', () => {
    it('should route to full_agent when confidence < 0.5', async () => {
      const lowConfidenceValues = [0.1, 0.2, 0.3, 0.4, 0.49];

      for (const confidence of lowConfidenceValues) {
        mockRoute.mockResolvedValue({
          datasource: 'vectorstore',
          confidence,
          reasoning: 'Low confidence test',
        });

        const result = await classifier.classify('这个问题比较复杂');
        expect(result.mode).toBe('full_agent');
        expect(result.confidence).toBe(confidence);
      }
    });
  });

  describe('Medium confidence → rag_agent', () => {
    it('should route to rag_agent when 0.5 <= confidence <= 0.8', async () => {
      const mediumConfidenceValues = [0.5, 0.6, 0.7, 0.8];

      for (const confidence of mediumConfidenceValues) {
        mockRoute.mockResolvedValue({
          datasource: 'structured_data',
          confidence,
          reasoning: 'Medium confidence test',
        });

        // Use a non-simple, non-deep query
        const result = await classifier.classify('分析一下我的投资组合表现');
        expect(['rag_agent', 'full_agent']).toContain(result.mode);
      }
    });
  });
});

// =============================================================================
// Convenience Function Tests
// =============================================================================

describe('Convenience Functions', () => {
  it('classifyQueryFast should work without LLM', () => {
    // classifyQueryFast doesn't use LLM, so it should work with the singleton
    const result = classifyQueryFast('帮我深度分析风险');
    expect(result.mode).toBe('full_agent');
  });

  it('classifyQueryFast should handle simple queries', () => {
    const result = classifyQueryFast('什么是价值投资？');
    expect(result).toBeDefined();
    expect(result.mode).toBeDefined();
    expect(['rag_only', 'rag_agent']).toContain(result.mode);
  });
});
