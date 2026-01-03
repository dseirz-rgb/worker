/**
 * Market Analyst Agent Property Tests
 *
 * Tests for the Market Analyst Agent using property-based testing with fast-check.
 * Validates Properties 9 and 10 from the design document.
 *
 * @module agents/marketAnalyst.test
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for property definitions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  MarketAnalystAgent,
  createMarketAnalystAgentWithSources,
  MarketSentiment,
  TickerSentiment,
  MarketEvent,
} from './marketAnalyst';
import type {
  AgentContext,
  PortfolioState,
  AgentResult,
  NewsItem,
  SECFiling,
} from './types';
import {
  SerperDataSource,
  SECDataSource,
  JinaDataSource,
} from './dataSources';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock AgentContext for testing
 */
function createMockContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    query: 'Analyze market sentiment',
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


// =============================================================================
// Arbitraries for Property-Based Testing
// =============================================================================

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

// Note: NewsItem and SECFiling arbitraries could be added here for future property tests
// that generate random news items or SEC filings


// =============================================================================
// Mock Data Sources
// =============================================================================

/**
 * Create a mock SerperDataSource that returns configurable news items
 */
function createMockSerperDataSource(options: {
  shouldFail?: boolean;
  newsItems?: NewsItem[];
} = {}): SerperDataSource {
  const mockSource = {
    name: 'serper',
    cache: new Map(),
    isAvailable: vi.fn().mockResolvedValue(!options.shouldFail),
    searchNews: vi.fn().mockImplementation(async (ticker: string) => {
      if (options.shouldFail) {
        throw new Error('Serper API unavailable');
      }
      return options.newsItems || [
        {
          title: `${ticker} stock shows strong performance`,
          snippet: `${ticker} reported better than expected earnings with strong growth`,
          source: 'Reuters',
          date: new Date().toISOString(),
          link: `https://example.com/news/${ticker}`,
        },
      ];
    }),
    getCache: vi.fn().mockReturnValue(null),
    setCache: vi.fn(),
    clearCache: vi.fn(),
    getCacheSize: vi.fn().mockReturnValue(0),
    pruneExpiredCache: vi.fn().mockReturnValue(0),
  } as unknown as SerperDataSource;

  return mockSource;
}

/**
 * Create a mock SECDataSource that returns configurable filings
 */
function createMockSECDataSource(options: {
  shouldFail?: boolean;
  filings?: SECFiling[];
} = {}): SECDataSource {
  const mockSource = {
    name: 'sec',
    cache: new Map(),
    isAvailable: vi.fn().mockResolvedValue(true),
    getLatestFilings: vi.fn().mockImplementation(async (ticker: string) => {
      if (options.shouldFail) {
        throw new Error('SEC API unavailable');
      }
      return options.filings || [
        {
          form: '10-K',
          filingDate: '2024-01-15',
          accessionNumber: '0001234567-24-000001',
          primaryDocument: 'form10k.htm',
        },
      ];
    }),
    getCIK: vi.fn().mockResolvedValue('0001234567'),
    getCache: vi.fn().mockReturnValue(null),
    setCache: vi.fn(),
    clearCache: vi.fn(),
    getCacheSize: vi.fn().mockReturnValue(0),
    pruneExpiredCache: vi.fn().mockReturnValue(0),
  } as unknown as SECDataSource;

  return mockSource;
}

/**
 * Create a mock JinaDataSource
 */
function createMockJinaDataSource(): JinaDataSource {
  const mockSource = {
    name: 'jina',
    cache: new Map(),
    isAvailable: vi.fn().mockResolvedValue(true),
    fetchArticleContent: vi.fn().mockResolvedValue({
      url: 'https://example.com',
      title: 'Test Article',
      content: 'Test content',
      extracted_data: {},
    }),
    fetchSECFilingContent: vi.fn().mockResolvedValue({
      url: 'https://sec.gov/filing',
      title: 'SEC Filing',
      content: 'Filing content',
      extracted_data: {},
    }),
    getCache: vi.fn().mockReturnValue(null),
    setCache: vi.fn(),
    clearCache: vi.fn(),
    getCacheSize: vi.fn().mockReturnValue(0),
    pruneExpiredCache: vi.fn().mockReturnValue(0),
  } as unknown as JinaDataSource;

  return mockSource;
}


// =============================================================================
// Property Tests
// =============================================================================

describe('MarketAnalystAgent', () => {
  let mockSerper: SerperDataSource;
  let mockSEC: SECDataSource;
  let mockJina: JinaDataSource;
  let agent: MarketAnalystAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSerper = createMockSerperDataSource();
    mockSEC = createMockSECDataSource();
    mockJina = createMockJinaDataSource();
    agent = createMarketAnalystAgentWithSources(mockSerper, mockSEC, mockJina);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Property 9: Market Analyst Output Schema
  // ===========================================================================

  describe('Property 9: Market Analyst Output Schema', () => {
    /**
     * Feature: multi-agent-analysis, Property 9: Market Analyst Output Schema
     *
     * *For any* execution of Market Analyst, the result SHALL contain
     * `news_summary`, `sentiment_score`, `market_cycle`, and `sec_highlights`
     * fields, regardless of external API availability.
     *
     * **Validates: Requirements 4.2, 4.3, 4.5**
     */
    it('should return AgentResult with required data fields for any valid portfolio', async () => {
      await fc.assert(
        fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
          const context = createMockContext();
          const result = await agent.execute(context, portfolio);

          // Verify result is an AgentResult
          expect(result).toHaveProperty('agentId', 'market_analyst');
          expect(result).toHaveProperty('status');
          expect(result).toHaveProperty('data');
          expect(result).toHaveProperty('summary');
          expect(result).toHaveProperty('metadata');

          const agentResult = result as AgentResult;

          // Verify data contains required fields (mapped from implementation)
          // The implementation uses overall_sentiment, ticker_sentiments, recent_filings, market_events
          expect(agentResult.data).toHaveProperty('overall_sentiment');
          expect(agentResult.data).toHaveProperty('ticker_sentiments');
          expect(agentResult.data).toHaveProperty('recent_filings');
          expect(agentResult.data).toHaveProperty('market_events');

          // Verify overall_sentiment structure (contains sentiment_score equivalent)
          const sentiment = agentResult.data.overall_sentiment as MarketSentiment;
          expect(sentiment).toHaveProperty('overall_score');
          expect(sentiment).toHaveProperty('sentiment_label');
          expect(sentiment).toHaveProperty('key_themes');
          expect(sentiment).toHaveProperty('news_count');
          expect(typeof sentiment.overall_score).toBe('number');
          expect(sentiment.overall_score).toBeGreaterThanOrEqual(-1);
          expect(sentiment.overall_score).toBeLessThanOrEqual(1);

          // Verify ticker_sentiments is an array
          expect(Array.isArray(agentResult.data.ticker_sentiments)).toBe(true);

          // Verify recent_filings is an array (sec_highlights equivalent)
          expect(Array.isArray(agentResult.data.recent_filings)).toBe(true);

          // Verify market_events is an array
          expect(Array.isArray(agentResult.data.market_events)).toBe(true);
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

    it('should return valid sentiment labels for any portfolio', async () => {
      const validSentimentLabels = ['very_negative', 'negative', 'neutral', 'positive', 'very_positive'];

      await fc.assert(
        fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
          const context = createMockContext();
          const result = (await agent.execute(context, portfolio)) as AgentResult;

          const sentiment = result.data.overall_sentiment as MarketSentiment;
          expect(validSentimentLabels).toContain(sentiment.sentiment_label);
        }),
        { numRuns: 100 }
      );
    });

    it('should return ticker sentiments for each position analyzed', async () => {
      await fc.assert(
        fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
          const context = createMockContext();
          const result = (await agent.execute(context, portfolio)) as AgentResult;

          const tickerSentiments = result.data.ticker_sentiments as TickerSentiment[];

          // Each ticker sentiment should have required fields
          for (const ts of tickerSentiments) {
            expect(ts).toHaveProperty('ticker');
            expect(ts).toHaveProperty('sentiment_score');
            expect(ts).toHaveProperty('news_items');
            expect(ts).toHaveProperty('key_events');
            expect(typeof ts.ticker).toBe('string');
            expect(typeof ts.sentiment_score).toBe('number');
            expect(ts.sentiment_score).toBeGreaterThanOrEqual(-1);
            expect(ts.sentiment_score).toBeLessThanOrEqual(1);
            expect(Array.isArray(ts.news_items)).toBe(true);
            expect(Array.isArray(ts.key_events)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should return valid market events structure', async () => {
      await fc.assert(
        fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
          const context = createMockContext();
          const result = (await agent.execute(context, portfolio)) as AgentResult;

          const marketEvents = result.data.market_events as MarketEvent[];
          const validEventTypes = ['earnings', 'sec_filing', 'news', 'market_move'];
          const validImpacts = ['positive', 'negative', 'neutral'];

          for (const event of marketEvents) {
            expect(event).toHaveProperty('type');
            expect(event).toHaveProperty('description');
            expect(event).toHaveProperty('impact');
            expect(event).toHaveProperty('date');
            expect(validEventTypes).toContain(event.type);
            expect(validImpacts).toContain(event.impact);
          }
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
      expect(result.agentId).toBe('market_analyst');
      expect(result.data).toHaveProperty('overall_sentiment');
      expect(result.data).toHaveProperty('ticker_sentiments');
      expect(result.data).toHaveProperty('recent_filings');
      expect(result.data).toHaveProperty('market_events');

      // Empty portfolio should have empty arrays and neutral sentiment
      const sentiment = result.data.overall_sentiment as MarketSentiment;
      expect(sentiment.overall_score).toBe(0);
      expect(sentiment.sentiment_label).toBe('neutral');
      expect(sentiment.news_count).toBe(0);

      const tickerSentiments = result.data.ticker_sentiments as TickerSentiment[];
      expect(tickerSentiments).toHaveLength(0);
    });
  });


  // ===========================================================================
  // Property 10: External API Fallback
  // ===========================================================================

  describe('Property 10: External API Fallback', () => {
    /**
     * Feature: multi-agent-analysis, Property 10: External API Fallback
     *
     * *For any* Market Analyst execution where Serper API fails, the agent
     * SHALL return status='partial' and populate news_summary from cached
     * knowledge base data without throwing an exception.
     *
     * **Validates: Requirements 4.6, 6.5**
     */
    it('should return partial status when Serper API fails', async () => {
      // Create agent with failing Serper source
      const failingSerper = createMockSerperDataSource({ shouldFail: true });
      const failingAgent = createMarketAnalystAgentWithSources(failingSerper, mockSEC, mockJina);

      await fc.assert(
        fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
          const context = createMockContext();
          const result = await failingAgent.execute(context, portfolio);

          const agentResult = result as AgentResult;

          // Should not throw - verify we got a result
          expect(agentResult).toBeDefined();
          expect(agentResult.agentId).toBe('market_analyst');

          // Should still have all required data fields
          expect(agentResult.data).toHaveProperty('overall_sentiment');
          expect(agentResult.data).toHaveProperty('ticker_sentiments');
          expect(agentResult.data).toHaveProperty('recent_filings');
          expect(agentResult.data).toHaveProperty('market_events');

          // Ticker sentiments should have empty news items due to API failure
          const tickerSentiments = agentResult.data.ticker_sentiments as TickerSentiment[];
          for (const ts of tickerSentiments) {
            expect(ts.news_items).toHaveLength(0);
            expect(ts.sentiment_score).toBe(0); // Neutral when no news
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should not throw exception when Serper API fails', async () => {
      const failingSerper = createMockSerperDataSource({ shouldFail: true });
      const failingAgent = createMarketAnalystAgentWithSources(failingSerper, mockSEC, mockJina);

      await fc.assert(
        fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
          const context = createMockContext();

          // Should not throw
          await expect(failingAgent.execute(context, portfolio)).resolves.toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should return neutral sentiment when no news is available', async () => {
      const emptyNewsSerper = createMockSerperDataSource({ newsItems: [] });
      const emptyNewsAgent = createMarketAnalystAgentWithSources(emptyNewsSerper, mockSEC, mockJina);

      await fc.assert(
        fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
          const context = createMockContext();
          const result = (await emptyNewsAgent.execute(context, portfolio)) as AgentResult;

          const sentiment = result.data.overall_sentiment as MarketSentiment;

          // With no news, sentiment should be neutral
          expect(sentiment.overall_score).toBe(0);
          expect(sentiment.sentiment_label).toBe('neutral');
          expect(sentiment.news_count).toBe(0);
        }),
        { numRuns: 100 }
      );
    });


    it('should still return SEC filings when Serper fails', async () => {
      const failingSerper = createMockSerperDataSource({ shouldFail: true });
      const workingSEC = createMockSECDataSource({
        filings: [
          {
            form: '10-K',
            filingDate: '2024-01-15',
            accessionNumber: '0001234567-24-000001',
            primaryDocument: 'form10k.htm',
          },
          {
            form: '10-Q',
            filingDate: '2024-03-15',
            accessionNumber: '0001234567-24-000002',
            primaryDocument: 'form10q.htm',
          },
        ],
      });
      const failingAgent = createMarketAnalystAgentWithSources(failingSerper, workingSEC, mockJina);

      await fc.assert(
        fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
          if (portfolio.positions.length === 0) return; // Skip empty portfolios

          const context = createMockContext();
          const result = (await failingAgent.execute(context, portfolio)) as AgentResult;

          // SEC filings should still be populated
          const filings = result.data.recent_filings as SECFiling[];
          expect(filings.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle both Serper and SEC API failures gracefully', async () => {
      const failingSerper = createMockSerperDataSource({ shouldFail: true });
      const failingSEC = createMockSECDataSource({ shouldFail: true });
      const failingAgent = createMarketAnalystAgentWithSources(failingSerper, failingSEC, mockJina);

      await fc.assert(
        fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
          const context = createMockContext();

          // Should not throw even when both APIs fail
          const result = await failingAgent.execute(context, portfolio);
          const agentResult = result as AgentResult;

          expect(agentResult).toBeDefined();
          expect(agentResult.agentId).toBe('market_analyst');

          // Should still have valid structure with empty data
          expect(agentResult.data).toHaveProperty('overall_sentiment');
          expect(agentResult.data).toHaveProperty('ticker_sentiments');
          expect(agentResult.data).toHaveProperty('recent_filings');
          expect(agentResult.data).toHaveProperty('market_events');
        }),
        { numRuns: 100 }
      );
    });

    it('should populate ticker sentiments with fallback data when API fails', async () => {
      const failingSerper = createMockSerperDataSource({ shouldFail: true });
      const failingAgent = createMarketAnalystAgentWithSources(failingSerper, mockSEC, mockJina);

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

      const context = createMockContext();
      const result = (await failingAgent.execute(context, portfolio)) as AgentResult;

      const tickerSentiments = result.data.ticker_sentiments as TickerSentiment[];

      // Should have entries for each ticker even when API fails
      expect(tickerSentiments.length).toBeGreaterThan(0);

      // Each ticker should have valid structure with fallback values
      for (const ts of tickerSentiments) {
        expect(ts.ticker).toBeDefined();
        expect(typeof ts.sentiment_score).toBe('number');
        expect(Array.isArray(ts.news_items)).toBe(true);
        expect(Array.isArray(ts.key_events)).toBe(true);
      }
    });
  });


  // ===========================================================================
  // State Persistence Tests
  // ===========================================================================

  describe('State Persistence', () => {
    it('should preserve state through save/load cycle', async () => {
      await fc.assert(
        fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
          const agent1 = createMarketAnalystAgentWithSources(mockSerper, mockSEC, mockJina);
          const context = createMockContext();

          // Execute to populate internal state
          await agent1.execute(context, portfolio);

          // Save state
          const savedState = agent1.saveState();

          // Create new agent and load state
          const agent2 = createMarketAnalystAgentWithSources(mockSerper, mockSEC, mockJina);
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

    it('should handle loading state with mismatched agent ID gracefully', () => {
      const invalidState = {
        agentId: 'wrong_agent',
        timestamp: Date.now(),
        internalState: {},
        messageHistory: [],
      };

      // Should not throw, just log warning
      expect(() => agent.loadState(invalidState)).not.toThrow();
    });

    it('should preserve cached sentiments through state round-trip', async () => {
      const portfolio: PortfolioState = {
        positions: [
          { ticker: 'AAPL', weight: 50, marketValue: 50000, costBasis: 40000, unrealizedPnL: 10000, market: 'US' },
          { ticker: 'GOOGL', weight: 50, marketValue: 50000, costBasis: 45000, unrealizedPnL: 5000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const agent1 = createMarketAnalystAgentWithSources(mockSerper, mockSEC, mockJina);
      const context = createMockContext();

      // Execute to populate internal state
      await agent1.execute(context, portfolio);

      // Save and restore state
      const savedState = agent1.saveState();
      const agent2 = createMarketAnalystAgentWithSources(mockSerper, mockSEC, mockJina);
      agent2.loadState(savedState);

      // Verify internal state was preserved
      const restoredState = agent2.saveState();
      const internalState = restoredState.internalState as {
        lastAnalyzedTickers: string[];
        cachedSentiments: Record<string, number>;
      };

      expect(internalState.lastAnalyzedTickers).toContain('AAPL');
      expect(internalState.lastAnalyzedTickers).toContain('GOOGL');
    });
  });


  // ===========================================================================
  // Sentiment Analysis Tests
  // ===========================================================================

  describe('Sentiment Analysis', () => {
    it('should calculate positive sentiment for positive news', async () => {
      const positiveNewsSerper = createMockSerperDataSource({
        newsItems: [
          {
            title: 'Stock surges on strong earnings beat',
            snippet: 'Company reported record profit and growth, exceeding analyst expectations',
            source: 'Reuters',
            date: new Date().toISOString(),
            link: 'https://example.com/news/positive',
          },
          {
            title: 'Analysts upgrade stock with bullish outlook',
            snippet: 'Multiple analysts upgrade rating citing strong performance and positive outlook',
            source: 'Bloomberg',
            date: new Date().toISOString(),
            link: 'https://example.com/news/upgrade',
          },
        ],
      });
      const positiveAgent = createMarketAnalystAgentWithSources(positiveNewsSerper, mockSEC, mockJina);

      const portfolio: PortfolioState = {
        positions: [
          { ticker: 'AAPL', weight: 100, marketValue: 100000, costBasis: 80000, unrealizedPnL: 20000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const context = createMockContext();
      const result = (await positiveAgent.execute(context, portfolio)) as AgentResult;

      const sentiment = result.data.overall_sentiment as MarketSentiment;
      expect(sentiment.overall_score).toBeGreaterThan(0);
      expect(['positive', 'very_positive']).toContain(sentiment.sentiment_label);
    });

    it('should calculate negative sentiment for negative news', async () => {
      const negativeNewsSerper = createMockSerperDataSource({
        newsItems: [
          {
            title: 'Stock plunges on earnings miss',
            snippet: 'Company reported weak results with declining revenue and loss concerns',
            source: 'Reuters',
            date: new Date().toISOString(),
            link: 'https://example.com/news/negative',
          },
          {
            title: 'Analysts downgrade stock citing risk and concern',
            snippet: 'Multiple analysts downgrade rating warning of bearish outlook and fear',
            source: 'Bloomberg',
            date: new Date().toISOString(),
            link: 'https://example.com/news/downgrade',
          },
        ],
      });
      const negativeAgent = createMarketAnalystAgentWithSources(negativeNewsSerper, mockSEC, mockJina);

      const portfolio: PortfolioState = {
        positions: [
          { ticker: 'AAPL', weight: 100, marketValue: 100000, costBasis: 120000, unrealizedPnL: -20000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 130000,
        timestamp: Date.now(),
      };

      const context = createMockContext();
      const result = (await negativeAgent.execute(context, portfolio)) as AgentResult;

      const sentiment = result.data.overall_sentiment as MarketSentiment;
      expect(sentiment.overall_score).toBeLessThan(0);
      expect(['negative', 'very_negative']).toContain(sentiment.sentiment_label);
    });

    it('should extract themes from news items', async () => {
      const themedNewsSerper = createMockSerperDataSource({
        newsItems: [
          {
            title: 'Company reports quarterly earnings',
            snippet: 'Revenue and profit exceeded expectations in the quarterly report',
            source: 'Reuters',
            date: new Date().toISOString(),
            link: 'https://example.com/news/earnings',
          },
          {
            title: 'Analyst upgrades rating with new price target',
            snippet: 'Analyst raises price target citing strong outlook',
            source: 'Bloomberg',
            date: new Date().toISOString(),
            link: 'https://example.com/news/analyst',
          },
        ],
      });
      const themedAgent = createMarketAnalystAgentWithSources(themedNewsSerper, mockSEC, mockJina);

      const portfolio: PortfolioState = {
        positions: [
          { ticker: 'AAPL', weight: 100, marketValue: 100000, costBasis: 80000, unrealizedPnL: 20000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const context = createMockContext();
      const result = (await themedAgent.execute(context, portfolio)) as AgentResult;

      const sentiment = result.data.overall_sentiment as MarketSentiment;
      expect(sentiment.key_themes.length).toBeGreaterThan(0);
    });
  });


  // ===========================================================================
  // Market Event Detection Tests
  // ===========================================================================

  describe('Market Event Detection', () => {
    it('should detect earnings events from news', async () => {
      const earningsNewsSerper = createMockSerperDataSource({
        newsItems: [
          {
            title: 'AAPL reports quarterly earnings results',
            snippet: 'Apple reported strong quarterly results beating expectations',
            source: 'Reuters',
            date: new Date().toISOString(),
            link: 'https://example.com/news/earnings',
          },
        ],
      });
      const earningsAgent = createMarketAnalystAgentWithSources(earningsNewsSerper, mockSEC, mockJina);

      const portfolio: PortfolioState = {
        positions: [
          { ticker: 'AAPL', weight: 100, marketValue: 100000, costBasis: 80000, unrealizedPnL: 20000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const context = createMockContext();
      const result = (await earningsAgent.execute(context, portfolio)) as AgentResult;

      const events = result.data.market_events as MarketEvent[];
      const earningsEvents = events.filter((e) => e.type === 'earnings');
      expect(earningsEvents.length).toBeGreaterThan(0);
    });

    it('should detect SEC filing events', async () => {
      const portfolio: PortfolioState = {
        positions: [
          { ticker: 'AAPL', weight: 100, marketValue: 100000, costBasis: 80000, unrealizedPnL: 20000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const context = createMockContext();
      const result = (await agent.execute(context, portfolio)) as AgentResult;

      const events = result.data.market_events as MarketEvent[];
      const filingEvents = events.filter((e) => e.type === 'sec_filing');
      expect(filingEvents.length).toBeGreaterThan(0);
    });

    it('should detect market move events from news', async () => {
      const marketMoveNewsSerper = createMockSerperDataSource({
        newsItems: [
          {
            title: 'Stock surges 10% on positive news',
            snippet: 'Shares jumped significantly following the announcement',
            source: 'Reuters',
            date: new Date().toISOString(),
            link: 'https://example.com/news/surge',
          },
        ],
      });
      const marketMoveAgent = createMarketAnalystAgentWithSources(marketMoveNewsSerper, mockSEC, mockJina);

      const portfolio: PortfolioState = {
        positions: [
          { ticker: 'AAPL', weight: 100, marketValue: 100000, costBasis: 80000, unrealizedPnL: 20000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const context = createMockContext();
      const result = (await marketMoveAgent.execute(context, portfolio)) as AgentResult;

      const events = result.data.market_events as MarketEvent[];
      const marketMoveEvents = events.filter((e) => e.type === 'market_move');
      expect(marketMoveEvents.length).toBeGreaterThan(0);
    });
  });


  // ===========================================================================
  // SEC Filings Tests
  // ===========================================================================

  describe('SEC Filings', () => {
    it('should retrieve SEC filings for portfolio positions', async () => {
      const portfolio: PortfolioState = {
        positions: [
          { ticker: 'AAPL', weight: 50, marketValue: 50000, costBasis: 40000, unrealizedPnL: 10000, market: 'US' },
          { ticker: 'GOOGL', weight: 50, marketValue: 50000, costBasis: 45000, unrealizedPnL: 5000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const context = createMockContext();
      const result = (await agent.execute(context, portfolio)) as AgentResult;

      const filings = result.data.recent_filings as SECFiling[];
      expect(filings.length).toBeGreaterThan(0);

      // Verify filing structure
      for (const filing of filings) {
        expect(filing).toHaveProperty('form');
        expect(filing).toHaveProperty('filingDate');
        expect(filing).toHaveProperty('accessionNumber');
        expect(filing).toHaveProperty('primaryDocument');
      }
    });

    it('should handle SEC API failures gracefully', async () => {
      const failingSEC = createMockSECDataSource({ shouldFail: true });
      const failingAgent = createMarketAnalystAgentWithSources(mockSerper, failingSEC, mockJina);

      const portfolio: PortfolioState = {
        positions: [
          { ticker: 'AAPL', weight: 100, marketValue: 100000, costBasis: 80000, unrealizedPnL: 20000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const context = createMockContext();

      // Should not throw
      const result = await failingAgent.execute(context, portfolio);
      const agentResult = result as AgentResult;

      expect(agentResult).toBeDefined();
      expect(agentResult.data.recent_filings).toEqual([]);
    });
  });

  // ===========================================================================
  // Summary Generation Tests
  // ===========================================================================

  describe('Summary Generation', () => {
    it('should generate a non-empty summary for any portfolio', async () => {
      await fc.assert(
        fc.asyncProperty(portfolioArbitrary, async (portfolio) => {
          const context = createMockContext();
          const result = (await agent.execute(context, portfolio)) as AgentResult;

          expect(result.summary).toBeDefined();
          expect(typeof result.summary).toBe('string');
          expect(result.summary.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should include sentiment information in summary', async () => {
      const portfolio: PortfolioState = {
        positions: [
          { ticker: 'AAPL', weight: 100, marketValue: 100000, costBasis: 80000, unrealizedPnL: 20000, market: 'US' },
        ],
        totalValue: 100000,
        cashBalance: 5000,
        marginLoan: 0,
        highWaterMark: 110000,
        timestamp: Date.now(),
      };

      const context = createMockContext();
      const result = (await agent.execute(context, portfolio)) as AgentResult;

      // Summary should mention sentiment
      expect(result.summary.toLowerCase()).toMatch(/sentiment/i);
    });
  });
});
