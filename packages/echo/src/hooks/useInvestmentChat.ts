/**
 * Investment AI 对话状态管理 Hook
 * 
 * 复用 Echo AI 的接口风格，但调用 Investment Agent API
 * 支持上下文选择、引用追踪等投资专属功能
 * 
 * @module @echoai/hooks/useInvestmentChat
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/lib/trpc';
import { StreamMessage, Citation } from '@/components/echoai/chatHistory/chatHistory';
import { AgentData } from '@/components/echoai/chatMessage/chatMessage';

// ============================================
// 类型定义
// ============================================

/** 投资上下文类型 */
export type InvestmentContextType = 'report' | 'briefing' | 'portfolio' | 'general';

/** 投资对话 */
export interface InvestmentConversation {
  conversation_id: string;
  slug: string;
  created_at?: string;
  updated_at?: string;
}

/** 扩展的流式消息，包含引用 */
export interface InvestmentStreamMessage extends StreamMessage {
  contextType?: InvestmentContextType;
}

/** Hook 返回类型 */
export interface UseInvestmentChatReturn {
  // 状态
  conversations: InvestmentConversation[];
  currentConversationId: string | null;
  incomingMessages: InvestmentStreamMessage[];
  pendingMessage: string;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  title: string;
  agent: AgentData | null;
  isOwner: boolean;
  contextType: InvestmentContextType;
  
  // 操作
  loadConversations: () => Promise<void>;
  createConversation: () => Promise<string>;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (message: string, images?: string[]) => Promise<void>;
  retryMessage: (query: string, turnId?: string) => void;
  abortResponse: (newMessage?: string) => void;
  setTitle: (title: string) => void;
  setAgent: (agent: AgentData) => void;
  setIsOwner: (isOwner: boolean) => void;
  setContextType: (type: InvestmentContextType) => void;
  clearError: () => void;
}

// ============================================
// 常量
// ============================================

/** Investment Mirror Agent 配置 */
const INVESTMENT_AGENT: AgentData = {
  slug: 'investment-mirror',
  name: 'Investment Mirror',
  persona: '我是你的私人投资伙伴 (PIP)，作为批判性的、数据驱动的辩论伙伴，帮助你做出更好的投资决策。',
  color: 'amber',
  icon: 'mdi:chart-line',
  privacy_level: 'private',
  managed_by_admin: false,
  chat_model: 'gemini-2.0-flash',
  input_tools: ['portfolio', 'rag', 'notes'],
  output_modes: ['text', 'citations'],
};

// ============================================
// Hook 实现
// ============================================

export function useInvestmentChat(initialConversationId?: string): UseInvestmentChatReturn {
  // 对话列表
  const [conversations, setConversations] = useState<InvestmentConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(
    initialConversationId || null
  );
  
  // 消息状态
  const [incomingMessages, setIncomingMessages] = useState<InvestmentStreamMessage[]>([]);
  const [pendingMessage, setPendingMessage] = useState('');
  
  // UI 状态
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('新对话');
  const [agent] = useState<AgentData>(INVESTMENT_AGENT);
  const [isOwner, setIsOwner] = useState(true);
  const [contextType, setContextType] = useState<InvestmentContextType>('general');
  
  // 中断控制
  const abortControllerRef = useRef<AbortController | null>(null);

  // 加载对话列表 - 从 Investment DB
  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.investment.getConversations.query();
      
      if (data) {
        const mapped: InvestmentConversation[] = data.map((d: any) => ({
          conversation_id: String(d.id),
          slug: d.title || '新对话',
          created_at: d.created_at,
          updated_at: d.updated_at,
        }));
        setConversations(mapped);
      }
    } catch (err) {
      console.error('[useInvestmentChat] 加载对话列表失败:', err);
      setError('加载对话列表失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 创建新对话
  const createConversation = useCallback(async (): Promise<string> => {
    try {
      const conv = await api.investment.createConversation.mutate({
        title: '新对话',
      });
      
      if (!conv) {
        throw new Error('创建对话失败');
      }
      
      const conversationId = String(conv.id);
      
      setCurrentConversationId(conversationId);
      setIncomingMessages([]);
      setTitle('新对话');
      
      // 刷新对话列表
      await loadConversations();
      
      return conversationId;
    } catch (err) {
      console.error('[useInvestmentChat] 创建对话失败:', err);
      setError('创建对话失败');
      throw err;
    }
  }, [loadConversations]);

  // 切换对话
  const switchConversation = useCallback(async (id: string) => {
    setCurrentConversationId(id);
    setIncomingMessages([]);
    setPendingMessage('');
    setTitle('');
    
    // 加载对话消息
    try {
      const data = await api.investment.getMessages.query({ 
        conversationId: parseInt(id) 
      });
      
      if (data && data.length > 0) {
        // 转换为 StreamMessage 格式
        const messages: InvestmentStreamMessage[] = [];
        
        for (let i = 0; i < data.length; i++) {
          const msg = data[i];
          if (msg.role === 'user') {
            // 查找对应的 AI 回复
            const aiReply = data[i + 1];
            
            messages.push({
              rawResponse: aiReply?.content || '',
              trainOfThought: [],
              context: [],
              onlineContext: {},
              codeContext: {},
              completed: true,
              rawQuery: msg.content,
              timestamp: msg.created_at,
              turnId: `turn_${msg.id}`,
              citations: aiReply?.citations as Citation[] || [],
            });
            
            if (aiReply) i++; // 跳过已处理的 AI 回复
          }
        }
        
        setIncomingMessages(messages);
        
        // 设置标题
        if (messages.length > 0) {
          const firstQuery = messages[0].rawQuery;
          setTitle(firstQuery.slice(0, 30) + (firstQuery.length > 30 ? '...' : ''));
        }
      }
    } catch (err) {
      console.error('[useInvestmentChat] 加载消息失败:', err);
    }
  }, []);

  // 删除对话
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await api.investment.deleteConversation.mutate({ 
        conversationId: parseInt(id) 
      });
      
      // 如果删除的是当前对话，切换到其他对话
      if (id === currentConversationId) {
        const remaining = conversations.filter(c => c.conversation_id !== id);
        if (remaining.length > 0) {
          switchConversation(remaining[0].conversation_id);
        } else {
          setCurrentConversationId(null);
          setIncomingMessages([]);
        }
      }
      
      // 刷新对话列表
      await loadConversations();
    } catch (err) {
      console.error('[useInvestmentChat] 删除对话失败:', err);
      setError('删除对话失败');
    }
  }, [currentConversationId, conversations, switchConversation, loadConversations]);

  // 发送消息 - 调用 Investment Agent API
  const sendMessage = useCallback(async (message: string, images?: string[]) => {
    if (!message.trim()) return;
    
    let conversationId = currentConversationId;
    
    // 如果没有当前对话，先创建一个
    if (!conversationId) {
      try {
        conversationId = await createConversation();
      } catch {
        return;
      }
    }

    setIsSending(true);
    setPendingMessage(message);

    // 创建新的流式消息
    const turnId = `turn_${Date.now()}`;
    const newStreamMessage: InvestmentStreamMessage = {
      rawResponse: '',
      trainOfThought: [],
      context: [],
      onlineContext: {},
      codeContext: {},
      completed: false,
      rawQuery: message,
      timestamp: new Date().toISOString(),
      images: images,
      turnId,
      contextType,
      citations: [],
    };

    setIncomingMessages(prev => [...prev, newStreamMessage]);

    // 创建中断控制器
    abortControllerRef.current = new AbortController();

    try {
      // 调用 Investment Agent API
      const response = await api.investment.chat.mutate({
        conversationId: parseInt(conversationId),
        message,
        contextType,
        includeContext: true,
      });

      // 更新消息
      setIncomingMessages(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0) {
          updated[lastIndex] = {
            ...updated[lastIndex],
            rawResponse: response.message || '',
            completed: true,
            citations: response.citations || [],
          };
        }
        return updated;
      });

      // 更新标题（使用第一条消息）
      if (incomingMessages.length === 0) {
        const newTitle = message.slice(0, 30) + (message.length > 30 ? '...' : '');
        setTitle(newTitle);
      }

    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('[useInvestmentChat] 请求已中断');
      } else {
        console.error('[useInvestmentChat] 发送消息失败:', err);
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
      abortControllerRef.current = null;
    }
  }, [currentConversationId, contextType, createConversation, incomingMessages.length]);

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

  // 如果有初始对话 ID，加载该对话
  useEffect(() => {
    if (initialConversationId) {
      switchConversation(initialConversationId);
    }
  }, [initialConversationId, switchConversation]);

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
    contextType,
    
    // 操作
    loadConversations,
    createConversation,
    switchConversation,
    deleteConversation,
    sendMessage,
    retryMessage,
    abortResponse,
    setTitle,
    setAgent: () => {}, // Investment Agent 固定，不允许切换
    setIsOwner,
    setContextType,
    clearError,
  };
}

export default useInvestmentChat;
