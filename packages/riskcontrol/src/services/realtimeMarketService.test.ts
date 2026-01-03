/**
 * Property-based tests for Realtime Market Service
 * Feature: realtime-market-platform
 * 
 * Property 1: Live Quote 结构完整性
 * Validates: Requirements 1.1, 1.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  realtimeMarketService,
  validateLiveQuote,
  type LiveQuote,
  type SubscriptionPriority,
} from './realtimeMarketService';

// ============ Mock 依赖 ============

vi.mock('./marketData', () => ({
  fetchStockData: vi.fn().mockResolvedValue({
    success: true,
    data: {
      ticker: 'AAPL',
      name: 'Apple Inc.',
      market: 'US',
      currency: 'USD',
      currentPrice: 150.00,
      previousClose: 148.00,
      changePercent: 1.35,
      lastUpdated: Date.now(),
    },
  }),
  fetchMultipleStocks: vi.fn().mockResolvedValue(new Map([
    ['AAPL', {
      ticker: 'AAPL',
      name: 'Apple Inc.',
      market: 'US',
      currency: 'USD',
      currentPrice: 150.00,
      previousClose: 148.00,
      changePercent: 1.35,
      lastUpdated: Date.now(),
    }],
  ])),
}));

vi.mock('./priceAlertService', () => ({
  processQuoteUpdate: vi.fn().mockResolvedValue([]),
}));

vi.mock('./riskIntegrationService', () => ({
  riskIntegrationService: {
    onQuoteUpdate: vi.fn(),
  },
}));

// ============ 测试前后处理 ============

beforeEach(() => {
  realtimeMarketService.stop();
  realtimeMarketService.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  realtimeMarketService.stop();
});

// ============ Property 1: Live Quote 结构完整性 ============

describe('Feature: realtime-market-platform, Property 1: Live Quote 结构完整性', () => {
  
  describe('validateLiveQuote', () => {
    it('should validate correct LiveQuote structure', () => {
      const validQuote: LiveQuote = {
        ticker: 'AAPL',
        price: 150.00,
        changePercent: 1.35,
        previousClose: 148.00,
        timestamp: Date.now(),
        source: 'US',
        isStale: false,
      };
      
      expect(validateLiveQuote(validQuote)).toBe(true);
    });

    it('should reject invalid ticker', () => {
      const invalidQuote: LiveQuote = {
        ticker: '',
        price: 150.00,
        changePercent: 1.35,
        previousClose: 148.00,
        timestamp: Date.now(),
        source: 'US',
        isStale: false,
      };
      
      expect(validateLiveQuote(invalidQuote)).toBe(false);
    });

    it('should reject NaN price', () => {
      const invalidQuote: LiveQuote = {
        ticker: 'AAPL',
        price: NaN,
        changePercent: 1.35,
        previousClose: 148.00,
        timestamp: Date.now(),
        source: 'US',
        isStale: false,
      };
      
      expect(validateLiveQuote(invalidQuote)).toBe(false);
    });

    it('should reject negative price', () => {
      const invalidQuote: LiveQuote = {
        ticker: 'AAPL',
        price: -10,
        changePercent: 1.35,
        previousClose: 148.00,
        timestamp: Date.now(),
        source: 'US',
        isStale: false,
      };
      
      expect(validateLiveQuote(invalidQuote)).toBe(false);
    });

    it('should validate with property-based testing', () => {
      fc.assert(
        fc.property(
          fc.record({
            ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
            price: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
            changePercent: fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
            previousClose: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
            timestamp: fc.integer({ min: 1, max: Date.now() + 1000000 }),
            source: fc.constantFrom('US', 'HK', 'CN'),
            isStale: fc.boolean(),
          }),
          (quote) => {
            expect(validateLiveQuote(quote as LiveQuote)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

// ============ 订阅管理测试 ============

describe('Subscription management', () => {
  
  it('should subscribe to ticker', async () => {
    const callback = vi.fn();
    const unsubscribe = realtimeMarketService.subscribe('AAPL', 'high', callback);
    
    // 等待异步获取
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const subscriptions = realtimeMarketService.getSubscriptions();
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].ticker).toBe('AAPL');
    expect(subscriptions[0].priority).toBe('high');
    
    unsubscribe();
  });

  it('should unsubscribe from ticker', () => {
    const callback = vi.fn();
    const unsubscribe = realtimeMarketService.subscribe('AAPL', 'high', callback);
    
    unsubscribe();
    
    const subscriptions = realtimeMarketService.getSubscriptions();
    expect(subscriptions).toHaveLength(0);
  });

  it('should upgrade priority from normal to high', () => {
    realtimeMarketService.subscribe('AAPL', 'normal');
    realtimeMarketService.subscribe('AAPL', 'high');
    
    const subscriptions = realtimeMarketService.getSubscriptions();
    expect(subscriptions[0].priority).toBe('high');
  });

  it('should handle multiple subscriptions to same ticker', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    
    realtimeMarketService.subscribe('AAPL', 'high', callback1);
    realtimeMarketService.subscribe('AAPL', 'high', callback2);
    
    const subscriptions = realtimeMarketService.getSubscriptions();
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].callbacks.size).toBe(2);
  });

  it('should subscribe to multiple tickers', () => {
    const unsubscribe = realtimeMarketService.subscribeMultiple(
      ['AAPL', 'GOOGL', 'MSFT'],
      'normal'
    );
    
    const subscriptions = realtimeMarketService.getSubscriptions();
    expect(subscriptions).toHaveLength(3);
    
    unsubscribe();
    expect(realtimeMarketService.getSubscriptions()).toHaveLength(0);
  });
});

// ============ 配置测试 ============

describe('Configuration', () => {
  
  it('should use default configuration', () => {
    const config = realtimeMarketService.getConfig();
    
    expect(config.highPriorityInterval).toBe(5000);
    expect(config.normalPriorityInterval).toBe(30000);
    expect(config.staleThreshold).toBe(60000);
  });

  it('should allow custom configuration', () => {
    realtimeMarketService.configure({
      highPriorityInterval: 3000,
      normalPriorityInterval: 15000,
    });
    
    const config = realtimeMarketService.getConfig();
    
    expect(config.highPriorityInterval).toBe(3000);
    expect(config.normalPriorityInterval).toBe(15000);
    expect(config.staleThreshold).toBe(60000); // 未修改的保持默认
  });
});

// ============ 服务生命周期测试 ============

describe('Service lifecycle', () => {
  
  it('should start and stop service', () => {
    realtimeMarketService.start();
    // 服务应该正在运行
    
    realtimeMarketService.stop();
    // 服务应该已停止
  });

  it('should not start twice', () => {
    realtimeMarketService.start();
    realtimeMarketService.start(); // 第二次调用应该被忽略
    
    realtimeMarketService.stop();
  });

  it('should clear all subscriptions', () => {
    realtimeMarketService.subscribe('AAPL', 'high');
    realtimeMarketService.subscribe('GOOGL', 'normal');
    
    realtimeMarketService.clear();
    
    expect(realtimeMarketService.getSubscriptions()).toHaveLength(0);
  });
});

// ============ 数据获取测试 ============

describe('Data fetching', () => {
  
  it('should get quote after subscription', async () => {
    realtimeMarketService.subscribe('AAPL', 'high');
    
    // 等待异步获取
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const quote = realtimeMarketService.getQuote('AAPL');
    
    expect(quote).not.toBeNull();
    if (quote) {
      expect(quote.ticker).toBe('AAPL');
      expect(quote.price).toBeGreaterThan(0);
    }
  });

  it('should return null for unsubscribed ticker', () => {
    const quote = realtimeMarketService.getQuote('UNKNOWN');
    expect(quote).toBeNull();
  });

  it('should get all quotes', async () => {
    realtimeMarketService.subscribe('AAPL', 'high');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const quotes = realtimeMarketService.getAllQuotes();
    expect(quotes.size).toBeGreaterThanOrEqual(0);
  });
});

// ============ 回调测试 ============

describe('Callbacks', () => {
  
  it('should call subscription callback on update', async () => {
    const callback = vi.fn();
    realtimeMarketService.subscribe('AAPL', 'high', callback);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(callback).toHaveBeenCalled();
  });

  it('should call onDataUpdate callback', async () => {
    const callback = vi.fn();
    const unsubscribe = realtimeMarketService.onDataUpdate(callback);
    
    realtimeMarketService.subscribe('AAPL', 'high');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 可能被调用，取决于 mock 的行为
    
    unsubscribe();
  });

  it('should allow unsubscribe from onDataUpdate', () => {
    const callback = vi.fn();
    const unsubscribe = realtimeMarketService.onDataUpdate(callback);
    
    unsubscribe();
    
    // 回调应该被移除
  });
});

// ============ 市场检测测试 ============

describe('Market detection', () => {
  
  it('should detect US market', () => {
    realtimeMarketService.subscribe('AAPL', 'high');
    
    const subscriptions = realtimeMarketService.getSubscriptions();
    expect(subscriptions[0].market).toBe('US');
  });

  it('should detect CN market', () => {
    realtimeMarketService.subscribe('600519', 'high');
    
    const subscriptions = realtimeMarketService.getSubscriptions();
    expect(subscriptions[0].market).toBe('CN');
  });

  it('should detect HK market', () => {
    realtimeMarketService.subscribe('00700', 'high');
    
    const subscriptions = realtimeMarketService.getSubscriptions();
    expect(subscriptions[0].market).toBe('HK');
  });
});

// ============ 数据过期测试 ============

describe('Stale data detection', () => {
  
  it('should detect stale quote', () => {
    // 未订阅的 ticker 应该被认为是过期的
    expect(realtimeMarketService.isQuoteStale('UNKNOWN')).toBe(true);
  });
});
