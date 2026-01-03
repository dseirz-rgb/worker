/**
 * Context Management - TransformMessages
 *
 * Implements message transformation for managing long context in multi-agent
 * conversations. Inspired by AutoGen's TransformMessages pattern.
 *
 * Features:
 * - MessageHistoryLimiter: Limit number of messages in context
 * - MessageTokenLimiter: Limit total tokens with min threshold
 * - TransformChain: Compose multiple transforms in sequence
 *
 * @module agents/transforms
 * @see {@link .kiro/specs/multi-agent-analysis/design.md} for detailed design
 * @see {@link .kiro/specs/multi-agent-analysis/requirements.md} - Requirements 9.1-9.9
 */

import type { AgentMessage, MessageTransform, TransformConfig } from './types';

// =============================================================================
// Token Estimation Utilities
// =============================================================================

/**
 * Estimate token count for a text string.
 *
 * Uses a character-based approximation:
 * - English/Latin text: ~4 characters per token
 * - CJK (Chinese/Japanese/Korean): ~1.5 characters per token
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 *
 * @example
 * ```typescript
 * estimateTokens('Hello, world!'); // ~4 tokens
 * estimateTokens('你好世界'); // ~3 tokens
 * ```
 *
 * @see Requirements 9.3
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Count CJK characters
  const cjkPattern = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
  const cjkMatches = text.match(cjkPattern);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // Non-CJK characters
  const nonCjkCount = text.length - cjkCount;

  // Estimate tokens
  // CJK: ~1.5 chars per token, Non-CJK: ~4 chars per token
  const cjkTokens = Math.ceil(cjkCount / 1.5);
  const nonCjkTokens = Math.ceil(nonCjkCount / 4);

  return cjkTokens + nonCjkTokens;
}

/**
 * Truncate text to fit within a token limit.
 *
 * Preserves complete words when possible and adds ellipsis indicator.
 *
 * @param text - The text to truncate
 * @param maxTokens - Maximum tokens allowed
 * @returns Truncated text
 *
 * @example
 * ```typescript
 * truncateToTokens('This is a long message that needs truncation', 5);
 * // Returns: 'This is a long...'
 * ```
 *
 * @see Requirements 9.7
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (!text || maxTokens <= 0) {
    return '';
  }

  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) {
    return text;
  }

  // Binary search for the right length
  let low = 0;
  let high = text.length;
  let result = '';

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const truncated = text.substring(0, mid);
    const tokens = estimateTokens(truncated);

    if (tokens <= maxTokens - 1) {
      // Reserve 1 token for ellipsis
      result = truncated;
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  // Try to break at word boundary
  const lastSpace = result.lastIndexOf(' ');
  if (lastSpace > result.length * 0.7) {
    // Only break at word if we don't lose too much
    result = result.substring(0, lastSpace);
  }

  return result.trim() + '...';
}

// =============================================================================
// MessageHistoryLimiter
// =============================================================================

/**
 * Limits the number of messages in the conversation history.
 *
 * Retains only the most recent N messages, discarding older ones.
 * This is useful for keeping context focused on recent interactions.
 *
 * @example
 * ```typescript
 * const limiter = new MessageHistoryLimiter(5);
 * const messages = [...]; // 10 messages
 * const limited = limiter.applyTransform(messages);
 * // limited contains only the 5 most recent messages
 * ```
 *
 * @see Requirements 9.2, 9.4
 */
export class MessageHistoryLimiter implements MessageTransform {
  /** Transform name for logging */
  readonly name = 'MessageHistoryLimiter';

  /** Maximum number of messages to retain */
  private maxMessages: number;

  /**
   * Create a new MessageHistoryLimiter.
   *
   * @param maxMessages - Maximum number of messages to keep
   */
  constructor(maxMessages: number) {
    if (maxMessages < 1) {
      throw new Error('maxMessages must be at least 1');
    }
    this.maxMessages = maxMessages;
  }

  /**
   * Apply the message limit transformation.
   *
   * @param messages - Input message array
   * @returns Transformed message array with at most maxMessages entries
   */
  applyTransform(messages: AgentMessage[]): AgentMessage[] {
    if (messages.length <= this.maxMessages) {
      return messages;
    }

    // Keep the most recent messages
    const startIndex = messages.length - this.maxMessages;
    return messages.slice(startIndex);
  }

  /**
   * Get the configured maximum messages.
   *
   * @returns Maximum messages limit
   */
  getMaxMessages(): number {
    return this.maxMessages;
  }
}

// =============================================================================
// MessageTokenLimiter
// =============================================================================

/**
 * Configuration options for MessageTokenLimiter.
 */
export interface TokenLimiterOptions {
  /** Maximum total tokens across all messages */
  maxTokens: number;

  /** Minimum tokens threshold - no transformation if below this */
  minTokens?: number;

  /** Maximum tokens per individual message (truncates if exceeded) */
  maxTokensPerMessage?: number;
}

/**
 * Limits the total token count in the conversation history.
 *
 * Features:
 * - Removes older messages when total exceeds maxTokens
 * - Supports minTokens threshold (no transform if below)
 * - Supports per-message truncation with maxTokensPerMessage
 *
 * @example
 * ```typescript
 * const limiter = new MessageTokenLimiter({
 *   maxTokens: 4000,
 *   minTokens: 1000,
 *   maxTokensPerMessage: 500
 * });
 * const limited = limiter.applyTransform(messages);
 * ```
 *
 * @see Requirements 9.3, 9.5, 9.6, 9.7
 */
export class MessageTokenLimiter implements MessageTransform {
  /** Transform name for logging */
  readonly name = 'MessageTokenLimiter';

  /** Maximum total tokens */
  private maxTokens: number;

  /** Minimum tokens threshold */
  private minTokens: number;

  /** Maximum tokens per message */
  private maxTokensPerMessage: number | undefined;

  /**
   * Create a new MessageTokenLimiter.
   *
   * @param options - Token limiter configuration
   */
  constructor(options: TokenLimiterOptions) {
    if (options.maxTokens < 1) {
      throw new Error('maxTokens must be at least 1');
    }

    this.maxTokens = options.maxTokens;
    this.minTokens = options.minTokens ?? 0;
    this.maxTokensPerMessage = options.maxTokensPerMessage;
  }

  /**
   * Apply the token limit transformation.
   *
   * @param messages - Input message array
   * @returns Transformed message array within token limits
   */
  applyTransform(messages: AgentMessage[]): AgentMessage[] {
    if (messages.length === 0) {
      return messages;
    }

    // First, apply per-message truncation if configured
    let processedMessages = this.maxTokensPerMessage
      ? this.truncateIndividualMessages(messages)
      : [...messages];

    // Calculate total tokens
    let totalTokens = this.calculateTotalTokens(processedMessages);

    // If below minTokens threshold, no transformation needed
    if (totalTokens <= this.minTokens) {
      return processedMessages;
    }

    // If within maxTokens, return as-is
    if (totalTokens <= this.maxTokens) {
      return processedMessages;
    }

    // Remove older messages until within limit
    while (processedMessages.length > 1 && totalTokens > this.maxTokens) {
      // Remove the oldest message
      processedMessages = processedMessages.slice(1);
      totalTokens = this.calculateTotalTokens(processedMessages);
    }

    // If still over limit with single message, truncate it
    if (processedMessages.length === 1 && totalTokens > this.maxTokens) {
      const message = processedMessages[0];
      const truncatedContent = truncateToTokens(message.content, this.maxTokens);
      processedMessages = [
        {
          ...message,
          content: truncatedContent,
        },
      ];
    }

    return processedMessages;
  }

  /**
   * Truncate individual messages that exceed maxTokensPerMessage.
   *
   * @param messages - Input messages
   * @returns Messages with individual truncation applied
   */
  private truncateIndividualMessages(messages: AgentMessage[]): AgentMessage[] {
    if (!this.maxTokensPerMessage) {
      return messages;
    }

    return messages.map((message) => {
      const tokens = estimateTokens(message.content);
      if (tokens <= this.maxTokensPerMessage!) {
        return message;
      }

      return {
        ...message,
        content: truncateToTokens(message.content, this.maxTokensPerMessage!),
      };
    });
  }

  /**
   * Calculate total tokens across all messages.
   *
   * @param messages - Messages to count
   * @returns Total token count
   */
  private calculateTotalTokens(messages: AgentMessage[]): number {
    return messages.reduce((total, msg) => total + estimateTokens(msg.content), 0);
  }

  /**
   * Get the configured maximum tokens.
   *
   * @returns Maximum tokens limit
   */
  getMaxTokens(): number {
    return this.maxTokens;
  }

  /**
   * Get the configured minimum tokens threshold.
   *
   * @returns Minimum tokens threshold
   */
  getMinTokens(): number {
    return this.minTokens;
  }

  /**
   * Get the configured maximum tokens per message.
   *
   * @returns Maximum tokens per message or undefined
   */
  getMaxTokensPerMessage(): number | undefined {
    return this.maxTokensPerMessage;
  }
}

// =============================================================================
// TransformChain
// =============================================================================

/**
 * Chains multiple message transforms together.
 *
 * Transforms are applied in sequence, with each transform receiving
 * the output of the previous one.
 *
 * @example
 * ```typescript
 * const chain = new TransformChain([
 *   new MessageHistoryLimiter(10),
 *   new MessageTokenLimiter({ maxTokens: 4000 })
 * ]);
 * const transformed = chain.applyTransform(messages);
 * ```
 *
 * @see Requirements 9.8, 9.9
 */
export class TransformChain implements MessageTransform {
  /** Transform name for logging */
  readonly name = 'TransformChain';

  /** Ordered list of transforms to apply */
  private transforms: MessageTransform[];

  /** Enable debug logging */
  private debug: boolean;

  /**
   * Create a new TransformChain.
   *
   * @param transforms - Array of transforms to chain
   * @param debug - Enable debug logging (default: false)
   */
  constructor(transforms: MessageTransform[], debug: boolean = false) {
    this.transforms = transforms;
    this.debug = debug;
  }

  /**
   * Apply all transforms in sequence.
   *
   * @param messages - Input message array
   * @returns Transformed message array
   */
  applyTransform(messages: AgentMessage[]): AgentMessage[] {
    let result = messages;

    for (const transform of this.transforms) {
      const beforeCount = result.length;
      const beforeTokens = this.countTokens(result);

      result = transform.applyTransform(result);

      if (this.debug) {
        const afterCount = result.length;
        const afterTokens = this.countTokens(result);
        console.log(
          `[TransformChain] ${transform.name}: ` +
            `messages ${beforeCount} -> ${afterCount}, ` +
            `tokens ${beforeTokens} -> ${afterTokens}`
        );
      }
    }

    return result;
  }

  /**
   * Add a transform to the chain.
   *
   * @param transform - Transform to add
   * @returns This chain for method chaining
   */
  addTransform(transform: MessageTransform): TransformChain {
    this.transforms.push(transform);
    return this;
  }

  /**
   * Get the list of transforms in the chain.
   *
   * @returns Array of transforms
   */
  getTransforms(): MessageTransform[] {
    return [...this.transforms];
  }

  /**
   * Count total tokens in messages.
   *
   * @param messages - Messages to count
   * @returns Total token count
   */
  private countTokens(messages: AgentMessage[]): number {
    return messages.reduce((total, msg) => total + estimateTokens(msg.content), 0);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a transform chain from configuration.
 *
 * @param config - Transform configuration
 * @returns Configured TransformChain
 *
 * @example
 * ```typescript
 * const chain = createTransformChain({
 *   enabled: true,
 *   maxMessages: 10,
 *   maxTokens: 4000,
 *   maxTokensPerMessage: 500,
 *   minTokens: 1000
 * });
 * ```
 */
export function createTransformChain(config: TransformConfig): TransformChain {
  const transforms: MessageTransform[] = [];

  if (!config.enabled) {
    // Return empty chain if disabled
    return new TransformChain([]);
  }

  // Add message history limiter if configured
  if (config.maxMessages && config.maxMessages > 0) {
    transforms.push(new MessageHistoryLimiter(config.maxMessages));
  }

  // Add token limiter if configured
  if (config.maxTokens && config.maxTokens > 0) {
    transforms.push(
      new MessageTokenLimiter({
        maxTokens: config.maxTokens,
        minTokens: config.minTokens,
        maxTokensPerMessage: config.maxTokensPerMessage,
      })
    );
  }

  return new TransformChain(transforms);
}

/**
 * Create a default transform chain with standard settings.
 *
 * Uses DEFAULT_TRANSFORM_CONFIG values:
 * - maxMessages: 10
 * - maxTokens: 4000
 * - maxTokensPerMessage: 500
 * - minTokens: 1000
 *
 * @returns Default TransformChain
 */
export function createDefaultTransformChain(): TransformChain {
  return createTransformChain({
    enabled: true,
    maxMessages: 10,
    maxTokens: 4000,
    maxTokensPerMessage: 500,
    minTokens: 1000,
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate statistics about a message array.
 *
 * @param messages - Messages to analyze
 * @returns Statistics object
 */
export function getMessageStats(messages: AgentMessage[]): {
  messageCount: number;
  totalTokens: number;
  averageTokensPerMessage: number;
  maxTokensInMessage: number;
  minTokensInMessage: number;
} {
  if (messages.length === 0) {
    return {
      messageCount: 0,
      totalTokens: 0,
      averageTokensPerMessage: 0,
      maxTokensInMessage: 0,
      minTokensInMessage: 0,
    };
  }

  const tokenCounts = messages.map((msg) => estimateTokens(msg.content));
  const totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);

  return {
    messageCount: messages.length,
    totalTokens,
    averageTokensPerMessage: Math.round(totalTokens / messages.length),
    maxTokensInMessage: Math.max(...tokenCounts),
    minTokensInMessage: Math.min(...tokenCounts),
  };
}

/**
 * Check if messages would benefit from transformation.
 *
 * @param messages - Messages to check
 * @param config - Transform configuration
 * @returns True if transformation would reduce size
 */
export function shouldApplyTransforms(
  messages: AgentMessage[],
  config: TransformConfig
): boolean {
  if (!config.enabled) {
    return false;
  }

  // Check message count
  if (config.maxMessages && messages.length > config.maxMessages) {
    return true;
  }

  // Check total tokens
  if (config.maxTokens) {
    const totalTokens = messages.reduce(
      (sum, msg) => sum + estimateTokens(msg.content),
      0
    );

    // Only apply if above minTokens threshold
    const minTokens = config.minTokens ?? 0;
    if (totalTokens > minTokens && totalTokens > config.maxTokens) {
      return true;
    }
  }

  // Check individual message tokens
  if (config.maxTokensPerMessage) {
    const hasLongMessage = messages.some(
      (msg) => estimateTokens(msg.content) > config.maxTokensPerMessage!
    );
    if (hasLongMessage) {
      return true;
    }
  }

  return false;
}

/**
 * Log transform application for debugging.
 *
 * @param transformName - Name of the transform
 * @param before - Messages before transform
 * @param after - Messages after transform
 */
export function logTransformApplication(
  transformName: string,
  before: AgentMessage[],
  after: AgentMessage[]
): void {
  const beforeStats = getMessageStats(before);
  const afterStats = getMessageStats(after);

  console.log(`[Transform] ${transformName} applied:`);
  console.log(`  Messages: ${beforeStats.messageCount} -> ${afterStats.messageCount}`);
  console.log(`  Tokens: ${beforeStats.totalTokens} -> ${afterStats.totalTokens}`);
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  MessageHistoryLimiter,
  MessageTokenLimiter,
  TransformChain,
  createTransformChain,
  createDefaultTransformChain,
  estimateTokens,
  truncateToTokens,
  getMessageStats,
  shouldApplyTransforms,
};
