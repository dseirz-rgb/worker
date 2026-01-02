// Screen Tools - Screenshot functionality
import { screen, Region, Image } from '@nut-tree-fork/nut-js';
import { ToolDefinition, ToolResult, ScreenshotResult, ErrorCode } from '../types/index.js';
import { createError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

/**
 * Capture a screenshot of the current screen or a specific region
 */
async function captureScreenshot(region?: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<ToolResult> {
  const logger = getLogger();

  try {
    let image: Image;
    const screenWidth = await screen.width();
    const screenHeight = await screen.height();

    if (region) {
      // Validate region bounds
      if (
        region.x < 0 ||
        region.y < 0 ||
        region.x + region.width > screenWidth ||
        region.y + region.height > screenHeight
      ) {
        return {
          success: false,
          error: createError(
            ErrorCode.MOUSE_OUT_OF_BOUNDS,
            `Region out of bounds. Screen size: ${screenWidth}x${screenHeight}, ` +
              `Requested region: (${region.x}, ${region.y}) ${region.width}x${region.height}`
          ),
        };
      }

      // Capture specific region
      const captureRegion = new Region(
        region.x,
        region.y,
        region.width,
        region.height
      );
      image = await screen.grabRegion(captureRegion);
    } else {
      // Capture full screen
      image = await screen.grab();
    }

    // Convert image to base64
    const base64 = await imageToBase64(image);

    const result: ScreenshotResult = {
      base64,
      width: image.width,
      height: image.height,
      scaleFactor: 1, // nut-js doesn't expose scale factor directly
    };

    logger.debug(`Screenshot captured: ${result.width}x${result.height}`);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    logger.error(`Screenshot failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.SCREENSHOT_FAILED,
        `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Convert nut-js Image to base64 string
 */
async function imageToBase64(image: Image): Promise<string> {
  // nut-js Image has a data property with raw pixel data (RGBA)
  // We need to convert it to PNG format for base64 encoding
  const { data, width, height } = image;

  // Create a simple PNG encoder (or use the raw data as base64)
  // For simplicity, we'll encode the raw RGBA data as base64
  // In production, you'd want to use a proper PNG encoder
  const buffer = Buffer.from(data);
  return buffer.toString('base64');
}

/**
 * Get screen information without capturing
 */
async function getScreenInfo(): Promise<ToolResult> {
  const logger = getLogger();

  try {
    const width = await screen.width();
    const height = await screen.height();

    const info = {
      width,
      height,
      scaleFactor: 1,
    };

    logger.debug(`Screen info: ${width}x${height}`);

    return {
      success: true,
      data: info,
    };
  } catch (error) {
    logger.error(`Failed to get screen info: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.SCREENSHOT_FAILED,
        `Failed to get screen info: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

// Tool definitions
export const screenshotTool: ToolDefinition = {
  name: 'screenshot',
  description:
    'Capture a screenshot of the current screen. Optionally specify a region to capture.',
  inputSchema: {
    type: 'object',
    properties: {
      region: {
        type: 'object',
        description: 'Optional region to capture. If not specified, captures full screen.',
        properties: {
          x: { type: 'number', description: 'X coordinate of top-left corner' },
          y: { type: 'number', description: 'Y coordinate of top-left corner' },
          width: { type: 'number', description: 'Width of the region' },
          height: { type: 'number', description: 'Height of the region' },
        },
        required: ['x', 'y', 'width', 'height'],
      },
    },
  },
  handler: async (params: unknown) => {
    const typedParams = params as { region?: { x: number; y: number; width: number; height: number } };
    return captureScreenshot(typedParams?.region);
  },
};

export const screenInfoTool: ToolDefinition = {
  name: 'screen_info',
  description: 'Get information about the current screen (width, height, scale factor)',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async () => {
    return getScreenInfo();
  },
};

// Export all screen tools
export const screenTools: ToolDefinition[] = [screenshotTool, screenInfoTool];

// Export functions for testing
export { captureScreenshot, getScreenInfo };
