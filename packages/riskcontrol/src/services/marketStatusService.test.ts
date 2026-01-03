/**
 * Property-based tests for Market Status Service
 * Feature: realtime-market-platform
 * 
 * Property 8: 市场状态计算正确性
 * Validates: Requirements 8.1, 8.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getMarketStatus,
  getNextTradingSession,
  getAllMarketStatus,
  isMarketTrading,
  formatCountdown,
  getMarketName,
  type MarketType,
  type MarketStatus,
} from './marketStatusService';

// ============ Property 8: 市场状态计算正确性 ============

describe('Feature: realtime-market-platform, Property 8: 市场状态计算正确性', () => {
  
  describe('美股市场状态', () => {
    it('should return open during US trading hours (9:30-16:00 ET)', () => {
      // 美东时间 10:00 (交易时间)
      // 创建一个周一的日期
      const monday = new Date('2024-01-08T15:00:00Z'); // UTC 15:00 = ET 10:00
      
      const status = getMarketStatus('US', monday);
      
      expect(status.status).toBe('open');
      expect(status.isTrading).toBe(true);
      expect(status.statusText).toBe('交易中');
    });

    it('should return pre_market before US open (4:00-9:30 ET)', () => {
      // 美东时间 8:00 (盘前)
      const monday = new Date('2024-01-08T13:00:00Z'); // UTC 13:00 = ET 8:00
      
      const status = getMarketStatus('US', monday);
      
      expect(status.status).toBe('pre_market');
      expect(status.isTrading).toBe(false);
    });

    it('should return post_market after US close (16:00-20:00 ET)', () => {
      // 美东时间 17:00 (盘后)
      const monday = new Date('2024-01-08T22:00:00Z'); // UTC 22:00 = ET 17:00
      
      const status = getMarketStatus('US', monday);
      
      expect(status.status).toBe('post_market');
      expect(status.isTrading).toBe(false);
    });

    it('should return closed on weekends', () => {
      // 周六
      const saturday = new Date('2024-01-06T15:00:00Z');
      
      const status = getMarketStatus('US', saturday);
      
      expect(status.status).toBe('closed');
      expect(status.isTrading).toBe(false);
    });
  });

  describe('港股市场状态', () => {
    it('should return open during HK morning session (9:30-12:00)', () => {
      // 香港时间 10:30 (上午交易)
      const monday = new Date('2024-01-08T02:30:00Z'); // UTC 02:30 = HKT 10:30
      
      const status = getMarketStatus('HK', monday);
      
      expect(status.status).toBe('open');
      expect(status.isTrading).toBe(true);
    });

    it('should return lunch_break during HK lunch (12:00-13:00)', () => {
      // 香港时间 12:30 (午休)
      const monday = new Date('2024-01-08T04:30:00Z'); // UTC 04:30 = HKT 12:30
      
      const status = getMarketStatus('HK', monday);
      
      expect(status.status).toBe('lunch_break');
      expect(status.isTrading).toBe(false);
    });

    it('should return open during HK afternoon session (13:00-16:00)', () => {
      // 香港时间 14:00 (下午交易)
      const monday = new Date('2024-01-08T06:00:00Z'); // UTC 06:00 = HKT 14:00
      
      const status = getMarketStatus('HK', monday);
      
      expect(status.status).toBe('open');
      expect(status.isTrading).toBe(true);
    });
  });

  describe('A股市场状态', () => {
    it('should return open during CN morning session (9:30-11:30)', () => {
      // 北京时间 10:30 (上午交易)
      const monday = new Date('2024-01-08T02:30:00Z'); // UTC 02:30 = CST 10:30
      
      const status = getMarketStatus('CN', monday);
      
      expect(status.status).toBe('open');
      expect(status.isTrading).toBe(true);
    });

    it('should return lunch_break during CN lunch (11:30-13:00)', () => {
      // 北京时间 12:00 (午休)
      const monday = new Date('2024-01-08T04:00:00Z'); // UTC 04:00 = CST 12:00
      
      const status = getMarketStatus('CN', monday);
      
      expect(status.status).toBe('lunch_break');
      expect(status.isTrading).toBe(false);
    });

    it('should return open during CN afternoon session (13:00-15:00)', () => {
      // 北京时间 14:00 (下午交易)
      const monday = new Date('2024-01-08T06:00:00Z'); // UTC 06:00 = CST 14:00
      
      const status = getMarketStatus('CN', monday);
      
      expect(status.status).toBe('open');
      expect(status.isTrading).toBe(true);
    });

    it('should return closed after CN market close (15:00)', () => {
      // 北京时间 16:00 (收盘后)
      const monday = new Date('2024-01-08T08:00:00Z'); // UTC 08:00 = CST 16:00
      
      const status = getMarketStatus('CN', monday);
      
      expect(status.status).toBe('closed');
      expect(status.isTrading).toBe(false);
    });
  });

  describe('下一交易时段', () => {
    it('should return next session info', () => {
      const markets: MarketType[] = ['US', 'HK', 'CN'];
      
      markets.forEach(market => {
        const status = getMarketStatus(market);
        
        // 应该总是有下一个时段信息
        expect(status.nextSession).not.toBeNull();
        if (status.nextSession) {
          expect(status.nextSession.time).toBeInstanceOf(Date);
          expect(status.nextSession.description).toBeTruthy();
        }
      });
    });

    it('should have positive countdown', () => {
      const markets: MarketType[] = ['US', 'HK', 'CN'];
      
      markets.forEach(market => {
        const status = getMarketStatus(market);
        
        // 倒计时应该是非负数
        expect(status.countdown).toBeGreaterThanOrEqual(0);
      });
    });
  });
});

// ============ 辅助函数测试 ============

describe('Helper functions', () => {
  
  describe('formatCountdown', () => {
    it('should format seconds correctly', () => {
      expect(formatCountdown(0)).toBe('00:00:00');
      expect(formatCountdown(59)).toBe('00:00:59');
      expect(formatCountdown(60)).toBe('00:01:00');
      expect(formatCountdown(3600)).toBe('01:00:00');
      expect(formatCountdown(3661)).toBe('01:01:01');
    });

    it('should handle days for large values', () => {
      const oneDayInSeconds = 24 * 60 * 60;
      const result = formatCountdown(oneDayInSeconds + 3600);
      
      expect(result).toContain('天');
    });

    it('should handle negative values', () => {
      expect(formatCountdown(-100)).toBe('00:00:00');
    });
  });

  describe('getMarketName', () => {
    it('should return correct market names', () => {
      expect(getMarketName('US')).toBe('美股');
      expect(getMarketName('HK')).toBe('港股');
      expect(getMarketName('CN')).toBe('A股');
    });
  });

  describe('getAllMarketStatus', () => {
    it('should return status for all markets', () => {
      const statuses = getAllMarketStatus();
      
      expect(statuses).toHaveLength(3);
      expect(statuses.map(s => s.market)).toEqual(['US', 'HK', 'CN']);
    });
  });

  describe('isMarketTrading', () => {
    it('should return boolean', () => {
      const markets: MarketType[] = ['US', 'HK', 'CN'];
      
      markets.forEach(market => {
        const result = isMarketTrading(market);
        expect(typeof result).toBe('boolean');
      });
    });
  });
});

// ============ 属性测试 ============

describe('Property-based tests', () => {
  
  // 生成有效日期的 arbitrary
  const validDateArb = fc.integer({ min: 1704067200000, max: 1735689600000 }) // 2024-01-01 to 2024-12-31
    .map(ts => new Date(ts));
  
  it('should always return valid status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<MarketType>('US', 'HK', 'CN'),
        validDateArb,
        (market, date) => {
          const status = getMarketStatus(market, date);
          
          // 状态应该是有效的
          const validStatuses: MarketStatus[] = ['pre_market', 'open', 'lunch_break', 'post_market', 'closed'];
          expect(validStatuses).toContain(status.status);
          
          // 市场类型应该匹配
          expect(status.market).toBe(market);
          
          // isTrading 应该与 status 一致
          if (status.status === 'open') {
            expect(status.isTrading).toBe(true);
          } else {
            expect(status.isTrading).toBe(false);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should have consistent countdown and nextSession', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<MarketType>('US', 'HK', 'CN'),
        validDateArb,
        (market, date) => {
          const status = getMarketStatus(market, date);
          
          // 如果有下一个时段，倒计时应该是正数
          if (status.nextSession) {
            expect(status.countdown).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============ 边界情况测试 ============

describe('Edge cases', () => {
  
  it('should handle market open boundary', () => {
    // 美股开盘时间边界 9:30 ET
    const openTime = new Date('2024-01-08T14:30:00Z'); // UTC 14:30 = ET 9:30
    
    const status = getMarketStatus('US', openTime);
    
    expect(status.status).toBe('open');
  });

  it('should handle market close boundary', () => {
    // 美股收盘时间边界 16:00 ET
    const closeTime = new Date('2024-01-08T21:00:00Z'); // UTC 21:00 = ET 16:00
    
    const status = getMarketStatus('US', closeTime);
    
    // 16:00 应该是盘后
    expect(status.status).toBe('post_market');
  });

  it('should handle lunch break boundaries for HK', () => {
    // 港股午休开始 12:00 HKT
    const lunchStart = new Date('2024-01-08T04:00:00Z'); // UTC 04:00 = HKT 12:00
    
    const status = getMarketStatus('HK', lunchStart);
    
    expect(status.status).toBe('lunch_break');
  });

  it('should handle year boundary', () => {
    // 跨年
    const newYear = new Date('2024-01-01T00:00:00Z');
    
    const status = getMarketStatus('US', newYear);
    
    // 元旦应该是休市（周一但可能是假日，这里简化处理）
    expect(['closed', 'post_market']).toContain(status.status);
  });
});
