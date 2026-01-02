import { LoggingConfig } from '../types/index.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private level: LogLevel;
  private file?: string;

  constructor(config: LoggingConfig) {
    this.level = config.level;
    this.file = config.file;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }

  toolInvocation(toolName: string, params: unknown): void {
    this.info(`Tool invocation: ${toolName}`, { params });
  }

  toolResult(toolName: string, success: boolean, duration: number): void {
    this.info(`Tool result: ${toolName}`, { success, duration: `${duration}ms` });
  }
}

// Global logger instance
let globalLogger: Logger | null = null;

export function initLogger(config: LoggingConfig): Logger {
  globalLogger = new Logger(config);
  return globalLogger;
}

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger({ level: 'info' });
  }
  return globalLogger;
}
