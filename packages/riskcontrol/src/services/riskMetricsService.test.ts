/**
 * Property-based tests for Risk Metrics Service
 * Feature: risk-control-2026
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateLeverageStatus,
  calculateMonthlyDrawdown,
  calculateTrailingStopLevel,
  calculateTrailingStopStatus,
  calculateLosingStreak,
  calculateLosingStreakStatus,
  calculateOverallRiskScore,
  updateHighWaterMark,
  validateTrailingStopPercent,
  DEFAULT_THRESHOLDS,
  type RiskThresholds,
  type DailyPnL,
} from './riskMetricsService';

// Helper: use double instead of float to avoid 32-bit float constraints
const leverage = () => fc.double({ min: 0.01, max: 10, noNaN: true });
const navValue = () => fc.double({ min: 1000, max: 10000000, noNaN: true });
const percent = () => fc.double({ min: 0, max: 100, noNaN: true });

// ============ Property 1: Leverage Alert Threshold Consistency ============
describe('Feature: risk-control-2026, Property 1: Leverage Alert Threshold Consistency', () => {
  it('should return warning or critical status when leverage > leverageWarning', () => {
    fc.assert(
      fc.property(
        leverage(),
        fc.boolean(),
        (lev, isInDrawdown) => {
          const result = calculateLeverageStatus(lev, DEFAULT_THRESHOLDS, isInDrawdown);
          
          if (lev >= DEFAULT_THRESHOLDS.leverageWarning) {
            expect(['warning', 'critical']).toContain(result.status);
          }
          
          if (lev < DEFAULT_THRESHOLDS.leverageWarning) {
            expect(result.status).toBe('normal');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return critical status when leverage >= leverageCritical', () => {
    fc.assert(
      fc.property(
        fc.double({ min: DEFAULT_THRESHOLDS.leverageCritical, max: 10, noNaN: true }),
        fc.boolean(),
        (lev, isInDrawdown) => {
          const result = calculateLeverageStatus(lev, DEFAULT_THRESHOLDS, isInDrawdown);
          expect(result.status).toBe('critical');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Property 3: Dynamic Leverage Limit in Drawdown ============
describe('Feature: risk-control-2026, Property 3: Dynamic Leverage Limit in Drawdown', () => {
  it('should reduce leverage limit to leverageInDrawdown when in drawdown', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 5, noNaN: true }),
        (lev) => {
          const resultInDrawdown = calculateLeverageStatus(lev, DEFAULT_THRESHOLDS, true);
          const resultNormal = calculateLeverageStatus(lev, DEFAULT_THRESHOLDS, false);
          
          expect(resultInDrawdown.limit).toBe(DEFAULT_THRESHOLDS.leverageInDrawdown);
          expect(resultNormal.limit).toBe(DEFAULT_THRESHOLDS.leverageCritical);
          expect(resultInDrawdown.limit).toBeLessThan(resultNormal.limit);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Property 4: Monthly Drawdown Calculation Accuracy ============
describe('Feature: risk-control-2026, Property 4: Monthly Drawdown Calculation Accuracy', () => {
  it('should calculate drawdown as (monthStartNAV - currentNAV) / monthStartNAV * 100', () => {
    fc.assert(
      fc.property(
        navValue(),
        fc.double({ min: 0.5, max: 1.5, noNaN: true }),
        (monthStartNAV, multiplier) => {
          const currentNAV = monthStartNAV * multiplier;
          const result = calculateMonthlyDrawdown(monthStartNAV, currentNAV, DEFAULT_THRESHOLDS);
          
          const expectedDrawdown = ((monthStartNAV - currentNAV) / monthStartNAV) * 100;
          expect(result.drawdown).toBeCloseTo(expectedDrawdown, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle zero NAV edge case', () => {
    const result = calculateMonthlyDrawdown(0, 100000, DEFAULT_THRESHOLDS);
    expect(result.drawdown).toBe(0);
    expect(result.status).toBe('normal');
  });
});

// ============ Property 5: Monthly Drawdown Alert Thresholds ============
describe('Feature: risk-control-2026, Property 5: Monthly Drawdown Alert Thresholds', () => {
  it('should return warning or critical when drawdown >= 10%', () => {
    fc.assert(
      fc.property(
        navValue(),
        fc.double({ min: 0.101, max: 0.5, noNaN: true }), // >10% to 50% drawdown (avoid boundary)
        (monthStartNAV, drawdownPercent) => {
          const currentNAV = monthStartNAV * (1 - drawdownPercent);
          const result = calculateMonthlyDrawdown(monthStartNAV, currentNAV, DEFAULT_THRESHOLDS);
          
          expect(['warning', 'critical']).toContain(result.status);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return critical when drawdown >= 15%', () => {
    fc.assert(
      fc.property(
        navValue(),
        fc.double({ min: 0.151, max: 0.5, noNaN: true }), // >15% to 50% drawdown (avoid boundary)
        (monthStartNAV, drawdownPercent) => {
          const currentNAV = monthStartNAV * (1 - drawdownPercent);
          const result = calculateMonthlyDrawdown(monthStartNAV, currentNAV, DEFAULT_THRESHOLDS);
          
          expect(result.status).toBe('critical');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Property 7: High Water Mark Monotonicity ============
describe('Feature: risk-control-2026, Property 7: High Water Mark Monotonicity', () => {
  it('should only increase or stay the same, never decrease', () => {
    fc.assert(
      fc.property(
        fc.array(navValue(), { minLength: 2, maxLength: 50 }),
        (navSequence) => {
          let hwm = navSequence[0];
          
          for (const nav of navSequence) {
            const newHWM = updateHighWaterMark(hwm, nav);
            expect(newHWM).toBeGreaterThanOrEqual(hwm);
            hwm = newHWM;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Property 8: Trailing Stop Level Calculation ============
describe('Feature: risk-control-2026, Property 8: Trailing Stop Level Calculation', () => {
  it('should calculate trailingStopLevel = HWM * (1 - trailingStopPercent / 100)', () => {
    fc.assert(
      fc.property(
        navValue(),
        fc.double({ min: 10, max: 25, noNaN: true }),
        (hwm, trailingStopPercent) => {
          const level = calculateTrailingStopLevel(hwm, trailingStopPercent);
          const expected = hwm * (1 - trailingStopPercent / 100);
          expect(level).toBeCloseTo(expected, 5);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Property 10: Trailing Stop Percent Bounds ============
describe('Feature: risk-control-2026, Property 10: Trailing Stop Percent Bounds', () => {
  it('should enforce 10 <= trailingStopPercent <= 25', () => {
    // Valid range
    fc.assert(
      fc.property(
        fc.double({ min: 10, max: 25, noNaN: true }),
        (pct) => {
          expect(validateTrailingStopPercent(pct)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject values outside valid range', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 9.99, noNaN: true }),
        (pct) => {
          expect(validateTrailingStopPercent(pct)).toBe(false);
        }
      ),
      { numRuns: 50 }
    );

    fc.assert(
      fc.property(
        fc.double({ min: 25.01, max: 100, noNaN: true }),
        (pct) => {
          expect(validateTrailingStopPercent(pct)).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should clamp out-of-range values in calculation', () => {
    const hwm = 1000000;
    
    // Below minimum (should clamp to 10%)
    const levelLow = calculateTrailingStopLevel(hwm, 5);
    expect(levelLow).toBe(hwm * 0.9);
    
    // Above maximum (should clamp to 25%)
    const levelHigh = calculateTrailingStopLevel(hwm, 30);
    expect(levelHigh).toBe(hwm * 0.75);
  });
});

// ============ Property 11: Losing Streak Counter Accuracy ============
describe('Feature: risk-control-2026, Property 11: Losing Streak Counter Accuracy', () => {
  it('should count consecutive negative P&L days ending at current day', () => {
    // Generate a sequence with known losing streak at the end
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 5 }),
        (losingDays, winningDaysBefore) => {
          const history: DailyPnL[] = [];
          const baseDate = new Date('2025-01-01');
          
          // Add winning days first
          for (let i = 0; i < winningDaysBefore; i++) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() + i);
            history.push({
              date: date.toISOString().split('T')[0],
              pnl: Math.random() * 10000 + 1,
              pnlPercent: Math.random() * 5,
            });
          }
          
          // Add losing days at the end
          for (let i = 0; i < losingDays; i++) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() + winningDaysBefore + i);
            history.push({
              date: date.toISOString().split('T')[0],
              pnl: -(Math.random() * 10000 + 1),
              pnlPercent: -(Math.random() * 5),
            });
          }
          
          const streak = calculateLosingStreak(history);
          expect(streak).toBe(losingDays);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Property 12: Losing Streak Reset on Profit ============
describe('Feature: risk-control-2026, Property 12: Losing Streak Reset on Profit', () => {
  it('should reset to 0 when latest day is profitable', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (previousLosingDays) => {
          const history: DailyPnL[] = [];
          const baseDate = new Date('2025-01-01');
          
          // Add losing days
          for (let i = 0; i < previousLosingDays; i++) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() + i);
            history.push({
              date: date.toISOString().split('T')[0],
              pnl: -1000,
              pnlPercent: -1,
            });
          }
          
          // Add a winning day at the end
          const winDate = new Date(baseDate);
          winDate.setDate(winDate.getDate() + previousLosingDays);
          history.push({
            date: winDate.toISOString().split('T')[0],
            pnl: 1000,
            pnlPercent: 1,
          });
          
          const streak = calculateLosingStreak(history);
          expect(streak).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Property 13: Losing Streak Alert Thresholds ============
describe('Feature: risk-control-2026, Property 13: Losing Streak Alert Thresholds', () => {
  it('should return warning or critical when streak >= 3', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }),
        (streak) => {
          const status = calculateLosingStreakStatus(streak, DEFAULT_THRESHOLDS);
          expect(['warning', 'critical']).toContain(status);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return critical when streak >= 5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 20 }),
        (streak) => {
          const status = calculateLosingStreakStatus(streak, DEFAULT_THRESHOLDS);
          expect(status).toBe('critical');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return normal when streak < 3', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }),
        (streak) => {
          const status = calculateLosingStreakStatus(streak, DEFAULT_THRESHOLDS);
          expect(status).toBe('normal');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Property 14: Risk Score Bounds ============
describe('Feature: risk-control-2026, Property 14: Risk Score Bounds', () => {
  it('should always return score in range [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('normal', 'warning', 'critical') as fc.Arbitrary<'normal' | 'warning' | 'critical'>,
        fc.constantFrom('normal', 'warning', 'critical') as fc.Arbitrary<'normal' | 'warning' | 'critical'>,
        fc.constantFrom('normal', 'warning', 'triggered') as fc.Arbitrary<'normal' | 'warning' | 'triggered'>,
        fc.constantFrom('normal', 'warning', 'critical') as fc.Arbitrary<'normal' | 'warning' | 'critical'>,
        fc.double({ min: 0, max: 5, noNaN: true }),
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.integer({ min: 0, max: 20 }),
        (leverageStatus, drawdownStatus, trailingStatus, streakStatus, lev, drawdown, streak) => {
          const result = calculateOverallRiskScore({
            leverageStatus,
            monthlyDrawdownStatus: drawdownStatus,
            trailingStopStatus: trailingStatus,
            losingStreakStatus: streakStatus,
            currentLeverage: lev,
            monthlyDrawdown: drawdown,
            currentLosingStreak: streak,
          });
          
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return danger status when score >= 60', () => {
    // Force high risk scenario
    const result = calculateOverallRiskScore({
      leverageStatus: 'critical',
      monthlyDrawdownStatus: 'critical',
      trailingStopStatus: 'triggered',
      losingStreakStatus: 'critical',
      currentLeverage: 3,
      monthlyDrawdown: 20,
      currentLosingStreak: 8,
    });
    
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.status).toBe('danger');
  });

  it('should return safe status when score < 30', () => {
    const result = calculateOverallRiskScore({
      leverageStatus: 'normal',
      monthlyDrawdownStatus: 'normal',
      trailingStopStatus: 'normal',
      losingStreakStatus: 'normal',
      currentLeverage: 0.5,
      monthlyDrawdown: 0,
      currentLosingStreak: 0,
    });
    
    expect(result.score).toBeLessThan(30);
    expect(result.status).toBe('safe');
  });
});
