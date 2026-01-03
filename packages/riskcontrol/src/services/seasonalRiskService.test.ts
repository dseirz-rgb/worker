/**
 * Property-based tests for Seasonal Risk Service
 * Feature: risk-control-2026
 * Task 12.2: Property test for seasonal risk detection
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  analyzeSeasonalPerformance,
  getSeasonalRiskWarning,
  getMonthlyStats,
  type MonthlyStats,
  type SeasonalPerformance,
  type SeasonalRiskWarning,
} from './seasonalRiskService';
import type { DashboardSnapshot } from './supabaseData';

// ============ Helper Generators ============

// Generate a valid DashboardSnapshot for testing
const dashboardSnapshot = (month: number, year: number = 2024): fc.Arbitrary<DashboardSnapshot> => {
  const day = fc.integer({ min: 1, max: 28 });
  const dailyPnlPercent = fc.double({ min: -5, max: 5, noNaN: true });
  const drawdownPercent = fc.double({ min: -20, max: 0, noNaN: true });
  
  return fc.record({
    day,
    dailyPnlPercent,
    drawdownPercent,
  }).map(({ day, dailyPnlPercent, drawdownPercent }) => ({
    id: 1,
    user_id: 1,
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    net_worth_cny: '1000000',
    daily_pnl: String(dailyPnlPercent * 10000),
    daily_pnl_percent: dailyPnlPercent,
    drawdown_percent: drawdownPercent,
    leverage_ratio: '1.0',
    high_water_mark: '1000000',
    created_at: new Date().toISOString(),
  } as DashboardSnapshot));
};

// Generate history data for a specific month
const monthHistory = (month: number, count: number = 20): fc.Arbitrary<DashboardSnapshot[]> => {
  return fc.array(dashboardSnapshot(month), { minLength: count, maxLength: count });
};

// Generate full year history
const yearHistory = (): fc.Arbitrary<DashboardSnapshot[]> => {
  return fc.tuple(
    ...Array.from({ length: 12 }, (_, i) => monthHistory(i + 1, 20))
  ).map(months => months.flat());
};

// ============ Property 16: Seasonal Risk Detection ============
describe('Feature: risk-control-2026, Property 16: Seasonal Risk Detection', () => {
  
  it('should identify weak months when average return is negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 10, max: 30 }),
        (targetMonth, dayCount) => {
          // Create history with negative returns for target month
          const history: DashboardSnapshot[] = [];
          
          // Add negative return days for target month
          for (let i = 0; i < dayCount; i++) {
            history.push({
              id: i,
              user_id: 1,
              date: `2024-${String(targetMonth).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
              net_worth_cny: '1000000',
              daily_pnl: '-1000',
              daily_pnl_percent: -0.5, // Negative return
              drawdown_percent: -2,
              leverage_ratio: '1.0',
              high_water_mark: '1000000',
              created_at: new Date().toISOString(),
            } as DashboardSnapshot);
          }
          
          // Add positive return days for other months
          for (let month = 1; month <= 12; month++) {
            if (month === targetMonth) continue;
            for (let i = 0; i < 10; i++) {
              history.push({
                id: 100 + month * 10 + i,
                user_id: 1,
                date: `2024-${String(month).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
                net_worth_cny: '1000000',
                daily_pnl: '1000',
                daily_pnl_percent: 0.5, // Positive return
                drawdown_percent: 0,
                leverage_ratio: '1.0',
                high_water_mark: '1000000',
                created_at: new Date().toISOString(),
              } as DashboardSnapshot);
            }
          }
          
          const performance = analyzeSeasonalPerformance(history);
          const monthStats = performance.monthlyStats.find(s => s.month === targetMonth);
          
          // Month with negative average return should be identified as weak
          expect(monthStats).toBeDefined();
          expect(monthStats!.avgReturn).toBeLessThan(0);
          expect(performance.weakMonths).toContain(targetMonth);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should identify strong months when average return significantly exceeds overall average', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        (targetMonth) => {
          const history: DashboardSnapshot[] = [];
          
          // Add very high return days for target month
          for (let i = 0; i < 20; i++) {
            history.push({
              id: i,
              user_id: 1,
              date: `2024-${String(targetMonth).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
              net_worth_cny: '1000000',
              daily_pnl: '5000',
              daily_pnl_percent: 2.0, // High positive return
              drawdown_percent: 0,
              leverage_ratio: '1.0',
              high_water_mark: '1000000',
              created_at: new Date().toISOString(),
            } as DashboardSnapshot);
          }
          
          // Add moderate return days for other months
          for (let month = 1; month <= 12; month++) {
            if (month === targetMonth) continue;
            for (let i = 0; i < 10; i++) {
              history.push({
                id: 100 + month * 10 + i,
                user_id: 1,
                date: `2024-${String(month).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
                net_worth_cny: '1000000',
                daily_pnl: '500',
                daily_pnl_percent: 0.3, // Moderate return
                drawdown_percent: 0,
                leverage_ratio: '1.0',
                high_water_mark: '1000000',
                created_at: new Date().toISOString(),
              } as DashboardSnapshot);
            }
          }
          
          const performance = analyzeSeasonalPerformance(history);
          const monthStats = performance.monthlyStats.find(s => s.month === targetMonth);
          
          // Month with significantly higher return should be identified as strong
          expect(monthStats).toBeDefined();
          expect(monthStats!.avgReturn).toBeGreaterThan(performance.overallAvgReturn);
          expect(performance.strongMonths).toContain(targetMonth);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should return high risk warning for weak months', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        (targetMonth) => {
          const history: DashboardSnapshot[] = [];
          
          // Create very poor performance for target month
          for (let i = 0; i < 30; i++) {
            history.push({
              id: i,
              user_id: 1,
              date: `2024-${String(targetMonth).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
              net_worth_cny: '1000000',
              daily_pnl: '-2000',
              daily_pnl_percent: -0.5, // Negative return
              drawdown_percent: -15, // High drawdown
              leverage_ratio: '1.0',
              high_water_mark: '1000000',
              created_at: new Date().toISOString(),
            } as DashboardSnapshot);
          }
          
          // Add some data for other months
          for (let month = 1; month <= 12; month++) {
            if (month === targetMonth) continue;
            for (let i = 0; i < 10; i++) {
              history.push({
                id: 100 + month * 10 + i,
                user_id: 1,
                date: `2024-${String(month).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
                net_worth_cny: '1000000',
                daily_pnl: '1000',
                daily_pnl_percent: 0.5,
                drawdown_percent: 0,
                leverage_ratio: '1.0',
                high_water_mark: '1000000',
                created_at: new Date().toISOString(),
              } as DashboardSnapshot);
            }
          }
          
          const warning = getSeasonalRiskWarning(targetMonth, history);
          
          expect(warning.hasWarning).toBe(true);
          expect(['medium', 'high']).toContain(warning.riskLevel);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should return low risk for months with good historical performance', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        (targetMonth) => {
          const history: DashboardSnapshot[] = [];
          
          // Create good performance for target month
          for (let i = 0; i < 30; i++) {
            history.push({
              id: i,
              user_id: 1,
              date: `2024-${String(targetMonth).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
              net_worth_cny: '1000000',
              daily_pnl: '2000',
              daily_pnl_percent: 0.8, // Good positive return
              drawdown_percent: -1, // Low drawdown
              leverage_ratio: '1.0',
              high_water_mark: '1000000',
              created_at: new Date().toISOString(),
            } as DashboardSnapshot);
          }
          
          // Add similar data for other months
          for (let month = 1; month <= 12; month++) {
            if (month === targetMonth) continue;
            for (let i = 0; i < 10; i++) {
              history.push({
                id: 100 + month * 10 + i,
                user_id: 1,
                date: `2024-${String(month).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
                net_worth_cny: '1000000',
                daily_pnl: '1000',
                daily_pnl_percent: 0.5,
                drawdown_percent: -1,
                leverage_ratio: '1.0',
                high_water_mark: '1000000',
                created_at: new Date().toISOString(),
              } as DashboardSnapshot);
            }
          }
          
          const warning = getSeasonalRiskWarning(targetMonth, history);
          
          expect(warning.riskLevel).toBe('low');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle insufficient data gracefully', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 0, max: 29 }),
        (month, dataPoints) => {
          const history: DashboardSnapshot[] = [];
          
          // Create minimal data
          for (let i = 0; i < dataPoints; i++) {
            history.push({
              id: i,
              user_id: 1,
              date: `2024-${String(month).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
              net_worth_cny: '1000000',
              daily_pnl: '1000',
              daily_pnl_percent: 0.5,
              drawdown_percent: 0,
              leverage_ratio: '1.0',
              high_water_mark: '1000000',
              created_at: new Date().toISOString(),
            } as DashboardSnapshot);
          }
          
          const warning = getSeasonalRiskWarning(month, history);
          
          // Should not crash and should return valid structure
          expect(warning).toBeDefined();
          expect(warning.currentMonth).toBe(month);
          expect(['low', 'medium', 'high']).toContain(warning.riskLevel);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should correctly calculate win rate', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 5, max: 20 }),
        fc.integer({ min: 5, max: 20 }),
        (month, winDays, loseDays) => {
          const history: DashboardSnapshot[] = [];
          
          // Add winning days
          for (let i = 0; i < winDays; i++) {
            history.push({
              id: i,
              user_id: 1,
              date: `2024-${String(month).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
              net_worth_cny: '1000000',
              daily_pnl: '1000',
              daily_pnl_percent: 0.5, // Positive
              drawdown_percent: 0,
              leverage_ratio: '1.0',
              high_water_mark: '1000000',
              created_at: new Date().toISOString(),
            } as DashboardSnapshot);
          }
          
          // Add losing days (different dates)
          for (let i = 0; i < loseDays; i++) {
            history.push({
              id: winDays + i,
              user_id: 1,
              date: `2023-${String(month).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
              net_worth_cny: '1000000',
              daily_pnl: '-1000',
              daily_pnl_percent: -0.5, // Negative
              drawdown_percent: -2,
              leverage_ratio: '1.0',
              high_water_mark: '1000000',
              created_at: new Date().toISOString(),
            } as DashboardSnapshot);
          }
          
          const stats = getMonthlyStats(history);
          const monthStats = stats.find(s => s.month === month);
          
          expect(monthStats).toBeDefined();
          const expectedWinRate = (winDays / (winDays + loseDays)) * 100;
          expect(monthStats!.winRate).toBeCloseTo(expectedWinRate, 1);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return 12 monthly stats entries', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 12 }), { minLength: 0, maxLength: 50 }),
        (months) => {
          const history: DashboardSnapshot[] = months.map((month, i) => ({
            id: i,
            user_id: 1,
            date: `2024-${String(month).padStart(2, '0')}-15`,
            net_worth_cny: '1000000',
            daily_pnl: '1000',
            daily_pnl_percent: 0.5,
            drawdown_percent: 0,
            leverage_ratio: '1.0',
            high_water_mark: '1000000',
            created_at: new Date().toISOString(),
          } as DashboardSnapshot));
          
          const performance = analyzeSeasonalPerformance(history);
          
          // Should always return 12 months
          expect(performance.monthlyStats).toHaveLength(12);
          
          // Each month should be represented
          for (let m = 1; m <= 12; m++) {
            const monthStat = performance.monthlyStats.find(s => s.month === m);
            expect(monthStat).toBeDefined();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
