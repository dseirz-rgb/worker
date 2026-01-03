/**
 * Property-Based Tests for TransformMessages
 *
 * Tests the message transformation system using fast-check for property-based testing.
 *
 * @module agents/transforms.test
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for design specification
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  MessageHistoryLimiter,
  MessageTokenLimiter,
  TransformChain,
  estimateTokens,
  truncateToTokens,
  createTransformChain,
  getMessageStats,
} from './transforms';
import type { AgentMessage } from './types';

// =============================================================================
// Test Helpers and Generators
// =============================================================================

/**
 * Generate a random AgentMessage for testing
 */
const messageArb = fc.record({
  role: fc.constantFrom('user', 'assistant', 'system') as fc.Arbitrary<'user' | 'assistant' | 'system'>,
  content: fc.string({ minLength: 1, maxLength: 500 }),
  timestamp: fc.integer({ min: 1600000000000, max: 1800000000000 }),
});

/**
 * Generate an array of messages
 */
const messagesArb = fc.array(messageArb, { minLength: 1, maxLength: 50 });

/**
 * Generate a message with specific token count (approximately)
 */
function createMessageWithTokens(tokens: number): AgentMessage {
  // ~4 chars per token for English text
  const content = 'a'.repeat(Math.max(1, tokens * 4));
  return {
    role: 'user',
    content,
    timestamp: Date.now(),
  };
}

// =============================================================================
// Property Tests for MessageHistoryLimiter
// =============================================================================

describe('MessageHistoryLimiter', () => {
  describe('Property 23: MessageHistoryLimiter Correctness', () => {
    /**
     * Property 23: MessageHistoryLimiter Correctness
     * *For any* message array and limit N, the output should have at most N messages,
     * and they should be the N most recent (last N) messages from the input.
     *
     * **Validates: Requirements 9.2, 9.4**
     */
    it('should limit messages to at most N and keep the most recent', async () => {
      await fc.assert(
        fc.asyncProperty(
          messagesArb,
          fc.integer({ min: 1, max: 20 }),
          async (messages, maxMessages) => {
            const limiter = new MessageHistoryLimiter(maxMessages);
            const result = limiter.applyTransform(messages);

            // Property 1: Output length is at most maxMessages
            expect(result.length).toBeLessThanOrEqual(maxMessages);

            // Property 2: Output length is min(input.length, maxMessages)
            expect(result.length).toBe(Math.min(messages.length, maxMessages));

            // Property 3: Output contains the last N messages from input
            if (messages.length > maxMessages) {
              const expectedStart = messages.length - maxMessages;
              for (let i = 0; i < result.length; i++) {
                expect(result[i]).toEqual(messages[expectedStart + i]);
              }
            } else {
              // If input is smaller than limit, output equals input
              expect(result).toEqual(messages);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should throw error for invalid maxMessages', () => {
      expect(() => new MessageHistoryLimiter(0)).toThrow();
      expect(() => new MessageHistoryLimiter(-1)).toThrow();
    });

    it('should return same array reference if within limit', () => {
      const limiter = new MessageHistoryLimiter(10);
      const messages: AgentMessage[] = [
        { role: 'user', content: 'Hello', timestamp: Date.now() },
      ];
      const result = limiter.applyTransform(messages);
      expect(result).toBe(messages);
    });
  });
});

// =============================================================================
// Property Tests for MessageTokenLimiter
// =============================================================================

describe('MessageTokenLimiter', () => {
  describe('Property 24: MessageTokenLimiter Correctness', () => {
    /**
     * Property 24: MessageTokenLimiter Correctness
     * *For any* message array and token limit, the output total tokens
     * should not exceed the limit.
     *
     * **Validates: Requirements 9.3, 9.5**
     */
    it('should limit total tokens to at most maxTokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          messagesArb,
          fc.integer({ min: 100, max: 5000 }),
          async (messages, maxTokens) => {
            const limiter = new MessageTokenLimiter({ maxTokens });
            const result = limiter.applyTransform(messages);

            // Calculate total tokens in result
            const totalTokens = result.reduce(
              (sum, msg) => sum + estimateTokens(msg.content),
              0
            );

            // Property: Total tokens should not exceed maxTokens
            expect(totalTokens).toBeLessThanOrEqual(maxTokens);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 25: MessageTokenLimiter Min Threshold', () => {
    /**
     * Property 25: MessageTokenLimiter Min Threshold
     * *For any* message array with total tokens below minTokens,
     * no transformation should be applied.
     *
     * **Validates: Requirements 9.5, 9.6**
     */
    it('should not transform if total tokens below minTokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 500, max: 2000 }),
          async (messageCount, minTokens) => {
            // Create messages with total tokens well below minTokens
            const messages: AgentMessage[] = Array.from({ length: messageCount }, (_, i) => ({
              role: 'user' as const,
              content: `Short message ${i}`,
              timestamp: Date.now() + i,
            }));

            const totalInputTokens = messages.reduce(
              (sum, msg) => sum + estimateTokens(msg.content),
              0
            );

            // Only test if input is actually below minTokens
            if (totalInputTokens >= minTokens) {
              return true; // Skip this case
            }

            const limiter = new MessageTokenLimiter({
              maxTokens: 10000, // High limit
              minTokens,
            });

            const result = limiter.applyTransform(messages);

            // Property: No transformation if below minTokens
            expect(result.length).toBe(messages.length);
            for (let i = 0; i < result.length; i++) {
              expect(result[i].content).toBe(messages[i].content);
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 26: MessageTokenLimiter Per-Message Truncation', () => {
    /**
     * Property 26: MessageTokenLimiter Per-Message Truncation
     * *For any* message exceeding maxTokensPerMessage,
     * it should be truncated to fit within the limit.
     *
     * **Validates: Requirements 9.7**
     */
    it('should truncate individual messages exceeding maxTokensPerMessage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 50, max: 200 }),
          async (maxTokensPerMessage) => {
            // Create a message that exceeds the limit
            const longMessage = createMessageWithTokens(maxTokensPerMessage * 3);
            const messages: AgentMessage[] = [longMessage];

            const limiter = new MessageTokenLimiter({
              maxTokens: 100000, // High total limit
              maxTokensPerMessage,
            });

            const result = limiter.applyTransform(messages);

            // Property: Each message should be within maxTokensPerMessage
            for (const msg of result) {
              const tokens = estimateTokens(msg.content);
              expect(tokens).toBeLessThanOrEqual(maxTokensPerMessage);
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});

// =============================================================================
// Property Tests for TransformChain
// =============================================================================

describe('TransformChain', () => {
  describe('Property 27: Transform Chain Composition', () => {
    /**
     * Property 27: Transform Chain Composition
     * *For any* sequence of transforms, applying them via chain
     * should produce the same result as applying them sequentially.
     *
     * **Validates: Requirements 9.8, 9.9**
     */
    it('should apply transforms in sequence', async () => {
      await fc.assert(
        fc.asyncProperty(
          messagesArb,
          fc.integer({ min: 3, max: 15 }),
          fc.integer({ min: 500, max: 3000 }),
          async (messages, maxMessages, maxTokens) => {
            const historyLimiter = new MessageHistoryLimiter(maxMessages);
            const tokenLimiter = new MessageTokenLimiter({ maxTokens });

            // Apply via chain
            const chain = new TransformChain([historyLimiter, tokenLimiter]);
            const chainResult = chain.applyTransform(messages);

            // Apply manually in sequence
            const step1 = historyLimiter.applyTransform(messages);
            const manualResult = tokenLimiter.applyTransform(step1);

            // Property: Chain result equals manual sequential application
            expect(chainResult.length).toBe(manualResult.length);
            for (let i = 0; i < chainResult.length; i++) {
              expect(chainResult[i].content).toBe(manualResult[i].content);
              expect(chainResult[i].role).toBe(manualResult[i].role);
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should allow adding transforms dynamically', () => {
      const chain = new TransformChain([]);
      expect(chain.getTransforms().length).toBe(0);

      chain.addTransform(new MessageHistoryLimiter(5));
      expect(chain.getTransforms().length).toBe(1);

      chain.addTransform(new MessageTokenLimiter({ maxTokens: 1000 }));
      expect(chain.getTransforms().length).toBe(2);
    });

    it('should return input unchanged for empty chain', () => {
      const chain = new TransformChain([]);
      const messages: AgentMessage[] = [
        { role: 'user', content: 'Hello', timestamp: Date.now() },
      ];
      const result = chain.applyTransform(messages);
      expect(result).toBe(messages);
    });
  });

  describe('Property 28: Selector Mode Transform Application', () => {
    /**
     * Property 28: Selector Mode Transform Application
     * *For any* configuration, createTransformChain should create
     * a chain that respects all configured limits.
     *
     * **Validates: Requirements 9.8, 9.9**
     */
    it('should create chain respecting all configured limits', async () => {
      await fc.assert(
        fc.asyncProperty(
          messagesArb,
          fc.integer({ min: 3, max: 10 }),
          fc.integer({ min: 500, max: 2000 }),
          fc.integer({ min: 50, max: 200 }),
          async (messages, maxMessages, maxTokens, maxTokensPerMessage) => {
            const chain = createTransformChain({
              enabled: true,
              maxMessages,
              maxTokens,
              maxTokensPerMessage,
            });

            const result = chain.applyTransform(messages);

            // Property 1: Message count within limit
            expect(result.length).toBeLessThanOrEqual(maxMessages);

            // Property 2: Total tokens within limit
            const totalTokens = result.reduce(
              (sum, msg) => sum + estimateTokens(msg.content),
              0
            );
            expect(totalTokens).toBeLessThanOrEqual(maxTokens);

            // Property 3: Each message within per-message limit
            for (const msg of result) {
              const tokens = estimateTokens(msg.content);
              expect(tokens).toBeLessThanOrEqual(maxTokensPerMessage);
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should return empty chain when disabled', () => {
      const chain = createTransformChain({ enabled: false });
      expect(chain.getTransforms().length).toBe(0);
    });
  });
});

// =============================================================================
// Unit Tests for Utility Functions
// =============================================================================

describe('estimateTokens', () => {
  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('should estimate English text at ~4 chars per token', () => {
    const text = 'Hello world this is a test';
    const tokens = estimateTokens(text);
    // 26 chars / 4 ≈ 7 tokens
    expect(tokens).toBeGreaterThan(5);
    expect(tokens).toBeLessThan(15);
  });

  it('should estimate CJK text at ~1.5 chars per token', () => {
    const text = '你好世界';
    const tokens = estimateTokens(text);
    // 4 CJK chars / 1.5 ≈ 3 tokens
    expect(tokens).toBeGreaterThan(1);
    expect(tokens).toBeLessThan(6);
  });

  it('should handle mixed content', () => {
    const text = 'Hello 你好 World 世界';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(3);
  });
});

describe('truncateToTokens', () => {
  it('should return empty string for 0 maxTokens', () => {
    expect(truncateToTokens('Hello world', 0)).toBe('');
  });

  it('should return original if within limit', () => {
    const text = 'Hi';
    expect(truncateToTokens(text, 100)).toBe(text);
  });

  it('should truncate and add ellipsis', () => {
    const text = 'This is a very long message that needs to be truncated';
    const result = truncateToTokens(text, 5);
    expect(result.endsWith('...')).toBe(true);
    expect(estimateTokens(result)).toBeLessThanOrEqual(5);
  });
});

describe('getMessageStats', () => {
  it('should return zeros for empty array', () => {
    const stats = getMessageStats([]);
    expect(stats.messageCount).toBe(0);
    expect(stats.totalTokens).toBe(0);
    expect(stats.averageTokensPerMessage).toBe(0);
  });

  it('should calculate correct statistics', () => {
    const messages: AgentMessage[] = [
      { role: 'user', content: 'Hello', timestamp: Date.now() },
      { role: 'assistant', content: 'Hi there, how can I help?', timestamp: Date.now() },
    ];
    const stats = getMessageStats(messages);
    expect(stats.messageCount).toBe(2);
    expect(stats.totalTokens).toBeGreaterThan(0);
    expect(stats.averageTokensPerMessage).toBeGreaterThan(0);
    expect(stats.maxTokensInMessage).toBeGreaterThanOrEqual(stats.minTokensInMessage);
  });
});
