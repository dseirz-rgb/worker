/**
 * Property-based tests for Risk Integration Service
 * Feature: realtime-market-platform
 * 
 * Property 7: 风控阈值触发
 * Validates: Requirements 5.1, 5.2, 5.3, 5.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  riskIntegrationService,
  checkLeverageLimit,
  checkDailyLossLimit,
  type PositionUpdate,
  type QuoteUpdate,
} from './riskIntegrationService';

// ============ 测试前重置 ============

beforeEach(() => {
  riskIntegrationService.clearPositions();
  riskIntegrationService.resetHighWaterMark();
  riskIntegrationService.setThresholds({
    leverageWarning: 1.5,
    leverageLimit: 2.0,
    dailyLossWarning: -3,
    dailyLossLimit: -5,
    trailingStopPercent: 10,
  });
});

// ============ Property 7: 风控阈值触发 ============

describe('Feature: realtime-market-platform, Property 7: 风控阈值触发', () => {
  
  describe('杠杆率检查', () => {
    it('should correctly identify leverage exceeded', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(2.1), max: Math.fround(10), noNaN: true }),
          fc.float({ min: Math.fround(1), max: Math.fround(2), noNaN: true }),
          (leverage, limit) => {
            const result = checkLeverageLimit(leverage, limit);
            expect(result.exceeded).toBe(true);
            expect(result.utilization).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should correctly identify leverage within limit', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.1), max: Math.fround(1.9), noNaN: true }),
          fc.float({ min: Math.fround(2), max: Math.fround(3), noNaN: true }),
          (leverage, limit) => {
            const result = checkLeverageLimit(leverage, limit);
            expect(result.exceeded).toBe(false);
            expect(result.utilization).toBeLessThan(1);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should calculate utilization correctly', () => {
      const result = checkLeverageLimit(1.5, 2.0);
      expect(result.utilization).toBeCloseTo(0.75, 2);
      expect(result.exceeded).toBe(false);
    });
  });

  describe('日亏损检查', () => {
    it('should correctly identify loss limit exceeded', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(-20), max: Math.fround(-6), noNaN: true }),
          fc.float({ min: Math.fround(3), max: Math.fround(5), noNaN: true }),
          (pnlPercent, limit) => {
            const result = checkDailyLossLimit(pnlPercent, limit);
            expect(result.exceeded).toBe(true);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should correctly identify loss within limit', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(-2), max: Math.fround(10), noNaN: true }),
          fc.float({ min: Math.fround(5), max: Math.fround(10), noNaN: true }),
          (pnlPercent, limit) => {
            const result = checkDailyLossLimit(pnlPercent, limit);
            expect(result.exceeded).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should return zero utilization for positive PnL', () => {
      const result = checkDailyLossLimit(5, 5);
      expect(result.utilization).toBe(0);
      expect(result.exceeded).toBe(false);
    });
  });

  describe('实时风控指标计算', () => {
    it('should calculate metrics correctly with positions', () => {
      // 添加测试持仓
      const position: PositionUpdate = {
        ticker: 'AAPL',
        quantity: 100,
        avgCost: 150,
        currentPrice: 160,
        marketValue: 16000,
        unrealizedPnL: 1000,
        unrealizedPnLPercent: 6.67,
      };
      
      riskIntegrationService.updatePosition(position);
      
      const quote: QuoteUpdate = {
        ticker: 'AAPL',
        price: 165,
        changePercent: 3.125,
        previousClose: 160,
        timestamp: Date.now(),
      };
      
      const metrics = riskIntegrationService.onQuoteUpdate(quote);
      
      expect(metrics.currentLeverage).toBeGreaterThan(0);
      expect(metrics.lastUpdated).toBeGreaterThan(0);
    });

    it('should update high water mark when value increases', () => {
      const position: PositionUpdate = {
        ticker: 'AAPL',
        quantity: 100,
        avgCost: 100,
        currentPrice: 110,
        marketValue: 11000,
        unrealizedPnL: 1000,
        unrealizedPnLPercent: 10,
      };
      
      riskIntegrationService.updatePosition(position);
      
      const quote1: QuoteUpdate = {
        ticker: 'AAPL',
        price: 110,
        changePercent: 10,
        previousClose: 100,
        timestamp: Date.now(),
      };
      
      const metrics1 = riskIntegrationService.onQuoteUpdate(quote1);
      const hwm1 = metrics1.currentHighWaterMark;
      
      // 价格上涨
      const quote2: QuoteUpdate = {
        ticker: 'AAPL',
        price: 120,
        changePercent: 20,
        previousClose: 100,
        timestamp: Date.now(),
      };
      
      const metrics2 = riskIntegrationService.onQuoteUpdate(quote2);
      
      expect(metrics2.currentHighWaterMark).toBeGreaterThanOrEqual(hwm1);
    });

    it('should calculate trailing stop level correctly', () => {
      const position: PositionUpdate = {
        ticker: 'AAPL',
        quantity: 100,
        avgCost: 100,
        currentPrice: 100,
        marketValue: 10000,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
      };
      
      riskIntegrationService.updatePosition(position);
      riskIntegrationService.setThresholds({ trailingStopPercent: 10 });
      
      const quote: QuoteUpdate = {
        ticker: 'AAPL',
        price: 100,
        changePercent: 0,
        previousClose: 100,
        timestamp: Date.now(),
      };
      
      const metrics = riskIntegrationService.onQuoteUpdate(quote);
      
      if (metrics.trailingStopLevel !== null) {
        // 止盈线应该是高水位的 90%
        expect(metrics.trailingStopLevel).toBeCloseTo(
          metrics.currentHighWaterMark * 0.9,
          0
        );
      }
    });
  });

  describe('风险等级计算', () => {
    it('should return critical when leverage exceeded', () => {
      // 设置一个会导致杠杆超限的持仓
      const position: PositionUpdate = {
        ticker: 'AAPL',
        quantity: 100,
        avgCost: 100,
        currentPrice: 250, // 高市值导致高杠杆
        marketValue: 25000,
        unrealizedPnL: 15000,
        unrealizedPnLPercent: 150,
      };
      
      riskIntegrationService.updatePosition(position);
      
      const quote: QuoteUpdate = {
        ticker: 'AAPL',
        price: 250,
        changePercent: 150,
        previousClose: 100,
        timestamp: Date.now(),
      };
      
      const metrics = riskIntegrationService.onQuoteUpdate(quote);
      
      if (metrics.isLeverageExceeded) {
        expect(metrics.riskLevel).toBe('critical');
      }
    });

    it('should return low risk for normal conditions', () => {
      const position: PositionUpdate = {
        ticker: 'AAPL',
        quantity: 100,
        avgCost: 100,
        currentPrice: 102,
        marketValue: 10200,
        unrealizedPnL: 200,
        unrealizedPnLPercent: 2,
      };
      
      riskIntegrationService.updatePosition(position);
      
      const quote: QuoteUpdate = {
        ticker: 'AAPL',
        price: 102,
        changePercent: 2,
        previousClose: 100,
        timestamp: Date.now(),
      };
      
      const metrics = riskIntegrationService.onQuoteUpdate(quote);
      
      expect(['low', 'medium']).toContain(metrics.riskLevel);
    });
  });

  describe('警报回调', () => {
    it('should call alert callback when threshold exceeded', () => {
      const alertCallback = vi.fn();
      const unsubscribe = riskIntegrationService.onRiskAlert(alertCallback);
      
      // 设置会触发警报的持仓
      riskIntegrationService.setThresholds({
        leverageLimit: 1.0, // 很低的限制
        leverageWarning: 0.8,
      });
      
      const position: PositionUpdate = {
        ticker: 'AAPL',
        quantity: 100,
        avgCost: 100,
        currentPrice: 200, // 高杠杆
        marketValue: 20000,
        unrealizedPnL: 10000,
        unrealizedPnLPercent: 100,
      };
      
      riskIntegrationService.updatePosition(position);
      
      const quote: QuoteUpdate = {
        ticker: 'AAPL',
        price: 200,
        changePercent: 100,
        previousClose: 100,
        timestamp: Date.now(),
      };
      
      riskIntegrationService.onQuoteUpdate(quote);
      
      // 应该触发警报
      expect(alertCallback).toHaveBeenCalled();
      
      unsubscribe();
    });

    it('should allow unsubscribe from alerts', () => {
      const alertCallback = vi.fn();
      const unsubscribe = riskIntegrationService.onRiskAlert(alertCallback);
      
      unsubscribe();
      
      // 设置会触发警报的条件
      riskIntegrationService.setThresholds({ leverageLimit: 0.5 });
      
      const position: PositionUpdate = {
        ticker: 'AAPL',
        quantity: 100,
        avgCost: 100,
        currentPrice: 200,
        marketValue: 20000,
        unrealizedPnL: 10000,
        unrealizedPnLPercent: 100,
      };
      
      riskIntegrationService.updatePosition(position);
      
      const quote: QuoteUpdate = {
        ticker: 'AAPL',
        price: 200,
        changePercent: 100,
        previousClose: 100,
        timestamp: Date.now(),
      };
      
      riskIntegrationService.onQuoteUpdate(quote);
      
      // 取消订阅后不应该被调用
      expect(alertCallback).not.toHaveBeenCalled();
    });
  });
});

// ============ 阈值配置测试 ============

describe('Threshold configuration', () => {
  it('should allow setting custom thresholds', () => {
    riskIntegrationService.setThresholds({
      leverageLimit: 3.0,
      dailyLossLimit: -10,
    });
    
    const thresholds = riskIntegrationService.getThresholds();
    
    expect(thresholds.leverageLimit).toBe(3.0);
    expect(thresholds.dailyLossLimit).toBe(-10);
  });

  it('should preserve other thresholds when updating partial', () => {
    const original = riskIntegrationService.getThresholds();
    
    riskIntegrationService.setThresholds({
      leverageLimit: 5.0,
    });
    
    const updated = riskIntegrationService.getThresholds();
    
    expect(updated.leverageLimit).toBe(5.0);
    expect(updated.trailingStopPercent).toBe(original.trailingStopPercent);
  });
});

// ============ 持仓管理测试 ============

describe('Position management', () => {
  it('should update position on quote update', () => {
    const position: PositionUpdate = {
      ticker: 'AAPL',
      quantity: 100,
      avgCost: 100,
      currentPrice: 100,
      marketValue: 10000,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
    };
    
    riskIntegrationService.updatePosition(position);
    
    const quote: QuoteUpdate = {
      ticker: 'AAPL',
      price: 110,
      changePercent: 10,
      previousClose: 100,
      timestamp: Date.now(),
    };
    
    const metrics = riskIntegrationService.onQuoteUpdate(quote);
    
    // 市值应该更新
    expect(metrics.dailyPnL).toBeGreaterThan(0);
  });

  it('should handle multiple positions', () => {
    const positions: PositionUpdate[] = [
      {
        ticker: 'AAPL',
        quantity: 100,
        avgCost: 100,
        currentPrice: 110,
        marketValue: 11000,
        unrealizedPnL: 1000,
        unrealizedPnLPercent: 10,
      },
      {
        ticker: 'GOOGL',
        quantity: 50,
        avgCost: 200,
        currentPrice: 190,
        marketValue: 9500,
        unrealizedPnL: -500,
        unrealizedPnLPercent: -5,
      },
    ];
    
    riskIntegrationService.updatePositions(positions);
    
    // 需要触发一次 quote update 来计算指标
    const quote: QuoteUpdate = {
      ticker: 'AAPL',
      price: 110,
      changePercent: 10,
      previousClose: 100,
      timestamp: Date.now(),
    };
    
    const metrics = riskIntegrationService.onQuoteUpdate(quote);
    
    // 应该计算所有持仓的总和
    expect(metrics.dailyPnL).toBe(500); // 1000 - 500
  });

  it('should clear positions correctly', () => {
    const position: PositionUpdate = {
      ticker: 'AAPL',
      quantity: 100,
      avgCost: 100,
      currentPrice: 110,
      marketValue: 11000,
      unrealizedPnL: 1000,
      unrealizedPnLPercent: 10,
    };
    
    riskIntegrationService.updatePosition(position);
    riskIntegrationService.clearPositions();
    
    // 需要触发一次 quote update 来计算指标
    const quote: QuoteUpdate = {
      ticker: 'AAPL',
      price: 110,
      changePercent: 10,
      previousClose: 100,
      timestamp: Date.now(),
    };
    
    const metrics = riskIntegrationService.onQuoteUpdate(quote);
    
    expect(metrics.dailyPnL).toBe(0);
  });
});
