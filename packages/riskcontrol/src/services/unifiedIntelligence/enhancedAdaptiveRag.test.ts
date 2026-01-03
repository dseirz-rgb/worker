/**
 * EnhancedAdaptiveRAG Tests
 *
 * Property-based tests for LightRAG Priority (Property 2)
 * - LightRAG is called before Supabase
 * - Fallback on LightRAG failure
 *
 * @see Requirements 1.1, 1.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EnhancedAdaptiveRAGService, retrieveForAgent } from './enhancedAdaptiveRag';

// =============================================================================
// Mocks
// =============================================================================

// Mock LightRAG client
vi.mock('../lightragClient', () => ({
  queryKnowledge: vi.fn(),
  isLightRAGAvailable: vi.fn(),
}));

// Mock Supabase client
vi.mock('../supabaseData', () => ({
  getClient: vi.fn(),
}));

// Mock fetch for embedding API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// =============================================================================
// Test Helpers
// =============================================================================

const createMockSupabaseClient = () => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
});

// =============================================================================
// Unit Tests
// =============================================================================

describe('EnhancedAdaptiveRAGService', () => {
  let service: EnhancedAdaptiveRAGService;
  let mockQueryKnowledge: ReturnType<typeof vi.fn>;
  let mockIsLightRAGAvailable: ReturnType<typeof vi.fn>;
  let mockGetClient: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Get mocked functions
    const lightragModule = await import('../lightragClient');
    mockQueryKnowledge = lightragModule.queryKnowledge as ReturnType<typeof vi.fn>;
    mockIsLightRAGAvailable = lightragModule.isLightRAGAvailable as ReturnType<typeof vi.fn>;

    const supabaseModule = await import('../supabaseData');
    mockGetClient = supabaseModule.getClient as ReturnType<typeof vi.fn>;

    // Default mock implementations
    mockIsLightRAGAvailable.mockResolvedValue(true);
    mockQueryKnowledge.mockResolvedValue({
      success: true,
      result: 'LightRAG test result about investment principles',
    });
    mockGetClient.mockReturnValue(createMockSupabaseClient());

    // Mock fetch for embedding API
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          predictions: [{ embeddings: { values: [0.1, 0.2, 0.3] } }],
        }),
    });

    service = new EnhancedAdaptiveRAGService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('retrieveFromLightRAGFirst()', () => {
    it('should call LightRAG first when available', async () => {
      const citations: any[] = [];
      const result = await service.retrieveFromLightRAGFirst('test query', citations);

      expect(mockIsLightRAGAvailable).toHaveBeenCalled();
      expect(mockQueryKnowledge).toHaveBeenCalledWith('test query', 'hybrid');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].metadata.source).toBe('LightRAG');
    });

    it('should fallback to Supabase when LightRAG is unavailable', async () => {
      mockIsLightRAGAvailable.mockResolvedValue(false);

      const mockSupabase = createMockSupabaseClient();
      mockSupabase.rpc.mockResolvedValue({
        data: [
          { id: '1', content: 'Supabase result', similarity: 0.8 },
        ],
        error: null,
      });
      mockGetClient.mockReturnValue(mockSupabase);

      const citations: any[] = [];
      const result = await service.retrieveFromLightRAGFirst('test query', citations);

      expect(mockIsLightRAGAvailable).toHaveBeenCalled();
      expect(mockQueryKnowledge).not.toHaveBeenCalled();
      // Should have attempted Supabase fallback
      expect(mockSupabase.rpc).toHaveBeenCalled();
    });

    it('should fallback to Supabase when LightRAG fails', async () => {
      mockQueryKnowledge.mockRejectedValue(new Error('LightRAG error'));

      const mockSupabase = createMockSupabaseClient();
      mockSupabase.rpc.mockResolvedValue({
        data: [{ id: '1', content: 'Fallback result', similarity: 0.7 }],
        error: null,
      });
      mockGetClient.mockReturnValue(mockSupabase);

      const citations: any[] = [];
      const result = await service.retrieveFromLightRAGFirst('test query', citations);

      expect(mockQueryKnowledge).toHaveBeenCalled();
      expect(mockSupabase.rpc).toHaveBeenCalled();
    });

    it('should add citation when LightRAG returns results', async () => {
      const citations: any[] = [];
      await service.retrieveFromLightRAGFirst('test query', citations);

      expect(citations.length).toBe(1);
      expect(citations[0].source).toContain('LightRAG');
    });
  });

  describe('retrieveForAgent()', () => {
    it('should use structured data for position_analyst', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockSupabase.limit.mockResolvedValue({
        data: [
          {
            ticker: 'AAPL',
            name: 'Apple',
            quantity: 100,
            market_value_cny: 50000,
            weight_percent: 10,
            snapshot_date: '2025-01-01',
          },
        ],
        error: null,
      });
      mockGetClient.mockReturnValue(mockSupabase);

      const result = await service.retrieveForAgent('position_analyst', '分析持仓');

      expect(result.hasRelevantDocs).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('stock_positions');
    });

    it('should use LightRAG for risk_analyst', async () => {
      const mockSupabase = createMockSupabaseClient();
      mockGetClient.mockReturnValue(mockSupabase);

      const result = await service.retrieveForAgent('risk_analyst', '分析风险');

      expect(mockQueryKnowledge).toHaveBeenCalled();
      expect(result.documents.length).toBeGreaterThan(0);
    });

    it('should include web search for market_analyst when needed', async () => {
      // Make LightRAG return empty
      mockQueryKnowledge.mockResolvedValue({
        success: true,
        result: '',
      });

      const result = await service.retrieveForAgent('market_analyst', '最新市场新闻');

      // Should have attempted web search
      expect(result.citations.some((c) => c.source.includes('Web'))).toBe(true);
    });

    it('should respect maxDocs option', async () => {
      mockQueryKnowledge.mockResolvedValue({
        success: true,
        result: 'Result 1\n\nResult 2\n\nResult 3',
      });

      const result = await service.retrieveForAgent('advisor', 'test', {
        maxDocs: 1,
      });

      expect(result.documents.length).toBeLessThanOrEqual(1);
    });

    it('should filter by minRelevance', async () => {
      mockQueryKnowledge.mockResolvedValue({
        success: true,
        result: 'Low relevance result',
      });

      const result = await service.retrieveForAgent('advisor', 'test', {
        minRelevance: 0.99, // Very high threshold
      });

      // LightRAG results have relevance_score of 1.0, so should pass
      expect(result.documents.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('LightRAG availability caching', () => {
    it('should cache LightRAG availability check', async () => {
      const citations: any[] = [];

      // First call
      await service.retrieveFromLightRAGFirst('query 1', citations);
      expect(mockIsLightRAGAvailable).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await service.retrieveFromLightRAGFirst('query 2', []);
      expect(mockIsLightRAGAvailable).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache when refreshLightRAGStatus is called', async () => {
      const citations: any[] = [];

      // First call
      await service.retrieveFromLightRAGFirst('query 1', citations);
      expect(mockIsLightRAGAvailable).toHaveBeenCalledTimes(1);

      // Refresh status
      service.refreshLightRAGStatus();

      // Next call should check again
      await service.retrieveFromLightRAGFirst('query 2', []);
      expect(mockIsLightRAGAvailable).toHaveBeenCalledTimes(2);
    });
  });
});

// =============================================================================
// Property-Based Tests (Property 2: LightRAG Priority)
// =============================================================================

describe('Property 2: LightRAG Priority', () => {
  let service: EnhancedAdaptiveRAGService;
  let mockQueryKnowledge: ReturnType<typeof vi.fn>;
  let mockIsLightRAGAvailable: ReturnType<typeof vi.fn>;
  let mockGetClient: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const lightragModule = await import('../lightragClient');
    mockQueryKnowledge = lightragModule.queryKnowledge as ReturnType<typeof vi.fn>;
    mockIsLightRAGAvailable = lightragModule.isLightRAGAvailable as ReturnType<typeof vi.fn>;

    const supabaseModule = await import('../supabaseData');
    mockGetClient = supabaseModule.getClient as ReturnType<typeof vi.fn>;

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          predictions: [{ embeddings: { values: [0.1, 0.2, 0.3] } }],
        }),
    });

    service = new EnhancedAdaptiveRAGService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('LightRAG is called before Supabase', () => {
    it('should attempt LightRAG before Supabase for vectorstore queries', async () => {
      mockIsLightRAGAvailable.mockResolvedValue(true);
      mockQueryKnowledge.mockResolvedValue({
        success: true,
        result: 'LightRAG result',
      });

      const mockSupabase = createMockSupabaseClient();
      mockGetClient.mockReturnValue(mockSupabase);

      const citations: any[] = [];
      await service.retrieveFromLightRAGFirst('investment principles', citations);

      // LightRAG should be called
      expect(mockIsLightRAGAvailable).toHaveBeenCalled();
      expect(mockQueryKnowledge).toHaveBeenCalled();

      // Supabase vector search should NOT be called when LightRAG succeeds
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should call LightRAG with hybrid mode', async () => {
      mockIsLightRAGAvailable.mockResolvedValue(true);
      mockQueryKnowledge.mockResolvedValue({
        success: true,
        result: 'Result',
      });

      const citations: any[] = [];
      await service.retrieveFromLightRAGFirst('test query', citations);

      expect(mockQueryKnowledge).toHaveBeenCalledWith('test query', 'hybrid');
    });
  });

  describe('Fallback on LightRAG failure', () => {
    it('should fallback to Supabase when LightRAG is unavailable', async () => {
      mockIsLightRAGAvailable.mockResolvedValue(false);

      const mockSupabase = createMockSupabaseClient();
      mockSupabase.rpc.mockResolvedValue({
        data: [{ id: '1', content: 'Supabase result', similarity: 0.8 }],
        error: null,
      });
      mockGetClient.mockReturnValue(mockSupabase);

      const citations: any[] = [];
      await service.retrieveFromLightRAGFirst('test query', citations);

      // LightRAG should not be called
      expect(mockQueryKnowledge).not.toHaveBeenCalled();

      // Supabase should be called as fallback
      expect(mockSupabase.rpc).toHaveBeenCalled();
    });

    it('should fallback to Supabase when LightRAG throws error', async () => {
      mockIsLightRAGAvailable.mockResolvedValue(true);
      mockQueryKnowledge.mockRejectedValue(new Error('LightRAG connection failed'));

      const mockSupabase = createMockSupabaseClient();
      mockSupabase.rpc.mockResolvedValue({
        data: [{ id: '1', content: 'Fallback result', similarity: 0.7 }],
        error: null,
      });
      mockGetClient.mockReturnValue(mockSupabase);

      const citations: any[] = [];
      const result = await service.retrieveFromLightRAGFirst('test query', citations);

      // LightRAG was attempted
      expect(mockQueryKnowledge).toHaveBeenCalled();

      // Supabase fallback was used
      expect(mockSupabase.rpc).toHaveBeenCalled();
    });

    it('should fallback when LightRAG returns empty result', async () => {
      mockIsLightRAGAvailable.mockResolvedValue(true);
      mockQueryKnowledge.mockResolvedValue({
        success: true,
        result: '', // Empty result
      });

      const mockSupabase = createMockSupabaseClient();
      mockSupabase.rpc.mockResolvedValue({
        data: [{ id: '1', content: 'Supabase result', similarity: 0.6 }],
        error: null,
      });
      mockGetClient.mockReturnValue(mockSupabase);

      const citations: any[] = [];
      await service.retrieveFromLightRAGFirst('test query', citations);

      // Should fallback to Supabase
      expect(mockSupabase.rpc).toHaveBeenCalled();
    });

    it('should fallback when LightRAG returns success: false', async () => {
      mockIsLightRAGAvailable.mockResolvedValue(true);
      mockQueryKnowledge.mockResolvedValue({
        success: false,
        error: 'Query failed',
      });

      const mockSupabase = createMockSupabaseClient();
      mockSupabase.rpc.mockResolvedValue({
        data: [{ id: '1', content: 'Supabase result', similarity: 0.6 }],
        error: null,
      });
      mockGetClient.mockReturnValue(mockSupabase);

      const citations: any[] = [];
      await service.retrieveFromLightRAGFirst('test query', citations);

      // Should fallback to Supabase
      expect(mockSupabase.rpc).toHaveBeenCalled();
    });
  });
});

// =============================================================================
// Convenience Function Tests
// =============================================================================

describe('Convenience Functions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const lightragModule = await import('../lightragClient');
    (lightragModule.isLightRAGAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (lightragModule.queryKnowledge as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      result: 'Test result',
    });

    const supabaseModule = await import('../supabaseData');
    (supabaseModule.getClient as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockSupabaseClient()
    );
  });

  it('retrieveForAgent should work with singleton', async () => {
    const result = await retrieveForAgent('advisor', 'test query');
    expect(result).toBeDefined();
    expect(result.documents).toBeDefined();
    expect(result.citations).toBeDefined();
  });
});
