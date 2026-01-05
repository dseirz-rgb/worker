/**
 * 投资对话页面
 * 
 * 复用 Echo AI 的 UI 组件，调用 Investment Agent API
 * 支持上下文选择、引用显示等投资专属功能
 * 
 * @module @echoai/components/InvestmentChat/InvestmentChatPage
 */

import { useRef, useState, useCallback } from 'react';
import { 
  Button, 
  Spinner, 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem,
  Chip,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { useInvestmentChat, InvestmentContextType } from '@/hooks/useInvestmentChat';
import { ChatSidebar } from '@/components/echoai/ChatSidebar';
import ChatHistory from '@/components/echoai/chatHistory/chatHistory';
import { ChatInputArea } from '@/components/echoai/chatInputArea/chatInputArea';
import { AttachedFileText } from '@/components/echoai/common/chatFunctions';

// ============================================
// 上下文配置
// ============================================

interface ContextConfig {
  id: InvestmentContextType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

const CONTEXTS: ContextConfig[] = [
  { 
    id: 'report', 
    label: '今日研报', 
    icon: 'mdi:file-document-outline', 
    color: 'primary', 
    description: '基于最新生成的 AI 深度研报' 
  },
  { 
    id: 'briefing', 
    label: '每日简报', 
    icon: 'mdi:trending-up', 
    color: 'warning', 
    description: '基于今日账户盈亏与摘要' 
  },
  { 
    id: 'portfolio', 
    label: '我的持仓', 
    icon: 'mdi:chart-pie', 
    color: 'secondary', 
    description: '基于实时持仓与风险数据' 
  },
  { 
    id: 'general', 
    label: '通用对话', 
    icon: 'mdi:chat-outline', 
    color: 'default', 
    description: '不限定上下文的自由对话' 
  },
];

// ============================================
// 类型定义
// ============================================

interface InvestmentChatPageProps {
  initialConversationId?: string;
  showSidebar?: boolean;
}

// ============================================
// 组件
// ============================================

export function InvestmentChatPage({ 
  initialConversationId,
  showSidebar = true,
}: InvestmentChatPageProps) {
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  
  // 侧边栏状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // 上传文件状态
  const [, setUploadedFiles] = useState<AttachedFileText[]>([]);
  
  // 使用投资对话 Hook
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
    contextType,
    createConversation,
    switchConversation,
    deleteConversation,
    sendMessage,
    retryMessage,
    abortResponse,
    setTitle,
    setAgent,
    setIsOwner,
    setContextType,
    clearError,
  } = useInvestmentChat(initialConversationId);

  // 发送消息处理
  const handleSendMessage = useCallback((message: string) => {
    sendMessage(message, undefined);
    setUploadedFiles([]);
  }, [sendMessage]);

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
    await createConversation();
  }, [createConversation]);

  // 切换侧边栏
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  // 移动端检测
  const isMobileWidth = typeof window !== 'undefined' && window.innerWidth < 768;

  // 转换对话格式以适配 ChatSidebar
  const sidebarConversations = conversations.map(c => ({
    conversation_id: c.conversation_id,
    slug: c.slug,
    agent: agent || undefined,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));

  // 获取当前上下文配置
  const currentContext = CONTEXTS.find(c => c.id === contextType) || CONTEXTS[3];

  return (
    <div className="flex h-full">
      {/* 侧边栏 */}
      {showSidebar && !isMobileWidth && (
        <ChatSidebar
          conversations={sidebarConversations}
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
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
            
            {/* Agent 图标 */}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-orange-500/20">
              <Icon 
                icon="mdi:chart-line" 
                className="w-6 h-6 text-amber-500" 
              />
            </div>
            
            {/* 标题 */}
            <div>
              <h1 className="text-lg font-semibold line-clamp-1">
                {title || 'AI 投资镜子'}
              </h1>
              <p className="text-xs text-foreground/50">
                Investment Mirror
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 上下文选择器 */}
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="flat"
                  size="sm"
                  startContent={<Icon icon={currentContext.icon} className="w-4 h-4" />}
                  className="min-w-[120px]"
                >
                  {currentContext.label}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="选择对话上下文"
                selectionMode="single"
                selectedKeys={[contextType]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as InvestmentContextType;
                  setContextType(selected);
                }}
              >
                {CONTEXTS.map(ctx => (
                  <DropdownItem
                    key={ctx.id}
                    startContent={
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${ctx.color}/10`}>
                        <Icon icon={ctx.icon} className={`w-5 h-5 text-${ctx.color}`} />
                      </div>
                    }
                    description={ctx.description}
                  >
                    {ctx.label}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>

            {/* 状态指示 */}
            {isSending && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10">
                <Spinner size="sm" color="warning" />
                <span className="text-sm text-amber-500">分析中</span>
              </div>
            )}
            {!isSending && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-default-100">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-foreground/70">就绪</span>
              </div>
            )}
          </div>
        </div>

        {/* 当前上下文提示 */}
        {contextType !== 'general' && (
          <div className="px-4 py-2 bg-default-50 border-b border-divider">
            <Chip
              color={currentContext.color as any}
              variant="flat"
              size="sm"
              startContent={<Icon icon={currentContext.icon} className="w-3 h-3" />}
              onClose={() => setContextType('general')}
            >
              已引用: {currentContext.label}
            </Chip>
          </div>
        )}

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
            <WelcomeScreen 
              onSelectContext={setContextType}
              onSendMessage={handleSendMessage}
            />
          )}
        </div>

        {/* 输入区域 */}
        <div className="p-4 border-t border-divider">
          <ChatInputArea
            ref={chatInputRef}
            sendMessage={handleSendMessage}
            sendImage={handleSendImage}
            sendDisabled={isSending}
            setUploadedFiles={setUploadedFiles}
            conversationId={currentConversationId}
            isMobileWidth={isMobileWidth}
            isLoggedIn={true}
            agentColor="amber"
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
              conversations={sidebarConversations}
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

// ============================================
// 欢迎页面组件
// ============================================

interface WelcomeScreenProps {
  onSelectContext: (type: InvestmentContextType) => void;
  onSendMessage: (message: string) => void;
}

function WelcomeScreen({ onSelectContext, onSendMessage }: WelcomeScreenProps) {
  const quickQuestions = [
    { context: 'portfolio' as const, questions: ['分析我的持仓风险', '如何优化仓位配置？'] },
    { context: 'briefing' as const, questions: ['今天盈亏原因分析', '生成投资日记'] },
    { context: 'report' as const, questions: ['研报核心观点是什么？', '有哪些风险提示？'] },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="mb-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4">
          <Icon icon="mdi:chart-line" className="w-10 h-10 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold mb-2">AI 投资镜子</h2>
        <p className="text-foreground/60 text-sm max-w-md mx-auto">
          我是你的 AI 投资镜子。我可以结合你的{' '}
          <span className="text-amber-500">持仓</span>、
          <span className="text-orange-500">研报</span> 和{' '}
          <span className="text-yellow-500">笔记</span> 进行深度对话。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
        {CONTEXTS.slice(0, 3).map(ctx => (
          <div
            key={ctx.id}
            className="bg-content1/50 backdrop-blur-sm rounded-xl p-4 border border-divider hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => onSelectContext(ctx.id)}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 bg-${ctx.color}/10 rounded-lg`}>
                <Icon icon={ctx.icon} className={`text-xl text-${ctx.color}`} />
              </div>
              <h3 className="font-bold">{ctx.label}</h3>
            </div>
            <p className="text-xs text-foreground/50 mb-3">{ctx.description}</p>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.find(q => q.context === ctx.id)?.questions.map((q, i) => (
                <Chip 
                  key={i} 
                  size="sm" 
                  variant="flat"
                  className="cursor-pointer hover:bg-primary/20"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onSelectContext(ctx.id);
                    onSendMessage(q); 
                  }}
                >
                  {q}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default InvestmentChatPage;
