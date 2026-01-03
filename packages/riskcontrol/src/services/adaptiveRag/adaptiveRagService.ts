/**
 * Adaptive RAG Service - Main orchestration service
 *
 * Implements the state graph flow for adaptive retrieval-augmented generation:
 * 1. Query routing (LLM-based intelligent routing)
 * 2. Document retrieval (LightRAG + Supabase)
 * 3. Document grading (relevance filtering)
 * 4. Response generation
 * 5. Hallucination detection
 * 6. Answer quality evaluation
 * 7. Adaptive retry mechanism
 *
 * @module adaptiveRag/adaptiveRagService
 * @see {@link .kiro/specs/adaptive-rag/design.md} for detailed design
 */

import type {
  GraphState,
  Document,
  Citation,
  RouteDecision,
  AdaptiveRAGConfig,
  Message,
} from './types';
import { DEFAULT_ADAPTIVE_RAG_CONFIG } from './types';
import { QueryRouter } from './queryRouter';
import { DocumentGrader } from './documentGrader';
import { HallucinationGrader } from './hallucinationGrader';
import { AnswerGrader } from './answerGrader';
import { MessageTransformer } from './messageTransformer';
import { queryKnowledge, isLightRAGAvailable } from '../lightragClient';
import { getClient } from '../supabaseData';
import { API_ENDPOINTS } from '../apiConfig';

// =============================================================================
// Constants
// =============================================================================

const API_URL = API_ENDPOINTS.CHAT;

/**
 * Generation system prompt for RAG responses
 */
const GENERATION_SYSTEM_PROMPT = `You are a helpful investment assistant. Answer the user's question based on the provided context.

Rules:
1. Only use information from the provided context
2. If the context doesn't contain relevant information, say so
3. Be concise and accurate
4. Cite sources when possible
5. Use Chinese for responses unless the user asks in English`;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create initial graph state
 */
function createInitialState(
  question: string,
  messages: Message[] = [],
  maxRetries: number = 3
): GraphState {
  return {
    question,
    messages,
    documents: [],
    web_search: 'No',
    generation: '',
    citations: [],
    loop_step: 0,
    max_retries: maxRetries,
    route_decision: {
      datasource: 'vectorstore',
      confidence: 0,
      reasoning: 'Initial state',
    },
  };
}

/**
 * Convert LightRAG result to Document format
 */
function lightragResultToDocuments(result: string): Document[] {
  if (!result || result.trim().length === 0) {
    return [];
  }

  // LightRAG returns a single text result, wrap it as a document
  return [
    {
      id: 'lightrag-result',
      content: result,
      metadata: { source: 'LightRAG', type: 'knowledge_graph' },
      relevance_score: 1.0,
    },
  ];
}

/**
 * Convert Supabase search results to Document format
 */
function supabaseResultsToDocuments(results: any[]): Document[] {
  return results.map((doc, index) => ({
    id: doc.id || `supabase-${index}`,
    content: doc.content || '',
    metadata: {
      source: 'Supabase',
      title: doc.metadata?.title || doc.title || 'Unknown',
      ...doc.metadata,
    },
    relevance_score: doc.similarity || 0.5,
  }));
}

// =============================================================================
// AdaptiveRAGService Class
// =============================================================================

/**
 * Adaptive RAG Service - Main orchestration class
 *
 * @example
 * ```typescript
 * const service = new AdaptiveRAGService();
 * const result = await service.getInvestmentContext('巴菲特的投资原则是什么?');
 * console.log(result.text);
 * console.log(result.citations);
 * ```
 */
export class AdaptiveRAGService {
  private config: AdaptiveRAGConfig;
  private queryRouter: QueryRouter;
  private documentGrader: DocumentGrader;
  private hallucinationGrader: HallucinationGrader;
  private answerGrader: AnswerGrader;
  private messageTransformer: MessageTransformer;

  constructor(config: Partial<AdaptiveRAGConfig> = {}) {
    this.config = { ...DEFAULT_ADAPTIVE_RAG_CONFIG, ...config };

    // Initialize components
    this.queryRouter = new QueryRouter(this.config.router);
    this.documentGrader = new DocumentGrader(this.config.documentGrader);
    this.hallucinationGrader = new HallucinationGrader(this.config.hallucinationGrader);
    this.answerGrader = new AnswerGrader(this.config.answerGrader);
    this.messageTransformer = new MessageTransformer(this.config.messageTransformer);
  }

  // ===========================================================================
  // Public API - Compatible with existing ragService
  // ===========================================================================

  /**
   * Get investment context for a query
   * API compatible with existing ragService.getInvestmentContext
   *
   * @param query - User's question
   * @param messages - Optional conversation history
   * @returns Object with text response and citations
   */
  async getInvestmentContext(
    query: string,
    messages: Message[] = []
  ): Promise<{ text: string; citations: Citation[] }> {
    try {
      // Transform messages to manage context length
      const { messages: transformedMessages } = this.messageTransformer.transform(messages);

      // Initialize state
      let state = createInitialState(query, transformedMessages, this.config.max_retries);

      // Execute the state graph
      state = await this.executeGraph(state);

      return {
        text: state.generation || '无法生成回答。',
        citations: state.citations,
      };
    } catch (error) {
      console.error('[AdaptiveRAG] Error:', error);
      return {
        text: '处理请求时发生错误，请稍后重试。',
        citations: [],
      };
    }
  }

  // ===========================================================================
  // State Graph Execution
  // ===========================================================================

  /**
   * Execute the full state graph
   */
  private async executeGraph(state: GraphState): Promise<GraphState> {
    console.log('[AdaptiveRAG] Starting graph execution for:', state.question);

    // Step 1: Route the question
    state = await this.routeQuestion(state);
    console.log('[AdaptiveRAG] Route decision:', state.route_decision.datasource);

    // Step 2: Retrieve documents based on route
    state = await this.retrieve(state);
    console.log('[AdaptiveRAG] Retrieved documents:', state.documents.length);

    // Step 3: Grade documents (skip for structured_data)
    if (state.route_decision.datasource !== 'structured_data') {
      state = await this.gradeDocuments(state);
      console.log('[AdaptiveRAG] After grading, relevant docs:', state.documents.length);
    }

    // Step 4: Check if web search is needed
    if (state.web_search === 'Yes' && state.documents.length === 0) {
      state = await this.webSearch(state);
      console.log('[AdaptiveRAG] Web search completed');
    }

    // Step 5: Generate response with retry loop
    state = await this.generateWithRetry(state);

    return state;
  }

  // ===========================================================================
  // Graph Nodes
  // ===========================================================================

  /**
   * Route the question to appropriate data source
   */
  private async routeQuestion(state: GraphState): Promise<GraphState> {
    try {
      const decision = await this.queryRouter.route(state.question);
      return {
        ...state,
        route_decision: decision,
      };
    } catch (error) {
      console.error('[AdaptiveRAG] Route error:', error);
      // Default to vectorstore on error
      return {
        ...state,
        route_decision: {
          datasource: 'vectorstore',
          confidence: 0.3,
          reasoning: 'Routing failed, defaulting to vectorstore',
        },
      };
    }
  }

  /**
   * Retrieve documents based on route decision
   */
  private async retrieve(state: GraphState): Promise<GraphState> {
    const { datasource } = state.route_decision;
    const citations: Citation[] = [];
    let documents: Document[] = [];

    try {
      switch (datasource) {
        case 'vectorstore':
          documents = await this.retrieveFromVectorstore(state.question, citations);
          break;

        case 'structured_data':
          documents = await this.retrieveStructuredData(state.question, citations);
          break;

        case 'websearch':
          // Web search will be handled in the webSearch node
          state = { ...state, web_search: 'Yes' };
          break;
      }
    } catch (error) {
      console.error('[AdaptiveRAG] Retrieve error:', error);
      // Try fallback
      documents = await this.retrieveFallback(state.question, citations);
    }

    return {
      ...state,
      documents,
      citations: [...state.citations, ...citations],
    };
  }

  /**
   * Retrieve from vectorstore (LightRAG + Supabase vector search)
   */
  private async retrieveFromVectorstore(
    query: string,
    citations: Citation[]
  ): Promise<Document[]> {
    let documents: Document[] = [];

    // Try LightRAG first
    try {
      if (await isLightRAGAvailable()) {
        console.log('[AdaptiveRAG] Querying LightRAG...');
        const result = await queryKnowledge(query, 'hybrid');

        if (result.success && result.result) {
          documents = lightragResultToDocuments(result.result);
          citations.push({
            source: '🧠 知识图谱 (LightRAG)',
            title: 'GraphRAG 检索结果',
            content_snippet: result.result.slice(0, 100) + '...',
          });
        }
      }
    } catch (error) {
      console.warn('[AdaptiveRAG] LightRAG query failed:', error);
    }

    // Fallback to Supabase vector search if LightRAG failed
    if (documents.length === 0) {
      documents = await this.retrieveFallback(query, citations);
    }

    return documents;
  }

  /**
   * Retrieve structured data from Supabase
   */
  private async retrieveStructuredData(
    query: string,
    citations: Citation[]
  ): Promise<Document[]> {
    const supabase = getClient();
    if (!supabase) {
      return [];
    }

    const documents: Document[] = [];

    try {
      // Get latest positions
      const { data: positions } = await supabase
        .from('stock_positions')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(20);

      if (positions && positions.length > 0) {
        const latestDate = positions[0].snapshot_date;
        const latestPositions = positions.filter((p: any) => p.snapshot_date === latestDate);

        const positionContent = latestPositions
          .map((p: any) => `${p.ticker} ${p.name || ''}: ${p.quantity}股, 市值¥${p.market_value_cny?.toFixed(0) || 0}, 占比${p.weight_percent?.toFixed(1) || 0}%`)
          .join('\n');

        documents.push({
          id: 'positions',
          content: `## 当前持仓 (${latestDate})\n${positionContent}`,
          metadata: { source: 'Supabase', type: 'positions', date: latestDate },
        });

        citations.push({
          source: '📊 结构化数据 (Supabase)',
          title: `持仓数据 (${latestDate})`,
          content_snippet: `${latestPositions.length}只股票`,
        });
      }

      // Get recent transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(10);

      if (transactions && transactions.length > 0) {
        const txContent = transactions
          .map((t: any) => `${t.date} ${t.action} ${t.ticker}: ${t.quantity}股 @ $${t.price}`)
          .join('\n');

        documents.push({
          id: 'transactions',
          content: `## 最近交易\n${txContent}`,
          metadata: { source: 'Supabase', type: 'transactions' },
        });

        citations.push({
          source: '📊 结构化数据 (Supabase)',
          title: '最近交易记录',
          content_snippet: `${transactions.length}笔交易`,
        });
      }

      // Get dashboard snapshot
      const { data: dashboard } = await supabase
        .from('dashboard_snapshots')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (dashboard) {
        documents.push({
          id: 'dashboard',
          content: `## 账户概览 (${dashboard.date})\n净值: ¥${dashboard.net_worth_cny?.toFixed(0) || 0}`,
          metadata: { source: 'Supabase', type: 'dashboard', date: dashboard.date },
        });
      }
    } catch (error) {
      console.error('[AdaptiveRAG] Structured data retrieval error:', error);
    }

    return documents;
  }

  /**
   * Fallback retrieval using Supabase vector search
   */
  private async retrieveFallback(
    query: string,
    citations: Citation[]
  ): Promise<Document[]> {
    const supabase = getClient();
    if (!supabase) {
      return [];
    }

    try {
      // Get embedding for query
      const embeddingResponse = await fetch(API_ENDPOINTS.EMBEDDING, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ content: query, task_type: 'RETRIEVAL_QUERY' }],
        }),
      });

      if (!embeddingResponse.ok) {
        throw new Error('Embedding API failed');
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.predictions?.[0]?.embeddings?.values;

      if (!embedding) {
        throw new Error('No embedding returned');
      }

      // Vector search
      const { data: searchResults, error } = await supabase.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 5,
      });

      if (error) {
        throw error;
      }

      if (searchResults && searchResults.length > 0) {
        const documents = supabaseResultsToDocuments(searchResults);

        searchResults.forEach((doc: any) => {
          citations.push({
            source: '🔍 向量搜索 (Supabase)',
            title: doc.metadata?.title || '文档',
            content_snippet: doc.content?.slice(0, 50) + '...',
          });
        });

        return documents;
      }
    } catch (error) {
      console.warn('[AdaptiveRAG] Vector search fallback failed:', error);
    }

    return [];
  }

  /**
   * Grade documents for relevance
   */
  private async gradeDocuments(state: GraphState): Promise<GraphState> {
    if (state.documents.length === 0) {
      return { ...state, web_search: 'Yes' };
    }

    const relevantDocs: Document[] = [];

    // Grade each document
    for (const doc of state.documents) {
      try {
        const result = await this.documentGrader.grade(doc.content, state.question);
        if (result.binary_score === 'yes') {
          relevantDocs.push({
            ...doc,
            relevance_score: result.confidence,
          });
        }
      } catch (error) {
        console.warn('[AdaptiveRAG] Document grading error:', error);
        // Keep document on error (conservative approach)
        relevantDocs.push(doc);
      }
    }

    // If no relevant documents, trigger web search
    const needsWebSearch = relevantDocs.length === 0;

    return {
      ...state,
      documents: relevantDocs,
      web_search: needsWebSearch ? 'Yes' : 'No',
    };
  }

  /**
   * Web search fallback
   */
  private async webSearch(state: GraphState): Promise<GraphState> {
    // For now, add a note that web search would be performed
    // In production, integrate with a web search API
    console.log('[AdaptiveRAG] Web search triggered for:', state.question);

    const webDoc: Document = {
      id: 'web-search-note',
      content: `[Web Search] 未找到本地相关文档，建议搜索最新信息。查询: "${state.question}"`,
      metadata: { source: 'WebSearch', type: 'fallback' },
    };

    return {
      ...state,
      documents: [...state.documents, webDoc],
      citations: [
        ...state.citations,
        {
          source: '🌐 Web 搜索',
          title: '搜索建议',
          content_snippet: '建议查询最新网络信息',
        },
      ],
    };
  }

  /**
   * Generate response with retry mechanism
   */
  private async generateWithRetry(state: GraphState): Promise<GraphState> {
    while (state.loop_step <= state.max_retries) {
      // Generate response
      state = await this.generate(state);

      // If no documents, skip grading
      if (state.documents.length === 0) {
        break;
      }

      // Grade the generation
      const gradeResult = await this.gradeGeneration(state);

      if (gradeResult === 'useful') {
        // Success - return the response
        console.log('[AdaptiveRAG] Generation accepted');
        break;
      } else if (gradeResult === 'not_supported') {
        // Hallucination detected - retry
        console.log('[AdaptiveRAG] Hallucination detected, retrying...');
        state = {
          ...state,
          loop_step: state.loop_step + 1,
          generation: '', // Clear for regeneration
        };
      } else if (gradeResult === 'not_useful') {
        // Answer not useful - try web search
        console.log('[AdaptiveRAG] Answer not useful, trying web search...');
        state = await this.webSearch(state);
        state = {
          ...state,
          loop_step: state.loop_step + 1,
        };
      } else {
        // max_retries reached
        console.log('[AdaptiveRAG] Max retries reached');
        break;
      }
    }

    // Add disclaimer if max retries reached
    if (state.loop_step > state.max_retries && state.generation) {
      state = {
        ...state,
        generation: state.generation + '\n\n⚠️ 注意：此回答可能不够完整，建议进一步验证。',
      };
    }

    return state;
  }

  /**
   * Generate response using LLM
   */
  private async generate(state: GraphState): Promise<GraphState> {
    try {
      // Build context from documents
      const context = state.documents
        .map((doc) => doc.content)
        .join('\n\n---\n\n');

      // Build prompt
      const userPrompt = `Context:
${context || '无相关上下文'}

Question: ${state.question}

请基于上下文回答问题。如果上下文不包含相关信息，请说明。`;

      // Call Gemini API
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-model': 'gemini-2.0-flash',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          systemInstruction: {
            role: 'system',
            parts: [{ text: GENERATION_SYSTEM_PROMPT }],
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Generation API error: ${response.status}`);
      }

      const data = await response.json();
      const generation = this.extractGenerationText(data);

      return {
        ...state,
        generation,
      };
    } catch (error) {
      console.error('[AdaptiveRAG] Generation error:', error);
      return {
        ...state,
        generation: '生成回答时发生错误，请稍后重试。',
      };
    }
  }

  /**
   * Extract text from Gemini API response
   */
  private extractGenerationText(data: any): string {
    if (Array.isArray(data)) {
      return data
        .map((item) => item.candidates?.[0]?.content?.parts?.[0]?.text || '')
        .join('');
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Grade the generation for hallucination and usefulness
   * Returns: 'useful' | 'not_useful' | 'not_supported' | 'max_retries'
   */
  private async gradeGeneration(
    state: GraphState
  ): Promise<'useful' | 'not_useful' | 'not_supported' | 'max_retries'> {
    // Check if max retries reached
    if (state.loop_step >= state.max_retries) {
      return 'max_retries';
    }

    try {
      // Step 1: Check for hallucination
      const documentContents = state.documents.map((d) => d.content);
      const hallucinationResult = await this.hallucinationGrader.grade(
        state.generation,
        documentContents
      );

      if (hallucinationResult.binary_score === 'no') {
        // Hallucination detected
        console.log('[AdaptiveRAG] Hallucination:', hallucinationResult.explanation);
        return 'not_supported';
      }

      // Step 2: Check if answer is useful
      const answerResult = await this.answerGrader.grade(
        state.question,
        state.generation
      );

      if (answerResult.binary_score === 'no') {
        console.log('[AdaptiveRAG] Not useful:', answerResult.explanation);
        return 'not_useful';
      }

      return 'useful';
    } catch (error) {
      console.error('[AdaptiveRAG] Grading error:', error);
      // On error, accept the generation (conservative)
      return 'useful';
    }
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<AdaptiveRAGConfig>): void {
    this.config = { ...this.config, ...config };

    // Update component configs
    if (config.router) {
      this.queryRouter.updateConfig(config.router);
    }
    if (config.messageTransformer) {
      this.messageTransformer.updateConfig(config.messageTransformer);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AdaptiveRAGConfig {
    return { ...this.config };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Default AdaptiveRAGService instance
 */
export const adaptiveRagService = new AdaptiveRAGService();

/**
 * Convenience function for getting investment context
 */
export async function getAdaptiveInvestmentContext(
  query: string,
  messages: Message[] = []
): Promise<{ text: string; citations: Citation[] }> {
  return adaptiveRagService.getInvestmentContext(query, messages);
}
