/**
 * Risk Analyst Agent
 * 
 * 从 packages/riskcontrol/src/services/agents/riskAnalyst.ts 移植
 * 分析投资组合风险：压力测试、回撤分析、杠杆评估
 * 
 * @module services/echo-server/aiServer/investment/agents/riskAnalyst
 */

import type {
  Agent,
  AgentResult,
  AgentContext,
  PortfolioState,
} from '../orchestrator';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 压力测试结果
 */
export interface StressTestResult {
  scenario: string;
  portfolioImpact: number;
  marginCallRisk: boolean;
  recoveryNeeded: number;
}

/**
 * 回撤分析
 */
export interface DrawdownAnalysis {
  currentDrawdown: number;
  highWaterMark: number;
  currentValue: number;
  daysSincePeak: number;
}

/**
 * 杠杆评估
 */
export interface LeverageAssessment {
  currentLeverage: number;
  marginLoan: number;
  availableMargin: number;
  marginSafety: 'safe' | 'warning' | 'danger';
}

// ============================================================================
// Risk Analyst Agent
// ============================================================================

/**
 * Risk Analyst Agent
 * 
 * 分析投资组合风险，包括压力测试、回撤分析和杠杆评估
 */
export class RiskAnalystAgent implements Agent {
  id = 'risk_analyst';
  role = '风险分析师';
  goal = '评估投资组合风险，进行压力测试和回撤分析';
  description = '分析投资组合风险，包括压力测试、回撤分析和杠杆评估。在持仓分析后调用以评估风险敞口。';

  /**
   * 执行分析
   */
  async execute(
    context: AgentContext,
    portfolio: PortfolioState
  ): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // 1. 压力测试
      const stressTests = this.runStressTests(portfolio);

      // 2. 回撤分析
      const drawdownAnalysis = this.analyzeDrawdown(portfolio);

      // 3. 杠杆评估
      const leverageAssessment = this.assessLeverage(portfolio);

      // 4. 计算风险等级
      const riskLevel = this.calculateRiskLevel(stressTests, drawdownAnalysis, leverageAssessment);

      // 5. 生成摘要
      const summary = this.generateSummary(stressTests, drawdownAnalysis, leverageAssessment, riskLevel);

      return {
        agentId: this.id,
        status: 'success',
        data: {
          stress_tests: stressTests,
          drawdown_analysis: drawdownAnalysis,
          leverage_assessment: leverageAssessment,
          risk_level: riskLevel,
        },
        summary,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          tokensUsed: 0,
          dataSources: ['portfolio_data'],
        },
      };
    } catch (error) {
      return {
        agentId: this.id,
        status: 'failed',
        data: {},
        summary: `风险分析失败: ${(error as Error).message}`,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          tokensUsed: 0,
          dataSources: ['portfolio_data'],
          error: (error as Error).message,
        },
      };
    }
  }

  /**
   * 运行压力测试
   */
  private runStressTests(portfolio: PortfolioState): StressTestResult[] {
    const scenarios = [
      { name: '市场下跌 10%', impact: -0.10 },
      { name: '市场下跌 20%', impact: -0.20 },
      { name: '市场下跌 30%', impact: -0.30 },
      { name: '科技股暴跌 40%', impact: -0.25 }, // 假设科技股占比 60%
    ];

    return scenarios.map(scenario => {
      const portfolioImpact = scenario.impact * 100;
      const projectedValue = portfolio.totalValue * (1 + scenario.impact);
      const marginCallRisk = portfolio.marginLoan > 0 && projectedValue < portfolio.marginLoan * 1.3;
      const recoveryNeeded = scenario.impact !== 0 ? Math.abs(scenario.impact / (1 + scenario.impact)) * 100 : 0;

      return {
        scenario: scenario.name,
        portfolioImpact,
        marginCallRisk,
        recoveryNeeded,
      };
    });
  }

  /**
   * 分析回撤
   */
  private analyzeDrawdown(portfolio: PortfolioState): DrawdownAnalysis {
    const currentDrawdown = portfolio.highWaterMark > 0
      ? ((portfolio.highWaterMark - portfolio.totalValue) / portfolio.highWaterMark) * 100
      : 0;

    // 简化：假设高水位是 30 天前
    const daysSincePeak = currentDrawdown > 0 ? 30 : 0;

    return {
      currentDrawdown: Math.max(0, currentDrawdown),
      highWaterMark: portfolio.highWaterMark,
      currentValue: portfolio.totalValue,
      daysSincePeak,
    };
  }

  /**
   * 评估杠杆
   */
  private assessLeverage(portfolio: PortfolioState): LeverageAssessment {
    const currentLeverage = portfolio.marginLoan > 0
      ? (portfolio.totalValue + portfolio.marginLoan) / portfolio.totalValue
      : 1;

    const availableMargin = Math.max(0, portfolio.totalValue * 0.5 - portfolio.marginLoan);

    let marginSafety: 'safe' | 'warning' | 'danger' = 'safe';
    if (currentLeverage > 2.5) {
      marginSafety = 'danger';
    } else if (currentLeverage > 1.5) {
      marginSafety = 'warning';
    }

    return {
      currentLeverage,
      marginLoan: portfolio.marginLoan,
      availableMargin,
      marginSafety,
    };
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(
    stressTests: StressTestResult[],
    drawdown: DrawdownAnalysis,
    leverage: LeverageAssessment
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    let riskScore = 0;

    // 压力测试风险
    const marginCallScenarios = stressTests.filter(s => s.marginCallRisk).length;
    if (marginCallScenarios >= 2) riskScore += 3;
    else if (marginCallScenarios >= 1) riskScore += 2;

    // 回撤风险
    if (drawdown.currentDrawdown > 20) riskScore += 3;
    else if (drawdown.currentDrawdown > 10) riskScore += 2;
    else if (drawdown.currentDrawdown > 5) riskScore += 1;

    // 杠杆风险
    if (leverage.marginSafety === 'danger') riskScore += 3;
    else if (leverage.marginSafety === 'warning') riskScore += 2;

    // 风险等级映射
    if (riskScore >= 7) return 'CRITICAL';
    if (riskScore >= 5) return 'HIGH';
    if (riskScore >= 3) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    stressTests: StressTestResult[],
    drawdown: DrawdownAnalysis,
    leverage: LeverageAssessment,
    riskLevel: string
  ): string {
    const parts: string[] = [];

    // 风险等级
    const riskEmoji = {
      LOW: '🟢',
      MEDIUM: '🟡',
      HIGH: '🟠',
      CRITICAL: '🔴',
    }[riskLevel] || '⚪';
    parts.push(`${riskEmoji} 整体风险等级: ${riskLevel}`);

    // 回撤状态
    if (drawdown.currentDrawdown > 0) {
      parts.push(`当前回撤: ${drawdown.currentDrawdown.toFixed(1)}% (距高点 ${drawdown.daysSincePeak} 天)`);
    } else {
      parts.push('当前处于历史高点附近');
    }

    // 杠杆状态
    if (leverage.currentLeverage > 1) {
      const leverageEmoji = leverage.marginSafety === 'danger' ? '⚠️' : leverage.marginSafety === 'warning' ? '⚡' : '✅';
      parts.push(`${leverageEmoji} 杠杆倍数: ${leverage.currentLeverage.toFixed(2)}x (${leverage.marginSafety})`);
    }

    // 压力测试警告
    const marginCallScenarios = stressTests.filter(s => s.marginCallRisk);
    if (marginCallScenarios.length > 0) {
      parts.push(`⚠️ ${marginCallScenarios.length} 个场景可能触发追保: ${marginCallScenarios.map(s => s.scenario).join(', ')}`);
    }

    return parts.join('。');
  }
}

/**
 * 创建 Risk Analyst Agent
 */
export function createRiskAnalystAgent(): RiskAnalystAgent {
  return new RiskAnalystAgent();
}

export default RiskAnalystAgent;
