// Scroll Tools - Mouse wheel scrolling functionality
import { mouse } from '@nut-tree-fork/nut-js';
import { ToolDefinition, ToolResult, ScrollParams, ErrorCode } from '../types/index.js';
import { createError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

/**
 * Scroll in a specified direction
 */
async function scroll(params: ScrollParams): Promise<ToolResult> {
  const logger = getLogger();
  const { direction, amount = 3 } = params;

  try {
    // Validate direction
    const validDirections = ['up', 'down', 'left', 'right'];
    if (!validDirections.includes(direction)) {
      return {
        success: false,
        error: createError(
          ErrorCode.KEYBOARD_ERROR,
          `Invalid scroll direction: ${direction}. Valid directions: ${validDirections.join(', ')}`
        ),
      };
    }

    // Validate amount
    if (amount <= 0) {
      return {
        success: false,
        error: createError(
          ErrorCode.KEYBOARD_ERROR,
          `Scroll amount must be positive, got: ${amount}`
        ),
      };
    }

    // Execute scroll based on direction
    switch (direction) {
      case 'up':
        await mouse.scrollUp(amount);
        break;
      case 'down':
        await mouse.scrollDown(amount);
        break;
      case 'left':
        await mouse.scrollLeft(amount);
        break;
      case 'right':
        await mouse.scrollRight(amount);
        break;
    }

    logger.debug(`Scrolled ${direction} by ${amount}`);

    return {
      success: true,
      data: { direction, amount, action: 'scroll' },
    };
  } catch (error) {
    logger.error(`Scroll failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.KEYBOARD_ERROR,
        `Scroll failed: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

// Tool definition
export const scrollTool: ToolDefinition = {
  name: 'scroll',
  description: 'Scroll the mouse wheel in a specified direction',
  inputSchema: {
    type: 'object',
    properties: {
      direction: {
        type: 'string',
        enum: ['up', 'down', 'left', 'right'],
        description: 'Direction to scroll',
      },
      amount: {
        type: 'number',
        description: 'Number of scroll units (default: 3)',
      },
    },
    required: ['direction'],
  },
  handler: async (params: unknown) => scroll(params as ScrollParams),
};

// Export all scroll tools
export const scrollTools: ToolDefinition[] = [scrollTool];

// Export function for testing
export { scroll };
