/**
 * EchoAI 首页
 * 从 Khoj 源码移植，提供 Agent 选择和建议卡片
 */

import { observer } from 'mobx-react-lite';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardBody, 
  Button, 
  Spinner,
  ScrollShadow,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { api } from '@/lib/trpc';
import { ChatInputArea } from '@/components/echoai/chatInputArea/chatInputArea';
import { AttachedFileText } from '@/components/echoai/common/chatFunctions';
import { ChatInputFocus } from '@/components/echoai/chatInputArea/chatInputArea';
import {
  StepOneSuggestionCard,
  StepTwoSuggestionCard,
  StepOneSuggestionRevertCard,
  stepOneSuggestions,
  getStepTwoSuggestions,
} from '@/components/echoai/suggestions';
import type { StepOneSuggestion, StepTwoSuggestion } from '@/components/echoai/suggestions';
import type { KhojAgent } from '@/components/echoai/agentCard';
import { getIconFromIconName } from '@/components/echoai/common/iconUtils';


// ============================================
// Agent 卡片组件
// ============================================

interface AgentCardProps {
  agent: KhojAgent;
  isSelected: boolean;
  onSelect: () => void;
}

function AgentSelectCard({ agent, isSelected, onSelect }: AgentCardProps) {
  const colorClass = agent.color ? `border-${agent.color}-500` : 'border-default-200';
  
  return (
    <Card
      isPressable
      className={`
        min-w-[120px] cursor-pointer transition-all
        ${isSelected ? colorClass + ' border-2' : 'border border-default-200 hover:border-default-400'}
      `}
      shadow="sm"
      onPress={onSelect}
    >
      <CardBody className="p-3 flex flex-row items-center gap-2">
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
          ${agent.color ? `bg-${agent.color}-500/20` : 'bg-default-100'}
        `}>
          {getIconFromIconName(agent.icon || 'Lightbulb', agent.color || 'orange', 'w-5', 'h-5')}
        </div>
        <span className="text-sm font-medium whitespace-nowrap">{agent.name}</span>
      </CardBody>
    </Card>
  );
}

// ============================================
// 主页面组件
// ============================================

const EchoAIHomePage = observer(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // 状态
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [greeting, setGreeting] = useState('');
  const [message, setMessage] = useState('');
  const [prefillMessage, setPrefillMessage] = useState('');
  const [chatInputFocus, setChatInputFocus] = useState<ChatInputFocus>(ChatInputFocus.MESSAGE);
  const [images, setImages] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<AttachedFileText[]>([]);
  const [processingMessage, setProcessingMessage] = useState(false);

  // Agent 状态
  const [agents, setAgents] = useState<KhojAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>('khoj');

  // 建议状态
  const [stepOneSuggestionOptions, setStepOneSuggestionOptions] = useState<StepOneSuggestion[]>(
    stepOneSuggestions.slice(0, 3)
  );
  const [stepTwoSuggestionOptions, setStepTwoSuggestionOptions] = useState<StepTwoSuggestion[]>([]);
  const [selectedStepOneSuggestion, setSelectedStepOneSuggestion] = useState<StepOneSuggestion | null>(null);

  // 检查服务状态
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await api.khoj.getStatus.query();
        setIsAvailable(status.success);
      } catch (err) {
        setIsAvailable(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkStatus();
  }, []);

  // 加载 Agent 列表
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const result = await api.khoj.getAgents.query();
        const validAgents = (result || []).filter(a => a !== null && a !== undefined);
        setAgents(validAgents);
        if (validAgents.length > 0) {
          setSelectedAgent(validAgents[0].slug);
        }
      } catch (err) {
        console.error('加载 Agent 列表失败:', err);
      }
    };
    if (isAvailable) {
      loadAgents();
    }
  }, [isAvailable]);

  // 生成问候语
  useEffect(() => {
    const today = new Date();
    const hour = today.getHours();
    const timeOfDay = hour >= 17 || hour < 4 ? '晚上' : hour >= 12 ? '下午' : '早上';
    
    const greetings = [
      `${timeOfDay}好！有什么我可以帮你的？`,
      '今天想做点什么？',
      '有什么问题需要我帮忙吗？',
      '准备好开始新的对话了吗？',
      '让我们一起探索新的想法吧！',
    ];
    
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
  }, []);

  // 显示所有建议
  const showAllSuggestions = useCallback(() => {
    setStepOneSuggestionOptions(stepOneSuggestions);
  }, []);

  // 点击第一步建议
  const handleStepOneSuggestionClick = useCallback((suggestion: StepOneSuggestion) => {
    setPrefillMessage(suggestion.intent);
    const stepTwoSuggestions = getStepTwoSuggestions(suggestion.type);
    setSelectedStepOneSuggestion(suggestion);
    setStepTwoSuggestionOptions(stepTwoSuggestions);
    setChatInputFocus(suggestion.focus);
  }, []);

  // 重置建议选择
  const handleRevertSuggestion = useCallback(() => {
    setPrefillMessage('');
    setSelectedStepOneSuggestion(null);
    setStepTwoSuggestionOptions([]);
    setChatInputFocus(ChatInputFocus.MESSAGE);
  }, []);

  // 发送消息
  const handleSendMessage = useCallback(async (msg: string) => {
    if (!msg.trim() && images.length === 0) return;
    
    setProcessingMessage(true);
    try {
      // 创建新对话
      const result = await api.khoj.createConversation.mutate({
        agentSlug: selectedAgent || undefined,
      });
      
      if (result.conversation_id) {
        // 存储消息到 localStorage，对话页面会读取
        localStorage.setItem('echoai_pending_message', msg);
        if (images.length > 0) {
          localStorage.setItem('echoai_pending_images', JSON.stringify(images));
        }
        if (uploadedFiles.length > 0) {
          localStorage.setItem('echoai_pending_files', JSON.stringify(uploadedFiles));
        }
        
        // 跳转到对话页面
        navigate(`/echoai?conversationId=${result.conversation_id}`);
      }
    } catch (error) {
      console.error('创建对话失败:', error);
      setProcessingMessage(false);
    }
  }, [selectedAgent, images, uploadedFiles, navigate]);

  // 发送图片
  const handleSendImage = useCallback((imageData: string) => {
    setImages(prev => [...prev, imageData]);
  }, []);

  // 点击第二步建议
  const handleStepTwoSuggestionClick = useCallback((suggestion: StepTwoSuggestion) => {
    handleSendMessage(suggestion.prompt);
  }, [handleSendMessage]);

  // 移动端检测
  const isMobileWidth = typeof window !== 'undefined' && window.innerWidth < 768;

  // 加载中
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  // 服务不可用
  if (!isAvailable) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md p-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-danger/10 flex items-center justify-center">
            <Icon icon="mdi:robot-dead-outline" className="w-12 h-12 text-danger/70" />
          </div>
          <h2 className="text-xl font-semibold mb-2">
            {t('echoai-service-disconnected')}
          </h2>
          <p className="text-foreground/60 mb-4">
            {t('echoai-not-connected')}
          </p>
          <Button
            color="primary"
            onPress={() => window.location.reload()}
            startContent={<Icon icon="solar:refresh-linear" className="w-4 h-4" />}
          >
            {t('retry-connection')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 主内容区 */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {/* 问候语 */}
        <h1 className="text-2xl md:text-3xl font-semibold text-center mb-6">
          {greeting}
        </h1>

        {/* Agent 选择器 - 桌面端 */}
        {!isMobileWidth && agents.length > 0 && (
          <ScrollShadow orientation="horizontal" className="w-full max-w-[600px] mb-6">
            <div className="flex gap-2 pb-2 justify-center">
              {agents.map((agent) => (
                <AgentSelectCard
                  key={agent.slug}
                  agent={agent}
                  isSelected={selectedAgent === agent.slug}
                  onSelect={() => {
                    setSelectedAgent(agent.slug);
                    chatInputRef.current?.focus();
                  }}
                />
              ))}
            </div>
          </ScrollShadow>
        )}

        {/* 输入框 - 桌面端 */}
        {!isMobileWidth && (
          <div className="w-full max-w-2xl mb-6">
            <div className="bg-background border border-default-200 rounded-2xl shadow-lg p-3">
              <ChatInputArea
                ref={chatInputRef}
                isLoggedIn={true}
                prefillMessage={prefillMessage}
                focus={chatInputFocus}
                sendMessage={handleSendMessage}
                sendImage={handleSendImage}
                sendDisabled={processingMessage}
                conversationId={null}
                isMobileWidth={isMobileWidth}
                setUploadedFiles={setUploadedFiles}
                agentColor={agents.find(a => a.slug === selectedAgent)?.color}
                setTriggeredAbort={() => {}}
              />
            </div>
          </div>
        )}

        {/* 第一步建议卡片 */}
        {stepTwoSuggestionOptions.length === 0 && (
          <div className={`w-full max-w-2xl grid ${isMobileWidth ? 'grid-cols-2' : 'grid-cols-3'} gap-3 px-2`}>
            {stepOneSuggestionOptions.map((suggestion) => (
              <div
                key={`${suggestion.type}-${suggestion.actionTagline}`}
                onClick={() => handleStepOneSuggestionClick(suggestion)}
              >
                <StepOneSuggestionCard
                  title={suggestion.type}
                  body={suggestion.actionTagline}
                  color={suggestion.color}
                />
              </div>
            ))}
          </div>
        )}

        {/* 显示更多建议按钮 */}
        {stepTwoSuggestionOptions.length === 0 && 
         stepOneSuggestionOptions.length < stepOneSuggestions.length && (
          <Button
            variant="bordered"
            size="sm"
            className="mt-4"
            onPress={showAllSuggestions}
            endContent={<Icon icon="mdi:chevron-down" className="w-4 h-4" />}
          >
            显示更多
          </Button>
        )}

        {/* 已选择的第一步建议 */}
        {selectedStepOneSuggestion && (
          <StepOneSuggestionRevertCard
            title={selectedStepOneSuggestion.type}
            body={selectedStepOneSuggestion.actionTagline}
            color={selectedStepOneSuggestion.color}
            onClick={handleRevertSuggestion}
          />
        )}

        {/* 第二步建议卡片 */}
        {stepTwoSuggestionOptions.length > 0 && (
          <div className="w-full max-w-2xl flex flex-col gap-2 px-2 mt-4">
            {stepTwoSuggestionOptions.map((suggestion, index) => (
              <div
                key={`${suggestion.prompt}-${index}`}
                onClick={() => handleStepTwoSuggestionClick(suggestion)}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <StepTwoSuggestionCard prompt={suggestion.prompt} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 输入框 - 移动端 */}
      {isMobileWidth && (
        <div className="p-4 border-t border-divider bg-background">
          {/* Agent 选择器 - 移动端 */}
          {agents.length > 0 && (
            <ScrollShadow orientation="horizontal" className="mb-3">
              <div className="flex gap-2">
                {agents.map((agent) => (
                  <AgentSelectCard
                    key={agent.slug}
                    agent={agent}
                    isSelected={selectedAgent === agent.slug}
                    onSelect={() => setSelectedAgent(agent.slug)}
                  />
                ))}
              </div>
            </ScrollShadow>
          )}
          
          <ChatInputArea
            ref={chatInputRef}
            isLoggedIn={true}
            prefillMessage={prefillMessage}
            focus={chatInputFocus}
            sendMessage={handleSendMessage}
            sendImage={handleSendImage}
            sendDisabled={processingMessage}
            conversationId={null}
            isMobileWidth={isMobileWidth}
            setUploadedFiles={setUploadedFiles}
            agentColor={agents.find(a => a.slug === selectedAgent)?.color}
            setTriggeredAbort={() => {}}
          />
        </div>
      )}
    </div>
  );
});

export default EchoAIHomePage;
