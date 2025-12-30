/**
 * AI 服务配置
 * 使用 Google Gemini 3 Pro Preview API
 */

// Gemini 模型配置
export const GEMINI_MODELS = {
  // 主力模型 - Gemini 3 Pro Preview (最强推理能力)
  PRO: "gemini-3-pro-preview",
  
  // 快速模型 - Gemini 3 Flash Preview (速度快，适合简单任务)
  FLASH: "gemini-3-flash-preview",
  
  // 稳定模型 - Gemini 2.5 Flash (性价比高，稳定)
  STABLE: "gemini-2.5-flash",
  
  // 图像生成模型
  IMAGE: "gemini-3-pro-image-preview",
} as const;

// 默认模型
export const DEFAULT_MODEL = GEMINI_MODELS.PRO;

// API 配置
export interface GeminiConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

// 默认配置
export const DEFAULT_CONFIG: Omit<GeminiConfig, "apiKey"> = {
  model: DEFAULT_MODEL,
  maxTokens: 8192,
  temperature: 0.7,
};

// API 端点
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * 获取 Gemini API URL
 */
export function getGeminiApiUrl(model: string, action: "generateContent" | "streamGenerateContent" = "generateContent"): string {
  return `${GEMINI_API_BASE}/models/${model}:${action}`;
}


// 存储的配置
let storedConfig: GeminiConfig | null = null;

/**
 * 获取 AI 配置
 */
export function getAIConfig(): GeminiConfig {
  if (storedConfig) return storedConfig;
  
  const stored = localStorage.getItem('ai_config');
  if (stored) {
    storedConfig = JSON.parse(stored);
    return storedConfig!;
  }
  
  return {
    apiKey: '',
    ...DEFAULT_CONFIG,
  };
}

/**
 * 设置 AI 配置
 */
export function setAIConfig(config: Partial<GeminiConfig>): void {
  const current = getAIConfig();
  storedConfig = { ...current, ...config };
  localStorage.setItem('ai_config', JSON.stringify(storedConfig));
}
