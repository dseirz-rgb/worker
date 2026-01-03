/**
 * ChatWindow - Main chat interface with Unified Intelligence integration
 *
 * Integrates with the Unified Intelligence System for auto-classification
 * of queries and intelligent routing between RAG-only and multi-agent modes.
 *
 * @module components/chat/ChatWindow
 * @see {@link .kiro/specs/unified-intelligence/design.md}
 * @see Requirements 5.1, 5.2, 5.3, 5.4
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  User,
  Bot,
  Loader2,
  Sparkles,
  FileText,
  PieChart,
  TrendingUp,
  Plus,
  X,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getClient } from '../../services/supabaseData';
import { useSupabasePortfolio } from '../../hooks/useSupabasePortfolio';
import { useUnifiedIntelligence } from '../../hooks/useUnifiedIntelligence';
import type { Message } from '../../types';
import { Components } from 'react-markdown';
import { Card } from '../ui';
import { ProcessingIndicator } from './ProcessingIndicator';
import { AgentThinkingDisplay } from './AgentThinkingDisplay';
import type { ProcessingMode } from '../../services/unifiedIntelligence/types';

interface ChatWindowProps {
  conversationId: number | null;
  onConversationCreated: (id: number) => void;
}

// --- Context Types ---
type ChatContext = 'report' | 'briefing' | 'portfolio' | null;

interface ContextConfig {
  id: ChatContext;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const CONTEXTS: ContextConfig[] = [
  { id: 'report', label: '今日研报', icon: <FileText size={14} />, color: 'text-accent-cyan', description: '基于最新生成的 AI 深度研报' },
  { id: 'briefing', label: '每日简报', icon: <TrendingUp size={14} />, color: 'text-accent-yellow', description: '基于今日账户盈亏与摘要' },
  { id: 'portfolio', label: '我的持仓', icon: <PieChart size={14} />, color: 'text-accent-purple', description: '基于实时持仓与风险数据' },
];

// Custom text renderer for highlighting numbers
const TextRenderer: Components['p'] = ({ children }) => {
  const processText = (text: React.ReactNode): React.ReactNode => {
    if (typeof text !== 'string') return text;
    const parts = text.split(/(\d+(?:\.\d+)?%?|\$\d+(?:\.\d+)?)/g);
    return parts.map((part, index) => {
      if (/^(\d+(?:\.\d+)?%?|\$\d+(?:\.\d+)?)$/.test(part)) {
        return <span key={index} className="text-accent-yellow font-semibold mx-0.5 font-mono">{part}</span>;
      }
      return part;
    });
  };
  return <p>{React.Children.map(children, child => typeof child === 'string' ? processText(child) : child)}</p>;
};

export function ChatWindow({ conversationId, onConversationCreated }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("思考中...");
  const [error, setError] = useState<string | null>(null);
  const [activeContext, setActiveContext] = useState<ChatContext>(null);
  const [showContextSelector, setShowContextSelector] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{systemInstruction: string, contextPrompt: string} | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [questionSeed, setQuestionSeed] = useState(0);
  const [lastProcessingMode, setLastProcessingMode] = useState<ProcessingMode | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const newlyCreatedConvId = useRef<number | null>(null);

  const supabase = getClient();
  const { dashboard, stockPositions, riskMetrics } = useSupabasePortfolio();

  // Unified Intelligence Hook
  const {
    isProcessing: isUnifiedProcessing,
    mode: unifiedMode,
    progress,
    result: unifiedResult,
    agentResults,
    currentAgent,
    alerts,
    query: unifiedQuery,
    reset: resetUnified,
  } = useUnifiedIntelligence({
    autoClassify: true,
    enableProgress: true,
    onAlert: (alert) => {
      console.log('[Chat] Alert received:', alert);
    },
    onError: (err) => {
      setError(err.message);
      setIsLoading(false);
    },
  });

  // Update loading status based on unified intelligence progress
  useEffect(() => {
    if (progress) {
      const modeLabels: Record<string, string> = {
        'rag_only': 'RAG 检索中',
        'rag_agent': 'RAG + Agent 分析中',
        'full_agent': '多 Agent 深度分析中',
      };
      const modeLabel = modeLabels[unifiedMode] || '处理中';
      const agentLabel = progress.currentAgent ? ` - ${progress.message || progress.currentAgent}` : '';
      setLoadingStatus(`${modeLabel}${agentLabel} (${progress.progress}%)`);
    }
  }, [progress, unifiedMode]);

  // Load messages
  useEffect(() => {
    if (conversationId) {
      if (newlyCreatedConvId.current === conversationId) {
        newlyCreatedConvId.current = null;
        return;
      }
      loadMessages(conversationId);
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  // Check for deleverage strategy from simulator
  useEffect(() => {
    const storedPrompt = localStorage.getItem('deleverage_strategy_prompt');
    const storedTimestamp = localStorage.getItem('deleverage_strategy_timestamp');
    
    if (storedPrompt && storedTimestamp) {
      const timestamp = parseInt(storedTimestamp);
      const now = Date.now();
      if (now - timestamp < 30000) {
        localStorage.removeItem('deleverage_strategy_prompt');
        localStorage.removeItem('deleverage_strategy_timestamp');
        setActiveContext('portfolio');
        setTimeout(() => {
          handleSend(storedPrompt);
        }, 500);
      } else {
        localStorage.removeItem('deleverage_strategy_prompt');
        localStorage.removeItem('deleverage_strategy_timestamp');
      }
    }
  }, []);

  // Dynamic Questions Logic
  const questionTemplates = React.useMemo(() => {
    const topTicker = stockPositions?.[0]?.ticker || '核心持仓';
    const secondTicker = stockPositions?.[1]?.ticker || '股票';
    const dailyPnL = dashboard?.daily_pnl_percent || 0;
    const leverageRatio = (() => {
      if (dashboard?.leverage_ratio && Number(dashboard.leverage_ratio) > 1) {
        return Number(dashboard.leverage_ratio);
      }
      if (dashboard?.long_ratio && dashboard.long_ratio > 100) {
        return dashboard.long_ratio / 100;
      }
      return 1;
    })();
    const drawdown = dashboard?.drawdown_percent || 0;
    const cashRatio = dashboard?.cash_ratio || 0;
    const topWeight = stockPositions?.[0]?.weight_percent || 0;
    
    const leverageQuestions = leverageRatio > 1.8 
      ? [`杠杆率 ${leverageRatio.toFixed(2)}x 是否过高？`, "如何安全降杠杆？"]
      : ["当前杠杆水平是否合理？"];
    
    const drawdownQuestions = drawdown > 3
      ? [`回撤 ${drawdown.toFixed(1)}% 了，该止损吗？`, "如何控制进一步回撤？"]
      : [];
    
    return {
      report: [
        `解读研报中关于 ${topTicker} 的看法`,
        "研报里的核心风险提示是什么？",
        "根据研报，我该如何调整仓位？",
        "研报对宏观环境怎么看？",
        "这份研报给出了哪些具体操作建议？"
      ],
      briefing: [
        dailyPnL < -1 ? `今天亏了 ${Math.abs(dailyPnL).toFixed(1)}%，问题出在哪？` : 
        dailyPnL > 1 ? `今天赚了 ${dailyPnL.toFixed(1)}%，主要靠什么？` : 
        "今天市场波动不大，有什么值得关注的？",
        "生成一份今天的投资日记",
        `${topTicker} 今天表现如何？`,
        "今天有什么重要的市场新闻？",
        "相比昨天，风险敞口有变化吗？"
      ],
      portfolio: [
        topWeight > 25 ? `${topTicker} 占比 ${topWeight.toFixed(0)}%，是否过于集中？` : `分析 ${topTicker} 的持仓`,
        `如果 ${topTicker} 跌 15%，我会亏多少？`,
        ...leverageQuestions,
        ...drawdownQuestions,
        cashRatio < 5 ? "现金几乎为零，需要预留吗？" : `${cashRatio.toFixed(0)}% 现金是否太多？`,
        "我的持仓有哪些风险点？"
      ],
      general: [
        "当前市场处于什么阶段？",
        "现在适合加仓还是减仓？",
        "有什么被低估的投资机会？",
        "如何优化我的投资组合？",
        "最近有什么值得关注的宏观事件？",
        "帮我复盘本周的操作"
      ]
    };
  }, [stockPositions, dashboard]);

  const dynamicQuestions = React.useMemo(() => {
    const pool = activeContext ? questionTemplates[activeContext] : questionTemplates.general;
    return [...pool].sort(() => 0.5 - Math.random()).slice(0, 4);
  }, [activeContext, questionTemplates, questionSeed]);

  // Auto-scroll
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, activeContext]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  async function loadMessages(id: number) {
    if (!supabase) return;
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true });
    if (data) {
      setMessages(data.map(m => ({
        id: m.id, conversationId: m.conversation_id, role: m.role, content: m.content,
        citations: m.citations ? (typeof m.citations === 'string' ? JSON.parse(m.citations) : m.citations) : undefined, createdAt: m.created_at
      })));
    }
  }

  // Context Fetching Logic
  async function getContextContent(type: ChatContext): Promise<string> {
    if (!type) return '';
    
    try {
      if (type === 'report') {
        const { data } = await supabase!.from('ai_analyses').select('content, title, created_at').order('created_at', { ascending: false }).limit(1).single();
        if (!data) return "（系统提示：暂无今日研报数据）";
        return `
### 📎 引用上下文：今日 AI 研报
**标题**: ${data.title}
**生成时间**: ${new Date(data.created_at).toLocaleString()}
**内容摘要**:
${data.content.slice(0, 2000)}... (截取部分)
        `;
      }
      
      if (type === 'briefing') {
        return `
### 📎 引用上下文：每日简报数据
**日期**: ${new Date().toLocaleDateString()}
**总净值**: ¥${dashboard?.net_worth_cny?.toLocaleString() || 0}
**今日盈亏**: ¥${dashboard?.daily_pnl?.toLocaleString() || 0} (${dashboard?.daily_pnl_percent?.toFixed(2)}%)
**现金比例**: ${dashboard?.cash_ratio?.toFixed(2)}%
**最高水位线**: ¥${dashboard?.high_water_mark?.toLocaleString() || 0}
        `;
      }

      if (type === 'portfolio') {
        const positionsStr = stockPositions.map(p => 
          `- ${p.ticker} (${p.name || ''}): 权重 ${p.weight_percent?.toFixed(1)}%, 盈亏 ${p.unrealized_pnl_percent?.toFixed(1)}%`
        ).join('\n');
        
        return `
### 📎 引用上下文：实时持仓快照
**持仓列表**:
${positionsStr}
**风险指标**:
- 波动率: ${riskMetrics?.annualized_volatility ? (riskMetrics.annualized_volatility * 100).toFixed(2) + '%' : 'N/A'}
- 最大回撤: ${dashboard?.drawdown_percent?.toFixed(2)}%
        `;
      }
    } catch (e) {
      console.error("Failed to fetch context", e);
      return "（系统提示：获取上下文数据失败）";
    }
    return '';
  }

  async function handleSend(overrideContent?: string) {
    const contentToSend = overrideContent || input.trim();
    if (!contentToSend || isLoading || isUnifiedProcessing) return;
    if (!supabase) { setError('Database connection error'); return; }
    
    setInput('');
    setError(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    let currentConvId = conversationId;

    // 1. Create conversation if needed
    if (!currentConvId) {
      const title = contentToSend.slice(0, 30);
      const { data } = await supabase.from('conversations').insert({ user_id: 1, title }).select().single();
      if (data) {
        currentConvId = data.id;
        newlyCreatedConvId.current = data.id;
        onConversationCreated(data.id);
      } else {
        setError('Failed to create conversation');
        return;
      }
    }

    // 2. Prepare Context
    let contextPrompt = '';
    if (activeContext) {
      const contextData = await getContextContent(activeContext);
      if (contextData) {
        contextPrompt = `\n\n---\n${contextData}\n---\n请基于以上上下文回答用户问题。\n`;
      }
    }

    // 3. Save User Message
    const tempUserMsg: Message = {
      id: Date.now(), conversationId: currentConvId!, role: 'user', content: contentToSend, createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setIsLoading(true);
    setLoadingStatus("正在分析查询...");

    // Save to DB
    supabase.from('messages').insert({ conversation_id: currentConvId, role: 'user', content: contentToSend }).then();

    // 4. Create placeholder for AI response
    const tempAiMsgId = Date.now() + 1;
    setMessages(prev => [...prev, {
      id: tempAiMsgId, conversationId: currentConvId!, role: 'assistant', content: '', createdAt: new Date().toISOString()
    }]);

    try {
      // 5. Use Unified Intelligence System for query routing
      const queryWithContext = contextPrompt ? contentToSend + contextPrompt : contentToSend;
      
      // Build portfolio context if available
      const portfolioContext = (activeContext === 'portfolio' && stockPositions.length > 0) ? {
        positions: stockPositions.map(p => ({
          ticker: p.ticker,
          weight: p.weight_percent || 0,
          marketValue: p.market_value || 0,
          costBasis: (p.avg_cost || 0) * (p.quantity || 0),
          unrealizedPnL: p.unrealized_pnl || 0,
          market: p.market || 'US',
        })),
        totalValue: dashboard?.net_worth_cny || 0,
        cashBalance: dashboard?.cash_ratio ? (dashboard.net_worth_cny || 0) * (dashboard.cash_ratio / 100) : 0,
        marginLoan: dashboard?.margin_loan_cny || 0,
        highWaterMark: dashboard?.high_water_mark || 0,
        timestamp: Date.now(),
      } : undefined;

      setLoadingStatus("统一智能系统处理中...");
      
      // Call unified intelligence query
      await unifiedQuery(queryWithContext, {
        portfolio: portfolioContext,
        forceMode: undefined, // Let the system auto-classify
      });

    } catch (err) {
      console.error('[Chat] Unified query error:', err);
      setError('AI Error: ' + (err instanceof Error ? err.message : String(err)));
      setIsLoading(false);
    }
  }

  // Effect to handle unified intelligence results
  useEffect(() => {
    if (!unifiedResult || isUnifiedProcessing) return;

    const updateMessage = async () => {
      // Find the latest assistant message placeholder
      const latestAssistantMsg = messages.find(m => m.role === 'assistant' && m.content === '');
      if (!latestAssistantMsg) return;

      const responseText = unifiedResult.text;
      const citations = unifiedResult.citations || [];

      // Update message in state
      setMessages(prev => prev.map(m => 
        m.id === latestAssistantMsg.id 
          ? { ...m, content: responseText, citations } 
          : m
      ));

      // Save to database
      if (supabase && latestAssistantMsg.conversationId) {
        await supabase.from('messages').insert({
          conversation_id: latestAssistantMsg.conversationId,
          role: 'assistant',
          content: responseText,
          citations: citations.length > 0 ? JSON.stringify(citations) : undefined,
        });
      }

      // Update debug info
      setDebugInfo({
        systemInstruction: `处理模式: ${unifiedResult.mode}\n置信度: ${(unifiedResult.confidence * 100).toFixed(0)}%\n处理时间: ${unifiedResult.processingTime}ms`,
        contextPrompt: unifiedResult.agentResults 
          ? `Agent 分析结果:\n${unifiedResult.agentResults.map(r => `- ${r.agentId}: ${r.summary}`).join('\n')}`
          : '无 Agent 分析',
      });

      // Track the processing mode for display
      setLastProcessingMode(unifiedResult.mode);
      setIsLoading(false);
      resetUnified();
    };

    updateMessage();
  }, [unifiedResult, isUnifiedProcessing]);

  // --- UI Components ---

  const SuggestionChip = ({ text, onClick }: { text: string, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className="px-4 py-2 bg-bg-tertiary border border-border rounded-full text-xs text-text-secondary hover:bg-accent-cyan/10 hover:text-accent-cyan hover:border-accent-cyan/30 transition-all whitespace-nowrap snap-start shadow-sm"
    >
      {text}
    </button>
  );

  const DebugPanel = () => {
    if (!debugInfo) return null;
    return (
      <div className={`fixed inset-y-0 right-0 w-96 bg-bg-secondary border-l border-border shadow-2xl transform transition-transform z-50 overflow-y-auto ${showDebug ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-border flex items-center justify-between bg-bg-tertiary/50 backdrop-blur sticky top-0">
          <h3 className="font-bold text-accent-cyan flex items-center gap-2"><Lightbulb size={16} /> AI 思维透视</h3>
          <button onClick={() => setShowDebug(false)} className="p-1 hover:text-accent-red"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-6 text-xs font-mono">
          <div className="space-y-2">
            <div className="font-bold text-text-secondary uppercase tracking-wider">System Instruction (Persona)</div>
            <div className="p-3 bg-bg-tertiary rounded border border-border/50 text-text-muted whitespace-pre-wrap max-h-60 overflow-y-auto">
              {debugInfo.systemInstruction.split('### CONTEXT DATA')[0]}
            </div>
          </div>
          <div className="space-y-2">
            <div className="font-bold text-text-secondary uppercase tracking-wider">RAG Context (Injected Data)</div>
            <div className="p-3 bg-bg-tertiary rounded border border-border/50 text-accent-yellow whitespace-pre-wrap">
              {debugInfo.contextPrompt}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const WelcomeScreen = () => (
    <div className="flex flex-col items-center justify-center h-full px-4 overflow-y-auto">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-accent-cyan/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-slow">
          <Sparkles className="text-accent-cyan w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">下午好，投资者</h2>
        <p className="text-text-secondary text-sm max-w-md mx-auto">
          我是您的 AI 投资镜子。我可以结合您的 <span className="text-accent-cyan">持仓</span>、<span className="text-accent-yellow">研报</span> 和 <span className="text-accent-purple">笔记</span> 进行深度对话。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
        <Card className="p-4 hover:bg-bg-tertiary/50 transition-colors cursor-pointer group" onClick={() => setActiveContext('report')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-accent-cyan/10 rounded-lg text-accent-cyan group-hover:scale-110 transition-transform"><FileText size={20} /></div>
            <h3 className="font-bold text-text-primary">今日研报分析</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {questionTemplates.report.slice(0, 2).map((q, i) => (
              <span key={i} onClick={(e) => { e.stopPropagation(); handleSend(q); }} className="text-xs px-2 py-1 bg-bg-primary rounded text-text-muted hover:text-accent-cyan transition-colors">{q}</span>
            ))}
          </div>
        </Card>

        <Card className="p-4 hover:bg-bg-tertiary/50 transition-colors cursor-pointer group" onClick={() => setActiveContext('portfolio')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-accent-purple/10 rounded-lg text-accent-purple group-hover:scale-110 transition-transform"><PieChart size={20} /></div>
            <h3 className="font-bold text-text-primary">持仓风险诊断</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {questionTemplates.portfolio.slice(0, 2).map((q, i) => (
              <span key={i} onClick={(e) => { e.stopPropagation(); handleSend(q); }} className="text-xs px-2 py-1 bg-bg-primary rounded text-text-muted hover:text-accent-purple transition-colors">{q}</span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-safe-screen bg-bg-primary relative overflow-hidden overscroll-none touch-pan-y">
      <DebugPanel />
      
      {/* Header with Debug Toggle */}
      {messages.length > 0 && debugInfo && (
        <button 
          onClick={() => setShowDebug(true)}
          className="absolute top-4 right-4 z-20 p-2 text-text-tertiary hover:text-accent-cyan bg-bg-secondary/80 backdrop-blur rounded-lg border border-border/50 shadow-sm transition-all hover:scale-105"
          title="查看 AI 思考过程与上下文"
        >
          <Lightbulb size={16} />
        </button>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.length === 0 ? <WelcomeScreen /> : (
          messages.map((msg, index) => (
            <div key={msg.id || index} className={`flex gap-4 max-w-3xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                msg.role === 'user' ? 'bg-accent-cyan/20 text-accent-cyan' : 'bg-accent-yellow/20 text-accent-yellow'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user' ? 'bg-accent-cyan text-bg-primary font-medium rounded-tr-none' : 'bg-bg-secondary text-text-primary border border-border rounded-tl-none'
                }`}>
                  {msg.role === 'user' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: TextRenderer }}>{msg.content}</ReactMarkdown>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none 
                      text-gray-200 leading-relaxed
                      [&>h1]:text-accent-cyan [&>h1]:font-bold [&>h1]:mb-4 [&>h1]:mt-2
                      [&>h2]:text-accent-cyan/90 [&>h2]:font-bold [&>h2]:mb-3 [&>h2]:mt-6 [&>h2]:border-b [&>h2]:border-accent-cyan/20 [&>h2]:pb-2
                      [&>h3]:text-accent-cyan/80 [&>h3]:font-semibold [&>h3]:mb-2 [&>h3]:mt-4
                      [&>p>strong]:text-accent-yellow [&>p>strong]:font-bold
                      [&>li>strong]:text-accent-yellow [&>li>strong]:font-bold
                      [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1 [&>ul]:my-3
                      [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:space-y-1 [&>ol]:my-3
                      [&>li]:text-gray-300
                      [&>blockquote]:border-l-4 [&>blockquote]:border-accent-cyan/50 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-gray-400 [&>blockquote]:bg-bg-tertiary/30 [&>blockquote]:py-1 [&>blockquote]:my-4 [&>blockquote]:rounded-r
                      [&>pre]:bg-[#1e1e1e] [&>pre]:p-3 [&>pre]:rounded-md [&>pre]:border [&>pre]:border-white/10 [&>pre]:my-4 [&>pre]:overflow-x-auto
                      [&>code]:text-accent-yellow [&>code]:bg-white/10 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:font-mono [&>code]:text-xs
                      [&>p]:mb-4 last:[&>p]:mb-0
                    ">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: TextRenderer }}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 text-[10px] text-text-muted bg-bg-tertiary/50 p-2 rounded w-full border border-border/50">
                    <div className="font-medium mb-1 flex items-center gap-1 opacity-70"><Sparkles size={10} /> 参考来源</div>
                    <ul className="space-y-1 pl-3 list-disc opacity-70">{msg.citations.map((c, i) => (
                      <li key={i}>
                        <span className="text-accent-cyan/80">[{c.source}]</span> {c.title}
                      </li>
                    ))}</ul>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {/* Loading indicator with processing mode */}
        {(isLoading || isUnifiedProcessing) && (
          <div className="flex gap-4 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="w-8 h-8 rounded-full bg-accent-yellow/20 text-accent-yellow flex items-center justify-center flex-shrink-0 mt-1"><Bot size={16} /></div>
            <div className="flex flex-col gap-2">
              <div className="bg-bg-secondary border border-border rounded-2xl rounded-tl-none px-5 py-3 flex items-center gap-3 text-text-muted text-sm shadow-sm">
                <div className="relative flex items-center justify-center w-4 h-4">
                  <Loader2 size={16} className="animate-spin absolute" />
                  <div className="w-2 h-2 bg-accent-yellow rounded-full animate-ping absolute opacity-75"></div>
                </div>
                <span className="font-mono text-xs tracking-wide">{loadingStatus}</span>
              </div>
              
              {/* Processing mode indicator */}
              {unifiedMode !== 'idle' && (
                <ProcessingIndicator
                  mode={unifiedMode}
                  isProcessing={isUnifiedProcessing || isLoading}
                />
              )}
              
              {/* Agent thinking display for multi-agent mode - show during processing */}
              {(unifiedMode === 'rag_agent' || unifiedMode === 'full_agent') && (
                <AgentThinkingDisplay
                  progress={progress}
                  currentAgent={currentAgent}
                  agentResults={agentResults}
                  isProcessing={isUnifiedProcessing || isLoading}
                  defaultCollapsed={false}
                />
              )}
            </div>
          </div>
        )}
        
        {/* Show last processing mode badge after completion */}
        {!isLoading && !isUnifiedProcessing && lastProcessingMode && messages.length > 0 && (
          <div className="flex justify-center">
            <div className="text-xs text-text-tertiary bg-bg-tertiary/50 px-3 py-1 rounded-full">
              上次处理模式: {lastProcessingMode === 'rag_only' ? 'RAG 快速响应' : lastProcessingMode === 'rag_agent' ? 'RAG + Agent' : '多 Agent 深度分析'}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Input Area */}
      <div className="flex-none p-4 bg-bg-primary border-t border-border/50 z-10 w-full pb-safe">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          {/* Quick Actions / Suggestions */}
          {!isLoading && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mask-fade-sides">
              {/* Active Context Indicator */}
              {activeContext && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-cyan/10 border border-accent-cyan/30 rounded-full text-xs text-accent-cyan animate-in fade-in slide-in-from-bottom-2 shrink-0">
                  {CONTEXTS.find(c => c.id === activeContext)?.icon}
                  <span>已引用: {CONTEXTS.find(c => c.id === activeContext)?.label}</span>
                  <button onClick={() => setActiveContext(null)} className="hover:text-accent-red"><X size={12}/></button>
                </div>
              )}
              
              {/* Context Specific Questions */}
              {dynamicQuestions.map((q, i) => (
                <SuggestionChip key={i} text={q} onClick={() => handleSend(q)} />
              ))}
              
              {/* Refresh questions button */}
              <button
                onClick={() => setQuestionSeed(s => s + 1)}
                className="shrink-0 p-1.5 text-text-tertiary hover:text-accent-cyan hover:bg-accent-cyan/10 rounded-full transition-colors"
                title="换一批问题"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          )}

          {/* Input Bar */}
          <div className="relative bg-bg-secondary border border-border rounded-[24px] shadow-sm flex items-end p-2 transition-all focus-within:ring-2 focus-within:ring-accent-cyan/20 focus-within:border-accent-cyan/50">
            {/* Context Menu Button */}
            <div className="relative">
              <button 
                onClick={() => setShowContextSelector(!showContextSelector)}
                className={`p-2 rounded-full transition-colors mb-0.5 ${activeContext ? 'text-accent-cyan bg-accent-cyan/10' : 'text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary'}`}
              >
                <Plus size={20} className={`transition-transform ${showContextSelector ? 'rotate-45' : ''}`} />
              </button>
              
              {/* Context Selector Popup */}
              {showContextSelector && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowContextSelector(false)} />
                  <div className="absolute bottom-full left-0 mb-2 w-48 bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 origin-bottom-left z-50">
                    <div className="px-3 py-2 text-[10px] text-text-tertiary uppercase tracking-wider bg-bg-tertiary/50">选择对话上下文</div>
                    {CONTEXTS.map(ctx => (
                      <button
                        key={ctx.id}
                        onClick={() => { setActiveContext(ctx.id); setShowContextSelector(false); }}
                        className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-bg-tertiary transition-colors ${activeContext === ctx.id ? 'bg-accent-cyan/5' : ''}`}
                      >
                        <div className={`${ctx.color}`}>{ctx.icon}</div>
                        <div>
                          <div className={`font-medium ${activeContext === ctx.id ? ctx.color : 'text-text-primary'}`}>{ctx.label}</div>
                          <div className="text-[10px] text-text-muted">{ctx.description}</div>
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={() => { setActiveContext(null); setShowContextSelector(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-text-muted hover:text-text-primary hover:bg-bg-tertiary border-t border-border"
                    >
                      清除上下文
                    </button>
                  </div>
                </>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`; }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={activeContext ? `针对 ${CONTEXTS.find(c => c.id === activeContext)?.label} 提问...` : "问点什么..."}
              className="flex-1 bg-transparent border-none text-text-primary px-3 py-2.5 text-sm focus:outline-none resize-none min-h-[44px] max-h-[150px]"
              rows={1}
            />
            
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className={`p-2 rounded-full mb-0.5 transition-all ${input.trim() ? 'bg-accent-cyan text-bg-primary shadow-lg hover:scale-105' : 'bg-bg-tertiary text-text-muted'}`}
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
