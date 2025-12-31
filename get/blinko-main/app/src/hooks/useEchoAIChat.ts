/**
 * EchoAI 对话状态管理 Hook
 * 管理消息列表、对话切换、流式响应
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/lib/trpc';
import { getEchoAIBaseUrl } from '@/lib/echoaiService';
import { 
  processMessageChunk, 
  createNewConversation,
  generateNewTitle,
  AttachedFileText,
  Context,
  OnlineContext,
  CodeContext,
} from '@/components/echoai/common/chatFunctions';
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

  // 加载对话列表
  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.khoj.getConversations.query();
      // 映射 API 返回的类型到本地类型
      const mapped: Conversation[] = (result || []).map((item: { id: string; title: string; created: string }) => ({
        conversation_id: item.id,
        slug: item.title,
        created_at: item.created,
      }));
      setConversations(mapped);
    } catch (err) {
      console.error('加载对话列表失败:', err);
      setError('加载对话列表失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 创建新对话
  const createConversation = useCallback(async (agentSlug?: string): Promise<string> => {
    try {
      const conversationId = await createNewConversation(agentSlug);
      setCurrentConversationId(conversationId);
      setIncomingMessages([]);
      setTitle('新对话');
      // 刷新对话列表
      await loadConversations();
      return conversationId;
    } catch (err) {
      console.error('创建对话失败:', err);
      setError('创建对话失败');
      throw err;
    }
  }, [loadConversations]);

  // 切换对话
  const switchConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    setIncomingMessages([]);
    setPendingMessage('');
    setTitle('');
  }, []);

  // 删除对话
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await api.khoj.deleteConversation.mutate({ id });
      // 如果删除的是当前对话，切换到其他对话
      if (id === currentConversationId) {
        const remaining = conversations.filter(c => c.conversation_id !== id);
        if (remaining.length > 0) {
          switchConversation(remaining[0].conversation_id);
        } else {
          setCurrentConversationId(null);
        }
      }
      // 刷新对话列表
      await loadConversations();
    } catch (err) {
      console.error('删除对话失败:', err);
      setError('删除对话失败');
    }
  }, [currentConversationId, conversations, loadConversations, switchConversation]);

  // 发送消息
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

    let context: Context[] = [];
    let onlineContext: OnlineContext = {};
    let codeContext: CodeContext = {};

    try {
      // 通过后端代理调用 Khoj API，避免 CORS 问题
      const response = await fetch(`/api/khoj/chat?stream=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: message,
          conversation_id: conversationId,
          ...(agent?.slug && { agent: agent.slug }),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          // 更新消息
          setIncomingMessages(prev => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            if (lastIndex >= 0) {
              // 类型转换以兼容 processMessageChunk
              const currentMsg = updated[lastIndex] as unknown as Parameters<typeof processMessageChunk>[1];
              const result = processMessageChunk(
                line,
                currentMsg,
                context,
                onlineContext,
                codeContext
              );
              context = result.context;
              onlineContext = result.onlineContext;
              codeContext = result.codeContext;
            }
            return [...updated];
          });
        }
      }

      // 处理剩余的 buffer
      if (buffer.trim()) {
        setIncomingMessages(prev => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (lastIndex >= 0) {
            // 类型转换以兼容 processMessageChunk
            const currentMsg = updated[lastIndex] as unknown as Parameters<typeof processMessageChunk>[1];
            processMessageChunk(buffer, currentMsg, context, onlineContext, codeContext);
          }
          return [...updated];
        });
      }

      // 标记完成
      setIncomingMessages(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0) {
          updated[lastIndex] = { ...updated[lastIndex], completed: true };
        }
        return updated;
      });

      // 生成标题
      if (conversationId && incomingMessages.length === 0) {
        generateNewTitle(conversationId, setTitle);
      }

    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('请求已中断');
      } else {
        console.error('发送消息失败:', err);
        setError('发送消息失败');
      }
    } finally {
      setIsSending(false);
      setPendingMessage('');
      pendingMessageRef.current = '';
      abortControllerRef.current = null;
    }
  }, [currentConversationId, agent, createConversation, incomingMessages.length]);

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
