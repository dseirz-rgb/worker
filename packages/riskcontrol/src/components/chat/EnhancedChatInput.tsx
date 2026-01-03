/**
 * EnhancedChatInput - 增强版聊天输入组件
 *
 * 基于: https://github.com/khoj-ai/khoj
 * 改动: 1. 替换 @phosphor-icons/react → lucide-react
 *       2. 移除 Khoj API 调用 (/api/transcribe, /api/content/convert)
 *       3. 集成 RiskControl activeContext 系统
 *       4. 添加 Research Mode 切换
 *       5. 适配 Tailwind 4.x 样式
 *
 * @module components/chat/EnhancedChatInput
 * @license AGPL-3.0 (继承自 Khoj)
 */

import React, { useEffect, useRef, useState, forwardRef } from 'react';
import DOMPurify from 'dompurify';
import {
  ArrowUp,
  Mic,
  Paperclip,
  X,
  Square,
  ToggleLeft,
  ToggleRight,
  FileText,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// --- Types ---
export interface AttachedFileText {
  name: string;
  content: string;
  file_type: string;
  size: number;
}

export enum ChatInputFocus {
  MESSAGE = 'message',
  FILE = 'file',
  RESEARCH = 'research',
}

interface EnhancedChatInputProps {
  /** 发送消息回调 */
  sendMessage: (message: string) => void;
  /** 发送图片回调 */
  sendImage?: (image: string) => void;
  /** 是否禁用发送 */
  sendDisabled?: boolean;
  /** 设置上传文件 */
  setUploadedFiles?: (files: AttachedFileText[]) => void;
  /** 是否移动端宽度 */
  isMobileWidth?: boolean;
  /** 是否已登录 */
  isLoggedIn?: boolean;
  /** 主题色 */
  accentColor?: string;
  /** 是否启用研究模式 */
  isResearchModeEnabled?: boolean;
  /** 触发中止回调 */
  setTriggeredAbort?: (value: boolean, newMessage?: string) => void;
  /** 预填充消息 */
  prefillMessage?: string;
  /** 焦点类型 */
  focus?: ChatInputFocus;
  /** 占位符文本 */
  placeholder?: string;
  /** 当前上下文标签 */
  activeContextLabel?: string;
  /** 是否正在加载 */
  isLoading?: boolean;
}

// 文件大小格式化
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 获取文件图标
function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return <ImageIcon size={14} />;
  return <FileText size={14} />;
}

export const EnhancedChatInput = forwardRef<HTMLTextAreaElement, EnhancedChatInputProps>(
  (props, ref) => {
    const {
      sendMessage,
      sendImage,
      sendDisabled = false,
      setUploadedFiles,
      isMobileWidth = false,
      isLoggedIn = true,
      accentColor = 'cyan',
      isResearchModeEnabled = false,
      setTriggeredAbort,
      prefillMessage,
      focus,
      placeholder = '输入消息...',
      activeContextLabel,
      isLoading = false,
    } = props;

    const [message, setMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileInputButtonRef = useRef<HTMLButtonElement>(null);
    const researchModeRef = useRef<HTMLButtonElement>(null);

    const [warning, setWarning] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progressValue, setProgressValue] = useState(0);

    const [imageUploaded, setImageUploaded] = useState(false);
    const [imagePaths, setImagePaths] = useState<string[]>([]);
    const [imageData, setImageData] = useState<string[]>([]);

    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [convertedAttachedFiles, setConvertedAttachedFiles] = useState<AttachedFileText[]>([]);

    const [isDragAndDropping, setIsDragAndDropping] = useState(false);
    const [useResearchMode, setUseResearchMode] = useState(isResearchModeEnabled);

    const chatInputRef = ref as React.MutableRefObject<HTMLTextAreaElement>;

    // 上传进度动画
    useEffect(() => {
      if (!uploading) {
        setProgressValue(0);
        return;
      }
      const interval = setInterval(() => {
        setProgressValue((prev) => {
          const increment = Math.floor(Math.random() * 5) + 1;
          const nextValue = prev + increment;
          return nextValue < 100 ? nextValue : 100;
        });
      }, 800);
      return () => clearInterval(interval);
    }, [uploading]);

    // 预填充消息
    useEffect(() => {
      if (prefillMessage === undefined) return;
      setMessage(prefillMessage);
      chatInputRef?.current?.focus();
    }, [prefillMessage, chatInputRef]);

    // 焦点控制
    useEffect(() => {
      if (focus === ChatInputFocus.MESSAGE) {
        chatInputRef?.current?.focus();
      } else if (focus === ChatInputFocus.FILE) {
        fileInputButtonRef.current?.focus();
      } else if (focus === ChatInputFocus.RESEARCH) {
        researchModeRef.current?.focus();
      }
    }, [focus, chatInputRef]);

    // 图片数据获取
    useEffect(() => {
      async function fetchImageData() {
        if (imagePaths.length > 0) {
          const newImageData = await Promise.all(
            imagePaths.map(async (path) => {
              const response = await fetch(path);
              const blob = await response.blob();
              return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
            })
          );
          setImageData(newImageData);
        }
        setUploading(false);
      }
      if (imagePaths.length > 0) {
        setUploading(true);
        fetchImageData();
      }
    }, [imagePaths]);

    // 研究模式同步
    useEffect(() => {
      setUseResearchMode(isResearchModeEnabled);
    }, [isResearchModeEnabled]);

    // 自动调整高度
    useEffect(() => {
      if (!chatInputRef?.current) return;
      chatInputRef.current.style.height = 'auto';
      chatInputRef.current.style.height = Math.max(chatInputRef.current.scrollHeight - 24, 44) + 'px';
    }, [message, chatInputRef]);

    // 发送消息
    function onSendMessage() {
      if (!message.trim() && imageData.length === 0) return;

      // 如果正在处理，触发中止
      if (sendDisabled && setTriggeredAbort) {
        setTriggeredAbort(true, message.trim());
        setMessage('');
        return;
      }

      // 发送图片
      if (imageUploaded && sendImage) {
        setImageUploaded(false);
        setImagePaths([]);
        imageData.forEach((data) => sendImage(data));
      }

      let messageToSend = message.trim();
      // 研究模式前缀
      if (useResearchMode && !messageToSend.startsWith('/')) {
        messageToSend = `/research ${messageToSend}`;
      }

      sendMessage(messageToSend);
      setAttachedFiles([]);
      setConvertedAttachedFiles([]);
      setMessage('');
    }

    // 文件按钮点击
    function handleFileButtonClick() {
      fileInputRef.current?.click();
    }

    // 文件选择
    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
      if (!event.target.files) return;
      uploadFiles(event.target.files);
    }

    // 拖放文件
    function handleDragAndDropFiles(event: React.DragEvent<HTMLDivElement>) {
      event.preventDefault();
      setIsDragAndDropping(false);
      if (!event.dataTransfer.files) return;
      uploadFiles(event.dataTransfer.files);
    }

    // 上传文件处理
    function uploadFiles(files: FileList) {
      const imageEndings = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      const newImagePaths: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (imageEndings.includes(fileExtension || '')) {
          newImagePaths.push(DOMPurify.sanitize(URL.createObjectURL(file)));
        }
      }

      if (newImagePaths.length > 0) {
        setImageUploaded(true);
        setImagePaths((prev) => [...prev, ...newImagePaths]);
        chatInputRef?.current?.focus();
      }

      // 处理非图片文件
      const nonImageFiles = Array.from(files).filter(
        (file) => !imageEndings.includes(file.name.split('.').pop()?.toLowerCase() || '')
      );

      if (nonImageFiles.length > 0) {
        // 检查文件大小限制 (10 MB)
        for (const file of nonImageFiles) {
          if (file.size > 10 * 1024 * 1024) {
            setWarning(`文件 ${file.name} 太大，请上传小于 10 MB 的文件。`);
            return;
          }
        }

        // 简单的文本提取（本地处理）
        extractTextFromFiles(nonImageFiles).then((data) => {
          setUploadedFiles?.(data);
          setAttachedFiles((prev) => [...prev, ...nonImageFiles]);
          setConvertedAttachedFiles((prev) => [...prev, ...data]);
        });
      }

      chatInputRef?.current?.focus();
    }

    // 本地文本提取
    async function extractTextFromFiles(files: File[]): Promise<AttachedFileText[]> {
      setUploading(true);
      const results: AttachedFileText[] = [];

      for (const file of files) {
        try {
          const content = await file.text();
          results.push({
            name: file.name,
            content: content.slice(0, 50000), // 限制内容长度
            file_type: file.type || 'text/plain',
            size: file.size,
          });
        } catch (err) {
          console.error(`读取文件 ${file.name} 失败:`, err);
          setError(`读取文件 ${file.name} 失败`);
        }
      }

      setUploading(false);
      return results;
    }

    // 移除图片
    function removeImageUpload(index: number) {
      setImagePaths((prev) => prev.filter((_, i) => i !== index));
      setImageData((prev) => prev.filter((_, i) => i !== index));
      if (imagePaths.length === 1) {
        setImageUploaded(false);
      }
    }

    // 移除附件
    function removeAttachedFile(fileName: string) {
      setAttachedFiles((prev) => prev.filter((f) => f.name !== fileName));
      const filtered = convertedAttachedFiles.filter((f) => f.name !== fileName);
      setConvertedAttachedFiles(filtered);
      setUploadedFiles?.(filtered);
    }

    // 拖放事件
    function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
      event.preventDefault();
      setIsDragAndDropping(true);
    }

    function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
      event.preventDefault();
      setIsDragAndDropping(false);
    }

    return (
      <>
        {/* 上传进度对话框 */}
        <AlertDialog open={uploading}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>正在上传文件，请稍候...</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription>
              <Progress className="w-full h-2 rounded-full" value={progressValue} />
            </AlertDialogDescription>
            <AlertDialogAction onClick={() => setUploading(false)}>取消</AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>

        {/* 警告对话框 */}
        <AlertDialog open={warning !== null}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>文件上传警告</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription>{warning}</AlertDialogDescription>
            <AlertDialogAction onClick={() => setWarning(null)}>关闭</AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>

        {/* 错误对话框 */}
        <AlertDialog open={error !== null}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>出错了</AlertDialogTitle>
              <AlertDialogDescription>上传文件时发生错误</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogDescription>{error}</AlertDialogDescription>
            <AlertDialogAction onClick={() => setError(null)}>关闭</AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex flex-col gap-2">
          {/* 已上传的图片预览 */}
          {imageUploaded && imagePaths.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {imagePaths.map((path, index) => (
                <div key={index} className="relative flex-shrink-0 group">
                  <img
                    src={path}
                    alt={`img-${index}`}
                    className="w-auto h-16 object-cover rounded-xl border border-border"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-bg-secondary border border-border opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImageUpload(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* 已上传的文件预览 */}
          {convertedAttachedFiles.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {convertedAttachedFiles.map((file, index) => (
                <div
                  key={index}
                  className="relative flex-shrink-0 group px-3 py-2 bg-bg-tertiary rounded-lg border border-border"
                >
                  <div className="flex items-center gap-2">
                    {getFileIcon(file.file_type)}
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-text-primary truncate max-w-[150px]">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-bg-secondary border border-border opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeAttachedFile(file.name)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* 主输入区域 */}
          <div
            className={cn(
              'relative bg-bg-secondary border border-border rounded-2xl',
              'flex items-end p-2 transition-all',
              'focus-within:ring-2 focus-within:ring-accent-cyan/20 focus-within:border-accent-cyan/50',
              isDragAndDropping && 'ring-2 ring-accent-cyan/50 animate-pulse'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDragAndDropFiles}
          >
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md,.json,.csv,.jpg,.jpeg,.png,.webp,.gif"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            {/* 附件按钮 */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
                    disabled={!isLoggedIn}
                    onClick={handleFileButtonClick}
                    ref={fileInputButtonRef}
                  >
                    <Paperclip className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>附加文件或图片</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* 文本输入 */}
            <Textarea
              ref={chatInputRef}
              className={cn(
                'flex-1 border-none bg-transparent resize-none',
                'min-h-[44px] max-h-[128px] py-2.5 px-3',
                'text-sm text-text-primary placeholder:text-text-muted',
                'focus:outline-none focus-visible:ring-0',
                isMobileWidth ? 'text-base' : 'text-sm'
              )}
              placeholder={activeContextLabel ? `针对 ${activeContextLabel} 提问...` : placeholder}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isMobileWidth && message.trim()) {
                  e.preventDefault();
                  onSendMessage();
                }
              }}
              disabled={isLoading}
              rows={1}
            />

            {/* 发送/停止按钮 */}
            <div className="flex items-center gap-1">
              {sendDisabled && !message ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="icon"
                        className={cn(
                          'h-9 w-9 rounded-full',
                          `bg-accent-${accentColor} hover:bg-accent-${accentColor}/80`
                        )}
                        onClick={() => setTriggeredAbort?.(true)}
                      >
                        <Square className="w-4 h-4" fill="currentColor" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>停止生成</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button
                  variant="default"
                  size="icon"
                  className={cn(
                    'h-9 w-9 rounded-full transition-all',
                    message.trim()
                      ? `bg-accent-${accentColor} hover:bg-accent-${accentColor}/80 text-bg-primary shadow-lg hover:scale-105`
                      : 'bg-bg-tertiary text-text-muted'
                  )}
                  disabled={!message.trim() || isLoading || !isLoggedIn}
                  onClick={onSendMessage}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* 研究模式切换 */}
          <div className="flex justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 gap-1.5 text-text-muted hover:text-text-primary"
                    disabled={sendDisabled || !isLoggedIn}
                    ref={researchModeRef}
                    onClick={() => {
                      setUseResearchMode(!useResearchMode);
                      chatInputRef?.current?.focus();
                    }}
                  >
                    <span className="text-xs">深度研究</span>
                    {useResearchMode ? (
                      <ToggleRight className={cn('w-5 h-5', `text-accent-${accentColor}`)} />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-text-tertiary" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  深度研究模式会进行更详细的分析，响应时间可能更长。
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </>
    );
  }
);

EnhancedChatInput.displayName = 'EnhancedChatInput';

export default EnhancedChatInput;
