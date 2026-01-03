/**
 * Message Transformer - Context Management for Adaptive RAG
 *
 * Implements message history management to prevent token overflow
 * in long conversations. Inspired by AutoGen's TransformMessages pattern.
 *
 * Features:
 * - Message count limiting (keep most recent N messages)
 * - Token count limiting (truncate to fit within budget)
 * - Per-message token limiting (truncate long individual messages)
 * - Minimum token threshold (skip truncation for short conversations)
 *
 * @module adaptiveRag/messageTransformer
 * @see {@link .kiro/specs/adaptive-rag/design.md} for detailed design
 */

import type {
  Message,
  MessageTransformerConfig,
  TransformResult,
  ContentPart,
} from './types';
import { DEFAULT_MESSAGE_TRANSFORMER_CONFIG } from './types';

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimate token count for a string.
 * Uses simple character-based estimation: ~4 characters per token.
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }
  // Simple estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Get the text content from a message.
 * Handles both string content and multi-modal ContentPart arrays.
 *
 * @param message - Message to extract content from
 * @returns Text content as string
 */
export function getMessageText(message: Message): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  // Handle ContentPart array - extract text parts
  return message.content
    .filter((part): part is ContentPart & { text: string } =>
      part.type === 'text' && typeof part.text === 'string'
    )
    .map(part => part.text)
    .join('\n');
}

/**
 * Estimate token count for a message.
 *
 * @param message - Message to estimate tokens for
 * @returns Estimated token count
 */
export function estimateMessageTokens(message: Message): number {
  const text = getMessageText(message);
  return estimateTokens(text);
}

/**
 * Calculate total tokens for an array of messages.
 *
 * @param messages - Messages to calculate tokens for
 * @returns Total estimated token count
 */
export function calculateTotalTokens(messages: Message[]): number {
  return messages.reduce((total, msg) => total + estimateMessageTokens(msg), 0);
}

// =============================================================================
// Message Transformer Class
// =============================================================================

/**
 * MessageTransformer handles message history management for the Adaptive RAG system.
 *
 * It applies transformations to prevent token overflow:
 * 1. Limits the number of messages (keeps most recent)
 * 2. Limits total token count (removes oldest messages first)
 * 3. Truncates individual messages that exceed per-message limit
 *
 * @example
 * ```typescript
 * const transformer = new MessageTransformer({
 *   max_messages: 10,
 *   max_tokens: 4000,
 *   max_tokens_per_message: 500,
 *   min_tokens: 500
 * });
 *
 * const result = transformer.transform(messages);
 * console.log(`Removed ${result.messages_removed} messages, ${result.tokens_removed} tokens`);
 * ```
 */
export class MessageTransformer {
  private config: MessageTransformerConfig;

  /**
   * Create a new MessageTransformer.
   *
   * @param config - Configuration options (uses defaults for missing values)
   */
  constructor(config: Partial<MessageTransformerConfig> = {}) {
    this.config = {
      ...DEFAULT_MESSAGE_TRANSFORMER_CONFIG,
      ...config,
    };
  }

  /**
   * Get the current configuration.
   *
   * @returns Current configuration
   */
  getConfig(): MessageTransformerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<MessageTransformerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Apply message count limit.
   * Keeps the most recent N messages, removing oldest first.
   *
   * @param messages - Input messages
   * @returns Messages limited to max_messages count
   *
   * @example
   * ```typescript
   * const transformer = new MessageTransformer({ max_messages: 5 });
   * const limited = transformer.applyMessageLimit(messages);
   * // Returns last 5 messages
   * ```
   */
  applyMessageLimit(messages: Message[]): Message[] {
    if (messages.length <= this.config.max_messages) {
      return [...messages];
    }

    // Keep the most recent messages
    const startIndex = messages.length - this.config.max_messages;
    return messages.slice(startIndex);
  }

  /**
   * Truncate a single message to fit within per-message token limit.
   *
   * @param message - Message to truncate
   * @returns Truncated message (or original if within limit)
   */
  private truncateMessage(message: Message): Message {
    const tokens = estimateMessageTokens(message);

    if (tokens <= this.config.max_tokens_per_message) {
      return message;
    }

    // Calculate target character count
    const targetChars = this.config.max_tokens_per_message * 4;
    const text = getMessageText(message);

    // Truncate with ellipsis
    const truncatedText = text.slice(0, targetChars - 3) + '...';

    return {
      ...message,
      content: truncatedText,
    };
  }

  /**
   * Apply token limit to messages.
   * Removes oldest messages first until total tokens is within limit.
   * Also truncates individual messages that exceed per-message limit.
   *
   * @param messages - Input messages
   * @returns Messages limited to max_tokens total
   *
   * @example
   * ```typescript
   * const transformer = new MessageTransformer({ max_tokens: 4000 });
   * const limited = transformer.applyTokenLimit(messages);
   * // Returns messages fitting within 4000 tokens
   * ```
   */
  applyTokenLimit(messages: Message[]): Message[] {
    // First, truncate individual messages that are too long
    const truncatedMessages = messages.map(msg => this.truncateMessage(msg));

    // Check if total is within limit
    const totalTokens = calculateTotalTokens(truncatedMessages);

    // If below minimum threshold, don't truncate
    if (totalTokens <= this.config.min_tokens) {
      return truncatedMessages;
    }

    // If within limit, return as-is
    if (totalTokens <= this.config.max_tokens) {
      return truncatedMessages;
    }

    // Remove oldest messages until within limit
    const result: Message[] = [];
    let currentTokens = 0;

    // Process from newest to oldest
    for (let i = truncatedMessages.length - 1; i >= 0; i--) {
      const msg = truncatedMessages[i];
      const msgTokens = estimateMessageTokens(msg);

      if (currentTokens + msgTokens <= this.config.max_tokens) {
        result.unshift(msg);
        currentTokens += msgTokens;
      } else {
        // Stop adding messages once we exceed the limit
        break;
      }
    }

    return result;
  }

  /**
   * Apply all transformations to messages.
   * Combines message limit and token limit transformations.
   *
   * @param messages - Input messages
   * @returns Transform result with messages and removal statistics
   *
   * @example
   * ```typescript
   * const transformer = new MessageTransformer();
   * const result = transformer.transform(messages);
   *
   * console.log(`Kept ${result.messages.length} messages`);
   * console.log(`Removed ${result.messages_removed} messages`);
   * console.log(`Removed ${result.tokens_removed} tokens`);
   * ```
   */
  transform(messages: Message[]): TransformResult {
    const originalCount = messages.length;
    const originalTokens = calculateTotalTokens(messages);

    // Apply message limit first
    let transformed = this.applyMessageLimit(messages);

    // Then apply token limit
    transformed = this.applyTokenLimit(transformed);

    const finalCount = transformed.length;
    const finalTokens = calculateTotalTokens(transformed);

    return {
      messages: transformed,
      messages_removed: originalCount - finalCount,
      tokens_removed: originalTokens - finalTokens,
    };
  }

  /**
   * Check if messages need transformation.
   * Useful for deciding whether to apply transforms.
   *
   * @param messages - Messages to check
   * @returns True if messages exceed any limit
   */
  needsTransformation(messages: Message[]): boolean {
    // Check message count
    if (messages.length > this.config.max_messages) {
      return true;
    }

    // Check total tokens
    const totalTokens = calculateTotalTokens(messages);
    if (totalTokens > this.config.max_tokens) {
      return true;
    }

    // Check individual message tokens
    for (const msg of messages) {
      if (estimateMessageTokens(msg) > this.config.max_tokens_per_message) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get statistics about messages without transforming.
   *
   * @param messages - Messages to analyze
   * @returns Statistics object
   */
  getStatistics(messages: Message[]): {
    messageCount: number;
    totalTokens: number;
    averageTokensPerMessage: number;
    maxMessageTokens: number;
    exceedsMessageLimit: boolean;
    exceedsTokenLimit: boolean;
  } {
    const messageCount = messages.length;
    const totalTokens = calculateTotalTokens(messages);
    const messageSizes = messages.map(estimateMessageTokens);
    const maxMessageTokens = Math.max(0, ...messageSizes);

    return {
      messageCount,
      totalTokens,
      averageTokensPerMessage: messageCount > 0 ? totalTokens / messageCount : 0,
      maxMessageTokens,
      exceedsMessageLimit: messageCount > this.config.max_messages,
      exceedsTokenLimit: totalTokens > this.config.max_tokens,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a MessageTransformer with default configuration.
 *
 * @param config - Optional partial configuration
 * @returns New MessageTransformer instance
 */
export function createMessageTransformer(
  config?: Partial<MessageTransformerConfig>
): MessageTransformer {
  return new MessageTransformer(config);
}

// =============================================================================
// Default Instance
// =============================================================================

/**
 * Default MessageTransformer instance with default configuration.
 */
export const defaultMessageTransformer = new MessageTransformer();
