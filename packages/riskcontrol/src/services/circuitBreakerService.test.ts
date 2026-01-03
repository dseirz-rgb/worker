/**
 * Property-based tests for Circuit Breaker Service
 * Feature: risk-control-2026
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  checkLeverageBreaker,
  checkDrawdownBreaker,
  checkTrailingStopBreaker,
  checkLosingStreakBreaker,
  shouldBlockTrade,
  requiresTradeConfirmation,
  getBreakerSummary,
} from './circuitBreakerService';
import {
  calculateRiskMetrics,
  DEFAULT_THRESHOLDS,
  type DailyPnL,
} from './riskMetricsService';

// Helper generators
const leverage = () => fc.double({ min: 0.01, max: 5, noNaN: true });
const navValue = () => fc.double({ min: 100000, max: 10000000, noNaN: true });

// ============ Property 2: Leverage Blocking Enforcement ============
describe('Feature: risk-control-2026, Property 2: Leverage Blocking Enforcement', () => {
  it('should block trades when leverage > leverageCritical (2.0x)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 2.01, max: 5, noNaN: true }),
        (lev) => {
          const result = checkLeverageBreaker(lev, DEFAULT_THRESHOLDS, false);
          
          expect(result.triggered).toBe(true);
          expect(result.severity).toBe('critical');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow trades when leverage < leverageWarning (1.5x)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 1.49, noNaN: true }),
        (lev) => {
          const result = checkLeverageBreaker(lev, DEFAULT_THRESHOLDS, false);
          
          expect(result.triggered).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should trigger warning when leverage between warning and critical', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.51, max: 1.99, noNaN: true }),
        (lev) => {
          const result = checkLeverageBreaker(lev, DEFAULT_THRESHOLDS, false);
          
          expect(result.triggered).toBe(true);
          expect(result.severity).toBe('warning');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Property 3: Dynamic Leverage Limit in Drawdown ============
describe('Feature: risk-control-2026, Property 3: Dynamic Leverage Limit in Drawdown', () => {
  it('should use stricter limit when in drawdown', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.21, max: 1.49, noNaN: true }),
        (lev) => {
          const normalResult = checkLeverageBreaker(lev, DEFAULT_THRESHOLDS, false);
          const drawdownResult = checkLeverageBreaker(lev, DEFAULT_THRESHOLDS, true);
          
          // In normal conditions, this leverage should not trigger
          expect(normalResult.triggered).toBe(false);
          
          // In drawdown, this leverage should trigger warning
          expect(drawdownResult.triggered).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Property 5: Monthly Drawdown Alert Thresholds ============
describe('Feature: risk-control-2026, Property 5: Monthly Drawdown Breaker Thresholds', () => {
  it('should trigger critical when drawdown >= 15%', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 15.1, max: 50, noNaN: true }),
        (drawdown) => {
          const result = checkDrawdownBreaker(drawdown, DEFAULT_THRESHOLDS);
          
          expect(result.triggered).toBe(true);
          expect(result.severity).toBe('critical');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should trigger warning when drawdown between 10% and 15%', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10.1, max: 14.9, noNaN: true }),
        (drawdown) => {
          const result = checkDrawdownBreaker(drawdown, DEFAULT_THRESHOLDS);
          
          expect(result.triggered).toBe(true);
          expect(result.severity).toBe('warning');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not trigger when drawdown < 10%', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 9.9, noNaN: true }),
        (drawdown) => {
          const result = checkDrawdownBreaker(drawdown, DEFAULT_THRESHOLDS);
          
          expect(result.triggered).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Property 9: Trailing Stop Alert Trigger ============
describe('Feature: risk-control-2026, Property 9: Trailing Stop Breaker Trigger', () => {
  it('should trigger critical when NAV < trailing stop level', () => {
    fc.assert(
      fc.property(
        navValue(),
        fc.double({ min: 10, max: 25, noNaN: true }),
        fc.double({ min: 0.01, max: 0.99, noNaN: true }),
        (hwm, trailingPercent, navRatio) => {
          const trailingStopLevel = hwm * (1 - trailingPercent / 100);
          // NAV below trailing stop level
          const nav = trailingStopLevel * navRatio;
          
          const result = checkTrailingStopBreaker(nav, hwm, trailingPercent);
          
          expect(result.triggered).toBe(true);
          expect(result.severity).toBe('critical');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not trigger when NAV well above trailing stop level', () => {
    fc.assert(
      fc.property(
        navValue(),
        fc.double({ min: 10, max: 25, noNaN: true }),
        (hwm, trailingPercent) => {
          // NAV at HWM (well above trailing stop)
          const nav = hwm;
          
          const result = checkTrailingStopBreaker(nav, hwm, trailingPercent);
          
          expect(result.triggered).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Property 13: Losing Streak Alert Thresholds ============
describe('Feature: risk-control-2026, Property 13: Losing Streak Breaker Thresholds', () => {
  it('should trigger critical when streak >= 5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 20 }),
        (streak) => {
          const result = checkLosingStreakBreaker(streak, DEFAULT_THRESHOLDS);
          
          expect(result.triggered).toBe(true);
          expect(result.severity).toBe('critical');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should trigger warning when streak between 3 and 4', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 4 }),
        (streak) => {
          const result = checkLosingStreakBreaker(streak, DEFAULT_THRESHOLDS);
          
          expect(result.triggered).toBe(true);
          expect(result.severity).toBe('warning');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not trigger when streak < 3', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }),
        (streak) => {
          const result = checkLosingStreakBreaker(streak, DEFAULT_THRESHOLDS);
          
          expect(result.triggered).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Integration Tests ============
describe('Feature: risk-control-2026, Circuit Breaker Integration', () => {
  it('should block trade when any critical breaker is triggered', () => {
    // High leverage scenario
    const metrics = calculateRiskMetrics(
      5000000,  // currentNAV
      2.5,      // currentLeverage (critical)
      5500000,  // monthStartNAV
      6000000,  // highWaterMark
      [],       // no losing streak
      DEFAULT_THRESHOLDS
    );
    
    const result = shouldBlockTrade(metrics, DEFAULT_THRESHOLDS);
    expect(result.blocked).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('should require confirmation when warning breakers are triggered', () => {
    // Warning level leverage
    const metrics = calculateRiskMetrics(
      5000000,  // currentNAV
      1.6,      // currentLeverage (warning)
      5500000,  // monthStartNAV
      5500000,  // highWaterMark
      [],       // no losing streak
      DEFAULT_THRESHOLDS
    );
    
    const result = requiresTradeConfirmation(metrics, DEFAULT_THRESHOLDS);
    expect(result.required).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should allow trade when no breakers are triggered', () => {
    const metrics = calculateRiskMetrics(
      5000000,  // currentNAV
      1.0,      // currentLeverage (safe)
      5000000,  // monthStartNAV (no drawdown)
      4000000,  // highWaterMark (below current NAV, so no trailing stop concern)
      [],       // no losing streak
      DEFAULT_THRESHOLDS
    );
    
    const blockResult = shouldBlockTrade(metrics, DEFAULT_THRESHOLDS);
    
    expect(blockResult.blocked).toBe(false);
  });

  it('should provide accurate breaker summary', () => {
    // Multiple breakers triggered
    const losingDays: DailyPnL[] = Array.from({ length: 5 }, (_, i) => ({
      date: `2025-01-${10 + i}`,
      pnl: -10000,
      pnlPercent: -1,
    }));
    
    const metrics = calculateRiskMetrics(
      4000000,  // currentNAV (20% drawdown from month start)
      2.2,      // currentLeverage (critical)
      5000000,  // monthStartNAV
      6000000,  // highWaterMark
      losingDays,
      DEFAULT_THRESHOLDS
    );
    
    const summary = getBreakerSummary(metrics, DEFAULT_THRESHOLDS);
    
    expect(summary.totalTriggered).toBeGreaterThan(0);
    expect(summary.criticalCount).toBeGreaterThan(0);
    expect(summary.tradingAllowed).toBe(false);
  });
});
