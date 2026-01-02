import { ErrorCode, MCPError } from '../types/index.js';

export function createError(
  code: ErrorCode,
  message: string,
  details?: MCPError['details']
): MCPError {
  return {
    code,
    message,
    details: {
      ...details,
      timestamp: new Date().toISOString(),
    },
  };
}

export function isConfigError(code: ErrorCode): boolean {
  return code.startsWith('E1');
}

export function isExecutionError(code: ErrorCode): boolean {
  return code.startsWith('E2');
}

export function isTaskError(code: ErrorCode): boolean {
  return code.startsWith('E3');
}

export function isUE5Error(code: ErrorCode): boolean {
  return code.startsWith('E4');
}

export class MCPServerError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: MCPError['details'];

  constructor(code: ErrorCode, message: string, details?: MCPError['details']) {
    super(message);
    this.name = 'MCPServerError';
    this.code = code;
    this.details = details;
  }

  toMCPError(): MCPError {
    return createError(this.code, this.message, this.details);
  }
}
