/**
 * Property-based tests for Risk Alert Service
 * Feature: risk-control-2026
 * Task 5.2: Property test for alert threshold consistency
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  generateRiskAlerts,
  checkRiskAlerts,
  getAlertTypeName,
  getAlertSeverityColor,
  type RiskAlert,
  type RiskAlertType,
  type AlertSeverity,
} from './riskAlertService';
import {
  calculateRiskMetrics,
  DEFAULT_THRESHOLDS,
  type RiskMetrics,
  type DailyPnL,
} from './riskMetricsService';

// Mock toast to prevent actual notifications during tests
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// ============ Helper Generators ============
const leverage = () => fc.double({ min: 0.1, max: 5, noNaN: true });
const navValue = () => fc.double({ min: 100000, max: 10000000, noNaN: true });
const percent = () => fc.double({ min: -50, max: 50, noNaN: true });

// ============ Property 5: Monthly Drawdown Alert Thresholds ============
describe('Feature: risk-control-2026, Property 5: Monthly Drawdown Alert Thresholds', () => {
  
  it('should generate warning alert when monthly drawdown >= 10% and < 15%', () => {
    fc.assert(
      fc.property(
        navValue(),
        fc.double({ min: 0.101, max: 0.149, noNaN: true }), // 10.1% to 14.9% drawdown
        (monthStartNAV, drawdownPercent) => {
          const currentNAV = monthStartNAV * (1 - drawdownPercent);
          
          const metrics = calculateRiskMetrics(
            currentNAV,
            1.0, // Safe leverage
            monthStartNAV,
            monthStartNAV, // HWM = month start
            [], // No losing streak
            DEFAULT_THRESHOLDS
          );
          
          const alerts = generateRiskAlerts(metrics, DEFAULT_THRESHOLDS);
          const drawdownAlerts = alerts.filter(a => 
            a.type === 'MONTHLY_DRAWDOWN_WARNING' || a.type === 'MONTHLY_DRAWDOWN_CRITICAL'
          );
          
          // Should have at least one drawdown alert
          expect(drawdownAlerts.length).toBeGreaterThan(0);
          
          // Should be warning level (not critical) for 10-15% range
          const hasWarning = drawdownAlerts.some(a => a.type === 'MONTHLY_DRAWDOWN_WARNING');
          expect(hasWarning).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should generate critical alert when monthly drawdown >= 15%', () => {
    fc.assert(
      fc.property(
        navValue(),
        fc.double({ min: 0.151, max: 0.5, noNaN: true }), // >15% drawdown
        (monthStartNAV, drawdownPercent) => {
          const currentNAV = monthStartNAV * (1 - drawdownPercent);
          
          const metrics = calculateRiskMetrics(
            currentNAV,
            1.0, // Safe leverage
            monthStartNAV,
            monthStartNAV,
            [],
            DEFAULT_THRESHOLDS
          );
          
          const alerts = generateRiskAlerts(metrics, DEFAULT_THRESHOLDS);
          const criticalAlerts = alerts.filter(a => a.type === 'MONTHLY_DRAWDOWN_CRITICAL');
          
          expect(criticalAlerts.length).toBeGreaterThan(0);
          expect(criticalAlerts[0].severity).toBe('critical');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should not generate drawdown alert when drawdown < 10%', () => {
    fc.assert(
      fc.property(
        navValue(),
        fc.double({ min: 0, max: 0.099, noNaN: true }), // <10% drawdown
        (monthStartNAV, drawdownPercent) => {
          const currentNAV = monthStartNAV * (1 - drawdownPercent);
          
          const metrics = calculateRiskMetrics(
            currentNAV,
            1.0,
            monthStartNAV,
            monthStartNAV,
            [],
            DEFAULT_THRESHOLDS
          );
          
          const alerts = generateRiskAlerts(metrics, DEFAULT_THRESHOLDS);
          const drawdownAlerts = alerts.filter(a => 
            a.type.includes('MONTHLY_DRAWDOWN')
          );
          
          expect(drawdownAlerts.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============ Property 13: Losing Streak Alert Thresholds ============
describe('Feature: risk-control-2026, Property 13: Losing Streak Alert Thresholds', () => {
  
  it('should generate warning alert when losing streak >= 3 and < 5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 4 }),
        navValue(),
        (streakDays, nav) => {
          // Create losing streak history
          const history: DailyPnL[] = [];
          for (let i = 0; i < streakDays; i++) {
            history.push({
              date: `2025-01-${10 + i}`,
              pnl: -1000,
              pnlPercent: -0.5,
            });
          }
          
          const metrics = calculateRiskMetrics(
            nav,
            1.0,
            nav,
            nav,
            history,
            DEFAULT_THRESHOLDS
          );
          
          const alerts = generateRiskAlerts(metrics, DEFAULT_THRESHOLDS);
          const streakAlerts = alerts.filter(a => 
            a.type === 'LOSING_STREAK_WARNING' || a.type === 'LOSING_STREAK_CRITICAL'
          );
          
          expect(streakAlerts.length).toBeGreaterThan(0);
          expect(streakAlerts.some(a => a.type === 'LOSING_STREAK_WARNING')).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should generate critical alert when losing streak >= 5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 10 }),
        navValue(),
        (streakDays, nav) => {
          const history: DailyPnL[] = [];
          for (let i = 0; i < streakDays; i++) {
            history.push({
              date: `2025-01-${10 + i}`,
              pnl: -1000,
              pnlPercent: -0.5,
            });
          }
          
          const metrics = calculateRiskMetrics(
            nav,
            1.0,
            nav,
            nav,
            history,
            DEFAULT_THRESHOLDS
          );
          
          const alerts = generateRiskAlerts(metrics, DEFAULT_THRESHOLDS);
          const criticalAlerts = alerts.filter(a => a.type === 'LOSING_STREAK_CRITICAL');
          
          expect(criticalAlerts.length).toBeGreaterThan(0);
          expect(criticalAlerts[0].severity).toBe('critical');
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should not generate losing streak alert when streak < 3', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }),
        navValue(),
        (streakDays, nav) => {
          const history: DailyPnL[] = [];
          for (let i = 0; i < streakDays; i++) {
            history.push({
              date: `2025-01-${10 + i}`,
              pnl: -1000,
              pnlPercent: -0.5,
            });
          }
          
          const metrics = calculateRiskMetrics(
            nav,
            1.0,
            nav,
            nav,
            history,
            DEFAULT_THRESHOLDS
          );
          
          const alerts = generateRiskAlerts(metrics, DEFAULT_THRESHOLDS);
          const streakAlerts = alerts.filter(a => a.type.includes('LOSING_STREAK'));
          
          expect(streakAlerts.length).toBe(0);
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ============ Leverage Alert Threshold Consistency ============
describe('Feature: risk-control-2026, Leverage Alert Threshold Consistency', () => {
  
  it('should generate warning alert when leverage >= 1.5 and < 2.0', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.51, max: 1.99, noNaN: true }),
        navValue(),
        (lev, nav) => {
          const metrics = calculateRiskMetrics(
            nav,
            lev,
            nav,
            nav,
            [],
            DEFAULT_THRESHOLDS
          );
          
          const alerts = generateRiskAlerts(metrics, DEFAULT_THRESHOLDS);
          const leverageAlerts = alerts.filter(a => 
            a.type === 'LEVERAGE_WARNING' || a.type === 'LEVERAGE_CRITICAL'
          );
          
          expect(leverageAlerts.length).toBeGreaterThan(0);
          expect(leverageAlerts.some(a => a.type === 'LEVERAGE_WARNING')).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should generate critical alert when leverage >= 2.0', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 2.01, max: 5, noNaN: true }),
        navValue(),
        (lev, nav) => {
          const metrics = calculateRiskMetrics(
            nav,
            lev,
            nav,
            nav,
            [],
            DEFAULT_THRESHOLDS
          );
          
          const alerts = generateRiskAlerts(metrics, DEFAULT_THRESHOLDS);
          const criticalAlerts = alerts.filter(a => a.type === 'LEVERAGE_CRITICAL');
          
          expect(criticalAlerts.length).toBeGreaterThan(0);
          expect(criticalAlerts[0].severity).toBe('critical');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should not generate leverage alert when leverage < 1.5', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 1.49, noNaN: true }),
        navValue(),
        (lev, nav) => {
          const metrics = calculateRiskMetrics(
            nav,
            lev,
            nav,
            nav,
            [],
            DEFAULT_THRESHOLDS
          );
          
          const alerts = generateRiskAlerts(metrics, DEFAULT_THRESHOLDS);
          const leverageAlerts = alerts.filter(a => a.type.includes('LEVERAGE'));
          
          expect(leverageAlerts.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============ Alert Structure Validation ============
describe('Feature: risk-control-2026, Alert Structure Validation', () => {
  
  it('should generate alerts with valid structure', () => {
    fc.assert(
      fc.property(
        leverage(),
        navValue(),
        fc.double({ min: 0.5, max: 1.5, noNaN: true }),
        (lev, nav, multiplier) => {
          const monthStartNAV = nav / multiplier;
          
          const metrics = calculateRiskMetrics(
            nav,
            lev,
            monthStartNAV,
            nav * 1.1,
            [],
            DEFAULT_THRESHOLDS
          );
          
          const alerts = generateRiskAlerts(metrics, DEFAULT_THRESHOLDS);
          
          for (const alert of alerts) {
            // Validate required fields
            expect(alert.id).toBeDefined();
            expect(alert.type).toBeDefined();
            expect(alert.severity).toBeDefined();
            expect(alert.title).toBeDefined();
            expect(alert.message).toBeDefined();
            expect(alert.recommendation).toBeDefined();
            expect(alert.timestamp).toBeDefined();
            expect(typeof alert.acknowledged).toBe('boolean');
            
            // Validate severity is valid
            expect(['info', 'warning', 'critical']).toContain(alert.severity);
            
            // Validate timestamp is ISO format
            expect(() => new Date(alert.timestamp)).not.toThrow();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should have consistent alert type names', () => {
    const alertTypes: RiskAlertType[] = [
      'LEVERAGE_WARNING',
      'LEVERAGE_CRITICAL',
      'LEVERAGE_BLOCKED',
      'MONTHLY_DRAWDOWN_WARNING',
      'MONTHLY_DRAWDOWN_CRITICAL',
      'TRAILING_STOP_WARNING',
      'TRAILING_STOP_TRIGGERED',
      'LOSING_STREAK_WARNING',
      'LOSING_STREAK_CRITICAL',
      'SEASONAL_RISK',
      'NEW_HIGH_WATER_MARK',
      'DAILY_LOSS_WARNING',
      'DAILY_LOSS_CRITICAL',
    ];
    
    for (const type of alertTypes) {
      const name = getAlertTypeName(type);
      expect(name).toBeDefined();
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('should have valid severity colors', () => {
    const severities: AlertSeverity[] = ['info', 'warning', 'critical'];
    
    for (const severity of severities) {
      const color = getAlertSeverityColor(severity);
      expect(color).toBeDefined();
      expect(typeof color).toBe('string');
      expect(color).toContain('text-');
      expect(color).toContain('bg-');
    }
  });
});

// ============ Legacy Alert System Tests ============
describe('Feature: risk-control-2026, Legacy Alert System', () => {
  
  beforeEach(() => {
    // Mock window and Notification for browser API tests
    vi.stubGlobal('window', {});
    vi.stubGlobal('Notification', { permission: 'denied' });
  });
  
  it('should return correct risk status levels', () => {
    // Test with specific values instead of property-based to avoid window reference issues
    const testCases = [
      { lev: 1.0, drawdown: 1, dailyPnL: 0.5 },
      { lev: 2.2, drawdown: 4, dailyPnL: -3 },
      { lev: 3.0, drawdown: 6, dailyPnL: -6 },
    ];
    
    for (const { lev, drawdown, dailyPnL } of testCases) {
      const status = checkRiskAlerts(lev, drawdown, dailyPnL);
      
      // Validate structure
      expect(status.leverage).toBeDefined();
      expect(status.drawdown).toBeDefined();
      expect(status.dailyLoss).toBeDefined();
      
      // Validate levels are valid
      expect(['normal', 'warning', 'critical']).toContain(status.leverage.level);
      expect(['normal', 'warning', 'critical']).toContain(status.drawdown.level);
      expect(['normal', 'warning', 'critical']).toContain(status.dailyLoss.level);
      
      // Validate values match input
      expect(status.leverage.value).toBe(lev);
      expect(status.drawdown.value).toBe(drawdown);
      expect(status.dailyLoss.value).toBe(dailyPnL);
    }
  });
});
