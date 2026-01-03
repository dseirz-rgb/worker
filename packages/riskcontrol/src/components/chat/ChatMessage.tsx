/**
 * ChatMessage - 增强版聊天消息组件
 *
 * 基于: https://github.com/khoj-ai/khoj
 * 改动: 1. 替换 @phosphor-icons/react → lucide-react
 *       2. 添加 KaTeX 数学公式支持
 *       3. 添加代码块复制按钮
 *       4. 添加反馈按钮
 *       5. 适配 Tailwind 4.x 样式
 *       6. 集成 RiskControl 主题系统
 *
 * @module components/chat/ChatMessage
 * @license AGPL-3.0 (继承自 Khoj)
 */

'use client';

import React, { useEffect, useRef, useState, forwardRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';

import {
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  User,
  Bot,
  Trash2,
  RotateCcw,
  Volume2,
  VolumeX,
  Brain,
  Cloud,
  Folder,
  Book,
  Search,
  Aperture,
  Palette,
  Code,
  Shapes,
  Globe,
  Wrench,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AttachedFileText } from './EnhancedChatInput';

// --- Types ---
export interface Citation {
  source: string;
  title: string;
  url?: string;
}

export interface TrainOfThoughtObject {
  type: string;
  data: string;
}

export interface ChatMessageData {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  citations?: Citation[];
  trainOfThought?: TrainOfThoughtObject[];
  images?: string[];
  queryFiles?: AttachedFileText[];
}

interface ChatMessageProps {
  message: ChatMessageData;
  isMobileWidth?: boolean;
  isLastMessage?: boolean;
  accentColor?: string;
  onDelete?: (id: number | string) => void;
  onRetry?: (content: string, id: number | string) => void;
  onFeedback?: (id: number | string, sentiment: 'positive' | 'negative') => void;
}

// --- Helper Functions ---
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60e3) return '刚刚';
  if (diff < 3600e3) return `${Math.round(diff / 60e3)} 分钟前`;
  if (diff < 86400e3) return `${Math.round(diff / 3600e3)} 小时前`;
  if (diff < 604800e3) return `${Math.round(diff / 86400e3)} 天前`;

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// --- Sub Components ---

/** 反馈按钮组件 */
function FeedbackButtons({
  messageId,
  onFeedback,
}: {
  messageId: number | string;
  onFeedback?: (id: number | string, sentiment: 'positive' | 'negative') => void;
}) {
  const [feedbackState, setFeedbackState] = useState<'positive' | 'negative' | null>(null);

  useEffect(() => {
    if (feedbackState !== null) {
      const timer = setTimeout(() => setFeedbackState(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [feedbackState]);

  const handleFeedback = (sentiment: 'positive' | 'negative') => {
    setFeedbackState(sentiment);
    onFeedback?.(messageId, sentiment);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-text-muted hover:text-emerald-500"
        disabled={feedbackState !== null}
        onClick={() => handleFeedback('positive')}
      >
        {feedbackState === 'positive' ? (
          <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" fill="currentColor" />
        ) : (
          <ThumbsUp className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-text-muted hover:text-red-500"
        disabled={feedbackState !== null}
        onClick={() => handleFeedback('negative')}
      >
        {feedbackState === 'negative' ? (
          <ThumbsDown className="h-3.5 w-3.5 text-red-500" fill="currentColor" />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

/** 思考过程图标选择 */
function chooseIconFromHeader(header: string) {
  const h = header.toLowerCase();
  const iconClass = 'h-3.5 w-3.5';

  if (h.includes('understanding') || h.includes('理解')) return <Brain className={iconClass} />;
  if (h.includes('generating') || h.includes('生成')) return <Cloud className={iconClass} />;
  if (h.includes('tools') || h.includes('工具')) return <Wrench className={iconClass} />;
  if (h.includes('notes') || h.includes('documents') || h.includes('文档'))
    return <Folder className={iconClass} />;
  if (h.includes('browsing') || h.includes('浏览')) return <Book className={iconClass} />;
  if (h.includes('search') || h.includes('搜索')) return <Search className={iconClass} />;
  if (h.includes('summary') || h.includes('总结')) return <Aperture className={iconClass} />;
  if (h.includes('diagram') || h.includes('图表')) return <Shapes className={iconClass} />;
  if (h.includes('paint') || h.includes('绘制')) return <Palette className={iconClass} />;
  if (h.includes('code') || h.includes('代码')) return <Code className={iconClass} />;
  if (h.includes('operating') || h.includes('网页')) return <Globe className={iconClass} />;

  return <Brain className={iconClass} />;
}

/** 思考过程显示组件 */
export function TrainOfThought({
  message,
  isPrimary = false,
  accentColor = 'purple',
}: {
  message: string;
  isPrimary?: boolean;
  accentColor?: string;
}) {
  // 解析 **header**: content 格式
  const headerMatch = message.match(/\*\*(.*?)\*\*/);
  const header = headerMatch ? headerMatch[1] : '';
  const icon = chooseIconFromHeader(header);

  // 清理 markdown
  const cleanMessage = DOMPurify.sanitize(message);

  return (
    <div
      className={cn(
        'flex items-start gap-2 text-xs',
        isPrimary ? 'text-text-secondary' : 'text-text-muted'
      )}
    >
      <span className={cn('mt-0.5', isPrimary ? `text-accent-${accentColor}` : 'text-text-tertiary')}>
        {icon}
      </span>
      <div
        className="flex-1 break-words [&>p]:mb-1 [&>strong]:font-medium"
        dangerouslySetInnerHTML={{ __html: cleanMessage }}
      />
    </div>
  );
}

/** 代码块复制按钮 */
function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute top-2 right-2 h-7 w-7 bg-bg-tertiary/80 hover:bg-bg-tertiary"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

// --- Main Component ---
export const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
  ({ message, isMobileWidth = false, isLastMessage = false, accentColor = 'cyan', onDelete, onRetry, onFeedback }, ref) => {
    const [copySuccess, setCopySuccess] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const messageRef = useRef<HTMLDivElement>(null);

    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';

    // 复制消息内容
    const handleCopy = async () => {
      await navigator.clipboard.writeText(message.content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    };

    // 自定义 Markdown 组件
    const markdownComponents = {
      // 代码块
      code({ inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '');
        const codeString = String(children).replace(/\n$/, '');

        if (!inline && match) {
          return (
            <div className="relative group my-3">
              <div className="absolute top-0 left-0 px-2 py-1 text-[10px] text-text-muted bg-bg-tertiary rounded-tl rounded-br">
                {match[1]}
              </div>
              <pre className="bg-[#1e1e1e] p-4 pt-8 rounded-lg overflow-x-auto border border-white/10">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <CodeCopyButton code={codeString} />
              </div>
            </div>
          );
        }

        return (
          <code
            className="px-1.5 py-0.5 bg-white/10 rounded text-accent-yellow font-mono text-xs"
            {...props}
          >
            {children}
          </code>
        );
      },
      // 段落 - 数字高亮
      p({ children }: any) {
        const processText = (text: React.ReactNode): React.ReactNode => {
          if (typeof text !== 'string') return text;
          const parts = text.split(/(\d+(?:\.\d+)?%?|\$\d+(?:,\d{3})*(?:\.\d+)?)/g);
          return parts.map((part, index) => {
            if (/^(\d+(?:\.\d+)?%?|\$\d+(?:,\d{3})*(?:\.\d+)?)$/.test(part)) {
              return (
                <span key={index} className="text-accent-yellow font-semibold mx-0.5 font-mono">
                  {part}
                </span>
              );
            }
            return part;
          });
        };
        return (
          <p className="mb-3 last:mb-0">
            {React.Children.map(children, (child) =>
              typeof child === 'string' ? processText(child) : child
            )}
          </p>
        );
      },
      // 表格
      table({ children }: any) {
        return (
          <div className="overflow-x-auto my-4">
            <table className="w-full border-collapse border border-border text-sm">{children}</table>
          </div>
        );
      },
      th({ children }: any) {
        return (
          <th className="border border-border bg-bg-tertiary px-3 py-2 text-left font-semibold">
            {children}
          </th>
        );
      },
      td({ children }: any) {
        return <td className="border border-border px-3 py-2">{children}</td>;
      },
      // 引用块
      blockquote({ children }: any) {
        return (
          <blockquote className="border-l-4 border-accent-cyan/50 pl-4 my-4 italic text-text-secondary bg-bg-tertiary/30 py-2 rounded-r">
            {children}
          </blockquote>
        );
      },
    };

    return (
      <div
        ref={ref}
        className={cn('flex gap-3 max-w-3xl mx-auto', isUser && 'flex-row-reverse')}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* 头像 */}
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1',
            isUser ? `bg-accent-${accentColor}/20 text-accent-${accentColor}` : 'bg-accent-yellow/20 text-accent-yellow'
          )}
        >
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        {/* 消息内容 */}
        <div className={cn('flex flex-col max-w-[85%]', isUser ? 'items-end' : 'items-start')}>
          {/* 用户附带的图片 */}
          {message.images && message.images.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto">
              {message.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`attached-${idx}`}
                  className="h-24 w-auto rounded-lg object-cover"
                />
              ))}
            </div>
          )}

          {/* 用户附带的文件 */}
          {message.queryFiles && message.queryFiles.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {message.queryFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="px-2 py-1 bg-bg-tertiary rounded text-xs text-text-muted flex items-center gap-1"
                >
                  <Folder size={12} />
                  {file.name}
                </div>
              ))}
            </div>
          )}

          {/* 思考过程 */}
          {message.trainOfThought && message.trainOfThought.length > 0 && (
            <div className="mb-2 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg space-y-2">
              {message.trainOfThought.map((thought, idx) => (
                <TrainOfThought
                  key={idx}
                  message={thought.data}
                  isPrimary={idx === message.trainOfThought!.length - 1}
                  accentColor="purple"
                />
              ))}
            </div>
          )}

          {/* 消息气泡 */}
          <div
            ref={messageRef}
            className={cn(
              'rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
              isUser
                ? `bg-accent-${accentColor} text-bg-primary font-medium rounded-tr-none`
                : 'bg-bg-secondary text-text-primary border border-border rounded-tl-none'
            )}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <div
                className={cn(
                  'prose prose-invert prose-sm max-w-none',
                  'text-gray-200 leading-relaxed',
                  '[&>h1]:text-accent-cyan [&>h1]:font-bold [&>h1]:mb-4 [&>h1]:mt-2',
                  '[&>h2]:text-accent-cyan/90 [&>h2]:font-bold [&>h2]:mb-3 [&>h2]:mt-6',
                  '[&>h3]:text-accent-cyan/80 [&>h3]:font-semibold [&>h3]:mb-2 [&>h3]:mt-4',
                  '[&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1 [&>ul]:my-3',
                  '[&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:space-y-1 [&>ol]:my-3',
                  '[&>li]:text-gray-300'
                )}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={markdownComponents}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* 引用来源 */}
          {message.citations && message.citations.length > 0 && (
            <div className="mt-2 text-[10px] text-text-muted bg-bg-tertiary/50 p-2 rounded w-full border border-border/50">
              <div className="font-medium mb-1 flex items-center gap-1 opacity-70">
                <Book size={10} /> 参考来源
              </div>
              <ul className="space-y-1 pl-3 list-disc opacity-70">
                {message.citations.map((c, i) => (
                  <li key={i}>
                    <span className="text-accent-cyan/80">[{c.source}]</span> {c.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 消息操作栏 */}
          {isAssistant && message.content && (
            <div
              className={cn(
                'flex items-center gap-1 mt-1 transition-opacity',
                isHovering || isLastMessage ? 'opacity-100' : 'opacity-0'
              )}
            >
              {/* 时间戳 */}
              <span className="text-[10px] text-text-tertiary mr-2">
                {formatTimestamp(message.createdAt)}
              </span>

              {/* 复制按钮 */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-text-muted hover:text-text-primary"
                onClick={handleCopy}
              >
                {copySuccess ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>

              {/* 反馈按钮 */}
              {onFeedback && <FeedbackButtons messageId={message.id} onFeedback={onFeedback} />}

              {/* 重试按钮 */}
              {onRetry && isLastMessage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-text-muted hover:text-text-primary"
                  onClick={() => onRetry(message.content, message.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}

              {/* 删除按钮 */}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-text-muted hover:text-red-500"
                  onClick={() => onDelete(message.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          {/* 用户消息时间戳 */}
          {isUser && (
            <span className="text-[10px] text-text-tertiary mt-1">
              {formatTimestamp(message.createdAt)}
            </span>
          )}
        </div>
      </div>
    );
  }
);

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
