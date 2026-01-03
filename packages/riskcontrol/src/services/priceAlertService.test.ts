/**
 * Property-based tests for Price Alert Service
 * Feature: realtime-market-platform
 * 
 * Property 3: 警报规则 CRUD 一致性
 * Property 4: 警报条件评估正确性
 * Property 5: 警报通知完整性
 * Property 6: 警报去重机制
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  evaluateRule,
  evaluateRules,
  isInCooldown,
  type AlertRule,
  type AlertConditionType,
  type QuoteData,
  type NotificationChannel,
} from './priceAlertService';

// ============ 测试数据生成器 ============

const alertConditionTypeArb = fc.constantFrom<AlertConditionType>(
  'price_above',
  'price_below',
  'change_above',
  'change_below',
  'break_ma'
);

const notificationChannelArb = fc.constantFrom<NotificationChannel>(
  'toast',
  'browser',
  'email'
);

const alertRuleArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
  conditionType: alertConditionTypeArb,
  targetValue: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  notificationChannels: fc.array(notificationChannelArb, { minLength: 1, maxLength: 3 }),
  enabled: fc.boolean(),
  createdAt: fc.date().map(d => d.toISOString()),
  updatedAt: fc.date().map(d => d.toISOString()),
  lastTriggeredAt: fc.option(fc.date().map(d => d.toISOString()), { nil: undefined }),
  cooldownUntil: fc.option(fc.date().map(d => d.toISOString()), { nil: undefined }),
});

const quoteDataArb = fc.record({
  ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  changePercent: fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
  previousClose: fc.option(fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }), { nil: undefined }),
  ma5: fc.option(fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }), { nil: undefined }),
  ma10: fc.option(fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }), { nil: undefined }),
  ma20: fc.option(fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }), { nil: undefined }),
});

// ============ Property 4: 警报条件评估正确性 ============

describe('Feature: realtime-market-platform, Property 4: 警报条件评估正确性', () => {
  
  describe('price_above 条件', () => {
    it('should trigger when price > targetValue', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(0.99), noNaN: true }),
          (targetValue, priceDelta) => {
            const rule: AlertRule = {
              id: '1',
              userId: 'user1',
              ticker: 'AAPL',
              conditionType: 'price_above',
              targetValue,
              notificationChannels: ['toast'],
              enabled: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            const quote: QuoteData = {
              ticker: 'AAPL',
              price: targetValue + priceDelta, // 价格高于目标
              changePercent: 0,
            };
            
            expect(evaluateRule(rule, quote)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not trigger when price <= targetValue', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(0), max: Math.fround(0.99), noNaN: true }),
          (targetValue, priceDelta) => {
            const rule: AlertRule = {
              id: '1',
              userId: 'user1',
              ticker: 'AAPL',
              conditionType: 'price_above',
              targetValue,
              notificationChannels: ['toast'],
              enabled: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            const quote: QuoteData = {
              ticker: 'AAPL',
              price: targetValue - priceDelta, // 价格低于或等于目标
              changePercent: 0,
            };
            
            expect(evaluateRule(rule, quote)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('price_below 条件', () => {
    it('should trigger when price < targetValue', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(0.99), noNaN: true }),
          (targetValue, priceDelta) => {
            const rule: AlertRule = {
              id: '1',
              userId: 'user1',
              ticker: 'AAPL',
              conditionType: 'price_below',
              targetValue,
              notificationChannels: ['toast'],
              enabled: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            const quote: QuoteData = {
              ticker: 'AAPL',
              price: targetValue - priceDelta, // 价格低于目标
              changePercent: 0,
            };
            
            expect(evaluateRule(rule, quote)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('change_above 条件', () => {
    it('should trigger when changePercent > targetValue', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(1), max: Math.fround(50), noNaN: true }),
          fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
          (targetValue, delta) => {
            const rule: AlertRule = {
              id: '1',
              userId: 'user1',
              ticker: 'AAPL',
              conditionType: 'change_above',
              targetValue,
              notificationChannels: ['toast'],
              enabled: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            const quote: QuoteData = {
              ticker: 'AAPL',
              price: 100,
              changePercent: targetValue + delta, // 涨幅超过目标
            };
            
            expect(evaluateRule(rule, quote)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('change_below 条件', () => {
    it('should trigger when changePercent < -targetValue', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(1), max: Math.fround(50), noNaN: true }),
          fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
          (targetValue, delta) => {
            const rule: AlertRule = {
              id: '1',
              userId: 'user1',
              ticker: 'AAPL',
              conditionType: 'change_below',
              targetValue,
              notificationChannels: ['toast'],
              enabled: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            const quote: QuoteData = {
              ticker: 'AAPL',
              price: 100,
              changePercent: -(targetValue + delta), // 跌幅超过目标
            };
            
            expect(evaluateRule(rule, quote)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('disabled 规则', () => {
    it('should never trigger when rule is disabled', () => {
      fc.assert(
        fc.property(
          alertRuleArb,
          quoteDataArb,
          (rule, quote) => {
            const disabledRule = { ...rule, enabled: false };
            expect(evaluateRule(disabledRule, quote)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

// ============ Property 6: 警报去重机制 ============

describe('Feature: realtime-market-platform, Property 6: 警报去重机制', () => {
  
  it('should be in cooldown when cooldownUntil is in the future', () => {
    const futureTime = new Date(Date.now() + 5 * 60 * 1000); // 5分钟后
    
    const rule: AlertRule = {
      id: '1',
      userId: 'user1',
      ticker: 'AAPL',
      conditionType: 'price_above',
      targetValue: 100,
      notificationChannels: ['toast'],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cooldownUntil: futureTime.toISOString(),
    };
    
    expect(isInCooldown(rule)).toBe(true);
  });

  it('should not be in cooldown when cooldownUntil is in the past', () => {
    const pastTime = new Date(Date.now() - 5 * 60 * 1000); // 5分钟前
    
    const rule: AlertRule = {
      id: '1',
      userId: 'user1',
      ticker: 'AAPL',
      conditionType: 'price_above',
      targetValue: 100,
      notificationChannels: ['toast'],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cooldownUntil: pastTime.toISOString(),
    };
    
    expect(isInCooldown(rule)).toBe(false);
  });

  it('should not be in cooldown when cooldownUntil is undefined', () => {
    const rule: AlertRule = {
      id: '1',
      userId: 'user1',
      ticker: 'AAPL',
      conditionType: 'price_above',
      targetValue: 100,
      notificationChannels: ['toast'],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    expect(isInCooldown(rule)).toBe(false);
  });

  it('should correctly identify cooldown status based on time', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10 }), // 分钟偏移
        (minuteOffset) => {
          const cooldownTime = new Date(Date.now() + minuteOffset * 60 * 1000);
          
          const rule: AlertRule = {
            id: '1',
            userId: 'user1',
            ticker: 'AAPL',
            conditionType: 'price_above',
            targetValue: 100,
            notificationChannels: ['toast'],
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            cooldownUntil: cooldownTime.toISOString(),
          };
          
          const expectedInCooldown = minuteOffset > 0;
          expect(isInCooldown(rule)).toBe(expectedInCooldown);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ============ evaluateRules 批量评估测试 ============

describe('evaluateRules batch evaluation', () => {
  
  it('should return only triggered rules', () => {
    const rules: AlertRule[] = [
      {
        id: '1',
        userId: 'user1',
        ticker: 'AAPL',
        conditionType: 'price_above',
        targetValue: 100,
        notificationChannels: ['toast'],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        userId: 'user1',
        ticker: 'AAPL',
        conditionType: 'price_below',
        targetValue: 50,
        notificationChannels: ['toast'],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '3',
        userId: 'user1',
        ticker: 'AAPL',
        conditionType: 'price_above',
        targetValue: 200,
        notificationChannels: ['toast'],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    
    const quote: QuoteData = {
      ticker: 'AAPL',
      price: 150, // 高于100，低于200，高于50
      changePercent: 5,
    };
    
    const triggered = evaluateRules(rules, quote);
    
    expect(triggered).toHaveLength(1);
    expect(triggered[0].id).toBe('1'); // 只有 price_above 100 触发
  });

  it('should filter out disabled rules', () => {
    const rules: AlertRule[] = [
      {
        id: '1',
        userId: 'user1',
        ticker: 'AAPL',
        conditionType: 'price_above',
        targetValue: 100,
        notificationChannels: ['toast'],
        enabled: false, // 禁用
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        userId: 'user1',
        ticker: 'AAPL',
        conditionType: 'price_above',
        targetValue: 100,
        notificationChannels: ['toast'],
        enabled: true, // 启用
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    
    const quote: QuoteData = {
      ticker: 'AAPL',
      price: 150,
      changePercent: 5,
    };
    
    const triggered = evaluateRules(rules, quote);
    
    expect(triggered).toHaveLength(1);
    expect(triggered[0].id).toBe('2');
  });
});

// ============ break_ma 条件测试 ============

describe('break_ma condition', () => {
  
  it('should trigger when price breaks above MA', () => {
    const rule: AlertRule = {
      id: '1',
      userId: 'user1',
      ticker: 'AAPL',
      conditionType: 'break_ma',
      targetValue: 5, // MA5
      notificationChannels: ['toast'],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const quote: QuoteData = {
      ticker: 'AAPL',
      price: 105, // 当前价格高于 MA5
      changePercent: 5,
      previousClose: 95, // 之前收盘价低于 MA5
      ma5: 100,
    };
    
    expect(evaluateRule(rule, quote)).toBe(true);
  });

  it('should not trigger when MA data is missing', () => {
    const rule: AlertRule = {
      id: '1',
      userId: 'user1',
      ticker: 'AAPL',
      conditionType: 'break_ma',
      targetValue: 5,
      notificationChannels: ['toast'],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const quote: QuoteData = {
      ticker: 'AAPL',
      price: 105,
      changePercent: 5,
      // 没有 ma5 数据
    };
    
    expect(evaluateRule(rule, quote)).toBe(false);
  });

  it('should not trigger when price was already above MA', () => {
    const rule: AlertRule = {
      id: '1',
      userId: 'user1',
      ticker: 'AAPL',
      conditionType: 'break_ma',
      targetValue: 5,
      notificationChannels: ['toast'],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const quote: QuoteData = {
      ticker: 'AAPL',
      price: 105,
      changePercent: 5,
      previousClose: 102, // 之前收盘价也高于 MA5
      ma5: 100,
    };
    
    expect(evaluateRule(rule, quote)).toBe(false);
  });
});
