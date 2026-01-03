/**
 * Position Analyst Agent
 *
 * Analyzes portfolio structure, concentration risks, correlation patterns,
 * and performance attribution. This agent is typically the first to execute
 * in the multi-agent analysis pipeline.
 *
 * Features:
 * - Concentration Analysis: Top holdings, HHI index, high concentration flags
 * - Correlation Risk Detection: Same-sector holdings, correlated positions
 * - Performance Attribution: P&L contribution by position
 * - AI Summary Generation: Gemini-powered analysis summaries
 *
 * @module agents/positionAnalyst
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for detailed design
 */

import type {
  Agent,
  AgentContext,
  AgentResult,
  AgentState,
  AgentMessage,
  PortfolioState,
  Position,
  ConcentrationAnalysis,
  AgentPersonality,
  AgentMemoryConfig,
} from './types';
import { generatePersonalityPrompt } from './personality';

// =============================================================================
// Types
// =============================================================================

/**
 * Correlation risk entry identifying related positions
 */
export interface CorrelationRisk {
  /** Tickers that are correlated */
  tickers: string[];
  /** Type of correlation (sector, industry, etc.) */
  correlationType: 'sector' | 'industry' | 'market' | 'custom';
  /** Description of the correlation */
  description: string;
  /** Combined weight of correlated positions */
  combinedWeight: number;
  /** Risk level assessment */
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Performance attribution entry for a single position
 */
export interface PerformanceAttribution {
  /** Stock ticker */
  ticker: string;
  /** Unrealized P&L amount */
  unrealizedPnL: number;
  /** P&L as percentage of cost basis */
  pnlPercent: number;
  /** Contribution to total portfolio P&L */
  portfolioContribution: number;
  /** Position weight in portfolio */
  weight: number;
}

/**
 * Summary of performance attribution analysis
 */
export interface PerformanceAttributionSummary {
  /** Total unrealized P&L */
  totalUnrealizedPnL: number;
  /** Total P&L as percentage */
  totalPnLPercent: number;
  /** Top gainers by contribution */
  topGainers: PerformanceAttribution[];
  /** Top losers by contribution */
  topLosers: PerformanceAttribution[];
  /** All position attributions */
  allPositions: PerformanceAttribution[];
}

/**
 * Internal state for the Position Analyst Agent
 */
interface PositionAnalystInternalState {
  /** Last analyzed tickers */
  lastAnalyzedTickers: string[];
  /** Number of analyses performed */
  analysisCount: number;
  /** Last analysis timestamp */
  lastAnalysisTimestamp: number;
}

// =============================================================================
// Sector Classification
// =============================================================================

/**
 * Sector classification mapping for common stocks
 * This is a simplified mapping - in production, use a proper data source
 */
const SECTOR_MAPPING: Record<string, string> = {
  // Technology
  AAPL: 'Technology',
  MSFT: 'Technology',
  GOOGL: 'Technology',
  GOOG: 'Technology',
  META: 'Technology',
  NVDA: 'Technology',
  AMD: 'Technology',
  INTC: 'Technology',
  CRM: 'Technology',
  ADBE: 'Technology',
  ORCL: 'Technology',
  CSCO: 'Technology',
  IBM: 'Technology',
  QCOM: 'Technology',
  TXN: 'Technology',
  AVGO: 'Technology',
  MU: 'Technology',
  NOW: 'Technology',
  SNOW: 'Technology',
  PLTR: 'Technology',

  // Financials
  JPM: 'Financials',
  BAC: 'Financials',
  WFC: 'Financials',
  GS: 'Financials',
  MS: 'Financials',
  C: 'Financials',
  BLK: 'Financials',
  SCHW: 'Financials',
  AXP: 'Financials',
  V: 'Financials',
  MA: 'Financials',
  PYPL: 'Financials',
  SQ: 'Financials',
  COIN: 'Financials',

  // Healthcare
  JNJ: 'Healthcare',
  UNH: 'Healthcare',
  PFE: 'Healthcare',
  ABBV: 'Healthcare',
  MRK: 'Healthcare',
  LLY: 'Healthcare',
  TMO: 'Healthcare',
  ABT: 'Healthcare',
  DHR: 'Healthcare',
  BMY: 'Healthcare',
  AMGN: 'Healthcare',
  GILD: 'Healthcare',
  ISRG: 'Healthcare',
  CVS: 'Healthcare',
  CI: 'Healthcare',

  // Consumer
  AMZN: 'Consumer Discretionary',
  TSLA: 'Consumer Discretionary',
  HD: 'Consumer Discretionary',
  NKE: 'Consumer Discretionary',
  MCD: 'Consumer Discretionary',
  SBUX: 'Consumer Discretionary',
  TGT: 'Consumer Discretionary',
  LOW: 'Consumer Discretionary',
  BKNG: 'Consumer Discretionary',
  CMG: 'Consumer Discretionary',

  // Consumer Staples
  PG: 'Consumer Staples',
  KO: 'Consumer Staples',
  PEP: 'Consumer Staples',
  WMT: 'Consumer Staples',
  COST: 'Consumer Staples',
  PM: 'Consumer Staples',
  MO: 'Consumer Staples',
  CL: 'Consumer Staples',
  KMB: 'Consumer Staples',
  GIS: 'Consumer Staples',

  // Energy
  XOM: 'Energy',
  CVX: 'Energy',
  COP: 'Energy',
  SLB: 'Energy',
  EOG: 'Energy',
  PXD: 'Energy',
  OXY: 'Energy',
  MPC: 'Energy',
  VLO: 'Energy',
  PSX: 'Energy',

  // Industrials
  CAT: 'Industrials',
  DE: 'Industrials',
  BA: 'Industrials',
  HON: 'Industrials',
  UPS: 'Industrials',
  UNP: 'Industrials',
  RTX: 'Industrials',
  LMT: 'Industrials',
  GE: 'Industrials',
  MMM: 'Industrials',

  // Materials
  LIN: 'Materials',
  APD: 'Materials',
  SHW: 'Materials',
  ECL: 'Materials',
  NEM: 'Materials',
  FCX: 'Materials',
  NUE: 'Materials',
  DOW: 'Materials',

  // Utilities
  NEE: 'Utilities',
  DUK: 'Utilities',
  SO: 'Utilities',
  D: 'Utilities',
  AEP: 'Utilities',
  EXC: 'Utilities',
  SRE: 'Utilities',
  XEL: 'Utilities',

  // Real Estate
  AMT: 'Real Estate',
  PLD: 'Real Estate',
  CCI: 'Real Estate',
  EQIX: 'Real Estate',
  SPG: 'Real Estate',
  O: 'Real Estate',
  PSA: 'Real Estate',
  DLR: 'Real Estate',

  // Communication Services
  DIS: 'Communication Services',
  NFLX: 'Communication Services',
  CMCSA: 'Communication Services',
  VZ: 'Communication Services',
  T: 'Communication Services',
  TMUS: 'Communication Services',
  CHTR: 'Communication Services',
  ATVI: 'Communication Services',
};


// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get sector for a ticker, using position data or fallback mapping
 */
function getSector(position: Position): string {
  // Use position's sector if available
  if (position.sector) {
    return position.sector;
  }
  // Fallback to mapping
  return SECTOR_MAPPING[position.ticker.toUpperCase()] || 'Unknown';
}

/**
 * Calculate Herfindahl-Hirschman Index (HHI) for concentration measurement
 * HHI = sum of squared market shares (weights)
 * Range: 0 to 1 (or 0 to 10000 if using percentages)
 * - < 0.15: Low concentration
 * - 0.15 - 0.25: Moderate concentration
 * - > 0.25: High concentration
 */
function calculateHHI(positions: Position[]): number {
  return positions.reduce((sum, p) => {
    const weight = p.weight / 100; // Convert percentage to decimal
    return sum + Math.pow(weight, 2);
  }, 0);
}

/**
 * Group positions by sector
 */
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

// =============================================================================
// Position Analyst Agent Implementation
// =============================================================================

/**
 * Position Analyst Agent
 *
 * Analyzes portfolio structure to identify concentration risks,
 * correlated positions, and performance drivers.
 *
 * @implements {Agent}
 */
export class PositionAnalystAgent implements Agent {
  /** Unique identifier for the agent */
  id = 'position_analyst';

  /** Human-readable role description */
  role = 'Portfolio Structure Analyst';

  /** Agent's primary goal */
  goal = 'Analyze portfolio concentration, correlation risks, and performance attribution';

  /** Description for LLM selector mode */
  description = 'Analyzes portfolio structure to identify concentration risks, correlated positions, and performance drivers. Should be called first to understand portfolio composition.';

  /** List of tools/data sources this agent can use */
  tools = ['portfolio_data', 'rag_knowledge'];

  /** Agent personality configuration */
  personality?: AgentPersonality;

  /** Memory configuration */
  memory?: AgentMemoryConfig;

  // Internal state
  private lastAnalyzedTickers: string[] = [];
  private analysisCount = 0;
  private lastAnalysisTimestamp = 0;
  private messageHistory: AgentMessage[] = [];

  /**
   * Create a new Position Analyst Agent
   *
   * @param personality - Optional personality configuration
   * @param memory - Optional memory configuration
   */
  constructor(personality?: AgentPersonality, memory?: AgentMemoryConfig) {
    this.personality = personality;
    this.memory = memory;
  }

  // ===========================================================================
  // Agent Interface Implementation
  // ===========================================================================

  /**
   * Execute the position analysis
   *
   * @param context - Agent context with previous results and user notes
   * @param portfolio - Current portfolio state
   * @returns Analysis result with concentration, correlation, and performance data
   */
  async execute(
    context: AgentContext,
    portfolio: PortfolioState
  ): Promise<AgentResult> {
    const startTime = Date.now();
    let tokensUsed = 0;

    try {
      // 1. Calculate concentration analysis
      const concentrationAnalysis = this.analyzeConcentration(portfolio);

      // 2. Detect correlation risks
      const correlationRisks = this.detectCorrelationRisks(portfolio);

      // 3. Calculate performance attribution
      const performanceAttribution = this.calculatePerformanceAttribution(portfolio);

      // 4. Generate AI summary
      const { summary, tokens } = await this.generateSummary(
        concentrationAnalysis,
        correlationRisks,
        performanceAttribution,
        context.userNotes
      );
      tokensUsed = tokens;

      // Update internal state
      this.lastAnalyzedTickers = portfolio.positions.map((p) => p.ticker);
      this.analysisCount++;
      this.lastAnalysisTimestamp = Date.now();

      const executionTimeMs = Date.now() - startTime;

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
          executionTimeMs,
          tokensUsed,
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
          concentration_analysis: this.createEmptyConcentrationAnalysis(),
          correlation_risks: [],
          performance_attribution: this.createEmptyPerformanceAttribution(),
        },
        summary: `Position analysis failed: ${errorMessage}`,
        metadata: {
          executionTimeMs,
          tokensUsed: 0,
          dataSources: ['portfolio_data'],
          error: errorMessage,
        },
      };
    }
  }

  /**
   * Save agent's internal state for persistence
   */
  saveState(): AgentState {
    return {
      agentId: this.id,
      timestamp: Date.now(),
      internalState: {
        lastAnalyzedTickers: this.lastAnalyzedTickers,
        analysisCount: this.analysisCount,
        lastAnalysisTimestamp: this.lastAnalysisTimestamp,
      },
      messageHistory: this.messageHistory,
    };
  }

  /**
   * Restore agent's internal state
   */
  loadState(state: AgentState): void {
    if (state.agentId !== this.id) {
      console.warn(`State agent ID mismatch: expected ${this.id}, got ${state.agentId}`);
      return;
    }

    const internalState = state.internalState as unknown as PositionAnalystInternalState;
    this.lastAnalyzedTickers = internalState.lastAnalyzedTickers || [];
    this.analysisCount = internalState.analysisCount || 0;
    this.lastAnalysisTimestamp = internalState.lastAnalysisTimestamp || 0;
    this.messageHistory = state.messageHistory || [];
  }


  // ===========================================================================
  // Concentration Analysis
  // ===========================================================================

  /**
   * Analyze portfolio concentration
   *
   * Calculates:
   * - Top 3 positions and their combined weight
   * - HHI (Herfindahl-Hirschman Index) for concentration measurement
   * - High concentration flags for positions > 30% weight
   *
   * @param portfolio - Current portfolio state
   * @returns Concentration analysis results
   */
  private analyzeConcentration(portfolio: PortfolioState): ConcentrationAnalysis {
    const positions = portfolio.positions;

    if (positions.length === 0) {
      return this.createEmptyConcentrationAnalysis();
    }

    // Sort positions by weight (descending)
    const sorted = [...positions].sort((a, b) => b.weight - a.weight);

    // Get top 3 positions
    const top3 = sorted.slice(0, 3);
    const top3TotalWeight = top3.reduce((sum, p) => sum + p.weight, 0);

    // Calculate HHI index
    const hhi = calculateHHI(positions);

    // Flag high concentration positions (> 30% weight)
    const highConcentrationFlags = positions
      .filter((p) => p.weight > 30)
      .map((p) => p.ticker);

    return {
      top3_positions: top3.map((p) => ({
        ticker: p.ticker,
        weight: p.weight,
      })),
      top3_total_weight: top3TotalWeight,
      high_concentration_flags: highConcentrationFlags,
      herfindahl_index: hhi,
    };
  }

  /**
   * Create empty concentration analysis for error cases
   */
  private createEmptyConcentrationAnalysis(): ConcentrationAnalysis {
    return {
      top3_positions: [],
      top3_total_weight: 0,
      high_concentration_flags: [],
      herfindahl_index: 0,
    };
  }

  // ===========================================================================
  // Correlation Risk Detection
  // ===========================================================================

  /**
   * Detect correlation risks in the portfolio
   *
   * Identifies:
   * - Same-sector holdings with combined weight > 25%
   * - Highly correlated position pairs
   *
   * @param portfolio - Current portfolio state
   * @returns Array of correlation risk entries
   */
  private detectCorrelationRisks(portfolio: PortfolioState): CorrelationRisk[] {
    const risks: CorrelationRisk[] = [];
    const positions = portfolio.positions;

    if (positions.length < 2) {
      return risks;
    }


    // Group positions by sector
    const sectorGroups = groupBySector(positions);

    // Check each sector for concentration
    const sectorEntries = Array.from(sectorGroups.entries());
    for (const [sector, sectorPositions] of sectorEntries) {
      if (sector === 'Unknown' || sectorPositions.length < 2) {
        continue;
      }

      const combinedWeight = sectorPositions.reduce((sum: number, p: Position) => sum + p.weight, 0);

      // Flag sectors with combined weight > 25%
      if (combinedWeight > 25) {
        const riskLevel = this.assessSectorRiskLevel(combinedWeight);

        risks.push({
          tickers: sectorPositions.map((p: Position) => p.ticker),
          correlationType: 'sector',
          description: `${sectorPositions.length} positions in ${sector} sector with ${combinedWeight.toFixed(1)}% combined weight`,
          combinedWeight,
          riskLevel,
        });
      }
    }

    // Check for market correlation (US vs HK)
    const marketGroups = this.groupByMarket(positions);
    const marketEntries = Array.from(marketGroups.entries());
    for (const [market, marketPositions] of marketEntries) {
      const combinedWeight = marketPositions.reduce((sum: number, p: Position) => sum + p.weight, 0);

      // Flag if single market > 80%
      if (combinedWeight > 80 && marketPositions.length > 1) {
        risks.push({
          tickers: marketPositions.map((p: Position) => p.ticker),
          correlationType: 'market',
          description: `${combinedWeight.toFixed(1)}% concentrated in ${market} market`,
          combinedWeight,
          riskLevel: combinedWeight > 90 ? 'high' : 'medium',
        });
      }
    }

    // Sort by combined weight (highest risk first)
    risks.sort((a, b) => b.combinedWeight - a.combinedWeight);

    return risks;
  }

  /**
   * Assess risk level based on sector concentration
   */
  private assessSectorRiskLevel(combinedWeight: number): 'low' | 'medium' | 'high' {
    if (combinedWeight > 50) return 'high';
    if (combinedWeight > 35) return 'medium';
    return 'low';
  }

  /**
   * Group positions by market
   */
  private groupByMarket(positions: Position[]): Map<string, Position[]> {
    const groups = new Map<string, Position[]>();

    for (const position of positions) {
      const market = position.market || 'Unknown';
      const existing = groups.get(market) || [];
      existing.push(position);
      groups.set(market, existing);
    }

    return groups;
  }


  // ===========================================================================
  // Performance Attribution
  // ===========================================================================

  /**
   * Calculate performance attribution for each position
   *
   * Identifies:
   * - P&L contribution by position
   * - Top gainers and losers
   * - Overall portfolio performance
   *
   * @param portfolio - Current portfolio state
   * @returns Performance attribution summary
   */
  private calculatePerformanceAttribution(
    portfolio: PortfolioState
  ): PerformanceAttributionSummary {
    const positions = portfolio.positions;

    if (positions.length === 0) {
      return this.createEmptyPerformanceAttribution();
    }

    // Calculate total cost basis and P&L
    const totalCostBasis = positions.reduce((sum, p) => sum + p.costBasis, 0);
    const totalUnrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
    const totalPnLPercent = totalCostBasis > 0 
      ? (totalUnrealizedPnL / totalCostBasis) * 100 
      : 0;

    // Calculate attribution for each position
    const allPositions: PerformanceAttribution[] = positions.map((p) => {
      const pnlPercent = p.costBasis > 0 
        ? (p.unrealizedPnL / p.costBasis) * 100 
        : 0;
      const portfolioContribution = totalCostBasis > 0
        ? (p.unrealizedPnL / totalCostBasis) * 100
        : 0;

      return {
        ticker: p.ticker,
        unrealizedPnL: p.unrealizedPnL,
        pnlPercent,
        portfolioContribution,
        weight: p.weight,
      };
    });

    // Sort by portfolio contribution
    const sortedByContribution = [...allPositions].sort(
      (a, b) => b.portfolioContribution - a.portfolioContribution
    );

    // Get top 3 gainers and losers
    const topGainers = sortedByContribution
      .filter((p) => p.portfolioContribution > 0)
      .slice(0, 3);

    const topLosers = sortedByContribution
      .filter((p) => p.portfolioContribution < 0)
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
   * Create empty performance attribution for error cases
   */
  private createEmptyPerformanceAttribution(): PerformanceAttributionSummary {
    return {
      totalUnrealizedPnL: 0,
      totalPnLPercent: 0,
      topGainers: [],
      topLosers: [],
      allPositions: [],
    };
  }


  // ===========================================================================
  // AI Summary Generation
  // ===========================================================================

  /**
   * Generate AI-powered summary of the analysis
   *
   * Uses Gemini API to create a human-readable summary that incorporates:
   * - Concentration analysis findings
   * - Correlation risk warnings
   * - Performance attribution insights
   * - User's investment notes/principles
   *
   * @param concentration - Concentration analysis results
   * @param correlationRisks - Detected correlation risks
   * @param performance - Performance attribution summary
   * @param userNotes - User's investment notes
   * @returns Summary text and token count
   */
  private async generateSummary(
    concentration: ConcentrationAnalysis,
    correlationRisks: CorrelationRisk[],
    performance: PerformanceAttributionSummary,
    userNotes: string
  ): Promise<{ summary: string; tokens: number }> {
    // Build personality-aware prompt prefix
    const personalityPrompt = this.personality
      ? generatePersonalityPrompt(this.personality)
      : '';

    // Build analysis context
    const analysisContext = this.buildAnalysisContext(
      concentration,
      correlationRisks,
      performance
    );

    const prompt = `${personalityPrompt}

You are a portfolio structure analyst. Based on the following analysis, provide a concise summary (2-3 paragraphs) highlighting key findings and concerns.

## Analysis Results

${analysisContext}

${userNotes ? `## User's Investment Notes\n${userNotes}\n` : ''}

## Instructions

1. Start with the most important finding (concentration or correlation risk)
2. Highlight any positions that need attention
3. Comment on performance attribution patterns
4. Keep the tone professional but accessible
5. If there are high concentration flags, emphasize them

Provide your summary:`;

    try {
      // Call Gemini API
      const response = await this.callGeminiAPI(prompt);
      return {
        summary: response.text,
        tokens: response.tokensUsed,
      };
    } catch (error) {
      // Fallback to rule-based summary
      return {
        summary: this.generateFallbackSummary(concentration, correlationRisks, performance),
        tokens: 0,
      };
    }
  }


  /**
   * Build analysis context string for the prompt
   */
  private buildAnalysisContext(
    concentration: ConcentrationAnalysis,
    correlationRisks: CorrelationRisk[],
    performance: PerformanceAttributionSummary
  ): string {
    const sections: string[] = [];

    // Concentration section
    sections.push(`### Concentration Analysis
- Top 3 positions: ${concentration.top3_positions.map((p) => `${p.ticker} (${p.weight.toFixed(1)}%)`).join(', ')}
- Top 3 combined weight: ${concentration.top3_total_weight.toFixed(1)}%
- HHI Index: ${concentration.herfindahl_index.toFixed(4)} (${this.interpretHHI(concentration.herfindahl_index)})
- High concentration flags: ${concentration.high_concentration_flags.length > 0 ? concentration.high_concentration_flags.join(', ') : 'None'}`);

    // Correlation risks section
    if (correlationRisks.length > 0) {
      const riskLines = correlationRisks.map(
        (r) => `- [${r.riskLevel.toUpperCase()}] ${r.description}`
      );
      sections.push(`### Correlation Risks\n${riskLines.join('\n')}`);
    } else {
      sections.push('### Correlation Risks\nNo significant correlation risks detected.');
    }

    // Performance section
    sections.push(`### Performance Attribution
- Total Unrealized P&L: $${performance.totalUnrealizedPnL.toLocaleString()} (${performance.totalPnLPercent.toFixed(2)}%)
- Top Gainers: ${performance.topGainers.map((p) => `${p.ticker} (+${p.portfolioContribution.toFixed(2)}%)`).join(', ') || 'None'}
- Top Losers: ${performance.topLosers.map((p) => `${p.ticker} (${p.portfolioContribution.toFixed(2)}%)`).join(', ') || 'None'}`);

    return sections.join('\n\n');
  }

  /**
   * Interpret HHI value (Chinese)
   */
  private interpretHHI(hhi: number): string {
    if (hhi < 0.15) return '低集中度 - 分散良好';
    if (hhi < 0.25) return '中等集中度';
    return '高集中度 - 建议分散投资';
  }

  /**
   * Generate fallback summary when AI is unavailable
   */
  private generateFallbackSummary(
    concentration: ConcentrationAnalysis,
    correlationRisks: CorrelationRisk[],
    performance: PerformanceAttributionSummary
  ): string {
    const parts: string[] = [];

    // Concentration summary
    if (concentration.high_concentration_flags.length > 0) {
      parts.push(
        `⚠️ 检测到高集中度持仓: ${concentration.high_concentration_flags.join(', ')} (每个超过30%权重)。`
      );
    }

    parts.push(
      `前3大持仓 (${concentration.top3_positions.map((p) => p.ticker).join(', ')}) 占投资组合的 ${concentration.top3_total_weight.toFixed(1)}%。`
    );

    // HHI interpretation
    parts.push(`投资组合集中度 (HHI): ${this.interpretHHI(concentration.herfindahl_index)}。`);

    // Correlation risks
    const highRisks = correlationRisks.filter((r) => r.riskLevel === 'high');
    if (highRisks.length > 0) {
      parts.push(
        `⚠️ 检测到 ${highRisks.length} 个高相关性风险: ${highRisks.map((r) => r.description).join('; ')}。`
      );
    }


    // Performance summary
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

  /**
   * Call Gemini API for summary generation
   *
   * @param prompt - The prompt to send to Gemini
   * @returns Response text and token count
   */
  private async callGeminiAPI(
    prompt: string
  ): Promise<{ text: string; tokensUsed: number }> {
    // Get API key from environment
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

    return { text, tokensUsed };
  }
}


// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new Position Analyst Agent with default configuration
 */
export function createPositionAnalystAgent(
  personality?: AgentPersonality,
  memory?: AgentMemoryConfig
): PositionAnalystAgent {
  return new PositionAnalystAgent(personality, memory);
}

/**
 * Create a Position Analyst Agent with conservative personality
 */
export function createConservativePositionAnalyst(): PositionAnalystAgent {
  return new PositionAnalystAgent({
    riskTolerance: 'conservative',
    decisionStyle: 'data-driven',
    traits: ['cautious', 'thorough', 'risk-averse'],
  });
}

/**
 * Create a Position Analyst Agent with aggressive personality
 */
export function createAggressivePositionAnalyst(): PositionAnalystAgent {
  return new PositionAnalystAgent({
    riskTolerance: 'aggressive',
    decisionStyle: 'intuitive',
    traits: ['growth-oriented', 'opportunity-seeking'],
  });
}

// =============================================================================
// Default Export
// =============================================================================

export default PositionAnalystAgent;
