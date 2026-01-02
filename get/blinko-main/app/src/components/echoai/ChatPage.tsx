/**
 * EchoAI 对话页面组件
 * 集成侧边栏、消息历史、输入区域、Agent 选择器
 * 基于 Mastra AI 服务
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Button, 
  Spinner, 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { useEchoAIChat } from '@/hooks/useEchoAIChat';
import { ChatSidebar } from './ChatSidebar';
import ChatHistory from './chatHistory/chatHistory';
import { ChatInputArea } from './chatInputArea/chatInputArea';
import { AttachedFileText } from './common/chatFunctions';
import { AgentData } from './chatMessage/chatMessage';
import { api } from '@/lib/trpc';
import { useNavigate } from 'react-router-dom';

// Agent 类型定义（从 Mastra agentManager 映射）
interface EchoAgent {
  id: number;
  slug: string;
  name: string;
  persona?: string | null;
  systemPrompt: string;
  tools: string[];
  privacy: 'public' | 'private';
  color?: string;
  icon?: string;
}

// ============================================
// 类型定义
// ============================================

interface ChatPageProps {
  initialConversationId?: string;
  showSidebar?: boolean;
}

// ============================================
// 组件
// ============================================

export function ChatPage({ 
  initialConversationId,
  showSidebar = true,
}: ChatPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  
  // 侧边栏状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // 上传文件状态
  const [uploadedFiles, setUploadedFiles] = useState<AttachedFileText[]>([]);
  
  // Agent 列表状态
  const [agents, setAgents] = useState<EchoAgent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  
  // 使用对话 Hook
  const {
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
  } = useEchoAIChat(initialConversationId);

  // 加载 Agent 列表 - 使用新的 Mastra API
  useEffect(() => {
    const loadAgents = async () => {
      setIsLoadingAgents(true);
      try {
        const result = await api.agent.getAgents.query();
        // 映射类型，处理 null -> undefined
        const mappedAgents: EchoAgent[] = (result || []).map(a => ({
          ...a,
          persona: a.persona ?? undefined,
        }));
        setAgents(mappedAgents);
      } catch (err) {
        console.error('加载 Agent 列表失败:', err);
      } finally {
        setIsLoadingAgents(false);
      }
    };
    loadAgents();
  }, []);

  // 选择 Agent
  const handleSelectAgent = useCallback(async (selectedAgent: EchoAgent | null) => {
    // 更新当前 Agent
    if (selectedAgent) {
      setAgent({
        slug: selectedAgent.slug,
        name: selectedAgent.name,
        persona: selectedAgent.persona || '',
        color: selectedAgent.color || 'blue',
        icon: selectedAgent.icon || 'mdi:robot-outline',
        privacy_level: selectedAgent.privacy || 'private',
        managed_by_admin: false,
        chat_model: '',
        input_tools: selectedAgent.tools || [],
        output_modes: [],
      });
    } else {
      setAgent(null as unknown as AgentData);
    }
    
    // 如果有当前对话，创建新对话使用新 Agent
    if (currentConversationId) {
      await createConversation(selectedAgent?.slug);
    }
  }, [setAgent, currentConversationId, createConversation]);

  // 发送消息处理
  const handleSendMessage = useCallback((message: string) => {
    sendMessage(message, undefined, uploadedFiles);
    setUploadedFiles([]);
  }, [sendMessage, uploadedFiles]);

  // 发送图片处理
  const handleSendImage = useCallback((imageData: string) => {
    sendMessage('', [imageData]);
  }, [sendMessage]);

  // 中断处理
  const handleAbort = useCallback((triggered: boolean, newMessage?: string) => {
    if (triggered) {
      abortResponse(newMessage);
    }
  }, [abortResponse]);

  // 重试消息
  const handleRetryMessage = useCallback((query: string, turnId?: string) => {
    retryMessage(query, turnId);
  }, [retryMessage]);

  // 新建对话
  const handleNewConversation = useCallback(async () => {
    await createConversation(agent?.slug);
  }, [createConversation, agent]);

  // 切换侧边栏
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  // 移动端检测
  const isMobileWidth = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="flex h-full bg-background">
      {/* 侧边栏 */}
      {showSidebar && !isMobileWidth && (
        <ChatSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          isLoading={isLoading}
          onNewConversation={handleNewConversation}
          onSwitchConversation={switchConversation}
          onDeleteConversation={deleteConversation}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-divider bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {/* 移动端菜单按钮 */}
            {isMobileWidth && showSidebar && (
              <Button
                isIconOnly
                variant="light"
                size="sm"
                onPress={toggleSidebar}
              >
                <Icon icon="mdi:menu" className="w-5 h-5" />
              </Button>
            )}
            
            {/* Agent 选择器 */}
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="light"
                  className="p-1 min-w-0 h-auto"
                >
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center
                    ${agent?.color 
                      ? `bg-${agent.color}-500/20` 
                      : 'bg-gradient-to-br from-purple-500 to-blue-500'
                    }
                  `}>
                    <Icon 
                      icon={agent?.icon || 'mdi:robot-outline'} 
                      className={`w-6 h-6 ${agent?.color ? `text-${agent.color}-500` : 'text-white'}`} 
                    />
                  </div>
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="选择 Agent"
                selectionMode="single"
                selectedKeys={agent?.slug ? [agent.slug] : ['default']}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  if (selected === 'default') {
                    handleSelectAgent(null);
                  } else {
                    const selectedAgent = agents.find(a => a.slug === selected);
                    if (selectedAgent) {
                      handleSelectAgent(selectedAgent);
                    }
                  }
                }}
                items={[
                  { key: 'default', name: 'EchoAI', description: '默认 AI 助手', isDefault: true, color: undefined, icon: undefined },
                  ...agents.map(a => ({ 
                    key: a.slug, 
                    name: a.name, 
                    description: a.persona?.slice(0, 50) || '',
                    color: a.color,
                    icon: a.icon,
                    isDefault: false,
                  }))
                ]}
              >
                {(item) => (
                  <DropdownItem
                    key={item.key}
                    startContent={
                      item.isDefault ? (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                          <Icon icon="mdi:robot-outline" className="w-5 h-5 text-white" />
                        </div>
                      ) : (
                        <div 
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            item.color ? `bg-${item.color}-500/20` : 'bg-default-100'
                          }`}
                        >
                          <Icon 
                            icon={item.icon || 'mdi:robot-outline'} 
                            className={`w-5 h-5 ${item.color ? `text-${item.color}-500` : ''}`} 
                          />
                        </div>
                      )
                    }
                    description={item.description}
                  >
                    {item.name}
                  </DropdownItem>
                )}
              </DropdownMenu>
            </Dropdown>
            
            {/* 标题 */}
            <div>
              <h1 className="text-lg font-semibold line-clamp-1">
                {title || t('new-conversation')}
              </h1>
              <p className="text-xs text-foreground/50">
                {agent?.name || 'EchoAI'}
              </p>
            </div>
          </div>

          {/* 状态指示 */}
          <div className="flex items-center gap-2">
            {/* 语音助手按钮 */}
            <Button
              isIconOnly
              variant="light"
              className="text-foreground/70 hover:text-primary"
              onPress={() => navigate('/voice-assistant')}
              title={t('voice-assistant')}
            >
              <Icon icon="mdi:microphone" className="w-5 h-5" />
            </Button>
            
            {isSending && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
                <Spinner size="sm" />
                <span className="text-sm text-primary">{t('thinking')}</span>
              </div>
            )}
            {!isSending && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-default-100">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-foreground/70">{t('connected')}</span>
              </div>
            )}
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mt-2 p-3 rounded-lg bg-danger/10 text-danger flex items-center justify-between">
            <span className="text-sm">{error}</span>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={clearError}
            >
              <Icon icon="mdi:close" className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* 消息区域 */}
        <div className="flex-1 overflow-hidden">
          {currentConversationId ? (
            <ChatHistory
              conversationId={currentConversationId}
              setTitle={setTitle}
              pendingMessage={pendingMessage}
              incomingMessages={incomingMessages}
              setIncomingMessages={() => {}}
              setAgent={setAgent}
              setIsOwner={setIsOwner}
              onRetryMessage={handleRetryMessage}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-6">
                <Icon icon="mdi:robot-outline" className="w-12 h-12 text-primary/70" />
              </div>
              <h2 className="text-xl font-semibold mb-2">{t('welcome-to-echoai')}</h2>
              <p className="text-foreground/60 mb-6 text-center max-w-md">
                {t('echoai-description')}
              </p>
              <Button
                color="primary"
                onPress={handleNewConversation}
                startContent={<Icon icon="mdi:plus" className="w-4 h-4" />}
              >
                {t('start-new-conversation')}
              </Button>
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div className="p-4 border-t border-divider bg-background/80 backdrop-blur-sm">
          <ChatInputArea
            ref={chatInputRef}
            sendMessage={handleSendMessage}
            sendImage={handleSendImage}
            sendDisabled={isSending}
            setUploadedFiles={setUploadedFiles}
            conversationId={currentConversationId}
            isMobileWidth={isMobileWidth}
            isLoggedIn={true}
            agentColor={agent?.color}
            setTriggeredAbort={handleAbort}
          />
        </div>
      </div>

      {/* 移动端侧边栏遮罩 */}
      {isMobileWidth && showSidebar && !sidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={toggleSidebar}
        >
          <div 
            className="absolute left-0 top-0 h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatSidebar
              conversations={conversations}
              currentConversationId={currentConversationId}
              isLoading={isLoading}
              onNewConversation={handleNewConversation}
              onSwitchConversation={(id) => {
                switchConversation(id);
                toggleSidebar();
              }}
              onDeleteConversation={deleteConversation}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatPage;
