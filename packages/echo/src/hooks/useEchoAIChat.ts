/**
 * EchoAI 对话状态管理 Hook
 * 管理消息列表、对话切换、流式响应
 * 基于 Mastra AI 服务
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/lib/trpc';
import { AttachedFileText } from '@/components/echoai/common/chatFunctions';
import { StreamMessage } from '@/components/echoai/chatHistory/chatHistory';
import { AgentData } from '@/components/echoai/chatMessage/chatMessage';

// ============================================
// 类型定义
// ============================================

export interface Conversation {
  conversation_id: string;
  slug: string;
  agent?: AgentData;
  created_at?: string;
  updated_at?: string;
}

export interface UseEchoAIChatReturn {
  // 状态
  conversations: Conversation[];
  currentConversationId: string | null;
  incomingMessages: StreamMessage[];
  pendingMessage: string;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  title: string;
  agent: AgentData | null;
  isOwner: boolean;
  
  // 操作
  loadConversations: () => Promise<void>;
  createConversation: (agentSlug?: string) => Promise<string>;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (message: string, images?: string[], files?: AttachedFileText[]) => Promise<void>;
  retryMessage: (query: string, turnId?: string) => void;
  abortResponse: (newMessage?: string) => void;
  setTitle: (title: string) => void;
  setAgent: (agent: AgentData) => void;
  setIsOwner: (isOwner: boolean) => void;
  clearError: () => void;
}

// ============================================
// Hook 实现
// ============================================

export function useEchoAIChat(initialConversationId?: string): UseEchoAIChatReturn {
  // 对话列表
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(
    initialConversationId || null
  );
  
  // 消息状态
  const [incomingMessages, setIncomingMessages] = useState<StreamMessage[]>([]);
  const [pendingMessage, setPendingMessage] = useState('');
  
  // UI 状态
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('新对话');
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [isOwner, setIsOwner] = useState(true);
  
  // 中断控制
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingMessageRef = useRef<string>('');

  // 加载对话列表 - 使用本地存储（Mastra 不需要外部对话管理）
  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      // 从 localStorage 加载对话列表
      const savedConversations = localStorage.getItem('echoai_conversations');
      if (savedConversations) {
        setConversations(JSON.parse(savedConversations));
      }
    } catch (err) {
      console.error('加载对话列表失败:', err);
      setError('加载对话列表失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 创建新对话 - 本地生成 ID
  const createConversation = useCallback(async (_agentSlug?: string): Promise<string> => {
    try {
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const newConversation: Conversation = {
        conversation_id: conversationId,
        slug: '新对话',
        created_at: new Date().toISOString(),
      };
      
      setCurrentConversationId(conversationId);
      setIncomingMessages([]);
      setTitle('新对话');
      
      // 保存到 localStorage
      const updatedConversations = [newConversation, ...conversations];
      setConversations(updatedConversations);
      localStorage.setItem('echoai_conversations', JSON.stringify(updatedConversations));
      
      return conversationId;
    } catch (err) {
      console.error('创建对话失败:', err);
      setError('创建对话失败');
      throw err;
    }
  }, [conversations]);

  // 切换对话
  const switchConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    setIncomingMessages([]);
    setPendingMessage('');
    setTitle('');
  }, []);

  // 删除对话 - 本地删除
  const deleteConversation = useCallback(async (id: string) => {
    try {
      // 如果删除的是当前对话，切换到其他对话
      if (id === currentConversationId) {
        const remaining = conversations.filter(c => c.conversation_id !== id);
        if (remaining.length > 0) {
          switchConversation(remaining[0].conversation_id);
        } else {
          setCurrentConversationId(null);
        }
      }
      
      // 从 localStorage 删除
      const updatedConversations = conversations.filter(c => c.conversation_id !== id);
      setConversations(updatedConversations);
      localStorage.setItem('echoai_conversations', JSON.stringify(updatedConversations));
      
      // 删除对话消息
      localStorage.removeItem(`echoai_messages_${id}`);
    } catch (err) {
      console.error('删除对话失败:', err);
      setError('删除对话失败');
    }
  }, [currentConversationId, conversations, switchConversation]);

  // 发送消息 - 使用 Mastra Agent API
  const sendMessage = useCallback(async (
    message: string, 
    images?: string[], 
    files?: AttachedFileText[]
  ) => {
    if (!message.trim() && (!images || images.length === 0)) return;
    
    let conversationId = currentConversationId;
    
    // 如果没有当前对话，先创建一个
    if (!conversationId) {
      try {
        conversationId = await createConversation(agent?.slug);
      } catch {
        return;
      }
    }

    setIsSending(true);
    setPendingMessage(message);
    pendingMessageRef.current = message;

    // 创建新的流式消息
    const newStreamMessage: StreamMessage = {
      rawResponse: '',
      trainOfThought: [],
      context: [],
      onlineContext: {},
      codeContext: {},
      completed: false,
      rawQuery: message,
      timestamp: new Date().toISOString(),
      images: images,
      queryFiles: files?.map(f => ({ name: f.name, content: f.content })),
    };

    setIncomingMessages(prev => [...prev, newStreamMessage]);

    // 创建中断控制器
    abortControllerRef.current = new AbortController();

    try {
      // 使用 Mastra Agent API 进行对话
      const agentId = agent?.slug ? parseInt(agent.slug) || 1 : 1;
      
      // 构建消息历史
      const messages = [
        { role: 'user' as const, content: message }
      ];
      
      const response = await api.agent.chatWithAgent.mutate({
        agentId,
        messages,
      });

      // 更新消息 - AgentResponse 返回 { text: string }
      setIncomingMessages(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0) {
          updated[lastIndex] = {
            ...updated[lastIndex],
            rawResponse: response.text || '',
            completed: true,
          };
        }
        return updated;
      });

      // 生成标题（使用第一条消息）
      if (incomingMessages.length === 0) {
        const newTitle = message.slice(0, 30) + (message.length > 30 ? '...' : '');
        setTitle(newTitle);
        
        // 更新对话标题
        const updatedConversations = conversations.map(c => 
          c.conversation_id === conversationId 
            ? { ...c, slug: newTitle }
            : c
        );
        setConversations(updatedConversations);
        localStorage.setItem('echoai_conversations', JSON.stringify(updatedConversations));
      }

    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('请求已中断');
      } else {
        console.error('发送消息失败:', err);
        setError('发送消息失败');
        
        // 标记消息失败
        setIncomingMessages(prev => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (lastIndex >= 0) {
            updated[lastIndex] = {
              ...updated[lastIndex],
              rawResponse: '抱歉，发送消息失败，请重试。',
              completed: true,
            };
          }
          return updated;
        });
      }
    } finally {
      setIsSending(false);
      setPendingMessage('');
      pendingMessageRef.current = '';
      abortControllerRef.current = null;
    }
  }, [currentConversationId, agent, createConversation, incomingMessages.length, conversations]);

  // 重试消息
  const retryMessage = useCallback((query: string, turnId?: string) => {
    // 删除失败的消息
    if (turnId) {
      setIncomingMessages(prev => prev.filter(m => m.turnId !== turnId));
    }
    // 重新发送
    sendMessage(query);
  }, [sendMessage]);

  // 中断响应
  const abortResponse = useCallback((newMessage?: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsSending(false);
    
    // 如果有新消息，发送新消息
    if (newMessage) {
      setTimeout(() => sendMessage(newMessage), 100);
    }
  }, [sendMessage]);

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 初始化时加载对话列表
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    // 状态
    conversations,
    currentConversationId,
    incomingMessages,
    pendingMessage,
    isLoading,
    isSending,
    error,
    title,
    agent,
    isOwner,
    
    // 操作
    loadConversations,
    createConversation,
    switchConversation,
    deleteConversation,
    sendMessage,
    retryMessage,
    abortResponse,
    setTitle,
    setAgent,
    setIsOwner,
    clearError,
  };
}

export default useEchoAIChat;
