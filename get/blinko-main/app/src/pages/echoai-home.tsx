/**
 * EchoAI 首页
 * 提供 Agent 选择和建议卡片，基于 Mastra AI 服务
 */

import { observer } from 'mobx-react-lite';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
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
import { getIconFromIconName } from '@/components/echoai/common/iconUtils';

// Agent 类型定义（从 Mastra agentManager 映射）
interface EchoAgent {
  id: number;
  slug: string;
  name: string;
  persona?: string | null;
  systemPrompt: string;
  tools: string[];
  privacy: 'public' | 'private';
  color?: string | null;
  icon?: string | null;
}


// ============================================
// Agent 卡片组件
// ============================================

interface AgentCardProps {
  agent: EchoAgent;
  isSelected: boolean;
  onSelect: () => void;
}

function AgentSelectCard({ agent, isSelected, onSelect }: AgentCardProps) {
  // 颜色映射 - 使用柔和的渐变色
  const colorStyles: Record<string, { bg: string; border: string; icon: string }> = {
    orange: { 
      bg: 'bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/40 dark:to-amber-900/40', 
      border: 'border-orange-300 dark:border-orange-700/60',
      icon: 'text-orange-600 dark:text-orange-400'
    },
    blue: { 
      bg: 'bg-gradient-to-br from-blue-100 to-sky-100 dark:from-blue-900/40 dark:to-sky-900/40', 
      border: 'border-blue-300 dark:border-blue-700/60',
      icon: 'text-blue-600 dark:text-blue-400'
    },
    green: { 
      bg: 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40', 
      border: 'border-green-300 dark:border-green-700/60',
      icon: 'text-green-600 dark:text-green-400'
    },
    purple: { 
      bg: 'bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/40 dark:to-violet-900/40', 
      border: 'border-purple-300 dark:border-purple-700/60',
      icon: 'text-purple-600 dark:text-purple-400'
    },
    red: { 
      bg: 'bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40', 
      border: 'border-red-300 dark:border-red-700/60',
      icon: 'text-red-600 dark:text-red-400'
    },
    teal: { 
      bg: 'bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/40 dark:to-cyan-900/40', 
      border: 'border-teal-300 dark:border-teal-700/60',
      icon: 'text-teal-600 dark:text-teal-400'
    },
  };
  
  const color = agent.color || 'orange';
  const style = colorStyles[color] || colorStyles.orange;
  
  return (
    <button
      onClick={onSelect}
      className={`
        group relative px-4 py-2.5 rounded-full
        flex items-center gap-2
        transition-all duration-200 ease-out
        border
        ${isSelected 
          ? `${style.bg} ${style.border} shadow-sm` 
          : 'bg-white/60 dark:bg-default-100/60 border-default-200 dark:border-default-300/20 hover:bg-default-100 dark:hover:bg-default-200/30'
        }
      `}
    >
      {/* 图标 */}
      <span className={`
        flex-shrink-0 transition-colors duration-200
        ${isSelected ? style.icon : 'text-default-400 group-hover:text-default-600'}
      `}>
        {getIconFromIconName(agent.icon || 'Lightbulb', isSelected ? color : 'gray', 'w-4', 'h-4')}
      </span>
      
      {/* 文字 */}
      <span className={`
        text-sm font-medium whitespace-nowrap transition-colors duration-200
        ${isSelected ? 'text-foreground' : 'text-default-500 group-hover:text-foreground'}
      `}>
        {agent.name}
      </span>
    </button>
  );
}

// ============================================
// 主页面组件
// ============================================

const EchoAIHomePage = observer(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // 状态 - Mastra 服务始终可用，无需检查
  const [greeting, setGreeting] = useState('');
  const [message, setMessage] = useState('');
  const [prefillMessage, setPrefillMessage] = useState('');
  const [chatInputFocus, setChatInputFocus] = useState<ChatInputFocus>(ChatInputFocus.MESSAGE);
  const [images, setImages] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<AttachedFileText[]>([]);
  const [processingMessage, setProcessingMessage] = useState(false);

  // Agent 状态
  const [agents, setAgents] = useState<EchoAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);

  // 建议状态
  const [stepOneSuggestionOptions, setStepOneSuggestionOptions] = useState<StepOneSuggestion[]>(
    stepOneSuggestions.slice(0, 3)
  );
  const [stepTwoSuggestionOptions, setStepTwoSuggestionOptions] = useState<StepTwoSuggestion[]>([]);
  const [selectedStepOneSuggestion, setSelectedStepOneSuggestion] = useState<StepOneSuggestion | null>(null);

  // 加载 Agent 列表 - 使用新的 Mastra API
  useEffect(() => {
    const loadAgents = async () => {
      setIsLoadingAgents(true);
      try {
        const result = await api.agent.getAgents.query();
        const validAgents = (result || []).filter(a => a !== null && a !== undefined);
        setAgents(validAgents);
        if (validAgents.length > 0) {
          setSelectedAgent(validAgents[0].slug);
        }
      } catch (err) {
        console.error('加载 Agent 列表失败:', err);
      } finally {
        setIsLoadingAgents(false);
      }
    };
    loadAgents();
  }, []);

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

  // 发送消息 - 使用新的 Mastra API
  const handleSendMessage = useCallback(async (msg: string) => {
    if (!msg.trim() && images.length === 0) return;
    
    setProcessingMessage(true);
    try {
      // 存储消息到 localStorage，对话页面会读取
      localStorage.setItem('echoai_pending_message', msg);
      if (images.length > 0) {
        localStorage.setItem('echoai_pending_images', JSON.stringify(images));
      }
      if (uploadedFiles.length > 0) {
        localStorage.setItem('echoai_pending_files', JSON.stringify(uploadedFiles));
      }
      if (selectedAgent) {
        localStorage.setItem('echoai_pending_agent', selectedAgent);
      }
      
      // 跳转到对话页面
      navigate('/echoai');
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
  if (isLoadingAgents) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
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
          <ScrollShadow orientation="horizontal" className="w-full max-w-3xl mb-6">
            <div className="flex gap-2 pb-2 justify-center flex-wrap">
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
                agentColor={agents.find(a => a.slug === selectedAgent)?.color ?? undefined}
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
            agentColor={agents.find(a => a.slug === selectedAgent)?.color ?? undefined}
            setTriggeredAbort={() => {}}
          />
        </div>
      )}
    </div>
  );
});

export default EchoAIHomePage;
