/**
 * Khoj 对话历史组件
 * 从 Khoj 源码移植，适配 Blinko UI 组件
 */

import { useRef, useEffect, useState } from 'react';
import { Button, ScrollShadow, Spinner } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { getEchoAIBaseUrl } from '@/lib/echoaiService';
import ChatMessage, { 
  SingleChatMessage, 
  AgentData, 
} from '../chatMessage/chatMessage';
import { getIconFromIconName } from '../common/iconUtils';
import { TrainOfThoughtComponent } from '../trainOfThought';
import type { TrainOfThoughtObject } from '../trainOfThought';

// ============================================
// 类型定义
// ============================================

export interface StreamMessage {
  rawResponse: string;
  trainOfThought: string[];
  context: Array<{ compiled: string; file: string }>;
  onlineContext: Record<string, unknown>;
  codeContext: Record<string, unknown>;
  completed: boolean;
  rawQuery: string;
  timestamp: string;
  agent?: AgentData;
  images?: string[];
  intentType?: string;
  inferredQueries?: string[];
  turnId?: string;
  queryFiles?: Array<{ name: string; content: string }>;
  generatedFiles?: Array<{ name: string; content: string }>;
  generatedImages?: string[];
  generatedMermaidjsDiagram?: string;
}

export interface ChatHistoryData {
  chat: SingleChatMessage[];
  agent: AgentData;
  conversation_id: string;
  slug: string;
  is_owner: boolean;
}

interface ChatResponse {
  status: string;
  response: ChatHistoryData;
}

interface ChatHistoryProps {
  conversationId: string;
  setTitle: (title: string) => void;
  pendingMessage?: string;
  incomingMessages?: StreamMessage[];
  setIncomingMessages?: (incomingMessages: StreamMessage[]) => void;
  publicConversationSlug?: string;
  setAgent: (agent: AgentData) => void;
  customClassName?: string;
  setIsOwner?: (isOwner: boolean) => void;
  onRetryMessage?: (query: string, turnId?: string) => void;
}

// ============================================
// 主组件
// ============================================

export default function ChatHistory(props: ChatHistoryProps) {
  const [data, setData] = useState<ChatHistoryData | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const [incompleteIncomingMessageIndex, setIncompleteIncomingMessageIndex] = useState<number | null>(null);
  const [fetchingData, setFetchingData] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const latestUserMessageRef = useRef<HTMLDivElement | null>(null);
  const latestFetchedMessageRef = useRef<HTMLDivElement | null>(null);

  const fetchMessageCount = 10;

  // 检测是否接近底部
  useEffect(() => {
    const scrollEl = scrollAreaRef.current;
    if (!scrollEl) return;

    const detectIsNearBottom = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const bottomThreshold = 50;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      setIsNearBottom(distanceFromBottom <= bottomThreshold);
    };

    scrollEl.addEventListener('scroll', detectIsNearBottom);
    detectIsNearBottom();
    return () => scrollEl.removeEventListener('scroll', detectIsNearBottom);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (props.incomingMessages && props.incomingMessages.length > 0 && isNearBottom) {
      scrollToBottom(true);
    }
  }, [props.incomingMessages, isNearBottom]);

  // 首次加载后滚动到最新消息
  useEffect(() => {
    if (data && data.chat && data.chat.length > 0 && currentPage < 2) {
      requestAnimationFrame(() => {
        latestUserMessageRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }
  }, [data, currentPage]);

  // 无限滚动加载
  useEffect(() => {
    if (!hasMoreMessages || fetchingData) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreMessages) {
          setFetchingData(true);
          fetchMoreMessages(currentPage);
        }
      },
      { threshold: 1.0 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [hasMoreMessages, currentPage, fetchingData]);

  // 会话切换时重置状态
  useEffect(() => {
    setHasMoreMessages(true);
    setFetchingData(false);
    setCurrentPage(0);
    setData(null);
  }, [props.conversationId]);

  // 处理流式消息
  useEffect(() => {
    if (props.incomingMessages) {
      const lastMessage = props.incomingMessages[props.incomingMessages.length - 1];
      if (lastMessage && !lastMessage.completed) {
        setIncompleteIncomingMessageIndex(props.incomingMessages.length - 1);
        props.setTitle(lastMessage.rawQuery);
        if (lastMessage.turnId) {
          setCurrentTurnId(lastMessage.turnId);
        }
      }
    }
  }, [props.incomingMessages]);

  // 获取更多消息
  function fetchMoreMessages(page: number) {
    if (!hasMoreMessages || fetchingData) return;
    
    const nextPage = page + 1;
    const maxMessagesToFetch = nextPage * fetchMessageCount;
    const baseUrl = getEchoAIBaseUrl();
    let conversationFetchURL = '';

    if (props.conversationId) {
      conversationFetchURL = `${baseUrl}/api/chat/history?client=web&conversation_id=${encodeURIComponent(props.conversationId)}&n=${maxMessagesToFetch}`;
    } else if (props.publicConversationSlug) {
      conversationFetchURL = `${baseUrl}/api/chat/share/history?client=web&public_conversation_slug=${props.publicConversationSlug}&n=${maxMessagesToFetch}`;
    } else {
      return;
    }

    fetch(conversationFetchURL)
      .then((response) => response.json())
      .then((chatData: ChatResponse) => {
        props.setTitle(chatData.response.slug);
        props.setIsOwner?.(chatData?.response?.is_owner);
        
        if (chatData?.response?.chat?.length > 0) {
          setCurrentPage(Math.ceil(chatData.response.chat.length / fetchMessageCount));
          
          if (chatData.response.chat.length === data?.chat.length) {
            setHasMoreMessages(false);
            setFetchingData(false);
            return;
          }
          
          props.setAgent(chatData.response.agent);
          setData(chatData.response);
          setFetchingData(false);
          
          if (page === 0) {
            scrollToBottom(true);
          } else {
            adjustScrollPosition();
          }
        } else {
          if (chatData.response.agent && chatData.response.conversation_id) {
            props.setAgent(chatData.response.agent);
            setData({
              chat: [],
              agent: chatData.response.agent,
              conversation_id: chatData.response.conversation_id,
              slug: chatData.response.slug,
              is_owner: chatData.response.is_owner,
            });
          }
          setHasMoreMessages(false);
          setFetchingData(false);
        }
      })
      .catch((err) => {
        console.error(err);
        setFetchingData(false);
      });
  }

  // 滚动到底部
  const scrollToBottom = (instant: boolean = false) => {
    const scrollEl = scrollAreaRef.current;
    requestAnimationFrame(() => {
      scrollEl?.scrollTo({
        top: scrollEl.scrollHeight,
        behavior: instant ? 'auto' : 'smooth',
      });
    });
    if (instant) {
      setIsNearBottom(true);
    }
  };

  // 调整滚动位置
  const adjustScrollPosition = () => {
    const scrollEl = scrollAreaRef.current;
    requestAnimationFrame(() => {
      latestFetchedMessageRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      scrollEl?.scrollBy({ behavior: 'smooth', top: -150 });
    });
  };

  // 删除消息
  const handleDeleteMessage = (turnId?: string) => {
    if (!turnId) return;

    setData((prevData) => {
      if (!prevData) return prevData;
      return {
        ...prevData,
        chat: prevData.chat.filter((msg) => msg.turnId !== turnId),
      };
    });

    if (props.incomingMessages && props.setIncomingMessages) {
      props.setIncomingMessages(
        props.incomingMessages.filter((msg) => msg.turnId !== turnId)
      );
    }
  };

  // 重试消息
  const handleRetryMessage = (query: string, turnId?: string) => {
    if (!query) return;
    if (turnId) {
      handleDeleteMessage(turnId);
    }
    props.onRetryMessage?.(query, turnId);
  };

  // 构建 Agent 信息
  const constructAgentName = () => {
    if (!data?.agent?.name) return 'Khoj';
    return data.agent.name;
  };

  const constructAgentPersona = () => {
    if (!data?.agent) return '默认 AI 助手';
    return data.agent.persona || '智能助手';
  };

  if (!props.conversationId && !props.publicConversationSlug) {
    return null;
  }

  const isMobileWidth = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="relative h-full">
      <ScrollShadow 
        ref={scrollAreaRef}
        className="h-[calc(100vh-200px)] overflow-y-auto px-4"
      >
        {/* 加载更多触发器 */}
        <div ref={sentinelRef} className="h-1">
          {fetchingData && (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          )}
        </div>

        {/* 历史消息 */}
        {data?.chat?.map((chatMessage, index) => (
          <div key={`chatMessage-${index}`}>
            {chatMessage.trainOfThought && chatMessage.by === 'khoj' && (
              <TrainOfThoughtComponent
                trainOfThought={chatMessage.trainOfThought}
                lastMessage={false}
                agentColor={data?.agent?.color || 'orange'}
                keyId={`${index}trainOfThought`}
                completed={true}
              />
            )}
            <ChatMessage
              ref={
                index === data.chat.length - 2
                  ? latestUserMessageRef
                  : index === data.chat.length - (currentPage - 1) * fetchMessageCount
                    ? latestFetchedMessageRef
                    : null
              }
              isMobileWidth={isMobileWidth}
              chatMessage={chatMessage}
              borderLeftColor={`border-l-${data?.agent?.color || 'primary'}-500`}
              isLastMessage={index === data.chat.length - 1}
              onDeleteMessage={handleDeleteMessage}
              onRetryMessage={handleRetryMessage}
              conversationId={props.conversationId}
              agent={data?.agent}
            />
          </div>
        ))}

        {/* 流式消息 */}
        {props.incomingMessages?.map((message, index) => {
          const messageTurnId = message.turnId ?? currentTurnId ?? undefined;
          return (
            <div key={`incomingMessage${index}`}>
              {/* 用户消息 */}
              <ChatMessage
                isMobileWidth={isMobileWidth}
                chatMessage={{
                  message: message.rawQuery,
                  context: [],
                  onlineContext: {},
                  codeContext: {},
                  created: message.timestamp,
                  by: 'you',
                  automationId: '',
                  images: message.images,
                  conversationId: props.conversationId,
                  turnId: messageTurnId,
                  queryFiles: message.queryFiles,
                }}
                borderLeftColor={`border-l-${data?.agent?.color || 'primary'}-500`}
                onDeleteMessage={handleDeleteMessage}
                onRetryMessage={handleRetryMessage}
                conversationId={props.conversationId}
                turnId={messageTurnId}
              />

              {/* 思考过程 */}
              {message.trainOfThought && message.trainOfThought.length > 0 && (
                <TrainOfThoughtComponent
                  trainOfThought={message.trainOfThought}
                  lastMessage={index === incompleteIncomingMessageIndex}
                  agentColor={data?.agent?.color || 'orange'}
                  keyId={`${index}trainOfThought`}
                  completed={message.completed}
                />
              )}

              {/* AI 回复 */}
              <ChatMessage
                isMobileWidth={isMobileWidth}
                chatMessage={{
                  message: message.rawResponse,
                  context: message.context,
                  onlineContext: message.onlineContext as SingleChatMessage['onlineContext'],
                  codeContext: message.codeContext as SingleChatMessage['codeContext'],
                  created: message.timestamp,
                  by: 'khoj',
                  automationId: '',
                  rawQuery: message.rawQuery,
                  intent: {
                    type: message.intentType || '',
                    query: message.rawQuery,
                    'memory-type': '',
                    'inferred-queries': message.inferredQueries || [],
                  },
                  conversationId: props.conversationId,
                  images: message.generatedImages,
                  queryFiles: message.generatedFiles,
                  mermaidjsDiagram: message.generatedMermaidjsDiagram,
                  turnId: messageTurnId,
                }}
                conversationId={props.conversationId}
                turnId={messageTurnId}
                onDeleteMessage={handleDeleteMessage}
                onRetryMessage={handleRetryMessage}
                borderLeftColor={`border-l-${data?.agent?.color || 'primary'}-500`}
                isLastMessage={index === props.incomingMessages!.length - 1}
                agent={data?.agent}
              />
            </div>
          );
        })}

        {/* 待发送消息 */}
        {props.pendingMessage && (
          <ChatMessage
            isMobileWidth={isMobileWidth}
            chatMessage={{
              message: props.pendingMessage,
              context: [],
              onlineContext: {},
              codeContext: {},
              created: new Date().getTime().toString(),
              by: 'you',
              automationId: '',
              conversationId: props.conversationId,
              turnId: undefined,
            }}
            conversationId={props.conversationId}
            onDeleteMessage={handleDeleteMessage}
            onRetryMessage={handleRetryMessage}
            borderLeftColor={`border-l-${data?.agent?.color || 'primary'}-500`}
            isLastMessage={true}
          />
        )}

        {/* Agent 信息卡片 */}
        {data && (
          <div className="flex items-center gap-3 p-4 mt-4 bg-default-50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              {getIconFromIconName(data.agent?.icon, data.agent?.color) || (
                <Icon icon="mdi:robot" className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <p className="font-medium">{constructAgentName()}</p>
              <p className="text-sm text-default-500 line-clamp-2">{constructAgentPersona()}</p>
            </div>
          </div>
        )}
      </ScrollShadow>

      {/* 滚动到底部按钮 */}
      {!isNearBottom && (
        <Button
          isIconOnly
          className="absolute bottom-4 right-4 shadow-lg"
          onPress={() => scrollToBottom()}
        >
          <Icon icon="mdi:arrow-down" className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}
