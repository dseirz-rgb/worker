/**
 * Advisor Agent
 * 
 * 从 packages/riskcontrol/src/services/agents/advisorAgent.ts 移植
 * 综合所有分析结果，生成最终建议和报告
 * 
 * @module services/echo-server/aiServer/investment/agents/advisorAgent
 */

import type {
  Agent,
  AgentResult,
  AgentContext,
  PortfolioState,
  FinalReport,
} from '../orchestrator';
import type { RiskLevel } from '../types';

// ============================================================================
// Advisor Agent
// ============================================================================

/**
 * Advisor Agent
 * 
 * 综合所有分析结果，生成最终建议和报告
 */
export class AdvisorAgent implements Agent {
  id = 'advisor';
  role = '投资顾问';
  goal = '综合分析结果，生成投资建议和行动计划';
  description = '综合所有分析师的结果，生成最终的投资建议和行动计划。应在所有分析完成后调用。';

  /**
   * 执行分析
   */
  async execute(
    context: AgentContext,
    portfolio: PortfolioState
  ): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // 获取之前的分析结果
      const positionResult = context.previousResults.get('position_analyst');
      const riskResult = context.previousResults.get('risk_analyst');
      const marketResult = context.previousResults.get('market_analyst');

      // 综合分析
      const analysis = this.synthesizeAnalysis(positionResult, riskResult, marketResult);

      // 生成最终报告
      const report = this.generateReport(analysis, portfolio, context.query);

      // 生成摘要
      const summary = this.generateSummary(report);

      return {
        agentId: this.id,
        status: 'success',
        data: {
          analysis,
          report,
        },
        summary,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          tokensUsed: 0,
          dataSources: ['previous_results'],
        },
      };
    } catch (error) {
      return {
        agentId: this.id,
        status: 'failed',
        data: {},
        summary: `投资建议生成失败: ${(error as Error).message}`,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          tokensUsed: 0,
          dataSources: ['previous_results'],
          error: (error as Error).message,
        },
      };
    }
  }

  /**
   * 综合分析
   */
  private synthesizeAnalysis(
    positionResult?: AgentResult,
    riskResult?: AgentResult,
    marketResult?: AgentResult
  ): {
    keyFindings: string[];
    riskFactors: string[];
    opportunities: string[];
    overallRiskLevel: RiskLevel;
  } {
    const keyFindings: string[] = [];
    const riskFactors: string[] = [];
    const opportunities: string[] = [];
    let overallRiskLevel: RiskLevel = 'LOW';

    // 从持仓分析提取
    if (positionResult?.status === 'success') {
      const data = positionResult.data;
      
      // 集中度风险
      const concentration = data.concentration_analysis as {
        high_concentration_flags?: string[];
        top3_total_weight?: number;
      } | undefined;
      
      if (concentration?.high_concentration_flags?.length) {
        riskFactors.push(`高集中度持仓: ${concentration.high_concentration_flags.join(', ')}`);
      }
      
      if (concentration?.top3_total_weight && concentration.top3_total_weight > 60) {
        riskFactors.push(`前3大持仓占比过高 (${concentration.top3_total_weight.toFixed(1)}%)`);
      }

      // 相关性风险
      const correlationRisks = data.correlation_risks as Array<{
        riskLevel: string;
        description: string;
      }> | undefined;
      
      const highCorrelationRisks = correlationRisks?.filter(r => r.riskLevel === 'high') || [];
      if (highCorrelationRisks.length > 0) {
        riskFactors.push(...highCorrelationRisks.map(r => r.description));
      }

      // 绩效归因
      const performance = data.performance_attribution as {
        topGainers?: Array<{ ticker: string; portfolioContribution: number }>;
        topLosers?: Array<{ ticker: string; portfolioContribution: number }>;
      } | undefined;
      
      if (performance?.topGainers?.length) {
        keyFindings.push(`表现最佳: ${performance.topGainers[0].ticker}`);
      }
      if (performance?.topLosers?.length) {
        keyFindings.push(`最大拖累: ${performance.topLosers[0].ticker}`);
      }
    }

    // 从风险分析提取
    if (riskResult?.status === 'success') {
      const data = riskResult.data;
      
      // 风险等级
      const riskLevel = data.risk_level as RiskLevel | undefined;
      if (riskLevel) {
        overallRiskLevel = riskLevel;
      }

      // 回撤
      const drawdown = data.drawdown_analysis as {
        currentDrawdown?: number;
      } | undefined;
      
      if (drawdown?.currentDrawdown && drawdown.currentDrawdown > 10) {
        riskFactors.push(`当前回撤 ${drawdown.currentDrawdown.toFixed(1)}%`);
      }

      // 杠杆
      const leverage = data.leverage_assessment as {
        marginSafety?: string;
        currentLeverage?: number;
      } | undefined;
      
      if (leverage?.marginSafety === 'danger') {
        riskFactors.push(`杠杆过高 (${leverage.currentLeverage?.toFixed(2)}x)`);
        overallRiskLevel = 'HIGH';
      }

      // 压力测试
      const stressTests = data.stress_tests as Array<{
        marginCallRisk: boolean;
        scenario: string;
      }> | undefined;
      
      const marginCallScenarios = stressTests?.filter(s => s.marginCallRisk) || [];
      if (marginCallScenarios.length > 0) {
        riskFactors.push(`${marginCallScenarios.length} 个场景可能触发追保`);
      }
    }

    // 从市场分析提取
    if (marketResult?.status === 'success') {
      const data = marketResult.data;
      
      const marketSentiment = data.market_sentiment as {
        overall?: string;
      } | undefined;
      
      if (marketSentiment?.overall === 'bullish') {
        opportunities.push('市场情绪偏多，可考虑适度加仓');
      } else if (marketSentiment?.overall === 'bearish') {
        riskFactors.push('市场情绪偏空，注意风险控制');
      }
    }

    return {
      keyFindings,
      riskFactors,
      opportunities,
      overallRiskLevel,
    };
  }

  /**
   * 生成报告
   */
  private generateReport(
    analysis: {
      keyFindings: string[];
      riskFactors: string[];
      opportunities: string[];
      overallRiskLevel: RiskLevel;
    },
    portfolio: PortfolioState,
    query: string
  ): FinalReport {
    // 确定建议类型
    let recommendation: 'BUY' | 'SELL' | 'HOLD' | 'REBALANCE' | 'WARNING' = 'HOLD';
    
    if (analysis.overallRiskLevel === 'CRITICAL') {
      recommendation = 'WARNING';
    } else if (analysis.overallRiskLevel === 'HIGH') {
      recommendation = 'REBALANCE';
    } else if (analysis.riskFactors.length === 0 && analysis.opportunities.length > 0) {
      recommendation = 'BUY';
    }

    // 生成行动计划
    const actionPlan = this.generateActionPlan(analysis, recommendation);

    // 生成内容
    const content = this.generateContent(analysis, portfolio);

    // 找出主要关注的 ticker
    const primaryTicker = portfolio.positions.length > 0
      ? portfolio.positions.sort((a, b) => b.weight - a.weight)[0].ticker
      : '';

    return {
      title: `投资组合分析报告 - ${new Date().toLocaleDateString('zh-CN')}`,
      riskLevel: analysis.overallRiskLevel,
      summary: this.generateReportSummary(analysis),
      content,
      recommendation,
      actionPlan,
      primaryTicker,
    };
  }

  /**
   * 生成行动计划
   */
  private generateActionPlan(
    analysis: {
      riskFactors: string[];
      opportunities: string[];
      overallRiskLevel: RiskLevel;
    },
    recommendation: string
  ): string {
    const actions: string[] = [];

    switch (recommendation) {
      case 'WARNING':
        actions.push('1. 立即评估杠杆水平，考虑减仓降低风险');
        actions.push('2. 设置止损点位，保护本金');
        actions.push('3. 暂停新增投资，等待市场稳定');
        break;
      case 'REBALANCE':
        actions.push('1. 检查高集中度持仓，考虑分散投资');
        actions.push('2. 评估相关性风险，减少同行业敞口');
        actions.push('3. 定期复盘，调整投资策略');
        break;
      case 'BUY':
        actions.push('1. 在当前价位可考虑适度加仓');
        actions.push('2. 关注市场机会，但保持纪律');
        actions.push('3. 设置目标价位和止盈点');
        break;
      default:
        actions.push('1. 维持当前持仓，继续观察');
        actions.push('2. 关注市场动态和公司基本面');
        actions.push('3. 定期复盘投资组合表现');
    }

    return actions.join('\n');
  }

  /**
   * 生成报告内容
   */
  private generateContent(
    analysis: {
      keyFindings: string[];
      riskFactors: string[];
      opportunities: string[];
    },
    portfolio: PortfolioState
  ): string {
    const sections: string[] = [];

    // 投资组合概况
    sections.push(`## 投资组合概况\n`);
    sections.push(`- 总资产: ¥${portfolio.totalValue.toLocaleString()}`);
    sections.push(`- 持仓数量: ${portfolio.positions.length}`);
    sections.push(`- 现金比例: ${((portfolio.cashBalance / portfolio.totalValue) * 100).toFixed(1)}%`);

    // 关键发现
    if (analysis.keyFindings.length > 0) {
      sections.push(`\n## 关键发现\n`);
      analysis.keyFindings.forEach(f => sections.push(`- ${f}`));
    }

    // 风险因素
    if (analysis.riskFactors.length > 0) {
      sections.push(`\n## 风险因素\n`);
      analysis.riskFactors.forEach(r => sections.push(`- ⚠️ ${r}`));
    }

    // 机会
    if (analysis.opportunities.length > 0) {
      sections.push(`\n## 投资机会\n`);
      analysis.opportunities.forEach(o => sections.push(`- ✅ ${o}`));
    }

    return sections.join('\n');
  }

  /**
   * 生成报告摘要
   */
  private generateReportSummary(analysis: {
    keyFindings: string[];
    riskFactors: string[];
    opportunities: string[];
    overallRiskLevel: RiskLevel;
  }): string {
    const riskEmoji = {
      LOW: '🟢',
      MEDIUM: '🟡',
      HIGH: '🟠',
      CRITICAL: '🔴',
    }[analysis.overallRiskLevel];

    const parts: string[] = [];
    parts.push(`${riskEmoji} 整体风险等级: ${analysis.overallRiskLevel}`);

    if (analysis.riskFactors.length > 0) {
      parts.push(`发现 ${analysis.riskFactors.length} 个风险因素需要关注`);
    }

    if (analysis.opportunities.length > 0) {
      parts.push(`识别 ${analysis.opportunities.length} 个潜在机会`);
    }

    return parts.join('。');
  }

  /**
   * 生成摘要
   */
  private generateSummary(report: FinalReport): string {
    return `${report.summary}。建议: ${report.recommendation}。`;
  }
}

/**
 * 创建 Advisor Agent
 */
export function createAdvisorAgent(): AdvisorAgent {
  return new AdvisorAgent();
}

export default AdvisorAgent;
