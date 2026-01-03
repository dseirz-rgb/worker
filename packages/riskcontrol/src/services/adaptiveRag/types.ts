/**
 * Adaptive RAG System - Core Type Definitions
 *
 * This module defines all TypeScript interfaces for the Adaptive RAG system,
 * based on LangGraph state graph architecture with AutoGen message transformation.
 *
 * @module adaptiveRag/types
 * @see {@link .kiro/specs/adaptive-rag/design.md} for detailed design
 */

// =============================================================================
// Message Types
// =============================================================================

/**
 * Content part for multi-modal messages.
 */
export interface ContentPart {
  /** Type of content */
  type: 'text' | 'image';

  /** Text content (for type='text') */
  text?: string;

  /** Image URL (for type='image') */
  image_url?: string;
}

/**
 * Message in the conversation thread.
 * Used for tracking conversation history.
 */
export interface Message {
  /** Role of the message sender */
  role: 'user' | 'assistant' | 'system';

  /** Message content - can be string or multi-modal content */
  content: string | ContentPart[];

  /** Timestamp when the message was created */
  timestamp?: Date;
}

// =============================================================================
// Route Decision Types
// =============================================================================

/**
 * Available data sources for routing.
 * - vectorstore: Investment knowledge, strategies, principles, book notes
 * - structured_data: Portfolio positions, transactions, market data
 * - websearch: Current events, real-time information
 */
export type DataSource = 'vectorstore' | 'structured_data' | 'websearch';

/**
 * Query routing decision from the Query Router.
 *
 * @example
 * ```typescript
 * const decision: RouteDecision = {
 *   datasource: 'vectorstore',
 *   confidence: 0.85,
 *   reasoning: 'Query asks about investment principles'
 * };
 * ```
 */
export interface RouteDecision {
  /** Selected data source */
  datasource: DataSource;

  /** Confidence score from 0.0 to 1.0 */
  confidence: number;

  /** Brief explanation of the routing decision */
  reasoning: string;
}

// =============================================================================
// Document Types
// =============================================================================

/**
 * Document retrieved from knowledge sources.
 */
export interface Document {
  /** Unique document identifier */
  id: string;

  /** Document content */
  content: string;

  /** Document metadata */
  metadata: Record<string, unknown>;

  /** Relevance score from retrieval (optional) */
  relevance_score?: number;
}

/**
 * Citation for source attribution.
 */
export interface Citation {
  /** Source identifier */
  source: string;

  /** Document/article title */
  title: string;

  /** Content snippet for preview */
  content_snippet: string;

  /** Optional URL to source */
  url?: string;
}

// =============================================================================
// Grading Types
// =============================================================================

/**
 * Binary grading result from graders.
 *
 * @example
 * ```typescript
 * const result: GradeResult = {
 *   binary_score: 'yes',
 *   confidence: 0.9
 * };
 * ```
 */
export interface GradeResult {
  /** Binary score: 'yes' for positive, 'no' for negative */
  binary_score: 'yes' | 'no';

  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
}

/**
 * Extended grading result with explanation.
 */
export interface GradeResultWithExplanation extends GradeResult {
  /** Explanation of the grading decision */
  explanation: string;
}

// =============================================================================
// Graph State
// =============================================================================

/**
 * Web search flag type.
 */
export type WebSearchFlag = 'Yes' | 'No';

/**
 * State object for the Adaptive RAG state graph.
 * Tracks all data through the execution pipeline.
 *
 * @example
 * ```typescript
 * const state: GraphState = {
 *   question: 'What are Buffett\'s investment principles?',
 *   messages: [],
 *   documents: [],
 *   web_search: 'No',
 *   generation: '',
 *   citations: [],
 *   loop_step: 0,
 *   max_retries: 3,
 *   route_decision: {
 *     datasource: 'vectorstore',
 *     confidence: 0.9,
 *     reasoning: 'Investment knowledge query'
 *   }
 * };
 * ```
 */
export interface GraphState {
  // Input
  /** User's question */
  question: string;

  /** Conversation history */
  messages: Message[];

  // Retrieval results
  /** Retrieved documents */
  documents: Document[];

  /** Whether web search is needed */
  web_search: WebSearchFlag;

  // Generation results
  /** AI-generated response */
  generation: string;

  /** Source citations */
  citations: Citation[];

  // Control state
  /** Current retry iteration */
  loop_step: number;

  /** Maximum retry attempts (default: 3) */
  max_retries: number;

  /** Routing decision */
  route_decision: RouteDecision;
}

// =============================================================================
// Message Transformer Types
// =============================================================================

/**
 * Configuration for the Message Transformer.
 *
 * @example
 * ```typescript
 * const config: MessageTransformerConfig = {
 *   max_messages: 10,
 *   max_tokens: 4000,
 *   max_tokens_per_message: 500,
 *   min_tokens: 500
 * };
 * ```
 */
export interface MessageTransformerConfig {
  /** Maximum number of messages to keep (default: 10) */
  max_messages: number;

  /** Maximum total tokens across all messages (default: 4000) */
  max_tokens: number;

  /** Maximum tokens per individual message (default: 500) */
  max_tokens_per_message: number;

  /** Minimum tokens threshold - below this, no truncation (default: 500) */
  min_tokens: number;
}

/**
 * Result from message transformation.
 *
 * @example
 * ```typescript
 * const result: TransformResult = {
 *   messages: transformedMessages,
 *   messages_removed: 5,
 *   tokens_removed: 1500
 * };
 * ```
 */
export interface TransformResult {
  /** Transformed messages */
  messages: Message[];

  /** Number of messages removed */
  messages_removed: number;

  /** Number of tokens removed */
  tokens_removed: number;
}

// =============================================================================
// Default Configurations
// =============================================================================

/**
 * Default Message Transformer configuration.
 */
export const DEFAULT_MESSAGE_TRANSFORMER_CONFIG: MessageTransformerConfig = {
  max_messages: 10,
  max_tokens: 4000,
  max_tokens_per_message: 500,
  min_tokens: 500,
};

// =============================================================================
// Query Router Types
// =============================================================================

/**
 * Configuration for the Query Router.
 */
export interface QueryRouterConfig {
  /** LLM model to use (default: 'gemini-2.0-flash') */
  llm_model: string;

  /** System prompt for routing */
  system_prompt: string;
}

/**
 * Default Query Router configuration.
 */
export const DEFAULT_QUERY_ROUTER_CONFIG: QueryRouterConfig = {
  llm_model: 'gemini-2.0-flash',
  system_prompt: `You are an expert at routing user questions to the appropriate data source.

Available data sources:
1. vectorstore - Contains investment knowledge, strategies, principles, book notes, and analysis methods
2. structured_data - Contains portfolio positions, transactions, market data, and financial metrics
3. websearch - For current events, real-time information, or topics not covered by other sources

Analyze the user's question and return JSON with:
- datasource: one of 'vectorstore', 'structured_data', 'websearch'
- confidence: 0.0 to 1.0
- reasoning: brief explanation

Examples:
- "我的持仓情况" → structured_data (portfolio query)
- "巴菲特的投资原则" → vectorstore (investment knowledge)
- "今天美股发生了什么" → websearch (current events)`,
};

// =============================================================================
// Document Grader Types
// =============================================================================

/**
 * Configuration for the Document Grader.
 */
export interface DocumentGraderConfig {
  /** LLM model to use */
  llm_model: string;

  /** Relevance threshold (default: 0.5) */
  threshold: number;
}

/**
 * Default Document Grader configuration.
 */
export const DEFAULT_DOCUMENT_GRADER_CONFIG: DocumentGraderConfig = {
  llm_model: 'gemini-2.0-flash',
  threshold: 0.5,
};

// =============================================================================
// Hallucination Grader Types
// =============================================================================

/**
 * Configuration for the Hallucination Grader.
 */
export interface HallucinationGraderConfig {
  /** LLM model to use */
  llm_model: string;
}

/**
 * Default Hallucination Grader configuration.
 */
export const DEFAULT_HALLUCINATION_GRADER_CONFIG: HallucinationGraderConfig = {
  llm_model: 'gemini-2.0-flash',
};

// =============================================================================
// Answer Grader Types
// =============================================================================

/**
 * Configuration for the Answer Grader.
 */
export interface AnswerGraderConfig {
  /** LLM model to use */
  llm_model: string;
}

/**
 * Default Answer Grader configuration.
 */
export const DEFAULT_ANSWER_GRADER_CONFIG: AnswerGraderConfig = {
  llm_model: 'gemini-2.0-flash',
};

// =============================================================================
// Adaptive RAG Service Types
// =============================================================================

/**
 * Complete configuration for the Adaptive RAG Service.
 */
export interface AdaptiveRAGConfig {
  /** Query Router configuration */
  router: QueryRouterConfig;

  /** Document Grader configuration */
  documentGrader: DocumentGraderConfig;

  /** Hallucination Grader configuration */
  hallucinationGrader: HallucinationGraderConfig;

  /** Answer Grader configuration */
  answerGrader: AnswerGraderConfig;

  /** Message Transformer configuration */
  messageTransformer: MessageTransformerConfig;

  /** Maximum retry attempts (default: 3) */
  max_retries: number;
}

/**
 * Default Adaptive RAG Service configuration.
 */
export const DEFAULT_ADAPTIVE_RAG_CONFIG: AdaptiveRAGConfig = {
  router: DEFAULT_QUERY_ROUTER_CONFIG,
  documentGrader: DEFAULT_DOCUMENT_GRADER_CONFIG,
  hallucinationGrader: DEFAULT_HALLUCINATION_GRADER_CONFIG,
  answerGrader: DEFAULT_ANSWER_GRADER_CONFIG,
  messageTransformer: DEFAULT_MESSAGE_TRANSFORMER_CONFIG,
  max_retries: 3,
};
