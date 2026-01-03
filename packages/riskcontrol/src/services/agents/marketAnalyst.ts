/**
 * Market Analyst Agent
 *
 * Analyzes market sentiment, news, and SEC filings for portfolio holdings.
 * Provides market context and sentiment analysis to inform investment decisions.
 *
 * Features:
 * - News Aggregation: Fetches relevant news via Serper API
 * - Sentiment Analysis: Analyzes news sentiment for each ticker
 * - SEC Filing Monitoring: Tracks latest 10-K, 10-Q, 8-K filings
 * - Market Event Detection: Identifies significant market events
 *
 * @module agents/marketAnalyst
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
  NewsItem,
  SECFiling,
  AgentPersonality,
  AgentMemoryConfig,
} from './types';
import {
  SerperDataSource,
  SECDataSource,
  JinaDataSource,
  createSerperDataSource,
  createSECDataSource,
  createJinaDataSource,
} from './dataSources';

// =============================================================================
// Types
// =============================================================================

/**
 * Overall market sentiment assessment
 */
export interface MarketSentiment {
  /** Overall sentiment score from -1 (very negative) to 1 (very positive) */
  overall_score: number;
  /** Sentiment label */
  sentiment_label: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
  /** Key themes identified in news */
  key_themes: string[];
  /** Total news items analyzed */
  news_count: number;
}

/**
 * Per-ticker sentiment analysis
 */
export interface TickerSentiment {
  /** Stock ticker */
  ticker: string;
  /** Sentiment score from -1 to 1 */
  sentiment_score: number;
  /** Relevant news items */
  news_items: NewsItem[];
  /** Key events identified */
  key_events: string[];
}

/**
 * Market event detected from news or filings
 */
export interface MarketEvent {
  /** Event type */
  type: 'earnings' | 'sec_filing' | 'news' | 'market_move';
  /** Related ticker (if applicable) */
  ticker?: string;
  /** Event description */
  description: string;
  /** Assessed impact */
  impact: 'positive' | 'negative' | 'neutral';
  /** Event date */
  date: string;
}

/**
 * Complete market analysis result
 */
export interface MarketAnalysisResult {
  /** Overall market sentiment */
  overall_sentiment: MarketSentiment;
  /** Per-ticker sentiment analysis */
  ticker_sentiments: TickerSentiment[];
  /** Recent SEC filings */
  recent_filings: SECFiling[];
  /** Detected market events */
  market_events: MarketEvent[];
}

/**
 * Internal state for the Market Analyst Agent
 */
interface MarketAnalystInternalState {
  /** Last analyzed tickers */
  lastAnalyzedTickers: string[];
  /** Last analysis timestamp */
  lastAnalysisTimestamp: number;
  /** Cached sentiment scores */
  cachedSentiments: Map<string, number>;
}

// =============================================================================
// Sentiment Analysis Helpers
// =============================================================================

/** Positive sentiment keywords */
const POSITIVE_KEYWORDS = [
  'surge', 'gain', 'beat', 'strong', 'growth', 'profit', 'rally', 'upgrade',
  'outperform', 'bullish', 'record', 'breakthrough', 'success', 'positive',
  'exceed', 'boost', 'soar', 'jump', 'rise', 'advance', 'improve', 'optimistic',
];

/** Negative sentiment keywords */
const NEGATIVE_KEYWORDS = [
  'drop', 'fall', 'miss', 'weak', 'loss', 'decline', 'downgrade', 'underperform',
  'bearish', 'concern', 'risk', 'warning', 'cut', 'layoff', 'lawsuit', 'negative',
  'plunge', 'crash', 'tumble', 'slump', 'struggle', 'pessimistic', 'fear',
];

/** Theme keywords for categorization */
const THEME_KEYWORDS: Record<string, string[]> = {
  earnings: ['earnings', 'revenue', 'profit', 'eps', 'quarterly', 'annual'],
  guidance: ['guidance', 'outlook', 'forecast', 'expect', 'projection'],
  analyst: ['analyst', 'rating', 'upgrade', 'downgrade', 'target', 'price target'],
  merger: ['merger', 'acquisition', 'deal', 'buyout', 'takeover'],
  dividend: ['dividend', 'payout', 'yield', 'distribution'],
  regulatory: ['sec', 'fda', 'regulation', 'compliance', 'investigation'],
  market: ['market', 'sector', 'industry', 'economy', 'inflation', 'fed'],
};

/**
 * Analyze sentiment of a single news item
 */
function analyzeNewsSentiment(news: NewsItem): number {
  const text = `${news.title} ${news.snippet}`.toLowerCase();
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const keyword of POSITIVE_KEYWORDS) {
    if (text.includes(keyword)) positiveCount++;
  }
  
  for (const keyword of NEGATIVE_KEYWORDS) {
    if (text.includes(keyword)) negativeCount++;
  }
  
  const total = positiveCount + negativeCount;
  if (total === 0) return 0;
  
  return (positiveCount - negativeCount) / total;
}

/**
 * Extract themes from news items
 */
function extractThemes(newsItems: NewsItem[]): string[] {
  const themeCounts = new Map<string, number>();
  
  for (const news of newsItems) {
    const text = `${news.title} ${news.snippet}`.toLowerCase();
    
    for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
          break;
        }
      }
    }
  }
  
  // Sort by count and return top themes
  return Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme]) => theme);
}

/**
 * Convert sentiment score to label
 */
function scoreToLabel(score: number): MarketSentiment['sentiment_label'] {
  if (score <= -0.5) return 'very_negative';
  if (score <= -0.1) return 'negative';
  if (score <= 0.1) return 'neutral';
  if (score <= 0.5) return 'positive';
  return 'very_positive';
}

// =============================================================================
// Market Analyst Agent Implementation
// =============================================================================

/**
 * Market Analyst Agent
 *
 * Analyzes market sentiment and news for portfolio holdings.
 *
 * @implements {Agent}
 */
export class MarketAnalystAgent implements Agent {
  id = 'market_analyst';
  role = 'Market Sentiment Analyst';
  goal = 'Analyze market sentiment, news, and SEC filings for portfolio holdings';
  description = 'Monitors news, SEC filings, and market events to assess sentiment and identify risks/opportunities. Should be called to understand market context.';
  tools = ['serper', 'sec', 'jina', 'llm'];

  personality?: AgentPersonality;
  memory?: AgentMemoryConfig;

  private serperSource: SerperDataSource;
  private secSource: SECDataSource;
  private jinaSource: JinaDataSource;

  // Internal state
  private lastAnalyzedTickers: string[] = [];
  private lastAnalysisTimestamp = 0;
  private cachedSentiments = new Map<string, number>();
  private messageHistory: AgentMessage[] = [];

  constructor(
    serperSource: SerperDataSource,
    secSource: SECDataSource,
    jinaSource: JinaDataSource,
    personality?: AgentPersonality
  ) {
    this.serperSource = serperSource;
    this.secSource = secSource;
    this.jinaSource = jinaSource;
    this.personality = personality;
  }

  async execute(
    context: AgentContext,
    portfolio: PortfolioState
  ): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // 1. Analyze sentiment for each ticker
      const tickerSentiments = await this.analyzeTickerSentiments(portfolio);

      // 2. Calculate overall sentiment
      const overallSentiment = this.calculateOverallSentiment(tickerSentiments);

      // 3. Get recent SEC filings
      const recentFilings = await this.getRecentFilings(portfolio);

      // 4. Detect market events
      const marketEvents = this.detectMarketEvents(tickerSentiments, recentFilings);

      // 5. Generate summary
      const summary = this.generateSummary(overallSentiment, tickerSentiments, marketEvents);

      // Update internal state
      this.lastAnalyzedTickers = portfolio.positions.map((p) => p.ticker);
      this.lastAnalysisTimestamp = Date.now();

      return {
        agentId: this.id,
        status: 'success',
        data: {
          overall_sentiment: overallSentiment,
          ticker_sentiments: tickerSentiments,
          recent_filings: recentFilings,
          market_events: marketEvents,
        },
        summary,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          tokensUsed: 0,
          dataSources: ['serper', 'sec'],
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        agentId: this.id,
        status: 'failed',
        data: {
          overall_sentiment: this.createEmptySentiment(),
          ticker_sentiments: [],
          recent_filings: [],
          market_events: [],
        },
        summary: `Market analysis failed: ${errorMessage}`,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          tokensUsed: 0,
          dataSources: ['serper', 'sec'],
          error: errorMessage,
        },
      };
    }
  }

  saveState(): AgentState {
    return {
      agentId: this.id,
      timestamp: Date.now(),
      internalState: {
        lastAnalyzedTickers: this.lastAnalyzedTickers,
        lastAnalysisTimestamp: this.lastAnalysisTimestamp,
        cachedSentiments: Object.fromEntries(this.cachedSentiments),
      },
      messageHistory: this.messageHistory,
    };
  }

  loadState(state: AgentState): void {
    if (state.agentId !== this.id) {
      console.warn(`State agent ID mismatch: expected ${this.id}, got ${state.agentId}`);
      return;
    }

    const internalState = state.internalState as unknown as MarketAnalystInternalState;
    this.lastAnalyzedTickers = internalState.lastAnalyzedTickers || [];
    this.lastAnalysisTimestamp = internalState.lastAnalysisTimestamp || 0;
    
    if (internalState.cachedSentiments) {
      this.cachedSentiments = new Map(
        Object.entries(internalState.cachedSentiments as unknown as Record<string, number>)
      );
    }
    
    this.messageHistory = state.messageHistory || [];
  }

  // ===========================================================================
  // Sentiment Analysis
  // ===========================================================================

  private async analyzeTickerSentiments(
    portfolio: PortfolioState
  ): Promise<TickerSentiment[]> {
    const results: TickerSentiment[] = [];

    // Process tickers in parallel (limit concurrency)
    const positions = portfolio.positions.slice(0, 10); // Limit to top 10
    
    const promises = positions.map(async (position) => {
      try {
        const news = await this.serperSource.searchNews(position.ticker);
        const sentimentScore = this.calculateTickerSentiment(news);
        const keyEvents = this.extractKeyEvents(news);

        return {
          ticker: position.ticker,
          sentiment_score: sentimentScore,
          news_items: news.slice(0, 5),
          key_events: keyEvents,
        };
      } catch (error) {
        console.warn(`Failed to analyze sentiment for ${position.ticker}:`, error);
        return {
          ticker: position.ticker,
          sentiment_score: 0,
          news_items: [],
          key_events: [],
        };
      }
    });

    const settled = await Promise.allSettled(promises);
    
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        this.cachedSentiments.set(result.value.ticker, result.value.sentiment_score);
      }
    }

    return results;
  }

  private calculateTickerSentiment(news: NewsItem[]): number {
    if (news.length === 0) return 0;

    const scores = news.map(analyzeNewsSentiment);
    const sum = scores.reduce((a, b) => a + b, 0);
    return sum / scores.length;
  }

  private extractKeyEvents(news: NewsItem[]): string[] {
    const events: string[] = [];
    
    for (const item of news.slice(0, 5)) {
      const title = item.title.toLowerCase();
      
      if (title.includes('earnings') || title.includes('quarterly')) {
        events.push(`Earnings: ${item.title}`);
      } else if (title.includes('upgrade') || title.includes('downgrade')) {
        events.push(`Rating: ${item.title}`);
      } else if (title.includes('sec') || title.includes('filing')) {
        events.push(`Filing: ${item.title}`);
      }
    }

    return events.slice(0, 3);
  }

  private calculateOverallSentiment(
    tickerSentiments: TickerSentiment[]
  ): MarketSentiment {
    if (tickerSentiments.length === 0) {
      return this.createEmptySentiment();
    }

    // Weight-adjusted average (could use portfolio weights)
    const scores = tickerSentiments.map((t) => t.sentiment_score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Collect all news for theme extraction
    const allNews = tickerSentiments.flatMap((t) => t.news_items);
    const keyThemes = extractThemes(allNews);

    return {
      overall_score: avgScore,
      sentiment_label: scoreToLabel(avgScore),
      key_themes: keyThemes,
      news_count: allNews.length,
    };
  }

  private createEmptySentiment(): MarketSentiment {
    return {
      overall_score: 0,
      sentiment_label: 'neutral',
      key_themes: [],
      news_count: 0,
    };
  }

  // ===========================================================================
  // SEC Filings
  // ===========================================================================

  private async getRecentFilings(portfolio: PortfolioState): Promise<SECFiling[]> {
    const allFilings: SECFiling[] = [];
    const positions = portfolio.positions.slice(0, 10);

    const promises = positions.map(async (position) => {
      try {
        return await this.secSource.getLatestFilings(position.ticker, ['10-K', '10-Q', '8-K']);
      } catch (error) {
        console.warn(`Failed to get filings for ${position.ticker}:`, error);
        return [];
      }
    });

    const results = await Promise.allSettled(promises);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allFilings.push(...result.value);
      }
    }

    // Sort by date and deduplicate
    const seen = new Set<string>();
    return allFilings
      .filter((f) => {
        const key = `${f.accessionNumber}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime())
      .slice(0, 10);
  }

  // ===========================================================================
  // Market Event Detection
  // ===========================================================================

  private detectMarketEvents(
    tickerSentiments: TickerSentiment[],
    filings: SECFiling[]
  ): MarketEvent[] {
    const events: MarketEvent[] = [];

    // Detect events from news
    for (const ticker of tickerSentiments) {
      for (const news of ticker.news_items) {
        const event = this.detectEventFromNews(news, ticker.ticker);
        if (event) events.push(event);
      }
    }

    // Detect events from SEC filings
    for (const filing of filings) {
      events.push({
        type: 'sec_filing',
        description: `${filing.form} filing submitted`,
        impact: filing.form === '8-K' ? 'neutral' : 'neutral',
        date: filing.filingDate,
      });
    }

    // Sort by date and limit
    return events
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }

  private detectEventFromNews(news: NewsItem, ticker: string): MarketEvent | null {
    const title = news.title.toLowerCase();
    
    if (title.includes('earnings') || title.includes('quarterly results')) {
      const sentiment = analyzeNewsSentiment(news);
      return {
        type: 'earnings',
        ticker,
        description: news.title,
        impact: sentiment > 0.1 ? 'positive' : sentiment < -0.1 ? 'negative' : 'neutral',
        date: news.date,
      };
    }

    if (title.includes('surge') || title.includes('plunge') || title.includes('crash')) {
      const sentiment = analyzeNewsSentiment(news);
      return {
        type: 'market_move',
        ticker,
        description: news.title,
        impact: sentiment > 0 ? 'positive' : 'negative',
        date: news.date,
      };
    }

    return null;
  }

  // ===========================================================================
  // Summary Generation
  // ===========================================================================

  private generateSummary(
    sentiment: MarketSentiment,
    tickerSentiments: TickerSentiment[],
    events: MarketEvent[]
  ): string {
    const parts: string[] = [];

    // Overall sentiment
    const sentimentEmoji = sentiment.overall_score > 0.1 ? '📈' : 
                          sentiment.overall_score < -0.1 ? '📉' : '➡️';
    parts.push(
      `${sentimentEmoji} Overall market sentiment: ${sentiment.sentiment_label} (${sentiment.overall_score.toFixed(2)})`
    );

    // Key themes
    if (sentiment.key_themes.length > 0) {
      parts.push(`Key themes: ${sentiment.key_themes.join(', ')}`);
    }

    // Top movers
    const sorted = [...tickerSentiments].sort(
      (a, b) => Math.abs(b.sentiment_score) - Math.abs(a.sentiment_score)
    );
    
    const positive = sorted.filter((t) => t.sentiment_score > 0.1).slice(0, 2);
    const negative = sorted.filter((t) => t.sentiment_score < -0.1).slice(0, 2);

    if (positive.length > 0) {
      parts.push(
        `Positive sentiment: ${positive.map((t) => `${t.ticker} (+${t.sentiment_score.toFixed(2)})`).join(', ')}`
      );
    }

    if (negative.length > 0) {
      parts.push(
        `Negative sentiment: ${negative.map((t) => `${t.ticker} (${t.sentiment_score.toFixed(2)})`).join(', ')}`
      );
    }

    // Recent events
    const recentEvents = events.slice(0, 3);
    if (recentEvents.length > 0) {
      parts.push(`Recent events: ${recentEvents.map((e) => e.description).join('; ')}`);
    }

    return parts.join('. ');
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a Market Analyst Agent with API key
 */
export function createMarketAnalystAgent(
  serperApiKey: string,
  options?: {
    jinaApiKey?: string;
    personality?: AgentPersonality;
  }
): MarketAnalystAgent {
  const serper = createSerperDataSource(serperApiKey);
  const sec = createSECDataSource();
  const jina = createJinaDataSource({ apiKey: options?.jinaApiKey });
  
  return new MarketAnalystAgent(serper, sec, jina, options?.personality);
}

/**
 * Create a Market Analyst Agent with custom data sources
 */
export function createMarketAnalystAgentWithSources(
  serper: SerperDataSource,
  sec: SECDataSource,
  jina: JinaDataSource,
  personality?: AgentPersonality
): MarketAnalystAgent {
  return new MarketAnalystAgent(serper, sec, jina, personality);
}

export default MarketAnalystAgent;
