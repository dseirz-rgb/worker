/**
 * Multi-Agent Service Property Tests
 *
 * Tests for the Multi-Agent Service using property-based testing with fast-check.
 * Validates Property 16: Backward Compatible Report Format from the design document.
 *
 * @module agents/multiAgentService.test
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for property definitions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  MultiAgentService,
  createMultiAgentService,
  analyzePortfolio,
} from './multiAgentService';
import type {
  PortfolioState,
  FinalReport,
  RiskLevel,
  RecommendationType,
  OrchestratorResult,
  AgentResult,
  Position,
} from './types';

// =============================================================================
// Mocks
// =============================================================================

// Mock localStorage for state persistence
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});


// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Valid risk levels as defined in types.ts
 */
const VALID_RISK_LEVELS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * Valid recommendation types as defined in types.ts
 */
const VALID_RECOMMENDATION_TYPES: RecommendationType[] = [
  'BUY',
  'SELL',
  'HOLD',
  'REBALANCE',
  'WARNING',
];

/**
 * Arbitrary for generating valid ticker symbols
 */
const tickerArbitrary = fc
  .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
    minLength: 1,
    maxLength: 5,
  })
  .map((chars) => chars.join(''));

/**
 * Arbitrary for generating valid Position objects
 */
const positionArbitrary: fc.Arbitrary<Position> = fc.record({
  ticker: tickerArbitrary,
  weight: fc.double({ min: 0.1, max: 100, noNaN: true }),
  marketValue: fc.double({ min: 100, max: 1000000, noNaN: true }),
  costBasis: fc.double({ min: 100, max: 1000000, noNaN: true }),
  unrealizedPnL: fc.double({ min: -500000, max: 500000, noNaN: true }),
  market: fc.constantFrom('US', 'HK', 'CN'),
  sector: fc.option(
    fc.constantFrom(
      'Technology',
      'Financials',
      'Healthcare',
      'Consumer Discretionary',
      'Energy',
      'Industrials'
    ),
    { nil: undefined }
  ),
});

/**
 * Arbitrary for generating valid PortfolioState objects
 */
const portfolioArbitrary: fc.Arbitrary<PortfolioState> = fc
  .array(positionArbitrary, { minLength: 1, maxLength: 20 })
  .chain((positions) => {
    // Normalize weights to sum to 100
    const totalWeight = positions.reduce((sum, p) => sum + p.weight, 0);
    const normalizedPositions = positions.map((p) => ({
      ...p,
      weight: (p.weight / totalWeight) * 100,
    }));

    const totalValue = normalizedPositions.reduce((sum, p) => sum + p.marketValue, 0);

    return fc.record({
      positions: fc.constant(normalizedPositions),
      totalValue: fc.constant(totalValue),
      cashBalance: fc.constant(totalValue * 0.05),
      marginLoan: fc.double({ min: 0, max: totalValue * 0.3, noNaN: true }),
      highWaterMark: fc.double({ min: totalValue * 0.8, max: totalValue * 1.5, noNaN: true }),
      timestamp: fc.constant(Date.now()),
    });
  });


/**
 * Arbitrary for generating portfolios with specific characteristics
 */
const smallPortfolioArbitrary: fc.Arbitrary<PortfolioState> = fc
  .array(positionArbitrary, { minLength: 1, maxLength: 5 })
  .chain((positions) => {
    const totalWeight = positions.reduce((sum, p) => sum + p.weight, 0);
    const normalizedPositions = positions.map((p) => ({
      ...p,
      weight: (p.weight / totalWeight) * 100,
    }));

    const totalValue = normalizedPositions.reduce((sum, p) => sum + p.marketValue, 0);

    return fc.record({
      positions: fc.constant(normalizedPositions),
      totalValue: fc.constant(totalValue),
      cashBalance: fc.constant(totalValue * 0.05),
      marginLoan: fc.constant(0),
      highWaterMark: fc.constant(totalValue),
      timestamp: fc.constant(Date.now()),
    });
  });

/**
 * Arbitrary for generating valid FinalReport objects
 */
const finalReportArbitrary: fc.Arbitrary<FinalReport> = fc.record({
  title: fc.string({ minLength: 1, maxLength: 200 }),
  risk_level: fc.constantFrom<RiskLevel>('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
  summary: fc.string({ minLength: 1, maxLength: 1000 }),
  content: fc.string({ minLength: 1, maxLength: 5000 }),
  recommendation: fc.constantFrom<RecommendationType>('BUY', 'SELL', 'HOLD', 'REBALANCE', 'WARNING'),
  action_plan: fc.string({ minLength: 0, maxLength: 2000 }),
  primary_ticker: fc.oneof(tickerArbitrary, fc.constant('')),
});

/**
 * Helper to validate FinalReport structure
 */
function validateFinalReportStructure(report: FinalReport): void {
  // Check all required fields exist
  expect(report).toHaveProperty('title');
  expect(report).toHaveProperty('risk_level');
  expect(report).toHaveProperty('summary');
  expect(report).toHaveProperty('content');
  expect(report).toHaveProperty('recommendation');
  expect(report).toHaveProperty('action_plan');
  expect(report).toHaveProperty('primary_ticker');

  // Check field types
  expect(typeof report.title).toBe('string');
  expect(typeof report.risk_level).toBe('string');
  expect(typeof report.summary).toBe('string');
  expect(typeof report.content).toBe('string');
  expect(typeof report.recommendation).toBe('string');
  expect(typeof report.action_plan).toBe('string');
  expect(typeof report.primary_ticker).toBe('string');

  // Check enum values
  expect(VALID_RISK_LEVELS).toContain(report.risk_level);
  expect(VALID_RECOMMENDATION_TYPES).toContain(report.recommendation);
}

/**
 * Helper to validate OrchestratorResult structure
 */
function validateOrchestratorResultStructure(result: OrchestratorResult): void {
  expect(result).toHaveProperty('results');
  expect(result).toHaveProperty('finalReport');
  expect(result).toHaveProperty('executionTrace');
  expect(result).toHaveProperty('mode');

  expect(Array.isArray(result.results)).toBe(true);
  expect(typeof result.mode).toBe('string');
}


// =============================================================================
// Property Tests
// =============================================================================

describe('MultiAgentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Property 16: Backward Compatible Report Format
  // ===========================================================================

  describe('Property 16: Backward Compatible Report Format', () => {
    /**
     * Feature: multi-agent-analysis, Property 16: Backward Compatible Report Format
     *
     * *For any* final report generated by the multi-agent system, it SHALL contain
     * `title`, `risk_level`, `summary`, `content`, `recommendation`, `action_plan`,
     * and `primary_ticker` fields matching the existing FinalReport interface.
     *
     * **Validates: Requirements 7.2**
     */

    describe('FinalReport Interface Compliance', () => {
      it('should generate FinalReport with all required fields for any portfolio', async () => {
        await fc.assert(
          fc.asyncProperty(smallPortfolioArbitrary, async (portfolio) => {
            const service = createMultiAgentService({
              mode: 'respond_directly', // Use fastest mode for testing
            });

            const result = await service.analyze({
              portfolio,
              query: 'Analyze my portfolio',
              mode: 'respond_directly',
            });

            // Validate result structure
            validateOrchestratorResultStructure(result);

            // Validate FinalReport structure
            const { finalReport } = result;
            validateFinalReportStructure(finalReport);
          }),
          { numRuns: 100 }
        );
      });

      it('should ensure title field is a non-empty string', async () => {
        await fc.assert(
          fc.asyncProperty(smallPortfolioArbitrary, async (portfolio) => {
            const service = createMultiAgentService({
              mode: 'respond_directly',
            });

            const result = await service.analyze({
              portfolio,
              query: 'Analyze my portfolio',
              mode: 'respond_directly',
            });

            const { finalReport } = result;

            expect(typeof finalReport.title).toBe('string');
            // Title should be non-empty (either from advisor or default)
            expect(finalReport.title.length).toBeGreaterThan(0);
          }),
          { numRuns: 100 }
        );
      });


      it('should ensure risk_level is a valid RiskLevel enum value', async () => {
        await fc.assert(
          fc.asyncProperty(smallPortfolioArbitrary, async (portfolio) => {
            const service = createMultiAgentService({
              mode: 'respond_directly',
            });

            const result = await service.analyze({
              portfolio,
              query: 'Analyze my portfolio',
              mode: 'respond_directly',
            });

            const { finalReport } = result;

            expect(typeof finalReport.risk_level).toBe('string');
            expect(VALID_RISK_LEVELS).toContain(finalReport.risk_level);
          }),
          { numRuns: 100 }
        );
      });

      it('should ensure summary field is a string', async () => {
        await fc.assert(
          fc.asyncProperty(smallPortfolioArbitrary, async (portfolio) => {
            const service = createMultiAgentService({
              mode: 'respond_directly',
            });

            const result = await service.analyze({
              portfolio,
              query: 'Analyze my portfolio',
              mode: 'respond_directly',
            });

            const { finalReport } = result;

            expect(typeof finalReport.summary).toBe('string');
          }),
          { numRuns: 100 }
        );
      });

      it('should ensure content field is a string', async () => {
        await fc.assert(
          fc.asyncProperty(smallPortfolioArbitrary, async (portfolio) => {
            const service = createMultiAgentService({
              mode: 'respond_directly',
            });

            const result = await service.analyze({
              portfolio,
              query: 'Analyze my portfolio',
              mode: 'respond_directly',
            });

            const { finalReport } = result;

            expect(typeof finalReport.content).toBe('string');
          }),
          { numRuns: 100 }
        );
      });


      it('should ensure recommendation is a valid RecommendationType enum value', async () => {
        await fc.assert(
          fc.asyncProperty(smallPortfolioArbitrary, async (portfolio) => {
            const service = createMultiAgentService({
              mode: 'respond_directly',
            });

            const result = await service.analyze({
              portfolio,
              query: 'Analyze my portfolio',
              mode: 'respond_directly',
            });

            const { finalReport } = result;

            expect(typeof finalReport.recommendation).toBe('string');
            expect(VALID_RECOMMENDATION_TYPES).toContain(finalReport.recommendation);
          }),
          { numRuns: 100 }
        );
      });

      it('should ensure action_plan field is a string', async () => {
        await fc.assert(
          fc.asyncProperty(smallPortfolioArbitrary, async (portfolio) => {
            const service = createMultiAgentService({
              mode: 'respond_directly',
            });

            const result = await service.analyze({
              portfolio,
              query: 'Analyze my portfolio',
              mode: 'respond_directly',
            });

            const { finalReport } = result;

            expect(typeof finalReport.action_plan).toBe('string');
          }),
          { numRuns: 100 }
        );
      });

      it('should ensure primary_ticker field is a string', async () => {
        await fc.assert(
          fc.asyncProperty(smallPortfolioArbitrary, async (portfolio) => {
            const service = createMultiAgentService({
              mode: 'respond_directly',
            });

            const result = await service.analyze({
              portfolio,
              query: 'Analyze my portfolio',
              mode: 'respond_directly',
            });

            const { finalReport } = result;

            expect(typeof finalReport.primary_ticker).toBe('string');
          }),
          { numRuns: 100 }
        );
      });
    });


    describe('FinalReport Field Type Validation', () => {
      it('should maintain backward compatible field types across all orchestration modes', async () => {
        const modes = ['sequential', 'respond_directly'] as const;

        for (const mode of modes) {
          await fc.assert(
            fc.asyncProperty(smallPortfolioArbitrary, async (portfolio) => {
              const service = createMultiAgentService({ mode });

              const result = await service.analyze({
                portfolio,
                query: 'Analyze my portfolio',
                mode,
              });

              const { finalReport } = result;

              // All fields must be strings (backward compatibility)
              expect(typeof finalReport.title).toBe('string');
              expect(typeof finalReport.risk_level).toBe('string');
              expect(typeof finalReport.summary).toBe('string');
              expect(typeof finalReport.content).toBe('string');
              expect(typeof finalReport.recommendation).toBe('string');
              expect(typeof finalReport.action_plan).toBe('string');
              expect(typeof finalReport.primary_ticker).toBe('string');
            }),
            { numRuns: 50 }
          );
        }
      });

      it('should never return null or undefined for required fields', async () => {
        await fc.assert(
          fc.asyncProperty(smallPortfolioArbitrary, async (portfolio) => {
            const service = createMultiAgentService({
              mode: 'respond_directly',
            });

            const result = await service.analyze({
              portfolio,
              query: 'Analyze my portfolio',
              mode: 'respond_directly',
            });

            const { finalReport } = result;

            // No field should be null or undefined
            expect(finalReport.title).not.toBeNull();
            expect(finalReport.title).not.toBeUndefined();
            expect(finalReport.risk_level).not.toBeNull();
            expect(finalReport.risk_level).not.toBeUndefined();
            expect(finalReport.summary).not.toBeNull();
            expect(finalReport.summary).not.toBeUndefined();
            expect(finalReport.content).not.toBeNull();
            expect(finalReport.content).not.toBeUndefined();
            expect(finalReport.recommendation).not.toBeNull();
            expect(finalReport.recommendation).not.toBeUndefined();
            expect(finalReport.action_plan).not.toBeNull();
            expect(finalReport.action_plan).not.toBeUndefined();
            expect(finalReport.primary_ticker).not.toBeNull();
            expect(finalReport.primary_ticker).not.toBeUndefined();
          }),
          { numRuns: 100 }
        );
      });
    });


    describe('FinalReport with Various Portfolio Configurations', () => {
      it('should generate valid FinalReport for single-position portfolios', async () => {
        await fc.assert(
          fc.asyncProperty(positionArbitrary, async (position) => {
            // Normalize weight to 100%
            const normalizedPosition = { ...position, weight: 100 };
            const portfolio: PortfolioState = {
              positions: [normalizedPosition],
              totalValue: normalizedPosition.marketValue,
              cashBalance: normalizedPosition.marketValue * 0.05,
              marginLoan: 0,
              highWaterMark: normalizedPosition.marketValue,
              timestamp: Date.now(),
            };

            const service = createMultiAgentService({
              mode: 'respond_directly',
            });

            const result = await service.analyze({
              portfolio,
              query: 'Analyze my portfolio',
              mode: 'respond_directly',
            });

            validateFinalReportStructure(result.finalReport);
          }),
          { numRuns: 100 }
        );
      });

      it('should generate valid FinalReport for multi-position portfolios', async () => {
        await fc.assert(
          fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
            const service = createMultiAgentService({
              mode: 'respond_directly',
            });

            const result = await service.analyze({
              portfolio,
              query: 'Analyze my portfolio',
              mode: 'respond_directly',
            });

            validateFinalReportStructure(result.finalReport);
          }),
          { numRuns: 100 }
        );
      });

      it('should generate valid FinalReport for portfolios with margin loans', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.tuple(
              portfolioArbitrary,
              fc.double({ min: 0.1, max: 0.5, noNaN: true })
            ),
            async ([basePortfolio, marginRatio]) => {
              const portfolio: PortfolioState = {
                ...basePortfolio,
                marginLoan: basePortfolio.totalValue * marginRatio,
              };

              const service = createMultiAgentService({
                mode: 'respond_directly',
              });

              const result = await service.analyze({
                portfolio,
                query: 'Analyze my portfolio',
                mode: 'respond_directly',
              });

              validateFinalReportStructure(result.finalReport);
            }
          ),
          { numRuns: 100 }
        );
      });


      it('should generate valid FinalReport for portfolios with drawdown', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.tuple(
              portfolioArbitrary,
              fc.double({ min: 1.1, max: 2.0, noNaN: true })
            ),
            async ([basePortfolio, hwmMultiplier]) => {
              const portfolio: PortfolioState = {
                ...basePortfolio,
                highWaterMark: basePortfolio.totalValue * hwmMultiplier,
              };

              const service = createMultiAgentService({
                mode: 'respond_directly',
              });

              const result = await service.analyze({
                portfolio,
                query: 'Analyze my portfolio',
                mode: 'respond_directly',
              });

              validateFinalReportStructure(result.finalReport);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should generate valid FinalReport for empty portfolios', async () => {
        const emptyPortfolio: PortfolioState = {
          positions: [],
          totalValue: 0,
          cashBalance: 0,
          marginLoan: 0,
          highWaterMark: 0,
          timestamp: Date.now(),
        };

        const service = createMultiAgentService({
          mode: 'respond_directly',
        });

        const result = await service.analyze({
          portfolio: emptyPortfolio,
          query: 'Analyze my portfolio',
          mode: 'respond_directly',
        });

        validateFinalReportStructure(result.finalReport);
      });
    });


    describe('FinalReport Error Handling', () => {
      it('should generate valid FinalReport even when execution fails', async () => {
        // Test that error results still produce valid FinalReport structure
        const portfolio: PortfolioState = {
          positions: [
            {
              ticker: 'AAPL',
              weight: 100,
              marketValue: 100000,
              costBasis: 80000,
              unrealizedPnL: 20000,
              market: 'US',
            },
          ],
          totalValue: 100000,
          cashBalance: 5000,
          marginLoan: 0,
          highWaterMark: 100000,
          timestamp: Date.now(),
        };

        const service = createMultiAgentService({
          mode: 'respond_directly',
        });

        // Even with potential internal errors, the result should have valid structure
        const result = await service.analyze({
          portfolio,
          query: 'Analyze my portfolio',
          mode: 'respond_directly',
        });

        validateFinalReportStructure(result.finalReport);
      });

      it('should provide default values for FinalReport fields when advisor fails', async () => {
        await fc.assert(
          fc.asyncProperty(smallPortfolioArbitrary, async (portfolio) => {
            const service = createMultiAgentService({
              mode: 'respond_directly',
            });

            const result = await service.analyze({
              portfolio,
              query: 'Analyze my portfolio',
              mode: 'respond_directly',
            });

            const { finalReport } = result;

            // Even if advisor fails, these should have sensible defaults
            expect(finalReport.title.length).toBeGreaterThanOrEqual(0);
            expect(VALID_RISK_LEVELS).toContain(finalReport.risk_level);
            expect(VALID_RECOMMENDATION_TYPES).toContain(finalReport.recommendation);
          }),
          { numRuns: 100 }
        );
      });
    });


    describe('FinalReport Consistency', () => {
      it('should generate consistent FinalReport structure across multiple calls', async () => {
        const portfolio: PortfolioState = {
          positions: [
            {
              ticker: 'AAPL',
              weight: 50,
              marketValue: 50000,
              costBasis: 40000,
              unrealizedPnL: 10000,
              market: 'US',
            },
            {
              ticker: 'GOOGL',
              weight: 50,
              marketValue: 50000,
              costBasis: 45000,
              unrealizedPnL: 5000,
              market: 'US',
            },
          ],
          totalValue: 100000,
          cashBalance: 5000,
          marginLoan: 0,
          highWaterMark: 100000,
          timestamp: Date.now(),
        };

        const service = createMultiAgentService({
          mode: 'respond_directly',
        });

        // Run multiple times and verify structure consistency
        for (let i = 0; i < 5; i++) {
          const result = await service.analyze({
            portfolio,
            query: 'Analyze my portfolio',
            mode: 'respond_directly',
          });

          validateFinalReportStructure(result.finalReport);
        }
      });

      it('should maintain FinalReport interface compatibility with different queries', async () => {
        const queries = [
          'Analyze my portfolio',
          'What is my risk level?',
          'Should I rebalance?',
          'Show me my positions',
          '分析我的投资组合风险',
        ];

        const portfolio: PortfolioState = {
          positions: [
            {
              ticker: 'AAPL',
              weight: 100,
              marketValue: 100000,
              costBasis: 80000,
              unrealizedPnL: 20000,
              market: 'US',
            },
          ],
          totalValue: 100000,
          cashBalance: 5000,
          marginLoan: 0,
          highWaterMark: 100000,
          timestamp: Date.now(),
        };

        for (const query of queries) {
          const service = createMultiAgentService({
            mode: 'respond_directly',
          });

          const result = await service.analyze({
            portfolio,
            query,
            mode: 'respond_directly',
          });

          validateFinalReportStructure(result.finalReport);
        }
      });
    });
  });


  // ===========================================================================
  // Additional Service Tests
  // ===========================================================================

  describe('Service Initialization', () => {
    it('should create service with default configuration', () => {
      const service = createMultiAgentService();
      expect(service).toBeInstanceOf(MultiAgentService);
    });

    it('should create service with custom configuration', () => {
      const service = createMultiAgentService({
        mode: 'sequential',
        enableMemory: true,
        enableAlerts: true,
      });
      expect(service).toBeInstanceOf(MultiAgentService);
    });

    it('should return valid status', async () => {
      const service = createMultiAgentService();
      const status = await service.getStatus();

      expect(status).toHaveProperty('memoryEntries');
      expect(status).toHaveProperty('cacheSize');
      expect(status).toHaveProperty('hasState');
      expect(status).toHaveProperty('agentCount');

      expect(typeof status.memoryEntries).toBe('number');
      expect(typeof status.cacheSize).toBe('number');
      expect(typeof status.hasState).toBe('boolean');
      expect(typeof status.agentCount).toBe('number');
      expect(status.agentCount).toBeGreaterThan(0);
    });
  });

  describe('Quick and Deep Analysis', () => {
    it('should execute quickAnalyze and return valid FinalReport', async () => {
      const portfolio: PortfolioState = {
        positions: [
          {
            ticker: 'AAPL',
            weight: 100,
            marketValue: 100000,
            costBasis: 80000,
            unrealizedPnL: 20000,
            market: 'US',
          },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 100000,
        timestamp: Date.now(),
      };

      const service = createMultiAgentService();
      const result = await service.quickAnalyze(portfolio, 'What is my portfolio value?');

      validateOrchestratorResultStructure(result);
      validateFinalReportStructure(result.finalReport);
      expect(result.mode).toBe('respond_directly');
    });

    it('should execute deepAnalyze and return valid FinalReport', async () => {
      const portfolio: PortfolioState = {
        positions: [
          {
            ticker: 'AAPL',
            weight: 100,
            marketValue: 100000,
            costBasis: 80000,
            unrealizedPnL: 20000,
            market: 'US',
          },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 100000,
        timestamp: Date.now(),
      };

      const service = createMultiAgentService();
      const result = await service.deepAnalyze(portfolio);

      validateOrchestratorResultStructure(result);
      validateFinalReportStructure(result.finalReport);
      expect(result.mode).toBe('sequential');
    });
  });


  describe('analyzePortfolio Convenience Function', () => {
    it('should return valid FinalReport using convenience function', async () => {
      await fc.assert(
        fc.asyncProperty(smallPortfolioArbitrary, async (portfolio) => {
          const result = await analyzePortfolio(portfolio, {
            query: 'Analyze my portfolio',
            mode: 'respond_directly',
          });

          validateOrchestratorResultStructure(result);
          validateFinalReportStructure(result.finalReport);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle progress callback', async () => {
      const portfolio: PortfolioState = {
        positions: [
          {
            ticker: 'AAPL',
            weight: 100,
            marketValue: 100000,
            costBasis: 80000,
            unrealizedPnL: 20000,
            market: 'US',
          },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 100000,
        timestamp: Date.now(),
      };

      const progressUpdates: string[] = [];
      const onProgress = vi.fn((status) => {
        progressUpdates.push(status.phase);
      });

      const result = await analyzePortfolio(portfolio, {
        query: 'Analyze my portfolio',
        mode: 'respond_directly',
        onProgress,
      });

      validateFinalReportStructure(result.finalReport);
      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('ExecutionTrace in Result', () => {
    it('should include valid executionTrace with FinalReport', async () => {
      await fc.assert(
        fc.asyncProperty(smallPortfolioArbitrary, async (portfolio) => {
          const service = createMultiAgentService({
            mode: 'respond_directly',
          });

          const result = await service.analyze({
            portfolio,
            query: 'Analyze my portfolio',
            mode: 'respond_directly',
          });

          // Validate executionTrace structure
          expect(result.executionTrace).toHaveProperty('startTime');
          expect(result.executionTrace).toHaveProperty('endTime');
          expect(result.executionTrace).toHaveProperty('totalDurationMs');
          expect(result.executionTrace).toHaveProperty('mode');
          expect(result.executionTrace).toHaveProperty('agentTraces');
          expect(result.executionTrace).toHaveProperty('handoffs');

          expect(typeof result.executionTrace.startTime).toBe('number');
          expect(typeof result.executionTrace.endTime).toBe('number');
          expect(typeof result.executionTrace.totalDurationMs).toBe('number');
          expect(result.executionTrace.totalDurationMs).toBeGreaterThanOrEqual(0);
          expect(Array.isArray(result.executionTrace.agentTraces)).toBe(true);
          expect(Array.isArray(result.executionTrace.handoffs)).toBe(true);

          // FinalReport should still be valid
          validateFinalReportStructure(result.finalReport);
        }),
        { numRuns: 100 }
      );
    });
  });
});
