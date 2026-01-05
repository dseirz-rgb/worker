/**
 * Market Analyst Agent
 * 
 * 从 packages/riskcontrol/src/services/agents/marketAnalyst.ts 移植
 * 分析市场情绪、个股情绪和市场事件
 * 
 * @module services/echo-server/aiServer/investment/agents/marketAnalyst
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
 * 市场情绪
 */
export interface MarketSentiment {
  overall: 'bullish' | 'neutral' | 'bearish';
  score: number; // -1 到 1
  indicators: string[];
}

/**
 * 个股情绪
 */
export interface StockSentiment {
  ticker: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
  newsCount: number;
  keyTopics: string[];
}

/**
 * 市场事件
 */
export interface MarketEvent {
  date: string;
  title: string;
  impact: 'high' | 'medium' | 'low';
  affectedTickers: string[];
}

// ============================================================================
// Market Analyst Agent
// ============================================================================

/**
 * Market Analyst Agent
 * 
 * 分析市场情绪和个股情绪
 */
export class MarketAnalystAgent implements Agent {
  id = 'market_analyst';
  role = '市场分析师';
  goal = '分析市场情绪、个股情绪和市场事件';
  description = '分析市场情绪和个股情绪，识别可能影响投资组合的市场事件。在风险分析后调用以获取市场视角。';

  /**
   * 执行分析
   */
  async execute(
    context: AgentContext,
    portfolio: PortfolioState
  ): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // 获取持仓的 ticker 列表
      const tickers = portfolio.positions.map(p => p.ticker);

      // 1. 市场情绪分析
      const marketSentiment = await this.analyzeMarketSentiment();

      // 2. 个股情绪分析
      const stockSentiments = await this.analyzeStockSentiments(tickers);

      // 3. 市场事件
      const marketEvents = await this.getMarketEvents(tickers);

      // 4. 生成摘要
      const summary = this.generateSummary(marketSentiment, stockSentiments, marketEvents);

      return {
        agentId: this.id,
        status: 'success',
        data: {
          market_sentiment: marketSentiment,
          stock_sentiments: stockSentiments,
          market_events: marketEvents,
        },
        summary,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          tokensUsed: 0,
          dataSources: ['market_data'],
        },
      };
    } catch (error) {
      return {
        agentId: this.id,
        status: 'partial',
        data: {
          market_sentiment: this.getDefaultMarketSentiment(),
          stock_sentiments: [],
          market_events: [],
        },
        summary: `市场分析部分完成: ${(error as Error).message}`,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          tokensUsed: 0,
          dataSources: ['market_data'],
          error: (error as Error).message,
        },
      };
    }
  }

  /**
   * 分析市场情绪
   * 
   * 注意：实际实现需要调用外部 API (如 Serper)
   * 这里提供模拟数据
   */
  private async analyzeMarketSentiment(): Promise<MarketSentiment> {
    // 模拟市场情绪数据
    // 实际实现应调用新闻 API 并进行情绪分析
    return {
      overall: 'neutral',
      score: 0.1,
      indicators: [
        'VIX 处于正常水平',
        '美联储维持利率不变',
        '科技股表现分化',
      ],
    };
  }

  /**
   * 分析个股情绪
   */
  private async analyzeStockSentiments(tickers: string[]): Promise<StockSentiment[]> {
    // 模拟个股情绪数据
    // 实际实现应调用新闻 API 并进行情绪分析
    return tickers.slice(0, 5).map(ticker => ({
      ticker,
      sentiment: 'neutral' as const,
      score: Math.random() * 0.4 - 0.2, // -0.2 到 0.2
      newsCount: Math.floor(Math.random() * 10) + 1,
      keyTopics: ['财报', '市场动态'],
    }));
  }

  /**
   * 获取市场事件
   */
  private async getMarketEvents(tickers: string[]): Promise<MarketEvent[]> {
    // 模拟市场事件数据
    const today = new Date().toISOString().split('T')[0];
    
    return [
      {
        date: today,
        title: '美联储议息会议',
        impact: 'high' as const,
        affectedTickers: tickers,
      },
    ];
  }

  /**
   * 获取默认市场情绪
   */
  private getDefaultMarketSentiment(): MarketSentiment {
    return {
      overall: 'neutral',
      score: 0,
      indicators: ['数据暂不可用'],
    };
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    marketSentiment: MarketSentiment,
    stockSentiments: StockSentiment[],
    marketEvents: MarketEvent[]
  ): string {
    const parts: string[] = [];

    // 市场情绪
    const sentimentEmoji = {
      bullish: '📈',
      neutral: '➡️',
      bearish: '📉',
    }[marketSentiment.overall];
    parts.push(`${sentimentEmoji} 市场情绪: ${marketSentiment.overall} (${marketSentiment.score.toFixed(2)})`);

    // 关键指标
    if (marketSentiment.indicators.length > 0) {
      parts.push(`关键指标: ${marketSentiment.indicators.slice(0, 2).join(', ')}`);
    }

    // 个股情绪
    const negativeSentiments = stockSentiments.filter(s => s.sentiment === 'negative');
    if (negativeSentiments.length > 0) {
      parts.push(`⚠️ ${negativeSentiments.length} 只股票情绪偏负面: ${negativeSentiments.map(s => s.ticker).join(', ')}`);
    }

    // 市场事件
    const highImpactEvents = marketEvents.filter(e => e.impact === 'high');
    if (highImpactEvents.length > 0) {
      parts.push(`📅 重要事件: ${highImpactEvents.map(e => e.title).join(', ')}`);
    }

    return parts.join('。');
  }
}

/**
 * 创建 Market Analyst Agent
 */
export function createMarketAnalystAgent(): MarketAnalystAgent {
  return new MarketAnalystAgent();
}

export default MarketAnalystAgent;
