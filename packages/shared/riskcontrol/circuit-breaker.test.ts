/**
 * 熔断机制属性测试
 * 
 * **Feature: riskcontrol-integration**
 * **Property 6: 熔断机制触发正确性**
 * **Validates: Requirements 28.1, 28.2, 28.3, 28.4**
 * 
 * @module @echoai/shared/riskcontrol/circuit-breaker/tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  CircuitBreakerService,
  DEFAULT_CIRCUIT_BREAKER_CONFIGS,
  type CircuitBreakerType,
  type RiskMetrics,
} from './circuit-breaker';

// ============================================
// 辅助函数
// ============================================

// 生成正常的风险指标（不触发熔断）
const normalMetricsArb = fc.record({
  leverage: fc.float({ min: 0, max: Math.fround(1.4) }),           // < 1.5
  monthlyDrawdown: fc.float({ min: 0, max: Math.fround(0.09) }),   // < 10%
  dailyDrawdown: fc.float({ min: 0, max: Math.fround(0.04) }),     // < 5%
  consecutiveLosses: fc.integer({ min: 0, max: 4 }),  // < 5
  maxPositionWeight: fc.float({ min: 0, max: Math.fround(0.24) }), // < 25%
  portfolioVolatility: fc.float({ min: 0, max: Math.fround(0.29) }), // < 30%
});

// 生成高杠杆风险指标
const highLeverageMetricsArb = fc.record({
  leverage: fc.float({ min: Math.fround(1.51), max: Math.fround(3.0) }),        // > 1.5
  monthlyDrawdown: fc.float({ min: 0, max: Math.fround(0.09) }),
  dailyDrawdown: fc.float({ min: 0, max: Math.fround(0.04) }),
  consecutiveLosses: fc.integer({ min: 0, max: 4 }),
  maxPositionWeight: fc.float({ min: 0, max: Math.fround(0.24) }),
  portfolioVolatility: fc.float({ min: 0, max: Math.fround(0.29) }),
});

// 生成高回撤风险指标
const highDrawdownMetricsArb = fc.record({
  leverage: fc.float({ min: 0, max: Math.fround(1.4) }),
  monthlyDrawdown: fc.float({ min: Math.fround(0.11), max: Math.fround(0.5) }), // > 10%
  dailyDrawdown: fc.float({ min: 0, max: Math.fround(0.04) }),
  consecutiveLosses: fc.integer({ min: 0, max: 4 }),
  maxPositionWeight: fc.float({ min: 0, max: Math.fround(0.24) }),
  portfolioVolatility: fc.float({ min: 0, max: Math.fround(0.29) }),
});

// 生成连续亏损风险指标
const consecutiveLossMetricsArb = fc.record({
  leverage: fc.float({ min: 0, max: Math.fround(1.4) }),
  monthlyDrawdown: fc.float({ min: 0, max: Math.fround(0.09) }),
  dailyDrawdown: fc.float({ min: 0, max: Math.fround(0.04) }),
  consecutiveLosses: fc.integer({ min: 6, max: 20 }), // > 5
  maxPositionWeight: fc.float({ min: 0, max: Math.fround(0.24) }),
  portfolioVolatility: fc.float({ min: 0, max: Math.fround(0.29) }),
});

// ============================================
// 属性测试
// ============================================

describe('CircuitBreakerService Property Tests', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService();
  });

  /**
   * **Property 6.1: 正常指标不触发熔断**
   * 当所有风险指标在阈值以下时，交易应该被允许
   * **Validates: Requirements 28.3**
   */
  it('should allow trading when all metrics are normal', () => {
    fc.assert(
      fc.property(normalMetricsArb, (metrics) => {
        const decision = service.checkRiskMetrics(metrics);
        
        // 应该允许交易
        expect(decision.allowed).toBe(true);
        expect(decision.blockedBy).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 6.2: 高杠杆触发熔断**
   * 当杠杆率 > 1.5x 时，应该触发熔断
   * **Validates: Requirements 28.3, 28.4**
   */
  it('should trigger circuit breaker when leverage > 1.5x', () => {
    fc.assert(
      fc.property(highLeverageMetricsArb, (metrics) => {
        const decision = service.checkRiskMetrics(metrics);
        
        // 应该阻止交易
        expect(decision.allowed).toBe(false);
        expect(decision.blockedBy).toContain('leverage');
        
        // 熔断器状态应该是 open
        const state = service.getBreakerState('leverage');
        expect(state?.status).toBe('open');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 6.3: 高回撤触发熔断**
   * 当月度回撤 > 10% 时，应该触发熔断
   * **Validates: Requirements 28.3, 28.4**
   */
  it('should trigger circuit breaker when monthly drawdown > 10%', () => {
    fc.assert(
      fc.property(highDrawdownMetricsArb, (metrics) => {
        const decision = service.checkRiskMetrics(metrics);
        
        // 应该阻止交易
        expect(decision.allowed).toBe(false);
        expect(decision.blockedBy).toContain('drawdown');
        
        // 熔断器状态应该是 open
        const state = service.getBreakerState('drawdown');
        expect(state?.status).toBe('open');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 6.4: 连续亏损触发熔断**
   * 当连续亏损 > 5 次时，应该触发熔断
   */
  it('should trigger circuit breaker when consecutive losses > 5', () => {
    fc.assert(
      fc.property(consecutiveLossMetricsArb, (metrics) => {
        const decision = service.checkRiskMetrics(metrics);
        
        // 应该阻止交易
        expect(decision.allowed).toBe(false);
        expect(decision.blockedBy).toContain('consecutive_loss');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 6.5: 冷却期内持续阻止**
   * 熔断触发后，在冷却期内应该持续阻止交易
   */
  it('should block trading during cooldown period', () => {
    // 先触发熔断
    const highLeverageMetrics: RiskMetrics = {
      leverage: 2.0,
      monthlyDrawdown: 0.05,
      dailyDrawdown: 0.02,
      consecutiveLosses: 2,
      maxPositionWeight: 0.15,
      portfolioVolatility: 0.20,
    };
    
    service.checkRiskMetrics(highLeverageMetrics);
    
    // 即使指标恢复正常，冷却期内仍应阻止
    const normalMetrics: RiskMetrics = {
      leverage: 1.0,
      monthlyDrawdown: 0.05,
      dailyDrawdown: 0.02,
      consecutiveLosses: 2,
      maxPositionWeight: 0.15,
      portfolioVolatility: 0.20,
    };
    
    const decision = service.checkRiskMetrics(normalMetrics);
    
    // 应该仍然阻止（冷却期内）
    expect(decision.allowed).toBe(false);
    expect(decision.blockedBy).toContain('leverage');
  });

  /**
   * **Property 6.6: 配置完整性**
   * 所有必需的熔断类型都应该被配置
   */
  it('should have all required circuit breaker types configured', () => {
    const { valid, missing } = service.validateConfigIntegrity();
    
    expect(valid).toBe(true);
    expect(missing).toHaveLength(0);
  });
});

// ============================================
// 单元测试
// ============================================

describe('CircuitBreakerService Unit Tests', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService();
  });

  describe('Default Configuration', () => {
    it('should have correct leverage threshold', () => {
      const state = service.getBreakerState('leverage');
      expect(state?.threshold).toBe(1.5);
    });

    it('should have correct drawdown threshold', () => {
      const state = service.getBreakerState('drawdown');
      expect(state?.threshold).toBe(0.10);
    });

    it('should have correct consecutive loss threshold', () => {
      const state = service.getBreakerState('consecutive_loss');
      expect(state?.threshold).toBe(5);
    });

    it('should have all breakers in closed state initially', () => {
      const states = service.getAllBreakerStates();
      for (const state of states) {
        expect(state.status).toBe('closed');
      }
    });
  });

  describe('Breaker Triggering', () => {
    it('should trigger leverage breaker at exactly 1.51', () => {
      const metrics: RiskMetrics = {
        leverage: 1.51,
        monthlyDrawdown: 0,
        dailyDrawdown: 0,
        consecutiveLosses: 0,
        maxPositionWeight: 0,
        portfolioVolatility: 0,
      };

      const decision = service.checkRiskMetrics(metrics);
      expect(decision.blockedBy).toContain('leverage');
    });

    it('should not trigger leverage breaker at exactly 1.5', () => {
      const metrics: RiskMetrics = {
        leverage: 1.5,
        monthlyDrawdown: 0,
        dailyDrawdown: 0,
        consecutiveLosses: 0,
        maxPositionWeight: 0,
        portfolioVolatility: 0,
      };

      const decision = service.checkRiskMetrics(metrics);
      expect(decision.blockedBy).not.toContain('leverage');
    });

    it('should set cooldown end time when triggered', () => {
      const metrics: RiskMetrics = {
        leverage: 2.0,
        monthlyDrawdown: 0,
        dailyDrawdown: 0,
        consecutiveLosses: 0,
        maxPositionWeight: 0,
        portfolioVolatility: 0,
      };

      service.checkRiskMetrics(metrics);
      
      const state = service.getBreakerState('leverage');
      expect(state?.cooldownEndsAt).not.toBeNull();
      expect(state?.triggeredAt).not.toBeNull();
    });

    it('should increment trigger count', () => {
      const metrics: RiskMetrics = {
        leverage: 2.0,
        monthlyDrawdown: 0,
        dailyDrawdown: 0,
        consecutiveLosses: 0,
        maxPositionWeight: 0,
        portfolioVolatility: 0,
      };

      service.checkRiskMetrics(metrics);
      
      const state = service.getBreakerState('leverage');
      expect(state?.triggerCount).toBe(1);
    });
  });

  describe('Warnings', () => {
    it('should add warning when approaching threshold', () => {
      const metrics: RiskMetrics = {
        leverage: 1.3, // 80% of 1.5 = 1.2, so 1.3 should trigger warning
        monthlyDrawdown: 0,
        dailyDrawdown: 0,
        consecutiveLosses: 0,
        maxPositionWeight: 0,
        portfolioVolatility: 0,
      };

      const decision = service.checkRiskMetrics(metrics);
      expect(decision.warnings.length).toBeGreaterThan(0);
      expect(decision.warnings[0]).toContain('leverage');
    });
  });

  describe('Manual Reset', () => {
    it('should reset breaker state', () => {
      // 先触发熔断
      const metrics: RiskMetrics = {
        leverage: 2.0,
        monthlyDrawdown: 0,
        dailyDrawdown: 0,
        consecutiveLosses: 0,
        maxPositionWeight: 0,
        portfolioVolatility: 0,
      };
      service.checkRiskMetrics(metrics);
      
      // 重置
      const result = service.resetBreaker('leverage');
      expect(result).toBe(true);
      
      const state = service.getBreakerState('leverage');
      expect(state?.status).toBe('closed');
      expect(state?.triggeredAt).toBeNull();
    });

    it('should return false for non-existent breaker', () => {
      const result = service.resetBreaker('nonexistent' as CircuitBreakerType);
      expect(result).toBe(false);
    });
  });

  describe('Config Update', () => {
    it('should update threshold', () => {
      service.updateConfig('leverage', { threshold: 2.0 });
      
      const state = service.getBreakerState('leverage');
      expect(state?.threshold).toBe(2.0);
    });

    it('should update enabled status', () => {
      service.updateConfig('volatility', { enabled: true });
      
      // 验证配置已更新（通过触发测试）
      const metrics: RiskMetrics = {
        leverage: 1.0,
        monthlyDrawdown: 0,
        dailyDrawdown: 0,
        consecutiveLosses: 0,
        maxPositionWeight: 0,
        portfolioVolatility: 0.35, // > 30%
      };
      
      const decision = service.checkRiskMetrics(metrics);
      expect(decision.blockedBy).toContain('volatility');
    });
  });
});

// ============================================
// 配置验证测试
// ============================================

describe('Default Configuration Validation', () => {
  it('should have all required configs', () => {
    const requiredTypes: CircuitBreakerType[] = [
      'leverage',
      'drawdown',
      'consecutive_loss',
      'daily_loss',
      'position_size',
    ];

    for (const type of requiredTypes) {
      const config = DEFAULT_CIRCUIT_BREAKER_CONFIGS.find(c => c.type === type);
      expect(config).toBeDefined();
      expect(config?.enabled).toBe(true);
    }
  });

  it('should have correct cooldown periods', () => {
    const leverageConfig = DEFAULT_CIRCUIT_BREAKER_CONFIGS.find(c => c.type === 'leverage');
    expect(leverageConfig?.cooldownHours).toBe(24);

    const drawdownConfig = DEFAULT_CIRCUIT_BREAKER_CONFIGS.find(c => c.type === 'drawdown');
    expect(drawdownConfig?.cooldownHours).toBe(72);
  });
});
