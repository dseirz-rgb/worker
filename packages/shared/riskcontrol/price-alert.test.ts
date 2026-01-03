/**
 * 价格警报属性测试
 * 
 * **Feature: riskcontrol-integration**
 * **Property 11: 价格警报去重**
 * **Validates: Requirements 30.1, 30.2, 30.3**
 * 
 * @module @echoai/shared/riskcontrol/price-alert/tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  PriceAlertService,
  DEFAULT_ALERT_CONFIG,
  AlertError,
  type AlertType,
  type PriceData,
  type NotificationChannel,
} from './price-alert';

// ============================================
// 辅助函数
// ============================================

// 生成有效的股票代码
const tickerArb = fc.stringOf(fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'), { minLength: 1, maxLength: 5 });

// 生成警报类型
const alertTypeArb = fc.constantFrom<AlertType>(
  'price_above',
  'price_below',
  'percent_change',
  'volume_spike',
  'rsi_overbought',
  'rsi_oversold'
);

// 生成通知渠道
const channelArb = fc.array(
  fc.constantFrom<NotificationChannel>('email', 'push', 'voice', 'sms'),
  { minLength: 1, maxLength: 4 }
);

// 生成价格阈值（排除 NaN 和 Infinity）
const priceThresholdArb = fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true });

// 生成冷却时间（分钟）
const cooldownArb = fc.integer({ min: 1, max: 60 });

// 生成价格数据
const priceDataArb = (ticker: string) => fc.record({
  ticker: fc.constant(ticker),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(10000) }),
  volume: fc.float({ min: Math.fround(1000), max: Math.fround(10000000) }),
  change24h: fc.float({ min: Math.fround(-0.5), max: Math.fround(0.5) }),
  rsi: fc.float({ min: Math.fround(0), max: Math.fround(100) }),
  timestamp: fc.constant(new Date()),
});

// ============================================
// 属性测试
// ============================================

describe('PriceAlertService Property Tests', () => {
  let service: PriceAlertService;

  beforeEach(() => {
    service = new PriceAlertService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * **Property 11.1: 冷却期内不重复触发**
   * 同一规则在冷却期内不应重复触发警报
   * **Validates: Requirements 30.3**
   */
  it('should not trigger same alert within cooldown period', () => {
    fc.assert(
      fc.property(
        tickerArb,
        priceThresholdArb,
        cooldownArb,
        (ticker, threshold, cooldownMinutes) => {
          service.clearAllRules();
          
          // 添加 price_above 规则
          const rule = service.addRule({
            ticker,
            type: 'price_above',
            threshold,
            enabled: true,
            channels: ['push'],
            cooldownMinutes,
          });

          // 第一次触发（价格高于阈值）
          const priceData: PriceData = {
            ticker,
            price: threshold + 1,
            timestamp: new Date(),
          };

          const firstTriggers = service.checkPriceData(priceData);
          
          // 第一次应该触发
          expect(firstTriggers.length).toBe(1);
          expect(firstTriggers[0].ruleId).toBe(rule.id);

          // 在冷却期内再次检查
          vi.advanceTimersByTime((cooldownMinutes - 1) * 60 * 1000);
          
          const secondTriggers = service.checkPriceData(priceData);
          
          // 冷却期内不应触发
          expect(secondTriggers.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 11.2: 冷却期后可以再次触发**
   * 冷却期结束后，同一规则应该可以再次触发
   * **Validates: Requirements 30.3**
   */
  it('should trigger again after cooldown period expires', () => {
    fc.assert(
      fc.property(
        tickerArb,
        priceThresholdArb,
        cooldownArb,
        (ticker, threshold, cooldownMinutes) => {
          service.clearAllRules();
          
          const rule = service.addRule({
            ticker,
            type: 'price_above',
            threshold,
            enabled: true,
            channels: ['push'],
            cooldownMinutes,
          });

          const priceData: PriceData = {
            ticker,
            price: threshold + 1,
            timestamp: new Date(),
          };

          // 第一次触发
          service.checkPriceData(priceData);

          // 冷却期结束后
          vi.advanceTimersByTime((cooldownMinutes + 1) * 60 * 1000);
          
          const triggers = service.checkPriceData(priceData);
          
          // 应该再次触发
          expect(triggers.length).toBe(1);
          expect(triggers[0].ruleId).toBe(rule.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 11.3: 不同规则独立触发**
   * 不同规则的冷却期应该独立计算
   * **Validates: Requirements 30.3**
   */
  it('should trigger different rules independently', () => {
    fc.assert(
      fc.property(
        tickerArb,
        fc.float({ min: Math.fround(100), max: Math.fround(1000), noNaN: true }), // 使用较大的阈值避免边界问题
        cooldownArb,
        (ticker, threshold, cooldownMinutes) => {
          service.clearAllRules();
          
          // 添加两个不同的规则：一个 price_above，一个 rsi_overbought
          const rule1 = service.addRule({
            ticker,
            type: 'price_above',
            threshold,
            enabled: true,
            channels: ['push'],
            cooldownMinutes,
          });

          const rule2 = service.addRule({
            ticker,
            type: 'rsi_overbought',
            threshold: 70, // RSI > 70 触发
            enabled: true,
            channels: ['email'],
            cooldownMinutes,
          });

          // 触发 rule1（价格高于阈值）
          const priceData1: PriceData = {
            ticker,
            price: threshold + 1,
            rsi: 50, // RSI 正常，不触发 rule2
            timestamp: new Date(),
          };
          const triggers1 = service.checkPriceData(priceData1);
          
          // rule1 应该触发
          expect(triggers1.some(t => t.ruleId === rule1.id)).toBe(true);

          // rule2 应该仍然可以触发（独立的冷却期）
          const priceData2: PriceData = {
            ticker,
            price: threshold - 1, // 价格低于阈值，不触发 rule1
            rsi: 80, // RSI > 70，触发 rule2
            timestamp: new Date(),
          };
          const triggers2 = service.checkPriceData(priceData2);
          
          // rule2 应该触发（因为 RSI > 70）
          const rule2Triggered = triggers2.some(t => t.ruleId === rule2.id);
          expect(rule2Triggered).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 11.4: 禁用规则不触发**
   * 禁用的规则不应该触发警报
   * **Validates: Requirements 30.1**
   */
  it('should not trigger disabled rules', () => {
    fc.assert(
      fc.property(
        tickerArb,
        priceThresholdArb,
        (ticker, threshold) => {
          service.clearAllRules();
          
          const rule = service.addRule({
            ticker,
            type: 'price_above',
            threshold,
            enabled: false, // 禁用
            channels: ['push'],
            cooldownMinutes: 5,
          });

          const priceData: PriceData = {
            ticker,
            price: threshold + 100, // 远超阈值
            timestamp: new Date(),
          };

          const triggers = service.checkPriceData(priceData);
          
          // 不应触发
          expect(triggers.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 11.5: 每个股票的规则数量限制**
   * 每个股票的规则数量不应超过配置的最大值
   * **Validates: Requirements 30.2**
   */
  it('should enforce max alerts per ticker limit', () => {
    fc.assert(
      fc.property(
        tickerArb,
        fc.integer({ min: 1, max: 5 }),
        (ticker, maxAlerts) => {
          const customService = new PriceAlertService({
            ...DEFAULT_ALERT_CONFIG,
            maxAlertsPerTicker: maxAlerts,
          });

          // 添加最大数量的规则
          for (let i = 0; i < maxAlerts; i++) {
            customService.addRule({
              ticker,
              type: 'price_above',
              threshold: 100 + i,
              enabled: true,
              channels: ['push'],
              cooldownMinutes: 5,
            });
          }

          // 尝试添加超出限制的规则
          expect(() => {
            customService.addRule({
              ticker,
              type: 'price_above',
              threshold: 200,
              enabled: true,
              channels: ['push'],
              cooldownMinutes: 5,
            });
          }).toThrow(AlertError);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 11.6: 触发计数正确递增**
   * 每次触发后，规则的触发计数应该正确递增
   * **Validates: Requirements 30.3**
   */
  it('should correctly increment trigger count', () => {
    fc.assert(
      fc.property(
        tickerArb,
        priceThresholdArb,
        fc.integer({ min: 1, max: 5 }),
        (ticker, threshold, triggerTimes) => {
          service.clearAllRules();
          
          const rule = service.addRule({
            ticker,
            type: 'price_above',
            threshold,
            enabled: true,
            channels: ['push'],
            cooldownMinutes: 1, // 1 分钟冷却
          });

          const priceData: PriceData = {
            ticker,
            price: threshold + 1,
            timestamp: new Date(),
          };

          // 多次触发（每次等待冷却期结束）
          for (let i = 0; i < triggerTimes; i++) {
            service.checkPriceData(priceData);
            vi.advanceTimersByTime(2 * 60 * 1000); // 2 分钟
          }

          const updatedRule = service.getRule(rule.id);
          expect(updatedRule?.triggerCount).toBe(triggerTimes);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// 单元测试
// ============================================

describe('PriceAlertService Unit Tests', () => {
  let service: PriceAlertService;

  beforeEach(() => {
    service = new PriceAlertService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rule Management', () => {
    it('should add rule with generated id', () => {
      const rule = service.addRule({
        ticker: 'AAPL',
        type: 'price_above',
        threshold: 150,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      expect(rule.id).toMatch(/^alert_/);
      expect(rule.ticker).toBe('AAPL');
      expect(rule.triggerCount).toBe(0);
      expect(rule.lastTriggeredAt).toBeNull();
    });

    it('should remove rule', () => {
      const rule = service.addRule({
        ticker: 'AAPL',
        type: 'price_above',
        threshold: 150,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      const removed = service.removeRule(rule.id);
      expect(removed).toBe(true);
      expect(service.getRule(rule.id)).toBeUndefined();
    });

    it('should update rule', () => {
      const rule = service.addRule({
        ticker: 'AAPL',
        type: 'price_above',
        threshold: 150,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      const updated = service.updateRule(rule.id, { threshold: 160 });
      expect(updated?.threshold).toBe(160);
      expect(updated?.id).toBe(rule.id); // ID 不变
    });

    it('should get rules by ticker', () => {
      service.addRule({
        ticker: 'AAPL',
        type: 'price_above',
        threshold: 150,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      service.addRule({
        ticker: 'GOOGL',
        type: 'price_above',
        threshold: 100,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      const aaplRules = service.getRulesByTicker('AAPL');
      expect(aaplRules.length).toBe(1);
      expect(aaplRules[0].ticker).toBe('AAPL');
    });
  });

  describe('Alert Types', () => {
    it('should trigger price_above alert', () => {
      service.addRule({
        ticker: 'AAPL',
        type: 'price_above',
        threshold: 150,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      const triggers = service.checkPriceData({
        ticker: 'AAPL',
        price: 151,
        timestamp: new Date(),
      });

      expect(triggers.length).toBe(1);
      expect(triggers[0].type).toBe('price_above');
      expect(triggers[0].message).toContain('突破');
    });

    it('should trigger price_below alert', () => {
      service.addRule({
        ticker: 'AAPL',
        type: 'price_below',
        threshold: 150,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      const triggers = service.checkPriceData({
        ticker: 'AAPL',
        price: 149,
        timestamp: new Date(),
      });

      expect(triggers.length).toBe(1);
      expect(triggers[0].type).toBe('price_below');
      expect(triggers[0].message).toContain('跌破');
    });

    it('should trigger percent_change alert', () => {
      service.addRule({
        ticker: 'AAPL',
        type: 'percent_change',
        threshold: 0.05, // 5%
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      const triggers = service.checkPriceData({
        ticker: 'AAPL',
        price: 150,
        change24h: 0.08, // 8%
        timestamp: new Date(),
      });

      expect(triggers.length).toBe(1);
      expect(triggers[0].type).toBe('percent_change');
    });

    it('should trigger volume_spike alert', () => {
      service.addRule({
        ticker: 'AAPL',
        type: 'volume_spike',
        threshold: 1000000,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      const triggers = service.checkPriceData({
        ticker: 'AAPL',
        price: 150,
        volume: 2000000,
        timestamp: new Date(),
      });

      expect(triggers.length).toBe(1);
      expect(triggers[0].type).toBe('volume_spike');
    });

    it('should trigger rsi_overbought alert', () => {
      service.addRule({
        ticker: 'AAPL',
        type: 'rsi_overbought',
        threshold: 70,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      const triggers = service.checkPriceData({
        ticker: 'AAPL',
        price: 150,
        rsi: 75,
        timestamp: new Date(),
      });

      expect(triggers.length).toBe(1);
      expect(triggers[0].type).toBe('rsi_overbought');
      expect(triggers[0].message).toContain('超买');
    });

    it('should trigger rsi_oversold alert', () => {
      service.addRule({
        ticker: 'AAPL',
        type: 'rsi_oversold',
        threshold: 30,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      const triggers = service.checkPriceData({
        ticker: 'AAPL',
        price: 150,
        rsi: 25,
        timestamp: new Date(),
      });

      expect(triggers.length).toBe(1);
      expect(triggers[0].type).toBe('rsi_oversold');
      expect(triggers[0].message).toContain('超卖');
    });
  });

  describe('Service Control', () => {
    it('should not trigger when service is disabled', () => {
      const disabledService = new PriceAlertService({
        ...DEFAULT_ALERT_CONFIG,
        enabled: false,
      });

      disabledService.addRule({
        ticker: 'AAPL',
        type: 'price_above',
        threshold: 150,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      const triggers = disabledService.checkPriceData({
        ticker: 'AAPL',
        price: 200,
        timestamp: new Date(),
      });

      expect(triggers.length).toBe(0);
    });

    it('should enable/disable individual rules', () => {
      const rule = service.addRule({
        ticker: 'AAPL',
        type: 'price_above',
        threshold: 150,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      // 禁用规则
      service.setRuleEnabled(rule.id, false);
      
      let triggers = service.checkPriceData({
        ticker: 'AAPL',
        price: 200,
        timestamp: new Date(),
      });
      expect(triggers.length).toBe(0);

      // 重新启用
      service.setRuleEnabled(rule.id, true);
      
      triggers = service.checkPriceData({
        ticker: 'AAPL',
        price: 200,
        timestamp: new Date(),
      });
      expect(triggers.length).toBe(1);
    });

    it('should reset trigger state', () => {
      const rule = service.addRule({
        ticker: 'AAPL',
        type: 'price_above',
        threshold: 150,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      // 触发一次
      service.checkPriceData({
        ticker: 'AAPL',
        price: 200,
        timestamp: new Date(),
      });

      // 重置状态
      service.resetTriggerState(rule.id);

      // 应该可以立即再次触发
      const triggers = service.checkPriceData({
        ticker: 'AAPL',
        price: 200,
        timestamp: new Date(),
      });
      expect(triggers.length).toBe(1);
    });

    it('should clear all rules', () => {
      service.addRule({
        ticker: 'AAPL',
        type: 'price_above',
        threshold: 150,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      service.addRule({
        ticker: 'GOOGL',
        type: 'price_below',
        threshold: 100,
        enabled: true,
        channels: ['email'],
        cooldownMinutes: 5,
      });

      service.clearAllRules();
      
      expect(service.getAllRules().length).toBe(0);
    });
  });

  describe('Cooldown Mechanism', () => {
    it('should respect cooldown period', () => {
      service.addRule({
        ticker: 'AAPL',
        type: 'price_above',
        threshold: 150,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 5,
      });

      const priceData: PriceData = {
        ticker: 'AAPL',
        price: 200,
        timestamp: new Date(),
      };

      // 第一次触发
      let triggers = service.checkPriceData(priceData);
      expect(triggers.length).toBe(1);

      // 3 分钟后（仍在冷却期内）
      vi.advanceTimersByTime(3 * 60 * 1000);
      triggers = service.checkPriceData(priceData);
      expect(triggers.length).toBe(0);

      // 再过 3 分钟（冷却期结束）
      vi.advanceTimersByTime(3 * 60 * 1000);
      triggers = service.checkPriceData(priceData);
      expect(triggers.length).toBe(1);
    });

    it('should use default cooldown when not specified', () => {
      const rule = service.addRule({
        ticker: 'AAPL',
        type: 'price_above',
        threshold: 150,
        enabled: true,
        channels: ['push'],
        cooldownMinutes: 0, // 使用默认值
      });

      expect(rule.cooldownMinutes).toBe(DEFAULT_ALERT_CONFIG.defaultCooldownMinutes);
    });
  });
});

// ============================================
// 配置验证测试
// ============================================

describe('Default Configuration Validation', () => {
  it('should have correct default cooldown', () => {
    expect(DEFAULT_ALERT_CONFIG.defaultCooldownMinutes).toBe(5);
  });

  it('should have correct max alerts per ticker', () => {
    expect(DEFAULT_ALERT_CONFIG.maxAlertsPerTicker).toBe(10);
  });

  it('should be enabled by default', () => {
    expect(DEFAULT_ALERT_CONFIG.enabled).toBe(true);
  });
});
