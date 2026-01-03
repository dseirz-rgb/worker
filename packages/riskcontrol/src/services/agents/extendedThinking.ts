/**
 * Extended Thinking Mode
 *
 * Implements deep reasoning capabilities for complex analysis scenarios.
 * Inspired by Agno's extended thinking feature and Claude's thinking mode.
 *
 * Extended thinking is triggered for:
 * - CRITICAL risk scenarios requiring careful analysis
 * - Complex multi-factor decisions
 * - User-requested deep analysis
 *
 * @module agents/extendedThinking
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for detailed design
 * @see {@link .kiro/specs/multi-agent-analysis/requirements.md} - Requirements 1.4.1-1.4.5
 */

import type {
  ExtendedThinkingConfig,
  ExtendedThinkingTriggers,
  AgentResult,
  RiskLevel,
} from './types';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Result of extended thinking analysis.
 * Contains both the thinking process and the final conclusion.
 */
export interface ExtendedThinkingResult {
  /** Whether extended thinking was activated */
  activated: boolean;

  /** The thinking process (step-by-step reasoning) */
  thinkingProcess: string[];

  /** Final conclusion after deep reasoning */
  conclusion: string;

  /** Token count used for thinking */
  tokensUsed: number;

  /** Trigger reason that activated extended thinking */
  triggerReason?: string;
}

/**
 * Context for determining if extended thinking should be used.
 */
export interface ThinkingContext {
  /** Current risk level from analysis */
  riskLevel?: RiskLevel;

  /** User's original query */
  query: string;

  /** Previous agent results for context */
  previousResults?: Map<string, AgentResult>;

  /** Whether user explicitly requested deep analysis */
  userRequestedDeepAnalysis?: boolean;
}

/**
 * Options for LLM call with extended thinking.
 */
export interface ExtendedThinkingLLMOptions {
  /** The prompt to send to the LLM */
  prompt: string;

  /** System prompt for the LLM */
  systemPrompt?: string;

  /** Maximum tokens for the response */
  maxTokens?: number;

  /** Temperature for response generation */
  temperature?: number;
}

/**
 * LLM response structure.
 */
export interface LLMResponse {
  /** The generated text content */
  content: string;

  /** Token usage information */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * LLM client interface for dependency injection.
 */
export interface LLMClient {
  /**
   * Call the LLM with the given options.
   *
   * @param options - LLM call options
   * @returns LLM response
   */
  call(options: ExtendedThinkingLLMOptions): Promise<LLMResponse>;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Keywords that indicate user wants deep analysis.
 */
const DEEP_ANALYSIS_KEYWORDS = [
  'deep analysis',
  'detailed analysis',
  'thorough analysis',
  'comprehensive analysis',
  'in-depth',
  'think carefully',
  'think through',
  'step by step',
  'explain your reasoning',
  'walk me through',
  'analyze thoroughly',
  '深度分析',
  '详细分析',
  '仔细分析',
];

/**
 * Keywords that indicate complex decision scenarios.
 */
const COMPLEX_DECISION_KEYWORDS = [
  'should i',
  'what should',
  'recommend',
  'advice',
  'strategy',
  'scenario',
  'stress test',
  'what if',
  'compare',
  'trade-off',
  'tradeoff',
  'pros and cons',
  'risk vs reward',
  'rebalance',
  '应该',
  '建议',
  '策略',
];

// =============================================================================
// Trigger Detection Functions
// =============================================================================

/**
 * Check if extended thinking should be used based on context and configuration.
 *
 * @param context - The thinking context with risk level, query, etc.
 * @param config - Extended thinking configuration
 * @returns Object with shouldUse flag and trigger reason
 *
 * @example
 * ```typescript
 * const result = shouldUseExtendedThinking(
 *   { riskLevel: 'CRITICAL', query: 'Analyze my portfolio' },
 *   DEFAULT_EXTENDED_THINKING_CONFIG
 * );
 * // result: { shouldUse: true, reason: 'CRITICAL risk level detected' }
 * ```
 *
 * @see Requirements 1.4.1, 1.4.2
 */
export function shouldUseExtendedThinking(
  context: ThinkingContext,
  config: ExtendedThinkingConfig
): { shouldUse: boolean; reason?: string } {
  // If extended thinking is disabled, return false
  if (!config.enabled) {
    return { shouldUse: false };
  }

  const { triggers } = config;

  // Check for CRITICAL risk scenario
  if (triggers.criticalRisk && context.riskLevel === 'CRITICAL') {
    return {
      shouldUse: true,
      reason: 'CRITICAL risk level detected',
    };
  }

  // Check for user-requested deep analysis
  if (triggers.userRequested && context.userRequestedDeepAnalysis) {
    return {
      shouldUse: true,
      reason: 'User explicitly requested deep analysis',
    };
  }

  // Check for user-requested deep analysis via keywords
  if (triggers.userRequested && containsDeepAnalysisKeywords(context.query)) {
    return {
      shouldUse: true,
      reason: 'Query contains deep analysis keywords',
    };
  }

  // Check for complex decision scenario
  if (triggers.complexDecision && isComplexDecision(context)) {
    return {
      shouldUse: true,
      reason: 'Complex multi-factor decision detected',
    };
  }

  return { shouldUse: false };
}

/**
 * Check if the query contains keywords indicating deep analysis request.
 *
 * @param query - The user's query string
 * @returns True if deep analysis keywords are found
 */
export function containsDeepAnalysisKeywords(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return DEEP_ANALYSIS_KEYWORDS.some((keyword) =>
    lowerQuery.includes(keyword.toLowerCase())
  );
}

/**
 * Check if the context indicates a complex decision scenario.
 *
 * @param context - The thinking context
 * @returns True if complex decision indicators are present
 */
export function isComplexDecision(context: ThinkingContext): boolean {
  const lowerQuery = context.query.toLowerCase();

  // Check for complex decision keywords
  const hasComplexKeywords = COMPLEX_DECISION_KEYWORDS.some((keyword) =>
    lowerQuery.includes(keyword.toLowerCase())
  );

  if (hasComplexKeywords) {
    return true;
  }

  // Check for multiple risk factors from previous results
  if (context.previousResults && context.previousResults.size >= 2) {
    const riskAnalystResult = context.previousResults.get('risk_analyst');
    const positionAnalystResult = context.previousResults.get('position_analyst');

    // Complex if both risk and position analysis show concerns
    if (riskAnalystResult && positionAnalystResult) {
      const riskData = riskAnalystResult.data as Record<string, unknown>;
      const positionData = positionAnalystResult.data as Record<string, unknown>;

      const hasRiskConcerns =
        riskData.risk_level === 'HIGH' || riskData.risk_level === 'CRITICAL';
      
      const concentrationAnalysis = positionData.concentration_analysis as {
        high_concentration_flags?: string[];
      } | undefined;
      
      const hasConcentrationConcerns =
        concentrationAnalysis &&
        concentrationAnalysis.high_concentration_flags &&
        concentrationAnalysis.high_concentration_flags.length > 0;

      if (hasRiskConcerns && hasConcentrationConcerns) {
        return true;
      }
    }
  }

  return false;
}

// =============================================================================
// Extended Thinking Executor
// =============================================================================

/**
 * Executor for extended thinking mode.
 * Provides structured prompting for deep reasoning and tracks thinking process.
 *
 * @example
 * ```typescript
 * const executor = new ExtendedThinkingExecutor(llmClient, config);
 * const result = await executor.execute(context, basePrompt);
 * console.log(result.thinkingProcess); // Step-by-step reasoning
 * console.log(result.conclusion); // Final conclusion
 * ```
 *
 * @see Requirements 1.4.2, 1.4.3, 1.4.4, 1.4.5
 */
export class ExtendedThinkingExecutor {
  private llmClient: LLMClient;
  private config: ExtendedThinkingConfig;

  /**
   * Create a new ExtendedThinkingExecutor.
   *
   * @param llmClient - LLM client for making API calls
   * @param config - Extended thinking configuration
   */
  constructor(llmClient: LLMClient, config: ExtendedThinkingConfig) {
    this.llmClient = llmClient;
    this.config = config;
  }

  /**
   * Execute extended thinking analysis.
   *
   * @param context - The thinking context
   * @param basePrompt - The base prompt for analysis
   * @returns Extended thinking result with process and conclusion
   */
  async execute(
    context: ThinkingContext,
    basePrompt: string
  ): Promise<ExtendedThinkingResult> {
    // Check if extended thinking should be activated
    const { shouldUse, reason } = shouldUseExtendedThinking(context, this.config);

    if (!shouldUse) {
      return {
        activated: false,
        thinkingProcess: [],
        conclusion: '',
        tokensUsed: 0,
      };
    }

    // Log activation
    console.log(`[ExtendedThinking] Activated: ${reason}`);

    // Build structured thinking prompt
    const thinkingPrompt = this.buildThinkingPrompt(context, basePrompt);

    // Call LLM with extended thinking prompt
    const response = await this.callLLMWithExtendedThinking(thinkingPrompt);

    // Parse the response to extract thinking process and conclusion
    const parsed = this.parseThinkingResponse(response.content);

    return {
      activated: true,
      thinkingProcess: parsed.steps,
      conclusion: parsed.conclusion,
      tokensUsed: response.usage?.totalTokens ?? 0,
      triggerReason: reason,
    };
  }

  /**
   * Call LLM with extended thinking structured prompting.
   *
   * @param prompt - The thinking prompt
   * @returns LLM response
   *
   * @see Requirements 1.4.3, 1.4.4
   */
  async callLLMWithExtendedThinking(prompt: string): Promise<LLMResponse> {
    const systemPrompt = this.buildExtendedThinkingSystemPrompt();

    const response = await this.llmClient.call({
      prompt,
      systemPrompt,
      maxTokens: this.config.budgetTokens,
      temperature: 0.7, // Slightly higher for more thorough exploration
    });

    return response;
  }

  /**
   * Build the system prompt for extended thinking mode.
   *
   * @returns System prompt string
   */
  private buildExtendedThinkingSystemPrompt(): string {
    return `You are an expert investment analyst performing deep analysis.

## Extended Thinking Mode

You are in extended thinking mode. This means you should:

1. **Think Step by Step**: Break down the problem into logical steps
2. **Consider Multiple Perspectives**: Examine the situation from different angles
3. **Identify Key Factors**: List the most important factors affecting the decision
4. **Evaluate Trade-offs**: Weigh pros and cons of different options
5. **Challenge Assumptions**: Question initial assumptions and biases
6. **Synthesize Insights**: Combine findings into a coherent conclusion

## Response Format

Structure your response as follows:

<thinking>
Step 1: [First step of analysis]
Step 2: [Second step of analysis]
...
Step N: [Final step before conclusion]
</thinking>

<conclusion>
[Your final conclusion and recommendation based on the thinking process]
</conclusion>

Be thorough but concise. Focus on the most important factors.`;
  }

  /**
   * Build the thinking prompt with context and base prompt.
   *
   * @param context - The thinking context
   * @param basePrompt - The base analysis prompt
   * @returns Complete thinking prompt
   */
  private buildThinkingPrompt(
    context: ThinkingContext,
    basePrompt: string
  ): string {
    let prompt = `## Analysis Request\n\n${basePrompt}\n\n`;

    // Add context about why extended thinking was triggered
    if (context.riskLevel === 'CRITICAL') {
      prompt += `## Critical Risk Alert\n\nThis analysis involves CRITICAL risk level. Please be especially thorough in evaluating:\n- Potential downside scenarios\n- Risk mitigation strategies\n- Urgency of recommended actions\n\n`;
    }

    // Add previous results context if available
    if (context.previousResults && context.previousResults.size > 0) {
      prompt += `## Previous Analysis Results\n\n`;

      for (const [agentId, result] of context.previousResults) {
        prompt += `### ${agentId}\n${result.summary}\n\n`;
      }
    }

    prompt += `## Instructions\n\nPlease perform a deep analysis using the extended thinking format. Consider all relevant factors and provide a well-reasoned conclusion.`;

    return prompt;
  }

  /**
   * Parse the LLM response to extract thinking steps and conclusion.
   *
   * @param response - The raw LLM response
   * @returns Parsed thinking steps and conclusion
   */
  private parseThinkingResponse(response: string): {
    steps: string[];
    conclusion: string;
  } {
    const steps: string[] = [];
    let conclusion = '';

    // Extract thinking section
    const thinkingMatch = response.match(/<thinking>([\s\S]*?)<\/thinking>/i);
    if (thinkingMatch) {
      const thinkingContent = thinkingMatch[1].trim();

      // Parse individual steps
      const stepMatches = thinkingContent.match(/Step \d+:[\s\S]*?(?=Step \d+:|$)/gi);
      if (stepMatches) {
        for (const step of stepMatches) {
          steps.push(step.trim());
        }
      } else {
        // If no numbered steps, split by newlines
        const lines = thinkingContent.split('\n').filter((line) => line.trim());
        steps.push(...lines);
      }
    }

    // Extract conclusion section
    const conclusionMatch = response.match(/<conclusion>([\s\S]*?)<\/conclusion>/i);
    if (conclusionMatch) {
      conclusion = conclusionMatch[1].trim();
    } else {
      // If no conclusion tags, use the last paragraph
      const paragraphs = response.split('\n\n').filter((p) => p.trim());
      if (paragraphs.length > 0) {
        conclusion = paragraphs[paragraphs.length - 1].trim();
      }
    }

    return { steps, conclusion };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an ExtendedThinkingExecutor with default configuration.
 *
 * @param llmClient - LLM client for making API calls
 * @param config - Optional configuration override
 * @returns ExtendedThinkingExecutor instance
 */
export function createExtendedThinkingExecutor(
  llmClient: LLMClient,
  config?: Partial<ExtendedThinkingConfig>
): ExtendedThinkingExecutor {
  const fullConfig: ExtendedThinkingConfig = {
    enabled: config?.enabled ?? true,
    budgetTokens: config?.budgetTokens ?? 1024,
    triggers: {
      criticalRisk: config?.triggers?.criticalRisk ?? true,
      complexDecision: config?.triggers?.complexDecision ?? true,
      userRequested: config?.triggers?.userRequested ?? true,
    },
  };

  return new ExtendedThinkingExecutor(llmClient, fullConfig);
}

/**
 * Create default extended thinking triggers configuration.
 *
 * @returns Default triggers configuration
 */
export function createDefaultTriggers(): ExtendedThinkingTriggers {
  return {
    criticalRisk: true,
    complexDecision: true,
    userRequested: true,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Estimate token count for a string (rough approximation).
 * Uses ~4 characters per token as a rough estimate.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateThinkingTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  // Adjust for Chinese/Japanese which use ~1.5 characters per token
  const hasAsianChars = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text);
  const charsPerToken = hasAsianChars ? 1.5 : 4;

  return Math.ceil(text.length / charsPerToken);
}

/**
 * Check if thinking budget would be exceeded.
 *
 * @param currentTokens - Current token count
 * @param budgetTokens - Maximum allowed tokens
 * @returns True if budget would be exceeded
 */
export function wouldExceedBudget(
  currentTokens: number,
  budgetTokens: number
): boolean {
  return currentTokens >= budgetTokens;
}

/**
 * Format thinking process for display.
 *
 * @param steps - Array of thinking steps
 * @returns Formatted string for display
 */
export function formatThinkingProcess(steps: string[]): string {
  if (steps.length === 0) {
    return '';
  }

  return steps
    .map((step, index) => {
      // If step already has a number, use it as-is
      if (/^Step \d+:/i.test(step)) {
        return step;
      }
      return `Step ${index + 1}: ${step}`;
    })
    .join('\n\n');
}

// =============================================================================
// Default Export
// =============================================================================

export default ExtendedThinkingExecutor;
