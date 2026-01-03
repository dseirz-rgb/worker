/**
 * Unified Intelligence System
 *
 * 统一入口模块，整合 Multi-Agent System、Adaptive RAG、LightRAG 和 Voice Service。
 *
 * @module unifiedIntelligence
 * @see {@link .kiro/specs/unified-intelligence/design.md}
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Configuration
  UnifiedIntelligenceConfig,

  // Processing modes
  ProcessingMode,
  ClassificationResult,

  // Query types
  QueryContext,
  QueryResult,
  QueryOptions,

  // Analysis types
  AnalysisResult,
  DeepAnalyzeOptions,

  // Voice types
  VoiceContext,
  LatestAnalysisSummary,

  // Daily insight types
  DailyInsight,
  PositionInsights,
  RiskInsights,
  MarketInsights,
  AdvisorRecommendation,

  // User preferences
  UserPreferences,

  // Retrieval types
  RetrievalResult,
  ValidationResult,

  // Re-exported from agents
  AgentResult,
  AgentAlertEvent,
  PortfolioState,
  ProgressStatus,

  // Re-exported from adaptiveRag
  Citation,
  Message,
} from './types';

export { DEFAULT_UNIFIED_INTELLIGENCE_CONFIG } from './types';

// =============================================================================
// Services
// =============================================================================

// Main service
export {
  UnifiedIntelligenceService,
  unifiedIntelligenceService,
  query,
  deepAnalyze,
  quickAnswer,
  isUnifiedIntelligenceEnabled,
  resetFeatureFlagCache,
} from './unifiedIntelligenceService';

// Query classifier
export {
  QueryClassifier,
  queryClassifier,
  classifyQuery,
  classifyQueryFast,
  type QueryClassifierConfig,
} from './queryClassifier';

// Enhanced RAG
export {
  EnhancedAdaptiveRAGService,
  enhancedAdaptiveRagService,
  retrieveForAgent,
  type AgentRetrievalOptions,
} from './enhancedAdaptiveRag';

// Agent-RAG integration
export {
  AgentRAGIntegration,
  agentRagIntegration,
  retrieveWithQualityControl,
  validateAgentResponse,
  type QualityControlOptions,
  type QualityControlledRetrievalResult,
  type GradedDocument,
} from './agentRagIntegration';

// Cache
export {
  UnifiedIntelligenceCache,
  unifiedIntelligenceCache,
  AGENT_RESULT_TTL,
  LIGHTRAG_TTL,
  MARKET_DATA_TTL,
  QUERY_RESULT_TTL,
  DAILY_INSIGHT_TTL,
} from './cache';
