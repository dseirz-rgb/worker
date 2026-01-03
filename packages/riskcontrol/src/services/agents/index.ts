/**
 * Multi-Agent Investment Analysis System
 *
 * This module provides a TypeScript-based multi-agent orchestration framework
 * for coordinating specialized AI agents to perform comprehensive investment analysis.
 *
 * Inspired by:
 * - AutoGen: Multi-agent orchestration patterns (Sequential, Selector, Handoff)
 * - CrewAI: Agent role and goal definitions
 * - Agno: Memory system and extended thinking
 * - Stockagent: Agent personality system
 *
 * @module agents
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for detailed design
 */

// =============================================================================
// Core Types from types.ts
// =============================================================================

export type {
  // Agent Personality System
  RiskTolerance,
  DecisionStyle,
  AgentPersonality,

  // Agent Memory System
  MemoryRetrievalStrategy,
  MemoryEntryType,
  AgentMemoryConfig,
  MemoryEntry,
  MemoryStorage,

  // Agent State Persistence
  AgentMessage,
  AgentState,

  // Agent Handoff System
  HandoffMessage,

  // Agent Result Types
  AgentResultStatus,
  AgentResultMetadata,
  AgentResult,

  // External Data Types
  NewsItem,
  SECFiling,
  NewsCacheEntry,
  SECFilingsCacheEntry,
  ArticleContentCacheEntry,
  ExternalDataCache,

  // Agent Context
  OrchestrationMode,
  AgentContext,

  // Portfolio Types
  Position,
  PortfolioState,

  // Agent Interface
  Agent,

  // Extended Thinking
  ExtendedThinkingTriggers,
  ExtendedThinkingConfig,

  // Orchestrator Types
  ProgressStatus,
  RiskLevel,
  RecommendationType,
  FinalReport,
  AgentTrace,
  HandoffTrace,
  ExecutionTrace,
  OrchestratorResult,
  CacheState,
  OrchestratorState,
  ExecutionOptions,

  // Context Management
  MessageTransform,
  TransformConfig,

  // Alert System
  AlertSeverity,
  AlertType,
  AgentAlertEvent,
  AlertTriggerConfig,

  // Data Source Interface
  DataSource,

  // Agent-Specific Data Types
  ConcentrationAnalysis,
  StressTestResult,
  DrawdownAnalysis,
  LeverageAssessment,
  ActionItem,
  ExtractedContent,

  // Utility Types
  QueryComplexity,
  CacheEntry,
  RateLimiterConfig,
} from './types';

// =============================================================================
// Type Guards and Utilities from types.ts
// =============================================================================

export { isHandoffMessage } from './types';

// =============================================================================
// Error Classes from types.ts
// =============================================================================

export { AgentExecutionError } from './types';

// =============================================================================
// Default Configurations from types.ts
// =============================================================================

export {
  DEFAULT_EXTENDED_THINKING_CONFIG,
  DEFAULT_TRANSFORM_CONFIG,
  DEFAULT_ALERT_TRIGGERS,
} from './types';

// =============================================================================
// Factory Functions from types.ts
// =============================================================================

export {
  createEmptyExternalDataCache,
  createDefaultAgentContext,
  createDefaultPersonality,
  createDefaultMemoryConfig,
} from './types';

// =============================================================================
// Orchestrator
// =============================================================================

export {
  AgentOrchestrator,
  CacheManager,
  createOrchestrator,
  createCacheManager,
} from './orchestrator';

export type {
  OrchestratorOptions,
  ProgressCallback,
  LLMCallFunction,
} from './orchestrator';

// =============================================================================
// Memory System
// =============================================================================

export {
  AgentMemoryManager,
  LocalStorageMemory,
  InMemoryStorage,
  createMemoryManager,
  DEFAULT_MEMORY_CONFIG,
} from './memory';

export type {
  MemoryEntryInput,
  MemoryRetrievalOptions,
  RetrievalContext,
} from './memory';

// =============================================================================
// Personality System
// =============================================================================

export {
  DEFAULT_PERSONALITIES,
  generatePersonalityPrompt,
  getActionPriorityMultiplier,
  getMaxPositionSize,
  getMinCashReserve,
  mergePersonality,
  validatePersonality,
  createPersonalityFromPreset,
  describePersonality,
} from './personality';

export type { PersonalityOverride } from './personality';

// =============================================================================
// State Persistence
// =============================================================================

export type { StateStorage } from './stateManager';

export {
  StateManager,
  LocalStorageStateStorage,
  InMemoryStateStorage,
  createStateManager,
  createInMemoryStateManager,
  createEmptyOrchestratorState,
  createEmptyCacheState,
  createAgentState,
} from './stateManager';

// =============================================================================
// Alert System
// =============================================================================

export type { AlertCheckOptions, AlertCallback } from './alertManager';

export {
  AgentAlertManager,
  createAlertManager,
  createAlertManagerWithConfig,
  convertToRiskAlert,
  sendAgentAlert,
  shouldSendEmail,
  formatAlertForToast,
} from './alertManager';

// =============================================================================
// Extended Thinking Module
// =============================================================================

export type {
  ExtendedThinkingResult,
  ThinkingContext,
  ExtendedThinkingLLMOptions,
  LLMResponse,
  LLMClient,
} from './extendedThinking';

export {
  ExtendedThinkingExecutor,
  shouldUseExtendedThinking,
  containsDeepAnalysisKeywords,
  isComplexDecision,
  createExtendedThinkingExecutor,
  createDefaultTriggers,
  estimateThinkingTokens,
  wouldExceedBudget,
  formatThinkingProcess,
} from './extendedThinking';

// =============================================================================
// Context Management (TransformMessages) Module
// =============================================================================

export type { TokenLimiterOptions } from './transforms';

export {
  MessageHistoryLimiter,
  MessageTokenLimiter,
  TransformChain,
  createTransformChain,
  createDefaultTransformChain,
  estimateTokens,
  truncateToTokens,
  getMessageStats,
  shouldApplyTransforms,
  logTransformApplication,
} from './transforms';

// =============================================================================
// Agent Implementations
// =============================================================================

export {
  PositionAnalystAgent,
  createPositionAnalystAgent,
  createConservativePositionAnalyst,
  createAggressivePositionAnalyst,
} from './positionAnalyst';

export type {
  CorrelationRisk,
  PerformanceAttribution,
  PerformanceAttributionSummary,
} from './positionAnalyst';

export { RiskAnalystAgent, createRiskAnalystAgent } from './riskAnalyst';

export {
  MarketAnalystAgent,
  createMarketAnalystAgent,
  createMarketAnalystAgentWithSources,
} from './marketAnalyst';

export type {
  MarketSentiment,
  TickerSentiment,
  MarketEvent,
  MarketAnalysisResult,
} from './marketAnalyst';

export {
  AdvisorAgent,
  createAdvisorAgent,
  createConservativeAdvisor,
  createAggressiveAdvisor,
} from './advisorAgent';

export type {
  AdvisorConfig,
  SynthesisResult,
} from './advisorAgent';

export {
  WebSurferAgent,
  createWebSurferAgent,
  createWebSurferAgentWithSource,
} from './webSurfer';

export type {
  ParsedContent,
  ParsedTable,
  WebSurfingRequest,
  WebSurfingResult,
  WebContentAnalysis,
} from './webSurfer';

// =============================================================================
// Multi-Agent Service
// =============================================================================

export {
  MultiAgentService,
  createMultiAgentService,
  analyzePortfolio,
} from './multiAgentService';

export type {
  MultiAgentConfig,
  AnalysisRequest,
  ServiceStatus,
} from './multiAgentService';

// =============================================================================
// Data Source Adapters
// =============================================================================

export type {
  SerperDataSourceConfig,
  SECDataSourceConfig,
  JinaDataSourceConfig,
} from './dataSources';

export {
  // Rate Limiter
  RateLimiter,

  // Base Class
  BaseDataSource,

  // Data Source Implementations
  SerperDataSource,
  SECDataSource,
  JinaDataSource,

  // Cache Manager
  DataSourceCacheManager,

  // Factory Functions
  createSerperDataSource,
  createSECDataSource,
  createJinaDataSource,
  createDataSourceManager,
} from './dataSources';
