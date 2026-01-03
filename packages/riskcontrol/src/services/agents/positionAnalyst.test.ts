/**
 * Position Analyst Agent Property Tests
 *
 * Tests for the Position Analyst Agent using property-based testing with fast-check.
 * Validates Properties 5, 6, and 19 from the design document.
 *
 * @module agents/positionAnalyst.test
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for property definitions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  PositionAnalystAgent,
  createPositionAnalystAgent,
} from './positionAnalyst';
import type {
  AgentContext,
  PortfolioState,
  Position,
  AgentResult,
  ConcentrationAnalysis,
} from './types';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock AgentContext for testing
 */
function createMockContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    query: 'Analyze portfolio',
    previousResults: new Map(),
    userNotes: '',
    externalData: {
      news: new Map(),
      secFilings: new Map(),
      articleContent: new Map(),
    },
    messageThread: [],
    mode: 'sequential',
    ...overrides,
  };
}

/**
 * Arbitrary for generating valid Position objects
 */
const tickerArbitrary = fc
  .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
    minLength: 1,
    maxLength: 5,
  })
  .map((chars) => chars.join(''));

const positionArbitrary = fc.record({
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
const portfolioArbitrary = fc
  .array(positionArbitrary, { minLength: 1, maxLength: 20 })
  .map((positions) => {
    // Normalize weights to sum to 100
    const totalWeight = positions.reduce((sum, p) => sum + p.weight, 0);
    const normalizedPositions = positions.map((p) => ({
      ...p,
      weight: (p.weight / totalWeight) * 100,
    }));

    const totalValue = normalizedPositions.reduce((sum, p) => sum + p.marketValue, 0);

    return {
      positions: normalizedPositions,
      totalValue,
      cashBalance: totalValue * 0.05,
      marginLoan: 0,
      highWaterMark: totalValue * 1.1,
      timestamp: Date.now(),
    } as PortfolioState;
  });

/**
 * Arbitrary for generating portfolios with at least one high concentration position (>30%)
 */
const highConcentrationPortfolioArbitrary = fc
  .tuple(
    fc.double({ min: 31, max: 80, noNaN: true }), // High weight position
    fc.array(positionArbitrary, { minLength: 1, maxLength: 10 })
  )
  .map(([highWeight, otherPositions]) => {
    // Create a high concentration position
    const highConcentrationPosition: Position = {
      ticker: 'MEGA',
      weight: highWeight,
      marketValue: 500000,
      costBasis: 400000,
      unrealizedPnL: 100000,
      market: 'US',
      sector: 'Technology',
    };

    // Normalize other positions to fill remaining weight
    const remainingWeight = 100 - highWeight;
    const otherTotalWeight = otherPositions.reduce((sum, p) => sum + p.weight, 0);
    const normalizedOthers = otherPositions.map((p) => ({
      ...p,
      weight: otherTotalWeight > 0 ? (p.weight / otherTotalWeight) * remainingWeight : 0,
    }));

    const allPositions = [highConcentrationPosition, ...normalizedOthers];
    const totalValue = allPositions.reduce((sum, p) => sum + p.marketValue, 0);

    return {
      positions: allPositions,
      totalValue,
      cashBalance: totalValue * 0.05,
      marginLoan: 0,
      highWaterMark: totalValue * 1.1,
      timestamp: Date.now(),
    } as PortfolioState;
  });

// =============================================================================
// Mock Gemini API
// =============================================================================

// Mock the Gemini API to avoid actual API calls during tests
vi.mock('./positionAnalyst', async (importOriginal) => {
  const original = await importOriginal<typeof import('./positionAnalyst')>();
  
  // Create a modified class that doesn't call the real API
  class MockPositionAnalystAgent extends original.PositionAnalystAgent {
    // Override the private method by accessing it through prototype
    constructor(...args: ConstructorParameters<typeof original.PositionAnalystAgent>) {
      super(...args);
      // @ts-expect-error - accessing private method for testing
      this.callGeminiAPI = async () => ({
        text: 'Mock summary for testing',
        tokensUsed: 100,
      });
    }
  }

  return {
    ...original,
    PositionAnalystAgent: MockPositionAnalystAgent,
    createPositionAnalystAgent: (personality?: any, memory?: any) =>
      new MockPositionAnalystAgent(personality, memory),
  };
});

// =============================================================================
// Property Tests
// =============================================================================

describe('PositionAnalystAgent', () => {
  let agent: PositionAnalystAgent;

  beforeEach(() => {
    agent = createPositionAnalystAgent();
  });

  // ===========================================================================
  // Property 5: Position Analyst Output Schema
  // ===========================================================================

  describe('Property 5: Position Analyst Output Schema', () => {
    /**
     * Feature: multi-agent-analysis, Property 5: Position Analyst Output Schema
     *
     * *For any* valid portfolio input, the Position Analyst SHALL return an
     * AgentResult where `data` contains `concentration_analysis`,
     * `correlation_risks`, and `performance_attribution` fields with valid structures.
     *
     * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
     */
    it('should return AgentResult with required data fields for any valid portfolio', async () => {
      await fc.assert(
        fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
          const context = createMockContext();
          const result = await agent.execute(context, portfolio);

          // Verify result is an AgentResult (not HandoffMessage)
          expect(result).toHaveProperty('agentId', 'position_analyst');
          expect(result).toHaveProperty('status');
          expect(result).toHaveProperty('data');
          expect(result).toHaveProperty('summary');
          expect(result).toHaveProperty('metadata');

          const agentResult = result as AgentResult;

          // Verify data contains required fields
          expect(agentResult.data).toHaveProperty('concentration_analysis');
          expect(agentResult.data).toHaveProperty('correlation_risks');
          expect(agentResult.data).toHaveProperty('performance_attribution');

          // Verify concentration_analysis structure
          const concentration = agentResult.data.concentration_analysis as ConcentrationAnalysis;
          expect(concentration).toHaveProperty('top3_positions');
          expect(concentration).toHaveProperty('top3_total_weight');
          expect(concentration).toHaveProperty('high_concentration_flags');
          expect(concentration).toHaveProperty('herfindahl_index');
          expect(Array.isArray(concentration.top3_positions)).toBe(true);
          expect(Array.isArray(concentration.high_concentration_flags)).toBe(true);
          expect(typeof concentration.top3_total_weight).toBe('number');
          expect(typeof concentration.herfindahl_index).toBe('number');

          // Verify correlation_risks is an array
          expect(Array.isArray(agentResult.data.correlation_risks)).toBe(true);

          // Verify performance_attribution structure
          const performance = agentResult.data.performance_attribution as Record<string, unknown>;
          expect(performance).toHaveProperty('totalUnrealizedPnL');
          expect(performance).toHaveProperty('totalPnLPercent');
          expect(performance).toHaveProperty('topGainers');
          expect(performance).toHaveProperty('topLosers');
          expect(performance).toHaveProperty('allPositions');
        }),
        { numRuns: 100 }
      );
    });

    it('should return valid metadata for any portfolio', async () => {
      await fc.assert(
        fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
          const context = createMockContext();
          const result = (await agent.execute(context, portfolio)) as AgentResult;

          // Verify metadata structure
          expect(result.metadata).toHaveProperty('executionTimeMs');
          expect(result.metadata).toHaveProperty('tokensUsed');
          expect(result.metadata).toHaveProperty('dataSources');

          expect(typeof result.metadata.executionTimeMs).toBe('number');
          expect(result.metadata.executionTimeMs).toBeGreaterThanOrEqual(0);
          expect(typeof result.metadata.tokensUsed).toBe('number');
          expect(Array.isArray(result.metadata.dataSources)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty portfolio gracefully', async () => {
      const emptyPortfolio: PortfolioState = {
        positions: [],
        totalValue: 0,
        cashBalance: 0,
        marginLoan: 0,
        highWaterMark: 0,
        timestamp: Date.now(),
      };

      const context = createMockContext();
      const result = (await agent.execute(context, emptyPortfolio)) as AgentResult;

      // Should still return valid structure
      expect(result.agentId).toBe('position_analyst');
      expect(result.data).toHaveProperty('concentration_analysis');
      expect(result.data).toHaveProperty('correlation_risks');
      expect(result.data).toHaveProperty('performance_attribution');

      // Empty portfolio should have empty arrays
      const concentration = result.data.concentration_analysis as ConcentrationAnalysis;
      expect(concentration.top3_positions).toHaveLength(0);
      expect(concentration.high_concentration_flags).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Property 6: High Concentration Detection
  // ===========================================================================

  describe('Property 6: High Concentration Detection', () => {
    /**
     * Feature: multi-agent-analysis, Property 6: High Concentration Detection
     *
     * *For any* portfolio containing a position with weight > 30%, the Position
     * Analyst's `concentration_analysis.high_concentration_flags` array SHALL
     * include that position's ticker.
     *
     * **Validates: Requirements 2.5**
     */
    it('should flag all positions with weight > 30%', async () => {
      await fc.assert(
        fc.asyncProperty(highConcentrationPortfolioArbitrary, async (portfolio) => {
          const context = createMockContext();
          const result = (await agent.execute(context, portfolio)) as AgentResult;

          const concentration = result.data.concentration_analysis as ConcentrationAnalysis;

          // Find all positions with weight > 30%
          const highWeightTickers = portfolio.positions
            .filter((p) => p.weight > 30)
            .map((p) => p.ticker);

          // All high weight tickers should be flagged
          for (const ticker of highWeightTickers) {
            expect(concentration.high_concentration_flags).toContain(ticker);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should not flag positions with weight <= 30%', async () => {
      // Create a portfolio where all positions are <= 30%
      const lowConcentrationPortfolio: PortfolioState = {
        positions: [
          { ticker: 'AAPL', weight: 25, marketValue: 25000, costBasis: 20000, unrealizedPnL: 5000, market: 'US' },
          { ticker: 'GOOGL', weight: 25, marketValue: 25000, costBasis: 22000, unrealizedPnL: 3000, market: 'US' },
          { ticker: 'MSFT', weight: 25, marketValue: 25000, costBasis: 23000, unrealizedPnL: 2000, market: 'US' },
          { ticker: 'AMZN', weight: 25, marketValue: 25000, costBasis: 24000, unrealizedPnL: 1000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const context = createMockContext();
      const result = (await agent.execute(context, lowConcentrationPortfolio)) as AgentResult;

      const concentration = result.data.concentration_analysis as ConcentrationAnalysis;
      expect(concentration.high_concentration_flags).toHaveLength(0);
    });

    it('should flag exactly the positions above threshold', async () => {
      // Create a portfolio with known weights
      const mixedPortfolio: PortfolioState = {
        positions: [
          { ticker: 'HIGH1', weight: 35, marketValue: 35000, costBasis: 30000, unrealizedPnL: 5000, market: 'US' },
          { ticker: 'HIGH2', weight: 40, marketValue: 40000, costBasis: 35000, unrealizedPnL: 5000, market: 'US' },
          { ticker: 'LOW1', weight: 15, marketValue: 15000, costBasis: 12000, unrealizedPnL: 3000, market: 'US' },
          { ticker: 'LOW2', weight: 10, marketValue: 10000, costBasis: 8000, unrealizedPnL: 2000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const context = createMockContext();
      const result = (await agent.execute(context, mixedPortfolio)) as AgentResult;

      const concentration = result.data.concentration_analysis as ConcentrationAnalysis;
      expect(concentration.high_concentration_flags).toHaveLength(2);
      expect(concentration.high_concentration_flags).toContain('HIGH1');
      expect(concentration.high_concentration_flags).toContain('HIGH2');
      expect(concentration.high_concentration_flags).not.toContain('LOW1');
      expect(concentration.high_concentration_flags).not.toContain('LOW2');
    });
  });

  // ===========================================================================
  // Property 19: State Persistence Round-Trip
  // ===========================================================================

  describe('Property 19: State Persistence Round-Trip', () => {
    /**
     * Feature: multi-agent-analysis, Property 19: State Persistence Round-Trip
     *
     * *For any* agent, calling `saveState()` followed by `loadState()` with the
     * returned state SHALL restore the agent to an equivalent internal state.
     *
     * **Validates: Requirements 1.1.1, 1.1.2, 1.1.3, 1.1.4**
     */
    it('should preserve state through save/load cycle', async () => {
      await fc.assert(
        fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
          const agent1 = createPositionAnalystAgent();
          const context = createMockContext();

          // Execute to populate internal state
          await agent1.execute(context, portfolio);

          // Save state
          const savedState = agent1.saveState();

          // Create new agent and load state
          const agent2 = createPositionAnalystAgent();
          agent2.loadState(savedState);

          // Save state from restored agent
          const restoredState = agent2.saveState();

          // States should be equivalent (excluding timestamp which will differ)
          expect(restoredState.agentId).toBe(savedState.agentId);
          expect(restoredState.internalState).toEqual(savedState.internalState);
          expect(restoredState.messageHistory).toEqual(savedState.messageHistory);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve analyzed tickers through state round-trip', async () => {
      const portfolio: PortfolioState = {
        positions: [
          { ticker: 'AAPL', weight: 50, marketValue: 50000, costBasis: 40000, unrealizedPnL: 10000, market: 'US' },
          { ticker: 'GOOGL', weight: 30, marketValue: 30000, costBasis: 25000, unrealizedPnL: 5000, market: 'US' },
          { ticker: 'MSFT', weight: 20, marketValue: 20000, costBasis: 18000, unrealizedPnL: 2000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const agent1 = createPositionAnalystAgent();
      const context = createMockContext();

      // Execute to populate internal state
      await agent1.execute(context, portfolio);

      // Save and restore state
      const savedState = agent1.saveState();
      const agent2 = createPositionAnalystAgent();
      agent2.loadState(savedState);

      // Verify internal state was preserved
      const restoredState = agent2.saveState();
      const internalState = restoredState.internalState as {
        lastAnalyzedTickers: string[];
        analysisCount: number;
      };

      expect(internalState.lastAnalyzedTickers).toContain('AAPL');
      expect(internalState.lastAnalyzedTickers).toContain('GOOGL');
      expect(internalState.lastAnalyzedTickers).toContain('MSFT');
      expect(internalState.analysisCount).toBe(1);
    });

    it('should handle loading state with mismatched agent ID gracefully', () => {
      const agent = createPositionAnalystAgent();
      const invalidState = {
        agentId: 'wrong_agent',
        timestamp: Date.now(),
        internalState: {},
        messageHistory: [],
      };

      // Should not throw, just log warning
      expect(() => agent.loadState(invalidState)).not.toThrow();
    });
  });

  // ===========================================================================
  // Additional Unit Tests
  // ===========================================================================

  describe('Concentration Analysis', () => {
    it('should correctly identify top 3 positions by weight', async () => {
      const portfolio: PortfolioState = {
        positions: [
          { ticker: 'A', weight: 10, marketValue: 10000, costBasis: 9000, unrealizedPnL: 1000, market: 'US' },
          { ticker: 'B', weight: 40, marketValue: 40000, costBasis: 35000, unrealizedPnL: 5000, market: 'US' },
          { ticker: 'C', weight: 25, marketValue: 25000, costBasis: 22000, unrealizedPnL: 3000, market: 'US' },
          { ticker: 'D', weight: 15, marketValue: 15000, costBasis: 13000, unrealizedPnL: 2000, market: 'US' },
          { ticker: 'E', weight: 10, marketValue: 10000, costBasis: 9000, unrealizedPnL: 1000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const context = createMockContext();
      const result = (await agent.execute(context, portfolio)) as AgentResult;
      const concentration = result.data.concentration_analysis as ConcentrationAnalysis;

      // Top 3 should be B (40%), C (25%), D (15%)
      expect(concentration.top3_positions).toHaveLength(3);
      expect(concentration.top3_positions[0].ticker).toBe('B');
      expect(concentration.top3_positions[1].ticker).toBe('C');
      expect(concentration.top3_positions[2].ticker).toBe('D');
      expect(concentration.top3_total_weight).toBeCloseTo(80, 1);
    });

    it('should calculate HHI correctly', async () => {
      // Equal weight portfolio should have lower HHI
      const equalWeightPortfolio: PortfolioState = {
        positions: [
          { ticker: 'A', weight: 25, marketValue: 25000, costBasis: 20000, unrealizedPnL: 5000, market: 'US' },
          { ticker: 'B', weight: 25, marketValue: 25000, costBasis: 20000, unrealizedPnL: 5000, market: 'US' },
          { ticker: 'C', weight: 25, marketValue: 25000, costBasis: 20000, unrealizedPnL: 5000, market: 'US' },
          { ticker: 'D', weight: 25, marketValue: 25000, costBasis: 20000, unrealizedPnL: 5000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const context = createMockContext();
      const result = (await agent.execute(context, equalWeightPortfolio)) as AgentResult;
      const concentration = result.data.concentration_analysis as ConcentrationAnalysis;

      // HHI for 4 equal positions: 4 * (0.25)^2 = 0.25
      expect(concentration.herfindahl_index).toBeCloseTo(0.25, 2);
    });
  });

  describe('Performance Attribution', () => {
    it('should correctly identify top gainers and losers', async () => {
      const portfolio: PortfolioState = {
        positions: [
          { ticker: 'WINNER', weight: 30, marketValue: 30000, costBasis: 20000, unrealizedPnL: 10000, market: 'US' },
          { ticker: 'LOSER', weight: 30, marketValue: 30000, costBasis: 40000, unrealizedPnL: -10000, market: 'US' },
          { ticker: 'NEUTRAL', weight: 40, marketValue: 40000, costBasis: 40000, unrealizedPnL: 0, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const context = createMockContext();
      const result = (await agent.execute(context, portfolio)) as AgentResult;
      const performance = result.data.performance_attribution as {
        topGainers: Array<{ ticker: string }>;
        topLosers: Array<{ ticker: string }>;
      };

      expect(performance.topGainers[0].ticker).toBe('WINNER');
      expect(performance.topLosers[0].ticker).toBe('LOSER');
    });
  });
});
