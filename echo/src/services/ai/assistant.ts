/**
 * AI 助手服务
 * 统一的 AI 服务接口，整合 Gemini API 和记忆系统
 */

import { getGeminiClient, type Message } from './gemini';
import { getMemoryContext, searchMemories, type MemorySearchResult } from '../memory';

// 助手配置
export interface AssistantConfig {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  useMemory?: boolean;
}

// 默认系统提示词
const DEFAULT_SYSTEM_PROMPT = `你是 Echo，一个智能个人助手。你的特点是：

1. **记忆能力** - 你能记住用户之前说过的话和做过的事
2. **主动关怀** - 你会主动提醒用户重要的事情，给出诚实的反馈
3. **多领域支持** - 你能帮助用户管理工作、投资、学习、家庭等多个生活领域

请用简洁、友好的方式回复用户。如果用户的问题涉及到之前的记忆，请参考提供的记忆上下文。`;

// 对话历史
let conversationHistory: Message[] = [];

/**
 * 发送消息给 AI 助手
 */
export async function chat(
  userMessage: string,
  config?: AssistantConfig
): Promise<string> {
  const client = getGeminiClient();
  
  // 获取记忆上下文
  let memoryContext = '';
  if (config?.useMemory !== false) {
    memoryContext = await getMemoryContext(userMessage);
  }

  // 构建系统提示词
  let systemPrompt = config?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  if (memoryContext) {
    systemPrompt += `\n\n${memoryContext}`;
  }

  // 添加用户消息到历史
  conversationHistory.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  try {
    const response = await client.generateContent(userMessage, {
      systemInstruction: systemPrompt,
      history: conversationHistory.slice(0, -1), // 不包含当前消息
      generationConfig: {
        temperature: config?.temperature ?? 0.7,
        maxOutputTokens: config?.maxTokens ?? 2048,
      },
    });

    // 添加助手回复到历史
    conversationHistory.push({
      role: 'model',
      parts: [{ text: response }],
    });

    // 限制历史长度
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }

    return response;
  } catch (error) {
    // 移除失败的用户消息
    conversationHistory.pop();
    throw error;
  }
}

/**
 * 流式发送消息给 AI 助手
 */
export async function* streamChat(
  userMessage: string,
  config?: AssistantConfig
): AsyncGenerator<string, void, unknown> {
  const client = getGeminiClient();
  
  // 获取记忆上下文
  let memoryContext = '';
  if (config?.useMemory !== false) {
    memoryContext = await getMemoryContext(userMessage);
  }

  // 构建系统提示词
  let systemPrompt = config?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  if (memoryContext) {
    systemPrompt += `\n\n${memoryContext}`;
  }

  // 添加用户消息到历史
  conversationHistory.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  let fullResponse = '';

  try {
    for await (const chunk of client.streamGenerateContent(userMessage, {
      systemInstruction: systemPrompt,
      history: conversationHistory.slice(0, -1),
      generationConfig: {
        temperature: config?.temperature ?? 0.7,
        maxOutputTokens: config?.maxTokens ?? 2048,
      },
    })) {
      fullResponse += chunk;
      yield chunk;
    }

    // 添加完整回复到历史
    conversationHistory.push({
      role: 'model',
      parts: [{ text: fullResponse }],
    });

    // 限制历史长度
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }
  } catch (error) {
    // 移除失败的用户消息
    conversationHistory.pop();
    throw error;
  }
}

/**
 * 清除对话历史
 */
export function clearHistory(): void {
  conversationHistory = [];
}

/**
 * 获取对话历史
 */
export function getHistory(): Message[] {
  return [...conversationHistory];
}

/**
 * 搜索相关记忆
 */
export async function findRelatedMemories(
  query: string,
  limit: number = 5
): Promise<MemorySearchResult[]> {
  return searchMemories(query, { limit });
}

/**
 * 分析文本中的行动项
 * 检测对话中的任务和笔记
 */
export async function extractActionItems(text: string): Promise<{
  tasks: { title: string; deadline?: string }[];
  notes: { content: string }[];
}> {
  const client = getGeminiClient();
  
  const prompt = `分析以下文本，提取其中的行动项：

文本：
${text}

请以 JSON 格式返回：
{
  "tasks": [
    {"title": "任务标题", "deadline": "截止日期（如果有）"}
  ],
  "notes": [
    {"content": "值得记录的想法或信息"}
  ]
}

如果没有行动项，返回空数组。只返回 JSON，不要其他内容。`;

  try {
    const response = await client.generateContent(prompt, {
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500,
      },
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { tasks: [], notes: [] };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('提取行动项失败:', error);
    return { tasks: [], notes: [] };
  }
}

/**
 * 生成决策支持分析
 */
export async function analyzeDecision(
  question: string,
  context?: string
): Promise<{
  pros: string[];
  cons: string[];
  recommendation: string;
}> {
  const client = getGeminiClient();
  
  // 获取相关记忆
  const memoryContext = await getMemoryContext(question);
  
  const prompt = `用户需要做一个决策：

问题：${question}
${context ? `背景：${context}` : ''}
${memoryContext ? `\n${memoryContext}` : ''}

请提供平衡的分析，以 JSON 格式返回：
{
  "pros": ["优点1", "优点2"],
  "cons": ["缺点1", "缺点2"],
  "recommendation": "综合建议（简洁）"
}

只返回 JSON，不要其他内容。`;

  try {
    const response = await client.generateContent(prompt, {
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 800,
      },
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        pros: [],
        cons: [],
        recommendation: '无法生成分析',
      };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('决策分析失败:', error);
    return {
      pros: [],
      cons: [],
      recommendation: '分析过程出错',
    };
  }
}
