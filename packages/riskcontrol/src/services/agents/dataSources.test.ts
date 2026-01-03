/**
 * Property-Based Tests for Data Sources
 *
 * Tests the DataSource interface compliance, cache TTL enforcement,
 * and cache bypass with force refresh functionality.
 *
 * @module agents/dataSources.test
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for detailed design
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  SerperDataSource,
  SECDataSource,
  JinaDataSource,
  BaseDataSource,
  RateLimiter,
  DataSourceCacheManager,
  createSerperDataSource,
  createSECDataSource,
  createJinaDataSource,
  createDataSourceManager,
} from './dataSources';
import type { DataSource } from './types';

// =============================================================================
// Test Constants
// =============================================================================

/** External API cache TTL: 1 hour (3600000ms) */
const EXTERNAL_API_CACHE_TTL = 3600000;

/** Agent intermediate results cache TTL: 15 minutes (900000ms) */
const AGENT_INTERMEDIATE_CACHE_TTL = 900000;

// =============================================================================
// Mock Setup
// =============================================================================

// Mock global fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;


// =============================================================================
// Arbitraries for Property-Based Testing
// =============================================================================

/**
 * Arbitrary for generating valid cache keys
 */
const cacheKeyArb = fc.string({ minLength: 1, maxLength: 100 }).filter(
  (s) => s.trim().length > 0 && !s.includes('\0')
);

/**
 * Arbitrary for generating cache data
 */
const cacheDataArb = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.double(),
  fc.boolean(),
  fc.array(fc.string()),
  fc.dictionary(fc.string(), fc.string())
);

/**
 * Arbitrary for generating valid TTL values (1ms to 1 day)
 */
const ttlArb = fc.integer({ min: 1, max: 86400000 });

/**
 * Arbitrary for generating stock ticker symbols
 */
const tickerArb = fc.string({ minLength: 1, maxLength: 5 }).map(
  (s) => s.toUpperCase().replace(/[^A-Z]/g, 'A').slice(0, 5) || 'AAPL'
);

/**
 * Arbitrary for generating API keys
 */
const apiKeyArb = fc.string({ minLength: 10, maxLength: 50 });

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a mock successful fetch response
 */
function createMockResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
  } as Response;
}

/**
 * Setup mock fetch for Serper API
 */
function setupSerperMock(newsItems: Array<{ title: string; snippet: string; source: string; date: string; link: string }> = []) {
  mockFetch.mockResolvedValue(
    createMockResponse({
      news: newsItems,
      searchParameters: { q: 'test', type: 'news' },
    })
  );
}

/**
 * Setup mock fetch for SEC API
 */
function setupSECMock() {
  // Mock company tickers endpoint
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('company_tickers.json')) {
      return Promise.resolve(
        createMockResponse({
          '0': { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
          '1': { cik_str: 789019, ticker: 'MSFT', title: 'Microsoft Corporation' },
        })
      );
    }
    // Mock submissions endpoint
    if (url.includes('submissions/CIK')) {
      return Promise.resolve(
        createMockResponse({
          cik: '320193',
          entityType: 'operating',
          name: 'Apple Inc.',
          filings: {
            recent: {
              accessionNumber: ['0000320193-23-000077'],
              filingDate: ['2023-11-03'],
              form: ['10-K'],
              primaryDocument: ['aapl-20230930.htm'],
            },
          },
        })
      );
    }
    return Promise.resolve(createMockResponse({}));
  });
}

/**
 * Setup mock fetch for Jina API
 */
function setupJinaMock(content = 'Test Article Title\n\nThis is the article content.') {
  mockFetch.mockResolvedValue(createMockResponse(content));
}


// =============================================================================
// Property 13: DataSource Interface Compliance
// =============================================================================

describe('Feature: multi-agent-analysis, Property 13: DataSource Interface Compliance', () => {
  /**
   * Property 13: DataSource Interface Compliance
   * *For any* class implementing DataSource (SerperDataSource, SECDataSource, JinaDataSource),
   * it SHALL have `isAvailable`, `getCache`, and `setCache` methods.
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SerperDataSource Interface Compliance', () => {
    it('should have isAvailable method that returns a Promise<boolean>', async () => {
      await fc.assert(
        fc.asyncProperty(apiKeyArb, async (apiKey) => {
          const dataSource = new SerperDataSource({ apiKey });

          // Verify isAvailable exists and is a function
          expect(typeof dataSource.isAvailable).toBe('function');

          // Verify it returns a Promise<boolean>
          const result = await dataSource.isAvailable();
          expect(typeof result).toBe('boolean');
        }),
        { numRuns: 100 }
      );
    });

    it('should have getCache method that returns cached data or null', () => {
      fc.assert(
        fc.property(apiKeyArb, cacheKeyArb, cacheDataArb, (apiKey, key, data) => {
          const dataSource = new SerperDataSource({ apiKey });

          // Verify getCache exists and is a function
          expect(typeof dataSource.getCache).toBe('function');

          // Initially should return null for any key
          const initialResult = dataSource.getCache(key);
          expect(initialResult).toBeNull();

          // After setting, should return the data
          dataSource.setCache(key, data, 60000);
          const cachedResult = dataSource.getCache(key);
          expect(cachedResult).toEqual(data);
        }),
        { numRuns: 100 }
      );
    });

    it('should have setCache method that stores data with TTL', () => {
      fc.assert(
        fc.property(apiKeyArb, cacheKeyArb, cacheDataArb, ttlArb, (apiKey, key, data, ttl) => {
          const dataSource = new SerperDataSource({ apiKey });

          // Verify setCache exists and is a function
          expect(typeof dataSource.setCache).toBe('function');

          // Should not throw when called
          expect(() => dataSource.setCache(key, data, ttl)).not.toThrow();

          // Data should be retrievable
          const result = dataSource.getCache(key);
          expect(result).toEqual(data);
        }),
        { numRuns: 100 }
      );
    });

    it('should have name property set to "serper"', () => {
      fc.assert(
        fc.property(apiKeyArb, (apiKey) => {
          const dataSource = new SerperDataSource({ apiKey });
          expect(dataSource.name).toBe('serper');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('SECDataSource Interface Compliance', () => {
    it('should have isAvailable method that returns a Promise<boolean>', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(undefined), async () => {
          const dataSource = new SECDataSource();

          // Verify isAvailable exists and is a function
          expect(typeof dataSource.isAvailable).toBe('function');

          // Verify it returns a Promise<boolean>
          const result = await dataSource.isAvailable();
          expect(typeof result).toBe('boolean');
          // SEC is always available (public API)
          expect(result).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should have getCache method that returns cached data or null', () => {
      fc.assert(
        fc.property(cacheKeyArb, cacheDataArb, (key, data) => {
          const dataSource = new SECDataSource();

          // Verify getCache exists and is a function
          expect(typeof dataSource.getCache).toBe('function');

          // Initially should return null for any key
          const initialResult = dataSource.getCache(key);
          expect(initialResult).toBeNull();

          // After setting, should return the data
          dataSource.setCache(key, data, 60000);
          const cachedResult = dataSource.getCache(key);
          expect(cachedResult).toEqual(data);
        }),
        { numRuns: 100 }
      );
    });

    it('should have setCache method that stores data with TTL', () => {
      fc.assert(
        fc.property(cacheKeyArb, cacheDataArb, ttlArb, (key, data, ttl) => {
          const dataSource = new SECDataSource();

          // Verify setCache exists and is a function
          expect(typeof dataSource.setCache).toBe('function');

          // Should not throw when called
          expect(() => dataSource.setCache(key, data, ttl)).not.toThrow();

          // Data should be retrievable
          const result = dataSource.getCache(key);
          expect(result).toEqual(data);
        }),
        { numRuns: 100 }
      );
    });

    it('should have name property set to "sec"', () => {
      fc.assert(
        fc.property(fc.constant(undefined), () => {
          const dataSource = new SECDataSource();
          expect(dataSource.name).toBe('sec');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('JinaDataSource Interface Compliance', () => {
    it('should have isAvailable method that returns a Promise<boolean>', async () => {
      await fc.assert(
        fc.asyncProperty(fc.option(apiKeyArb), async (apiKey) => {
          const dataSource = new JinaDataSource({ apiKey: apiKey ?? undefined });

          // Verify isAvailable exists and is a function
          expect(typeof dataSource.isAvailable).toBe('function');

          // Verify it returns a Promise<boolean>
          const result = await dataSource.isAvailable();
          expect(typeof result).toBe('boolean');
          // Jina is always available (has free tier)
          expect(result).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should have getCache method that returns cached data or null', () => {
      fc.assert(
        fc.property(cacheKeyArb, cacheDataArb, (key, data) => {
          const dataSource = new JinaDataSource();

          // Verify getCache exists and is a function
          expect(typeof dataSource.getCache).toBe('function');

          // Initially should return null for any key
          const initialResult = dataSource.getCache(key);
          expect(initialResult).toBeNull();

          // After setting, should return the data
          dataSource.setCache(key, data, 60000);
          const cachedResult = dataSource.getCache(key);
          expect(cachedResult).toEqual(data);
        }),
        { numRuns: 100 }
      );
    });

    it('should have setCache method that stores data with TTL', () => {
      fc.assert(
        fc.property(cacheKeyArb, cacheDataArb, ttlArb, (key, data, ttl) => {
          const dataSource = new JinaDataSource();

          // Verify setCache exists and is a function
          expect(typeof dataSource.setCache).toBe('function');

          // Should not throw when called
          expect(() => dataSource.setCache(key, data, ttl)).not.toThrow();

          // Data should be retrievable
          const result = dataSource.getCache(key);
          expect(result).toEqual(data);
        }),
        { numRuns: 100 }
      );
    });

    it('should have name property set to "jina"', () => {
      fc.assert(
        fc.property(fc.constant(undefined), () => {
          const dataSource = new JinaDataSource();
          expect(dataSource.name).toBe('jina');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('All DataSources implement DataSource interface', () => {
    it('should verify all data sources satisfy the DataSource interface contract', () => {
      fc.assert(
        fc.property(apiKeyArb, (apiKey) => {
          const dataSources: DataSource[] = [
            new SerperDataSource({ apiKey }),
            new SECDataSource(),
            new JinaDataSource(),
          ];

          for (const ds of dataSources) {
            // Check name property exists
            expect(typeof ds.name).toBe('string');
            expect(ds.name.length).toBeGreaterThan(0);

            // Check isAvailable method exists
            expect(typeof ds.isAvailable).toBe('function');

            // Check getCache method exists
            expect(typeof ds.getCache).toBe('function');

            // Check setCache method exists
            expect(typeof ds.setCache).toBe('function');
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});


// =============================================================================
// Property 14: Cache TTL Enforcement
// =============================================================================

describe('Feature: multi-agent-analysis, Property 14: Cache TTL Enforcement', () => {
  /**
   * Property 14: Cache TTL Enforcement
   * *For any* cached external API response, the cache entry SHALL be considered stale
   * after 3600000ms (1 hour). For agent intermediate results, the TTL SHALL be 900000ms (15 minutes).
   * **Validates: Requirements 8.1, 8.2**
   */

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('External API Cache TTL (1 hour = 3600000ms)', () => {
    it('should return cached data before TTL expires', () => {
      fc.assert(
        fc.property(
          cacheKeyArb,
          cacheDataArb,
          fc.integer({ min: 0, max: EXTERNAL_API_CACHE_TTL - 1 }),
          (key, data, elapsedTime) => {
            const dataSource = new SerperDataSource({ apiKey: 'test-key' });

            // Set cache with external API TTL
            dataSource.setCache(key, data, EXTERNAL_API_CACHE_TTL);

            // Advance time but stay within TTL
            vi.advanceTimersByTime(elapsedTime);

            // Cache should still be valid
            const result = dataSource.getCache(key);
            expect(result).toEqual(data);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null after TTL expires (1 hour)', () => {
      fc.assert(
        fc.property(
          cacheKeyArb,
          cacheDataArb,
          fc.integer({ min: 1, max: 3600000 }), // Additional time after TTL
          (key, data, additionalTime) => {
            const dataSource = new SerperDataSource({ apiKey: 'test-key' });

            // Set cache with external API TTL
            dataSource.setCache(key, data, EXTERNAL_API_CACHE_TTL);

            // Advance time past TTL
            vi.advanceTimersByTime(EXTERNAL_API_CACHE_TTL + additionalTime);

            // Cache should be stale
            const result = dataSource.getCache(key);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce exact TTL boundary for external API cache', () => {
      fc.assert(
        fc.property(cacheKeyArb, cacheDataArb, (key, data) => {
          const dataSource = new SECDataSource();

          // Set cache with external API TTL
          dataSource.setCache(key, data, EXTERNAL_API_CACHE_TTL);

          // At exactly TTL - 1ms, should still be valid
          vi.advanceTimersByTime(EXTERNAL_API_CACHE_TTL - 1);
          expect(dataSource.getCache(key)).toEqual(data);

          // At exactly TTL + 1ms, should be stale
          vi.advanceTimersByTime(2);
          expect(dataSource.getCache(key)).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('should apply 1 hour TTL for SerperDataSource news cache', async () => {
      setupSerperMock([
        { title: 'Test News', snippet: 'Test snippet', source: 'Test Source', date: '2024-01-01', link: 'https://example.com' },
      ]);

      const dataSource = new SerperDataSource({ apiKey: 'test-key' });

      // First call should fetch from API
      await dataSource.searchNews('AAPL');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call within TTL should use cache
      mockFetch.mockClear();
      await dataSource.searchNews('AAPL');
      expect(mockFetch).not.toHaveBeenCalled();

      // After TTL expires, should fetch again
      vi.advanceTimersByTime(EXTERNAL_API_CACHE_TTL + 1);
      await dataSource.searchNews('AAPL');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Agent Intermediate Results Cache TTL (15 minutes = 900000ms)', () => {
    it('should return cached data before intermediate TTL expires', () => {
      fc.assert(
        fc.property(
          cacheKeyArb,
          cacheDataArb,
          fc.integer({ min: 0, max: AGENT_INTERMEDIATE_CACHE_TTL - 1 }),
          (key, data, elapsedTime) => {
            const dataSource = new JinaDataSource();

            // Set cache with intermediate results TTL
            dataSource.setCache(key, data, AGENT_INTERMEDIATE_CACHE_TTL);

            // Advance time but stay within TTL
            vi.advanceTimersByTime(elapsedTime);

            // Cache should still be valid
            const result = dataSource.getCache(key);
            expect(result).toEqual(data);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null after intermediate TTL expires (15 minutes)', () => {
      fc.assert(
        fc.property(
          cacheKeyArb,
          cacheDataArb,
          fc.integer({ min: 1, max: 900000 }), // Additional time after TTL
          (key, data, additionalTime) => {
            const dataSource = new JinaDataSource();

            // Set cache with intermediate results TTL
            dataSource.setCache(key, data, AGENT_INTERMEDIATE_CACHE_TTL);

            // Advance time past TTL
            vi.advanceTimersByTime(AGENT_INTERMEDIATE_CACHE_TTL + additionalTime);

            // Cache should be stale
            const result = dataSource.getCache(key);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce exact TTL boundary for intermediate results cache', () => {
      fc.assert(
        fc.property(cacheKeyArb, cacheDataArb, (key, data) => {
          const dataSource = new JinaDataSource();

          // Set cache with intermediate results TTL
          dataSource.setCache(key, data, AGENT_INTERMEDIATE_CACHE_TTL);

          // At exactly TTL - 1ms, should still be valid
          vi.advanceTimersByTime(AGENT_INTERMEDIATE_CACHE_TTL - 1);
          expect(dataSource.getCache(key)).toEqual(data);

          // At exactly TTL + 1ms, should be stale
          vi.advanceTimersByTime(2);
          expect(dataSource.getCache(key)).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Multiple Cache Entries with Different TTLs', () => {
    it('should independently track TTL for each cache entry', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(cacheKeyArb, cacheDataArb, ttlArb), { minLength: 2, maxLength: 10 }),
          (entries) => {
            const dataSource = new SerperDataSource({ apiKey: 'test-key' });

            // Deduplicate entries by key (keep last occurrence, as setCache overwrites)
            const uniqueEntries = new Map<string, [string, unknown, number]>();
            for (const entry of entries) {
              uniqueEntries.set(entry[0], entry);
            }
            const dedupedEntries = Array.from(uniqueEntries.values());
            
            // Skip if we don't have at least 2 unique entries
            if (dedupedEntries.length < 2) return true;

            // Set all cache entries
            for (const [key, data, ttl] of dedupedEntries) {
              dataSource.setCache(key, data, ttl);
            }

            // Find the minimum TTL
            const minTtl = Math.min(...dedupedEntries.map(([, , ttl]) => ttl));

            // Advance time to just before minimum TTL
            vi.advanceTimersByTime(minTtl - 1);

            // All entries should still be valid
            for (const [key, data] of dedupedEntries) {
              expect(dataSource.getCache(key)).toEqual(data);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should expire entries independently based on their TTL', () => {
      const dataSource = new SECDataSource();

      // Set two entries with different TTLs
      dataSource.setCache('short-ttl', 'short-data', AGENT_INTERMEDIATE_CACHE_TTL);
      dataSource.setCache('long-ttl', 'long-data', EXTERNAL_API_CACHE_TTL);

      // After 15 minutes, short TTL should expire
      vi.advanceTimersByTime(AGENT_INTERMEDIATE_CACHE_TTL + 1);
      expect(dataSource.getCache('short-ttl')).toBeNull();
      expect(dataSource.getCache('long-ttl')).toEqual('long-data');

      // After 1 hour total, long TTL should also expire
      vi.advanceTimersByTime(EXTERNAL_API_CACHE_TTL - AGENT_INTERMEDIATE_CACHE_TTL);
      expect(dataSource.getCache('long-ttl')).toBeNull();
    });
  });

  describe('Cache Pruning', () => {
    it('should prune expired entries correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 20 }),
          (count) => {
            const dataSource = new SerperDataSource({ apiKey: 'test-key' });

            // Generate unique keys to avoid duplicates
            const shortTtlKeys: string[] = [];
            const longTtlKeys: string[] = [];
            const halfIndex = Math.floor(count / 2);

            // Set half with short TTL
            for (let i = 0; i < halfIndex; i++) {
              const key = `short-${i}`;
              shortTtlKeys.push(key);
              dataSource.setCache(key, `data-${i}`, AGENT_INTERMEDIATE_CACHE_TTL);
            }

            // Set half with long TTL
            for (let i = halfIndex; i < count; i++) {
              const key = `long-${i}`;
              longTtlKeys.push(key);
              dataSource.setCache(key, `data-${i}`, EXTERNAL_API_CACHE_TTL);
            }

            // Advance time past short TTL but before long TTL
            vi.advanceTimersByTime(AGENT_INTERMEDIATE_CACHE_TTL + 1);

            // Prune expired entries
            const pruned = dataSource.pruneExpiredCache();

            // Should have pruned the short TTL entries
            expect(pruned).toBe(shortTtlKeys.length);

            // Short TTL entries should be gone
            for (const key of shortTtlKeys) {
              expect(dataSource.getCache(key)).toBeNull();
            }

            // Long TTL entries should still be valid
            for (const key of longTtlKeys) {
              expect(dataSource.getCache(key)).not.toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// =============================================================================
// Property 15: Cache Bypass with Force Refresh
// =============================================================================

describe('Feature: multi-agent-analysis, Property 15: Cache Bypass with Force Refresh', () => {
  /**
   * Property 15: Cache Bypass with Force Refresh
   * *For any* orchestrator execution with `options.forceRefresh = true`,
   * all cache lookups SHALL return null/miss, forcing fresh data fetches.
   * **Validates: Requirements 8.4**
   */

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('DataSourceCacheManager Force Refresh', () => {
    it('should clear all caches when clearAll is called (simulating forceRefresh)', async () => {
      await fc.assert(
        fc.asyncProperty(
          apiKeyArb,
          fc.array(fc.tuple(cacheKeyArb, cacheDataArb), { minLength: 1, maxLength: 10 }),
          async (apiKey, entries) => {
            const manager = createDataSourceManager({ serperApiKey: apiKey });

            // Populate caches in all data sources
            const sources = manager.getAll();
            for (const source of sources) {
              for (const [key, data] of entries) {
                source.setCache(`${source.name}:${key}`, data, EXTERNAL_API_CACHE_TTL);
              }
            }

            // Verify caches are populated
            expect(manager.getTotalCacheSize()).toBeGreaterThan(0);

            // Clear all caches (force refresh behavior)
            await manager.clearAll();

            // All caches should be empty
            expect(manager.getTotalCacheSize()).toBe(0);

            // All cache lookups should return null
            for (const source of sources) {
              for (const [key] of entries) {
                expect(source.getCache(`${source.name}:${key}`)).toBeNull();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should force fresh data fetch after cache clear', async () => {
      setupSerperMock([
        { title: 'Fresh News', snippet: 'Fresh content', source: 'Source', date: '2024-01-01', link: 'https://example.com' },
      ]);

      const serperSource = new SerperDataSource({ apiKey: 'test-key' });

      // First fetch - should call API
      await serperSource.searchNews('AAPL');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second fetch - should use cache
      mockFetch.mockClear();
      await serperSource.searchNews('AAPL');
      expect(mockFetch).not.toHaveBeenCalled();

      // Clear cache (force refresh)
      serperSource.clearCache();

      // Third fetch - should call API again
      await serperSource.searchNews('AAPL');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Individual DataSource Cache Bypass', () => {
    it('should return null for all keys after clearCache (SerperDataSource)', () => {
      fc.assert(
        fc.property(
          apiKeyArb,
          fc.integer({ min: 1, max: 20 }),
          cacheDataArb,
          (apiKey, count, data) => {
            const dataSource = new SerperDataSource({ apiKey });

            // Generate unique keys to avoid duplicates
            const keys: string[] = [];
            for (let i = 0; i < count; i++) {
              keys.push(`serper-key-${i}`);
              dataSource.setCache(`serper-key-${i}`, data, EXTERNAL_API_CACHE_TTL);
            }

            // Verify cache is populated
            expect(dataSource.getCacheSize()).toBe(count);

            // Clear cache (force refresh)
            dataSource.clearCache();

            // All lookups should return null
            for (const key of keys) {
              expect(dataSource.getCache(key)).toBeNull();
            }

            // Cache size should be 0
            expect(dataSource.getCacheSize()).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for all keys after clearCache (SECDataSource)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          cacheDataArb,
          (count, data) => {
            const dataSource = new SECDataSource();

            // Generate unique keys
            const keys: string[] = [];
            for (let i = 0; i < count; i++) {
              keys.push(`sec-key-${i}`);
              dataSource.setCache(`sec-key-${i}`, data, EXTERNAL_API_CACHE_TTL);
            }

            // Verify cache is populated
            expect(dataSource.getCacheSize()).toBe(count);

            // Clear cache (force refresh)
            dataSource.clearCache();

            // All lookups should return null
            for (const key of keys) {
              expect(dataSource.getCache(key)).toBeNull();
            }

            // Cache size should be 0
            expect(dataSource.getCacheSize()).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for all keys after clearCache (JinaDataSource)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          cacheDataArb,
          (count, data) => {
            const dataSource = new JinaDataSource();

            // Generate unique keys
            const keys: string[] = [];
            for (let i = 0; i < count; i++) {
              keys.push(`jina-key-${i}`);
              dataSource.setCache(`jina-key-${i}`, data, EXTERNAL_API_CACHE_TTL);
            }

            // Verify cache is populated
            expect(dataSource.getCacheSize()).toBe(count);

            // Clear cache (force refresh)
            dataSource.clearCache();

            // All lookups should return null
            for (const key of keys) {
              expect(dataSource.getCache(key)).toBeNull();
            }

            // Cache size should be 0
            expect(dataSource.getCacheSize()).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cache Bypass Does Not Affect New Entries', () => {
    it('should allow new cache entries after force refresh', () => {
      fc.assert(
        fc.property(
          apiKeyArb,
          fc.array(fc.tuple(cacheKeyArb, cacheDataArb), { minLength: 1, maxLength: 10 }),
          fc.array(fc.tuple(cacheKeyArb, cacheDataArb), { minLength: 1, maxLength: 10 }),
          (apiKey, oldEntries, newEntries) => {
            const dataSource = new SerperDataSource({ apiKey });

            // Populate with old entries
            for (const [key, data] of oldEntries) {
              dataSource.setCache(`old:${key}`, data, EXTERNAL_API_CACHE_TTL);
            }

            // Clear cache (force refresh)
            dataSource.clearCache();

            // Deduplicate new entries by key (last value wins, matching cache behavior)
            const newEntriesMap = new Map<string, unknown>();
            for (const [key, data] of newEntries) {
              newEntriesMap.set(key, data);
            }

            // Add new entries
            for (const [key, data] of newEntries) {
              dataSource.setCache(`new:${key}`, data, EXTERNAL_API_CACHE_TTL);
            }

            // Old entries should still be null
            for (const [key] of oldEntries) {
              expect(dataSource.getCache(`old:${key}`)).toBeNull();
            }

            // New entries should be retrievable (use deduplicated map for expected values)
            for (const [key, expectedData] of newEntriesMap) {
              expect(dataSource.getCache(`new:${key}`)).toEqual(expectedData);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Force Refresh with Multiple Data Sources', () => {
    it('should clear caches independently for each data source', () => {
      fc.assert(
        fc.property(
          apiKeyArb,
          cacheKeyArb,
          cacheDataArb,
          (apiKey, key, data) => {
            const serperSource = new SerperDataSource({ apiKey });
            const secSource = new SECDataSource();
            const jinaSource = new JinaDataSource();

            // Populate all caches
            serperSource.setCache(key, data, EXTERNAL_API_CACHE_TTL);
            secSource.setCache(key, data, EXTERNAL_API_CACHE_TTL);
            jinaSource.setCache(key, data, EXTERNAL_API_CACHE_TTL);

            // Clear only serper cache
            serperSource.clearCache();

            // Serper should be empty
            expect(serperSource.getCache(key)).toBeNull();

            // Others should still have data
            expect(secSource.getCache(key)).toEqual(data);
            expect(jinaSource.getCache(key)).toEqual(data);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clear all data source caches via manager', async () => {
      await fc.assert(
        fc.asyncProperty(
          apiKeyArb,
          cacheKeyArb,
          cacheDataArb,
          async (apiKey, key, data) => {
            const manager = createDataSourceManager({ serperApiKey: apiKey });

            // Populate all caches
            for (const source of manager.getAll()) {
              source.setCache(key, data, EXTERNAL_API_CACHE_TTL);
            }

            // Verify all have data
            for (const source of manager.getAll()) {
              expect(source.getCache(key)).toEqual(data);
            }

            // Clear all via manager
            await manager.clearAll();

            // All should be empty
            for (const source of manager.getAll()) {
              expect(source.getCache(key)).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Force Refresh Timing Independence', () => {
    it('should bypass cache regardless of remaining TTL', () => {
      fc.assert(
        fc.property(
          cacheKeyArb,
          cacheDataArb,
          fc.integer({ min: 0, max: EXTERNAL_API_CACHE_TTL - 1 }),
          (key, data, elapsedTime) => {
            const dataSource = new SerperDataSource({ apiKey: 'test-key' });

            // Set cache
            dataSource.setCache(key, data, EXTERNAL_API_CACHE_TTL);

            // Advance time (but still within TTL)
            vi.advanceTimersByTime(elapsedTime);

            // Verify cache is still valid
            expect(dataSource.getCache(key)).toEqual(data);

            // Force refresh (clear cache)
            dataSource.clearCache();

            // Cache should be bypassed regardless of remaining TTL
            expect(dataSource.getCache(key)).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// =============================================================================
// Additional Property Tests for RateLimiter
// =============================================================================

describe('Feature: multi-agent-analysis, RateLimiter Properties', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Token Bucket Algorithm', () => {
    it('should allow requests up to maxTokens', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 10 }),
          (maxTokens, refillRate) => {
            const limiter = new RateLimiter({ maxTokens, refillRate });

            // Should be able to acquire maxTokens immediately
            let acquired = 0;
            while (limiter.tryAcquire()) {
              acquired++;
              if (acquired > maxTokens) break; // Safety limit
            }

            expect(acquired).toBe(maxTokens);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should refill tokens over time', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1000, max: 5000 }),
          (maxTokens, refillRate, waitTimeMs) => {
            const limiter = new RateLimiter({ maxTokens, refillRate });

            // Exhaust all tokens
            while (limiter.tryAcquire()) {
              // drain
            }

            // Wait for refill
            vi.advanceTimersByTime(waitTimeMs);

            // Calculate expected tokens (capped at maxTokens)
            const expectedTokens = Math.min(maxTokens, (waitTimeMs / 1000) * refillRate);

            // Should have approximately expectedTokens available
            const availableTokens = limiter.getAvailableTokens();
            expect(availableTokens).toBeGreaterThanOrEqual(Math.floor(expectedTokens) - 1);
            expect(availableTokens).toBeLessThanOrEqual(maxTokens);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never exceed maxTokens', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 10000, max: 100000 }),
          (maxTokens, refillRate, waitTimeMs) => {
            const limiter = new RateLimiter({ maxTokens, refillRate });

            // Wait a long time
            vi.advanceTimersByTime(waitTimeMs);

            // Available tokens should never exceed maxTokens
            expect(limiter.getAvailableTokens()).toBeLessThanOrEqual(maxTokens);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('Feature: multi-agent-analysis, Factory Functions', () => {
  it('createSerperDataSource should create properly configured instance', () => {
    fc.assert(
      fc.property(apiKeyArb, (apiKey) => {
        const source = createSerperDataSource(apiKey);

        expect(source).toBeInstanceOf(SerperDataSource);
        expect(source.name).toBe('serper');
        expect(typeof source.isAvailable).toBe('function');
        expect(typeof source.getCache).toBe('function');
        expect(typeof source.setCache).toBe('function');
      }),
      { numRuns: 100 }
    );
  });

  it('createSECDataSource should create properly configured instance', () => {
    fc.assert(
      fc.property(fc.constant(undefined), () => {
        const source = createSECDataSource();

        expect(source).toBeInstanceOf(SECDataSource);
        expect(source.name).toBe('sec');
        expect(typeof source.isAvailable).toBe('function');
        expect(typeof source.getCache).toBe('function');
        expect(typeof source.setCache).toBe('function');
      }),
      { numRuns: 100 }
    );
  });

  it('createJinaDataSource should create properly configured instance', () => {
    fc.assert(
      fc.property(fc.constant(undefined), () => {
        const source = createJinaDataSource();

        expect(source).toBeInstanceOf(JinaDataSource);
        expect(source.name).toBe('jina');
        expect(typeof source.isAvailable).toBe('function');
        expect(typeof source.getCache).toBe('function');
        expect(typeof source.setCache).toBe('function');
      }),
      { numRuns: 100 }
    );
  });

  it('createDataSourceManager should register all configured sources', () => {
    fc.assert(
      fc.property(apiKeyArb, (apiKey) => {
        const manager = createDataSourceManager({ serperApiKey: apiKey });

        const sources = manager.getAll();

        // Should have at least SEC and Jina (always registered)
        expect(sources.length).toBeGreaterThanOrEqual(2);

        // Should have Serper if API key provided
        const serperSource = manager.get('serper');
        expect(serperSource).toBeDefined();

        // Should have SEC
        const secSource = manager.get('sec');
        expect(secSource).toBeDefined();

        // Should have Jina
        const jinaSource = manager.get('jina');
        expect(jinaSource).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});
