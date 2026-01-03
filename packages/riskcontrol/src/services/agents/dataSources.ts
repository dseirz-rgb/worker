/**
 * Data Source Adapters for Multi-Agent Investment Analysis System
 *
 * This module provides external data source adapters for fetching news,
 * SEC filings, and web content. Each adapter implements caching and
 * rate limiting to optimize API usage.
 *
 * @module agents/dataSources
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for detailed design
 */

import type {
  DataSource,
  CacheEntry,
  RateLimiterConfig,
  NewsItem,
  SECFiling,
  ExtractedContent,
} from './types';

// =============================================================================
// Rate Limiter Implementation
// =============================================================================

/**
 * Token bucket rate limiter for API calls.
 * Implements a simple token bucket algorithm to prevent API rate limit violations.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  /**
   * Create a new rate limiter.
   *
   * @param config - Rate limiter configuration
   */
  constructor(config: RateLimiterConfig) {
    this.maxTokens = config.maxTokens;
    this.refillRate = config.refillRate;
    this.tokens = config.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on elapsed time.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Try to acquire a token for making an API call.
   *
   * @returns True if a token was acquired, false if rate limited
   */
  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * Wait until a token is available.
   *
   * @param timeoutMs - Maximum time to wait in milliseconds
   * @returns Promise that resolves when a token is acquired
   * @throws Error if timeout is exceeded
   */
  async waitForToken(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    while (!this.tryAcquire()) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('Rate limiter timeout exceeded');
      }
      // Wait for a short interval before retrying
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Get the current number of available tokens.
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

// =============================================================================
// Base Data Source Abstract Class
// =============================================================================

/**
 * Abstract base class for all data sources.
 * Provides common caching functionality and defines the interface.
 *
 * @see Requirements 6.1, 8.1, 8.2
 */
export abstract class BaseDataSource implements DataSource {
  /** Data source name for identification */
  abstract name: string;

  /** Internal cache storage */
  protected cache: Map<string, CacheEntry> = new Map();

  /**
   * Check if the data source is available.
   * Subclasses should implement specific availability checks.
   *
   * @returns True if the data source can be used
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get cached data if available and not expired.
   *
   * @param key - Cache key
   * @returns Cached data or null if not found/expired
   */
  getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Set cache with TTL.
   *
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttlMs - Time to live in milliseconds
   */
  setCache(key: string, data: unknown, ttlMs: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Clear all cached data.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached entries.
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Remove expired entries from cache.
   */
  pruneExpiredCache(): number {
    const now = Date.now();
    let pruned = 0;
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}

// =============================================================================
// Serper Data Source - News Search
// =============================================================================

/**
 * Serper API response structure for news search.
 */
interface SerperNewsResponse {
  news?: Array<{
    title: string;
    snippet: string;
    source: string;
    date: string;
    link: string;
  }>;
  searchParameters?: {
    q: string;
    type: string;
  };
}

/**
 * Configuration for SerperDataSource.
 */
export interface SerperDataSourceConfig {
  /** Serper API key */
  apiKey: string;
  /** Rate limiter configuration (default: 10 requests/second) */
  rateLimiter?: RateLimiterConfig;
  /** Cache TTL in milliseconds (default: 1 hour) */
  cacheTtlMs?: number;
}

/**
 * Data source for fetching news via Serper API.
 * Provides news search functionality with caching and rate limiting.
 *
 * @see Requirements 6.2, 4.1
 */
export class SerperDataSource extends BaseDataSource {
  name = 'serper';
  private apiKey: string;
  private rateLimiter: RateLimiter;
  private cacheTtlMs: number;

  /**
   * Create a new SerperDataSource.
   *
   * @param config - Configuration options
   */
  constructor(config: SerperDataSourceConfig) {
    super();
    this.apiKey = config.apiKey;
    this.rateLimiter = new RateLimiter(
      config.rateLimiter || { maxTokens: 10, refillRate: 1 }
    );
    this.cacheTtlMs = config.cacheTtlMs || 60 * 60 * 1000; // 1 hour default
  }

  /**
   * Check if the Serper API is available.
   *
   * @returns True if API key is configured
   */
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Search for news articles related to a stock ticker.
   *
   * @param ticker - Stock ticker symbol
   * @param query - Optional additional search query
   * @returns Array of news items
   */
  async searchNews(ticker: string, query?: string): Promise<NewsItem[]> {
    // Check cache first
    const cacheKey = `news:${ticker}:${query || ''}`;
    const cached = this.getCache<NewsItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Check availability
    if (!(await this.isAvailable())) {
      console.warn('SerperDataSource: API key not configured');
      return [];
    }

    // Wait for rate limiter
    try {
      await this.rateLimiter.waitForToken();
    } catch (error) {
      console.warn('SerperDataSource: Rate limit exceeded', error);
      return [];
    }

    // Make API request
    try {
      const searchQuery = `${ticker} stock ${query || 'news'}`;
      const response = await fetch('https://google.serper.dev/news', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: searchQuery,
          num: 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
      }

      const data: SerperNewsResponse = await response.json();
      const items = this.parseNewsResults(data);

      // Cache the results
      this.setCache(cacheKey, items, this.cacheTtlMs);
      return items;
    } catch (error) {
      console.error('SerperDataSource: Failed to fetch news', error);
      return [];
    }
  }

  /**
   * Parse Serper API response into NewsItem array.
   *
   * @param data - Raw API response
   * @returns Parsed news items
   */
  private parseNewsResults(data: SerperNewsResponse): NewsItem[] {
    if (!data.news || !Array.isArray(data.news)) {
      return [];
    }

    return data.news.map((item) => ({
      title: item.title || '',
      snippet: item.snippet || '',
      source: item.source || '',
      date: item.date || '',
      link: item.link || '',
      sentiment: undefined, // Sentiment analysis done separately
    }));
  }
}

// =============================================================================
// SEC Data Source - SEC Filings
// =============================================================================

/**
 * SEC EDGAR API response structure.
 */
interface SECSubmissionsResponse {
  cik: string;
  entityType: string;
  name: string;
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      form: string[];
      primaryDocument: string[];
    };
  };
}

/**
 * Configuration for SECDataSource.
 */
export interface SECDataSourceConfig {
  /** User agent for SEC API requests (required by SEC) */
  userAgent?: string;
  /** Cache TTL in milliseconds (default: 24 hours) */
  cacheTtlMs?: number;
}

/**
 * Data source for fetching SEC filings from EDGAR database.
 * Provides access to 10-K, 10-Q, and other SEC filings.
 *
 * @see Requirements 6.3, 4.4
 */
export class SECDataSource extends BaseDataSource {
  name = 'sec';
  private tickerToCIK: Map<string, string> = new Map();
  private userAgent: string;
  private cacheTtlMs: number;

  /**
   * Create a new SECDataSource.
   *
   * @param config - Configuration options
   */
  constructor(config: SECDataSourceConfig = {}) {
    super();
    this.userAgent = config.userAgent || 'InvestmentAnalyzer/1.0 (contact@example.com)';
    this.cacheTtlMs = config.cacheTtlMs || 24 * 60 * 60 * 1000; // 24 hours default
  }

  /**
   * Check if the SEC API is available.
   * SEC EDGAR is a public API, always available.
   *
   * @returns True (SEC EDGAR is always available)
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Get the latest SEC filings for a ticker.
   *
   * @param ticker - Stock ticker symbol
   * @param formTypes - Form types to filter (default: ['10-K', '10-Q'])
   * @returns Array of SEC filings
   */
  async getLatestFilings(
    ticker: string,
    formTypes: string[] = ['10-K', '10-Q']
  ): Promise<SECFiling[]> {
    // Check cache first
    const cacheKey = `sec:${ticker}:${formTypes.join(',')}`;
    const cached = this.getCache<SECFiling[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get CIK for ticker
    const cik = await this.getCIK(ticker);
    if (!cik) {
      console.warn(`SECDataSource: Could not find CIK for ticker ${ticker}`);
      return [];
    }

    // Fetch filings from SEC EDGAR
    try {
      const paddedCIK = cik.padStart(10, '0');
      const response = await fetch(
        `https://data.sec.gov/submissions/CIK${paddedCIK}.json`,
        {
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`SEC API error: ${response.status} ${response.statusText}`);
      }

      const data: SECSubmissionsResponse = await response.json();
      const filings = this.parseFilings(data, formTypes);

      // Cache the results
      this.setCache(cacheKey, filings, this.cacheTtlMs);
      return filings;
    } catch (error) {
      console.error('SECDataSource: Failed to fetch filings', error);
      return [];
    }
  }

  /**
   * Get the CIK (Central Index Key) for a ticker symbol.
   *
   * @param ticker - Stock ticker symbol
   * @returns CIK string or null if not found
   */
  async getCIK(ticker: string): Promise<string | null> {
    // Check local cache first
    const upperTicker = ticker.toUpperCase();
    if (this.tickerToCIK.has(upperTicker)) {
      return this.tickerToCIK.get(upperTicker) || null;
    }

    // Check persistent cache
    const cacheKey = `cik:${upperTicker}`;
    const cached = this.getCache<string>(cacheKey);
    if (cached) {
      this.tickerToCIK.set(upperTicker, cached);
      return cached;
    }

    // Fetch from SEC ticker mapping
    try {
      const response = await fetch(
        'https://www.sec.gov/files/company_tickers.json',
        {
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`SEC API error: ${response.status}`);
      }

      const data: Record<string, { cik_str: number; ticker: string; title: string }> =
        await response.json();

      // Build ticker to CIK mapping
      for (const entry of Object.values(data)) {
        this.tickerToCIK.set(entry.ticker.toUpperCase(), String(entry.cik_str));
      }

      const cik = this.tickerToCIK.get(upperTicker) || null;
      if (cik) {
        // Cache for 7 days (CIK mappings rarely change)
        this.setCache(cacheKey, cik, 7 * 24 * 60 * 60 * 1000);
      }
      return cik;
    } catch (error) {
      console.error('SECDataSource: Failed to fetch CIK mapping', error);
      return null;
    }
  }

  /**
   * Parse SEC submissions response into SECFiling array.
   *
   * @param data - Raw API response
   * @param formTypes - Form types to filter
   * @returns Parsed SEC filings
   */
  private parseFilings(
    data: SECSubmissionsResponse,
    formTypes: string[]
  ): SECFiling[] {
    const filings: SECFiling[] = [];
    const recent = data.filings?.recent;

    if (!recent) {
      return filings;
    }

    const formTypesSet = new Set(formTypes.map((f) => f.toUpperCase()));
    const maxFilings = 10; // Limit to most recent filings

    for (let i = 0; i < Math.min(recent.form.length, 100); i++) {
      const form = recent.form[i];
      if (formTypesSet.has(form.toUpperCase())) {
        filings.push({
          form,
          filingDate: recent.filingDate[i],
          accessionNumber: recent.accessionNumber[i],
          primaryDocument: recent.primaryDocument[i],
          highlights: undefined, // Highlights extracted separately
        });

        if (filings.length >= maxFilings) {
          break;
        }
      }
    }

    return filings;
  }

  /**
   * Get the URL for a specific SEC filing document.
   *
   * @param cik - Company CIK
   * @param accessionNumber - Filing accession number
   * @param primaryDocument - Primary document filename
   * @returns URL to the filing document
   */
  getFilingUrl(cik: string, accessionNumber: string, primaryDocument: string): string {
    const paddedCIK = cik.padStart(10, '0');
    const cleanAccession = accessionNumber.replace(/-/g, '');
    return `https://www.sec.gov/Archives/edgar/data/${paddedCIK}/${cleanAccession}/${primaryDocument}`;
  }
}

// =============================================================================
// Jina Data Source - Web Content Extraction
// =============================================================================

/**
 * Configuration for JinaDataSource.
 */
export interface JinaDataSourceConfig {
  /** Jina API key (optional, for higher rate limits) */
  apiKey?: string;
  /** Cache TTL in milliseconds (default: 1 hour) */
  cacheTtlMs?: number;
}

/**
 * Data source for extracting web content using Jina Reader API.
 * Provides clean text extraction from web pages.
 *
 * @see Requirements 6.4, 4.1.3, 4.1.4
 */
export class JinaDataSource extends BaseDataSource {
  name = 'jina';
  private apiKey?: string;
  private cacheTtlMs: number;

  /**
   * Create a new JinaDataSource.
   *
   * @param config - Configuration options
   */
  constructor(config: JinaDataSourceConfig = {}) {
    super();
    this.apiKey = config.apiKey;
    this.cacheTtlMs = config.cacheTtlMs || 60 * 60 * 1000; // 1 hour default
  }

  /**
   * Check if the Jina API is available.
   * Jina Reader has a free tier, always available.
   *
   * @returns True (Jina Reader is always available)
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Fetch and extract content from a URL.
   *
   * @param url - URL to extract content from
   * @returns Extracted content
   */
  async fetchArticleContent(url: string): Promise<ExtractedContent> {
    // Check cache first
    const cacheKey = `jina:${url}`;
    const cached = this.getCache<ExtractedContent>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Use Jina Reader API
      const headers: Record<string, string> = {
        Accept: 'text/plain',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`https://r.jina.ai/${url}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Jina API error: ${response.status} ${response.statusText}`);
      }

      const content = await response.text();
      const result: ExtractedContent = {
        url,
        title: this.extractTitle(content),
        content: this.cleanContent(content),
        extracted_data: {
          keyPoints: this.extractKeyPoints(content),
        },
      };

      // Cache the results
      this.setCache(cacheKey, result, this.cacheTtlMs);
      return result;
    } catch (error) {
      console.error('JinaDataSource: Failed to fetch content', error);
      return {
        url,
        title: '',
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        extracted_data: {},
      };
    }
  }

  /**
   * Extract title from content.
   * Jina Reader typically returns title as the first line.
   *
   * @param content - Raw content from Jina
   * @returns Extracted title
   */
  private extractTitle(content: string): string {
    const lines = content.split('\n');
    // First non-empty line is usually the title
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('http')) {
        return trimmed;
      }
    }
    return '';
  }

  /**
   * Clean and normalize content.
   *
   * @param content - Raw content from Jina
   * @returns Cleaned content
   */
  private cleanContent(content: string): string {
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n')
      .trim();
  }

  /**
   * Extract key points from content.
   * Simple heuristic: look for bullet points or numbered lists.
   *
   * @param content - Raw content
   * @returns Array of key points
   */
  private extractKeyPoints(content: string): string[] {
    const keyPoints: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Look for bullet points or numbered items
      if (
        trimmed.match(/^[-•*]\s+/) ||
        trimmed.match(/^\d+\.\s+/)
      ) {
        const point = trimmed.replace(/^[-•*\d.]+\s+/, '').trim();
        if (point.length > 10 && point.length < 500) {
          keyPoints.push(point);
        }
      }
    }

    return keyPoints.slice(0, 10); // Limit to 10 key points
  }

  /**
   * Fetch SEC filing content.
   * Specialized method for extracting SEC filing documents.
   *
   * @param filingUrl - URL to SEC filing
   * @returns Extracted content with financial data
   */
  async fetchSECFilingContent(filingUrl: string): Promise<ExtractedContent> {
    const result = await this.fetchArticleContent(filingUrl);

    // Additional processing for SEC filings
    if (result.content) {
      result.extracted_data.financialData = this.extractFinancialData(result.content);
    }

    return result;
  }

  /**
   * Extract financial data from SEC filing content.
   * Simple pattern matching for common financial metrics.
   *
   * @param content - Filing content
   * @returns Extracted financial data
   */
  private extractFinancialData(content: string): Record<string, unknown> {
    const financialData: Record<string, unknown> = {};

    // Look for common financial terms and their values
    const patterns = [
      { key: 'revenue', pattern: /(?:total\s+)?revenue[:\s]+\$?([\d,.]+)\s*(million|billion)?/i },
      { key: 'netIncome', pattern: /net\s+income[:\s]+\$?([\d,.]+)\s*(million|billion)?/i },
      { key: 'eps', pattern: /(?:diluted\s+)?(?:eps|earnings\s+per\s+share)[:\s]+\$?([\d.]+)/i },
      { key: 'totalAssets', pattern: /total\s+assets[:\s]+\$?([\d,.]+)\s*(million|billion)?/i },
    ];

    for (const { key, pattern } of patterns) {
      const match = content.match(pattern);
      if (match) {
        let value = parseFloat(match[1].replace(/,/g, ''));
        const multiplier = match[2]?.toLowerCase();
        if (multiplier === 'billion') {
          value *= 1_000_000_000;
        } else if (multiplier === 'million') {
          value *= 1_000_000;
        }
        financialData[key] = value;
      }
    }

    return financialData;
  }
}

// =============================================================================
// Data Source Cache Manager
// =============================================================================

/**
 * Manager for coordinating multiple data sources and their caches.
 *
 * @see Requirements 8.1, 8.2
 */
export class DataSourceCacheManager {
  private sources: Map<string, BaseDataSource> = new Map();

  /**
   * Register a data source with the manager.
   *
   * @param source - Data source to register
   */
  register(source: BaseDataSource): void {
    this.sources.set(source.name, source);
  }

  /**
   * Get a registered data source by name.
   *
   * @param name - Data source name
   * @returns Data source or undefined if not found
   */
  get(name: string): BaseDataSource | undefined {
    return this.sources.get(name);
  }

  /**
   * Get all registered data sources.
   *
   * @returns Array of registered data sources
   */
  getAll(): BaseDataSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Clear all caches across all data sources.
   */
  async clearAll(): Promise<void> {
    const sources = Array.from(this.sources.values());
    for (const source of sources) {
      source.clearCache();
    }
  }

  /**
   * Prune expired entries from all caches.
   *
   * @returns Total number of entries pruned
   */
  pruneAll(): number {
    let totalPruned = 0;
    const sources = Array.from(this.sources.values());
    for (const source of sources) {
      totalPruned += source.pruneExpiredCache();
    }
    return totalPruned;
  }

  /**
   * Get total cache size across all data sources.
   *
   * @returns Total number of cached entries
   */
  getTotalCacheSize(): number {
    let total = 0;
    const sources = Array.from(this.sources.values());
    for (const source of sources) {
      total += source.getCacheSize();
    }
    return total;
  }

  /**
   * Check availability of all data sources.
   *
   * @returns Map of source name to availability status
   */
  async checkAvailability(): Promise<Map<string, boolean>> {
    const availability = new Map<string, boolean>();
    const entries = Array.from(this.sources.entries());
    for (const [name, source] of entries) {
      availability.set(name, await source.isAvailable());
    }
    return availability;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a SerperDataSource with the given API key.
 *
 * @param apiKey - Serper API key
 * @param options - Additional configuration options
 * @returns Configured SerperDataSource
 */
export function createSerperDataSource(
  apiKey: string,
  options?: Partial<Omit<SerperDataSourceConfig, 'apiKey'>>
): SerperDataSource {
  return new SerperDataSource({
    apiKey,
    ...options,
  });
}

/**
 * Create a SECDataSource with optional configuration.
 *
 * @param options - Configuration options
 * @returns Configured SECDataSource
 */
export function createSECDataSource(
  options?: SECDataSourceConfig
): SECDataSource {
  return new SECDataSource(options);
}

/**
 * Create a JinaDataSource with optional configuration.
 *
 * @param options - Configuration options
 * @returns Configured JinaDataSource
 */
export function createJinaDataSource(
  options?: JinaDataSourceConfig
): JinaDataSource {
  return new JinaDataSource(options);
}

/**
 * Create a DataSourceCacheManager with all standard data sources.
 *
 * @param config - Configuration for each data source
 * @returns Configured DataSourceCacheManager
 */
export function createDataSourceManager(config: {
  serperApiKey?: string;
  jinaApiKey?: string;
  secUserAgent?: string;
}): DataSourceCacheManager {
  const manager = new DataSourceCacheManager();

  if (config.serperApiKey) {
    manager.register(createSerperDataSource(config.serperApiKey));
  }

  manager.register(createSECDataSource({ userAgent: config.secUserAgent }));
  manager.register(createJinaDataSource({ apiKey: config.jinaApiKey }));

  return manager;
}
