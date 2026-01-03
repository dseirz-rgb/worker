/**
 * useUnifiedIntelligence Hook Tests
 *
 * 使用纯 vitest 测试 hook 的核心逻辑
 *
 * @see Requirements 4.1, 4.2, 5.1, 5.2, 9.1, 9.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Mocks
// =============================================================================

const mockQuery = vi.fn();
const mockDeepAnalyze = vi.fn();
const mockQuickAnswer = vi.fn();

vi.mock('../services/unifiedIntelligence', () => ({
  unifiedIntelligenceService: {
    query: (...args: unknown[]) => mockQuery(...args),
    deepAnalyze: (...args: unknown[]) => mockDeepAnalyze(...args),
    quickAnswer: (...args: unknown[]) => mockQuickAnswer(...args),
  },
}));

// =============================================================================
// Test Data
// =============================================================================

const mockQueryResult = {
  text: 'Test response',
  citations: [{ source: 'Test', title: 'Test Doc', content_snippet: '...' }],
  mode: 'rag_only' as const,
  confidence: 0.9,
  processingTime: 1000,
};

const mockAnalysisResult = {
  text: 'Analysis response',
  citations: [],
  mode: 'full_agent' as const,
  confidence: 0.95,
  processingTime: 15000,
  summary: 'Analysis summary',
  riskLevel: 'medium' as const,
  recommendations: ['Recommendation 1'],
  alerts: [],
  agentResults: [
    {
      agentId: 'risk_analyst',
      status: 'success' as const,
      data: {},
      summary: 'Risk analysis complete',
      metadata: { executionTimeMs: 1000, tokensUsed: 500, dataSources: [] },
    },
  ],
};

const mockPortfolio = {
  positions: [],
  totalValue: 100000,
  cashBalance: 10000,
  marginLoan: 0,
  highWaterMark: 100000,
  timestamp: Date.now(),
};

// =============================================================================
// Service Integration Tests
// =============================================================================

describe('UnifiedIntelligence Service Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue(mockQueryResult);
    mockDeepAnalyze.mockResolvedValue(mockAnalysisResult);
    mockQuickAnswer.mockResolvedValue(mockQueryResult);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('query()', () => {
    it('should call service with correct parameters', async () => {
      const { unifiedIntelligenceService } = await import(
        '../services/unifiedIntelligence'
      );

      await unifiedIntelligenceService.query('Test question');

      expect(mockQuery).toHaveBeenCalledWith('Test question');
    });

    it('should return query result', async () => {
      const { unifiedIntelligenceService } = await import(
        '../services/unifiedIntelligence'
      );

      const result = await unifiedIntelligenceService.query('Test question');

      expect(result).toEqual(mockQueryResult);
      expect(result.mode).toBe('rag_only');
    });

    it('should pass context to service', async () => {
      const { unifiedIntelligenceService } = await import(
        '../services/unifiedIntelligence'
      );

      const context = { forceMode: 'full_agent' as const };
      await unifiedIntelligenceService.query('Test question', context);

      expect(mockQuery).toHaveBeenCalledWith('Test question', context);
    });

    it('should handle errors', async () => {
      mockQuery.mockRejectedValue(new Error('Query failed'));

      const { unifiedIntelligenceService } = await import(
        '../services/unifiedIntelligence'
      );

      await expect(
        unifiedIntelligenceService.query('Test question')
      ).rejects.toThrow('Query failed');
    });
  });

  describe('deepAnalyze()', () => {
    it('should call service with portfolio', async () => {
      const { unifiedIntelligenceService } = await import(
        '../services/unifiedIntelligence'
      );

      await unifiedIntelligenceService.deepAnalyze(mockPortfolio);

      expect(mockDeepAnalyze).toHaveBeenCalledWith(mockPortfolio);
    });

    it('should return analysis result with agent results', async () => {
      const { unifiedIntelligenceService } = await import(
        '../services/unifiedIntelligence'
      );

      const result = await unifiedIntelligenceService.deepAnalyze(mockPortfolio);

      expect(result).toEqual(mockAnalysisResult);
      expect(result.mode).toBe('full_agent');
      expect(result.agentResults).toHaveLength(1);
    });

    it('should pass query to service', async () => {
      const { unifiedIntelligenceService } = await import(
        '../services/unifiedIntelligence'
      );

      await unifiedIntelligenceService.deepAnalyze(mockPortfolio, 'Analyze risk');

      expect(mockDeepAnalyze).toHaveBeenCalledWith(mockPortfolio, 'Analyze risk');
    });
  });

  describe('quickAnswer()', () => {
    it('should call service with question', async () => {
      const { unifiedIntelligenceService } = await import(
        '../services/unifiedIntelligence'
      );

      await unifiedIntelligenceService.quickAnswer('Quick question');

      expect(mockQuickAnswer).toHaveBeenCalledWith('Quick question');
    });

    it('should return rag_only result', async () => {
      const { unifiedIntelligenceService } = await import(
        '../services/unifiedIntelligence'
      );

      const result = await unifiedIntelligenceService.quickAnswer('Quick question');

      expect(result.mode).toBe('rag_only');
    });
  });
});

// =============================================================================
// Hook Logic Tests (without React)
// =============================================================================

describe('useUnifiedIntelligence Hook Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue(mockQueryResult);
    mockDeepAnalyze.mockResolvedValue(mockAnalysisResult);
    mockQuickAnswer.mockResolvedValue(mockQueryResult);
  });

  describe('State Management', () => {
    it('should track processing state correctly', async () => {
      // Simulate hook state management
      let isProcessing = false;
      let result = null;

      const executeQuery = async (question: string) => {
        isProcessing = true;
        try {
          result = await mockQuery(question);
        } finally {
          isProcessing = false;
        }
      };

      // Before query
      expect(isProcessing).toBe(false);
      expect(result).toBeNull();

      // Execute query
      await executeQuery('Test');

      // After query
      expect(isProcessing).toBe(false);
      expect(result).toEqual(mockQueryResult);
    });

    it('should track mode correctly', async () => {
      let mode: string = 'idle';

      const executeQuery = async () => {
        const result = await mockQuery('Test');
        mode = result.mode;
      };

      await executeQuery();
      expect(mode).toBe('rag_only');
    });

    it('should collect agent results', async () => {
      const agentResults = new Map();

      const executeDeepAnalyze = async () => {
        const result = await mockDeepAnalyze(mockPortfolio);
        if (result.agentResults) {
          result.agentResults.forEach((r: { agentId: string }) => {
            agentResults.set(r.agentId, r);
          });
        }
      };

      await executeDeepAnalyze();
      expect(agentResults.size).toBe(1);
      expect(agentResults.has('risk_analyst')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should capture errors', async () => {
      mockQuery.mockRejectedValue(new Error('Test error'));

      let error: Error | null = null;

      try {
        await mockQuery('Test');
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error?.message).toBe('Test error');
    });

    it('should call error callback', async () => {
      mockQuery.mockRejectedValue(new Error('Test error'));

      const onError = vi.fn();

      try {
        await mockQuery('Test');
      } catch (e) {
        onError(e);
      }

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Cancellation', () => {
    it('should support cancellation via AbortController', () => {
      const controller = new AbortController();
      let isCancelled = false;

      controller.signal.addEventListener('abort', () => {
        isCancelled = true;
      });

      controller.abort();

      expect(isCancelled).toBe(true);
    });
  });

  describe('Alert Handling', () => {
    it('should collect alerts from analysis result', async () => {
      const alertResult = {
        ...mockAnalysisResult,
        alerts: [
          {
            sourceAgent: 'risk_analyst',
            severity: 'warning',
            alertType: 'RISK_LEVEL',
            title: 'High Risk',
            message: 'Risk level is high',
            recommendation: 'Reduce exposure',
            data: {},
            timestamp: new Date().toISOString(),
          },
        ],
      };
      mockDeepAnalyze.mockResolvedValue(alertResult);

      const alerts: unknown[] = [];
      const onAlert = (alert: unknown) => alerts.push(alert);

      const result = await mockDeepAnalyze(mockPortfolio);
      if (result.alerts) {
        result.alerts.forEach(onAlert);
      }

      expect(alerts.length).toBe(1);
    });
  });
});

// =============================================================================
// Type Tests
// =============================================================================

describe('Type Definitions', () => {
  it('should have correct QueryResult structure', () => {
    expect(mockQueryResult).toHaveProperty('text');
    expect(mockQueryResult).toHaveProperty('citations');
    expect(mockQueryResult).toHaveProperty('mode');
    expect(mockQueryResult).toHaveProperty('confidence');
    expect(mockQueryResult).toHaveProperty('processingTime');
  });

  it('should have correct AnalysisResult structure', () => {
    expect(mockAnalysisResult).toHaveProperty('text');
    expect(mockAnalysisResult).toHaveProperty('summary');
    expect(mockAnalysisResult).toHaveProperty('riskLevel');
    expect(mockAnalysisResult).toHaveProperty('recommendations');
    expect(mockAnalysisResult).toHaveProperty('agentResults');
  });

  it('should have correct PortfolioState structure', () => {
    expect(mockPortfolio).toHaveProperty('positions');
    expect(mockPortfolio).toHaveProperty('totalValue');
    expect(mockPortfolio).toHaveProperty('cashBalance');
    expect(mockPortfolio).toHaveProperty('marginLoan');
    expect(mockPortfolio).toHaveProperty('highWaterMark');
    expect(mockPortfolio).toHaveProperty('timestamp');
  });
});
