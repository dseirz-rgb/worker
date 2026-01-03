/**
 * Hallucination Grader - Detects if generated content is grounded in source documents
 *
 * Part of the Adaptive RAG system's quality control pipeline.
 * Uses Gemini API to assess whether the LLM's generation is supported
 * by the retrieved documents, detecting potential hallucinations.
 *
 * @module adaptiveRag/hallucinationGrader
 * @see {@link .kiro/specs/adaptive-rag/design.md} for detailed design
 */

import {
  type HallucinationGraderConfig,
  DEFAULT_HALLUCINATION_GRADER_CONFIG,
} from './types';

// Re-export types for convenience
export type { HallucinationGraderConfig };

/**
 * Result of hallucination grading
 * Extends GradeResultWithExplanation but confidence is not used
 */
export interface HallucinationGraderResult {
  /** Binary score: 'yes' = grounded (no hallucination), 'no' = hallucination detected */
  binary_score: 'yes' | 'no';
  /** Explanation of the assessment */
  explanation: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * System prompt for hallucination detection
 * Based on design.md specification
 */
const HALLUCINATION_GRADER_PROMPT = `You are a grader assessing whether an LLM generation is grounded in / supported by a set of retrieved facts.

Give a binary score:
- 'yes': the generation is grounded in the facts
- 'no': the generation contains information not supported by the facts

Return JSON with:
- binary_score: 'yes' or 'no'
- explanation: brief explanation of your assessment`;

// API endpoint for Gemini calls
const API_URL = '/api/chat';

// =============================================================================
// Hallucination Grader Class
// =============================================================================

/**
 * Hallucination Grader for detecting ungrounded content
 *
 * @example
 * ```typescript
 * const grader = new HallucinationGrader();
 * const result = await grader.grade(
 *   "巴菲特在1965年收购了伯克希尔哈撒韦公司...",
 *   ["巴菲特于1965年获得伯克希尔哈撒韦的控制权..."]
 * );
 * console.log(result.binary_score); // 'yes' (grounded)
 * ```
 */
export class HallucinationGrader {
  private config: HallucinationGraderConfig;

  constructor(config: Partial<HallucinationGraderConfig> = {}) {
    this.config = { ...DEFAULT_HALLUCINATION_GRADER_CONFIG, ...config };
  }

  /**
   * Grade whether a generation is grounded in the source documents
   *
   * @param generation - The LLM-generated content to evaluate
   * @param documents - Array of source documents that should support the generation
   * @returns HallucinationGraderResult with binary_score and explanation
   */
  async grade(
    generation: string,
    documents: string[]
  ): Promise<HallucinationGraderResult> {
    try {
      // Combine documents into a single facts section
      const factsSection = documents
        .map((doc, index) => `[Document ${index + 1}]\n${doc}`)
        .join('\n\n');

      // Construct the grading prompt
      const userPrompt = `Retrieved Facts:
${factsSection}

LLM Generation:
${generation}

Assess if the generation is grounded in the retrieved facts. Return JSON only.`;

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
            parts: [{ text: HALLUCINATION_GRADER_PROMPT }],
          },
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1, // Low temperature for consistent grading
            maxOutputTokens: 200,
          },
        }),
      });

      if (!response.ok) {
        console.error('[HallucinationGrader] API error:', response.status);
        return this.getDefaultResult();
      }

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error('[HallucinationGrader] Error grading generation:', error);
      return this.getDefaultResult();
    }
  }

  /**
   * Check if generation is grounded (convenience method)
   *
   * @param generation - The LLM-generated content
   * @param documents - Source documents
   * @returns true if grounded, false if hallucination detected
   */
  async isGrounded(generation: string, documents: string[]): Promise<boolean> {
    const result = await this.grade(generation, documents);
    return result.binary_score === 'yes';
  }

  /**
   * Parse the LLM response into a HallucinationGraderResult
   */
  private parseResponse(data: any): HallucinationGraderResult {
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
        console.warn('[HallucinationGrader] Empty response from LLM');
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
      console.error('[HallucinationGrader] Error parsing response:', error);
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
    return 'Unable to determine grounding status.';
  }

  /**
   * Get default result for error cases
   * Returns 'no' (hallucination detected) to be conservative and trigger regeneration
   */
  private getDefaultResult(): HallucinationGraderResult {
    return {
      binary_score: 'no',
      explanation: 'Grading failed due to an error. Treating as potential hallucination.',
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Default Hallucination Grader instance
 */
export const hallucinationGrader = new HallucinationGrader();
