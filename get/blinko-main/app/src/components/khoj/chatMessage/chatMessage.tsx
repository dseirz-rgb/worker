/**
 * Khoj 对话消息组件
 * 从 Khoj 源码移植，适配 Blinko UI 组件
 */

import { useEffect, useRef, useState, forwardRef } from 'react';
import markdownIt from 'markdown-it';
import mditHljs from 'markdown-it-highlightjs';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';
import {
  Button,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ScrollShadow,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { convertColorToTextClass } from '../common/colorUtils';
import { renderCodeGenImageInline, AttachedFileText } from '../common/chatFunctions';

// ============================================
// Markdown 配置
// ============================================

const md = new markdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

md.use(mditHljs, {
  inline: true,
  code: true,
});

// ============================================
// 类型定义
// ============================================

export interface Context {
  compiled: string;
  file: string;
}

export interface OnlineContext {
  [key: string]: OnlineContextData;
}

export interface OnlineContextData {
  webpages: Array<{
    link: string;
    query: string;
    snippet: string;
  }>;
  answerBox: {
    answer: string;
    source: string;
    title: string;
  };
  knowledgeGraph: {
    attributes: { [key: string]: string };
    description: string;
    descriptionLink: string;
    descriptionSource: string;
    imageUrl: string;
    title: string;
    type: string;
  };
  organic: Array<{
    snippet: string;
    title: string;
    link: string;
  }>;
  peopleAlsoAsk: Array<{
    link: string;
    question: string;
    snippet: string;
    title: string;
  }>;
}

export interface CodeContext {
  [key: string]: CodeContextData;
}

export interface CodeContextData {
  code: string;
  results: {
    success: boolean;
    output_files: Array<{
      filename: string;
      b64_data: string;
    }>;
    std_out: string;
    std_err: string;
    code_runtime?: number;
  };
}

interface Intent {
  type: string;
  query: string;
  'memory-type': string;
  'inferred-queries': string[];
}

export interface TrainOfThoughtObject {
  type: string;
  data: string;
}

export interface AgentData {
  slug: string;
  name: string;
  persona: string;
  color: string;
  icon: string;
  privacy_level: string;
  managed_by_admin: boolean;
  chat_model: string;
  input_tools: string[];
  output_modes: string[];
}

export interface SingleChatMessage {
  automationId: string;
  by: string;
  message: string;
  created: string;
  context: Context[];
  onlineContext: OnlineContext;
  codeContext: CodeContext;
  trainOfThought?: TrainOfThoughtObject[];
  rawQuery?: string;
  intent?: Intent;
  agent?: AgentData;
  images?: string[];
  conversationId: string;
  turnId?: string;
  queryFiles?: AttachedFileText[];
  excalidrawDiagram?: string;
  mermaidjsDiagram?: string;
}

interface ChatMessageProps {
  chatMessage: SingleChatMessage;
  isMobileWidth: boolean;
  customClassName?: string;
  borderLeftColor?: string;
  isLastMessage?: boolean;
  agent?: AgentData;
  onDeleteMessage: (turnId?: string) => void;
  onRetryMessage?: (query: string, turnId?: string) => void;
  conversationId: string;
  turnId?: string;
}

// ============================================
// 工具函数
// ============================================

function convertBytesToText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: string): string {
  let date: Date;
  if (timestamp.includes(' ') && !timestamp.includes('T')) {
    date = new Date(timestamp.replace(' ', 'T') + 'Z');
  } else if (!timestamp.endsWith('Z')) {
    date = new Date(timestamp + 'Z');
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) {
    return '无效日期';
  }

  const time_string = date
    .toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const date_string = date
    .toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: '2-digit' });
  return `${time_string} ${date_string}`;
}

function renderTimeStamp(timestamp: string): string {
  if (!timestamp.endsWith('Z')) {
    timestamp = timestamp + 'Z';
  }
  const messageDateTime = new Date(timestamp);
  const currentDateTime = new Date();
  const timeDiff = currentDateTime.getTime() - messageDateTime.getTime();

  if (timeDiff < 60e3) return '刚刚';
  if (timeDiff < 3600e3) return `${Math.round(timeDiff / 60e3)}分钟前`;
  if (timeDiff < 86400e3) return `${Math.round(timeDiff / 3600e3)}小时前`;
  return `${Math.round(timeDiff / 86400e3)}天前`;
}

function chooseIconFromHeader(header: string): string {
  const compareHeader = header.toLowerCase();
  
  if (compareHeader.includes('understanding')) return 'mdi:brain';
  if (compareHeader.includes('generating')) return 'mdi:cloud';
  if (compareHeader.includes('tools')) return 'mdi:toolbox';
  if (compareHeader.includes('notes') || compareHeader.includes('documents') || compareHeader.includes('files')) {
    return 'mdi:folder';
  }
  if (compareHeader.includes('browsing')) return 'mdi:book-open-variant';
  if (compareHeader.includes('search')) return 'mdi:magnify';
  if (compareHeader.includes('summary') || compareHeader.includes('summarize') || compareHeader.includes('enhanc')) {
    return 'mdi:auto-fix';
  }
  if (compareHeader.includes('diagram')) return 'mdi:shape';
  if (compareHeader.includes('paint')) return 'mdi:palette';
  if (compareHeader.includes('code')) return 'mdi:code-tags';
  if (compareHeader.includes('operating')) return 'mdi:web';
  
  return 'mdi:brain';
}

// ============================================
// 子组件
// ============================================

interface TrainOfThoughtProps {
  message: string;
  primary: boolean;
  agentColor: string;
}

export function TrainOfThought(props: TrainOfThoughtProps) {
  const extractedHeader = props.message.match(/\*\*(.*)\*\*/);
  const header = extractedHeader ? extractedHeader[1] : '';
  const iconName = chooseIconFromHeader(header);
  const iconColor = props.primary ? convertColorToTextClass(props.agentColor) : 'text-default-400';
  
  let markdownRendered = DOMPurify.sanitize(md.render(props.message));
  markdownRendered = markdownRendered.replace(/<h[1-6].*?<\/h[1-6]>/g, '');

  return (
    <div className={`flex items-start gap-2 text-sm ${props.primary ? 'text-default-500' : 'text-default-400'}`}>
      <Icon icon={iconName} className={`w-4 h-4 mt-1 flex-shrink-0 ${iconColor}`} />
      <div 
        className="break-words prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: markdownRendered }} 
      />
    </div>
  );
}

interface FeedbackButtonsProps {
  uquery: string;
  kquery: string;
}

function FeedbackButtons({ uquery, kquery }: FeedbackButtonsProps) {
  const [feedbackState, setFeedbackState] = useState<boolean | null>(null);

  useEffect(() => {
    if (feedbackState !== null) {
      setTimeout(() => setFeedbackState(null), 2000);
    }
  }, [feedbackState]);

  const sendFeedback = (sentiment: string) => {
    fetch('/api/chat/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uquery, kquery, sentiment }),
    });
  };

  return (
    <div className="flex items-center gap-1">
      <Tooltip content="有帮助">
        <Button
          isIconOnly
          size="sm"
          variant="light"
          isDisabled={feedbackState !== null}
          onPress={() => {
            sendFeedback('positive');
            setFeedbackState(true);
          }}
        >
          <Icon 
            icon={feedbackState === true ? 'mdi:thumb-up' : 'mdi:thumb-up-outline'} 
            className={`w-4 h-4 ${feedbackState === true ? 'text-success' : 'text-default-400 hover:text-success'}`}
          />
        </Button>
      </Tooltip>
      <Tooltip content="没帮助">
        <Button
          isIconOnly
          size="sm"
          variant="light"
          isDisabled={feedbackState !== null}
          onPress={() => {
            sendFeedback('negative');
            setFeedbackState(false);
          }}
        >
          <Icon 
            icon={feedbackState === false ? 'mdi:thumb-down' : 'mdi:thumb-down-outline'} 
            className={`w-4 h-4 ${feedbackState === false ? 'text-danger' : 'text-default-400 hover:text-danger'}`}
          />
        </Button>
      </Tooltip>
    </div>
  );
}

// ============================================
// 主组件
// ============================================

const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>((props, ref) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [textRendered, setTextRendered] = useState('');
  const [markdownRendered, setMarkdownRendered] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [filePreviewOpen, setFilePreviewOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<AttachedFileText | null>(null);

  const messageRef = useRef<HTMLDivElement>(null);

  // 渲染消息内容
  useEffect(() => {
    let message = props.chatMessage.message;

    // 替换代码生成的图片
    message = renderCodeGenImageInline(message, props.chatMessage.codeContext);

    // 添加代码上下文中的图片
    if (props.chatMessage.codeContext) {
      Object.entries(props.chatMessage.codeContext).forEach(([_, value]) => {
        value.results?.output_files?.forEach((file) => {
          if (file.filename.endsWith('.png') || file.filename.endsWith('.jpg')) {
            if (!message.includes(`![${file.filename}](`)) {
              message += `\n\n![${file.filename}](data:image/png;base64,${file.b64_data})`;
            }
          }
        });
      });
    }

    // 处理用户上传的图片
    let messageForClipboard = message;
    let messageToRender = message;
    
    if (props.chatMessage.images && props.chatMessage.images.length > 0) {
      const sanitizedImages = props.chatMessage.images.map((image) => {
        const decodedImage = image.startsWith('data%3Aimage')
          ? decodeURIComponent(image)
          : image;
        return DOMPurify.sanitize(decodedImage);
      });
      
      const imagesInMd = sanitizedImages
        .map((img, i) => `![image ${i + 1}](${img})`)
        .join('\n');
      const imagesInHtml = sanitizedImages
        .map((img, i) => `<div class="inline-block mr-2 mb-2"><img src="${img}" alt="image ${i + 1}" class="max-w-xs rounded-lg" /></div>`)
        .join('');
      
      messageForClipboard = `${imagesInMd}\n\n${messageForClipboard}`;
      messageToRender = `<div class="flex flex-wrap mb-4">${imagesInHtml}</div>${messageToRender}`;
    }

    setTextRendered(messageForClipboard);

    // 处理 LaTeX 分隔符
    messageToRender = messageToRender
      .replace(/\\\(/g, 'LEFTPAREN')
      .replace(/\\\)/g, 'RIGHTPAREN')
      .replace(/\\\[/g, 'LEFTBRACKET')
      .replace(/\\\]/g, 'RIGHTBRACKET');

    // 渲染 Markdown
    let rendered = md.render(messageToRender);

    // 恢复 LaTeX 分隔符
    rendered = rendered
      .replace(/LEFTPAREN/g, '\\(')
      .replace(/RIGHTPAREN/g, '\\)')
      .replace(/LEFTBRACKET/g, '\\[')
      .replace(/RIGHTBRACKET/g, '\\]');

    setMarkdownRendered(DOMPurify.sanitize(rendered));
  }, [props.chatMessage.message, props.chatMessage.images, props.chatMessage.codeContext]);

  // 复制成功提示
  useEffect(() => {
    if (copySuccess) {
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }, [copySuccess]);

  // 添加代码复制按钮
  useEffect(() => {
    if (!messageRef.current) return;

    const preElements = messageRef.current.querySelectorAll('pre > .hljs');
    preElements.forEach((preElement) => {
      if (!preElement.querySelector('.code-copy-btn')) {
        const copyButton = document.createElement('button');
        copyButton.className = 'code-copy-btn absolute top-2 right-2 p-1 rounded bg-default-100 hover:bg-default-200 transition-colors';
        copyButton.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M19 21H8V7h11m0-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m-3-4H4a2 2 0 0 0-2 2v14h2V3h12V1Z"/></svg>';
        copyButton.addEventListener('click', () => {
          let textContent = preElement.textContent || '';
          textContent = textContent.replace(/^\$+/, '').replace(/^Copy/, '').trim();
          navigator.clipboard.writeText(textContent);
          copyButton.innerHTML = '<svg class="w-4 h-4 text-success" viewBox="0 0 24 24"><path fill="currentColor" d="M21 7L9 19l-5.5-5.5l1.41-1.41L9 16.17L19.59 5.59L21 7Z"/></svg>';
          setTimeout(() => {
            copyButton.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M19 21H8V7h11m0-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m-3-4H4a2 2 0 0 0-2 2v14h2V3h12V1Z"/></svg>';
          }, 2000);
        });
        
        const pre = preElement.parentElement;
        if (pre) {
          pre.style.position = 'relative';
          preElement.prepend(copyButton);
        }
      }
    });
  }, [markdownRendered]);

  // 删除消息
  const deleteMessage = async () => {
    const turnId = props.chatMessage.turnId || props.turnId;
    const response = await fetch('/api/chat/conversation/message', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: props.conversationId,
        turn_id: turnId,
      }),
    });

    if (response.ok) {
      props.onDeleteMessage(turnId);
    } else {
      console.error('Failed to delete message');
    }
  };

  // 语音播放
  const playTextToSpeech = async () => {
    const sentenceRegex = /[^.!?]+[.!?]*/g;
    const chunks = props.chatMessage.message.match(sentenceRegex) || [];
    if (!chunks.length) return;

    setIsPlaying(true);

    for (const chunk of chunks) {
      try {
        const response = await fetch(`/api/chat/speech?text=${encodeURIComponent(chunk)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Network error');
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => {
          const audio = new Audio(url);
          audio.onended = resolve;
          audio.onerror = reject;
          audio.play();
        });
      } catch (error) {
        console.error('TTS error:', error);
        break;
      }
    }

    setIsPlaying(false);
  };

  const isKhoj = props.chatMessage.by === 'khoj';
  const borderColor = props.borderLeftColor || 'border-l-primary';

  return (
    <>
      {/* 文件预览 Modal */}
      <Modal isOpen={filePreviewOpen} onClose={() => setFilePreviewOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>{selectedFile?.name}</ModalHeader>
          <ModalBody>
            <ScrollShadow className="h-72">
              <pre className="text-sm whitespace-pre-wrap break-words">
                {selectedFile?.content}
              </pre>
            </ScrollShadow>
          </ModalBody>
        </ModalContent>
      </Modal>

      <div
        ref={ref}
        className={`group ${isKhoj ? 'bg-default-50 shadow-sm' : ''} rounded-lg p-4`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        data-created={formatDate(props.chatMessage.created)}
      >
        <div className={`${isKhoj ? `border-l-4 ${borderColor} pl-4` : ''}`}>
          {/* 附件文件 */}
          {props.chatMessage.queryFiles && props.chatMessage.queryFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {props.chatMessage.queryFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-2 bg-default-100 rounded-lg cursor-pointer hover:bg-default-200 transition-colors"
                  onClick={() => {
                    setSelectedFile(file);
                    setFilePreviewOpen(true);
                  }}
                >
                  <Icon icon="mdi:file-document-outline" className="w-4 h-4 text-default-500" />
                  <span className="text-sm truncate max-w-[150px]">{file.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* 思考过程 */}
          {props.chatMessage.trainOfThought && props.chatMessage.trainOfThought.length > 0 && (
            <div className="mb-3 space-y-2 p-3 bg-default-100 rounded-lg">
              {props.chatMessage.trainOfThought.map((thought, index) => (
                <TrainOfThought
                  key={index}
                  message={thought.data}
                  primary={index === props.chatMessage.trainOfThought!.length - 1}
                  agentColor={props.agent?.color || 'orange'}
                />
              ))}
            </div>
          )}

          {/* 消息内容 */}
          <div
            ref={messageRef}
            className="prose prose-sm dark:prose-invert max-w-none break-words"
            dangerouslySetInnerHTML={{ __html: markdownRendered }}
          />
        </div>

        {/* 消息底部操作栏 */}
        <div className={`flex items-center justify-between mt-3 pt-2 border-t border-default-100 ${
          isHovering || props.isMobileWidth || props.isLastMessage ? 'opacity-100' : 'opacity-0'
        } transition-opacity`}>
          <Tooltip content={formatDate(props.chatMessage.created)}>
            <span className="text-xs text-default-400">
              {renderTimeStamp(props.chatMessage.created)}
            </span>
          </Tooltip>

          <div className="flex items-center gap-1">
            {/* 语音播放 */}
            {isKhoj && (
              <Tooltip content={isPlaying ? '停止播放' : '朗读'}>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={isPlaying ? () => setIsPlaying(false) : playTextToSpeech}
                >
                  <Icon 
                    icon={isPlaying ? 'mdi:pause' : 'mdi:volume-high'} 
                    className="w-4 h-4 text-default-400 hover:text-primary"
                  />
                </Button>
              </Tooltip>
            )}

            {/* 删除 */}
            {props.chatMessage.turnId && (
              <Tooltip content="删除">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={deleteMessage}
                >
                  <Icon icon="mdi:delete-outline" className="w-4 h-4 text-default-400 hover:text-danger" />
                </Button>
              </Tooltip>
            )}

            {/* 重试 */}
            {isKhoj && props.onRetryMessage && props.isLastMessage && (
              <Tooltip content="重试">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => {
                    const turnId = props.chatMessage.turnId || props.turnId;
                    const query = props.chatMessage.rawQuery || props.chatMessage.intent?.query;
                    if (query) {
                      props.onRetryMessage?.(query, turnId);
                    }
                  }}
                >
                  <Icon icon="mdi:refresh" className="w-4 h-4 text-default-400 hover:text-primary" />
                </Button>
              </Tooltip>
            )}

            {/* 复制 */}
            <Tooltip content={copySuccess ? '已复制' : '复制'}>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => {
                  navigator.clipboard.writeText(textRendered);
                  setCopySuccess(true);
                }}
              >
                <Icon 
                  icon={copySuccess ? 'mdi:check' : 'mdi:content-copy'} 
                  className={`w-4 h-4 ${copySuccess ? 'text-success' : 'text-default-400 hover:text-primary'}`}
                />
              </Button>
            </Tooltip>

            {/* 反馈 */}
            {isKhoj && (
              <FeedbackButtons
                uquery={props.chatMessage.intent?.query || props.chatMessage.rawQuery || props.chatMessage.message}
                kquery={props.chatMessage.message}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
