// GUI Task Tool - Execute GUI tasks using natural language
import { ToolDefinition, ToolResult, ErrorCode } from '../types/index.js';
import { createError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';
import { GUIAgentService } from '../services/gui-agent.js';
import { ConfigManager } from '../services/config.js';

// Store reference to GUI agent service
let guiAgentService: GUIAgentService | null = null;

/**
 * Initialize the GUI task tools with config manager
 */
export function initGUITaskTools(configManager: ConfigManager): void {
  guiAgentService = new GUIAgentService(configManager);
}

/**
 * Run a GUI task with natural language instruction
 */
async function runGUITask(params: {
  instruction: string;
  maxLoops?: number;
  timeout?: number;
}): Promise<ToolResult> {
  const logger = getLogger();
  const { instruction, maxLoops, timeout } = params;

  if (!guiAgentService) {
    return {
      success: false,
      error: createError(
        ErrorCode.TASK_FAILED,
        'GUI Agent service not initialized'
      ),
    };
  }

  if (!instruction || instruction.trim().length === 0) {
    return {
      success: false,
      error: createError(
        ErrorCode.TASK_FAILED,
        'Instruction cannot be empty'
      ),
    };
  }

  try {
    logger.info(`Running GUI task: "${instruction}"`);

    const result = await guiAgentService.runTask(instruction, {
      maxLoops,
      timeout,
      onProgress: (progress) => {
        logger.debug(`Task progress: ${JSON.stringify(progress)}`);
      },
    });

    if (result.success) {
      return {
        success: true,
        data: {
          status: result.finalStatus,
          steps: result.steps.length,
          message: 'Task completed successfully',
        },
      };
    } else {
      return {
        success: false,
        error: createError(
          ErrorCode.TASK_FAILED,
          result.error || 'Task failed'
        ),
        data: {
          status: result.finalStatus,
          steps: result.steps.length,
        },
      };
    }
  } catch (error) {
    logger.error(`GUI task error: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.TASK_FAILED,
        `GUI task failed: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Cancel the current GUI task
 */
async function cancelGUITask(): Promise<ToolResult> {
  const logger = getLogger();

  if (!guiAgentService) {
    return {
      success: false,
      error: createError(
        ErrorCode.TASK_FAILED,
        'GUI Agent service not initialized'
      ),
    };
  }

  const cancelled = guiAgentService.cancelTask();

  if (cancelled) {
    logger.info('GUI task cancelled');
    return {
      success: true,
      data: { message: 'Task cancellation requested' },
    };
  } else {
    return {
      success: false,
      error: createError(
        ErrorCode.TASK_CANCELLED,
        'No task is currently running'
      ),
    };
  }
}

/**
 * Get GUI task status
 */
async function getGUITaskStatus(): Promise<ToolResult> {
  if (!guiAgentService) {
    return {
      success: false,
      error: createError(
        ErrorCode.TASK_FAILED,
        'GUI Agent service not initialized'
      ),
    };
  }

  return {
    success: true,
    data: {
      isRunning: guiAgentService.isTaskRunning(),
    },
  };
}

// Tool definitions
export const runGUITaskTool: ToolDefinition = {
  name: 'run_gui_task',
  description: 'Execute a GUI automation task using natural language instructions. The task will analyze the screen and perform actions to complete the instruction.',
  inputSchema: {
    type: 'object',
    properties: {
      instruction: {
        type: 'string',
        description: 'Natural language instruction describing the GUI task to perform',
      },
      maxLoops: {
        type: 'number',
        description: 'Maximum number of action loops (default: 25)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 60000)',
      },
    },
    required: ['instruction'],
  },
  handler: async (params: unknown) => runGUITask(params as {
    instruction: string;
    maxLoops?: number;
    timeout?: number;
  }),
};

export const cancelGUITaskTool: ToolDefinition = {
  name: 'cancel_gui_task',
  description: 'Cancel the currently running GUI task',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async () => cancelGUITask(),
};

export const getGUITaskStatusTool: ToolDefinition = {
  name: 'gui_task_status',
  description: 'Get the status of the GUI task runner',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async () => getGUITaskStatus(),
};

// Export all GUI task tools
export const guiTaskTools: ToolDefinition[] = [
  runGUITaskTool,
  cancelGUITaskTool,
  getGUITaskStatusTool,
];
