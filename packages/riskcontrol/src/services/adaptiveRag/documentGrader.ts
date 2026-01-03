/**
 * Document Grader - Evaluates document relevance to user queries
 *
 * Part of the Adaptive RAG system's quality control pipeline.
 * Uses Gemini API to assess whether retrieved documents are relevant
 * to the user's question.
 *
 * @module adaptiveRag/documentGrader
 * @see {@link .kiro/specs/adaptive-rag/design.md} for detailed design
 */

import {
  type DocumentGraderConfig,
  type GradeResult,
  DEFAULT_DOCUMENT_GRADER_CONFIG,
} from './types';

// Re-export types for convenience
export type { DocumentGraderConfig, GradeResult };

// =============================================================================
// Constants
// =============================================================================

/**
 * System prompt for document relevance grading
 * Based on design.md specification
 */
const DOC_GRADER_PROMPT = `You are a grader assessing relevance of a retrieved document to a user question.

If the document contains keyword(s) or semantic meaning related to the question, grade it as relevant.

Return JSON with:
- binary_score: 'yes' or 'no'
- confidence: 0.0 to 1.0`;

// API endpoint for Gemini calls
const API_URL = '/api/chat';

// =============================================================================
// Document Grader Class
// =============================================================================

/**
 * Document Grader for assessing document relevance
 *
 * @example
 * ```typescript
 * const grader = new DocumentGrader();
 * const result = await grader.grade(
 *   "巴菲特认为投资最重要的是安全边际...",
 *   "什么是价值投资的核心原则?"
 * );
 * console.log(result.binary_score); // 'yes'
 * ```
 */
export class DocumentGrader {
  private config: DocumentGraderConfig;

  constructor(config: Partial<DocumentGraderConfig> = {}) {
    this.config = { ...DEFAULT_DOCUMENT_GRADER_CONFIG, ...config };
  }

  /**
   * Grade a document's relevance to a query
   *
   * @param document - The document content to evaluate
   * @param query - The user's query/question
   * @returns GradeResult with binary_score and confidence
   */
  async grade(document: string, query: string): Promise<GradeResult> {
    try {
      // Construct the grading prompt
      const userPrompt = `Document:
${document}

Question:
${query}

Assess if the document is relevant to the question. Return JSON only.`;

      // Call Gemini API
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-model': this.config.llm_model,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          systemInstruction: {
            role: 'system',
            parts: [{ text: DOC_GRADER_PROMPT }],
          },
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1, // Low temperature for consistent grading
            maxOutputTokens: 100,
          },
        }),
      });

      if (!response.ok) {
        console.error('[DocumentGrader] API error:', response.status);
        return this.getDefaultResult();
      }

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error('[DocumentGrader] Error grading document:', error);
      return this.getDefaultResult();
    }
  }

  /**
   * Grade multiple documents in batch
   *
   * @param documents - Array of document contents
   * @param query - The user's query/question
   * @returns Array of GradeResults
   */
  async gradeMany(documents: string[], query: string): Promise<GradeResult[]> {
    // Process documents in parallel for efficiency
    const results = await Promise.all(
      documents.map((doc) => this.grade(doc, query))
    );
    return results;
  }

  /**
   * Filter documents by relevance
   *
   * @param documents - Array of document contents
   * @param query - The user's query/question
   * @returns Array of relevant documents
   */
  async filterRelevant(documents: string[], query: string): Promise<string[]> {
    const results = await this.gradeMany(documents, query);
    return documents.filter((_, index) => results[index].binary_score === 'yes');
  }

  /**
   * Parse the LLM response into a GradeResult
   */
  private parseResponse(data: any): GradeResult {
    try {
      // Handle different response structures
      let jsonText = '';

      if (Array.isArray(data)) {
        // Streamed array response
        jsonText = data
          .map((item) => item.candidates?.[0]?.content?.parts?.[0]?.text || '')
          .join('');
      } else {
        // Single object response
        jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      if (!jsonText) {
        console.warn('[DocumentGrader] Empty response from LLM');
        return this.getDefaultResult();
      }

      // Clean and parse JSON
      const cleanJson = jsonText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      // Validate and normalize the response
      const binaryScore = this.normalizeBinaryScore(parsed.binary_score);
      const confidence = this.normalizeConfidence(parsed.confidence);

      return {
        binary_score: binaryScore,
        confidence,
      };
    } catch (error) {
      console.error('[DocumentGrader] Error parsing response:', error);
      return this.getDefaultResult();
    }
  }

  /**
   * Normalize binary score to 'yes' or 'no'
   */
  private normalizeBinaryScore(score: unknown): 'yes' | 'no' {
    if (typeof score === 'string') {
      const normalized = score.toLowerCase().trim();
      if (normalized === 'yes' || normalized === 'true' || normalized === '1') {
        return 'yes';
      }
    }
    if (typeof score === 'boolean') {
      return score ? 'yes' : 'no';
    }
    if (typeof score === 'number') {
      return score >= this.config.threshold ? 'yes' : 'no';
    }
    return 'no';
  }

  /**
   * Normalize confidence to 0.0-1.0 range
   */
  private normalizeConfidence(confidence: unknown): number {
    if (typeof confidence === 'number') {
      return Math.max(0, Math.min(1, confidence));
    }
    if (typeof confidence === 'string') {
      const parsed = parseFloat(confidence);
      if (!isNaN(parsed)) {
        return Math.max(0, Math.min(1, parsed));
      }
    }
    return 0.5; // Default confidence
  }

  /**
   * Get default result for error cases
   * Returns 'no' to be conservative and trigger fallback behavior
   */
  private getDefaultResult(): GradeResult {
    return {
      binary_score: 'no',
      confidence: 0,
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Default Document Grader instance
 */
export const documentGrader = new DocumentGrader();
