/**
 * Khoj 对话 Hook
 * 提供 Khoj AI 对话的状态管理和 API 调用
 * 
 * 功能：
 * - 消息列表状态管理
 * - 当前对话 ID 管理
 * - 发送消息 (调用 api.khoj.chat)
 * - 加载对话历史 (调用 api.khoj.getConversation)
 * - 创建新对话
 * - 删除对话
 * - 加载状态和错误状态
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/lib/trpc';

// ============================================
// 类型定义
// ============================================

/**
 * 消息引用
 */
export interface MessageReference {
  file: string;
  compiled: string;
  heading?: string;
}

/**
 * 对话消息
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  references?: MessageReference[];
  isStreaming?: boolean;
}

/**
 * 对话信息
 */
export interface Conversation {
  id: string;
  title: string;
  created: Date;
  slug?: string;
}

/**
 * Hook 返回类型
 */
export interface UseKhojChatReturn {
  // 状态
  messages: Message[];
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  isServiceAvailable: boolean;
  
  // 操作
  sendMessage: (content: string) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  createNewConversation: () => void;
  deleteConversation: (conversationId: string) => Promise<void>;
  clearError: () => void;
  checkServiceStatus: () => Promise<boolean>;
}

// ============================================
// 工具函数
// ============================================

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 解析 Khoj 消息格式
 */
function parseKhojMessage(msg: any): Message {
  return {
    id: msg.turnId || generateId(),
    role: msg.by === 'khoj' ? 'assistant' : 'user',
    content: msg.message || '',
    timestamp: new Date(msg.created || Date.now()),
    references: msg.context?.map((ctx: any) => ({
      file: ctx.file,
      compiled: ctx.compiled,
      heading: ctx.heading,
    })),
  };
}

// ============================================
// Hook 实现
// ============================================

export function useKhojChat(): UseKhojChatReturn {
  // 状态
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isServiceAvailable, setIsServiceAvailable] = useState(true);
  
  // 用于防止重复请求
  const loadingRef = useRef(false);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * 检查服务状态
   */
  const checkServiceStatus = useCallback(async (): Promise<boolean> => {
    try {
      const status = await api.khoj.getStatus.query();
      const available = status.success;
      setIsServiceAvailable(available);
      if (!available) {
        setError(status.message || 'Khoj 服务不可用');
      }
      return available;
    } catch (err) {
      setIsServiceAvailable(false);
      setError('无法连接到 Khoj 服务');
      return false;
    }
  }, []);

  /**
   * 加载对话列表
   */
  const loadConversations = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    
    try {
      setIsLoading(true);
      clearError();
      
      const data = await api.khoj.getConversations.query();
      
      // 转换对话数据格式
      const parsedConversations: Conversation[] = (data || []).map((conv: any) => ({
        id: conv.conversation_id || conv.id,
        title: conv.slug || conv.title || '新对话',
        created: new Date(conv.created || Date.now()),
        slug: conv.slug,
      }));
      
      setConversations(parsedConversations);
    } catch (err: any) {
      console.error('加载对话列表失败:', err);
      // 如果是服务不可用错误，更新状态
      if (err.message?.includes('不可用') || err.message?.includes('SERVICE_UNAVAILABLE')) {
        setIsServiceAvailable(false);
      }
      setError(err.message || '加载对话列表失败');
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [clearError]);

  /**
   * 加载单个对话的消息历史
   */
  const loadConversation = useCallback(async (conversationId: string) => {
    if (!conversationId) return;
    
    try {
      setIsLoading(true);
      clearError();
      setCurrentConversationId(conversationId);
      
      const data = await api.khoj.getConversation.query({ id: conversationId });
      
      // 解析消息数据
      // Khoj 返回的格式可能是 { chat: [...], agent: {...} } 或直接是消息数组
      const chatMessages = Array.isArray(data) ? data : (data as any)?.chat || [];
      
      const parsedMessages: Message[] = chatMessages.map((msg: any) => parseKhojMessage(msg));
      
      setMessages(parsedMessages);
    } catch (err: any) {
      console.error('加载对话失败:', err);
      setError(err.message || '加载对话失败');
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [clearError]);

  /**
   * 创建新对话
   */
  const createNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
    clearError();
  }, [clearError]);

  /**
   * 删除对话
   */
  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      setIsLoading(true);
      clearError();
      
      await api.khoj.deleteConversation.mutate({ id: conversationId });
      
      // 从列表中移除
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      // 如果删除的是当前对话，清空消息
      if (currentConversationId === conversationId) {
        createNewConversation();
      }
    } catch (err: any) {
      console.error('删除对话失败:', err);
      setError(err.message || '删除对话失败');
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId, createNewConversation, clearError]);

  /**
   * 发送消息
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isSending) return;
    
    try {
      setIsSending(true);
      clearError();
      
      // 添加用户消息到列表
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      // 添加一个占位的 AI 消息（显示加载状态）
      const assistantMessageId = generateId();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // 调用 API
      const response = await api.khoj.chat.mutate({
        message: content.trim(),
        conversationId: currentConversationId || undefined,
      });
      
      // 更新 AI 消息
      const responseContent = typeof response === 'string' 
        ? response 
        : (response as any)?.response || (response as any)?.message || JSON.stringify(response);
      
      // 如果是新对话，更新对话 ID
      const newConversationId = (response as any)?.conversationId || (response as any)?.conversation_id;
      if (newConversationId && !currentConversationId) {
        setCurrentConversationId(newConversationId);
        // 刷新对话列表
        loadConversations();
      }
      
      // 更新消息内容
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { 
              ...msg, 
              content: responseContent,
              isStreaming: false,
              references: (response as any)?.context,
            }
          : msg
      ));
      
    } catch (err: any) {
      console.error('发送消息失败:', err);
      setError(err.message || '发送消息失败');
      
      // 移除占位消息
      setMessages(prev => prev.filter(msg => !msg.isStreaming));
    } finally {
      setIsSending(false);
    }
  }, [currentConversationId, isSending, clearError, loadConversations]);

  /**
   * 初始化时检查服务状态
   */
  useEffect(() => {
    checkServiceStatus();
  }, [checkServiceStatus]);

  return {
    // 状态
    messages,
    conversations,
    currentConversationId,
    isLoading,
    isSending,
    error,
    isServiceAvailable,
    
    // 操作
    sendMessage,
    loadConversation,
    loadConversations,
    createNewConversation,
    deleteConversation,
    clearError,
    checkServiceStatus,
  };
}

export default useKhojChat;
