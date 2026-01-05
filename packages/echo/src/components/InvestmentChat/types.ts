/**
 * 投资镜像聊天组件类型定义
 * 
 * @module @echoai/components/InvestmentChat/types
 */

/**
 * 对话类型
 */
export interface Conversation {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 消息类型
 */
export interface Message {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  createdAt: string;
}

/**
 * 引用来源
 */
export interface Citation {
  source: string;
  title: string;
  content_snippet?: string;
  url?: string;
}

/**
 * 聊天上下文类型
 */
export type ChatContext = 'report' | 'briefing' | 'portfolio' | null;

/**
 * 上下文配置
 */
export interface ContextConfig {
  id: ChatContext;
  label: string;
  icon: string; // Iconify icon name
  color: string;
  description: string;
}

/**
 * 处理模式
 */
export type ProcessingMode = 'idle' | 'rag_only' | 'rag_agent' | 'full_agent';

/**
 * 处理进度
 */
export interface ProcessingProgress {
  progress: number;
  message: string;
  currentAgent?: string;
}
