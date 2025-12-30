/**
 * 统一对话服务
 * 整合 Khoj 和 Echo 原生 AI 能力，提供统一的对话接口
 * 
 * 支持三种对话模式：
 * - echo: 使用 Echo 原生 Gemini AI
 * - khoj: 使用 Khoj 知识库增强对话
 * - hybrid: 混合模式，优先 Khoj，失败回退 Echo
 */

import { getKhojClient, KhojClientError, isKhojClientInitialized } from '../khoj/khojClient';
import { getGeminiClient } from '../ai/gemini';
import { getMemoryContext } from '../memory';
import type { KhojAgent, KhojChatMessage } from '../../types/khoj';

// ============================================
// 类型定义
// ============================================

/**
 * 对话消息接口
 * 统一的消息格式，兼容 Khoj 和 Echo
 */
export interface ChatMessage {
  /** 消息唯一标识 */
  id: string;
  /** 消息角色 */
  role: 'user' | 'assistant' | 'system';
  /** 消息内容 */
  content: string;
  /** 引用来源（来自 Khoj 知识库） */
  sources?: string[];
  /** 消息时间戳 */
  timestamp: string;
}

/**
 * 对话模式类型
 * - echo: 使用 Echo 原生 Gemini AI
 * - khoj: 使用 Khoj 知识库增强对话
 * - hybrid: 混合模式，优先 Khoj，失败回退 Echo
 */
export type ChatMode = 'echo' | 'khoj' | 'hybrid';

/**
 * 发送消息选项
 */
export interface SendMessageOptions {
  /** 对话 ID（用于 Khoj 对话上下文） */
  conversationId?: string;
  /** 是否包含记忆上下文 */
  includeMemory?: boolean;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 历史消息（用于 Echo 模式） */
  history?: ChatMessage[];
}

/**
 * 对话响应
 */
export interface ChatResponse {
  /** 响应消息 */
  message: ChatMessage;
  /** 使用的模式 */
  mode: ChatMode;
  /** 是否为回退响应 */
  isFallback?: boolean;
}

// ============================================
// 工具函数
// ============================================

/**
 * 生成唯一消息 ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 获取当前时间戳
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 将 Khoj 消息转换为统一格式
 */
function khojMessageToChatMessage(khojMsg: KhojChatMessage): ChatMessage {
  return {
    id: generateMessageId(),
    role: khojMsg.role === 'khoj' ? 'assistant' : khojMsg.role,
    content: khojMsg.message,
    sources: khojMsg.context,
    timestamp: khojMsg.created || getCurrentTimestamp(),
  };
}

/**
 * 将统一消息转换为 Gemini 历史格式
 */
function chatMessagesToGeminiHistory(messages: ChatMessage[]): { role: 'user' | 'model'; parts: { text: string }[] }[] {
  return messages
    .filter(msg => msg.role !== 'system')
    .map(msg => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: msg.content }],
    }));
}

// ============================================
// 统一对话服务类
// ============================================

/**
 * 统一对话服务
 * 提供统一的对话接口，支持多种对话模式
 */
export class UnifiedChatService {
  /** 当前对话模式 */
  private mode: ChatMode = 'hybrid';
  
  /** 当前使用的 Agent（Khoj） */
  private currentAgent: string | null = null;

  /**
   * 设置对话模式
   * @param mode - 对话模式
   */
  setMode(mode: ChatMode): void {
    this.mode = mode;
    console.log(`对话模式已切换为: ${mode}`);
  }

  /**
   * 获取当前对话模式
   * @returns 当前模式
   */
  getMode(): ChatMode {
    return this.mode;
  }

  /**
   * 设置 Agent
   * @param agentSlug - Agent 标识符
   */
  setAgent(agentSlug: string | null): void {
    this.currentAgent = agentSlug;
    console.log(`当前 Agent: ${agentSlug || '默认'}`);
  }

  /**
   * 获取当前 Agent
   * @returns Agent 标识符
   */
  getAgent(): string | null {
    return this.currentAgent;
  }

  /**
   * 发送消息
   * 根据当前模式路由到对应的对话服务
   * @param message - 用户消息
   * @param options - 发送选项
   * @returns 对话响应
   */
  async sendMessage(message: string, options?: SendMessageOptions): Promise<ChatResponse> {
    switch (this.mode) {
      case 'echo':
        return this.chatWithEcho(message, options);
      
      case 'khoj':
        return this.chatWithKhoj(message, this.currentAgent, options);
      
      case 'hybrid':
      default:
        return this.chatHybrid(message, this.currentAgent, options);
    }
  }

  /**
   * 使用 Khoj 对话
   * 利用 Khoj 知识库增强的对话能力
   * @param message - 用户消息
   * @param agent - Agent 标识符（可选）
   * @param options - 发送选项
   * @returns 对话响应
   */
  async chatWithKhoj(
    message: string,
    agent?: string | null,
    options?: SendMessageOptions
  ): Promise<ChatResponse> {
    // 检查 Khoj 客户端是否已初始化
    if (!isKhojClientInitialized()) {
      throw new KhojClientError('Khoj 客户端未初始化');
    }

    const khojClient = getKhojClient();

    // 检查 Khoj 服务是否可用
    const isHealthy = await khojClient.healthCheck();
    if (!isHealthy) {
      throw new KhojClientError('Khoj 服务不可用');
    }

    // 调用 Khoj 对话 API
    const response = await khojClient.chat(message, {
      conversationId: options?.conversationId,
      agent: agent || undefined,
      stream: false,
    });

    // 处理响应
    const khojResponse = response as KhojChatMessage;
    const chatMessage = khojMessageToChatMessage(khojResponse);

    return {
      message: chatMessage,
      mode: 'khoj',
    };
  }

  /**
   * 使用 Echo 原生 AI 对话
   * 使用 Gemini API 进行对话
   * @param message - 用户消息
   * @param options - 发送选项
   * @returns 对话响应
   */
  async chatWithEcho(
    message: string,
    options?: SendMessageOptions
  ): Promise<ChatResponse> {
    const geminiClient = getGeminiClient();

    // 构建系统提示词
    let systemPrompt = options?.systemPrompt || 'You are Echo, a helpful AI assistant.';

    // 如果需要，添加记忆上下文
    if (options?.includeMemory !== false) {
      try {
        const memoryContext = await getMemoryContext(message);
        if (memoryContext) {
          systemPrompt += `\n\n${memoryContext}`;
        }
      } catch (error) {
        // 记忆获取失败不影响对话
        console.warn('获取记忆上下文失败:', error);
      }
    }

    // 转换历史消息格式
    const history = options?.history 
      ? chatMessagesToGeminiHistory(options.history)
      : undefined;

    // 调用 Gemini API
    const responseText = await geminiClient.generateContent(message, {
      systemInstruction: systemPrompt,
      history,
    });

    // 构建响应消息
    const chatMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: responseText,
      timestamp: getCurrentTimestamp(),
    };

    return {
      message: chatMessage,
      mode: 'echo',
    };
  }

  /**
   * 混合模式对话
   * 优先使用 Khoj，失败时回退到 Echo
   * @param message - 用户消息
   * @param agent - Agent 标识符（可选）
   * @param options - 发送选项
   * @returns 对话响应
   */
  async chatHybrid(
    message: string,
    agent?: string | null,
    options?: SendMessageOptions
  ): Promise<ChatResponse> {
    // 首先尝试 Khoj
    try {
      if (isKhojClientInitialized()) {
        const khojResponse = await this.chatWithKhoj(message, agent, options);
        return khojResponse;
      }
    } catch (error) {
      // Khoj 失败，记录警告并回退
      console.warn('Khoj 对话失败，回退到 Echo:', error);
    }

    // 回退到 Echo
    try {
      const echoResponse = await this.chatWithEcho(message, options);
      return {
        ...echoResponse,
        isFallback: true,
      };
    } catch (error) {
      // 两种模式都失败
      throw new Error(`对话失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取可用 Agent 列表
   * 从 Khoj 服务获取所有可用的 Agent
   * @returns Agent 列表
   */
  async getAvailableAgents(): Promise<KhojAgent[]> {
    // 检查 Khoj 客户端是否已初始化
    if (!isKhojClientInitialized()) {
      console.warn('Khoj 客户端未初始化，无法获取 Agent 列表');
      return [];
    }

    try {
      const khojClient = getKhojClient();
      
      // 检查服务是否可用
      const isHealthy = await khojClient.healthCheck();
      if (!isHealthy) {
        console.warn('Khoj 服务不可用，无法获取 Agent 列表');
        return [];
      }

      // 获取 Agent 列表
      const agents = await khojClient.getAgents();
      return agents;
    } catch (error) {
      console.error('获取 Agent 列表失败:', error);
      return [];
    }
  }

  /**
   * 检查 Khoj 服务是否可用
   * @returns 是否可用
   */
  async isKhojAvailable(): Promise<boolean> {
    if (!isKhojClientInitialized()) {
      return false;
    }

    try {
      const khojClient = getKhojClient();
      return await khojClient.healthCheck();
    } catch {
      return false;
    }
  }
}

// ============================================
// 单例导出
// ============================================

/** 统一对话服务单例实例 */
export const unifiedChatService = new UnifiedChatService();
