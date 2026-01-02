import { ServerConfig, VLMConfig, ErrorCode } from '../types/index.js';
import { MCPServerError } from '../utils/errors.js';

const DEFAULT_CONFIG: ServerConfig = {
  vlm: {
    provider: 'ui-tars',
    baseURL: '',
    apiKey: '',
    model: 'ui-tars-1.5-7b',
  },
  operator: {
    type: 'nutjs',
    mouseSpeed: 1000,
    keyboardDelay: 50,
  },
  execution: {
    maxLoopCount: 25,
    timeout: 30000,
    screenshotInterval: 500,
  },
  logging: {
    level: 'info',
  },
};

export interface ConfigValidationResult {
  valid: boolean;
  error?: {
    code: ErrorCode;
    message: string;
  };
}

export function validateVLMConfig(config: Partial<VLMConfig>): ConfigValidationResult {
  if (!config.baseURL || config.baseURL.trim() === '') {
    return {
      valid: false,
      error: {
        code: ErrorCode.CONFIG_MISSING_REQUIRED,
        message: 'VLM baseURL is required',
      },
    };
  }

  if (!config.apiKey || config.apiKey.trim() === '') {
    return {
      valid: false,
      error: {
        code: ErrorCode.CONFIG_MISSING_REQUIRED,
        message: 'VLM apiKey is required',
      },
    };
  }

  if (!config.model || config.model.trim() === '') {
    return {
      valid: false,
      error: {
        code: ErrorCode.CONFIG_MISSING_REQUIRED,
        message: 'VLM model is required',
      },
    };
  }

  // Validate URL format
  try {
    const parsedUrl = new URL(config.baseURL);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        valid: false,
        error: {
          code: ErrorCode.CONFIG_INVALID,
          message: `URL must use http or https protocol, got: ${parsedUrl.protocol}`,
        },
      };
    }
  } catch {
    return {
      valid: false,
      error: {
        code: ErrorCode.CONFIG_INVALID,
        message: `Invalid VLM baseURL format: ${config.baseURL}`,
      },
    };
  }

  return { valid: true };
}

export function loadConfigFromEnv(): ServerConfig {
  const config: ServerConfig = { ...DEFAULT_CONFIG };

  // VLM Config
  if (process.env.UITARS_VLM_BASE_URL) {
    config.vlm.baseURL = process.env.UITARS_VLM_BASE_URL;
  }
  if (process.env.UITARS_API_KEY) {
    config.vlm.apiKey = process.env.UITARS_API_KEY;
  }
  if (process.env.UITARS_MODEL) {
    config.vlm.model = process.env.UITARS_MODEL;
  }

  // Execution Config
  if (process.env.UITARS_MAX_LOOP_COUNT) {
    config.execution.maxLoopCount = parseInt(process.env.UITARS_MAX_LOOP_COUNT, 10);
  }
  if (process.env.UITARS_TIMEOUT) {
    config.execution.timeout = parseInt(process.env.UITARS_TIMEOUT, 10);
  }

  // Logging Config
  if (process.env.UITARS_LOG_LEVEL) {
    const level = process.env.UITARS_LOG_LEVEL.toLowerCase();
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
      config.logging.level = level as 'debug' | 'info' | 'warn' | 'error';
    }
  }

  return config;
}

export class ConfigManager {
  private config: ServerConfig;

  constructor(initialConfig?: Partial<ServerConfig>) {
    this.config = {
      ...loadConfigFromEnv(),
      ...initialConfig,
    };
  }

  getConfig(): ServerConfig {
    return { ...this.config };
  }

  getVLMConfig(): VLMConfig {
    return { ...this.config.vlm };
  }

  validateConfig(): ConfigValidationResult {
    return validateVLMConfig(this.config.vlm);
  }

  updateConfig(updates: Partial<ServerConfig>): void {
    if (updates.vlm) {
      this.config.vlm = { ...this.config.vlm, ...updates.vlm };
    }
    if (updates.operator) {
      this.config.operator = { ...this.config.operator, ...updates.operator };
    }
    if (updates.execution) {
      this.config.execution = { ...this.config.execution, ...updates.execution };
    }
    if (updates.logging) {
      this.config.logging = { ...this.config.logging, ...updates.logging };
    }
  }

  ensureValid(): void {
    const result = this.validateConfig();
    if (!result.valid && result.error) {
      throw new MCPServerError(result.error.code, result.error.message);
    }
  }
}
