/**
 * EchoAI 对话历史组件
 * 基于 Mastra Agent API，不再依赖 Khoj
 */

import { useRef, useEffect, useState } from 'react';
import { Button, ScrollShadow, Spinner } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import ChatMessage, { 
  SingleChatMessage, 
  AgentData, 
} from '../chatMessage/chatMessage';
import { getIconFromIconName } from '../common/iconUtils';
import { TrainOfThoughtComponent } from '../trainOfThought';

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
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const [incompleteIncomingMessageIndex, setIncompleteIncomingMessageIndex] = useState<number | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

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
  }, [props.incomingMessages, props.setTitle]);

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

  // 删除消息
  const handleDeleteMessage = (turnId?: string) => {
    if (!turnId) return;

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

  if (!props.conversationId && !props.publicConversationSlug) {
    return null;
  }

  const isMobileWidth = typeof window !== 'undefined' && window.innerWidth < 768;

  // 获取当前 Agent 信息（从最新消息中）
  const currentAgent = props.incomingMessages?.[0]?.agent;

  return (
    <div className="relative h-full">
      <ScrollShadow 
        ref={scrollAreaRef}
        className="h-[calc(100vh-200px)] overflow-y-auto px-4"
      >
        {/* 空状态提示 */}
        {(!props.incomingMessages || props.incomingMessages.length === 0) && !props.pendingMessage && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-4">
              <Icon icon="mdi:chat-outline" className="w-8 h-8 text-primary/70" />
            </div>
            <p className="text-foreground/60">开始新的对话吧</p>
          </div>
        )}

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
                borderLeftColor="border-l-primary-500"
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
                  agentColor={currentAgent?.color || 'orange'}
                  keyId={`${index}trainOfThought`}
                  completed={message.completed}
                />
              )}

              {/* AI 回复 */}
              {(message.rawResponse || !message.completed) && (
                <ChatMessage
                  isMobileWidth={isMobileWidth}
                  chatMessage={{
                    message: message.rawResponse,
                    context: message.context,
                    onlineContext: message.onlineContext as SingleChatMessage['onlineContext'],
                    codeContext: message.codeContext as SingleChatMessage['codeContext'],
                    created: message.timestamp,
                    by: 'khoj', // 保持兼容性，实际是 Mastra Agent
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
                  borderLeftColor="border-l-primary-500"
                  isLastMessage={index === props.incomingMessages!.length - 1}
                  agent={currentAgent}
                />
              )}

              {/* 加载中状态 */}
              {!message.completed && !message.rawResponse && (
                <div className="flex items-center gap-2 p-4 ml-4">
                  <Spinner size="sm" />
                  <span className="text-sm text-foreground/60">思考中...</span>
                </div>
              )}
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
            borderLeftColor="border-l-primary-500"
            isLastMessage={true}
          />
        )}

        {/* Agent 信息卡片 */}
        {currentAgent && (
          <div className="flex items-center gap-3 p-4 mt-4 bg-default-50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              {getIconFromIconName(currentAgent?.icon, currentAgent?.color) || (
                <Icon icon="mdi:robot" className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <p className="font-medium">{currentAgent.name || 'EchoAI'}</p>
              <p className="text-sm text-default-500 line-clamp-2">
                {currentAgent.persona || '智能助手'}
              </p>
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
