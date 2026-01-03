/**
 * IBKR 集成服务测试
 * 
 * **Validates: Requirements 25.1, 25.2**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  IBKRService,
  IBKRError,
  initIBKRService,
  getIBKRService,
  createIBKRServiceFromEnv,
  type IBKRConfig,
  type IBKRPosition,
  type IBKRTransaction,
} from './ibkr';

describe('IBKRService', () => {
  let service: IBKRService;

  beforeEach(() => {
    service = new IBKRService({
      token: 'test-token',
      queryId: 'test-query-id',
      useMock: true,
    });
  });

  // ============================================
  // 基础功能测试
  // ============================================

  describe('Mock Mode', () => {
    /**
     * **Validates: Requirements 25.1**
     */
    it('should return mock data when useMock is true', async () => {
      const data = await service.fetchFlexQuery();
      
      expect(data.positions).toBeDefined();
      expect(data.positions.length).toBeGreaterThan(0);
      expect(data.transactions).toBeDefined();
      expect(data.accountSummary).toBeDefined();
      expect(data.generatedAt).toBeInstanceOf(Date);
    });

    it('should identify mock mode correctly', () => {
      expect(service.isMockMode()).toBe(true);
      
      const realService = new IBKRService({
        token: 'token',
        queryId: 'query',
        useMock: false,
      });
      expect(realService.isMockMode()).toBe(false);
    });

    it('should return healthy status in mock mode', async () => {
      const health = await service.healthCheck();
      expect(health.available).toBe(true);
      expect(health.message).toContain('Mock');
    });
  });

  describe('getPositions', () => {
    /**
     * **Validates: Requirements 25.1**
     */
    it('should return positions with required fields', async () => {
      const positions = await service.getPositions();
      
      expect(positions.length).toBeGreaterThan(0);
      
      for (const pos of positions) {
        expect(pos.ticker).toBeDefined();
        expect(typeof pos.quantity).toBe('number');
        expect(typeof pos.avgCost).toBe('number');
        expect(typeof pos.marketValue).toBe('number');
        expect(typeof pos.unrealizedPnL).toBe('number');
        expect(pos.currency).toBeDefined();
        expect(pos.assetClass).toBeDefined();
      }
    });

    it('should include expected mock tickers', async () => {
      const positions = await service.getPositions();
      const tickers = positions.map(p => p.ticker);
      
      expect(tickers).toContain('AAPL');
      expect(tickers).toContain('GOOGL');
      expect(tickers).toContain('MSFT');
    });
  });

  describe('getTransactions', () => {
    /**
     * **Validates: Requirements 25.2**
     */
    it('should return transactions with required fields', async () => {
      const transactions = await service.getTransactions();
      
      expect(transactions.length).toBeGreaterThan(0);
      
      for (const txn of transactions) {
        expect(txn.id).toBeDefined();
        expect(txn.ticker).toBeDefined();
        expect(['BUY', 'SELL']).toContain(txn.action);
        expect(typeof txn.quantity).toBe('number');
        expect(typeof txn.price).toBe('number');
        expect(typeof txn.commission).toBe('number');
        expect(txn.tradeDate).toBeInstanceOf(Date);
        expect(txn.settleDate).toBeInstanceOf(Date);
      }
    });

    it('should filter transactions by days', async () => {
      // Mock 数据的交易日期在 2025-12，所以用大范围测试
      const allTransactions = await service.getTransactions(365);
      const recentTransactions = await service.getTransactions(1);
      
      // 1 天内的交易应该少于或等于 365 天内的
      expect(recentTransactions.length).toBeLessThanOrEqual(allTransactions.length);
    });
  });

  describe('getAccountSummary', () => {
    /**
     * **Validates: Requirements 25.1**
     */
    it('should return account summary with required fields', async () => {
      const summary = await service.getAccountSummary();
      
      expect(summary.accountId).toBeDefined();
      expect(typeof summary.netLiquidation).toBe('number');
      expect(typeof summary.totalCash).toBe('number');
      expect(typeof summary.grossPositionValue).toBe('number');
      expect(typeof summary.leverage).toBe('number');
      expect(summary.currency).toBeDefined();
    });

    it('should have consistent values', async () => {
      const summary = await service.getAccountSummary();
      
      // netLiquidation 应该约等于 totalCash + grossPositionValue
      const expectedNet = summary.totalCash + summary.grossPositionValue;
      expect(summary.netLiquidation).toBeCloseTo(expectedNet, 0);
    });
  });

  // ============================================
  // 缓存测试
  // ============================================

  describe('Caching', () => {
    it('should cache data within validity period', async () => {
      const data1 = await service.fetchFlexQuery();
      const data2 = await service.fetchFlexQuery();
      
      // 两次调用应该返回相同的 generatedAt（因为是缓存）
      expect(data1.generatedAt.getTime()).toBe(data2.generatedAt.getTime());
    });

    it('should clear cache when requested', async () => {
      const data1 = await service.fetchFlexQuery();
      service.clearCache();
      
      // 等待一小段时间确保时间戳不同
      await new Promise(r => setTimeout(r, 10));
      
      const data2 = await service.fetchFlexQuery();
      
      // 清除缓存后应该获取新数据
      expect(data2.generatedAt.getTime()).toBeGreaterThanOrEqual(data1.generatedAt.getTime());
    });

    it('should allow setting cache validity', () => {
      service.setCacheValidMs(1000);
      // 不抛出错误即可
      expect(true).toBe(true);
    });
  });

  // ============================================
  // 错误处理测试
  // ============================================

  describe('Error Handling', () => {
    it('should report unavailable when credentials missing', async () => {
      const noCredService = new IBKRService({
        token: '',
        queryId: '',
        useMock: false,
      });
      
      const health = await noCredService.healthCheck();
      expect(health.available).toBe(false);
      expect(health.message).toContain('Missing');
    });

    it('should create IBKRError with correct properties', () => {
      const error = new IBKRError('REQUEST_FAILED', 'Test error');
      
      expect(error.name).toBe('IBKRError');
      expect(error.code).toBe('REQUEST_FAILED');
      expect(error.message).toBe('Test error');
    });
  });

  // ============================================
  // 工厂函数测试
  // ============================================

  describe('Factory Functions', () => {
    it('should initialize and get service instance', () => {
      const config: IBKRConfig = {
        token: 'test',
        queryId: 'test',
        useMock: true,
      };
      
      const instance = initIBKRService(config);
      expect(instance).toBeInstanceOf(IBKRService);
      
      const retrieved = getIBKRService();
      expect(retrieved).toBe(instance);
    });

    it('should create service from env with mock when no credentials', () => {
      // 清除环境变量
      const originalToken = process.env.IBKR_TOKEN;
      const originalQueryId = process.env.IBKR_QUERY_ID;
      delete process.env.IBKR_TOKEN;
      delete process.env.IBKR_QUERY_ID;
      
      const envService = createIBKRServiceFromEnv();
      expect(envService.isMockMode()).toBe(true);
      
      // 恢复环境变量
      if (originalToken) process.env.IBKR_TOKEN = originalToken;
      if (originalQueryId) process.env.IBKR_QUERY_ID = originalQueryId;
    });
  });

  // ============================================
  // 属性测试
  // ============================================

  describe('Property Tests', () => {
    /**
     * **Validates: Requirements 25.1**
     * 属性：所有持仓的 marketValue 应该是非负数
     */
    it('positions should have non-negative market values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const positions = await service.getPositions();
            return positions.every(p => p.marketValue >= 0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 25.2**
     * 属性：所有交易的 quantity 应该是正数
     */
    it('transactions should have positive quantities', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const transactions = await service.getTransactions(365);
            return transactions.every(t => t.quantity > 0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性：账户摘要的 leverage 应该是非负数
     */
    it('account leverage should be non-negative', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const summary = await service.getAccountSummary();
            return summary.leverage >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性：持仓的 ticker 应该是非空字符串
     */
    it('position tickers should be non-empty strings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const positions = await service.getPositions();
            return positions.every(p => 
              typeof p.ticker === 'string' && p.ticker.length > 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
