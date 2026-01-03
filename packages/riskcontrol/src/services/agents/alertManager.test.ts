/**
 * Alert Manager Property-Based Tests
 *
 * Tests for the AgentAlertManager using property-based testing with fast-check.
 * Validates Properties 29, 30, 31, and 32 from the design document.
 *
 * @module agents/alertManager.test
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for property definitions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  AgentAlertManager,
  createAlertManager,
  createAlertManagerWithConfig,
  convertToRiskAlert,
  sendAgentAlert,
  shouldSendEmail,
  formatAlertForToast,
} from './alertManager';
import type {
  AgentResult,
  AgentAlertEvent,
  AlertTriggerConfig,
  AlertSeverity,
  AlertType,
  RiskLevel,
} from './types';
import { DEFAULT_ALERT_TRIGGERS } from './types';

// =============================================================================
// Mock riskAlertService
// =============================================================================

vi.mock('../riskAlertService', () => ({
  triggerRiskAlerts: vi.fn().mockResolvedValue(undefined),
}));

import { triggerRiskAlerts as mockTriggerRiskAlerts } from '../riskAlertService';

// =============================================================================
// Test Utilities and Arbitraries
// =============================================================================


/**
 * Create a mock AgentResult for Risk Analyst
 */
function createRiskAnalystResult(
  drawdown: number,
  leverage: number,
  status: 'success' | 'partial' | 'failed' = 'success'
): AgentResult {
  return {
    agentId: 'risk_analyst',
    status,
    data: {
      drawdown_analysis: { current_drawdown: drawdown },
      leverage_assessment: { current_leverage: leverage },
    },
    summary: `Risk analysis: drawdown ${drawdown}%, leverage ${leverage}x`,
    metadata: {
      executionTimeMs: 100,
      tokensUsed: 50,
      dataSources: ['portfolio_data'],
    },
  };
}

/**
 * Create a mock AgentResult for Market Analyst
 */
function createMarketAnalystResult(
  sentimentScore: number,
  status: 'success' | 'partial' | 'failed' = 'success'
): AgentResult {
  return {
    agentId: 'market_analyst',
    status,
    data: {
      sentiment_score: sentimentScore,
      news_summary: 'Market news summary',
      market_cycle: 'expansion',
    },
    summary: `Market sentiment: ${sentimentScore}`,
    metadata: {
      executionTimeMs: 150,
      tokensUsed: 75,
      dataSources: ['news_api'],
    },
  };
}

/**
 * Create a mock AgentResult for Advisor
 */
function createAdvisorResult(
  riskLevel: RiskLevel,
  status: 'success' | 'partial' | 'failed' = 'success'
): AgentResult {
  return {
    agentId: 'advisor',
    status,
    data: {
      risk_level: riskLevel,
      action_items: ['Review portfolio', 'Consider rebalancing'],
      action_plan: 'Reduce exposure to high-risk positions',
      detailed_analysis: 'Comprehensive analysis details',
    },
    summary: `Risk level: ${riskLevel}`,
    metadata: {
      executionTimeMs: 200,
      tokensUsed: 100,
      dataSources: ['all_agents'],
    },
  };
}


// =============================================================================
// Arbitraries for Property-Based Testing
// =============================================================================

/**
 * Arbitrary for drawdown values that exceed threshold (> 15%)
 */
const highDrawdownArbitrary = fc.double({ min: 15.01, max: 100, noNaN: true });

/**
 * Arbitrary for drawdown values below threshold (<= 15%)
 */
const lowDrawdownArbitrary = fc.double({ min: 0, max: 15, noNaN: true });

/**
 * Arbitrary for leverage values that exceed threshold (> 2.5x)
 */
const highLeverageArbitrary = fc.double({ min: 2.51, max: 10, noNaN: true });

/**
 * Arbitrary for leverage values below threshold (<= 2.5x)
 */
const lowLeverageArbitrary = fc.double({ min: 1, max: 2.5, noNaN: true });

/**
 * Arbitrary for sentiment scores below threshold (< -0.5)
 */
const negativeSentimentArbitrary = fc.double({ min: -1, max: -0.51, noNaN: true });

/**
 * Arbitrary for sentiment scores above threshold (>= -0.5)
 */
const normalSentimentArbitrary = fc.double({ min: -0.5, max: 1, noNaN: true });

/**
 * Arbitrary for risk levels
 */
const riskLevelArbitrary = fc.constantFrom<RiskLevel>('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

/**
 * Arbitrary for non-critical risk levels
 */
const nonCriticalRiskLevelArbitrary = fc.constantFrom<RiskLevel>('LOW', 'MEDIUM', 'HIGH');

/**
 * Arbitrary for alert types
 */
const alertTypeArbitrary = fc.constantFrom<AlertType>(
  'RISK_LEVEL',
  'DRAWDOWN',
  'LEVERAGE',
  'SENTIMENT',
  'CONCENTRATION'
);

/**
 * Arbitrary for alert severity
 */
const alertSeverityArbitrary = fc.constantFrom<AlertSeverity>('info', 'warning', 'critical');


// =============================================================================
// Property 29: Alert Trigger Thresholds
// =============================================================================

describe('Property 29: Alert Trigger Thresholds', () => {
  /**
   * Feature: multi-agent-analysis, Property 29: Alert Trigger Thresholds
   *
   * *For any* Risk_Analyst result with drawdown > 15% OR leverage > 2.5x,
   * OR Market_Analyst result with sentiment_score < -0.5,
   * OR Advisor result with risk_level = 'CRITICAL',
   * the AgentAlertManager SHALL emit at least one alert event.
   *
   * **Validates: Requirements 10.1, 10.2, 10.3**
   */

  let alertManager: AgentAlertManager;

  beforeEach(() => {
    alertManager = createAlertManager();
    alertManager.clearCooldowns();
  });

  describe('Risk Analyst - Drawdown Threshold', () => {
    it('should emit alert for any drawdown > 15%', async () => {
      await fc.assert(
        fc.asyncProperty(highDrawdownArbitrary, async (drawdown) => {
          alertManager.clearCooldowns();
          const result = createRiskAnalystResult(drawdown, 1.0);
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

          expect(alerts.length).toBeGreaterThanOrEqual(1);
          expect(alerts.some((a) => a.alertType === 'DRAWDOWN')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should NOT emit drawdown alert for drawdown <= 15%', async () => {
      await fc.assert(
        fc.asyncProperty(lowDrawdownArbitrary, async (drawdown) => {
          alertManager.clearCooldowns();
          const result = createRiskAnalystResult(drawdown, 1.0);
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

          expect(alerts.filter((a) => a.alertType === 'DRAWDOWN')).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Risk Analyst - Leverage Threshold', () => {
    it('should emit alert for any leverage > 2.5x', async () => {
      await fc.assert(
        fc.asyncProperty(highLeverageArbitrary, async (leverage) => {
          alertManager.clearCooldowns();
          const result = createRiskAnalystResult(0, leverage);
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

          expect(alerts.length).toBeGreaterThanOrEqual(1);
          expect(alerts.some((a) => a.alertType === 'LEVERAGE')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should NOT emit leverage alert for leverage <= 2.5x', async () => {
      await fc.assert(
        fc.asyncProperty(lowLeverageArbitrary, async (leverage) => {
          alertManager.clearCooldowns();
          const result = createRiskAnalystResult(0, leverage);
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

          expect(alerts.filter((a) => a.alertType === 'LEVERAGE')).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });
  });


  describe('Market Analyst - Sentiment Threshold', () => {
    it('should emit alert for any sentiment_score < -0.5', async () => {
      await fc.assert(
        fc.asyncProperty(negativeSentimentArbitrary, async (sentiment) => {
          alertManager.clearCooldowns();
          const result = createMarketAnalystResult(sentiment);
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

          expect(alerts.length).toBeGreaterThanOrEqual(1);
          expect(alerts.some((a) => a.alertType === 'SENTIMENT')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should NOT emit sentiment alert for sentiment_score >= -0.5', async () => {
      await fc.assert(
        fc.asyncProperty(normalSentimentArbitrary, async (sentiment) => {
          alertManager.clearCooldowns();
          const result = createMarketAnalystResult(sentiment);
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

          expect(alerts.filter((a) => a.alertType === 'SENTIMENT')).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Advisor - Critical Risk Level', () => {
    it('should emit alert for CRITICAL risk level', async () => {
      alertManager.clearCooldowns();
      const result = createAdvisorResult('CRITICAL');
      const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts.some((a) => a.alertType === 'RISK_LEVEL')).toBe(true);
    });

    it('should NOT emit risk level alert for non-CRITICAL levels', async () => {
      await fc.assert(
        fc.asyncProperty(nonCriticalRiskLevelArbitrary, async (riskLevel) => {
          alertManager.clearCooldowns();
          const result = createAdvisorResult(riskLevel);
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

          expect(alerts.filter((a) => a.alertType === 'RISK_LEVEL')).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined Threshold Triggers', () => {
    it('should emit multiple alerts when multiple thresholds exceeded', async () => {
      await fc.assert(
        fc.asyncProperty(
          highDrawdownArbitrary,
          highLeverageArbitrary,
          async (drawdown, leverage) => {
            alertManager.clearCooldowns();
            const result = createRiskAnalystResult(drawdown, leverage);
            const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

            // Should have both DRAWDOWN and LEVERAGE alerts
            expect(alerts.length).toBeGreaterThanOrEqual(2);
            expect(alerts.some((a) => a.alertType === 'DRAWDOWN')).toBe(true);
            expect(alerts.some((a) => a.alertType === 'LEVERAGE')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Failed Agent Results', () => {
    it('should NOT emit alerts for failed agent results', async () => {
      await fc.assert(
        fc.asyncProperty(highDrawdownArbitrary, highLeverageArbitrary, async (drawdown, leverage) => {
          alertManager.clearCooldowns();
          const result = createRiskAnalystResult(drawdown, leverage, 'failed');
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

          expect(alerts).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });
  });
});


// =============================================================================
// Property 30: Alert Content Completeness
// =============================================================================

describe('Property 30: Alert Content Completeness', () => {
  /**
   * Feature: multi-agent-analysis, Property 30: Alert Content Completeness
   *
   * *For any* emitted AgentAlertEvent, it SHALL contain non-empty sourceAgent,
   * alertType, title, message, recommendation fields, and the data field SHALL
   * contain relevant metrics from the triggering agent's analysis.
   *
   * **Validates: Requirements 10.5, 10.7**
   */

  let alertManager: AgentAlertManager;

  beforeEach(() => {
    alertManager = createAlertManager();
    alertManager.clearCooldowns();
  });

  describe('Drawdown Alert Content', () => {
    it('should have complete content for any drawdown alert', async () => {
      await fc.assert(
        fc.asyncProperty(highDrawdownArbitrary, async (drawdown) => {
          alertManager.clearCooldowns();
          const result = createRiskAnalystResult(drawdown, 1.0);
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
          const drawdownAlert = alerts.find((a) => a.alertType === 'DRAWDOWN');

          expect(drawdownAlert).toBeDefined();
          if (drawdownAlert) {
            // Required fields must be non-empty
            expect(drawdownAlert.sourceAgent).toBe('risk_analyst');
            expect(drawdownAlert.sourceAgent.length).toBeGreaterThan(0);
            expect(drawdownAlert.alertType).toBe('DRAWDOWN');
            expect(drawdownAlert.title.length).toBeGreaterThan(0);
            expect(drawdownAlert.message.length).toBeGreaterThan(0);
            expect(drawdownAlert.recommendation.length).toBeGreaterThan(0);
            expect(drawdownAlert.timestamp.length).toBeGreaterThan(0);

            // Data should contain relevant metrics
            expect(drawdownAlert.data).toHaveProperty('currentDrawdown');
            expect(drawdownAlert.data).toHaveProperty('threshold');
            expect(drawdownAlert.data.currentDrawdown).toBe(drawdown);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Leverage Alert Content', () => {
    it('should have complete content for any leverage alert', async () => {
      await fc.assert(
        fc.asyncProperty(highLeverageArbitrary, async (leverage) => {
          alertManager.clearCooldowns();
          const result = createRiskAnalystResult(0, leverage);
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
          const leverageAlert = alerts.find((a) => a.alertType === 'LEVERAGE');

          expect(leverageAlert).toBeDefined();
          if (leverageAlert) {
            // Required fields must be non-empty
            expect(leverageAlert.sourceAgent).toBe('risk_analyst');
            expect(leverageAlert.alertType).toBe('LEVERAGE');
            expect(leverageAlert.title.length).toBeGreaterThan(0);
            expect(leverageAlert.message.length).toBeGreaterThan(0);
            expect(leverageAlert.recommendation.length).toBeGreaterThan(0);
            expect(leverageAlert.timestamp.length).toBeGreaterThan(0);

            // Data should contain relevant metrics
            expect(leverageAlert.data).toHaveProperty('currentLeverage');
            expect(leverageAlert.data).toHaveProperty('threshold');
            expect(leverageAlert.data.currentLeverage).toBe(leverage);
          }
        }),
        { numRuns: 100 }
      );
    });
  });


  describe('Sentiment Alert Content', () => {
    it('should have complete content for any sentiment alert', async () => {
      await fc.assert(
        fc.asyncProperty(negativeSentimentArbitrary, async (sentiment) => {
          alertManager.clearCooldowns();
          const result = createMarketAnalystResult(sentiment);
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
          const sentimentAlert = alerts.find((a) => a.alertType === 'SENTIMENT');

          expect(sentimentAlert).toBeDefined();
          if (sentimentAlert) {
            // Required fields must be non-empty
            expect(sentimentAlert.sourceAgent).toBe('market_analyst');
            expect(sentimentAlert.alertType).toBe('SENTIMENT');
            expect(sentimentAlert.title.length).toBeGreaterThan(0);
            expect(sentimentAlert.message.length).toBeGreaterThan(0);
            expect(sentimentAlert.recommendation.length).toBeGreaterThan(0);
            expect(sentimentAlert.timestamp.length).toBeGreaterThan(0);

            // Data should contain relevant metrics
            expect(sentimentAlert.data).toHaveProperty('sentimentScore');
            expect(sentimentAlert.data).toHaveProperty('threshold');
            expect(sentimentAlert.data.sentimentScore).toBe(sentiment);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Risk Level Alert Content', () => {
    it('should have complete content for CRITICAL risk level alert', () => {
      alertManager.clearCooldowns();
      const result = createAdvisorResult('CRITICAL');
      const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
      const riskAlert = alerts.find((a) => a.alertType === 'RISK_LEVEL');

      expect(riskAlert).toBeDefined();
      if (riskAlert) {
        // Required fields must be non-empty
        expect(riskAlert.sourceAgent).toBe('advisor');
        expect(riskAlert.alertType).toBe('RISK_LEVEL');
        expect(riskAlert.title.length).toBeGreaterThan(0);
        expect(riskAlert.message.length).toBeGreaterThan(0);
        expect(riskAlert.recommendation.length).toBeGreaterThan(0);
        expect(riskAlert.timestamp.length).toBeGreaterThan(0);

        // Data should contain relevant metrics
        expect(riskAlert.data).toHaveProperty('riskLevel');
        expect(riskAlert.data.riskLevel).toBe('CRITICAL');
      }
    });
  });

  describe('Timestamp Validity', () => {
    it('should have valid ISO timestamp for any alert', async () => {
      await fc.assert(
        fc.asyncProperty(highDrawdownArbitrary, async (drawdown) => {
          alertManager.clearCooldowns();
          const result = createRiskAnalystResult(drawdown, 1.0);
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

          for (const alert of alerts) {
            // Timestamp should be valid ISO string
            const parsedDate = new Date(alert.timestamp);
            expect(parsedDate.toString()).not.toBe('Invalid Date');
            expect(alert.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Severity Assignment', () => {
    it('should assign critical severity for extreme drawdown (> 25%)', async () => {
      const extremeDrawdownArbitrary = fc.double({ min: 25.01, max: 100, noNaN: true });

      await fc.assert(
        fc.asyncProperty(extremeDrawdownArbitrary, async (drawdown) => {
          alertManager.clearCooldowns();
          const result = createRiskAnalystResult(drawdown, 1.0);
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
          const drawdownAlert = alerts.find((a) => a.alertType === 'DRAWDOWN');

          expect(drawdownAlert?.severity).toBe('critical');
        }),
        { numRuns: 100 }
      );
    });

    it('should assign critical severity for extreme leverage (> 3.0x)', async () => {
      const extremeLeverageArbitrary = fc.double({ min: 3.01, max: 10, noNaN: true });

      await fc.assert(
        fc.asyncProperty(extremeLeverageArbitrary, async (leverage) => {
          alertManager.clearCooldowns();
          const result = createRiskAnalystResult(0, leverage);
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
          const leverageAlert = alerts.find((a) => a.alertType === 'LEVERAGE');

          expect(leverageAlert?.severity).toBe('critical');
        }),
        { numRuns: 100 }
      );
    });

    it('should assign critical severity for extreme negative sentiment (< -0.7)', async () => {
      const extremeSentimentArbitrary = fc.double({ min: -1, max: -0.71, noNaN: true });

      await fc.assert(
        fc.asyncProperty(extremeSentimentArbitrary, async (sentiment) => {
          alertManager.clearCooldowns();
          const result = createMarketAnalystResult(sentiment);
          const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
          const sentimentAlert = alerts.find((a) => a.alertType === 'SENTIMENT');

          expect(sentimentAlert?.severity).toBe('critical');
        }),
        { numRuns: 100 }
      );
    });
  });
});


// =============================================================================
// Property 31: Alert Cooldown Enforcement
// =============================================================================

describe('Property 31: Alert Cooldown Enforcement', () => {
  /**
   * Feature: multi-agent-analysis, Property 31: Alert Cooldown Enforcement
   *
   * *For any* two alerts of the same type and severity emitted within 30 minutes,
   * only the first alert SHALL be delivered to notification channels.
   *
   * **Validates: Requirements 10.6**
   */

  let alertManager: AgentAlertManager;

  beforeEach(() => {
    vi.useFakeTimers();
    alertManager = createAlertManager();
    alertManager.clearCooldowns();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Same Alert Type Cooldown', () => {
    it('should block duplicate drawdown alerts within 30 minutes', async () => {
      await fc.assert(
        fc.asyncProperty(
          highDrawdownArbitrary,
          highDrawdownArbitrary,
          async (drawdown1, drawdown2) => {
            alertManager.clearCooldowns();

            // First alert should be emitted
            const result1 = createRiskAnalystResult(drawdown1, 1.0);
            const alerts1 = alertManager.checkAndEmitAlerts(result1);
            expect(alerts1.filter((a) => a.alertType === 'DRAWDOWN')).toHaveLength(1);

            // Advance time by 15 minutes (within cooldown)
            vi.advanceTimersByTime(15 * 60 * 1000);

            // Second alert should be blocked
            const result2 = createRiskAnalystResult(drawdown2, 1.0);
            const alerts2 = alertManager.checkAndEmitAlerts(result2);
            expect(alerts2.filter((a) => a.alertType === 'DRAWDOWN')).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should block duplicate leverage alerts within 30 minutes', async () => {
      await fc.assert(
        fc.asyncProperty(
          highLeverageArbitrary,
          highLeverageArbitrary,
          async (leverage1, leverage2) => {
            alertManager.clearCooldowns();

            // First alert should be emitted
            const result1 = createRiskAnalystResult(0, leverage1);
            const alerts1 = alertManager.checkAndEmitAlerts(result1);
            expect(alerts1.filter((a) => a.alertType === 'LEVERAGE')).toHaveLength(1);

            // Advance time by 20 minutes (within cooldown)
            vi.advanceTimersByTime(20 * 60 * 1000);

            // Second alert should be blocked
            const result2 = createRiskAnalystResult(0, leverage2);
            const alerts2 = alertManager.checkAndEmitAlerts(result2);
            expect(alerts2.filter((a) => a.alertType === 'LEVERAGE')).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should block duplicate sentiment alerts within 30 minutes', async () => {
      await fc.assert(
        fc.asyncProperty(
          negativeSentimentArbitrary,
          negativeSentimentArbitrary,
          async (sentiment1, sentiment2) => {
            alertManager.clearCooldowns();

            // First alert should be emitted
            const result1 = createMarketAnalystResult(sentiment1);
            const alerts1 = alertManager.checkAndEmitAlerts(result1);
            expect(alerts1.filter((a) => a.alertType === 'SENTIMENT')).toHaveLength(1);

            // Advance time by 10 minutes (within cooldown)
            vi.advanceTimersByTime(10 * 60 * 1000);

            // Second alert should be blocked
            const result2 = createMarketAnalystResult(sentiment2);
            const alerts2 = alertManager.checkAndEmitAlerts(result2);
            expect(alerts2.filter((a) => a.alertType === 'SENTIMENT')).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Cooldown Expiration', () => {
    it('should allow alerts after 30 minute cooldown expires', async () => {
      await fc.assert(
        fc.asyncProperty(
          highDrawdownArbitrary,
          highDrawdownArbitrary,
          async (drawdown1, drawdown2) => {
            alertManager.clearCooldowns();

            // First alert should be emitted
            const result1 = createRiskAnalystResult(drawdown1, 1.0);
            const alerts1 = alertManager.checkAndEmitAlerts(result1);
            expect(alerts1.filter((a) => a.alertType === 'DRAWDOWN')).toHaveLength(1);

            // Advance time by 31 minutes (past cooldown)
            vi.advanceTimersByTime(31 * 60 * 1000);

            // Second alert should be allowed
            const result2 = createRiskAnalystResult(drawdown2, 1.0);
            const alerts2 = alertManager.checkAndEmitAlerts(result2);
            expect(alerts2.filter((a) => a.alertType === 'DRAWDOWN')).toHaveLength(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track cooldown time correctly with getRemainingCooldown', async () => {
      await fc.assert(
        fc.asyncProperty(highDrawdownArbitrary, async (drawdown) => {
          alertManager.clearCooldowns();

          // Emit first alert
          const result = createRiskAnalystResult(drawdown, 1.0);
          alertManager.checkAndEmitAlerts(result);

          // Check remaining cooldown immediately
          const remaining = alertManager.getRemainingCooldown('DRAWDOWN', 'risk_analyst');
          expect(remaining).toBeGreaterThan(29 * 60 * 1000); // Should be close to 30 minutes
          expect(remaining).toBeLessThanOrEqual(30 * 60 * 1000);

          // Advance time by 10 minutes
          vi.advanceTimersByTime(10 * 60 * 1000);

          // Check remaining cooldown
          const remaining2 = alertManager.getRemainingCooldown('DRAWDOWN', 'risk_analyst');
          expect(remaining2).toBeGreaterThan(19 * 60 * 1000);
          expect(remaining2).toBeLessThanOrEqual(20 * 60 * 1000);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Different Alert Types Independence', () => {
    it('should allow different alert types simultaneously', async () => {
      await fc.assert(
        fc.asyncProperty(
          highDrawdownArbitrary,
          highLeverageArbitrary,
          async (drawdown, leverage) => {
            alertManager.clearCooldowns();

            // Emit drawdown alert
            const result1 = createRiskAnalystResult(drawdown, 1.0);
            const alerts1 = alertManager.checkAndEmitAlerts(result1);
            expect(alerts1.filter((a) => a.alertType === 'DRAWDOWN')).toHaveLength(1);

            // Advance time by 5 minutes
            vi.advanceTimersByTime(5 * 60 * 1000);

            // Leverage alert should still be allowed (different type)
            const result2 = createRiskAnalystResult(0, leverage);
            const alerts2 = alertManager.checkAndEmitAlerts(result2);
            expect(alerts2.filter((a) => a.alertType === 'LEVERAGE')).toHaveLength(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track cooldowns independently per alert type', async () => {
      await fc.assert(
        fc.asyncProperty(
          highDrawdownArbitrary,
          highLeverageArbitrary,
          negativeSentimentArbitrary,
          async (drawdown, leverage, sentiment) => {
            alertManager.clearCooldowns();

            // Emit all three alert types
            const riskResult = createRiskAnalystResult(drawdown, leverage);
            const marketResult = createMarketAnalystResult(sentiment);

            alertManager.checkAndEmitAlerts(riskResult);
            alertManager.checkAndEmitAlerts(marketResult);

            // All three should be in cooldown
            expect(alertManager.isInCooldown('DRAWDOWN', 'risk_analyst')).toBe(true);
            expect(alertManager.isInCooldown('LEVERAGE', 'risk_analyst')).toBe(true);
            expect(alertManager.isInCooldown('SENTIMENT', 'market_analyst')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Custom Cooldown Duration', () => {
    it('should respect custom cooldown duration', async () => {
      // Create manager with 5 minute cooldown
      const customManager = createAlertManagerWithConfig({}, 5 * 60 * 1000);

      await fc.assert(
        fc.asyncProperty(
          highDrawdownArbitrary,
          highDrawdownArbitrary,
          async (drawdown1, drawdown2) => {
            customManager.clearCooldowns();

            // First alert
            const result1 = createRiskAnalystResult(drawdown1, 1.0);
            const alerts1 = customManager.checkAndEmitAlerts(result1);
            expect(alerts1.filter((a) => a.alertType === 'DRAWDOWN')).toHaveLength(1);

            // Advance time by 6 minutes (past custom cooldown)
            vi.advanceTimersByTime(6 * 60 * 1000);

            // Second alert should be allowed
            const result2 = createRiskAnalystResult(drawdown2, 1.0);
            const alerts2 = customManager.checkAndEmitAlerts(result2);
            expect(alerts2.filter((a) => a.alertType === 'DRAWDOWN')).toHaveLength(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Skip Cooldown Option', () => {
    it('should bypass cooldown when skipCooldown option is true', async () => {
      await fc.assert(
        fc.asyncProperty(
          highDrawdownArbitrary,
          highDrawdownArbitrary,
          async (drawdown1, drawdown2) => {
            alertManager.clearCooldowns();

            // First alert
            const result1 = createRiskAnalystResult(drawdown1, 1.0);
            alertManager.checkAndEmitAlerts(result1);

            // Second alert with skipCooldown should be allowed
            const result2 = createRiskAnalystResult(drawdown2, 1.0);
            const alerts2 = alertManager.checkAndEmitAlerts(result2, { skipCooldown: true });
            expect(alerts2.filter((a) => a.alertType === 'DRAWDOWN')).toHaveLength(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// =============================================================================
// Property 32: Orchestrator Alert Event Emission
// =============================================================================

describe('Property 32: Orchestrator Alert Event Emission', () => {
  /**
   * Feature: multi-agent-analysis, Property 32: Orchestrator Alert Event Emission
   *
   * *For any* orchestrator execution where agents detect risks exceeding thresholds,
   * the orchestrator SHALL emit 'alert' events that can be subscribed to by UI components.
   *
   * **Validates: Requirements 10.8**
   */

  let alertManager: AgentAlertManager;
  let receivedAlerts: AgentAlertEvent[];

  beforeEach(() => {
    alertManager = createAlertManager();
    alertManager.clearCooldowns();
    receivedAlerts = [];
  });

  describe('Alert Subscription', () => {
    it('should emit alerts to subscribed callbacks for any threshold breach', async () => {
      await fc.assert(
        fc.asyncProperty(highDrawdownArbitrary, async (drawdown) => {
          alertManager.clearCooldowns();
          receivedAlerts = [];

          // Subscribe to alerts
          const unsubscribe = alertManager.onAlert((alert) => {
            receivedAlerts.push(alert);
          });

          // Trigger alert
          const result = createRiskAnalystResult(drawdown, 1.0);
          alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

          // Verify callback was called
          expect(receivedAlerts.length).toBeGreaterThanOrEqual(1);
          expect(receivedAlerts.some((a) => a.alertType === 'DRAWDOWN')).toBe(true);

          unsubscribe();
        }),
        { numRuns: 100 }
      );
    });

    it('should support multiple subscribers', async () => {
      await fc.assert(
        fc.asyncProperty(highLeverageArbitrary, async (leverage) => {
          alertManager.clearCooldowns();
          const alerts1: AgentAlertEvent[] = [];
          const alerts2: AgentAlertEvent[] = [];

          // Subscribe two callbacks
          const unsub1 = alertManager.onAlert((alert) => alerts1.push(alert));
          const unsub2 = alertManager.onAlert((alert) => alerts2.push(alert));

          // Trigger alert
          const result = createRiskAnalystResult(0, leverage);
          alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

          // Both callbacks should receive the alert
          expect(alerts1.length).toBeGreaterThanOrEqual(1);
          expect(alerts2.length).toBeGreaterThanOrEqual(1);
          expect(alerts1).toEqual(alerts2);

          unsub1();
          unsub2();
        }),
        { numRuns: 100 }
      );
    });

    it('should stop receiving alerts after unsubscribe', async () => {
      await fc.assert(
        fc.asyncProperty(
          highDrawdownArbitrary,
          highDrawdownArbitrary,
          async (drawdown1, drawdown2) => {
            alertManager.clearCooldowns();
            receivedAlerts = [];

            // Subscribe and then unsubscribe
            const unsubscribe = alertManager.onAlert((alert) => {
              receivedAlerts.push(alert);
            });

            // First alert should be received
            const result1 = createRiskAnalystResult(drawdown1, 1.0);
            alertManager.checkAndEmitAlerts(result1, { skipCooldown: true });
            const countAfterFirst = receivedAlerts.length;
            expect(countAfterFirst).toBeGreaterThanOrEqual(1);

            // Unsubscribe
            unsubscribe();

            // Second alert should NOT be received
            alertManager.clearCooldowns();
            const result2 = createRiskAnalystResult(drawdown2, 1.0);
            alertManager.checkAndEmitAlerts(result2, { skipCooldown: true });
            expect(receivedAlerts.length).toBe(countAfterFirst);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Alert Event Structure for UI', () => {
    it('should emit alerts with all fields needed for UI rendering', async () => {
      await fc.assert(
        fc.asyncProperty(
          highDrawdownArbitrary,
          highLeverageArbitrary,
          negativeSentimentArbitrary,
          async (drawdown, leverage, sentiment) => {
            alertManager.clearCooldowns();
            receivedAlerts = [];

            alertManager.onAlert((alert) => receivedAlerts.push(alert));

            // Trigger multiple alert types
            const riskResult = createRiskAnalystResult(drawdown, leverage);
            const marketResult = createMarketAnalystResult(sentiment);

            alertManager.checkAndEmitAlerts(riskResult, { skipCooldown: true });
            alertManager.clearCooldowns();
            alertManager.checkAndEmitAlerts(marketResult, { skipCooldown: true });

            // Verify all alerts have UI-required fields
            for (const alert of receivedAlerts) {
              // Fields needed for UI toast/notification
              expect(typeof alert.title).toBe('string');
              expect(alert.title.length).toBeGreaterThan(0);
              expect(typeof alert.message).toBe('string');
              expect(alert.message.length).toBeGreaterThan(0);
              expect(['info', 'warning', 'critical']).toContain(alert.severity);

              // Fields needed for alert list/history
              expect(typeof alert.timestamp).toBe('string');
              expect(typeof alert.sourceAgent).toBe('string');
              expect(typeof alert.alertType).toBe('string');
              expect(typeof alert.recommendation).toBe('string');
              expect(typeof alert.data).toBe('object');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Handling in Callbacks', () => {
    it('should continue emitting to other subscribers if one throws', async () => {
      await fc.assert(
        fc.asyncProperty(highDrawdownArbitrary, async (drawdown) => {
          alertManager.clearCooldowns();
          const successfulAlerts: AgentAlertEvent[] = [];

          // First callback throws
          alertManager.onAlert(() => {
            throw new Error('Callback error');
          });

          // Second callback should still receive alerts
          alertManager.onAlert((alert) => {
            successfulAlerts.push(alert);
          });

          // Trigger alert - should not throw
          const result = createRiskAnalystResult(drawdown, 1.0);
          expect(() => {
            alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
          }).not.toThrow();

          // Second callback should have received the alert
          expect(successfulAlerts.length).toBeGreaterThanOrEqual(1);
        }),
        { numRuns: 100 }
      );
    });
  });
});


// =============================================================================
// Utility Function Tests
// =============================================================================

describe('Utility Functions', () => {
  describe('convertToRiskAlert', () => {
    it('should convert any AgentAlertEvent to RiskAlert format', async () => {
      await fc.assert(
        fc.asyncProperty(
          alertTypeArbitrary,
          alertSeverityArbitrary,
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          async (alertType, severity, title, message) => {
            const agentAlert: AgentAlertEvent = {
              sourceAgent: 'test_agent',
              severity,
              alertType,
              title,
              message,
              recommendation: 'Test recommendation',
              data: { testMetric: 123 },
              timestamp: new Date().toISOString(),
            };

            const riskAlert = convertToRiskAlert(agentAlert);

            expect(riskAlert.type).toBe(`AI_${alertType}`);
            expect(riskAlert.severity).toBe(severity);
            expect(riskAlert.title).toBe(title);
            expect(riskAlert.message).toContain(message);
            expect(riskAlert.message).toContain('Recommendation');
            expect(riskAlert.data).toHaveProperty('sourceAgent', 'test_agent');
            expect(riskAlert.data).toHaveProperty('testMetric', 123);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('shouldSendEmail', () => {
    it('should return true only for critical alerts', async () => {
      await fc.assert(
        fc.asyncProperty(alertTypeArbitrary, async (alertType) => {
          const criticalAlert: AgentAlertEvent = {
            sourceAgent: 'test',
            severity: 'critical',
            alertType,
            title: 'Test',
            message: 'Test',
            recommendation: 'Test',
            data: {},
            timestamp: new Date().toISOString(),
          };

          const warningAlert: AgentAlertEvent = {
            ...criticalAlert,
            severity: 'warning',
          };

          const infoAlert: AgentAlertEvent = {
            ...criticalAlert,
            severity: 'info',
          };

          expect(shouldSendEmail(criticalAlert)).toBe(true);
          expect(shouldSendEmail(warningAlert)).toBe(false);
          expect(shouldSendEmail(infoAlert)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('formatAlertForToast', () => {
    it('should format any alert for toast display', async () => {
      await fc.assert(
        fc.asyncProperty(
          alertSeverityArbitrary,
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          async (severity, title, message) => {
            const alert: AgentAlertEvent = {
              sourceAgent: 'test',
              severity,
              alertType: 'DRAWDOWN',
              title,
              message,
              recommendation: 'Test',
              data: {},
              timestamp: new Date().toISOString(),
            };

            const toast = formatAlertForToast(alert);

            expect(toast.title).toBe(title);
            expect(toast.description.length).toBeLessThanOrEqual(203); // 200 + '...'
            expect(['default', 'destructive']).toContain(toast.variant);

            if (severity === 'critical') {
              expect(toast.variant).toBe('destructive');
            } else {
              expect(toast.variant).toBe('default');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should truncate long messages', () => {
      const longMessage = 'A'.repeat(300);
      const alert: AgentAlertEvent = {
        sourceAgent: 'test',
        severity: 'warning',
        alertType: 'DRAWDOWN',
        title: 'Test',
        message: longMessage,
        recommendation: 'Test',
        data: {},
        timestamp: new Date().toISOString(),
      };

      const toast = formatAlertForToast(alert);
      expect(toast.description.length).toBe(203); // 200 + '...'
      expect(toast.description.endsWith('...')).toBe(true);
    });
  });
});


// =============================================================================
// Configuration Tests
// =============================================================================

describe('Alert Configuration', () => {
  describe('Custom Thresholds', () => {
    it('should respect custom drawdown threshold', async () => {
      const customThreshold = 10; // Lower than default 15%
      const alertManager = createAlertManagerWithConfig({
        riskAnalyst: { drawdownThreshold: customThreshold, leverageThreshold: 2.5 },
      });

      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: customThreshold + 0.01, max: 15, noNaN: true }),
          async (drawdown) => {
            alertManager.clearCooldowns();
            const result = createRiskAnalystResult(drawdown, 1.0);
            const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

            // Should trigger with custom threshold even though below default
            expect(alerts.some((a) => a.alertType === 'DRAWDOWN')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect custom leverage threshold', async () => {
      const customThreshold = 2.0; // Lower than default 2.5x
      const alertManager = createAlertManagerWithConfig({
        riskAnalyst: { drawdownThreshold: 15, leverageThreshold: customThreshold },
      });

      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: customThreshold + 0.01, max: 2.5, noNaN: true }),
          async (leverage) => {
            alertManager.clearCooldowns();
            const result = createRiskAnalystResult(0, leverage);
            const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

            // Should trigger with custom threshold even though below default
            expect(alerts.some((a) => a.alertType === 'LEVERAGE')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect custom sentiment threshold', async () => {
      const customThreshold = -0.3; // Higher than default -0.5
      const alertManager = createAlertManagerWithConfig({
        marketAnalyst: { negativeSentimentThreshold: customThreshold },
      });

      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: -0.5, max: customThreshold - 0.01, noNaN: true }),
          async (sentiment) => {
            alertManager.clearCooldowns();
            const result = createMarketAnalystResult(sentiment);
            const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

            // Should trigger with custom threshold even though above default
            expect(alerts.some((a) => a.alertType === 'SENTIMENT')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('updateConfig', () => {
    it('should update configuration dynamically', async () => {
      const alertManager = createAlertManager();

      await fc.assert(
        fc.asyncProperty(
          // Generate values between 10.1 and 14.9 (above new threshold 10, below default 15)
          fc.double({ min: 10.1, max: 14.9, noNaN: true }),
          async (drawdown) => {
            // Reset config to default before each test
            alertManager.updateConfig({
              riskAnalyst: { drawdownThreshold: 15, leverageThreshold: 2.5 },
            });
            alertManager.clearCooldowns();

            // With default config (threshold 15), should NOT trigger for values < 15
            const result1 = createRiskAnalystResult(drawdown, 1.0);
            const alerts1 = alertManager.checkAndEmitAlerts(result1, { skipCooldown: true });
            expect(alerts1.filter((a) => a.alertType === 'DRAWDOWN')).toHaveLength(0);

            // Update config to lower threshold (10)
            alertManager.updateConfig({
              riskAnalyst: { drawdownThreshold: 10, leverageThreshold: 2.5 },
            });

            // Now should trigger since drawdown > 10
            alertManager.clearCooldowns();
            const result2 = createRiskAnalystResult(drawdown, 1.0);
            const alerts2 = alertManager.checkAndEmitAlerts(result2, { skipCooldown: true });
            expect(alerts2.some((a) => a.alertType === 'DRAWDOWN')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const customConfig = {
        riskAnalyst: { drawdownThreshold: 20, leverageThreshold: 3.0 },
        marketAnalyst: { negativeSentimentThreshold: -0.6 },
        advisor: { criticalRiskLevel: false },
      };

      const alertManager = createAlertManagerWithConfig(customConfig);
      const config = alertManager.getConfig();

      expect(config.riskAnalyst.drawdownThreshold).toBe(20);
      expect(config.riskAnalyst.leverageThreshold).toBe(3.0);
      expect(config.marketAnalyst.negativeSentimentThreshold).toBe(-0.6);
      expect(config.advisor.criticalRiskLevel).toBe(false);
    });
  });
});


// =============================================================================
// Integration with riskAlertService Tests
// =============================================================================

describe('Integration with riskAlertService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendAgentAlert', () => {
    it('should call riskAlertService.triggerRiskAlerts for any alert', async () => {
      await fc.assert(
        fc.asyncProperty(
          alertTypeArbitrary,
          alertSeverityArbitrary,
          async (alertType, severity) => {
            vi.clearAllMocks();

            const alert: AgentAlertEvent = {
              sourceAgent: 'test_agent',
              severity,
              alertType,
              title: 'Test Alert',
              message: 'Test message',
              recommendation: 'Test recommendation',
              data: { metric: 123 },
              timestamp: new Date().toISOString(),
            };

            await sendAgentAlert(alert);

            expect(mockTriggerRiskAlerts).toHaveBeenCalled();
            const callArgs = (mockTriggerRiskAlerts as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(callArgs[0]).toHaveLength(1);
            expect(callArgs[0][0].type).toBe(`AI_${alertType}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should send email only for critical alerts by default', async () => {
      vi.clearAllMocks();

      const criticalAlert: AgentAlertEvent = {
        sourceAgent: 'test',
        severity: 'critical',
        alertType: 'DRAWDOWN',
        title: 'Critical',
        message: 'Critical message',
        recommendation: 'Act now',
        data: {},
        timestamp: new Date().toISOString(),
      };

      await sendAgentAlert(criticalAlert);

      const callArgs = (mockTriggerRiskAlerts as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[2].sendEmail).toBe(true);

      vi.clearAllMocks();

      const warningAlert: AgentAlertEvent = {
        ...criticalAlert,
        severity: 'warning',
      };

      await sendAgentAlert(warningAlert);

      const callArgs2 = (mockTriggerRiskAlerts as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs2[2].sendEmail).toBe(false);
    });

    it('should respect custom options', async () => {
      vi.clearAllMocks();

      const alert: AgentAlertEvent = {
        sourceAgent: 'test',
        severity: 'warning',
        alertType: 'LEVERAGE',
        title: 'Test',
        message: 'Test',
        recommendation: 'Test',
        data: {},
        timestamp: new Date().toISOString(),
      };

      await sendAgentAlert(alert, {
        userId: 42,
        sendEmail: true,
        showToast: false,
        browserNotify: false,
      });

      const callArgs = (mockTriggerRiskAlerts as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1]).toBe(42);
      expect(callArgs[2].sendEmail).toBe(true);
      expect(callArgs[2].showToast).toBe(false);
      expect(callArgs[2].browserNotify).toBe(false);
    });
  });
});


// =============================================================================
// Edge Cases and Boundary Tests
// =============================================================================

describe('Edge Cases and Boundary Tests', () => {
  let alertManager: AgentAlertManager;

  beforeEach(() => {
    alertManager = createAlertManager();
    alertManager.clearCooldowns();
  });

  describe('Boundary Values', () => {
    it('should NOT trigger at exact threshold (drawdown = 15%)', () => {
      const result = createRiskAnalystResult(15, 1.0);
      const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
      expect(alerts.filter((a) => a.alertType === 'DRAWDOWN')).toHaveLength(0);
    });

    it('should trigger just above threshold (drawdown = 15.01%)', () => {
      const result = createRiskAnalystResult(15.01, 1.0);
      const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
      expect(alerts.filter((a) => a.alertType === 'DRAWDOWN')).toHaveLength(1);
    });

    it('should NOT trigger at exact leverage threshold (2.5x)', () => {
      const result = createRiskAnalystResult(0, 2.5);
      const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
      expect(alerts.filter((a) => a.alertType === 'LEVERAGE')).toHaveLength(0);
    });

    it('should trigger just above leverage threshold (2.51x)', () => {
      const result = createRiskAnalystResult(0, 2.51);
      const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
      expect(alerts.filter((a) => a.alertType === 'LEVERAGE')).toHaveLength(1);
    });

    it('should NOT trigger at exact sentiment threshold (-0.5)', () => {
      const result = createMarketAnalystResult(-0.5);
      const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
      expect(alerts.filter((a) => a.alertType === 'SENTIMENT')).toHaveLength(0);
    });

    it('should trigger just below sentiment threshold (-0.51)', () => {
      const result = createMarketAnalystResult(-0.51);
      const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
      expect(alerts.filter((a) => a.alertType === 'SENTIMENT')).toHaveLength(1);
    });
  });

  describe('Missing Data Handling', () => {
    it('should handle missing drawdown_analysis gracefully', () => {
      const result: AgentResult = {
        agentId: 'risk_analyst',
        status: 'success',
        data: {
          leverage_assessment: { current_leverage: 3.0 },
        },
        summary: 'Test',
        metadata: { executionTimeMs: 100, tokensUsed: 50, dataSources: [] },
      };

      const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
      // Should still emit leverage alert
      expect(alerts.some((a) => a.alertType === 'LEVERAGE')).toBe(true);
      // Should not crash on missing drawdown
      expect(alerts.filter((a) => a.alertType === 'DRAWDOWN')).toHaveLength(0);
    });

    it('should handle missing leverage_assessment gracefully', () => {
      const result: AgentResult = {
        agentId: 'risk_analyst',
        status: 'success',
        data: {
          drawdown_analysis: { current_drawdown: 20 },
        },
        summary: 'Test',
        metadata: { executionTimeMs: 100, tokensUsed: 50, dataSources: [] },
      };

      const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
      // Should still emit drawdown alert
      expect(alerts.some((a) => a.alertType === 'DRAWDOWN')).toBe(true);
      // Should not crash on missing leverage
      expect(alerts.filter((a) => a.alertType === 'LEVERAGE')).toHaveLength(0);
    });

    it('should handle missing sentiment_score gracefully', () => {
      const result: AgentResult = {
        agentId: 'market_analyst',
        status: 'success',
        data: {
          news_summary: 'Some news',
        },
        summary: 'Test',
        metadata: { executionTimeMs: 100, tokensUsed: 50, dataSources: [] },
      };

      const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
      expect(alerts).toHaveLength(0);
    });

    it('should handle missing risk_level gracefully', () => {
      const result: AgentResult = {
        agentId: 'advisor',
        status: 'success',
        data: {
          action_items: ['Test'],
        },
        summary: 'Test',
        metadata: { executionTimeMs: 100, tokensUsed: 50, dataSources: [] },
      };

      const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
      expect(alerts).toHaveLength(0);
    });
  });

  describe('Unknown Agent Types', () => {
    it('should not emit alerts for unknown agent types', () => {
      const result: AgentResult = {
        agentId: 'unknown_agent',
        status: 'success',
        data: {
          drawdown_analysis: { current_drawdown: 50 },
          leverage_assessment: { current_leverage: 5.0 },
          sentiment_score: -0.9,
          risk_level: 'CRITICAL',
        },
        summary: 'Test',
        metadata: { executionTimeMs: 100, tokensUsed: 50, dataSources: [] },
      };

      const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });
      expect(alerts).toHaveLength(0);
    });
  });

  describe('Partial Status Results', () => {
    it('should still emit alerts for partial status results', () => {
      const result = createRiskAnalystResult(20, 3.0, 'partial');
      const alerts = alertManager.checkAndEmitAlerts(result, { skipCooldown: true });

      expect(alerts.length).toBeGreaterThanOrEqual(2);
      expect(alerts.some((a) => a.alertType === 'DRAWDOWN')).toBe(true);
      expect(alerts.some((a) => a.alertType === 'LEVERAGE')).toBe(true);
    });
  });
});
