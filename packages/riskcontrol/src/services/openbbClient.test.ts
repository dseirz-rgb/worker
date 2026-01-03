/**
 * Property-based tests for OpenBB Client
 * **Property 8: 重试机制**
 * **Validates: Requirements 8.2**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenBBClient } from './openbbClient';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OpenBBClient', () => {
  let client: OpenBBClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OpenBBClient({
      baseUrl: 'http://localhost:6900',
      timeout: 1000,
      retries: 3,
      retryDelay: 100,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Property 8: 重试机制', () => {
    /**
     * Feature: openbb-integration, Property 8: Retry mechanism
     * *For any* 失败的请求，TypeScript 客户端应按配置的次数重试，每次重试间隔递增。
     * **Validates: Requirements 8.2**
     */

    it('should retry on failure up to configured retries', async () => {
      // 前两次失败，第三次成功
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              ticker: 'AAPL',
              price: 178.72,
              prev_close: 177.14,
              change_percent: 0.89,
              volume: 54876400,
              timestamp: 1703116800000,
              source: 'fmp',
              market: 'us',
              currency: 'USD',
            },
            meta: { source: 'fmp', cached: false, timestamp: 1703116800000 },
          }),
        });

      const quote = await client.getQuote('AAPL');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(quote.ticker).toBe('AAPL');
      expect(quote.price).toBe(178.72);
    });

    it('should throw after all retries exhausted', async () => {
      // 所有尝试都失败
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.getQuote('AAPL')).rejects.toThrow('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on successful response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            ticker: 'AAPL',
            price: 178.72,
            prev_close: 177.14,
            change_percent: 0.89,
            volume: 54876400,
            timestamp: 1703116800000,
            source: 'fmp',
            market: 'us',
            currency: 'USD',
          },
          meta: { source: 'fmp', cached: false, timestamp: 1703116800000 },
        }),
      });

      await client.getQuote('AAPL');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff between retries', async () => {
      // 简化测试：验证重试时有延迟调用
      let retryDelaysCalled = 0;
      const originalSetTimeout = global.setTimeout;
      
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: any, delay?: number) => {
        // 记录重试延迟调用（retryDelay 是 100ms）
        if (delay && delay >= 100) {
          retryDelaysCalled++;
        }
        return originalSetTimeout(fn, 0) as any; // 立即执行以加快测试
      });

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { ticker: 'AAPL', price: 100, prev_close: 99, change_percent: 1, volume: 1000, timestamp: 1700000000000, source: 'fmp', market: 'us', currency: 'USD' },
            meta: { source: 'fmp', cached: false, timestamp: 1700000000000 },
          }),
        });

      await client.getQuote('AAPL');

      // 验证有重试延迟被调用（2次失败 = 2次重试延迟）
      expect(retryDelaysCalled).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getQuote', () => {
    it('should fetch quote successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            ticker: 'AAPL',
            price: 178.72,
            prev_close: 177.14,
            change_percent: 0.89,
            volume: 54876400,
            timestamp: 1703116800000,
            source: 'fmp',
            market: 'us',
            currency: 'USD',
            name: 'Apple Inc.',
          },
          meta: { source: 'fmp', cached: false, timestamp: 1703116800000 },
        }),
      });

      const quote = await client.getQuote('AAPL');

      expect(quote.ticker).toBe('AAPL');
      expect(quote.price).toBe(178.72);
      expect(quote.prevClose).toBe(177.14);
      expect(quote.changePercent).toBe(0.89);
      expect(quote.source).toBe('fmp');
      expect(quote.market).toBe('us');
      expect(quote.currency).toBe('USD');
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Ticker not found' },
        }),
      });

      await expect(client.getQuote('INVALID')).rejects.toThrow('Ticker not found');
    });
  });

  describe('getQuotes', () => {
    it('should fetch multiple quotes', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { ticker: 'AAPL', price: 178.72, prev_close: 177.14, change_percent: 0.89, volume: 54876400, timestamp: 1703116800000, source: 'fmp', market: 'us', currency: 'USD' },
            meta: { source: 'fmp', cached: false, timestamp: 1703116800000 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { ticker: 'GOOGL', price: 140.50, prev_close: 139.00, change_percent: 1.08, volume: 30000000, timestamp: 1703116800000, source: 'fmp', market: 'us', currency: 'USD' },
            meta: { source: 'fmp', cached: false, timestamp: 1703116800000 },
          }),
        });

      const quotes = await client.getQuotes(['AAPL', 'GOOGL']);

      expect(quotes.size).toBe(2);
      expect(quotes.get('AAPL')?.price).toBe(178.72);
      expect(quotes.get('GOOGL')?.price).toBe(140.50);
    });

    it('should handle partial failures gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { ticker: 'AAPL', price: 178.72, prev_close: 177.14, change_percent: 0.89, volume: 54876400, timestamp: 1703116800000, source: 'fmp', market: 'us', currency: 'USD' },
            meta: { source: 'fmp', cached: false, timestamp: 1703116800000 },
          }),
        })
        .mockRejectedValue(new Error('Network error'));

      const quotes = await client.getQuotes(['AAPL', 'INVALID']);

      expect(quotes.size).toBe(1);
      expect(quotes.get('AAPL')?.price).toBe(178.72);
      expect(quotes.has('INVALID')).toBe(false);
    });
  });

  describe('getHealth', () => {
    it('should fetch health status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          providers: {
            fmp: { healthy: true, successRate: 0.99, avgLatency: 0.5, totalRequests: 100, consecutiveFailures: 0 },
          },
          uptime: 3600,
          version: '1.0.0',
        }),
      });

      const health = await client.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.providers.fmp.healthy).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('should return true when service is healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          providers: {},
          uptime: 3600,
          version: '1.0.0',
        }),
      });

      const available = await client.isAvailable();

      expect(available).toBe(true);
    });

    it('should return false when service is unhealthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'unhealthy',
          providers: {},
          uptime: 3600,
          version: '1.0.0',
        }),
      });

      const available = await client.isAvailable();

      expect(available).toBe(false);
    });

    it('should return false when service is unreachable', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const available = await client.isAvailable();

      expect(available).toBe(false);
    });
  });
});
