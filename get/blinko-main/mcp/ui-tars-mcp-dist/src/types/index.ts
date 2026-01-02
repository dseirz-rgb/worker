// Core Types for UI-TARS MCP Server

export interface ServerConfig {
  vlm: VLMConfig;
  operator: OperatorConfig;
  execution: ExecutionConfig;
  logging: LoggingConfig;
}

export interface VLMConfig {
  provider: 'ui-tars' | 'openai' | 'anthropic' | 'custom';
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface OperatorConfig {
  type: 'nutjs' | 'custom';
  mouseSpeed: number;
  keyboardDelay: number;
}

export interface ExecutionConfig {
  maxLoopCount: number;
  timeout: number;
  screenshotInterval: number;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  file?: string;
}

// Tool Types
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (params: unknown) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: MCPError;
}

export interface MCPError {
  code: ErrorCode;
  message: string;
  details?: {
    tool?: string;
    params?: unknown;
    timestamp?: string;
    stack?: string;
  };
}

// Error Codes
export enum ErrorCode {
  // Configuration Errors (1xxx)
  CONFIG_INVALID = 'E1001',
  CONFIG_MISSING_REQUIRED = 'E1002',
  VLM_CONNECTION_FAILED = 'E1003',

  // Execution Errors (2xxx)
  SCREENSHOT_FAILED = 'E2001',
  MOUSE_OUT_OF_BOUNDS = 'E2002',
  KEYBOARD_ERROR = 'E2003',
  ELEMENT_NOT_FOUND = 'E2004',

  // Task Errors (3xxx)
  TASK_TIMEOUT = 'E3001',
  TASK_CANCELLED = 'E3002',
  TASK_MAX_LOOPS = 'E3003',
  TASK_FAILED = 'E3004',

  // UE5 Specific Errors (4xxx)
  UE5_NOT_RUNNING = 'E4001',
  UE5_ELEMENT_NOT_FOUND = 'E4002',
  UE5_OPERATION_FAILED = 'E4003',
  UE5_COMPILE_TIMEOUT = 'E4004',
}

// Screenshot Types
export interface ScreenshotResult {
  base64: string;
  width: number;
  height: number;
  scaleFactor: number;
}

// Mouse Types
export interface ClickParams {
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle';
}

export interface DragParams {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// Keyboard Types
export interface TypeTextParams {
  text: string;
  delay?: number;
}

export interface HotkeyParams {
  modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[];
  key: string;
}

// Scroll Types
export interface ScrollParams {
  direction: 'up' | 'down' | 'left' | 'right';
  amount?: number;
}

// Task Types
export interface TaskProgress {
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  totalSteps?: number;
  lastAction?: string;
  screenshot?: string;
}

export interface TaskResult {
  success: boolean;
  finalStatus: string;
  steps: TaskStep[];
  error?: string;
}

export interface TaskStep {
  action: string;
  timestamp: number;
  success: boolean;
  screenshot?: string;
}

// Window Types
export interface WindowInfo {
  title: string;
  processName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isActive: boolean;
}
