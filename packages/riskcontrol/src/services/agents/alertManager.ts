/**
 * AI-Triggered Alert System for Multi-Agent Orchestration
 *
 * Implements automatic risk alert detection and emission based on
 * agent analysis results. Integrates with the existing riskAlertService.
 *
 * @module agents/alertManager
 * @see {@link .kiro/specs/multi-agent-analysis/requirements.md} - Requirements 10.1-10.9
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} - Section 6.3 Alert System
 */

import type {
  AgentResult,
  AgentAlertEvent,
  AlertTriggerConfig,
  AlertSeverity,
  AlertType,
  RiskLevel,
} from './types';
import { DEFAULT_ALERT_TRIGGERS } from './types';
import {
  triggerRiskAlerts as triggerRiskAlertsService,
  type RiskAlert,
  type AlertSeverity as RiskAlertSeverity,
} from '../riskAlertService';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Cooldown entry for tracking alert emission times.
 */
interface CooldownEntry {
  /** Alert type */
  alertType: AlertType;

  /** Source agent ID */
  sourceAgent: string;

  /** Timestamp when alert was last emitted */
  lastEmittedAt: number;
}

/**
 * Options for alert checking.
 */
export interface AlertCheckOptions {
  /** Skip cooldown check (for testing) */
  skipCooldown?: boolean;

  /** Custom trigger configuration */
  triggers?: Partial<AlertTriggerConfig>;
}

/**
 * Callback function for alert events.
 */
export type AlertCallback = (alert: AgentAlertEvent) => void;

// =============================================================================
// Agent Alert Manager
// =============================================================================

/**
 * Manages AI-triggered alerts based on agent analysis results.
 *
 * Features:
 * - Automatic alert detection from agent results
 * - Configurable thresholds for different alert types
 * - 30-minute cooldown mechanism to prevent alert spam
 * - Integration with existing riskAlertService
 *
 * @example
 * ```typescript
 * const alertManager = new AgentAlertManager();
 *
 * // Check for alerts after agent execution
 * const alerts = alertManager.checkAndEmitAlerts(agentResult);
 *
 * // Subscribe to alerts
 * alertManager.onAlert((alert) => {
 *   console.log(`Alert: ${alert.title}`);
 *   riskAlertService.triggerRiskAlerts(alert);
 * });
 * ```
 *
 * @see Requirements 10.1, 10.2, 10.3, 10.6
 */
export class AgentAlertManager {
  /** Alert trigger configuration */
  private config: AlertTriggerConfig;

  /** Cooldown tracking for each alert type */
  private cooldowns: Map<string, CooldownEntry>;

  /** Cooldown duration in milliseconds (30 minutes) */
  private readonly cooldownDurationMs: number;

  /** Alert callbacks */
  private callbacks: AlertCallback[];

  /**
   * Create a new AgentAlertManager instance.
   *
   * @param config - Alert trigger configuration (default: DEFAULT_ALERT_TRIGGERS)
   * @param cooldownDurationMs - Cooldown duration in ms (default: 30 minutes)
   */
  constructor(
    config: Partial<AlertTriggerConfig> = {},
    cooldownDurationMs: number = 30 * 60 * 1000
  ) {
    this.config = {
      ...DEFAULT_ALERT_TRIGGERS,
      ...config,
      riskAnalyst: {
        ...DEFAULT_ALERT_TRIGGERS.riskAnalyst,
        ...config.riskAnalyst,
      },
      marketAnalyst: {
        ...DEFAULT_ALERT_TRIGGERS.marketAnalyst,
        ...config.marketAnalyst,
      },
      advisor: {
        ...DEFAULT_ALERT_TRIGGERS.advisor,
        ...config.advisor,
      },
    };
    this.cooldowns = new Map();
    this.cooldownDurationMs = cooldownDurationMs;
    this.callbacks = [];
  }

  /**
   * Check agent result for alert conditions and emit alerts.
   *
   * Analyzes the agent result data and emits alerts if thresholds
   * are exceeded and cooldown has passed.
   *
   * @param result - Agent execution result
   * @param options - Optional check options
   * @returns Array of emitted alerts
   *
   * @example
   * ```typescript
   * const result = await riskAnalystAgent.execute(context, portfolio);
   * const alerts = alertManager.checkAndEmitAlerts(result);
   * console.log(`Emitted ${alerts.length} alerts`);
   * ```
   */
  checkAndEmitAlerts(
    result: AgentResult,
    options: AlertCheckOptions = {}
  ): AgentAlertEvent[] {
    const alerts: AgentAlertEvent[] = [];

    // Skip if agent execution failed
    if (result.status === 'failed') {
      return alerts;
    }

    // Merge custom triggers with default config
    const triggers = options.triggers
      ? this.mergeConfig(options.triggers)
      : this.config;

    // Check alerts based on agent type
    switch (result.agentId) {
      case 'risk_analyst':
        alerts.push(
          ...this.checkRiskAnalystAlerts(result, triggers, options.skipCooldown)
        );
        break;

      case 'market_analyst':
        alerts.push(
          ...this.checkMarketAnalystAlerts(result, triggers, options.skipCooldown)
        );
        break;

      case 'advisor':
        alerts.push(
          ...this.checkAdvisorAlerts(result, triggers, options.skipCooldown)
        );
        break;

      default:
        // Unknown agent type, no alerts
        break;
    }

    // Emit alerts via callbacks
    for (const alert of alerts) {
      this.emitAlert(alert);
    }

    return alerts;
  }

  /**
   * Register a callback for alert events.
   *
   * @param callback - Function to call when an alert is emitted
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = alertManager.onAlert((alert) => {
   *   console.log(`Alert: ${alert.title}`);
   * });
   *
   * // Later, unsubscribe
   * unsubscribe();
   * ```
   */
  onAlert(callback: AlertCallback): () => void {
    this.callbacks.push(callback);

    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Update alert trigger configuration.
   *
   * @param config - Partial configuration to merge
   *
   * @example
   * ```typescript
   * alertManager.updateConfig({
   *   riskAnalyst: { drawdownThreshold: 20 }
   * });
   * ```
   */
  updateConfig(config: Partial<AlertTriggerConfig>): void {
    this.config = this.mergeConfig(config);
  }

  /**
   * Get current alert trigger configuration.
   *
   * @returns Current configuration
   */
  getConfig(): AlertTriggerConfig {
    return { ...this.config };
  }

  /**
   * Clear all cooldowns (useful for testing).
   */
  clearCooldowns(): void {
    this.cooldowns.clear();
  }

  /**
   * Check if an alert type is in cooldown.
   *
   * @param alertType - Alert type to check
   * @param sourceAgent - Source agent ID
   * @returns True if in cooldown
   */
  isInCooldown(alertType: AlertType, sourceAgent: string): boolean {
    const key = this.getCooldownKey(alertType, sourceAgent);
    const entry = this.cooldowns.get(key);

    if (!entry) {
      return false;
    }

    const elapsed = Date.now() - entry.lastEmittedAt;
    return elapsed < this.cooldownDurationMs;
  }

  /**
   * Get remaining cooldown time in milliseconds.
   *
   * @param alertType - Alert type to check
   * @param sourceAgent - Source agent ID
   * @returns Remaining cooldown time in ms, or 0 if not in cooldown
   */
  getRemainingCooldown(alertType: AlertType, sourceAgent: string): number {
    const key = this.getCooldownKey(alertType, sourceAgent);
    const entry = this.cooldowns.get(key);

    if (!entry) {
      return 0;
    }

    const elapsed = Date.now() - entry.lastEmittedAt;
    const remaining = this.cooldownDurationMs - elapsed;
    return Math.max(0, remaining);
  }

  // ===========================================================================
  // Alert Check Methods
  // ===========================================================================

  /**
   * Check Risk Analyst results for alert conditions.
   *
   * Checks for:
   * - Drawdown exceeding threshold (default: 15%)
   * - Leverage exceeding threshold (default: 2.5x)
   *
   * @param result - Risk Analyst agent result
   * @param triggers - Alert trigger configuration
   * @param skipCooldown - Skip cooldown check
   * @returns Array of alerts to emit
   *
   * @see Requirements 10.1, 10.2
   */
  private checkRiskAnalystAlerts(
    result: AgentResult,
    triggers: AlertTriggerConfig,
    skipCooldown?: boolean
  ): AgentAlertEvent[] {
    const alerts: AgentAlertEvent[] = [];
    const data = result.data;

    // Check drawdown threshold
    const drawdownAnalysis = data.drawdown_analysis as
      | { current_drawdown?: number }
      | undefined;
    const currentDrawdown = drawdownAnalysis?.current_drawdown;

    if (
      typeof currentDrawdown === 'number' &&
      currentDrawdown > triggers.riskAnalyst.drawdownThreshold
    ) {
      const alertType: AlertType = 'DRAWDOWN';

      if (skipCooldown || !this.isInCooldown(alertType, result.agentId)) {
        const alert = this.createAlert({
          sourceAgent: result.agentId,
          severity: currentDrawdown > 25 ? 'critical' : 'warning',
          alertType,
          title: `回撤警报: ${currentDrawdown.toFixed(1)}%`,
          message: `投资组合回撤 ${currentDrawdown.toFixed(1)}% 超过 ${triggers.riskAnalyst.drawdownThreshold}% 阈值。${result.summary}`,
          recommendation:
            '建议减少持仓规模或设置止损单以限制进一步损失。',
          data: {
            currentDrawdown,
            threshold: triggers.riskAnalyst.drawdownThreshold,
            drawdownAnalysis,
          },
        });

        alerts.push(alert);
        this.updateCooldown(alertType, result.agentId);
      }
    }

    // Check leverage threshold
    const leverageAssessment = data.leverage_assessment as
      | { current_leverage?: number }
      | undefined;
    const currentLeverage = leverageAssessment?.current_leverage;

    if (
      typeof currentLeverage === 'number' &&
      currentLeverage > triggers.riskAnalyst.leverageThreshold
    ) {
      const alertType: AlertType = 'LEVERAGE';

      if (skipCooldown || !this.isInCooldown(alertType, result.agentId)) {
        const alert = this.createAlert({
          sourceAgent: result.agentId,
          severity: currentLeverage > 3.0 ? 'critical' : 'warning',
          alertType,
          title: `杠杆警报: ${currentLeverage.toFixed(2)}倍`,
          message: `投资组合杠杆率 ${currentLeverage.toFixed(2)}倍 超过 ${triggers.riskAnalyst.leverageThreshold}倍 阈值。${result.summary}`,
          recommendation:
            '建议减少融资使用或偿还部分融资借款以降低杠杆风险。',
          data: {
            currentLeverage,
            threshold: triggers.riskAnalyst.leverageThreshold,
            leverageAssessment,
          },
        });

        alerts.push(alert);
        this.updateCooldown(alertType, result.agentId);
      }
    }

    return alerts;
  }

  /**
   * Check Market Analyst results for alert conditions.
   *
   * Checks for:
   * - Strongly negative sentiment (default: < -0.5)
   *
   * @param result - Market Analyst agent result
   * @param triggers - Alert trigger configuration
   * @param skipCooldown - Skip cooldown check
   * @returns Array of alerts to emit
   *
   * @see Requirements 10.3
   */
  private checkMarketAnalystAlerts(
    result: AgentResult,
    triggers: AlertTriggerConfig,
    skipCooldown?: boolean
  ): AgentAlertEvent[] {
    const alerts: AgentAlertEvent[] = [];
    const data = result.data;

    // Check sentiment threshold
    const sentimentScore = data.sentiment_score as number | undefined;

    if (
      typeof sentimentScore === 'number' &&
      sentimentScore < triggers.marketAnalyst.negativeSentimentThreshold
    ) {
      const alertType: AlertType = 'SENTIMENT';

      if (skipCooldown || !this.isInCooldown(alertType, result.agentId)) {
        const alert = this.createAlert({
          sourceAgent: result.agentId,
          severity: sentimentScore < -0.7 ? 'critical' : 'warning',
          alertType,
          title: `市场情绪警报`,
          message: `市场情绪评分 ${sentimentScore.toFixed(2)} 表明您持仓的相关新闻偏负面。${result.summary}`,
          recommendation:
            '建议关注近期新闻，评估当前持仓是否符合市场状况。',
          data: {
            sentimentScore,
            threshold: triggers.marketAnalyst.negativeSentimentThreshold,
            newsSummary: data.news_summary,
            marketCycle: data.market_cycle,
          },
        });

        alerts.push(alert);
        this.updateCooldown(alertType, result.agentId);
      }
    }

    return alerts;
  }

  /**
   * Check Advisor results for alert conditions.
   *
   * Checks for:
   * - CRITICAL risk level in final assessment
   *
   * @param result - Advisor agent result
   * @param triggers - Alert trigger configuration
   * @param skipCooldown - Skip cooldown check
   * @returns Array of alerts to emit
   *
   * @see Requirements 10.1
   */
  private checkAdvisorAlerts(
    result: AgentResult,
    triggers: AlertTriggerConfig,
    skipCooldown?: boolean
  ): AgentAlertEvent[] {
    const alerts: AgentAlertEvent[] = [];
    const data = result.data;

    // Check for CRITICAL risk level
    const riskLevel = data.risk_level as RiskLevel | undefined;

    if (triggers.advisor.criticalRiskLevel && riskLevel === 'CRITICAL') {
      const alertType: AlertType = 'RISK_LEVEL';

      if (skipCooldown || !this.isInCooldown(alertType, result.agentId)) {
        const alert = this.createAlert({
          sourceAgent: result.agentId,
          severity: 'critical',
          alertType,
          title: '危险风险等级警报',
          message: `投资顾问判定您的投资组合处于危险风险等级。${result.summary}`,
          recommendation:
            data.action_plan as string ||
            '建议立即采取行动。请查看完整分析并考虑保护性措施。',
          data: {
            riskLevel,
            actionItems: data.action_items,
            detailedAnalysis: data.detailed_analysis,
          },
        });

        alerts.push(alert);
        this.updateCooldown(alertType, result.agentId);
      }
    }

    return alerts;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Create an alert event with timestamp.
   *
   * @param params - Alert parameters
   * @returns Complete alert event
   */
  private createAlert(
    params: Omit<AgentAlertEvent, 'timestamp'>
  ): AgentAlertEvent {
    return {
      ...params,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Emit an alert to all registered callbacks.
   *
   * @param alert - Alert to emit
   */
  private emitAlert(alert: AgentAlertEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    }
  }

  /**
   * Get cooldown key for an alert type and agent.
   *
   * @param alertType - Alert type
   * @param sourceAgent - Source agent ID
   * @returns Cooldown key
   */
  private getCooldownKey(alertType: AlertType, sourceAgent: string): string {
    return `${alertType}:${sourceAgent}`;
  }

  /**
   * Update cooldown for an alert type.
   *
   * @param alertType - Alert type
   * @param sourceAgent - Source agent ID
   */
  private updateCooldown(alertType: AlertType, sourceAgent: string): void {
    const key = this.getCooldownKey(alertType, sourceAgent);
    this.cooldowns.set(key, {
      alertType,
      sourceAgent,
      lastEmittedAt: Date.now(),
    });
  }

  /**
   * Merge partial config with current config.
   *
   * @param partial - Partial configuration
   * @returns Merged configuration
   */
  private mergeConfig(partial: Partial<AlertTriggerConfig>): AlertTriggerConfig {
    return {
      riskAnalyst: {
        ...this.config.riskAnalyst,
        ...partial.riskAnalyst,
      },
      marketAnalyst: {
        ...this.config.marketAnalyst,
        ...partial.marketAnalyst,
      },
      advisor: {
        ...this.config.advisor,
        ...partial.advisor,
      },
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an AgentAlertManager with default configuration.
 *
 * @returns AgentAlertManager instance
 *
 * @example
 * ```typescript
 * const alertManager = createAlertManager();
 * ```
 */
export function createAlertManager(): AgentAlertManager {
  return new AgentAlertManager();
}

/**
 * Create an AgentAlertManager with custom configuration.
 *
 * @param config - Custom alert trigger configuration
 * @param cooldownDurationMs - Custom cooldown duration in ms
 * @returns AgentAlertManager instance
 *
 * @example
 * ```typescript
 * const alertManager = createAlertManagerWithConfig({
 *   riskAnalyst: { drawdownThreshold: 20 }
 * }, 15 * 60 * 1000); // 15 minute cooldown
 * ```
 */
export function createAlertManagerWithConfig(
  config: Partial<AlertTriggerConfig>,
  cooldownDurationMs?: number
): AgentAlertManager {
  return new AgentAlertManager(config, cooldownDurationMs);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert AgentAlertEvent to a format suitable for riskAlertService.
 *
 * @param alert - Agent alert event
 * @returns Object suitable for riskAlertService.triggerRiskAlerts
 *
 * @example
 * ```typescript
 * const alert = alertManager.checkAndEmitAlerts(result)[0];
 * const riskAlert = convertToRiskAlert(alert);
 * riskAlertService.triggerRiskAlerts(riskAlert);
 * ```
 */
export function convertToRiskAlert(alert: AgentAlertEvent): {
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  data: Record<string, unknown>;
} {
  return {
    type: `AI_${alert.alertType}`,
    severity: alert.severity,
    title: alert.title,
    message: `${alert.message}\n\nRecommendation: ${alert.recommendation}`,
    data: {
      ...alert.data,
      sourceAgent: alert.sourceAgent,
      timestamp: alert.timestamp,
    },
  };
}

/**
 * Send an agent alert through the existing riskAlertService.
 *
 * Converts AgentAlertEvent to RiskAlert format and triggers
 * the alert through riskAlertService with appropriate options.
 *
 * @param alert - Agent alert event to send
 * @param options - Options for alert delivery
 * @returns Promise that resolves when alert is sent
 *
 * @example
 * ```typescript
 * const alerts = alertManager.checkAndEmitAlerts(result);
 * for (const alert of alerts) {
 *   await sendAgentAlert(alert);
 * }
 * ```
 *
 * @see Requirements 10.4, 10.5, 10.9
 */
export async function sendAgentAlert(
  alert: AgentAlertEvent,
  options: {
    userId?: number;
    sendEmail?: boolean;
    showToast?: boolean;
    browserNotify?: boolean;
  } = {}
): Promise<void> {
  const {
    userId = 1,
    sendEmail = shouldSendEmail(alert),
    showToast = true,
    browserNotify = true,
  } = options;

  // Convert to RiskAlert format
  const riskAlert: RiskAlert = {
    id: `AI_${alert.alertType}_${Date.now()}`,
    type: `AI_${alert.alertType}` as RiskAlert['type'],
    severity: alert.severity as RiskAlertSeverity,
    title: alert.title,
    message: alert.message,
    recommendation: alert.recommendation,
    timestamp: alert.timestamp,
    acknowledged: false,
    metrics: alert.data as RiskAlert['metrics'],
  };

  // Trigger through riskAlertService
  await triggerRiskAlertsService([riskAlert], userId, {
    sendEmail,
    showToast,
    browserNotify,
  });
}

/**
 * Determine if an alert should trigger an email notification.
 *
 * @param alert - Agent alert event
 * @returns True if email should be sent
 *
 * @see Requirements 10.9
 */
export function shouldSendEmail(alert: AgentAlertEvent): boolean {
  return alert.severity === 'critical';
}

/**
 * Format alert for display in UI toast notification.
 *
 * @param alert - Agent alert event
 * @returns Formatted toast message
 */
export function formatAlertForToast(alert: AgentAlertEvent): {
  title: string;
  description: string;
  variant: 'default' | 'destructive';
} {
  return {
    title: alert.title,
    description: alert.message.substring(0, 200) + (alert.message.length > 200 ? '...' : ''),
    variant: alert.severity === 'critical' ? 'destructive' : 'default',
  };
}

// =============================================================================
// Default Export
// =============================================================================

export default AgentAlertManager;
