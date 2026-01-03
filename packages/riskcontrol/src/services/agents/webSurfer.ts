/**
 * Web Surfer Agent
 *
 * Browses and extracts content from web pages for deeper analysis.
 * Specializes in extracting structured data from SEC filings and financial news.
 *
 * Features:
 * - Content Extraction: Uses Jina Reader for clean text extraction
 * - SEC Filing Parsing: Extracts key financial data from SEC documents
 * - News Article Parsing: Extracts main content and key points
 * - Content Caching: 1-hour TTL to avoid repeated fetches
 *
 * @module agents/webSurfer
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for detailed design
 */

import type {
  Agent,
  AgentContext,
  AgentResult,
  AgentState,
  AgentMessage,
  PortfolioState,
  AgentPersonality,
  AgentMemoryConfig,
  ExtractedContent,
} from './types';
import {
  JinaDataSource,
  createJinaDataSource,
} from './dataSources';

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed content from a web page
 */
export interface ParsedContent {
  /** Page title */
  title: string;
  /** Main content text */
  mainContent: string;
  /** Extracted tables (if any) */
  tables: ParsedTable[];
  /** Extracted financial data */
  financialData: Record<string, number | string>;
  /** Key points extracted from content */
  keyPoints: string[];
}

/**
 * Parsed table from content
 */
export interface ParsedTable {
  /** Table headers */
  headers: string[];
  /** Table rows */
  rows: string[][];
}

/**
 * Cached content entry
 */
interface CachedContent {
  /** Extracted content */
  content: ExtractedContent;
  /** Cache timestamp */
  timestamp: number;
}

/**
 * Web surfing request from handoff
 */
export interface WebSurfingRequest {
  /** URLs to extract content from */
  urls: string[];
  /** Related tickers for context */
  tickers?: string[];
  /** Specific data to look for */
  lookFor?: string[];
}

/**
 * Complete web surfing result
 */
export interface WebSurfingResult {
  /** All extracted content */
  extracted_content: ExtractedContent[];
  /** Analysis summary */
  analysis: WebContentAnalysis;
  /** Number of URLs processed */
  urls_processed: number;
  /** Number of successful extractions */
  successful_extractions: number;
}

/**
 * Analysis of extracted web content
 */
export interface WebContentAnalysis {
  /** Key findings from all content */
  key_findings: string[];
  /** Financial metrics extracted */
  financial_metrics: Record<string, number | string>;
  /** Risk factors identified */
  risk_factors: string[];
  /** Opportunities identified */
  opportunities: string[];
}

/**
 * Internal state for the Web Surfer Agent
 */
interface WebSurferInternalState {
  /** URLs that have been processed */
  processedUrls: string[];
  /** Last processing timestamp */
  lastProcessingTimestamp: number;
  /** Cache keys for restoration */
  cacheKeys: string[];
}

// =============================================================================
// Content Parsing Helpers
// =============================================================================

/**
 * Financial metric patterns for extraction
 */
const FINANCIAL_PATTERNS: Array<{
  key: string;
  pattern: RegExp;
  multiplier?: (match: string) => number;
}> = [
  {
    key: 'revenue',
    pattern: /(?:total\s+)?revenue[:\s]+\$?([\d,.]+)\s*(million|billion|M|B)?/i,
    multiplier: (unit) => {
      if (!unit) return 1;
      const u = unit.toLowerCase();
      if (u === 'billion' || u === 'b') return 1_000_000_000;
      if (u === 'million' || u === 'm') return 1_000_000;
      return 1;
    },
  },
  {
    key: 'netIncome',
    pattern: /net\s+income[:\s]+\$?([\d,.]+)\s*(million|billion|M|B)?/i,
    multiplier: (unit) => {
      if (!unit) return 1;
      const u = unit.toLowerCase();
      if (u === 'billion' || u === 'b') return 1_000_000_000;
      if (u === 'million' || u === 'm') return 1_000_000;
      return 1;
    },
  },
  {
    key: 'eps',
    pattern: /(?:diluted\s+)?(?:eps|earnings\s+per\s+share)[:\s]+\$?([\d.]+)/i,
  },
  {
    key: 'totalAssets',
    pattern: /total\s+assets[:\s]+\$?([\d,.]+)\s*(million|billion|M|B)?/i,
    multiplier: (unit) => {
      if (!unit) return 1;
      const u = unit.toLowerCase();
      if (u === 'billion' || u === 'b') return 1_000_000_000;
      if (u === 'million' || u === 'm') return 1_000_000;
      return 1;
    },
  },
  {
    key: 'totalDebt',
    pattern: /total\s+(?:debt|liabilities)[:\s]+\$?([\d,.]+)\s*(million|billion|M|B)?/i,
    multiplier: (unit) => {
      if (!unit) return 1;
      const u = unit.toLowerCase();
      if (u === 'billion' || u === 'b') return 1_000_000_000;
      if (u === 'million' || u === 'm') return 1_000_000;
      return 1;
    },
  },
  {
    key: 'operatingMargin',
    pattern: /operating\s+margin[:\s]+([\d.]+)%?/i,
  },
  {
    key: 'grossMargin',
    pattern: /gross\s+margin[:\s]+([\d.]+)%?/i,
  },
];

/**
 * Risk factor keywords
 */
const RISK_KEYWORDS = [
  'risk', 'uncertainty', 'challenge', 'concern', 'decline', 'decrease',
  'adverse', 'negative', 'loss', 'liability', 'lawsuit', 'litigation',
  'regulatory', 'compliance', 'investigation', 'volatility', 'competition',
];

/**
 * Opportunity keywords
 */
const OPPORTUNITY_KEYWORDS = [
  'growth', 'opportunity', 'expansion', 'increase', 'improve', 'innovation',
  'market share', 'new product', 'acquisition', 'partnership', 'strategic',
  'competitive advantage', 'margin expansion', 'efficiency', 'synergy',
];

/**
 * Extract financial metrics from text
 */
function extractFinancialMetrics(content: string): Record<string, number | string> {
  const metrics: Record<string, number | string> = {};

  for (const { key, pattern, multiplier } of FINANCIAL_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      let value = parseFloat(match[1].replace(/,/g, ''));
      if (multiplier && match[2]) {
        value *= multiplier(match[2]);
      }
      metrics[key] = value;
    }
  }

  return metrics;
}

/**
 * Extract key points from content
 */
function extractKeyPoints(content: string): string[] {
  const keyPoints: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Look for bullet points or numbered items
    if (trimmed.match(/^[-•*]\s+/) || trimmed.match(/^\d+\.\s+/)) {
      const point = trimmed.replace(/^[-•*\d.]+\s+/, '').trim();
      if (point.length > 10 && point.length < 500) {
        keyPoints.push(point);
      }
    }
  }

  return keyPoints.slice(0, 15);
}

/**
 * Extract sentences containing specific keywords
 */
function extractSentencesWithKeywords(
  content: string,
  keywords: string[]
): string[] {
  const sentences = content.split(/[.!?]+/).map((s) => s.trim());
  const results: string[] = [];

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (keywords.some((k) => lower.includes(k)) && sentence.length > 20) {
      results.push(sentence);
    }
  }

  return results.slice(0, 10);
}

// =============================================================================
// Web Surfer Agent Implementation
// =============================================================================

/**
 * Web Surfer Agent
 *
 * Browses and extracts content from web pages.
 * Inspired by AutoGen's MultimodalWebSurfer.
 *
 * @implements {Agent}
 */
export class WebSurferAgent implements Agent {
  id = 'web_surfer';
  role = 'Web Content Extractor';
  goal = 'Extract and analyze content from financial websites and SEC filings';
  description = 'Browses web pages and extracts structured content. Useful for detailed SEC filing analysis or news article extraction. Call when deeper web research is needed.';
  tools = ['jina'];

  personality?: AgentPersonality;
  memory?: AgentMemoryConfig;

  private jinaSource: JinaDataSource;

  // Internal cache (1 hour TTL)
  private cache: Map<string, CachedContent> = new Map();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  // Internal state
  private processedUrls: string[] = [];
  private lastProcessingTimestamp = 0;
  private messageHistory: AgentMessage[] = [];

  constructor(jinaSource: JinaDataSource, personality?: AgentPersonality) {
    this.jinaSource = jinaSource;
    this.personality = personality;
  }

  async execute(
    context: AgentContext,
    portfolio: PortfolioState
  ): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // Get URLs from handoff context or message thread
      const request = this.extractWebSurfingRequest(context);

      if (request.urls.length === 0) {
        return this.createEmptyResult(startTime, 'No URLs provided for web surfing');
      }

      // Extract content from all URLs
      const extractedContent = await this.extractAllContent(request.urls);

      // Analyze the extracted content
      const analysis = this.analyzeContent(extractedContent, request);

      // Generate summary
      const summary = this.generateSummary(extractedContent, analysis);

      // Update internal state
      this.processedUrls = request.urls;
      this.lastProcessingTimestamp = Date.now();

      const successfulExtractions = extractedContent.filter((c) => !c.error).length;

      return {
        agentId: this.id,
        status: successfulExtractions > 0 ? 'success' : 'partial',
        data: {
          extracted_content: extractedContent,
          analysis,
          urls_processed: request.urls.length,
          successful_extractions: successfulExtractions,
        } as Record<string, unknown>,
        summary,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          tokensUsed: 0,
          dataSources: ['jina'],
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        agentId: this.id,
        status: 'failed',
        data: {
          extracted_content: [],
          analysis: this.createEmptyAnalysis(),
          urls_processed: 0,
          successful_extractions: 0,
        } as Record<string, unknown>,
        summary: `Web surfing failed: ${errorMessage}`,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          tokensUsed: 0,
          dataSources: ['jina'],
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
        processedUrls: this.processedUrls,
        lastProcessingTimestamp: this.lastProcessingTimestamp,
        cacheKeys: Array.from(this.cache.keys()),
      } as Record<string, unknown>,
      messageHistory: this.messageHistory,
    };
  }

  loadState(state: AgentState): void {
    if (state.agentId !== this.id) {
      console.warn(`State agent ID mismatch: expected ${this.id}, got ${state.agentId}`);
      return;
    }

    const internalState = state.internalState as {
      processedUrls?: string[];
      lastProcessingTimestamp?: number;
      cacheKeys?: string[];
    };
    this.processedUrls = internalState.processedUrls || [];
    this.lastProcessingTimestamp = internalState.lastProcessingTimestamp || 0;
    // Note: Cache content would need to be refetched
    this.messageHistory = state.messageHistory || [];
  }

  // ===========================================================================
  // Request Extraction
  // ===========================================================================

  /**
   * Extract web surfing request from context
   */
  private extractWebSurfingRequest(context: AgentContext): WebSurfingRequest {
    const urls: string[] = [];
    const tickers: string[] = [];
    const lookFor: string[] = [];

    // Check message thread for handoff context
    for (const message of context.messageThread) {
      if (message.type === 'handoff') {
        const handoffContext = (message as unknown as { context?: WebSurfingRequest }).context;
        if (handoffContext?.urls) {
          urls.push(...handoffContext.urls);
        }
        if (handoffContext?.tickers) {
          tickers.push(...handoffContext.tickers);
        }
        if (handoffContext?.lookFor) {
          lookFor.push(...handoffContext.lookFor);
        }
      }
    }

    // Also check for URLs in the query
    const urlPattern = /https?:\/\/[^\s]+/g;
    const queryUrls = context.query.match(urlPattern);
    if (queryUrls) {
      urls.push(...queryUrls);
    }

    // Deduplicate
    return {
      urls: Array.from(new Set(urls)),
      tickers: Array.from(new Set(tickers)),
      lookFor: Array.from(new Set(lookFor)),
    };
  }

  // ===========================================================================
  // Content Extraction
  // ===========================================================================

  /**
   * Extract content from all URLs
   */
  private async extractAllContent(urls: string[]): Promise<ExtractedContent[]> {
    const results: ExtractedContent[] = [];

    // Process URLs in parallel with concurrency limit
    const CONCURRENCY = 3;
    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      const batch = urls.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((url) => this.extractContent(url))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Extract content from a single URL
   */
  private async extractContent(url: string): Promise<ExtractedContent> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.content;
    }

    try {
      // Determine content type and use appropriate extraction
      if (url.includes('sec.gov')) {
        return await this.extractSECContent(url);
      } else {
        return await this.extractNewsContent(url);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        url,
        title: 'Extraction Failed',
        content: '',
        error: errorMessage,
        extracted_data: {},
      };
    }
  }

  /**
   * Extract content from SEC filing
   */
  private async extractSECContent(url: string): Promise<ExtractedContent> {
    const rawContent = await this.jinaSource.fetchArticleContent(url);

    if (rawContent.error) {
      return rawContent;
    }

    // Parse SEC-specific content
    const parsed = this.parseSECFiling(rawContent.content);

    const result: ExtractedContent = {
      url,
      title: parsed.title || rawContent.title,
      content: parsed.mainContent,
      extracted_data: {
        tables: parsed.tables,
        financialData: parsed.financialData,
        keyPoints: parsed.keyPoints,
      },
    };

    // Cache the result
    this.cache.set(url, { content: result, timestamp: Date.now() });

    return result;
  }

  /**
   * Extract content from news article
   */
  private async extractNewsContent(url: string): Promise<ExtractedContent> {
    const rawContent = await this.jinaSource.fetchArticleContent(url);

    if (rawContent.error) {
      return rawContent;
    }

    // Parse news-specific content
    const parsed = this.parseNewsArticle(rawContent.content);

    const result: ExtractedContent = {
      url,
      title: parsed.title || rawContent.title,
      content: parsed.mainContent,
      extracted_data: {
        keyPoints: parsed.keyPoints,
        financialData: parsed.financialData,
      },
    };

    // Cache the result
    this.cache.set(url, { content: result, timestamp: Date.now() });

    return result;
  }

  // ===========================================================================
  // Content Parsing
  // ===========================================================================

  /**
   * Parse SEC filing content
   */
  private parseSECFiling(content: string): ParsedContent {
    const lines = content.split('\n');
    
    // Extract title (usually first meaningful line)
    let title = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('http') && trimmed.length > 10) {
        title = trimmed;
        break;
      }
    }

    // Extract financial data
    const financialData = extractFinancialMetrics(content);

    // Extract key points
    const keyPoints = extractKeyPoints(content);

    // Extract tables (simplified - look for tabular patterns)
    const tables = this.extractTables(content);

    return {
      title,
      mainContent: content,
      tables,
      financialData,
      keyPoints,
    };
  }

  /**
   * Parse news article content
   */
  private parseNewsArticle(content: string): ParsedContent {
    const lines = content.split('\n');
    
    // Extract title
    let title = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('http') && trimmed.length > 10) {
        title = trimmed;
        break;
      }
    }

    // Extract financial data (if any)
    const financialData = extractFinancialMetrics(content);

    // Extract key points
    const keyPoints = extractKeyPoints(content);

    return {
      title,
      mainContent: content,
      tables: [],
      financialData,
      keyPoints,
    };
  }

  /**
   * Extract tables from content (simplified)
   */
  private extractTables(content: string): ParsedTable[] {
    const tables: ParsedTable[] = [];
    const lines = content.split('\n');

    // Look for lines with multiple pipe characters (markdown tables)
    let currentTable: ParsedTable | null = null;

    for (const line of lines) {
      if (line.includes('|') && line.split('|').length >= 3) {
        const cells = line.split('|').map((c) => c.trim()).filter((c) => c);
        
        if (!currentTable) {
          currentTable = { headers: cells, rows: [] };
        } else if (!line.match(/^[\s|:-]+$/)) {
          // Skip separator lines
          currentTable.rows.push(cells);
        }
      } else if (currentTable && currentTable.rows.length > 0) {
        tables.push(currentTable);
        currentTable = null;
      }
    }

    if (currentTable && currentTable.rows.length > 0) {
      tables.push(currentTable);
    }

    return tables.slice(0, 5); // Limit to 5 tables
  }

  // ===========================================================================
  // Content Analysis
  // ===========================================================================

  /**
   * Analyze extracted content
   */
  private analyzeContent(
    content: ExtractedContent[],
    request: WebSurfingRequest
  ): WebContentAnalysis {
    const allContent = content
      .filter((c) => !c.error)
      .map((c) => c.content)
      .join('\n\n');

    // Extract key findings
    const keyFindings = this.extractKeyFindings(content);

    // Aggregate financial metrics
    const financialMetrics: Record<string, number | string> = {};
    for (const item of content) {
      if (item.extracted_data?.financialData) {
        Object.assign(financialMetrics, item.extracted_data.financialData);
      }
    }

    // Extract risk factors
    const riskFactors = extractSentencesWithKeywords(allContent, RISK_KEYWORDS);

    // Extract opportunities
    const opportunities = extractSentencesWithKeywords(allContent, OPPORTUNITY_KEYWORDS);

    return {
      key_findings: keyFindings,
      financial_metrics: financialMetrics,
      risk_factors: riskFactors,
      opportunities: opportunities,
    };
  }

  /**
   * Extract key findings from all content
   */
  private extractKeyFindings(content: ExtractedContent[]): string[] {
    const findings: string[] = [];

    for (const item of content) {
      if (item.error) continue;

      // Add key points
      const keyPoints = item.extracted_data?.keyPoints as string[] | undefined;
      if (keyPoints) {
        findings.push(...keyPoints.slice(0, 3));
      }

      // Add financial highlights
      const financialData = item.extracted_data?.financialData as Record<string, number> | undefined;
      if (financialData) {
        for (const [key, value] of Object.entries(financialData)) {
          if (typeof value === 'number') {
            const formatted = this.formatFinancialValue(key, value);
            findings.push(`${key}: ${formatted}`);
          }
        }
      }
    }

    return Array.from(new Set(findings)).slice(0, 15);
  }

  /**
   * Format financial value for display
   */
  private formatFinancialValue(key: string, value: number): string {
    if (key.includes('Margin') || key.includes('margin')) {
      return `${value.toFixed(1)}%`;
    }
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(2)}B`;
    }
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    return `$${value.toFixed(2)}`;
  }

  /**
   * Create empty analysis result
   */
  private createEmptyAnalysis(): WebContentAnalysis {
    return {
      key_findings: [],
      financial_metrics: {},
      risk_factors: [],
      opportunities: [],
    };
  }

  // ===========================================================================
  // Summary Generation
  // ===========================================================================

  /**
   * Generate summary of web surfing results
   */
  private generateSummary(
    content: ExtractedContent[],
    analysis: WebContentAnalysis
  ): string {
    const parts: string[] = [];

    const successful = content.filter((c) => !c.error).length;
    const failed = content.filter((c) => c.error).length;

    parts.push(`🌐 Extracted content from ${successful} of ${content.length} URLs`);

    if (failed > 0) {
      parts.push(`(${failed} failed)`);
    }

    // Key findings
    if (analysis.key_findings.length > 0) {
      parts.push(`Key findings: ${analysis.key_findings.slice(0, 3).join('; ')}`);
    }

    // Financial metrics
    const metricCount = Object.keys(analysis.financial_metrics).length;
    if (metricCount > 0) {
      parts.push(`Extracted ${metricCount} financial metrics`);
    }

    // Risk factors
    if (analysis.risk_factors.length > 0) {
      parts.push(`Identified ${analysis.risk_factors.length} risk factors`);
    }

    // Opportunities
    if (analysis.opportunities.length > 0) {
      parts.push(`Found ${analysis.opportunities.length} potential opportunities`);
    }

    return parts.join('. ');
  }

  /**
   * Create empty result when no URLs provided
   */
  private createEmptyResult(startTime: number, message: string): AgentResult {
    return {
      agentId: this.id,
      status: 'partial',
      data: {
        extracted_content: [],
        analysis: this.createEmptyAnalysis(),
        urls_processed: 0,
        successful_extractions: 0,
      } as Record<string, unknown>,
      summary: message,
      metadata: {
        executionTimeMs: Date.now() - startTime,
        tokensUsed: 0,
        dataSources: ['jina'],
      },
    };
  }

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  /**
   * Clear the content cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Prune expired cache entries
   */
  pruneExpiredCache(): number {
    const now = Date.now();
    let pruned = 0;

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > this.CACHE_TTL_MS) {
        this.cache.delete(key);
        pruned++;
      }
    }

    return pruned;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a Web Surfer Agent with optional API key
 */
export function createWebSurferAgent(options?: {
  jinaApiKey?: string;
  personality?: AgentPersonality;
}): WebSurferAgent {
  const jina = createJinaDataSource({ apiKey: options?.jinaApiKey });
  return new WebSurferAgent(jina, options?.personality);
}

/**
 * Create a Web Surfer Agent with custom Jina data source
 */
export function createWebSurferAgentWithSource(
  jinaSource: JinaDataSource,
  personality?: AgentPersonality
): WebSurferAgent {
  return new WebSurferAgent(jinaSource, personality);
}

export default WebSurferAgent;
