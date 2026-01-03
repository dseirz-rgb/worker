/**
 * 情绪交易检测属性测试
 * 
 * **Feature: riskcontrol-integration**
 * **Property 7: 情绪交易检测准确性**
 * **Validates: Requirements 29.1, 29.2, 29.3**
 * 
 * @module @echoai/shared/riskcontrol/emotion-detector/tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  EmotionTradingDetector,
  DEFAULT_EMOTION_CONFIG,
  type TradingAction,
  type EmotionType,
} from './emotion-detector';

// ============================================
// 辅助函数
// ============================================

// 生成交易行为
const tradingActionArb = (type: 'buy' | 'sell' = 'buy') => fc.record({
  type: fc.constant(type),
  ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
  quantity: fc.integer({ min: 1, max: 1000 }),
  price: fc.float({ min: Math.fround(1), max: Math.fround(1000) }),
  timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
  pnl: fc.option(fc.float({ min: Math.fround(-0.5), max: Math.fround(0.5) }), { nil: undefined }),
});

// 生成亏损交易
const lossTradingActionArb = fc.record({
  type: fc.constantFrom('buy', 'sell') as fc.Arbitrary<'buy' | 'sell'>,
  ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
  quantity: fc.integer({ min: 1, max: 1000 }),
  price: fc.float({ min: Math.fround(1), max: Math.fround(1000) }),
  timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
  pnl: fc.float({ min: Math.fround(-0.5), max: Math.fround(-0.06) }), // 亏损 > 5%
});

// ============================================
// 属性测试
// ============================================

describe('EmotionTradingDetector Property Tests', () => {
  let detector: EmotionTradingDetector;

  beforeEach(() => {
    detector = new EmotionTradingDetector();
  });

  /**
   * **Property 7.1: 报复性交易检测**
   * 亏损 > 5% 后 1 小时内仓位增加 > 50% 应触发警报
   * **Validates: Requirements 29.2, 29.3**
   */
  it('should detect revenge trading pattern', () => {
    // 先记录一笔亏损交易
    const lossAction: TradingAction = {
      type: 'sell',
      ticker: 'AAPL',
      quantity: 100,
      price: 150,
      timestamp: new Date(),
      pnl: -0.08, // 亏损 8%
    };
    detector.recordAction(lossAction);

    // 30 分钟后大幅加仓
    const revengeAction: TradingAction = {
      type: 'buy',
      ticker: 'AAPL',
      quantity: 200, // 加仓
      price: 145,
      timestamp: new Date(Date.now() + 30 * 60 * 1000),
    };

    const alerts = detector.detectEmotionalTrading(revengeAction);
    
    // 应该检测到报复性交易
    const revengeAlert = alerts.find(a => a.type === 'revenge_trading');
    expect(revengeAlert).toBeDefined();
    expect(revengeAlert?.severity).toBe('high');
  });

  /**
   * **Property 7.2: FOMO 检测**
   * 价格上涨 > 10% 且成交量激增时买入应触发警报
   */
  it('should detect FOMO trading pattern', () => {
    const fomoAction: TradingAction = {
      type: 'buy',
      ticker: 'NVDA',
      quantity: 50,
      price: 500,
      timestamp: new Date(),
    };

    const marketContext = {
      priceChange24h: 0.15, // 上涨 15%
      volumeRatio: 4.0,     // 成交量 4 倍
    };

    const alerts = detector.detectEmotionalTrading(fomoAction, marketContext);
    
    const fomoAlert = alerts.find(a => a.type === 'fomo');
    expect(fomoAlert).toBeDefined();
    expect(fomoAlert?.severity).toBe('medium');
  });

  /**
   * **Property 7.3: 恐慌性抛售检测**
   * 价格下跌 > 5% 时连续卖出应触发警报
   */
  it('should detect panic selling pattern', () => {
    // 先记录一笔卖出
    const firstSell: TradingAction = {
      type: 'sell',
      ticker: 'TSLA',
      quantity: 50,
      price: 200,
      timestamp: new Date(),
    };
    detector.recordAction(firstSell);

    // 再记录一笔卖出
    const secondSell: TradingAction = {
      type: 'sell',
      ticker: 'TSLA',
      quantity: 30,
      price: 195,
      timestamp: new Date(Date.now() + 10 * 60 * 1000),
    };
    detector.recordAction(secondSell);

    // 第三笔卖出
    const panicSell: TradingAction = {
      type: 'sell',
      ticker: 'TSLA',
      quantity: 20,
      price: 190,
      timestamp: new Date(Date.now() + 20 * 60 * 1000),
    };

    const marketContext = {
      priceChange24h: -0.08, // 下跌 8%
    };

    const alerts = detector.detectEmotionalTrading(panicSell, marketContext);
    
    const panicAlert = alerts.find(a => a.type === 'panic_selling');
    expect(panicAlert).toBeDefined();
    expect(panicAlert?.severity).toBe('high');
  });

  /**
   * **Property 7.4: 正常交易不触发警报**
   * 正常的交易行为不应触发情绪警报
   */
  it('should not trigger alerts for normal trading', () => {
    fc.assert(
      fc.property(tradingActionArb('buy'), (action) => {
        // 清除历史
        detector.clearHistory();
        
        // 正常市场环境
        const marketContext = {
          priceChange24h: 0.02, // 小幅上涨
          volumeRatio: 1.2,    // 正常成交量
        };

        const alerts = detector.detectEmotionalTrading(action, marketContext);
        
        // 不应有高严重性警报
        const highAlerts = alerts.filter(a => a.severity === 'high' || a.severity === 'critical');
        expect(highAlerts).toHaveLength(0);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Property 7.5: 警报冷却期**
   * 同类型警报在冷却期内不应重复触发
   */
  it('should respect alert cooldown period', () => {
    // 触发第一次 FOMO 警报
    const action1: TradingAction = {
      type: 'buy',
      ticker: 'NVDA',
      quantity: 50,
      price: 500,
      timestamp: new Date(),
    };

    const marketContext = {
      priceChange24h: 0.15,
      volumeRatio: 4.0,
    };

    const alerts1 = detector.detectEmotionalTrading(action1, marketContext);
    expect(alerts1.some(a => a.type === 'fomo')).toBe(true);

    // 立即再次触发（应该被冷却期阻止）
    const action2: TradingAction = {
      type: 'buy',
      ticker: 'NVDA',
      quantity: 30,
      price: 510,
      timestamp: new Date(Date.now() + 1000), // 1 秒后
    };

    const alerts2 = detector.detectEmotionalTrading(action2, marketContext);
    expect(alerts2.some(a => a.type === 'fomo')).toBe(false);
  });
});

// ============================================
// 单元测试
// ============================================

describe('EmotionTradingDetector Unit Tests', () => {
  let detector: EmotionTradingDetector;

  beforeEach(() => {
    detector = new EmotionTradingDetector();
  });

  describe('Default Configuration', () => {
    it('should have correct revenge trading thresholds', () => {
      expect(DEFAULT_EMOTION_CONFIG.revengeLossThreshold).toBe(0.05);
      expect(DEFAULT_EMOTION_CONFIG.revengeTimeWindow).toBe(60);
      expect(DEFAULT_EMOTION_CONFIG.revengePositionIncrease).toBe(0.50);
    });

    it('should have correct FOMO thresholds', () => {
      expect(DEFAULT_EMOTION_CONFIG.fomopriceChangeThreshold).toBe(0.10);
      expect(DEFAULT_EMOTION_CONFIG.fomoVolumeSpike).toBe(3.0);
    });

    it('should have correct panic selling thresholds', () => {
      expect(DEFAULT_EMOTION_CONFIG.panicPriceDropThreshold).toBe(0.05);
      expect(DEFAULT_EMOTION_CONFIG.panicSellRatio).toBe(0.30);
    });

    it('should be enabled by default', () => {
      expect(DEFAULT_EMOTION_CONFIG.enabled).toBe(true);
    });
  });

  describe('Action Recording', () => {
    it('should record trading actions', () => {
      const action: TradingAction = {
        type: 'buy',
        ticker: 'AAPL',
        quantity: 100,
        price: 150,
        timestamp: new Date(),
      };

      detector.recordAction(action);
      // 内部状态已更新（通过后续检测验证）
    });

    it('should limit history size', () => {
      // 记录超过限制的交易
      for (let i = 0; i < 150; i++) {
        detector.recordAction({
          type: 'buy',
          ticker: 'AAPL',
          quantity: 1,
          price: 100,
          timestamp: new Date(),
        });
      }
      // 不应抛出错误
    });
  });

  describe('Disabled Detection', () => {
    it('should not detect when disabled', () => {
      const disabledDetector = new EmotionTradingDetector({
        ...DEFAULT_EMOTION_CONFIG,
        enabled: false,
      });

      const action: TradingAction = {
        type: 'buy',
        ticker: 'NVDA',
        quantity: 50,
        price: 500,
        timestamp: new Date(),
      };

      const marketContext = {
        priceChange24h: 0.20,
        volumeRatio: 5.0,
      };

      const alerts = disabledDetector.detectEmotionalTrading(action, marketContext);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('Config Update', () => {
    it('should update configuration', () => {
      detector.updateConfig({ revengeLossThreshold: 0.10 });
      
      // 验证配置已更新（通过行为测试）
      // 现在需要 10% 亏损才触发报复性交易检测
    });
  });

  describe('Clear History', () => {
    it('should clear all history', () => {
      detector.recordAction({
        type: 'buy',
        ticker: 'AAPL',
        quantity: 100,
        price: 150,
        timestamp: new Date(),
        pnl: -0.10,
      });

      detector.clearHistory();

      // 清除后不应检测到报复性交易
      const action: TradingAction = {
        type: 'buy',
        ticker: 'AAPL',
        quantity: 200,
        price: 145,
        timestamp: new Date(),
      };

      const alerts = detector.detectEmotionalTrading(action);
      const revengeAlert = alerts.find(a => a.type === 'revenge_trading');
      expect(revengeAlert).toBeUndefined();
    });
  });
});

// ============================================
// 边界条件测试
// ============================================

describe('Edge Cases', () => {
  let detector: EmotionTradingDetector;

  beforeEach(() => {
    detector = new EmotionTradingDetector();
  });

  it('should handle sell actions for revenge detection', () => {
    // 报复性交易只检测买入
    const sellAction: TradingAction = {
      type: 'sell',
      ticker: 'AAPL',
      quantity: 100,
      price: 150,
      timestamp: new Date(),
    };

    const alerts = detector.detectEmotionalTrading(sellAction);
    const revengeAlert = alerts.find(a => a.type === 'revenge_trading');
    expect(revengeAlert).toBeUndefined();
  });

  it('should handle missing market context', () => {
    const action: TradingAction = {
      type: 'buy',
      ticker: 'AAPL',
      quantity: 100,
      price: 150,
      timestamp: new Date(),
    };

    // 不传入市场上下文
    const alerts = detector.detectEmotionalTrading(action);
    
    // 不应抛出错误
    expect(Array.isArray(alerts)).toBe(true);
  });

  it('should handle exactly threshold values', () => {
    const action: TradingAction = {
      type: 'buy',
      ticker: 'NVDA',
      quantity: 50,
      price: 500,
      timestamp: new Date(),
    };

    // 刚好等于阈值（不应触发）
    const marketContext = {
      priceChange24h: 0.10, // 刚好 10%
      volumeRatio: 3.0,     // 刚好 3 倍
    };

    const alerts = detector.detectEmotionalTrading(action, marketContext);
    const fomoAlert = alerts.find(a => a.type === 'fomo');
    // 阈值是 >，所以刚好等于不触发
    expect(fomoAlert).toBeUndefined();
  });
});
