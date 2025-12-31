/**
 * Khoj 对话输入区域组件
 * 从 Khoj 源码移植，适配 Blinko UI 组件
 */

import { useEffect, useRef, useState, forwardRef } from 'react';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';
import { 
  Button, 
  Textarea, 
  Progress, 
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Popover,
  PopoverTrigger,
  PopoverContent,
  ScrollShadow,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { convertColorToTextClass, convertToBGClass } from '../common/colorUtils';
import { getIconForSlashCommand, getIconFromFilename } from '../common/iconUtils';
import { packageFilesForUpload, AttachedFileText } from '../common/chatFunctions';

// ============================================
// 类型定义
// ============================================

export interface ChatOptions {
  [key: string]: string;
}

export enum ChatInputFocus {
  MESSAGE = 'message',
  FILE = 'file',
  RESEARCH = 'research',
}

interface ChatInputProps {
  sendMessage: (message: string) => void;
  sendImage: (image: string) => void;
  sendDisabled: boolean;
  setUploadedFiles: (files: AttachedFileText[]) => void;
  conversationId?: string | null;
  chatOptionsData?: ChatOptions | null;
  isMobileWidth?: boolean;
  isLoggedIn: boolean;
  agentColor?: string;
  isResearchModeEnabled?: boolean;
  setTriggeredAbort: (value: boolean, newMessage?: string) => void;
  prefillMessage?: string;
  focus?: ChatInputFocus;
}

interface AttachedFileTextWithSize extends AttachedFileText {
  file_type: string;
  size: number;
}

// ============================================
// 工具函数
// ============================================

function convertBytesToText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================
// 组件
// ============================================

export const ChatInputArea = forwardRef<HTMLTextAreaElement, ChatInputProps>((props, ref) => {
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputButtonRef = useRef<HTMLButtonElement>(null);
  const researchModeRef = useRef<HTMLButtonElement>(null);

  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const [imageUploaded, setImageUploaded] = useState(false);
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [imageData, setImageData] = useState<string[]>([]);

  const [attachedFiles, setAttachedFiles] = useState<FileList | null>(null);
  const [convertedAttachedFiles, setConvertedAttachedFiles] = useState<AttachedFileTextWithSize[]>([]);

  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const [progressValue, setProgressValue] = useState(0);
  const [isDragAndDropping, setIsDragAndDropping] = useState(false);

  const [showCommandList, setShowCommandList] = useState(false);
  const [useResearchMode, setUseResearchMode] = useState<boolean>(
    props.isResearchModeEnabled || false
  );

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
    if (props.prefillMessage === undefined) return;
    setMessage(props.prefillMessage);
    chatInputRef?.current?.focus();
  }, [props.prefillMessage]);

  // 焦点控制
  useEffect(() => {
    if (props.focus === ChatInputFocus.MESSAGE) {
      chatInputRef?.current?.focus();
    } else if (props.focus === ChatInputFocus.FILE) {
      fileInputButtonRef.current?.focus();
    } else if (props.focus === ChatInputFocus.RESEARCH) {
      researchModeRef.current?.focus();
    }
  }, [props.focus]);

  // 图片数据加载
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
    setUploading(true);
    fetchImageData();
  }, [imagePaths]);

  // 研究模式同步
  useEffect(() => {
    if (props.isResearchModeEnabled) {
      setUseResearchMode(props.isResearchModeEnabled);
    }
  }, [props.isResearchModeEnabled]);

  // 输入框高度自适应
  useEffect(() => {
    if (!chatInputRef?.current) return;
    chatInputRef.current.style.height = 'auto';
    chatInputRef.current.style.height = Math.max(chatInputRef.current.scrollHeight - 24, 64) + 'px';

    if (message.startsWith('/') && message.split(' ').length === 1) {
      setShowCommandList(true);
    } else {
      setShowCommandList(false);
    }
  }, [message]);

  // 录音控制
  useEffect(() => {
    if (!recording && mediaRecorder) {
      mediaRecorder.stop();
    }

    if (recording && !mediaRecorder) {
      startRecordingAndTranscribe();
    }
  }, [recording, mediaRecorder]);

  // 发送消息
  function onSendMessage() {
    if (!message.trim() && imageData.length === 0) return;
    if (!props.isLoggedIn) {
      setShowLoginPrompt(true);
      return;
    }

    // 如果正在处理，先中断
    if (props.sendDisabled) {
      props.setTriggeredAbort(true, message.trim());
      setMessage('');
      return;
    }

    if (imageUploaded) {
      setImageUploaded(false);
      setImagePaths([]);
      imageData.forEach((data) => props.sendImage(data));
    }

    let messageToSend = message.trim();
    // 检查是否以斜杠命令开头
    const startsWithSlashCommand =
      props.chatOptionsData &&
      Object.keys(props.chatOptionsData).some((cmd) => messageToSend.startsWith(`/${cmd}`));
    
    // 如果启用研究模式且没有使用斜杠命令，添加 /research 前缀
    if (useResearchMode && !startsWithSlashCommand) {
      messageToSend = `/research ${messageToSend}`;
    }

    props.sendMessage(messageToSend);
    setAttachedFiles(null);
    setConvertedAttachedFiles([]);
    setMessage('');
  }

  // 斜杠命令点击
  function handleSlashCommandClick(command: string) {
    setMessage(`/${command} `);
    setShowCommandList(false);
  }

  // 文件按钮点击
  function handleFileButtonClick() {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
  }

  // 文件选择变化
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

  // 上传文件
  function uploadFiles(files: FileList) {
    if (!props.isLoggedIn) {
      setShowLoginPrompt(true);
      return;
    }

    const image_endings = ['jpg', 'jpeg', 'png', 'webp'];
    const newImagePaths: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const file_extension = file.name.split('.').pop()?.toLowerCase();
      if (image_endings.includes(file_extension || '')) {
        newImagePaths.push(DOMPurify.sanitize(URL.createObjectURL(file)));
      }
    }

    if (newImagePaths.length > 0) {
      setImageUploaded(true);
      setImagePaths((prevPaths) => [...prevPaths, ...newImagePaths]);
      chatInputRef?.current?.focus();
    }

    // 处理非图片文件
    const nonImageFiles = Array.from(files).filter(
      (file) => !image_endings.includes(file.name.split('.').pop()?.toLowerCase() || '')
    );

    const newFiles = nonImageFiles
      ? Array.from(nonImageFiles).concat(Array.from(attachedFiles || []))
      : Array.from(attachedFiles || []);

    if (newFiles.length > 0) {
      // 检查文件大小限制 (10 MB)
      for (let i = 0; i < newFiles.length; i++) {
        if (newFiles[i].size > 10 * 1024 * 1024) {
          setWarning(`文件 ${newFiles[i].name} 太大，请上传小于 10 MB 的文件`);
          return;
        }
      }

      const dataTransfer = new DataTransfer();
      newFiles.forEach((file) => dataTransfer.items.add(file));

      extractTextFromFiles(dataTransfer.files).then((data) => {
        props.setUploadedFiles(data);
        setAttachedFiles(dataTransfer.files);
        setConvertedAttachedFiles(data as AttachedFileTextWithSize[]);
      });
    }

    chatInputRef?.current?.focus();
  }

  // 提取文件文本
  async function extractTextFromFiles(files: FileList): Promise<AttachedFileText[]> {
    const formData = await packageFilesForUpload(files);
    setUploading(true);

    try {
      const response = await fetch('/api/content/convert', {
        method: 'POST',
        body: formData,
      });
      setUploading(false);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      setError('文件转换失败: ' + err);
      console.error('Error converting files:', err);
      return [];
    }
  }

  // 录音并转写
  async function startRecordingAndTranscribe() {
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(microphone, { mimeType: 'audio/webm' });

      const audioChunks: Blob[] = [];

      recorder.ondataavailable = async (event) => {
        audioChunks.push(event.data);
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioBlob);

        try {
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) throw new Error('Network response was not ok');

          const transcription = await response.json();
          setMessage(transcription.text.trim());
        } catch (err) {
          console.error('Error sending audio to server:', err);
        }
      };

      recorder.start(1500);

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioBlob);

        try {
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) throw new Error('Network response was not ok');

          const transcription = await response.json();
          recorder.stream.getTracks().forEach((track) => track.stop());
          setMediaRecorder(null);
          setMessage(transcription.text.trim());
        } catch (err) {
          console.error('Error sending audio to server:', err);
        }
      };

      setMediaRecorder(recorder);
    } catch (err) {
      console.error('Error getting microphone', err);
    }
  }

  // 拖放事件处理
  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragAndDropping(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragAndDropping(false);
  }

  // 移除图片
  function removeImageUpload(index: number) {
    setImagePaths((prevPaths) => prevPaths.filter((_, i) => i !== index));
    setImageData((prevData) => prevData.filter((_, i) => i !== index));
    if (imagePaths.length === 1) {
      setImageUploaded(false);
    }
  }

  // 移除附件
  function removeAttachedFile(fileName: string) {
    setAttachedFiles((prevFiles) => {
      if (!prevFiles) return null;
      const updatedFiles = Array.from(prevFiles).filter((file) => file.name !== fileName);
      const dataTransfer = new DataTransfer();
      updatedFiles.forEach((file) => dataTransfer.items.add(file));

      const filteredConvertedAttachedFiles = convertedAttachedFiles.filter(
        (file) => file.name !== fileName
      );

      props.setUploadedFiles(filteredConvertedAttachedFiles);
      setConvertedAttachedFiles(filteredConvertedAttachedFiles);
      return dataTransfer.files;
    });
  }

  // 获取按钮背景色
  const buttonBgClass = props.agentColor 
    ? convertToBGClass(props.agentColor) 
    : 'bg-primary';

  return (
    <>
      {/* 登录提示 Modal */}
      <Modal isOpen={showLoginPrompt} onClose={() => setShowLoginPrompt(false)}>
        <ModalContent>
          <ModalHeader>需要登录</ModalHeader>
          <ModalBody>
            <p>请先登录后再发送消息</p>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onPress={() => setShowLoginPrompt(false)}>
              确定
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 上传进度 Modal */}
      <Modal isOpen={uploading} onClose={() => setUploading(false)}>
        <ModalContent>
          <ModalHeader>正在上传</ModalHeader>
          <ModalBody>
            <Progress value={progressValue} className="w-full" />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setUploading(false)}>
              取消
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 警告 Modal */}
      <Modal isOpen={warning !== null} onClose={() => setWarning(null)}>
        <ModalContent>
          <ModalHeader>上传警告</ModalHeader>
          <ModalBody>
            <p>{warning}</p>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onPress={() => setWarning(null)}>
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 错误 Modal */}
      <Modal isOpen={error !== null} onClose={() => setError(null)}>
        <ModalContent>
          <ModalHeader>出错了</ModalHeader>
          <ModalBody>
            <p>{error}</p>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onPress={() => setError(null)}>
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 斜杠命令列表 */}
      {showCommandList && props.chatOptionsData && (
        <Popover isOpen={showCommandList} onOpenChange={setShowCommandList} placement="top">
          <PopoverTrigger>
            <div className="w-0 h-0" />
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0">
            <ScrollShadow className="max-h-64">
              <div className="p-2">
                <p className="text-xs text-default-500 px-2 py-1">Agent 工具</p>
                {Object.entries(props.chatOptionsData).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex flex-col gap-1 p-2 rounded-lg hover:bg-default-100 cursor-pointer"
                    onClick={() => handleSlashCommandClick(key)}
                  >
                    <div className="font-medium flex items-center gap-2">
                      {getIconForSlashCommand(key, 'w-4 h-4')}
                      <span>/{key}</span>
                    </div>
                    <p className="text-xs text-default-500">{value}</p>
                  </div>
                ))}
              </div>
            </ScrollShadow>
          </PopoverContent>
        </Popover>
      )}

      <div>
        {/* 已上传的图片预览 */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {imageUploaded &&
            imagePaths.map((path, index) => (
              <div key={index} className="relative flex-shrink-0 pb-3 pt-2 group">
                <img
                  src={path}
                  alt={`img-${index}`}
                  className="w-auto h-16 object-cover rounded-xl"
                />
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  className="absolute -top-0 -right-2 h-5 w-5 min-w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onPress={() => removeImageUpload(index)}
                >
                  <Icon icon="mdi:close" className="w-3 h-3" />
                </Button>
              </div>
            ))}

          {/* 已上传的文件预览 */}
          {convertedAttachedFiles.map((file, index) => (
            <div key={index} className="relative flex-shrink-0 p-2 group">
              <div
                className={`w-auto h-16 object-cover rounded-xl ${buttonBgClass} bg-opacity-15 cursor-pointer`}
              >
                <div className="flex p-2 flex-col justify-start items-start h-full">
                  <span className="text-sm font-bold text-default-600 text-ellipsis truncate max-w-[200px] break-words">
                    {file.name}
                  </span>
                  <span className="flex items-center gap-1">
                    {getIconFromFilename(file.file_type)}
                    <span className="text-xs text-default-500">
                      {convertBytesToText(file.size)}
                    </span>
                  </span>
                </div>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                className="absolute -top-0 -right-2 h-5 w-5 min-w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onPress={() => removeAttachedFile(file.name)}
              >
                <Icon icon="mdi:close" className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* 输入区域 */}
        <div
          className={`flex items-end gap-2 p-2 rounded-2xl bg-default-100 dark:bg-default-50 ${
            isDragAndDropping ? 'animate-pulse ring-2 ring-primary' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDragAndDropFiles}
        >
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,.org,.jpg,.jpeg,.png,.webp,.py,.tsx,.js,.json,.html,.css,.ipynb"
            multiple={true}
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {/* 附件按钮 */}
          <Tooltip content="附加 PDF、文本文件或图片">
            <Button
              isIconOnly
              variant="light"
              className="text-default-400 hover:text-default-600"
              isDisabled={!props.isLoggedIn}
              onPress={handleFileButtonClick}
              ref={fileInputButtonRef}
            >
              <Icon icon="mdi:paperclip" className="w-6 h-6" />
            </Button>
          </Tooltip>

          {/* 文本输入框 */}
          <Textarea
            ref={chatInputRef}
            className="flex-1"
            classNames={{
              input: 'min-h-[40px] resize-none',
              inputWrapper: 'bg-transparent shadow-none',
            }}
            placeholder="输入 / 查看命令列表"
            minRows={1}
            maxRows={5}
            value={message}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !props.isMobileWidth &&
                !recording &&
                message
              ) {
                setImageUploaded(false);
                setImagePaths([]);
                e.preventDefault();
                onSendMessage();
              }
            }}
            onValueChange={setMessage}
            isDisabled={recording}
          />

          {/* 操作按钮 */}
          <div className="flex items-center gap-1">
            {recording ? (
              <Tooltip content="点击停止录音并转写">
                <Button
                  isIconOnly
                  color="primary"
                  className={`rounded-full ${buttonBgClass}`}
                  onPress={() => setRecording(false)}
                  isDisabled={props.sendDisabled || !props.isLoggedIn}
                >
                  <Icon icon="mdi:stop" className="w-5 h-5" />
                </Button>
              </Tooltip>
            ) : mediaRecorder ? (
              <div className="p-2">
                <Icon icon="mdi:loading" className="w-5 h-5 animate-spin" />
              </div>
            ) : props.sendDisabled && !message ? (
              <Tooltip content="点击停止生成">
                <Button
                  isIconOnly
                  color="primary"
                  className={`rounded-full ${buttonBgClass}`}
                  onPress={() => props.setTriggeredAbort(true)}
                >
                  <Icon icon="mdi:stop" className="w-5 h-5" />
                </Button>
              </Tooltip>
            ) : !message ? (
              <Tooltip content="点击语音输入">
                <Button
                  isIconOnly
                  color="primary"
                  className={`rounded-full ${buttonBgClass}`}
                  isDisabled={props.sendDisabled || !props.isLoggedIn}
                  onPress={() => {
                    setMessage('正在听...');
                    setRecording(true);
                  }}
                >
                  <Icon icon="mdi:microphone" className="w-5 h-5" />
                </Button>
              </Tooltip>
            ) : null}

            {message && !recording && (
              <Button
                isIconOnly
                color="primary"
                className={`rounded-full ${buttonBgClass}`}
                isDisabled={!message || recording || !props.isLoggedIn}
                onPress={onSendMessage}
              >
                <Icon icon="mdi:arrow-up" className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* 研究模式开关 */}
        <div className="flex justify-end mt-2">
          <Tooltip content="研究模式可获得更深入、详细的回复，但响应时间可能更长">
            <Button
              variant="light"
              size="sm"
              className="gap-1"
              isDisabled={props.sendDisabled || !props.isLoggedIn}
              ref={researchModeRef}
              onPress={() => {
                setUseResearchMode(!useResearchMode);
                chatInputRef?.current?.focus();
              }}
            >
              <span className="text-default-500 text-sm">研究模式</span>
              <Icon
                icon={useResearchMode ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off'}
                className={`w-6 h-6 ${
                  useResearchMode
                    ? props.agentColor
                      ? convertColorToTextClass(props.agentColor)
                      : 'text-primary'
                    : 'text-default-400'
                }`}
              />
            </Button>
          </Tooltip>
        </div>
      </div>
    </>
  );
});

ChatInputArea.displayName = 'ChatInputArea';

export default ChatInputArea;
