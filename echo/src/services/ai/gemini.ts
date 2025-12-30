/**
 * Gemini AI 服务
 * 封装 Google Gemini API 调用
 */

import { GeminiConfig, DEFAULT_CONFIG, getGeminiApiUrl } from "./config";

// 消息类型
export interface Message {
  role: "user" | "model";
  parts: { text: string }[];
}

// 生成配置
export interface GenerationConfig {
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
}

// API 响应类型
interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
      role: string;
    };
    finishReason: string;
  }[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Gemini AI 客户端
 */
export class GeminiClient {
  private config: GeminiConfig;

  constructor(apiKey: string, options?: Partial<Omit<GeminiConfig, "apiKey">>) {
    this.config = {
      apiKey,
      ...DEFAULT_CONFIG,
      ...options,
    };
  }

  /**
   * 生成文本响应
   */
  async generateContent(
    prompt: string,
    options?: {
      systemInstruction?: string;
      history?: Message[];
      generationConfig?: GenerationConfig;
    }
  ): Promise<string> {
    const url = `${getGeminiApiUrl(this.config.model)}?key=${this.config.apiKey}`;

    const contents: Message[] = options?.history || [];
    contents.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.generationConfig?.temperature ?? this.config.temperature,
        maxOutputTokens: options?.generationConfig?.maxOutputTokens ?? this.config.maxTokens,
        ...options?.generationConfig,
      },
    };

    if (options?.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API 错误: ${response.status} - ${error}`);
    }

    const data: GeminiResponse = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Gemini API 返回空响应");
    }

    return data.candidates[0].content.parts.map((p) => p.text).join("");
  }

  /**
   * 流式生成文本响应
   */
  async *streamGenerateContent(
    prompt: string,
    options?: {
      systemInstruction?: string;
      history?: Message[];
      generationConfig?: GenerationConfig;
    }
  ): AsyncGenerator<string, void, unknown> {
    const url = `${getGeminiApiUrl(this.config.model, "streamGenerateContent")}?key=${this.config.apiKey}&alt=sse`;

    const contents: Message[] = options?.history || [];
    contents.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.generationConfig?.temperature ?? this.config.temperature,
        maxOutputTokens: options?.generationConfig?.maxOutputTokens ?? this.config.maxTokens,
        ...options?.generationConfig,
      },
    };

    if (options?.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API 错误: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("无法读取响应流");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6);
          if (jsonStr.trim() === "[DONE]") continue;
          
          try {
            const data: GeminiResponse = JSON.parse(jsonStr);
            if (data.candidates?.[0]?.content?.parts) {
              for (const part of data.candidates[0].content.parts) {
                if (part.text) {
                  yield part.text;
                }
              }
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(options: Partial<GeminiConfig>): void {
    this.config = { ...this.config, ...options };
  }

  /**
   * 获取当前模型
   */
  getModel(): string {
    return this.config.model;
  }
}

// 导出单例工厂函数
let defaultClient: GeminiClient | null = null;

export function getGeminiClient(apiKey?: string): GeminiClient {
  if (!defaultClient && apiKey) {
    defaultClient = new GeminiClient(apiKey);
  }
  if (!defaultClient) {
    throw new Error("Gemini 客户端未初始化，请先提供 API Key");
  }
  return defaultClient;
}

export function initGeminiClient(apiKey: string, options?: Partial<Omit<GeminiConfig, "apiKey">>): GeminiClient {
  defaultClient = new GeminiClient(apiKey, options);
  return defaultClient;
}
