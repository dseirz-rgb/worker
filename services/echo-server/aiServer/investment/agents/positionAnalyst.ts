/**
 * Position Analyst Agent
 * 
 * 从 packages/riskcontrol/src/services/agents/positionAnalyst.ts 移植
 * 分析投资组合结构、集中度风险、相关性风险和绩效归因
 * 
 * @module services/echo-server/aiServer/investment/agents/positionAnalyst
 */

import type {
  Agent,
  AgentResult,
  AgentContext,
  PortfolioState,
  Position,
} from '../orchestrator';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 集中度分析结果
 */
export interface ConcentrationAnalysis {
  top3_positions: Array<{ ticker: string; weight: number }>;
  top3_total_weight: number;
  high_concentration_flags: string[];
  herfindahl_index: number;
}

/**
 * 相关性风险
 */
export interface CorrelationRisk {
  tickers: string[];
  correlationType: 'sector' | 'industry' | 'market';
  description: string;
  combinedWeight: number;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * 绩效归因
 */
export interface PerformanceAttribution {
  ticker: string;
  unrealizedPnL: number;
  pnlPercent: number;
  portfolioContribution: number;
  weight: number;
}

/**
 * 绩效归因摘要
 */
export interface PerformanceAttributionSummary {
  totalUnrealizedPnL: number;
  totalPnLPercent: number;
  topGainers: PerformanceAttribution[];
  topLosers: PerformanceAttribution[];
  allPositions: PerformanceAttribution[];
}

// ============================================================================
// 行业分类映射
// ============================================================================

const SECTOR_MAPPING: Record<string, string> = {
  // 科技
  AAPL: 'Technology', MSFT: 'Technology', GOOGL: 'Technology',
  META: 'Technology', NVDA: 'Technology', AMD: 'Technology',
  // 金融
  JPM: 'Financials', BAC: 'Financials', GS: 'Financials',
  V: 'Financials', MA: 'Financials',
  // 医疗
  JNJ: 'Healthcare', UNH: 'Healthcare', PFE: 'Healthcare',
  // 消费
  AMZN: 'Consumer', TSLA: 'Consumer', HD: 'Consumer',
  // 能源
  XOM: 'Energy', CVX: 'Energy',
};

// ============================================================================
// 辅助函数
// ============================================================================

function getSector(position: Position): string {
  if (position.sector) return position.sector;
  return SECTOR_MAPPING[position.ticker.toUpperCase()] || 'Unknown';
}

function calculateHHI(positions: Position[]): number {
  return positions.reduce((sum, p) => {
    const weight = p.weight / 100;
    return sum + Math.pow(weight, 2);
  }, 0);
}

function groupBySector(positions: Position[]): Map<string, Position[]> {
  const groups = new Map<string, Position[]>();
  for (const position of positions) {
    const sector = getSector(position);
    const existing = groups.get(sector) || [];
    existing.push(position);
    groups.set(sector, existing);
  }
  return groups;
}

// ============================================================================
// Position Analyst Agent
// ============================================================================

/**
 * Position Analyst Agent
 * 
 * 分析投资组合结构，识别集中度风险、相关性风险和绩效驱动因素
 */
export class PositionAnalystAgent implements Agent {
  id = 'position_analyst';
  role = '投资组合结构分析师';
  goal = '分析投资组合集中度、相关性风险和绩效归因';
  description = '分析投资组合结构，识别集中度风险、相关性持仓和绩效驱动因素。应首先调用以了解投资组合构成。';

  /**
   * 执行分析
   */
  async execute(
    context: AgentContext,
    portfolio: PortfolioState
  ): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // 1. 集中度分析
      const concentrationAnalysis = this.analyzeConcentration(portfolio);

      // 2. 相关性风险检测
      const correlationRisks = this.detectCorrelationRisks(portfolio);

      // 3. 绩效归因
      const performanceAttribution = this.calculatePerformanceAttribution(portfolio);

      // 4. 生成摘要
      const summary = this.generateSummary(
        concentrationAnalysis,
        correlationRisks,
        performanceAttribution
      );

      return {
        agentId: this.id,
        status: 'success',
        data: {
          concentration_analysis: concentrationAnalysis,
          correlation_risks: correlationRisks,
          performance_attribution: performanceAttribution,
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
        summary: `持仓分析失败: ${(error as Error).message}`,
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
   * 分析集中度
   */
  private analyzeConcentration(portfolio: PortfolioState): ConcentrationAnalysis {
    const positions = portfolio.positions;

    if (positions.length === 0) {
      return {
        top3_positions: [],
        top3_total_weight: 0,
        high_concentration_flags: [],
        herfindahl_index: 0,
      };
    }

    // 按权重排序
    const sorted = [...positions].sort((a, b) => b.weight - a.weight);

    // 前 3 大持仓
    const top3 = sorted.slice(0, 3);
    const top3TotalWeight = top3.reduce((sum, p) => sum + p.weight, 0);

    // HHI 指数
    const hhi = calculateHHI(positions);

    // 高集中度标记 (>30%)
    const highConcentrationFlags = positions
      .filter(p => p.weight > 30)
      .map(p => p.ticker);

    return {
      top3_positions: top3.map(p => ({ ticker: p.ticker, weight: p.weight })),
      top3_total_weight: top3TotalWeight,
      high_concentration_flags: highConcentrationFlags,
      herfindahl_index: hhi,
    };
  }

  /**
   * 检测相关性风险
   */
  private detectCorrelationRisks(portfolio: PortfolioState): CorrelationRisk[] {
    const risks: CorrelationRisk[] = [];
    const positions = portfolio.positions;

    if (positions.length < 2) return risks;

    // 按行业分组
    const sectorGroups = groupBySector(positions);

    for (const [sector, sectorPositions] of Array.from(sectorGroups.entries())) {
      if (sector === 'Unknown' || sectorPositions.length < 2) continue;

      const combinedWeight = sectorPositions.reduce((sum, p) => sum + p.weight, 0);

      // 行业权重 > 25% 标记为风险
      if (combinedWeight > 25) {
        const riskLevel = combinedWeight > 50 ? 'high' : combinedWeight > 35 ? 'medium' : 'low';

        risks.push({
          tickers: sectorPositions.map(p => p.ticker),
          correlationType: 'sector',
          description: `${sectorPositions.length} 个持仓在 ${sector} 行业，合计权重 ${combinedWeight.toFixed(1)}%`,
          combinedWeight,
          riskLevel,
        });
      }
    }

    return risks.sort((a, b) => b.combinedWeight - a.combinedWeight);
  }

  /**
   * 计算绩效归因
   */
  private calculatePerformanceAttribution(
    portfolio: PortfolioState
  ): PerformanceAttributionSummary {
    const positions = portfolio.positions;

    if (positions.length === 0) {
      return {
        totalUnrealizedPnL: 0,
        totalPnLPercent: 0,
        topGainers: [],
        topLosers: [],
        allPositions: [],
      };
    }

    const totalCostBasis = positions.reduce((sum, p) => sum + p.costBasis, 0);
    const totalUnrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
    const totalPnLPercent = totalCostBasis > 0 ? (totalUnrealizedPnL / totalCostBasis) * 100 : 0;

    const allPositions: PerformanceAttribution[] = positions.map(p => {
      const pnlPercent = p.costBasis > 0 ? (p.unrealizedPnL / p.costBasis) * 100 : 0;
      const portfolioContribution = totalCostBasis > 0 ? (p.unrealizedPnL / totalCostBasis) * 100 : 0;

      return {
        ticker: p.ticker,
        unrealizedPnL: p.unrealizedPnL,
        pnlPercent,
        portfolioContribution,
        weight: p.weight,
      };
    });

    const sortedByContribution = [...allPositions].sort(
      (a, b) => b.portfolioContribution - a.portfolioContribution
    );

    const topGainers = sortedByContribution.filter(p => p.portfolioContribution > 0).slice(0, 3);
    const topLosers = sortedByContribution
      .filter(p => p.portfolioContribution < 0)
      .sort((a, b) => a.portfolioContribution - b.portfolioContribution)
      .slice(0, 3);

    return {
      totalUnrealizedPnL,
      totalPnLPercent,
      topGainers,
      topLosers,
      allPositions,
    };
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    concentration: ConcentrationAnalysis,
    correlationRisks: CorrelationRisk[],
    performance: PerformanceAttributionSummary
  ): string {
    const parts: string[] = [];

    // 集中度摘要
    if (concentration.high_concentration_flags.length > 0) {
      parts.push(
        `⚠️ 检测到高集中度持仓: ${concentration.high_concentration_flags.join(', ')} (每个超过30%权重)。`
      );
    }

    parts.push(
      `前3大持仓 (${concentration.top3_positions.map(p => p.ticker).join(', ')}) 占投资组合的 ${concentration.top3_total_weight.toFixed(1)}%。`
    );

    // HHI 解读
    const hhiInterpretation = concentration.herfindahl_index < 0.15
      ? '低集中度 - 分散良好'
      : concentration.herfindahl_index < 0.25
        ? '中等集中度'
        : '高集中度 - 建议分散投资';
    parts.push(`投资组合集中度 (HHI): ${hhiInterpretation}。`);

    // 相关性风险
    const highRisks = correlationRisks.filter(r => r.riskLevel === 'high');
    if (highRisks.length > 0) {
      parts.push(
        `⚠️ 检测到 ${highRisks.length} 个高相关性风险: ${highRisks.map(r => r.description).join('; ')}。`
      );
    }

    // 绩效摘要
    if (performance.topGainers.length > 0) {
      const topGainer = performance.topGainers[0];
      parts.push(
        `表现最佳: ${topGainer.ticker} 贡献 +${topGainer.portfolioContribution.toFixed(2)}% 投资组合收益。`
      );
    }

    if (performance.topLosers.length > 0) {
      const topLoser = performance.topLosers[0];
      parts.push(
        `最大拖累: ${topLoser.ticker} 贡献 ${topLoser.portfolioContribution.toFixed(2)}% 投资组合收益。`
      );
    }

    return parts.join(' ');
  }
}

/**
 * 创建 Position Analyst Agent
 */
export function createPositionAnalystAgent(): PositionAnalystAgent {
  return new PositionAnalystAgent();
}

export default PositionAnalystAgent;
