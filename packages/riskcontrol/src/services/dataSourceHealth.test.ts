/**
 * Property-based tests for Data Source Health Monitor
 * Feature: realtime-market-platform
 * 
 * Property 9: 数据源健康状态追踪
 * Validates: Requirements 9.1, 9.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  dataSourceHealthMonitor,
  withHealthTracking,
  type DataSource,
} from './dataSourceHealth';

// ============ 测试前重置 ============

beforeEach(() => {
  dataSourceHealthMonitor.reset();
  vi.clearAllMocks();
});

// ============ Property 9: 数据源健康状态追踪 ============

describe('Feature: realtime-market-platform, Property 9: 数据源健康状态追踪', () => {
  
  describe('成功率计算', () => {
    it('should correctly calculate success rate', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (successCount, failCount) => {
            dataSourceHealthMonitor.reset('longport');
            
            // 记录成功请求
            for (let i = 0; i < successCount; i++) {
              dataSourceHealthMonitor.recordRequest('longport', true, 100);
            }
            
            // 记录失败请求（但不超过阈值以保持健康）
            const safeFailCount = Math.min(failCount, 2);
            for (let i = 0; i < safeFailCount; i++) {
              dataSourceHealthMonitor.recordRequest('longport', false, 100, 'test error');
            }
            
            const health = dataSourceHealthMonitor.getHealth('longport');
            const expectedRate = successCount / (successCount + safeFailCount);
            
            expect(health.successRate).toBeCloseTo(expectedRate, 5);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('延迟追踪', () => {
    it('should correctly calculate average latency', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 10, max: 5000 }), { minLength: 1, maxLength: 50 }),
          (latencies) => {
            dataSourceHealthMonitor.reset('openbb');
            
            latencies.forEach(latency => {
              dataSourceHealthMonitor.recordRequest('openbb', true, latency);
            });
            
            const health = dataSourceHealthMonitor.getHealth('openbb');
            const expectedAvg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            
            expect(health.avgLatency).toBeCloseTo(expectedAvg, 5);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('连续失败检测', () => {
    it('should mark source as unhealthy after 3 consecutive failures', () => {
      dataSourceHealthMonitor.reset('tencent');
      
      // 初始状态应该是健康的
      expect(dataSourceHealthMonitor.isHealthy('tencent')).toBe(true);
      
      // 1次失败
      dataSourceHealthMonitor.recordRequest('tencent', false, 100, 'error 1');
      expect(dataSourceHealthMonitor.isHealthy('tencent')).toBe(true);
      
      // 2次失败
      dataSourceHealthMonitor.recordRequest('tencent', false, 100, 'error 2');
      expect(dataSourceHealthMonitor.isHealthy('tencent')).toBe(true);
      
      // 3次失败 - 应该变为不健康
      dataSourceHealthMonitor.recordRequest('tencent', false, 100, 'error 3');
      expect(dataSourceHealthMonitor.isHealthy('tencent')).toBe(false);
    });

    it('should reset consecutive failures on success', () => {
      dataSourceHealthMonitor.reset('longport');
      
      // 2次失败
      dataSourceHealthMonitor.recordRequest('longport', false, 100, 'error 1');
      dataSourceHealthMonitor.recordRequest('longport', false, 100, 'error 2');
      
      // 1次成功 - 应该重置计数
      dataSourceHealthMonitor.recordRequest('longport', true, 100);
      
      // 再2次失败 - 不应该变为不健康
      dataSourceHealthMonitor.recordRequest('longport', false, 100, 'error 3');
      dataSourceHealthMonitor.recordRequest('longport', false, 100, 'error 4');
      
      expect(dataSourceHealthMonitor.isHealthy('longport')).toBe(true);
    });

    it('should recover when successful request comes after being unhealthy', () => {
      dataSourceHealthMonitor.reset('openbb');
      
      // 3次失败 - 变为不健康
      dataSourceHealthMonitor.recordRequest('openbb', false, 100, 'error 1');
      dataSourceHealthMonitor.recordRequest('openbb', false, 100, 'error 2');
      dataSourceHealthMonitor.recordRequest('openbb', false, 100, 'error 3');
      expect(dataSourceHealthMonitor.isHealthy('openbb')).toBe(false);
      
      // 1次成功 - 应该恢复
      dataSourceHealthMonitor.recordRequest('openbb', true, 100);
      expect(dataSourceHealthMonitor.isHealthy('openbb')).toBe(true);
    });
  });

  describe('健康状态变化回调', () => {
    it('should notify callbacks when health status changes', () => {
      dataSourceHealthMonitor.reset('longport');
      
      const callback = vi.fn();
      const unsubscribe = dataSourceHealthMonitor.onHealthChange(callback);
      
      // 3次失败触发不健康
      dataSourceHealthMonitor.recordRequest('longport', false, 100, 'error 1');
      dataSourceHealthMonitor.recordRequest('longport', false, 100, 'error 2');
      dataSourceHealthMonitor.recordRequest('longport', false, 100, 'error 3');
      
      expect(callback).toHaveBeenCalledWith('longport', false);
      
      // 成功恢复
      dataSourceHealthMonitor.recordRequest('longport', true, 100);
      expect(callback).toHaveBeenCalledWith('longport', true);
      
      unsubscribe();
    });
  });
});

// ============ Property 2: 数据源故障转移 ============

describe('Feature: realtime-market-platform, Property 2: 数据源故障转移', () => {
  
  it('should return healthy sources in priority order', () => {
    dataSourceHealthMonitor.reset();
    
    // 所有数据源健康时
    const usSources = dataSourceHealthMonitor.getHealthySources('US');
    expect(usSources).toContain('longport');
    expect(usSources).toContain('openbb');
    
    const cnSources = dataSourceHealthMonitor.getHealthySources('CN');
    expect(cnSources[0]).toBe('tencent'); // 腾讯优先
  });

  it('should exclude unhealthy sources from list', () => {
    dataSourceHealthMonitor.reset();
    
    // 让 longport 变为不健康
    dataSourceHealthMonitor.recordRequest('longport', false, 100, 'error 1');
    dataSourceHealthMonitor.recordRequest('longport', false, 100, 'error 2');
    dataSourceHealthMonitor.recordRequest('longport', false, 100, 'error 3');
    
    const usSources = dataSourceHealthMonitor.getHealthySources('US');
    expect(usSources).not.toContain('longport');
    expect(usSources).toContain('openbb');
  });

  it('should provide fallback source when primary fails', () => {
    dataSourceHealthMonitor.reset();
    
    // 获取下一个可用数据源（排除 longport）
    const fallback = dataSourceHealthMonitor.getNextAvailableSource('US', 'longport');
    expect(fallback).toBe('openbb');
  });

  it('should return null when all sources are unhealthy', () => {
    dataSourceHealthMonitor.reset();
    
    // 让所有美股数据源变为不健康
    ['longport', 'openbb'].forEach(source => {
      dataSourceHealthMonitor.recordRequest(source as DataSource, false, 100, 'error 1');
      dataSourceHealthMonitor.recordRequest(source as DataSource, false, 100, 'error 2');
      dataSourceHealthMonitor.recordRequest(source as DataSource, false, 100, 'error 3');
    });
    
    const fallback = dataSourceHealthMonitor.getNextAvailableSource('US');
    expect(fallback).toBeNull();
  });
});

// ============ withHealthTracking 测试 ============

describe('withHealthTracking helper', () => {
  
  it('should track successful requests', async () => {
    dataSourceHealthMonitor.reset('longport');
    
    const result = await withHealthTracking('longport', async () => {
      return { price: 100 };
    });
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ price: 100 });
    expect(result.latency).toBeGreaterThanOrEqual(0);
    
    const health = dataSourceHealthMonitor.getHealth('longport');
    expect(health.successRate).toBe(1);
  });

  it('should track failed requests', async () => {
    dataSourceHealthMonitor.reset('openbb');
    
    const result = await withHealthTracking('openbb', async () => {
      throw new Error('Network error');
    });
    
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    
    const health = dataSourceHealthMonitor.getHealth('openbb');
    expect(health.successRate).toBe(0);
    expect(health.lastError).toBe('Network error');
  });
});

// ============ 边界情况测试 ============

describe('Edge cases', () => {
  
  it('should handle unknown source gracefully', () => {
    const health = dataSourceHealthMonitor.getHealth('unknown' as DataSource);
    expect(health.isHealthy).toBe(true);
    expect(health.successRate).toBe(1);
  });

  it('should handle reset correctly', () => {
    // 记录一些数据
    dataSourceHealthMonitor.recordRequest('longport', true, 100);
    dataSourceHealthMonitor.recordRequest('longport', false, 200, 'error');
    
    // 重置
    dataSourceHealthMonitor.reset('longport');
    
    const health = dataSourceHealthMonitor.getHealth('longport');
    expect(health.successRate).toBe(1); // 默认值
    expect(health.avgLatency).toBe(0);
    expect(health.consecutiveFailures).toBe(0);
  });

  it('should handle percentile calculation', () => {
    dataSourceHealthMonitor.reset('tencent');
    
    // 记录一些延迟数据
    [100, 200, 300, 400, 500].forEach(latency => {
      dataSourceHealthMonitor.recordRequest('tencent', true, latency);
    });
    
    const p50 = dataSourceHealthMonitor.getLatencyPercentile('tencent', 50);
    const p90 = dataSourceHealthMonitor.getLatencyPercentile('tencent', 90);
    
    expect(p50).toBeGreaterThanOrEqual(200);
    expect(p90).toBeGreaterThanOrEqual(400);
  });
});
