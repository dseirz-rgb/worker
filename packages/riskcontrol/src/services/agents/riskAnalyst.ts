/**
 * Risk Analyst Agent
 *
 * Evaluates portfolio risk through drawdown analysis, stress tests, and leverage assessment.
 * Provides comprehensive risk metrics and determines overall risk level.
 *
 * @module agents/riskAnalyst
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for detailed design
 * @see Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import type {
  Agent,
  AgentContext,
  AgentResult,
  AgentState,
  AgentMessage,
  PortfolioState,
  DrawdownAnalysis,
  StressTestResult,
  LeverageAssessment,
  RiskLevel,
  AgentPersonality,
  AgentMemoryConfig,
} from './types';

// =============================================================================
// Risk Analyst Agent Implementation
// =============================================================================

/**
 * Risk Analyst Agent - Evaluates portfolio risk through multiple dimensions
 *
 * Responsibilities:
 * - Drawdown Analysis: Calculate current drawdown from high water mark
 * - Stress Testing: Simulate market decline scenarios (-10%, -20%, -30%)
 * - Leverage Assessment: Evaluate margin loan exposure and safety
 * - Risk Level Determination: Synthesize findings into overall risk level
 *
 * @example
 * ```typescript
 * const riskAnalyst = new RiskAnalystAgent();
 * const result = await riskAnalyst.execute(context, portfolio);
 * console.log(result.data.risk_level); // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
 * ```
 *
 * @see Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */
export class RiskAnalystAgent implements Agent {
  /** Unique identifier for the agent */
  id = 'risk_analyst';

  /** Human-readable role description */
  role = 'Risk Assessment Specialist';

  /** Agent's primary goal */
  goal = 'Evaluate portfolio risk through drawdown, stress tests, and leverage analysis';

  /** Description for LLM selector mode */
  description =
    'Assesses portfolio risk levels by analyzing drawdowns, running stress tests, and evaluating leverage exposure. Use when risk assessment, margin safety, or stress testing is needed.';

  /** List of tools/data sources this agent can use */
  tools = ['portfolio_data', 'market_data'];

  /** Agent personality configuration (optional) */
  personality?: AgentPersonality;

  /** Memory configuration (optional) */
  memory?: AgentMemoryConfig;

  /** Internal state for persistence */
  private internalState: Record<string, unknown> = {};

  /** Message history for context restoration */
  private messageHistory: AgentMessage[] = [];

  // ===========================================================================
  // Risk Thresholds Configuration
  // ===========================================================================

  /** Maintenance margin requirement (30%) */
  private readonly MAINTENANCE_MARGIN = 0.3;

  /** Initial margin requirement (50%) */
  private readonly INITIAL_MARGIN = 0.5;

  /** Drawdown thresholds for risk levels */
  private readonly DRAWDOWN_THRESHOLDS = {
    LOW: 10,      // < 10% drawdown
    MEDIUM: 15,   // 10-15% drawdown
    HIGH: 25,     // 15-25% drawdown
    CRITICAL: 25, // > 25% drawdown
  };

  /** Leverage thresholds for risk levels */
  private readonly LEVERAGE_THRESHOLDS = {
    LOW: 1.5,     // < 1.5x leverage
    MEDIUM: 2.0,  // 1.5-2.0x leverage
    HIGH: 2.5,    // 2.0-2.5x leverage
    CRITICAL: 3.0, // > 3.0x leverage
  };

  // ===========================================================================
  // Main Execution
  // ===========================================================================

  /**
   * Execute the risk analysis task
   *
   * @param context - Accumulated context from previous agents
   * @param portfolio - Current portfolio state
   * @returns Agent's analysis result with risk metrics
   *
   * @see Requirements 3.1, 3.2, 3.3, 3.4, 3.5
   */
  async execute(
    context: AgentContext,
    portfolio: PortfolioState
  ): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // 1. Drawdown Analysis (Requirement 3.1)
      const drawdownAnalysis = this.analyzeDrawdown(portfolio);

      // 2. Stress Tests (Requirement 3.2)
      const stressTests = this.runStressTests(portfolio);

      // 3. Leverage Assessment (Requirement 3.3)
      const leverageAssessment = this.assessLeverage(portfolio);

      // 4. Determine Overall Risk Level (Requirement 3.4)
      const riskLevel = this.determineRiskLevel(
        drawdownAnalysis,
        stressTests,
        leverageAssessment
      );

      // 5. Generate Summary (Requirement 3.5)
      const summary = this.generateSummary(
        riskLevel,
        drawdownAnalysis,
        leverageAssessment
      );

      // Store in internal state for persistence
      this.internalState = {
        lastAnalysis: {
          drawdownAnalysis,
          stressTests,
          leverageAssessment,
          riskLevel,
        },
        timestamp: Date.now(),
      };

      const executionTimeMs = Date.now() - startTime;

      return {
        agentId: this.id,
        status: 'success',
        data: {
          drawdown_analysis: drawdownAnalysis,
          stress_tests: stressTests,
          leverage_assessment: leverageAssessment,
          risk_level: riskLevel,
        },
        summary,
        metadata: {
          executionTimeMs,
          tokensUsed: 0, // No LLM calls in this agent
          dataSources: ['portfolio_data'],
        },
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        agentId: this.id,
        status: 'failed',
        data: {
          error: errorMessage,
        },
        summary: `Risk analysis failed: ${errorMessage}`,
        metadata: {
          executionTimeMs,
          tokensUsed: 0,
          dataSources: ['portfolio_data'],
          error: errorMessage,
        },
      };
    }
  }

  // ===========================================================================
  // Drawdown Analysis (Requirement 3.1)
  // ===========================================================================

  /**
   * Analyze portfolio drawdown from high water mark
   *
   * Calculates:
   * - Current drawdown percentage
   * - High water mark value
   * - Current portfolio value
   * - Days since peak (requires historical data)
   *
   * @param portfolio - Current portfolio state
   * @returns Drawdown analysis results
   *
   * @see Requirements 3.1
   */
  private analyzeDrawdown(portfolio: PortfolioState): DrawdownAnalysis {
    const currentValue = portfolio.totalValue;
    const highWaterMark = portfolio.highWaterMark;

    // Calculate drawdown percentage
    // Drawdown = (High Water Mark - Current Value) / High Water Mark * 100
    const drawdownPercent =
      highWaterMark > 0
        ? ((highWaterMark - currentValue) / highWaterMark) * 100
        : 0;

    // Ensure drawdown is non-negative (can't have negative drawdown)
    const currentDrawdown = Math.max(0, drawdownPercent);

    // Days since peak calculation would require historical data
    // For now, we estimate based on whether we're at a new high
    const daysSincePeak = currentDrawdown > 0 ? this.estimateDaysSincePeak(currentDrawdown) : 0;

    return {
      current_drawdown: Math.round(currentDrawdown * 100) / 100, // Round to 2 decimal places
      high_water_mark: highWaterMark,
      current_value: currentValue,
      days_since_peak: daysSincePeak,
    };
  }

  /**
   * Estimate days since peak based on drawdown magnitude
   * This is a heuristic when historical data is not available
   *
   * @param drawdownPercent - Current drawdown percentage
   * @returns Estimated days since peak
   */
  private estimateDaysSincePeak(drawdownPercent: number): number {
    // Heuristic: larger drawdowns typically take longer to develop
    // This is a rough estimate when historical data is unavailable
    if (drawdownPercent < 5) return 7;
    if (drawdownPercent < 10) return 14;
    if (drawdownPercent < 15) return 30;
    if (drawdownPercent < 20) return 60;
    return 90;
  }

  // ===========================================================================
  // Stress Testing (Requirement 3.2)
  // ===========================================================================

  /**
   * Run stress tests simulating market decline scenarios
   *
   * Scenarios tested:
   * - Market -10%: Mild correction
   * - Market -20%: Significant correction
   * - Market -30%: Bear market / crash
   *
   * For each scenario, calculates:
   * - Portfolio impact (assuming beta = 1 for simplicity)
   * - Margin call risk
   * - Recovery percentage needed
   *
   * @param portfolio - Current portfolio state
   * @returns Array of stress test results
   *
   * @see Requirements 3.2
   */
  private runStressTests(portfolio: PortfolioState): StressTestResult[] {
    const scenarios = [-10, -20, -30];

    return scenarios.map((marketDrop) => {
      // Calculate portfolio impact
      // Simplified: assumes portfolio beta = 1 (moves with market)
      // In a more sophisticated implementation, we would calculate
      // weighted average beta of all positions
      const portfolioBeta = this.calculatePortfolioBeta(portfolio);
      const portfolioImpact = marketDrop * portfolioBeta;

      // Calculate new portfolio value after the drop
      const newValue = portfolio.totalValue * (1 + portfolioImpact / 100);

      // Calculate equity after the drop
      const equity = newValue - portfolio.marginLoan;

      // Check margin call risk
      // Margin call occurs when equity falls below maintenance margin requirement
      // Maintenance margin = marginLoan * MAINTENANCE_MARGIN
      const maintenanceRequirement = portfolio.marginLoan * this.MAINTENANCE_MARGIN;
      const marginCallRisk = equity < maintenanceRequirement && portfolio.marginLoan > 0;

      // Calculate recovery needed
      // Recovery = |drop| / (1 + drop/100) * 100
      // e.g., -20% drop requires 25% gain to recover
      const recoveryNeeded = Math.abs(portfolioImpact) / (1 + portfolioImpact / 100) * 100;

      return {
        scenario: `Market ${marketDrop}%`,
        portfolio_impact: Math.round(portfolioImpact * 100) / 100,
        margin_call_risk: marginCallRisk,
        recovery_needed: Math.round(recoveryNeeded * 100) / 100,
      };
    });
  }

  /**
   * Calculate portfolio beta (weighted average of position betas)
   *
   * For simplicity, we assume beta = 1 for all positions.
   * In a production system, this would fetch actual beta values
   * from market data sources.
   *
   * @param portfolio - Current portfolio state
   * @returns Portfolio beta
   */
  private calculatePortfolioBeta(_portfolio: PortfolioState): number {
    // Simplified implementation: assume beta = 1
    // A more sophisticated implementation would:
    // 1. Fetch beta for each position from market data
    // 2. Calculate weighted average based on position weights
    return 1.0;
  }

  // ===========================================================================
  // Leverage Assessment (Requirement 3.3)
  // ===========================================================================

  /**
   * Assess portfolio leverage and margin safety
   *
   * Calculates:
   * - Current leverage ratio (Total Assets / Equity)
   * - Margin loan amount
   * - Available margin for additional borrowing
   * - Margin safety level (safe/warning/danger)
   *
   * @param portfolio - Current portfolio state
   * @returns Leverage assessment results
   *
   * @see Requirements 3.3
   */
  private assessLeverage(portfolio: PortfolioState): LeverageAssessment {
    // Calculate equity (net asset value)
    const equity = portfolio.totalValue - portfolio.marginLoan;

    // Calculate leverage ratio
    // Leverage = Total Assets / Equity
    // 1.0 = no leverage, 2.0 = 50% borrowed, etc.
    const leverage = equity > 0 ? portfolio.totalValue / equity : Infinity;

    // Calculate available margin
    // Available = (Equity * Initial Margin Requirement) - Current Margin Loan
    // This represents how much more can be borrowed
    const maxBorrowingCapacity = equity * (1 / this.INITIAL_MARGIN - 1);
    const availableMargin = Math.max(0, maxBorrowingCapacity - portfolio.marginLoan);

    // Determine margin safety level
    const marginSafety = this.determineMarginSafety(leverage, equity, portfolio.marginLoan);

    return {
      current_leverage: Math.round(leverage * 100) / 100,
      margin_loan: portfolio.marginLoan,
      available_margin: Math.round(availableMargin * 100) / 100,
      margin_safety: marginSafety,
    };
  }

  /**
   * Determine margin safety level based on leverage and equity
   *
   * @param leverage - Current leverage ratio
   * @param equity - Current equity value
   * @param marginLoan - Current margin loan amount
   * @returns Margin safety level
   */
  private determineMarginSafety(
    leverage: number,
    equity: number,
    marginLoan: number
  ): 'safe' | 'warning' | 'danger' {
    // No margin loan = always safe
    if (marginLoan <= 0) {
      return 'safe';
    }

    // Check if equity is below maintenance margin
    const maintenanceRequirement = marginLoan * this.MAINTENANCE_MARGIN;
    if (equity < maintenanceRequirement) {
      return 'danger'; // Margin call imminent
    }

    // Check leverage thresholds
    if (leverage > this.LEVERAGE_THRESHOLDS.HIGH) {
      return 'danger';
    }

    if (leverage > this.LEVERAGE_THRESHOLDS.MEDIUM) {
      return 'warning';
    }

    return 'safe';
  }

  // ===========================================================================
  // Risk Level Determination (Requirement 3.4)
  // ===========================================================================

  /**
   * Determine overall risk level based on all risk factors
   *
   * Risk Level Criteria:
   * - CRITICAL: Drawdown > 25% OR Leverage > 3x OR Margin call risk in -10% scenario
   * - HIGH: Drawdown > 15% OR Leverage > 2x OR Margin call risk in -20% scenario
   * - MEDIUM: Drawdown > 10% OR Leverage > 1.5x
   * - LOW: All metrics within safe thresholds
   *
   * @param drawdown - Drawdown analysis results
   * @param stressTests - Stress test results
   * @param leverage - Leverage assessment results
   * @returns Overall risk level
   *
   * @see Requirements 3.4
   */
  private determineRiskLevel(
    drawdown: DrawdownAnalysis,
    stressTests: StressTestResult[],
    leverage: LeverageAssessment
  ): RiskLevel {
    // Check for CRITICAL conditions
    if (this.isCriticalRisk(drawdown, stressTests, leverage)) {
      return 'CRITICAL';
    }

    // Check for HIGH conditions
    if (this.isHighRisk(drawdown, stressTests, leverage)) {
      return 'HIGH';
    }

    // Check for MEDIUM conditions
    if (this.isMediumRisk(drawdown, leverage)) {
      return 'MEDIUM';
    }

    // Default to LOW
    return 'LOW';
  }

  /**
   * Check if portfolio is in CRITICAL risk state
   */
  private isCriticalRisk(
    drawdown: DrawdownAnalysis,
    stressTests: StressTestResult[],
    leverage: LeverageAssessment
  ): boolean {
    // Drawdown > 25%
    if (drawdown.current_drawdown > this.DRAWDOWN_THRESHOLDS.CRITICAL) {
      return true;
    }

    // Leverage > 3x
    if (leverage.current_leverage > this.LEVERAGE_THRESHOLDS.CRITICAL) {
      return true;
    }

    // Margin call risk in mild (-10%) scenario
    const mildScenario = stressTests.find((s) => s.scenario === 'Market -10%');
    if (mildScenario?.margin_call_risk) {
      return true;
    }

    // Margin safety is danger
    if (leverage.margin_safety === 'danger') {
      return true;
    }

    return false;
  }

  /**
   * Check if portfolio is in HIGH risk state
   */
  private isHighRisk(
    drawdown: DrawdownAnalysis,
    stressTests: StressTestResult[],
    leverage: LeverageAssessment
  ): boolean {
    // Drawdown > 15%
    if (drawdown.current_drawdown > this.DRAWDOWN_THRESHOLDS.MEDIUM) {
      return true;
    }

    // Leverage > 2x
    if (leverage.current_leverage > this.LEVERAGE_THRESHOLDS.MEDIUM) {
      return true;
    }

    // Margin call risk in moderate (-20%) scenario
    const moderateScenario = stressTests.find((s) => s.scenario === 'Market -20%');
    if (moderateScenario?.margin_call_risk) {
      return true;
    }

    return false;
  }

  /**
   * Check if portfolio is in MEDIUM risk state
   */
  private isMediumRisk(
    drawdown: DrawdownAnalysis,
    leverage: LeverageAssessment
  ): boolean {
    // Drawdown > 10%
    if (drawdown.current_drawdown > this.DRAWDOWN_THRESHOLDS.LOW) {
      return true;
    }

    // Leverage > 1.5x
    if (leverage.current_leverage > this.LEVERAGE_THRESHOLDS.LOW) {
      return true;
    }

    // Margin safety is warning
    if (leverage.margin_safety === 'warning') {
      return true;
    }

    return false;
  }

  // ===========================================================================
  // ===========================================================================
  // Summary Generation (Requirement 3.5)
  // ===========================================================================

  /**
   * Generate human-readable summary of risk analysis (Chinese)
   *
   * @param riskLevel - Overall risk level
   * @param drawdown - Drawdown analysis results
   * @param leverage - Leverage assessment results
   * @returns Summary string
   *
   * @see Requirements 3.5
   */
  private generateSummary(
    riskLevel: RiskLevel,
    drawdown: DrawdownAnalysis,
    leverage: LeverageAssessment
  ): string {
    const parts: string[] = [];

    // Risk level statement in Chinese
    const riskLevelChinese: Record<RiskLevel, string> = {
      LOW: '低风险',
      MEDIUM: '中等风险',
      HIGH: '高风险',
      CRITICAL: '危险',
    };
    
    parts.push(`投资组合风险等级: ${riskLevelChinese[riskLevel]}。`);

    // Drawdown status
    if (drawdown.current_drawdown > 0) {
      parts.push(
        `当前回撤 ${drawdown.current_drawdown.toFixed(1)}%，距离高水位 ${this.formatCurrency(drawdown.high_water_mark)}。`
      );
    } else {
      parts.push('投资组合处于或接近历史新高。');
    }

    // Leverage status
    if (leverage.margin_loan > 0) {
      parts.push(
        `杠杆率: ${leverage.current_leverage.toFixed(2)}倍，融资余额 ${this.formatCurrency(leverage.margin_loan)}。`
      );
      
      const marginSafetyChinese: Record<string, string> = {
        safe: '安全',
        warning: '警告',
        danger: '危险',
      };
      parts.push(`保证金安全状态: ${marginSafetyChinese[leverage.margin_safety]}。`);

      if (leverage.available_margin > 0) {
        parts.push(
          `可用保证金: ${this.formatCurrency(leverage.available_margin)}。`
        );
      }
    } else {
      parts.push('无融资借款 - 无杠杆投资组合。');
    }

    // Risk-specific recommendations in Chinese
    switch (riskLevel) {
      case 'CRITICAL':
        parts.push(
          '紧急: 建议立即通过减仓或降杠杆来降低风险。'
        );
        break;
      case 'HIGH':
        parts.push(
          '建议审视持仓并考虑风险控制策略。'
        );
        break;
      case 'MEDIUM':
        parts.push('请密切关注持仓，保持风险意识。');
        break;
      case 'LOW':
        parts.push('风险指标在可接受范围内。');
        break;
    }

    return parts.join(' ');
  }

  /**
   * Format currency value for display
   */
  private formatCurrency(value: number): string {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  // ===========================================================================
  // State Persistence
  // ===========================================================================

  /**
   * Save agent's internal state for persistence
   *
   * @returns Serializable state object
   */
  saveState(): AgentState {
    return {
      agentId: this.id,
      timestamp: Date.now(),
      internalState: { ...this.internalState },
      messageHistory: [...this.messageHistory],
    };
  }

  /**
   * Restore agent's internal state
   *
   * @param state - Previously saved state object
   */
  loadState(state: AgentState): void {
    if (state.agentId !== this.id) {
      console.warn(`State agent ID mismatch: expected ${this.id}, got ${state.agentId}`);
      return;
    }

    this.internalState = { ...state.internalState };
    this.messageHistory = [...state.messageHistory];
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new Risk Analyst Agent instance
 *
 * @param options - Optional configuration
 * @returns Configured Risk Analyst Agent
 *
 * @example
 * ```typescript
 * const riskAnalyst = createRiskAnalystAgent();
 * const result = await riskAnalyst.execute(context, portfolio);
 * ```
 */
export function createRiskAnalystAgent(options?: {
  personality?: AgentPersonality;
  memory?: AgentMemoryConfig;
}): RiskAnalystAgent {
  const agent = new RiskAnalystAgent();

  if (options?.personality) {
    agent.personality = options.personality;
  }

  if (options?.memory) {
    agent.memory = options.memory;
  }

  return agent;
}

// =============================================================================
// Exports
// =============================================================================

export default RiskAnalystAgent;
