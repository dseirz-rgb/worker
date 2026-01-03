/**
 * UnifiedIntelligenceCache - Caching Strategy for Unified Intelligence System
 *
 * Implements multi-tier caching with different TTLs for different data types:
 * - Agent results: 5 min TTL
 * - LightRAG queries: 10 min TTL
 * - Market data: 1 hour TTL
 *
 * @module unifiedIntelligence/cache
 * @see {@link .kiro/specs/unified-intelligence/design.md}
 * @see Requirements 8.5, 8.6
 */

import type { QueryResult, AnalysisResult, DailyInsight } from './types';

// =============================================================================
// Types
// =============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  oldestEntry: number | null;
}

// =============================================================================
// Constants
// =============================================================================

/** Agent analysis results cache TTL (5 minutes) */
export const AGENT_RESULT_TTL = 5 * 60 * 1000;

/** LightRAG query cache TTL (10 minutes) */
export const LIGHTRAG_TTL = 10 * 60 * 1000;

/** Market data cache TTL (1 hour) */
export const MARKET_DATA_TTL = 60 * 60 * 1000;

/** Query result cache TTL (3 minutes) */
export const QUERY_RESULT_TTL = 3 * 60 * 1000;

/** Daily insight cache TTL (30 minutes) */
export const DAILY_INSIGHT_TTL = 30 * 60 * 1000;

/** Maximum cache size (number of entries) */
const MAX_CACHE_SIZE = 100;

// =============================================================================
// Cache Implementation
// =============================================================================

/**
 * UnifiedIntelligenceCache provides caching for the unified intelligence system.
 *
 * Features:
 * - Multi-tier TTL based on data type
 * - Automatic cache eviction (LRU-like)
 * - Cache invalidation by pattern
 * - Statistics tracking
 *
 * @example
 * ```typescript
 * const cache = new UnifiedIntelligenceCache();
 *
 * // Get or fetch with automatic caching
 * const result = await cache.getOrFetch(
 *   'query:what is my portfolio risk',
 *   () => unifiedService.query('what is my portfolio risk'),
 *   QUERY_RESULT_TTL
 * );
 *
 * // Invalidate on portfolio change
 * cache.invalidate('query:');
 * cache.invalidate('agent:');
 * ```
 */
export class UnifiedIntelligenceCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    oldestEntry: null,
  };

  // ===========================================================================
  // Core Methods
  // ===========================================================================

  /**
   * Get cached value or fetch and cache it.
   *
   * @param key - Cache key
   * @param fetcher - Function to fetch data if not cached
   * @param ttl - Time to live in milliseconds
   * @returns Cached or freshly fetched data
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      this.stats.hits++;
      return cached;
    }

    this.stats.misses++;
    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Get cached value if valid.
   *
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Entry expired
      this.cache.delete(key);
      this.updateStats();
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache value.
   *
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds
   */
  set<T>(key: string, data: T, ttl: number): void {
    // Evict old entries if cache is full
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      key,
    });
    this.updateStats();
  }

  /**
   * Invalidate cache entries matching a pattern.
   *
   * @param pattern - Pattern to match (substring match)
   */
  invalidate(pattern: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cache.delete(key));
    this.updateStats();
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      oldestEntry: null,
    };
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // ===========================================================================
  // Specialized Cache Methods
  // ===========================================================================

  /**
   * Cache query result.
   */
  cacheQueryResult(query: string, result: QueryResult): void {
    const key = this.buildQueryKey(query);
    this.set(key, result, QUERY_RESULT_TTL);
  }

  /**
   * Get cached query result.
   */
  getCachedQueryResult(query: string): QueryResult | null {
    const key = this.buildQueryKey(query);
    return this.get<QueryResult>(key);
  }

  /**
   * Cache analysis result.
   */
  cacheAnalysisResult(portfolioHash: string, result: AnalysisResult): void {
    const key = `analysis:${portfolioHash}`;
    this.set(key, result, AGENT_RESULT_TTL);
  }

  /**
   * Get cached analysis result.
   */
  getCachedAnalysisResult(portfolioHash: string): AnalysisResult | null {
    const key = `analysis:${portfolioHash}`;
    return this.get<AnalysisResult>(key);
  }

  /**
   * Cache daily insight.
   */
  cacheDailyInsight(date: string, insight: DailyInsight): void {
    const key = `daily:${date}`;
    this.set(key, insight, DAILY_INSIGHT_TTL);
  }

  /**
   * Get cached daily insight.
   */
  getCachedDailyInsight(date: string): DailyInsight | null {
    const key = `daily:${date}`;
    return this.get<DailyInsight>(key);
  }

  /**
   * Cache LightRAG result.
   */
  cacheLightRAGResult(query: string, result: unknown): void {
    const key = `lightrag:${this.hashString(query)}`;
    this.set(key, result, LIGHTRAG_TTL);
  }

  /**
   * Get cached LightRAG result.
   */
  getCachedLightRAGResult(query: string): unknown | null {
    const key = `lightrag:${this.hashString(query)}`;
    return this.get(key);
  }

  /**
   * Invalidate all query-related caches.
   */
  invalidateQueries(): void {
    this.invalidate('query:');
  }

  /**
   * Invalidate all analysis-related caches.
   */
  invalidateAnalysis(): void {
    this.invalidate('analysis:');
    this.invalidate('agent:');
  }

  /**
   * Invalidate all caches on portfolio change.
   */
  invalidateOnPortfolioChange(): void {
    this.invalidateQueries();
    this.invalidateAnalysis();
    this.invalidate('daily:');
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private buildQueryKey(query: string): string {
    return `query:${this.hashString(query)}`;
  }

  private hashString(str: string): string {
    // Simple hash for cache keys
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    this.cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private updateStats(): void {
    this.stats.size = this.cache.size;

    let oldest = Infinity;
    this.cache.forEach((entry) => {
      if (entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
    });
    this.stats.oldestEntry = oldest === Infinity ? null : oldest;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/** Global cache instance */
export const unifiedIntelligenceCache = new UnifiedIntelligenceCache();

// =============================================================================
// Default Export
// =============================================================================

export default UnifiedIntelligenceCache;
