/**
 * Adaptive RAG System
 *
 * A self-adaptive retrieval-augmented generation system based on
 * LangGraph state graph architecture with AutoGen message transformation.
 *
 * @module adaptiveRag
 * @see {@link .kiro/specs/adaptive-rag/design.md} for detailed design
 */

// Types
export type {
  // Message types
  Message,
  ContentPart,

  // Route decision types
  DataSource,
  RouteDecision,

  // Document types
  Document,
  Citation,

  // Grading types
  GradeResult,
  GradeResultWithExplanation,

  // Graph state
  GraphState,
  WebSearchFlag,

  // Configuration types
  MessageTransformerConfig,
  TransformResult,
  QueryRouterConfig,
  DocumentGraderConfig,
  HallucinationGraderConfig,
  AnswerGraderConfig,
  AdaptiveRAGConfig,
} from './types';

// Default configurations
export {
  DEFAULT_MESSAGE_TRANSFORMER_CONFIG,
  DEFAULT_QUERY_ROUTER_CONFIG,
  DEFAULT_DOCUMENT_GRADER_CONFIG,
  DEFAULT_HALLUCINATION_GRADER_CONFIG,
  DEFAULT_ANSWER_GRADER_CONFIG,
  DEFAULT_ADAPTIVE_RAG_CONFIG,
} from './types';

// Message Transformer
export {
  MessageTransformer,
  createMessageTransformer,
  defaultMessageTransformer,
  estimateTokens,
  estimateMessageTokens,
  calculateTotalTokens,
  getMessageText,
} from './messageTransformer';

// Query Router
export { QueryRouter, queryRouter } from './queryRouter';

// Document Grader
export { DocumentGrader, documentGrader } from './documentGrader';

// Hallucination Grader
export {
  HallucinationGrader,
  hallucinationGrader,
  type HallucinationGraderResult,
} from './hallucinationGrader';

// Answer Grader
export {
  AnswerGrader,
  answerGrader,
  type AnswerGraderResult,
} from './answerGrader';

// Adaptive RAG Service (Main orchestration)
export {
  AdaptiveRAGService,
  adaptiveRagService,
  getAdaptiveInvestmentContext,
} from './adaptiveRagService';
