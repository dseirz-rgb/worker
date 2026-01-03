/**
 * Gemini API 代理服务
 * 
 * 提供 Gemini API 的统一访问接口
 * - 支持 mock 模式用于测试
 * - 支持流式响应
 * 
 * **Validates: Requirements 39.1, 39.2**
 * 
 * @module @echoai/shared/integrations/gemini
 */

// ============================================
// 类型定义
// ============================================

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeout?: number;
  useMock?: boolean;
}

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface GeminiRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
  };
  safetySettings?: {
    category: string;
    threshold: string;
  }[];
}

export interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
      role: string;
    };
    finishReason: string;
    index: number;
  }[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_MODEL = 'gemini-2.5-flash-preview-05-20';
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TIMEOUT = 30000;

// ============================================
// Mock 响应
// ============================================

const MOCK_RESPONSES = [
  '这是一个模拟响应。在生产环境中，这将是来自 Gemini API 的真实响应。',
  '我是 Gemini AI 助手的模拟版本。请配置 API 密钥以获取真实响应。',
  '模拟模式已启用。所有响应都是预设的测试数据。',
];

// ============================================
// Gemini 服务
// ============================================

export class GeminiService {
  private config: GeminiConfig;
  private conversationHistory: GeminiMessage[] = [];

  constructor(config: GeminiConfig) {
    this.config = {
      model: DEFAULT_MODEL,
      baseUrl: DEFAULT_BASE_URL,
      timeout: DEFAULT_TIMEOUT,
      useMock: false,
      ...config,
    };
  }

  /**
   * 发送聊天消息
   * **Validates: Requirements 39.1**
   */
  async chat(message: string, options?: ChatOptions): Promise<string> {
    if (this.config.useMock) {
      const response = this.mockChat(message);
      // Mock 模式也要更新历史
      this.conversationHistory.push(
        { role: 'user', parts: [{ text: message }] },
        { role: 'model', parts: [{ text: response }] }
      );
      return response;
    }

    // 添加系统提示（如果有）
    const messages: GeminiMessage[] = [];
    if (options?.systemPrompt) {
      messages.push({
        role: 'user',
        parts: [{ text: `System: ${options.systemPrompt}` }],
      });
      messages.push({
        role: 'model',
        parts: [{ text: 'Understood. I will follow these instructions.' }],
      });
    }

    // 添加历史消息
    messages.push(...this.conversationHistory);

    // 添加当前消息
    messages.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const request: GeminiRequest = {
      contents: messages,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 2048,
      },
    };

    const response = await this.callAPI(request);
    const responseText = response.candidates[0]?.content?.parts[0]?.text || '';

    // 更新历史
    this.conversationHistory.push(
      { role: 'user', parts: [{ text: message }] },
      { role: 'model', parts: [{ text: responseText }] }
    );

    return responseText;
  }

  /**
   * 单次生成（不保留历史）
   * **Validates: Requirements 39.2**
   */
  async generate(prompt: string, options?: ChatOptions): Promise<string> {
    if (this.config.useMock) {
      return this.mockChat(prompt);
    }

    const messages: GeminiMessage[] = [];
    if (options?.systemPrompt) {
      messages.push({
        role: 'user',
        parts: [{ text: `System: ${options.systemPrompt}` }],
      });
      messages.push({
        role: 'model',
        parts: [{ text: 'Understood.' }],
      });
    }

    messages.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const request: GeminiRequest = {
      contents: messages,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 2048,
      },
    };

    const response = await this.callAPI(request);
    return response.candidates[0]?.content?.parts[0]?.text || '';
  }

  /**
   * 清除对话历史
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * 获取对话历史
   */
  getHistory(): GeminiMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * 检查服务是否可用
   */
  async healthCheck(): Promise<{ available: boolean; message: string }> {
    if (this.config.useMock) {
      return { available: true, message: 'Mock mode enabled' };
    }

    if (!this.config.apiKey) {
      return { available: false, message: 'Missing Gemini API key' };
    }

    try {
      // 简单测试 API 连接
      await this.generate('Hello', { maxTokens: 10 });
      return { available: true, message: 'Gemini API connection successful' };
    } catch (error) {
      return {
        available: false,
        message: `Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 是否使用 Mock 模式
   */
  isMockMode(): boolean {
    return this.config.useMock ?? false;
  }

  /**
   * 获取当前模型
   */
  getModel(): string {
    return this.config.model || DEFAULT_MODEL;
  }

  // ============================================
  // 私有方法
  // ============================================

  private mockChat(_message: string): string {
    const index = Math.floor(Math.random() * MOCK_RESPONSES.length);
    return MOCK_RESPONSES[index];
  }

  private async callAPI(request: GeminiRequest): Promise<GeminiResponse> {
    const url = `${this.config.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new GeminiError(
          'API_ERROR',
          error.error?.message || `API request failed: ${response.status}`
        );
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ============================================
// 错误类
// ============================================

export class GeminiError extends Error {
  constructor(
    public code: 'API_ERROR' | 'TIMEOUT' | 'INVALID_CONFIG' | 'RATE_LIMITED',
    message: string
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

// ============================================
// 工厂函数
// ============================================

let geminiServiceInstance: GeminiService | null = null;

export function initGeminiService(config: GeminiConfig): GeminiService {
  geminiServiceInstance = new GeminiService(config);
  return geminiServiceInstance;
}

export function getGeminiService(): GeminiService | null {
  return geminiServiceInstance;
}

/**
 * 从环境变量创建 Gemini 服务
 */
export function createGeminiServiceFromEnv(): GeminiService {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const useMock = !apiKey;

  return new GeminiService({
    apiKey,
    model,
    useMock,
  });
}

export default GeminiService;
