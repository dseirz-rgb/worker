// Mouse Tools - Click, drag, hover functionality
import { mouse, screen, Button, Point } from '@nut-tree-fork/nut-js';
import { ToolDefinition, ToolResult, ClickParams, DragParams, ErrorCode } from '../types/index.js';
import { createError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

/**
 * Validate coordinates are within screen bounds
 */
async function validateCoordinates(x: number, y: number): Promise<{ valid: boolean; error?: string }> {
  const screenWidth = await screen.width();
  const screenHeight = await screen.height();

  if (x < 0 || x > screenWidth || y < 0 || y > screenHeight) {
    return {
      valid: false,
      error: `Coordinates (${x}, ${y}) out of bounds. Screen size: ${screenWidth}x${screenHeight}`,
    };
  }
  return { valid: true };
}

/**
 * Convert button string to nut-js Button enum
 */
function getButton(button?: 'left' | 'right' | 'middle'): Button {
  switch (button) {
    case 'right':
      return Button.RIGHT;
    case 'middle':
      return Button.MIDDLE;
    default:
      return Button.LEFT;
  }
}

/**
 * Perform a single click at specified coordinates
 */
async function click(params: ClickParams): Promise<ToolResult> {
  const logger = getLogger();
  const { x, y, button } = params;

  try {
    const validation = await validateCoordinates(x, y);
    if (!validation.valid) {
      return {
        success: false,
        error: createError(ErrorCode.MOUSE_OUT_OF_BOUNDS, validation.error!),
      };
    }

    await mouse.setPosition(new Point(x, y));
    await mouse.click(getButton(button));

    logger.debug(`Click at (${x}, ${y}) with ${button || 'left'} button`);

    return {
      success: true,
      data: { x, y, button: button || 'left', action: 'click' },
    };
  } catch (error) {
    logger.error(`Click failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.TASK_FAILED,
        `Click failed: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Perform a double click at specified coordinates
 */
async function doubleClick(params: ClickParams): Promise<ToolResult> {
  const logger = getLogger();
  const { x, y, button } = params;

  try {
    const validation = await validateCoordinates(x, y);
    if (!validation.valid) {
      return {
        success: false,
        error: createError(ErrorCode.MOUSE_OUT_OF_BOUNDS, validation.error!),
      };
    }

    await mouse.setPosition(new Point(x, y));
    await mouse.doubleClick(getButton(button));

    logger.debug(`Double click at (${x}, ${y}) with ${button || 'left'} button`);

    return {
      success: true,
      data: { x, y, button: button || 'left', action: 'double_click' },
    };
  } catch (error) {
    logger.error(`Double click failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.TASK_FAILED,
        `Double click failed: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Perform a right click at specified coordinates
 */
async function rightClick(params: { x: number; y: number }): Promise<ToolResult> {
  return click({ ...params, button: 'right' });
}

/**
 * Drag from start to end coordinates
 */
async function drag(params: DragParams): Promise<ToolResult> {
  const logger = getLogger();
  const { startX, startY, endX, endY } = params;

  try {
    // Validate start coordinates
    const startValidation = await validateCoordinates(startX, startY);
    if (!startValidation.valid) {
      return {
        success: false,
        error: createError(ErrorCode.MOUSE_OUT_OF_BOUNDS, `Start ${startValidation.error}`),
      };
    }

    // Validate end coordinates
    const endValidation = await validateCoordinates(endX, endY);
    if (!endValidation.valid) {
      return {
        success: false,
        error: createError(ErrorCode.MOUSE_OUT_OF_BOUNDS, `End ${endValidation.error}`),
      };
    }

    await mouse.setPosition(new Point(startX, startY));
    await mouse.drag([new Point(endX, endY)]);

    logger.debug(`Drag from (${startX}, ${startY}) to (${endX}, ${endY})`);

    return {
      success: true,
      data: { startX, startY, endX, endY, action: 'drag' },
    };
  } catch (error) {
    logger.error(`Drag failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.TASK_FAILED,
        `Drag failed: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Move mouse to specified coordinates (hover)
 */
async function hover(params: { x: number; y: number }): Promise<ToolResult> {
  const logger = getLogger();
  const { x, y } = params;

  try {
    const validation = await validateCoordinates(x, y);
    if (!validation.valid) {
      return {
        success: false,
        error: createError(ErrorCode.MOUSE_OUT_OF_BOUNDS, validation.error!),
      };
    }

    await mouse.setPosition(new Point(x, y));

    logger.debug(`Hover at (${x}, ${y})`);

    return {
      success: true,
      data: { x, y, action: 'hover' },
    };
  } catch (error) {
    logger.error(`Hover failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.TASK_FAILED,
        `Hover failed: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

// Tool definitions
export const clickTool: ToolDefinition = {
  name: 'click',
  description: 'Perform a mouse click at specified coordinates',
  inputSchema: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X coordinate' },
      y: { type: 'number', description: 'Y coordinate' },
      button: {
        type: 'string',
        enum: ['left', 'right', 'middle'],
        default: 'left',
        description: 'Mouse button to click',
      },
    },
    required: ['x', 'y'],
  },
  handler: async (params: unknown) => click(params as ClickParams),
};

export const doubleClickTool: ToolDefinition = {
  name: 'double_click',
  description: 'Perform a double-click at specified coordinates',
  inputSchema: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X coordinate' },
      y: { type: 'number', description: 'Y coordinate' },
      button: {
        type: 'string',
        enum: ['left', 'right', 'middle'],
        default: 'left',
        description: 'Mouse button to click',
      },
    },
    required: ['x', 'y'],
  },
  handler: async (params: unknown) => doubleClick(params as ClickParams),
};

export const rightClickTool: ToolDefinition = {
  name: 'right_click',
  description: 'Perform a right-click at specified coordinates',
  inputSchema: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X coordinate' },
      y: { type: 'number', description: 'Y coordinate' },
    },
    required: ['x', 'y'],
  },
  handler: async (params: unknown) => rightClick(params as { x: number; y: number }),
};

export const dragTool: ToolDefinition = {
  name: 'drag',
  description: 'Drag from start to end coordinates',
  inputSchema: {
    type: 'object',
    properties: {
      startX: { type: 'number', description: 'Start X coordinate' },
      startY: { type: 'number', description: 'Start Y coordinate' },
      endX: { type: 'number', description: 'End X coordinate' },
      endY: { type: 'number', description: 'End Y coordinate' },
    },
    required: ['startX', 'startY', 'endX', 'endY'],
  },
  handler: async (params: unknown) => drag(params as DragParams),
};

export const hoverTool: ToolDefinition = {
  name: 'hover',
  description: 'Move mouse to specified coordinates',
  inputSchema: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X coordinate' },
      y: { type: 'number', description: 'Y coordinate' },
    },
    required: ['x', 'y'],
  },
  handler: async (params: unknown) => hover(params as { x: number; y: number }),
};

// Export all mouse tools
export const mouseTools: ToolDefinition[] = [
  clickTool,
  doubleClickTool,
  rightClickTool,
  dragTool,
  hoverTool,
];

// Export functions for testing
export { click, doubleClick, rightClick, drag, hover, validateCoordinates };
