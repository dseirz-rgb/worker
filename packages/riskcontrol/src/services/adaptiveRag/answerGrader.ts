/**
 * Answer Grader - Evaluates if an answer adequately addresses the user's question
 *
 * Part of the Adaptive RAG system's quality control pipeline.
 * Uses Gemini API to assess whether the generated answer is useful
 * and actually resolves the user's question.
 *
 * @module adaptiveRag/answerGrader
 * @see {@link .kiro/specs/adaptive-rag/design.md} for detailed design
 */

import {
  type AnswerGraderConfig,
  DEFAULT_ANSWER_GRADER_CONFIG,
} from './types';

// Re-export types for convenience
export type { AnswerGraderConfig };

/**
 * Result of answer grading
 */
export interface AnswerGraderResult {
  /** Binary score: 'yes' = useful/resolves question, 'no' = not useful */
  binary_score: 'yes' | 'no';
  /** Explanation of the assessment */
  explanation: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * System prompt for answer quality assessment
 * Based on design.md specification
 */
const ANSWER_GRADER_PROMPT = `You are a grader assessing whether an answer addresses / resolves a question.

Give a binary score:
- 'yes': the answer resolves the question
- 'no': the answer does not resolve the question

Return JSON with:
- binary_score: 'yes' or 'no'
- explanation: brief explanation`;

// API endpoint for Gemini calls
const API_URL = '/api/chat';

// =============================================================================
// Answer Grader Class
// =============================================================================

/**
 * Answer Grader for assessing answer quality and usefulness
 *
 * @example
 * ```typescript
 * const grader = new AnswerGrader();
 * const result = await grader.grade(
 *   "什么是价值投资?",
 *   "价值投资是一种投资策略，通过分析公司的内在价值，寻找被市场低估的股票..."
 * );
 * console.log(result.binary_score); // 'yes' (useful)
 * ```
 */
export class AnswerGrader {
  private config: AnswerGraderConfig;

  constructor(config: Partial<AnswerGraderConfig> = {}) {
    this.config = { ...DEFAULT_ANSWER_GRADER_CONFIG, ...config };
  }

  /**
   * Grade whether an answer adequately addresses the question
   *
   * @param question - The user's original question
   * @param answer - The generated answer to evaluate
   * @returns AnswerGraderResult with binary_score and explanation
   */
  async grade(question: string, answer: string): Promise<AnswerGraderResult> {
    try {
      // Construct the grading prompt
      const userPrompt = `Question:
${question}

Answer:
${answer}

Assess if the answer resolves the question. Return JSON only.`;

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
            parts: [{ text: ANSWER_GRADER_PROMPT }],
          },
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1, // Low temperature for consistent grading
            maxOutputTokens: 200,
          },
        }),
      });

      if (!response.ok) {
        console.error('[AnswerGrader] API error:', response.status);
        return this.getDefaultResult();
      }

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error('[AnswerGrader] Error grading answer:', error);
      return this.getDefaultResult();
    }
  }

  /**
   * Check if answer is useful (convenience method)
   *
   * @param question - The user's question
   * @param answer - The generated answer
   * @returns true if useful, false otherwise
   */
  async isUseful(question: string, answer: string): Promise<boolean> {
    const result = await this.grade(question, answer);
    return result.binary_score === 'yes';
  }

  /**
   * Parse the LLM response into an AnswerGraderResult
   */
  private parseResponse(data: any): AnswerGraderResult {
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
        console.warn('[AnswerGrader] Empty response from LLM');
        return this.getDefaultResult();
      }

      // Clean and parse JSON
      const cleanJson = jsonText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      // Validate and normalize the response
      const binaryScore = this.normalizeBinaryScore(parsed.binary_score);
      const explanation = this.normalizeExplanation(parsed.explanation);

      return {
        binary_score: binaryScore,
        explanation,
      };
    } catch (error) {
      console.error('[AnswerGrader] Error parsing response:', error);
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
    return 'no';
  }

  /**
   * Normalize explanation to a non-empty string
   */
  private normalizeExplanation(explanation: unknown): string {
    if (typeof explanation === 'string' && explanation.trim()) {
      return explanation.trim();
    }
    return 'Unable to determine answer quality.';
  }

  /**
   * Get default result for error cases
   * Returns 'no' (not useful) to be conservative and trigger websearch fallback
   */
  private getDefaultResult(): AnswerGraderResult {
    return {
      binary_score: 'no',
      explanation: 'Grading failed due to an error. Treating as potentially unhelpful.',
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Default Answer Grader instance
 */
export const answerGrader = new AnswerGrader();
