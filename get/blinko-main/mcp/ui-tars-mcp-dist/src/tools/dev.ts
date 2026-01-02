// Development Assistant Tools - IDE operations, file navigation, command execution
import { ToolDefinition, ToolResult, ErrorCode } from '../types/index.js';
import { createError } from '../utils/errors.js';
import { getLogger } from '../utils/logger.js';

// Supported IDE types
const SUPPORTED_IDES = ['vscode', 'cursor', 'jetbrains', 'sublime', 'vim', 'other'] as const;
type IDEType = typeof SUPPORTED_IDES[number];

/**
 * Open a file in the IDE
 */
async function openFile(params: {
  filePath: string;
  lineNumber?: number;
  ide?: IDEType;
}): Promise<ToolResult> {
  const logger = getLogger();
  const { filePath, lineNumber, ide = 'vscode' } = params;

  try {
    if (!filePath || filePath.trim() === '') {
      return {
        success: false,
        error: createError(ErrorCode.UE5_OPERATION_FAILED, 'File path is required'),
      };
    }

    logger.debug(`Opening file: ${filePath}${lineNumber ? `:${lineNumber}` : ''} in ${ide}`);

    // In full implementation:
    // 1. Detect running IDE
    // 2. Use IDE-specific command or GUI automation
    // 3. Navigate to line if specified

    return {
      success: true,
      data: {
        opened: false,
        message: 'File opening requires IDE integration or GUI automation',
        filePath,
        lineNumber,
        ide,
        supportedIDEs: SUPPORTED_IDES,
      },
    };
  } catch (error) {
    logger.error(`Open file failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.UE5_OPERATION_FAILED,
        `Failed to open file: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Run a shell command
 */
async function runCommand(params: {
  command: string;
  cwd?: string;
  timeout?: number;
}): Promise<ToolResult> {
  const logger = getLogger();
  const { command, cwd, timeout = 30000 } = params;

  try {
    if (!command || command.trim() === '') {
      return {
        success: false,
        error: createError(ErrorCode.UE5_OPERATION_FAILED, 'Command is required'),
      };
    }

    // Security: Block dangerous commands
    const dangerousPatterns = [
      /rm\s+-rf\s+[\/~]/i,
      /format\s+[a-z]:/i,
      /del\s+\/[sq]/i,
      />\s*\/dev\/sd/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return {
          success: false,
          error: createError(
            ErrorCode.UE5_OPERATION_FAILED,
            'Command blocked for security reasons'
          ),
        };
      }
    }

    logger.debug(`Running command: ${command} (cwd: ${cwd || 'current'}, timeout: ${timeout}ms)`);

    // In full implementation:
    // 1. Spawn child process
    // 2. Capture stdout/stderr
    // 3. Handle timeout
    // 4. Return exit code and output

    return {
      success: true,
      data: {
        executed: false,
        message: 'Command execution requires shell integration',
        command,
        cwd,
        timeout,
      },
    };
  } catch (error) {
    logger.error(`Run command failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.UE5_OPERATION_FAILED,
        `Failed to run command: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Navigate to code symbol/definition
 */
async function navigateCode(params: {
  symbol: string;
  action?: 'definition' | 'references' | 'implementations';
  ide?: IDEType;
}): Promise<ToolResult> {
  const logger = getLogger();
  const { symbol, action = 'definition', ide = 'vscode' } = params;

  try {
    if (!symbol || symbol.trim() === '') {
      return {
        success: false,
        error: createError(ErrorCode.UE5_OPERATION_FAILED, 'Symbol name is required'),
      };
    }

    logger.debug(`Navigating to ${action} of: ${symbol} in ${ide}`);

    // In full implementation:
    // 1. Use IDE's Go to Definition/References feature
    // 2. Via command palette or keyboard shortcut
    // 3. Handle multiple results

    return {
      success: true,
      data: {
        navigated: false,
        message: 'Code navigation requires IDE integration',
        symbol,
        action,
        ide,
      },
    };
  } catch (error) {
    logger.error(`Navigate code failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.UE5_OPERATION_FAILED,
        `Failed to navigate: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Detect running IDE
 */
async function detectIDE(): Promise<ToolResult> {
  const logger = getLogger();

  try {
    logger.debug('Detecting running IDE...');

    // In full implementation:
    // 1. Check running processes
    // 2. Identify IDE windows
    // 3. Return IDE type and version

    return {
      success: true,
      data: {
        detected: false,
        message: 'IDE detection requires process inspection',
        supportedIDEs: SUPPORTED_IDES,
      },
    };
  } catch (error) {
    logger.error(`Detect IDE failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.UE5_OPERATION_FAILED,
        `Failed to detect IDE: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * Search in files
 */
async function searchInFiles(params: {
  query: string;
  filePattern?: string;
  caseSensitive?: boolean;
  regex?: boolean;
}): Promise<ToolResult> {
  const logger = getLogger();
  const { query, filePattern = '*', caseSensitive = false, regex = false } = params;

  try {
    if (!query || query.trim() === '') {
      return {
        success: false,
        error: createError(ErrorCode.UE5_OPERATION_FAILED, 'Search query is required'),
      };
    }

    logger.debug(`Searching for: "${query}" in ${filePattern}`);

    return {
      success: true,
      data: {
        searched: false,
        message: 'File search requires IDE integration or file system access',
        query,
        filePattern,
        caseSensitive,
        regex,
      },
    };
  } catch (error) {
    logger.error(`Search failed: ${error}`);
    return {
      success: false,
      error: createError(
        ErrorCode.UE5_OPERATION_FAILED,
        `Failed to search: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

// Tool definitions
export const openFileTool: ToolDefinition = {
  name: 'dev_open_file',
  description: 'Open a file in the IDE at optional line number',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file to open',
      },
      lineNumber: {
        type: 'number',
        description: 'Line number to navigate to',
      },
      ide: {
        type: 'string',
        enum: SUPPORTED_IDES,
        description: 'Target IDE (default: vscode)',
      },
    },
    required: ['filePath'],
  },
  handler: async (params: unknown) => openFile(params as {
    filePath: string;
    lineNumber?: number;
    ide?: IDEType;
  }),
};

export const runCommandTool: ToolDefinition = {
  name: 'dev_run_command',
  description: 'Run a shell command',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)',
      },
    },
    required: ['command'],
  },
  handler: async (params: unknown) => runCommand(params as {
    command: string;
    cwd?: string;
    timeout?: number;
  }),
};

export const navigateCodeTool: ToolDefinition = {
  name: 'dev_navigate_code',
  description: 'Navigate to code symbol definition, references, or implementations',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Symbol name to navigate to',
      },
      action: {
        type: 'string',
        enum: ['definition', 'references', 'implementations'],
        description: 'Navigation action (default: definition)',
      },
      ide: {
        type: 'string',
        enum: SUPPORTED_IDES,
        description: 'Target IDE (default: vscode)',
      },
    },
    required: ['symbol'],
  },
  handler: async (params: unknown) => navigateCode(params as {
    symbol: string;
    action?: 'definition' | 'references' | 'implementations';
    ide?: IDEType;
  }),
};

export const detectIDETool: ToolDefinition = {
  name: 'dev_detect_ide',
  description: 'Detect running IDE',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async () => detectIDE(),
};

export const searchInFilesTool: ToolDefinition = {
  name: 'dev_search_files',
  description: 'Search for text in files',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
      },
      filePattern: {
        type: 'string',
        description: 'File pattern to search in (default: *)',
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Case sensitive search (default: false)',
      },
      regex: {
        type: 'boolean',
        description: 'Use regex (default: false)',
      },
    },
    required: ['query'],
  },
  handler: async (params: unknown) => searchInFiles(params as {
    query: string;
    filePattern?: string;
    caseSensitive?: boolean;
    regex?: boolean;
  }),
};

// Export all dev tools
export const devTools: ToolDefinition[] = [
  openFileTool,
  runCommandTool,
  navigateCodeTool,
  detectIDETool,
  searchInFilesTool,
];

// Export functions for testing
export { openFile, runCommand, navigateCode, detectIDE, searchInFiles, SUPPORTED_IDES };
