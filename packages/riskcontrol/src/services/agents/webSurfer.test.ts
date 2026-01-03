/**
 * Web Surfer Agent Property Tests
 *
 * Tests for the Web Surfer Agent using property-based testing with fast-check.
 * Validates Properties 20 and 21 from the design document.
 *
 * @module agents/webSurfer.test
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for property definitions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { WebSurferAgent, createWebSurferAgentWithSource } from './webSurfer';
import type { AgentContext, PortfolioState, AgentResult, ExtractedContent } from './types';
import { JinaDataSource } from './dataSources';

// =============================================================================
// Test Utilities
// =============================================================================

function createMockContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    query: 'Analyze web content',
    previousResults: new Map(),
    userNotes: '',
    externalData: { news: new Map(), secFilings: new Map(), articleContent: new Map() },
    messageThread: [],
    mode: 'sequential',
    ...overrides,
  };
}

function createMockPortfolio(): PortfolioState {
  return {
    positions: [
      { ticker: 'AAPL', weight: 50, marketValue: 50000, costBasis: 40000, unrealizedPnL: 10000, market: 'US' },
      { ticker: 'GOOGL', weight: 30, marketValue: 30000, costBasis: 25000, unrealizedPnL: 5000, market: 'US' },
    ],
    totalValue: 100000,
    cashBalance: 5000,
    marginLoan: 0,
    highWaterMark: 110000,
    timestamp: Date.now(),
  };
}

// =============================================================================
// Arbitraries for Property-Based Testing
// =============================================================================

const urlArbitrary = fc.oneof(
  fc.tuple(
    fc.constantFrom('https://'),
    fc.stringMatching(/^[a-z0-9]{3,15}$/),
    fc.constantFrom('.com', '.org', '.net', '.io'),
    fc.constantFrom('', '/news', '/article'),
  ).map(([protocol, domain, tld, path]) => `${protocol}${domain}${tld}${path}`),
  fc.constant('https://www.sec.gov/Archives/edgar/data/320193/test.htm'),
  fc.constant('https://finance.yahoo.com/news/apple-stock-analysis'),
  fc.constant('https://www.reuters.com/technology/apple-earnings'),
);

const urlArrayArbitrary = fc.array(urlArbitrary, { minLength: 1, maxLength: 5 });

// =============================================================================
// Mock JinaDataSource
// =============================================================================

function createMockJinaDataSource(mockResponses: Map<string, ExtractedContent> = new Map()): JinaDataSource {
  return {
    name: 'jina',
    cache: new Map(),
    isAvailable: vi.fn().mockResolvedValue(true),
    getCache: vi.fn().mockReturnValue(null),
    setCache: vi.fn(),
    clearCache: vi.fn(),
    getCacheSize: vi.fn().mockReturnValue(0),
    pruneExpiredCache: vi.fn().mockReturnValue(0),
    fetchArticleContent: vi.fn().mockImplementation(async (url: string): Promise<ExtractedContent> => {
      if (mockResponses.has(url)) return mockResponses.get(url)!;
      return {
        url,
        title: `Mock Title for ${url}`,
        content: `Mock content for ${url}. Sample text for testing.`,
        extracted_data: { keyPoints: ['Key point 1', 'Key point 2'], financialData: { revenue: 1000000 } },
      };
    }),
    fetchSECFilingContent: vi.fn().mockImplementation(async (url: string): Promise<ExtractedContent> => ({
      url,
      title: 'SEC Filing Mock',
      content: 'SEC filing content with revenue: $1.5 billion',
      extracted_data: { keyPoints: ['Revenue increased'], financialData: { revenue: 1500000000 } },
    })),
  } as unknown as JinaDataSource;
}

// =============================================================================
// Property Tests
// =============================================================================

describe('WebSurferAgent', () => {
  let mockJinaSource: JinaDataSource;
  let agent: WebSurferAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJinaSource = createMockJinaDataSource();
    agent = createWebSurferAgentWithSource(mockJinaSource);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Property 20: Web Surfer Content Extraction
  // ===========================================================================

  describe('Property 20: Web Surfer Content Extraction', () => {
    /**
     * Feature: multi-agent-analysis, Property 20: Web Surfer Content Extraction
     *
     * *For any* valid URL provided to Web_Surfer_Agent, the result SHALL contain
     * `url`, `title`, `content`, and `extracted_data` fields, with `error` field
     * populated if extraction fails.
     *
     * **Validates: Requirements 4.1.1, 4.1.5, 4.1.6**
     */
    it('should return extracted content with required fields for any valid URL', async () => {
      await fc.assert(
        fc.asyncProperty(urlArbitrary, async (url) => {
          const context = createMockContext({ query: `Extract content from ${url}` });
          const portfolio = createMockPortfolio();
          const result = await agent.execute(context, portfolio);

          expect(result).toHaveProperty('agentId', 'web_surfer');
          expect(result).toHaveProperty('status');
          expect(result).toHaveProperty('data');
          expect(result).toHaveProperty('summary');
          expect(result).toHaveProperty('metadata');

          const agentResult = result as AgentResult;
          expect(agentResult.data).toHaveProperty('extracted_content');
          expect(agentResult.data).toHaveProperty('analysis');
          expect(agentResult.data).toHaveProperty('urls_processed');
          expect(agentResult.data).toHaveProperty('successful_extractions');

          const extractedContent = agentResult.data.extracted_content as ExtractedContent[];
          expect(Array.isArray(extractedContent)).toBe(true);

          for (const content of extractedContent) {
            expect(content).toHaveProperty('url');
            expect(content).toHaveProperty('title');
            expect(content).toHaveProperty('content');
            expect(content).toHaveProperty('extracted_data');
            expect(typeof content.url).toBe('string');
            expect(typeof content.title).toBe('string');
            expect(typeof content.content).toBe('string');
            expect(typeof content.extracted_data).toBe('object');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should populate error field when extraction fails', async () => {
      await fc.assert(
        fc.asyncProperty(urlArbitrary, async (url) => {
          const errorMessage = 'Network error: Failed to fetch';
          const errorMockResponses = new Map<string, ExtractedContent>();
          errorMockResponses.set(url, { url, title: 'Failed', content: '', error: errorMessage, extracted_data: {} });

          const errorMockJina = createMockJinaDataSource(errorMockResponses);
          const errorAgent = createWebSurferAgentWithSource(errorMockJina);
          const context = createMockContext({ query: `Extract content from ${url}` });
          const portfolio = createMockPortfolio();

          const result = await errorAgent.execute(context, portfolio);
          const extractedContent = (result as AgentResult).data.extracted_content as ExtractedContent[];
          const content = extractedContent.find((c) => c.url === url);
          if (content) {
            expect(content.error).toBe(errorMessage);
            expect(content.content).toBe('');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle multiple URLs and return content for each', async () => {
      await fc.assert(
        fc.asyncProperty(urlArrayArbitrary, async (urls) => {
          // Deduplicate URLs as the implementation does
          const uniqueUrls = [...new Set(urls)];
          
          const context = createMockContext({
            messageThread: [{ agentId: 'market_analyst', content: 'Handoff', timestamp: Date.now(), type: 'handoff' } as any],
          });
          (context.messageThread[0] as any).context = { urls: uniqueUrls };

          const portfolio = createMockPortfolio();
          const result = await agent.execute(context, portfolio);
          const agentResult = result as AgentResult;

          expect(agentResult.data.urls_processed).toBe(uniqueUrls.length);
          const extractedContent = agentResult.data.extracted_content as ExtractedContent[];
          expect(extractedContent.length).toBe(uniqueUrls.length);

          for (const url of uniqueUrls) {
            const content = extractedContent.find((c) => c.url === url);
            expect(content).toBeDefined();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should return valid metadata for any URL extraction', async () => {
      await fc.assert(
        fc.asyncProperty(urlArbitrary, async (url) => {
          const context = createMockContext({ query: `Extract content from ${url}` });
          const portfolio = createMockPortfolio();
          const result = await agent.execute(context, portfolio);
          const agentResult = result as AgentResult;

          expect(agentResult.metadata).toHaveProperty('executionTimeMs');
          expect(agentResult.metadata).toHaveProperty('tokensUsed');
          expect(agentResult.metadata).toHaveProperty('dataSources');
          expect(typeof agentResult.metadata.executionTimeMs).toBe('number');
          expect(agentResult.metadata.executionTimeMs).toBeGreaterThanOrEqual(0);
          expect(Array.isArray(agentResult.metadata.dataSources)).toBe(true);
          expect(agentResult.metadata.dataSources).toContain('jina');
        }),
        { numRuns: 100 }
      );
    });

    it('should return analysis with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(urlArbitrary, async (url) => {
          const context = createMockContext({ query: `Extract content from ${url}` });
          const portfolio = createMockPortfolio();
          const result = await agent.execute(context, portfolio);
          const analysis = (result as AgentResult).data.analysis as Record<string, unknown>;

          expect(analysis).toHaveProperty('key_findings');
          expect(analysis).toHaveProperty('financial_metrics');
          expect(analysis).toHaveProperty('risk_factors');
          expect(analysis).toHaveProperty('opportunities');
          expect(Array.isArray(analysis.key_findings)).toBe(true);
          expect(typeof analysis.financial_metrics).toBe('object');
          expect(Array.isArray(analysis.risk_factors)).toBe(true);
          expect(Array.isArray(analysis.opportunities)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty URL list gracefully', async () => {
      const context = createMockContext({ query: 'Analyze without URLs' });
      const portfolio = createMockPortfolio();
      const result = await agent.execute(context, portfolio);
      const agentResult = result as AgentResult;

      expect(agentResult.status).toBe('partial');
      expect(agentResult.data.urls_processed).toBe(0);
      expect(agentResult.data.successful_extractions).toBe(0);
      expect((agentResult.data.extracted_content as ExtractedContent[])).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Property 21: Web Surfer Cache Behavior
  // ===========================================================================

  describe('Property 21: Web Surfer Cache Behavior', () => {
    /**
     * Feature: multi-agent-analysis, Property 21: Web Surfer Cache Behavior
     *
     * *For any* URL fetched by Web_Surfer_Agent, subsequent requests within 1 hour
     * SHALL return cached content without making a new HTTP request.
     *
     * **Validates: Requirements 4.1.7**
     */

    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('should cache content and return cached results within 1 hour TTL', async () => {
      await fc.assert(
        fc.asyncProperty(urlArbitrary, async (url) => {
          vi.clearAllMocks();
          const trackingMockJina = createMockJinaDataSource();
          const cachingAgent = createWebSurferAgentWithSource(trackingMockJina);
          const context = createMockContext({ query: `Extract content from ${url}` });
          const portfolio = createMockPortfolio();

          await cachingAgent.execute(context, portfolio);
          const callsAfterFirst = (trackingMockJina.fetchArticleContent as any).mock.calls.length;

          vi.advanceTimersByTime(30 * 60 * 1000); // 30 minutes

          await cachingAgent.execute(context, portfolio);
          const callsAfterSecond = (trackingMockJina.fetchArticleContent as any).mock.calls.length;

          expect(callsAfterSecond).toBe(callsAfterFirst);
        }),
        { numRuns: 100 }
      );
    });

    it('should make new HTTP request after cache expires (1 hour)', async () => {
      await fc.assert(
        fc.asyncProperty(urlArbitrary, async (url) => {
          vi.clearAllMocks();
          const trackingMockJina = createMockJinaDataSource();
          const cachingAgent = createWebSurferAgentWithSource(trackingMockJina);
          const context = createMockContext({ query: `Extract content from ${url}` });
          const portfolio = createMockPortfolio();

          await cachingAgent.execute(context, portfolio);
          const callsAfterFirst = (trackingMockJina.fetchArticleContent as any).mock.calls.length;

          vi.advanceTimersByTime(61 * 60 * 1000); // 61 minutes

          await cachingAgent.execute(context, portfolio);
          const callsAfterExpiry = (trackingMockJina.fetchArticleContent as any).mock.calls.length;

          expect(callsAfterExpiry).toBeGreaterThan(callsAfterFirst);
        }),
        { numRuns: 100 }
      );
    });

    it('should return same content from cache as original request', async () => {
      await fc.assert(
        fc.asyncProperty(urlArbitrary, async (url) => {
          vi.clearAllMocks();
          const trackingMockJina = createMockJinaDataSource();
          const cachingAgent = createWebSurferAgentWithSource(trackingMockJina);
          const context = createMockContext({ query: `Extract content from ${url}` });
          const portfolio = createMockPortfolio();

          const result1 = await cachingAgent.execute(context, portfolio);
          const content1 = (result1 as AgentResult).data.extracted_content as ExtractedContent[];

          vi.advanceTimersByTime(30 * 60 * 1000);

          const result2 = await cachingAgent.execute(context, portfolio);
          const content2 = (result2 as AgentResult).data.extracted_content as ExtractedContent[];

          expect(content1.length).toBe(content2.length);
          for (let i = 0; i < content1.length; i++) {
            expect(content1[i].url).toBe(content2[i].url);
            expect(content1[i].title).toBe(content2[i].title);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should cache each URL independently', async () => {
      vi.clearAllMocks();
      const trackingMockJina = createMockJinaDataSource();
      const cachingAgent = createWebSurferAgentWithSource(trackingMockJina);
      const portfolio = createMockPortfolio();

      await cachingAgent.execute(createMockContext({ query: 'Extract from https://a.com' }), portfolio);
      const calls1 = (trackingMockJina.fetchArticleContent as any).mock.calls.length;

      await cachingAgent.execute(createMockContext({ query: 'Extract from https://b.com' }), portfolio);
      const calls2 = (trackingMockJina.fetchArticleContent as any).mock.calls.length;

      expect(calls2).toBeGreaterThan(calls1);

      vi.advanceTimersByTime(30 * 60 * 1000);
      await cachingAgent.execute(createMockContext({ query: 'Extract from https://a.com' }), portfolio);
      expect((trackingMockJina.fetchArticleContent as any).mock.calls.length).toBe(calls2);
    });

    it('should clear cache when clearCache is called', async () => {
      vi.clearAllMocks();
      const trackingMockJina = createMockJinaDataSource();
      const cachingAgent = createWebSurferAgentWithSource(trackingMockJina);
      const context = createMockContext({ query: 'Extract from https://example.com' });
      const portfolio = createMockPortfolio();

      await cachingAgent.execute(context, portfolio);
      const calls1 = (trackingMockJina.fetchArticleContent as any).mock.calls.length;

      cachingAgent.clearCache();

      await cachingAgent.execute(context, portfolio);
      expect((trackingMockJina.fetchArticleContent as any).mock.calls.length).toBeGreaterThan(calls1);
    });

    it('should report correct cache size', async () => {
      vi.clearAllMocks();
      const cachingAgent = createWebSurferAgentWithSource(createMockJinaDataSource());
      expect(cachingAgent.getCacheSize()).toBe(0);

      await cachingAgent.execute(createMockContext({ query: 'Extract from https://x.com' }), createMockPortfolio());
      expect(cachingAgent.getCacheSize()).toBeGreaterThan(0);

      cachingAgent.clearCache();
      expect(cachingAgent.getCacheSize()).toBe(0);
    });

    it('should prune expired cache entries', async () => {
      vi.clearAllMocks();
      const cachingAgent = createWebSurferAgentWithSource(createMockJinaDataSource());

      await cachingAgent.execute(createMockContext({ query: 'Extract from https://y.com' }), createMockPortfolio());
      expect(cachingAgent.getCacheSize()).toBeGreaterThan(0);

      vi.advanceTimersByTime(61 * 60 * 1000);
      const pruned = cachingAgent.pruneExpiredCache();
      expect(pruned).toBeGreaterThan(0);
      expect(cachingAgent.getCacheSize()).toBe(0);
    });
  });

  // ===========================================================================
  // State Persistence Tests
  // ===========================================================================

  describe('State Persistence', () => {
    it('should preserve state through save/load cycle', async () => {
      await fc.assert(
        fc.asyncProperty(urlArbitrary, async (url) => {
          const agent1 = createWebSurferAgentWithSource(mockJinaSource);
          const context = createMockContext({ query: `Extract from ${url}` });
          const portfolio = createMockPortfolio();

          await agent1.execute(context, portfolio);
          const savedState = agent1.saveState();

          const agent2 = createWebSurferAgentWithSource(mockJinaSource);
          agent2.loadState(savedState);
          const restoredState = agent2.saveState();

          expect(restoredState.agentId).toBe(savedState.agentId);
          // Note: cacheKeys are saved but cache content is not restored (by design)
          // So we only compare processedUrls and lastProcessingTimestamp
          const savedInternal = savedState.internalState as Record<string, unknown>;
          const restoredInternal = restoredState.internalState as Record<string, unknown>;
          expect(restoredInternal.processedUrls).toEqual(savedInternal.processedUrls);
          expect(restoredInternal.lastProcessingTimestamp).toBe(savedInternal.lastProcessingTimestamp);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle loading state with mismatched agent ID gracefully', () => {
      const testAgent = createWebSurferAgentWithSource(mockJinaSource);
      const invalidState = { agentId: 'wrong_agent', timestamp: Date.now(), internalState: {}, messageHistory: [] };
      expect(() => testAgent.loadState(invalidState)).not.toThrow();
    });
  });

  // ===========================================================================
  // SEC Content Extraction Tests
  // ===========================================================================

  describe('SEC Content Extraction', () => {
    it('should extract SEC filing content with financial data', async () => {
      const secUrl = 'https://www.sec.gov/Archives/edgar/data/320193/test.htm';
      const context = createMockContext({ query: `Extract from ${secUrl}` });
      const portfolio = createMockPortfolio();

      const result = await agent.execute(context, portfolio);
      const extractedContent = (result as AgentResult).data.extracted_content as ExtractedContent[];

      expect(extractedContent.length).toBeGreaterThan(0);
      const secContent = extractedContent.find((c) => c.url === secUrl);
      expect(secContent).toBeDefined();
      if (secContent) expect(secContent.extracted_data).toBeDefined();
    });

    it('should identify SEC URLs and use appropriate extraction', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('https://www.sec.gov/test', 'https://sec.gov/filings/test'),
          async (secUrl) => {
            const context = createMockContext({ query: `Extract from ${secUrl}` });
            const result = await agent.execute(context, createMockPortfolio());
            expect((result as AgentResult).data.urls_processed).toBe(1);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ===========================================================================
  // News Content Extraction Tests
  // ===========================================================================

  describe('News Content Extraction', () => {
    it('should extract news article content with key points', async () => {
      const newsUrl = 'https://finance.yahoo.com/news/apple-stock-analysis';
      const context = createMockContext({ query: `Extract from ${newsUrl}` });
      const result = await agent.execute(context, createMockPortfolio());
      const extractedContent = (result as AgentResult).data.extracted_content as ExtractedContent[];

      expect(extractedContent.length).toBeGreaterThan(0);
      const newsContent = extractedContent.find((c) => c.url === newsUrl);
      expect(newsContent).toBeDefined();
      if (newsContent) {
        expect(newsContent.title).toBeDefined();
        expect(newsContent.content).toBeDefined();
      }
    });
  });

  // ===========================================================================
  // Agent Interface Tests
  // ===========================================================================

  describe('Agent Interface', () => {
    it('should have correct agent properties', () => {
      expect(agent.id).toBe('web_surfer');
      expect(agent.role).toBe('Web Content Extractor');
      expect(agent.goal).toContain('Extract');
      expect(agent.description).toContain('web');
      expect(agent.tools).toContain('jina');
    });

    it('should return consistent agentId in results', async () => {
      await fc.assert(
        fc.asyncProperty(urlArbitrary, async (url) => {
          const context = createMockContext({ query: `Extract from ${url}` });
          const result = await agent.execute(context, createMockPortfolio());
          expect(result.agentId).toBe('web_surfer');
        }),
        { numRuns: 100 }
      );
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('Error Handling', () => {
    it('should handle Jina API errors gracefully', async () => {
      const errorMockJina = {
        name: 'jina',
        isAvailable: vi.fn().mockResolvedValue(true),
        getCache: vi.fn().mockReturnValue(null),
        setCache: vi.fn(),
        fetchArticleContent: vi.fn().mockRejectedValue(new Error('API Error')),
      } as unknown as JinaDataSource;

      const errorAgent = createWebSurferAgentWithSource(errorMockJina);
      const context = createMockContext({ query: 'Extract from https://example.com' });
      const result = await errorAgent.execute(context, createMockPortfolio());

      expect(result.agentId).toBe('web_surfer');
      expect(['partial', 'failed']).toContain((result as AgentResult).status);
    });

    it('should handle mixed success and failure URLs', async () => {
      const mixedMockResponses = new Map<string, ExtractedContent>();
      mixedMockResponses.set('https://success.com', { url: 'https://success.com', title: 'Success', content: 'OK', extracted_data: {} });
      mixedMockResponses.set('https://failure.com', { url: 'https://failure.com', title: 'Failed', content: '', error: 'Failed', extracted_data: {} });

      const mixedAgent = createWebSurferAgentWithSource(createMockJinaDataSource(mixedMockResponses));
      const context = createMockContext({
        messageThread: [{ agentId: 'test', content: 'Handoff', timestamp: Date.now(), type: 'handoff', context: { urls: ['https://success.com', 'https://failure.com'] } } as any],
      });

      const result = await mixedAgent.execute(context, createMockPortfolio());
      const agentResult = result as AgentResult;

      expect(agentResult.data.urls_processed).toBe(2);
      expect(agentResult.data.successful_extractions).toBe(1);
    });
  });
});
