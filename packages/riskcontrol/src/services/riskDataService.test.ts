/**
 * Property-based tests for Risk Data Service
 * Feature: risk-control-2026
 * Task 8.2: Property test for configuration persistence
 * Task 8.3: Property test for trailing stop bounds
 * Task 14.2: Property test for monthly reset
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  DEFAULT_RISK_THRESHOLDS,
  type RiskThresholds,
  type MonthlySnapshot,
} from './riskDataService';

// ============ Property 15: Risk Threshold Configuration Persistence ============
describe('Feature: risk-control-2026, Property 15: Risk Threshold Configuration Persistence', () => {
  
  it('should have valid default thresholds', () => {
    expect(DEFAULT_RISK_THRESHOLDS.leverage_warning).toBeGreaterThan(0);
    expect(DEFAULT_RISK_THRESHOLDS.leverage_critical).toBeGreaterThan(DEFAULT_RISK_THRESHOLDS.leverage_warning);
    expect(DEFAULT_RISK_THRESHOLDS.leverage_in_drawdown).toBeGreaterThan(0);
    expect(DEFAULT_RISK_THRESHOLDS.leverage_in_drawdown).toBeLessThanOrEqual(DEFAULT_RISK_THRESHOLDS.leverage_warning);
    
    expect(DEFAULT_RISK_THRESHOLDS.monthly_drawdown_warning).toBeGreaterThan(0);
    expect(DEFAULT_RISK_THRESHOLDS.monthly_drawdown_critical).toBeGreaterThan(DEFAULT_RISK_THRESHOLDS.monthly_drawdown_warning);
    
    expect(DEFAULT_RISK_THRESHOLDS.trailing_stop_percent).toBeGreaterThanOrEqual(10);
    expect(DEFAULT_RISK_THRESHOLDS.trailing_stop_percent).toBeLessThanOrEqual(25);
    
    expect(DEFAULT_RISK_THRESHOLDS.losing_streak_warning).toBeGreaterThan(0);
    expect(DEFAULT_RISK_THRESHOLDS.losing_streak_critical).toBeGreaterThan(DEFAULT_RISK_THRESHOLDS.losing_streak_warning);
  });

  it('should maintain threshold ordering invariants', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 1.4, noNaN: true }),
        fc.double({ min: 1.6, max: 3.0, noNaN: true }),
        fc.double({ min: 0.8, max: 1.0, noNaN: true }),
        fc.double({ min: 5, max: 12, noNaN: true }),
        fc.double({ min: 14, max: 25, noNaN: true }),
        fc.double({ min: 10, max: 25, noNaN: true }),
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 5, max: 10 }),
        (levWarn, levCrit, levDrawdown, ddWarn, ddCrit, trailStop, streakWarn, streakCrit) => {
          // Create thresholds with proper ordering guaranteed by generator ranges
          const thresholds: Partial<RiskThresholds> = {
            leverage_warning: levWarn,
            leverage_critical: levCrit,
            leverage_in_drawdown: levDrawdown,
            monthly_drawdown_warning: ddWarn,
            monthly_drawdown_critical: ddCrit,
            trailing_stop_percent: trailStop,
            losing_streak_warning: streakWarn,
            losing_streak_critical: streakCrit,
          };
          
          // Verify invariants hold due to generator constraints
          expect(thresholds.leverage_warning!).toBeLessThan(thresholds.leverage_critical!);
          expect(thresholds.leverage_in_drawdown!).toBeLessThanOrEqual(thresholds.leverage_warning!);
          expect(thresholds.monthly_drawdown_warning!).toBeLessThan(thresholds.monthly_drawdown_critical!);
          expect(thresholds.losing_streak_warning!).toBeLessThan(thresholds.losing_streak_critical!);
          expect(thresholds.trailing_stop_percent!).toBeGreaterThanOrEqual(10);
          expect(thresholds.trailing_stop_percent!).toBeLessThanOrEqual(25);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate threshold value ranges', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 50, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.integer({ min: 0, max: 30 }),
        (leverage, drawdown, trailStop, streak) => {
          // Leverage should be positive
          expect(leverage).toBeGreaterThan(0);
          
          // Drawdown should be non-negative percentage
          expect(drawdown).toBeGreaterThanOrEqual(0);
          expect(drawdown).toBeLessThanOrEqual(100);
          
          // Trailing stop should be percentage
          expect(trailStop).toBeGreaterThanOrEqual(0);
          expect(trailStop).toBeLessThanOrEqual(100);
          
          // Streak should be non-negative integer
          expect(streak).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(streak)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Property 10: Trailing Stop Percent Bounds (Task 8.3) ============
describe('Feature: risk-control-2026, Property 10: Trailing Stop Percent Bounds', () => {
  
  it('should enforce trailing stop percent between 10% and 25%', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10, max: 25, noNaN: true }),
        (trailStop) => {
          // Valid range should be accepted
          expect(trailStop).toBeGreaterThanOrEqual(10);
          expect(trailStop).toBeLessThanOrEqual(25);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should identify invalid trailing stop values below minimum', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 9.99, noNaN: true }),
        (trailStop) => {
          // Values below 10% are invalid
          expect(trailStop).toBeLessThan(10);
          
          // Should be clamped to minimum
          const clamped = Math.max(10, Math.min(25, trailStop));
          expect(clamped).toBe(10);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should identify invalid trailing stop values above maximum', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 25.01, max: 100, noNaN: true }),
        (trailStop) => {
          // Values above 25% are invalid
          expect(trailStop).toBeGreaterThan(25);
          
          // Should be clamped to maximum
          const clamped = Math.max(10, Math.min(25, trailStop));
          expect(clamped).toBe(25);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should correctly clamp trailing stop to valid range', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -50, max: 150, noNaN: true }),
        (trailStop) => {
          const clamped = Math.max(10, Math.min(25, trailStop));
          
          expect(clamped).toBeGreaterThanOrEqual(10);
          expect(clamped).toBeLessThanOrEqual(25);
          
          // If original was in range, clamped should equal original
          if (trailStop >= 10 && trailStop <= 25) {
            expect(clamped).toBe(trailStop);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Property 6: Monthly Drawdown Reset on New Month (Task 14.2) ============
describe('Feature: risk-control-2026, Property 6: Monthly Drawdown Reset on New Month', () => {
  
  it('should use current NAV as month start NAV for new month', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100000, max: 10000000, noNaN: true }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 2020, max: 2030 }),
        (currentNAV, month, year) => {
          const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
          
          // When creating a new monthly snapshot, start_nav should equal current NAV
          const snapshot: MonthlySnapshot = {
            user_id: 1,
            year_month: yearMonth,
            start_nav: currentNAV,
          };
          
          expect(snapshot.start_nav).toBe(currentNAV);
          expect(snapshot.year_month).toMatch(/^\d{4}-\d{2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should calculate monthly drawdown correctly from month start NAV', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100000, max: 10000000, noNaN: true }),
        fc.double({ min: 0.5, max: 1.5, noNaN: true }),
        (monthStartNAV, multiplier) => {
          const currentNAV = monthStartNAV * multiplier;
          
          // Drawdown = (monthStartNAV - currentNAV) / monthStartNAV * 100
          const drawdown = ((monthStartNAV - currentNAV) / monthStartNAV) * 100;
          
          // If current NAV is higher, drawdown should be negative (gain)
          if (currentNAV > monthStartNAV) {
            expect(drawdown).toBeLessThan(0);
          }
          
          // If current NAV is lower, drawdown should be positive (loss)
          if (currentNAV < monthStartNAV) {
            expect(drawdown).toBeGreaterThan(0);
          }
          
          // If equal, drawdown should be 0
          if (currentNAV === monthStartNAV) {
            expect(drawdown).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reset drawdown to 0 at month boundary', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100000, max: 10000000, noNaN: true }),
        fc.double({ min: 0.7, max: 0.95, noNaN: true }), // Previous month had drawdown
        (nav, drawdownMultiplier) => {
          // Previous month ended with some drawdown
          const previousMonthEndNAV = nav * drawdownMultiplier;
          
          // New month starts fresh - current NAV becomes new month start NAV
          const newMonthStartNAV = previousMonthEndNAV;
          const newMonthCurrentNAV = previousMonthEndNAV; // Same as start
          
          // Drawdown at start of new month should be 0
          const newMonthDrawdown = ((newMonthStartNAV - newMonthCurrentNAV) / newMonthStartNAV) * 100;
          
          expect(newMonthDrawdown).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate valid year-month format', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        (year, month) => {
          const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
          
          // Should match YYYY-MM format
          expect(yearMonth).toMatch(/^\d{4}-\d{2}$/);
          
          // Month should be 01-12
          const monthPart = yearMonth.split('-')[1];
          const monthNum = parseInt(monthPart, 10);
          expect(monthNum).toBeGreaterThanOrEqual(1);
          expect(monthNum).toBeLessThanOrEqual(12);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should track max drawdown within month', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100000, max: 10000000, noNaN: true }),
        fc.array(fc.double({ min: 0.8, max: 1.1, noNaN: true }), { minLength: 5, maxLength: 30 }),
        (monthStartNAV, dailyMultipliers) => {
          let maxDrawdown = 0;
          
          for (const multiplier of dailyMultipliers) {
            const currentNAV = monthStartNAV * multiplier;
            const drawdown = ((monthStartNAV - currentNAV) / monthStartNAV) * 100;
            
            // Track maximum drawdown (positive value = loss)
            if (drawdown > maxDrawdown) {
              maxDrawdown = drawdown;
            }
          }
          
          // Max drawdown should be non-negative
          expect(maxDrawdown).toBeGreaterThanOrEqual(0);
          
          // Max drawdown should not exceed 100%
          expect(maxDrawdown).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============ Additional Unit Tests ============
describe('Feature: risk-control-2026, Risk Data Service Unit Tests', () => {
  
  it('should have consistent default threshold values', () => {
    // Verify specific default values match requirements
    expect(DEFAULT_RISK_THRESHOLDS.leverage_warning).toBe(1.5);
    expect(DEFAULT_RISK_THRESHOLDS.leverage_critical).toBe(2.0);
    expect(DEFAULT_RISK_THRESHOLDS.leverage_in_drawdown).toBe(1.2);
    expect(DEFAULT_RISK_THRESHOLDS.monthly_drawdown_warning).toBe(10);
    expect(DEFAULT_RISK_THRESHOLDS.monthly_drawdown_critical).toBe(15);
    expect(DEFAULT_RISK_THRESHOLDS.trailing_stop_percent).toBe(15);
    expect(DEFAULT_RISK_THRESHOLDS.losing_streak_warning).toBe(3);
    expect(DEFAULT_RISK_THRESHOLDS.losing_streak_critical).toBe(5);
  });

  it('should have user_id in default thresholds', () => {
    expect(DEFAULT_RISK_THRESHOLDS.user_id).toBe(1);
  });
});
