/**
 * Property-Based Tests for Extended Thinking Mode
 *
 * Tests the extended thinking system using fast-check for property-based testing.
 *
 * @module agents/extendedThinking.test
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for design specification
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  shouldUseExtendedThinking,
  containsDeepAnalysisKeywords,
  isComplexDecision,
  ExtendedThinkingExecutor,
  estimateThinkingTokens,
  wouldExceedBudget,
  formatThinkingProcess,
  ThinkingContext,
  LLMClient,
  LLMResponse,
} from './extendedThinking';
import type { ExtendedThinkingConfig, RiskLevel, AgentResult } from './types';

// =============================================================================
// Test Helpers and Generators
// =============================================================================

/**
 * Generate a random RiskLevel
 */
const riskLevelArb = fc.constantFrom('LOW', 'MODERATE', 'HIGH', 'CRITICAL') as fc.Arbitrary<RiskLevel>;

/**
 * Generate a random query string
 */
const queryArb = fc.oneof(
  fc.constant('Analyze my portfolio'),
  fc.constant('What is my risk level?'),
  fc.constant('Should I rebalance?'),
  fc.constant('Give me a deep analysis of my positions'),
  fc.constant('Think carefully about my strategy'),
  fc.string({ minLength: 5, maxLength: 100 }),
);

/**
 * Generate a random ExtendedThinkingConfig
 */
const configArb = fc.record({
  enabled: fc.boolean(),
  budgetTokens: fc.integer({ min: 256, max: 4096 }),
  triggers: fc.record({
    criticalRisk: fc.boolean(),
    complexDecision: fc.boolean(),
    userRequested: fc.boolean(),
  }),
});

/**
 * Generate a random ThinkingContext
 */
const contextArb = fc.record({
  riskLevel: fc.option(riskLevelArb, { nil: undefined }),
  query: queryArb,
  userRequestedDeepAnalysis: fc.option(fc.boolean(), { nil: undefined }),
});

/**
 * Create a mock LLM client for testing
 */
function createMockLLMClient(response?: Partial<LLMResponse>): LLMClient {
  return {
    call: vi.fn().mockResolvedValue({
      content: response?.content ?? `<thinking>
Step 1: Analyzing the portfolio composition
Step 2: Evaluating risk factors
Step 3: Considering market conditions
</thinking>

<conclusion>
Based on the analysis, the portfolio shows moderate risk with some concentration concerns.
</conclusion>`,
      usage: response?.usage ?? {
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
      },
    }),
  };
}

// =============================================================================
// Property Tests for Extended Thinking
// =============================================================================

describe('ExtendedThinking', () => {
  describe('Property 34: Extended Thinking Trigger on Critical Risk', () => {
    /**
     * Property 34: Extended Thinking Trigger on Critical Risk
     * *For any* context with CRITICAL risk level and enabled criticalRisk trigger,
     * extended thinking should be activated.
     *
     * **Validates: Requirements 1.4.2**
     */
    it('should trigger on CRITICAL risk when criticalRisk trigger is enabled', async () => {
      await fc.assert(
        fc.asyncProperty(queryArb, async (query) => {
          const context: ThinkingContext = {
            riskLevel: 'CRITICAL',
            query,
          };

          const config: ExtendedThinkingConfig = {
            enabled: true,
            budgetTokens: 1024,
            triggers: {
              criticalRisk: true,
              complexDecision: false,
              userRequested: false,
            },
          };

          const result = shouldUseExtendedThinking(context, config);

          // Property: Should trigger for CRITICAL risk
          expect(result.shouldUse).toBe(true);
          expect(result.reason).toContain('CRITICAL');

          return true;
        }),
        { numRuns: 20 }
      );
    });

    it('should not trigger on CRITICAL risk when criticalRisk trigger is disabled', async () => {
      await fc.assert(
        fc.asyncProperty(queryArb, async (query) => {
          const context: ThinkingContext = {
            riskLevel: 'CRITICAL',
            query,
          };

          const config: ExtendedThinkingConfig = {
            enabled: true,
            budgetTokens: 1024,
            triggers: {
              criticalRisk: false,
              complexDecision: false,
              userRequested: false,
            },
          };

          const result = shouldUseExtendedThinking(context, config);

          // Property: Should not trigger when criticalRisk is disabled
          expect(result.shouldUse).toBe(false);

          return true;
        }),
        { numRuns: 20 }
      );
    });

    it('should not trigger on non-CRITICAL risk levels', async () => {
      const nonCriticalLevels: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...nonCriticalLevels) as fc.Arbitrary<RiskLevel>,
          queryArb,
          async (riskLevel, query) => {
            const context: ThinkingContext = {
              riskLevel,
              query,
            };

            const config: ExtendedThinkingConfig = {
              enabled: true,
              budgetTokens: 1024,
              triggers: {
                criticalRisk: true,
                complexDecision: false,
                userRequested: false,
              },
            };

            const result = shouldUseExtendedThinking(context, config);

            // Property: Should not trigger for non-CRITICAL risk
            expect(result.shouldUse).toBe(false);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 39: Extended Thinking Budget Compliance', () => {
    /**
     * Property 39: Extended Thinking Budget Compliance
     * *For any* budget configuration, the executor should respect
     * the token budget limit.
     *
     * **Validates: Requirements 1.4.3, 1.4.4**
     */
    it('should pass budget to LLM call', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 256, max: 4096 }),
          async (budgetTokens) => {
            const mockClient = createMockLLMClient();
            const config: ExtendedThinkingConfig = {
              enabled: true,
              budgetTokens,
              triggers: {
                criticalRisk: true,
                complexDecision: true,
                userRequested: true,
              },
            };

            const executor = new ExtendedThinkingExecutor(mockClient, config);
            const context: ThinkingContext = {
              riskLevel: 'CRITICAL',
              query: 'Analyze my portfolio',
            };

            await executor.execute(context, 'Base prompt');

            // Property: LLM should be called with the configured budget
            expect(mockClient.call).toHaveBeenCalledWith(
              expect.objectContaining({
                maxTokens: budgetTokens,
              })
            );

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should track tokens used in result', async () => {
      const mockClient = createMockLLMClient({
        usage: {
          promptTokens: 150,
          completionTokens: 350,
          totalTokens: 500,
        },
      });

      const config: ExtendedThinkingConfig = {
        enabled: true,
        budgetTokens: 1024,
        triggers: {
          criticalRisk: true,
          complexDecision: true,
          userRequested: true,
        },
      };

      const executor = new ExtendedThinkingExecutor(mockClient, config);
      const context: ThinkingContext = {
        riskLevel: 'CRITICAL',
        query: 'Analyze my portfolio',
      };

      const result = await executor.execute(context, 'Base prompt');

      // Property: Result should include token usage
      expect(result.tokensUsed).toBe(500);
    });
  });

  describe('Property: User Requested Deep Analysis', () => {
    /**
     * Property: Queries containing deep analysis keywords should trigger
     * extended thinking when userRequested trigger is enabled.
     */
    it('should trigger on deep analysis keywords', async () => {
      const deepAnalysisQueries = [
        'Give me a deep analysis of my portfolio',
        'Please provide a detailed analysis',
        'I need a thorough analysis of my positions',
        'Think carefully about my risk exposure',
        'Walk me through my portfolio risks',
        '请给我一个深度分析',
      ];

      for (const query of deepAnalysisQueries) {
        const context: ThinkingContext = { query };
        const config: ExtendedThinkingConfig = {
          enabled: true,
          budgetTokens: 1024,
          triggers: {
            criticalRisk: false,
            complexDecision: false,
            userRequested: true,
          },
        };

        const result = shouldUseExtendedThinking(context, config);
        expect(result.shouldUse).toBe(true);
      }
    });

    it('should trigger when userRequestedDeepAnalysis flag is set', async () => {
      await fc.assert(
        fc.asyncProperty(queryArb, async (query) => {
          const context: ThinkingContext = {
            query,
            userRequestedDeepAnalysis: true,
          };

          const config: ExtendedThinkingConfig = {
            enabled: true,
            budgetTokens: 1024,
            triggers: {
              criticalRisk: false,
              complexDecision: false,
              userRequested: true,
            },
          };

          const result = shouldUseExtendedThinking(context, config);

          // Property: Should trigger when flag is set
          expect(result.shouldUse).toBe(true);
          expect(result.reason).toContain('User');

          return true;
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Property: Disabled Extended Thinking', () => {
    /**
     * Property: When extended thinking is disabled, it should never trigger.
     */
    it('should never trigger when disabled', async () => {
      await fc.assert(
        fc.asyncProperty(contextArb, async (context) => {
          const config: ExtendedThinkingConfig = {
            enabled: false,
            budgetTokens: 1024,
            triggers: {
              criticalRisk: true,
              complexDecision: true,
              userRequested: true,
            },
          };

          const result = shouldUseExtendedThinking(context as ThinkingContext, config);

          // Property: Should never trigger when disabled
          expect(result.shouldUse).toBe(false);

          return true;
        }),
        { numRuns: 30 }
      );
    });
  });

  describe('Property: Complex Decision Detection', () => {
    /**
     * Property: Queries with complex decision keywords should trigger
     * extended thinking when complexDecision trigger is enabled.
     */
    it('should trigger on complex decision keywords', async () => {
      const complexQueries = [
        'Should I rebalance my portfolio?',
        'What should I do about my concentration?',
        'Can you recommend a strategy?',
        'What are the pros and cons of selling?',
        'Compare my options for reducing risk',
      ];

      for (const query of complexQueries) {
        const context: ThinkingContext = { query };
        const config: ExtendedThinkingConfig = {
          enabled: true,
          budgetTokens: 1024,
          triggers: {
            criticalRisk: false,
            complexDecision: true,
            userRequested: false,
          },
        };

        const result = shouldUseExtendedThinking(context, config);
        expect(result.shouldUse).toBe(true);
      }
    });
  });
});

// =============================================================================
// Unit Tests for Utility Functions
// =============================================================================

describe('containsDeepAnalysisKeywords', () => {
  it('should detect deep analysis keywords', () => {
    expect(containsDeepAnalysisKeywords('deep analysis')).toBe(true);
    expect(containsDeepAnalysisKeywords('DETAILED ANALYSIS')).toBe(true);
    expect(containsDeepAnalysisKeywords('think carefully')).toBe(true);
    expect(containsDeepAnalysisKeywords('step by step')).toBe(true);
    expect(containsDeepAnalysisKeywords('深度分析')).toBe(true);
  });

  it('should return false for normal queries', () => {
    expect(containsDeepAnalysisKeywords('show my portfolio')).toBe(false);
    expect(containsDeepAnalysisKeywords('what is my value')).toBe(false);
  });
});

describe('isComplexDecision', () => {
  it('should detect complex decision keywords', () => {
    expect(isComplexDecision({ query: 'should i sell?' })).toBe(true);
    expect(isComplexDecision({ query: 'what should I do?' })).toBe(true);
    expect(isComplexDecision({ query: 'recommend a strategy' })).toBe(true);
    expect(isComplexDecision({ query: 'pros and cons' })).toBe(true);
  });

  it('should return false for simple queries', () => {
    expect(isComplexDecision({ query: 'show my holdings' })).toBe(false);
    expect(isComplexDecision({ query: 'what is my total value' })).toBe(false);
  });
});

describe('estimateThinkingTokens', () => {
  it('should estimate tokens for English text', () => {
    const text = 'This is a test sentence with about forty characters.';
    const tokens = estimateThinkingTokens(text);
    // ~52 chars / 4 = ~13 tokens
    expect(tokens).toBeGreaterThan(10);
    expect(tokens).toBeLessThan(20);
  });

  it('should estimate tokens for Chinese text', () => {
    const text = '这是一个测试句子';
    const tokens = estimateThinkingTokens(text);
    // 8 chars / 1.5 = ~6 tokens
    expect(tokens).toBeGreaterThan(3);
    expect(tokens).toBeLessThan(10);
  });
});

describe('wouldExceedBudget', () => {
  it('should return true when at or over budget', () => {
    expect(wouldExceedBudget(1000, 1000)).toBe(true);
    expect(wouldExceedBudget(1001, 1000)).toBe(true);
  });

  it('should return false when under budget', () => {
    expect(wouldExceedBudget(999, 1000)).toBe(false);
    expect(wouldExceedBudget(0, 1000)).toBe(false);
  });
});

describe('formatThinkingProcess', () => {
  it('should format steps with numbers', () => {
    const steps = ['Analyze data', 'Evaluate risks', 'Make recommendation'];
    const formatted = formatThinkingProcess(steps);
    expect(formatted).toContain('Step 1:');
    expect(formatted).toContain('Step 2:');
    expect(formatted).toContain('Step 3:');
  });

  it('should preserve existing step numbers', () => {
    const steps = ['Step 1: First step', 'Step 2: Second step'];
    const formatted = formatThinkingProcess(steps);
    expect(formatted).toBe('Step 1: First step\n\nStep 2: Second step');
  });

  it('should return empty string for empty array', () => {
    expect(formatThinkingProcess([])).toBe('');
  });
});

describe('ExtendedThinkingExecutor', () => {
  it('should not activate when shouldUse is false', async () => {
    const mockClient = createMockLLMClient();
    const config: ExtendedThinkingConfig = {
      enabled: true,
      budgetTokens: 1024,
      triggers: {
        criticalRisk: true,
        complexDecision: false,
        userRequested: false,
      },
    };

    const executor = new ExtendedThinkingExecutor(mockClient, config);
    const context: ThinkingContext = {
      riskLevel: 'LOW',
      query: 'Show my portfolio',
    };

    const result = await executor.execute(context, 'Base prompt');

    expect(result.activated).toBe(false);
    expect(result.thinkingProcess).toEqual([]);
    expect(result.tokensUsed).toBe(0);
    expect(mockClient.call).not.toHaveBeenCalled();
  });

  it('should parse thinking response correctly', async () => {
    const mockClient = createMockLLMClient();
    const config: ExtendedThinkingConfig = {
      enabled: true,
      budgetTokens: 1024,
      triggers: {
        criticalRisk: true,
        complexDecision: true,
        userRequested: true,
      },
    };

    const executor = new ExtendedThinkingExecutor(mockClient, config);
    const context: ThinkingContext = {
      riskLevel: 'CRITICAL',
      query: 'Analyze my portfolio',
    };

    const result = await executor.execute(context, 'Base prompt');

    expect(result.activated).toBe(true);
    expect(result.thinkingProcess.length).toBeGreaterThan(0);
    expect(result.conclusion).toContain('portfolio');
    expect(result.triggerReason).toContain('CRITICAL');
  });
});
