/**
 * Unified Intelligence System - Core Type Definitions
 *
 * This module defines all TypeScript interfaces for the Unified Intelligence System,
 * which integrates Multi-Agent System, Adaptive RAG, LightRAG, and Voice Service.
 *
 * @module unifiedIntelligence/types
 * @see {@link .kiro/specs/unified-intelligence/design.md} for detailed design
 */

import type {
  AgentResult,
  AgentAlertEvent,
  PortfolioState,
  ProgressStatus,
} from '../agents/types';
import type { Citation, Message } from '../adaptiveRag/types';

// Re-export commonly used types for convenience
export type { AgentResult, AgentAlertEvent, PortfolioState, ProgressStatus };
export type { Citation, Message };

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configuration for the Unified Intelligence Service.
 *
 * @example
 * ```typescript
 * const config: UnifiedIntelligenceConfig = {
 *   enableMultiAgent: true,
 *   enableAdaptiveRAG: true,
 *   confidenceThreshold: 0.8,
 *   maxAgentTime: 30000,
 *   cacheEnabled: true,
 *   cacheTTL: 300000,
 * };
 * ```
 *
 * @see Requirements 3.1, 3.2, 8.5, 8.6
 */
export interface UnifiedIntelligenceConfig {
  /** Enable multi-agent analysis (default: true) */
  enableMultiAgent: boolean;

  /** Enable adaptive RAG (default: true) */
  enableAdaptiveRAG: boolean;

  /** Confidence threshold for routing (default: 0.8) */
  confidenceThreshold: number;

  /** Maximum agent execution time in ms (default: 30000) */
  maxAgentTime: number;

  /** Enable caching (default: true) */
  cacheEnabled: boolean;

  /** Cache TTL in ms (default: 300000 = 5 minutes) */
  cacheTTL: number;
}

/**
 * Default configuration for Unified Intelligence Service.
 */
export const DEFAULT_UNIFIED_INTELLIGENCE_CONFIG: UnifiedIntelligenceConfig = {
  enableMultiAgent: true,
  enableAdaptiveRAG: true,
  confidenceThreshold: 0.8,
  maxAgentTime: 30000,
  cacheEnabled: true,
  cacheTTL: 300000,
};

// =============================================================================
// Query Classification Types
// =============================================================================

/**
 * Processing modes for queries.
 * - rag_only: Fast response using Adaptive RAG only (<2s)
 * - rag_agent: RAG retrieval + single agent analysis (5-15s)
 * - full_agent: Full multi-agent sequential analysis (15-30s)
 */
export type ProcessingMode = 'rag_only' | 'rag_agent' | 'full_agent';

/**
 * Result from query classification.
 *
 * @example
 * ```typescript
 * const result: ClassificationResult = {
 *   mode: 'rag_only',
 *   confidence: 0.92,
 *   reasoning: 'Simple factual question about investment principles',
 *   suggestedAgents: [],
 * };
 * ```
 *
 * @see Requirements 3.1, 3.2
 */
export interface ClassificationResult {
  /** Selected processing mode */
  mode: ProcessingMode;

  /** Confidence score from 0.0 to 1.0 */
  confidence: number;

  /** Brief explanation of the classification decision */
  reasoning: string;

  /** Suggested agents for rag_agent or full_agent modes */
  suggestedAgents?: string[];
}

// =============================================================================
// Query Context Types
// =============================================================================

/**
 * User preferences for analysis.
 */
export interface UserPreferences {
  /** Preferred language for responses */
  language?: 'zh' | 'en';

  /** Risk tolerance level */
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';

  /** Preferred analysis depth */
  analysisDepth?: 'quick' | 'standard' | 'deep';
}

/**
 * Context for query execution.
 *
 * @example
 * ```typescript
 * const context: QueryContext = {
 *   conversationHistory: messages,
 *   portfolio: currentPortfolio,
 *   userPreferences: { language: 'zh' },
 *   forceMode: 'full_agent',
 * };
 * ```
 *
 * @see Requirements 3.3, 5.5
 */
export interface QueryContext {
  /** Conversation history for context */
  conversationHistory?: Message[];

  /** Current portfolio state */
  portfolio?: PortfolioState;

  /** User preferences */
  userPreferences?: UserPreferences;

  /** Force a specific processing mode */
  forceMode?: ProcessingMode;
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * Result from a query operation.
 *
 * @example
 * ```typescript
 * const result: QueryResult = {
 *   text: 'Based on your portfolio...',
 *   citations: [{ source: 'LightRAG', title: '...', content_snippet: '...' }],
 *   mode: 'rag_only',
 *   confidence: 0.85,
 *   processingTime: 1500,
 * };
 * ```
 *
 * @see Requirements 1.4, 5.4
 */
export interface QueryResult {
  /** Generated response text */
  text: string;

  /** Source citations */
  citations: Citation[];

  /** Processing mode used */
  mode: ProcessingMode;

  /** Agent results (if multi-agent was used) */
  agentResults?: AgentResult[];

  /** Confidence score */
  confidence: number;

  /** Processing time in milliseconds */
  processingTime: number;
}

/**
 * Extended result for deep analysis operations.
 *
 * @example
 * ```typescript
 * const result: AnalysisResult = {
 *   text: 'Comprehensive analysis...',
 *   citations: [...],
 *   mode: 'full_agent',
 *   summary: 'Portfolio shows moderate risk...',
 *   riskLevel: 'medium',
 *   recommendations: ['Reduce tech exposure', 'Add bonds'],
 *   alerts: [],
 *   confidence: 0.9,
 *   processingTime: 25000,
 * };
 * ```
 *
 * @see Requirements 4.1, 4.3
 */
export interface AnalysisResult extends QueryResult {
  /** Executive summary */
  summary: string;

  /** Overall risk level */
  riskLevel: 'low' | 'medium' | 'high';

  /** Action recommendations */
  recommendations: string[];

  /** Triggered alerts */
  alerts: AgentAlertEvent[];
}


// =============================================================================
// Voice Service Types
// =============================================================================

/**
 * Latest analysis summary for voice context.
 */
export interface LatestAnalysisSummary {
  /** When the analysis was performed */
  timestamp: Date;

  /** Executive summary */
  summary: string;

  /** Overall risk level */
  riskLevel: 'low' | 'medium' | 'high';

  /** Key findings from the analysis */
  keyFindings: string[];
}

/**
 * Context for voice service integration.
 * Provides summarized portfolio and analysis state for voice interactions.
 *
 * @example
 * ```typescript
 * const context: VoiceContext = {
 *   portfolioSummary: '当前持仓总值 $150,000，主要集中在科技板块',
 *   riskSummary: '风险等级中等，当前回撤 5.2%',
 *   latestAnalysis: {
 *     timestamp: new Date(),
 *     summary: '组合整体健康',
 *     riskLevel: 'medium',
 *     keyFindings: ['科技板块集中度偏高', '杠杆率在安全范围内']
 *   },
 *   recentAlerts: []
 * };
 * ```
 *
 * @see Requirements 7.1, 7.4
 */
export interface VoiceContext {
  /** Human-readable portfolio summary */
  portfolioSummary: string;

  /** Human-readable risk summary */
  riskSummary: string;

  /** Latest analysis results (if available) */
  latestAnalysis?: LatestAnalysisSummary;

  /** Recent alerts for awareness */
  recentAlerts: AgentAlertEvent[];
}

// =============================================================================
// Daily Insight Types
// =============================================================================

/**
 * Position-related insights from Position Analyst.
 */
export interface PositionInsights {
  /** Source agent */
  agentId: 'position_analyst';

  /** Summary of position analysis */
  summary: string;

  /** Key changes since last analysis */
  keyChanges: string[];
}

/**
 * Risk-related insights from Risk Analyst.
 */
export interface RiskInsights {
  /** Source agent */
  agentId: 'risk_analyst';

  /** Summary of risk analysis */
  summary: string;

  /** Current risk level */
  riskLevel: 'low' | 'medium' | 'high';

  /** Risk warnings */
  warnings: string[];
}

/**
 * Market-related insights from Market Analyst.
 */
export interface MarketInsights {
  /** Source agent */
  agentId: 'market_analyst';

  /** Summary of market analysis */
  summary: string;

  /** Key market headlines */
  headlines: string[];
}

/**
 * Recommendation from Advisor agent.
 */
export interface AdvisorRecommendation {
  /** Source agent */
  agentId: 'advisor';

  /** Summary recommendation */
  summary: string;

  /** Suggested actions */
  actions: string[];
}

/**
 * Daily insight structure combining all agent analyses.
 * Used for Daily Briefing feature.
 *
 * @example
 * ```typescript
 * const insight: DailyInsight = {
 *   date: '2025-12-28',
 *   summary: '今日组合表现稳定，无重大风险',
 *   positionInsights: {
 *     agentId: 'position_analyst',
 *     summary: '持仓结构健康',
 *     keyChanges: ['AAPL 权重上升 2%']
 *   },
 *   riskInsights: {
 *     agentId: 'risk_analyst',
 *     summary: '风险可控',
 *     riskLevel: 'low',
 *     warnings: []
 *   },
 *   marketInsights: {
 *     agentId: 'market_analyst',
 *     summary: '市场情绪偏乐观',
 *     headlines: ['Fed 维持利率不变']
 *   },
 *   recommendation: {
 *     agentId: 'advisor',
 *     summary: '建议维持当前配置',
 *     actions: ['继续观察科技板块走势']
 *   }
 * };
 * ```
 *
 * @see Requirements 6.1, 6.2, 6.3, 6.4
 */
export interface DailyInsight {
  /** Date of the insight (YYYY-MM-DD) */
  date: string;

  /** Overall summary for the day */
  summary: string;

  /** Position analysis insights */
  positionInsights: PositionInsights;

  /** Risk analysis insights */
  riskInsights: RiskInsights;

  /** Market analysis insights */
  marketInsights: MarketInsights;

  /** Advisor recommendation */
  recommendation: AdvisorRecommendation;
}

// =============================================================================
// Service Interface Types
// =============================================================================

/**
 * Options for query execution.
 */
export interface QueryOptions {
  /** Force a specific processing mode */
  forceMode?: ProcessingMode;

  /** Skip cache and fetch fresh data */
  skipCache?: boolean;

  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Options for deep analysis.
 */
export interface DeepAnalyzeOptions {
  /** Custom query to focus the analysis */
  query?: string;

  /** Include specific agents only */
  includeAgents?: string[];

  /** Exclude specific agents */
  excludeAgents?: string[];

  /** Callback for progress updates */
  onProgress?: (progress: ProgressStatus) => void;

  /** Callback for alerts */
  onAlert?: (alert: AgentAlertEvent) => void;
}

/**
 * Retrieval result for agent integration.
 */
export interface RetrievalResult {
  /** Retrieved documents */
  documents: Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    relevance_score?: number;
  }>;

  /** Source citations */
  citations: Citation[];

  /** Whether relevant documents were found */
  hasRelevantDocs: boolean;
}

/**
 * Validation result for agent responses.
 */
export interface ValidationResult {
  /** Whether the response is grounded in documents */
  isGrounded: boolean;

  /** Explanation of the validation */
  explanation: string;

  /** Whether regeneration is needed */
  needsRegeneration: boolean;
}
