/**
 * Transcript Display Component
 * 
 * 增强的对话记录显示，具有更好的可读性和 AI 透明度
 * - 清晰区分用户和 AI 消息
 * - 高亮重点内容
 * - 显示 AI 思考过程（透明度）
 */

import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { User, Bot, Sparkles, AlertCircle, TrendingUp, TrendingDown, Info } from 'lucide-react';

export interface TranscriptItem {
  id: string;
  text: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  highlights?: string[];  // 重点内容
  sentiment?: 'positive' | 'negative' | 'neutral';  // 情感倾向
  confidence?: number;  // AI 置信度
  thinking?: string;  // AI 思考过程（透明度）
}

interface TranscriptDisplayProps {
  transcripts: TranscriptItem[];
  className?: string;
  showThinking?: boolean;  // 是否显示 AI 思考过程
  compact?: boolean;
}

// 提取并高亮关键词
const highlightKeywords = (text: string, highlights?: string[]): React.ReactNode => {
  if (!highlights || highlights.length === 0) return text;
  
  let result = text;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // 简单的关键词高亮
  highlights.forEach((keyword) => {
    const index = text.toLowerCase().indexOf(keyword.toLowerCase());
    if (index !== -1) {
      if (index > lastIndex) {
        parts.push(text.slice(lastIndex, index));
      }
      parts.push(
        <span key={keyword} className="text-cyan-300 font-medium bg-cyan-500/10 px-1 rounded">
          {text.slice(index, index + keyword.length)}
        </span>
      );
      lastIndex = index + keyword.length;
    }
  });
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
};

// 情感指示器
const SentimentIndicator: React.FC<{ sentiment?: 'positive' | 'negative' | 'neutral' }> = ({ sentiment }) => {
  if (!sentiment || sentiment === 'neutral') return null;
  
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-xs ml-2",
      sentiment === 'positive' ? "text-emerald-400" : "text-red-400"
    )}>
      {sentiment === 'positive' ? (
        <TrendingUp size={12} />
      ) : (
        <TrendingDown size={12} />
      )}
    </span>
  );
};

// 置信度指示器
const ConfidenceIndicator: React.FC<{ confidence?: number }> = ({ confidence }) => {
  if (confidence === undefined) return null;
  
  const level = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
  const colors = {
    high: 'bg-emerald-500',
    medium: 'bg-yellow-500',
    low: 'bg-orange-500'
  };
  
  return (
    <div className="flex items-center gap-1 text-xs text-white/40 mt-1">
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div 
            key={i}
            className={cn(
              "w-1 h-2 rounded-full",
              i < Math.ceil(confidence * 3) ? colors[level] : "bg-white/20"
            )}
          />
        ))}
      </div>
      <span>{Math.round(confidence * 100)}% 置信度</span>
    </div>
  );
};

// 单条消息组件
const TranscriptMessage: React.FC<{
  item: TranscriptItem;
  showThinking?: boolean;
  compact?: boolean;
}> = ({ item, showThinking, compact }) => {
  const isUser = item.role === 'user';
  
  return (
    <div className={cn(
      "flex gap-3",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* 头像 */}
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        isUser 
          ? "bg-emerald-500/20 text-emerald-400" 
          : "bg-cyan-500/20 text-cyan-400"
      )}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      
      {/* 消息内容 */}
      <div className={cn(
        "flex-1 max-w-[85%]",
        isUser ? "text-right" : "text-left"
      )}>
        {/* 角色标签 */}
        <div className={cn(
          "text-xs mb-1 flex items-center gap-1",
          isUser ? "justify-end text-emerald-400/70" : "justify-start text-cyan-400/70"
        )}>
          {isUser ? '你' : 'AI 顾问'}
          {!isUser && <Sparkles size={10} className="text-cyan-400/50" />}
          <SentimentIndicator sentiment={item.sentiment} />
        </div>
        
        {/* AI 思考过程（透明度） */}
        {!isUser && showThinking && item.thinking && (
          <div className="mb-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs text-purple-300/70">
            <div className="flex items-center gap-1 mb-1 text-purple-400/80">
              <Info size={10} />
              <span>思考过程</span>
            </div>
            <p className="italic">{item.thinking}</p>
          </div>
        )}
        
        {/* 消息气泡 */}
        <div className={cn(
          "inline-block px-4 py-2 rounded-2xl text-sm leading-relaxed",
          isUser 
            ? "bg-emerald-500/20 text-white/90 rounded-tr-sm" 
            : "bg-white/5 text-white/80 rounded-tl-sm border border-white/5"
        )}>
          {highlightKeywords(item.text, item.highlights)}
        </div>
        
        {/* AI 置信度 */}
        {!isUser && !compact && (
          <ConfidenceIndicator confidence={item.confidence} />
        )}
        
        {/* 时间戳 */}
        {!compact && (
          <div className="text-[10px] text-white/30 mt-1">
            {item.timestamp.toLocaleTimeString('zh-CN', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// 空状态
const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-8 text-white/30">
    <Bot size={32} className="mb-2 opacity-50" />
    <p className="text-sm">开始对话后，内容将显示在这里</p>
  </div>
);

export const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({
  transcripts,
  className,
  showThinking = true,
  compact = false
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  if (transcripts.length === 0) {
    return (
      <div className={cn("rounded-xl bg-white/5 p-4", className)}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div 
      ref={scrollRef}
      className={cn(
        "rounded-xl bg-white/5 backdrop-blur-sm overflow-y-auto",
        compact ? "p-3" : "p-4",
        className
      )}
    >
      <div className={cn("space-y-4", compact && "space-y-3")}>
        {transcripts.map((item) => (
          <TranscriptMessage 
            key={item.id} 
            item={item} 
            showThinking={showThinking}
            compact={compact}
          />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default TranscriptDisplay;
