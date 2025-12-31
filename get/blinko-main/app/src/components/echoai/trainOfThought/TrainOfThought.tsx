/**
 * 思考过程组件
 * 从 Khoj 源码移植，适配 HeroUI 组件库
 * 
 * 功能：
 * - 显示 AI 推理步骤
 * - 支持折叠/展开动画
 * - 自动折叠（完成后）
 * - 视频播放器支持（截图序列）
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Spinner } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import markdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import { convertColorToTextClass } from '../common/colorUtils';

// ============================================
// Markdown 配置
// ============================================

const md = new markdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

// ============================================
// 类型定义
// ============================================

export interface TrainOfThoughtObject {
  type: string;
  data: string;
}

interface TrainOfThoughtFrame {
  text: string;
  image?: string;
  timestamp: number;
}

interface TrainOfThoughtGroup {
  type: 'video' | 'text';
  frames?: TrainOfThoughtFrame[];
  textEntries?: TrainOfThoughtObject[];
}

interface TrainOfThoughtItemProps {
  message: string;
  primary: boolean;
  agentColor: string;
}

interface TrainOfThoughtComponentProps {
  trainOfThought: string[] | TrainOfThoughtObject[];
  lastMessage: boolean;
  agentColor: string;
  keyId: string;
  completed?: boolean;
}

interface TrainOfThoughtVideoPlayerProps {
  frames: TrainOfThoughtFrame[];
  autoPlay?: boolean;
  playbackSpeed?: number;
}

// ============================================
// 工具函数
// ============================================

/**
 * 根据标题选择图标
 */
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

/**
 * 从思考数据中提取分组（视频/文本）
 */
function extractTrainOfThoughtGroups(
  trainOfThought?: TrainOfThoughtObject[],
): TrainOfThoughtGroup[] {
  if (!trainOfThought) return [];

  const groups: TrainOfThoughtGroup[] = [];
  let currentVideoFrames: TrainOfThoughtFrame[] = [];
  let currentTextEntries: TrainOfThoughtObject[] = [];

  trainOfThought.forEach((thought, index) => {
    let text = thought.data;
    let hasImage = false;

    // 从思考数据中提取截图
    try {
      const jsonMatch = text.match(
        /\{.*(\"action\": \"screenshot\"|\"type\": \"screenshot\"|\"image\": \"data:image\/.*\").*\}/,
      );
      if (jsonMatch) {
        const jsonMessage = JSON.parse(jsonMatch[0]);
        if (jsonMessage.image) {
          hasImage = true;
          // 清理文本，移除 JSON action
          text = text.replace(`:\n**Action**: ${jsonMatch[0]}`, '');
          if (jsonMessage.text) {
            text += `\n\n${jsonMessage.text}`;
          }

          // 如果有累积的文本条目，添加为文本组
          if (currentTextEntries.length > 0) {
            groups.push({
              type: 'text',
              textEntries: [...currentTextEntries],
            });
            currentTextEntries = [];
          }

          // 添加到当前视频帧
          currentVideoFrames.push({
            text: text,
            image: jsonMessage.image,
            timestamp: index,
          });
        }
      }
    } catch (e) {
      console.error('解析截图数据失败', e);
    }

    if (!hasImage) {
      // 如果有累积的视频帧，添加为视频组
      if (currentVideoFrames.length > 0) {
        groups.push({
          type: 'video',
          frames: [...currentVideoFrames],
        });
        currentVideoFrames = [];
      }

      // 添加到当前文本条目
      currentTextEntries.push(thought);
    }
  });

  // 添加剩余的帧/条目
  if (currentVideoFrames.length > 0) {
    groups.push({
      type: 'video',
      frames: currentVideoFrames,
    });
  }
  if (currentTextEntries.length > 0) {
    groups.push({
      type: 'text',
      textEntries: currentTextEntries,
    });
  }

  return groups;
}

// ============================================
// 子组件
// ============================================

/**
 * 单条思考项
 */
export function TrainOfThoughtItem(props: TrainOfThoughtItemProps) {
  const extractedHeader = props.message.match(/\*\*(.*)\*\*/);
  const header = extractedHeader ? extractedHeader[1] : '';
  const iconName = chooseIconFromHeader(header);
  const iconColor = props.primary ? convertColorToTextClass(props.agentColor) : 'text-default-400';
  
  let markdownRendered = DOMPurify.sanitize(md.render(props.message));
  // 移除标题标签，避免重复显示
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

/**
 * 视频播放器组件 - 用于播放截图序列
 */
function TrainOfThoughtVideoPlayer(props: TrainOfThoughtVideoPlayerProps) {
  const { frames, autoPlay = false, playbackSpeed = 1500 } = props;
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);

  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentFrameIndex((prev) => {
        if (prev >= frames.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, frames.length, playbackSpeed]);

  if (frames.length === 0) return null;

  const currentFrame = frames[currentFrameIndex];

  return (
    <div className="rounded-lg overflow-hidden bg-default-100 mb-3">
      {/* 图片显示区域 */}
      {currentFrame.image && (
        <div className="relative">
          <img
            src={currentFrame.image}
            alt={`步骤 ${currentFrameIndex + 1}`}
            className="w-full h-auto max-h-64 object-contain"
          />
          {/* 进度条 */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-default-200">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentFrameIndex + 1) / frames.length) * 100}%` }}
            />
          </div>
        </div>
      )}
      
      {/* 控制栏 */}
      <div className="flex items-center justify-between p-2 bg-default-50">
        <div className="flex items-center gap-2">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => setCurrentFrameIndex(Math.max(0, currentFrameIndex - 1))}
            isDisabled={currentFrameIndex === 0}
          >
            <Icon icon="mdi:skip-previous" className="w-4 h-4" />
          </Button>
          
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => setIsPlaying(!isPlaying)}
          >
            <Icon icon={isPlaying ? 'mdi:pause' : 'mdi:play'} className="w-4 h-4" />
          </Button>
          
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => setCurrentFrameIndex(Math.min(frames.length - 1, currentFrameIndex + 1))}
            isDisabled={currentFrameIndex === frames.length - 1}
          >
            <Icon icon="mdi:skip-next" className="w-4 h-4" />
          </Button>
        </div>
        
        <span className="text-xs text-default-400">
          {currentFrameIndex + 1} / {frames.length}
        </span>
      </div>
      
      {/* 当前帧文本 */}
      {currentFrame.text && (
        <div className="p-2 text-sm text-default-500 border-t border-default-200">
          {currentFrame.text}
        </div>
      )}
    </div>
  );
}

// ============================================
// 主组件
// ============================================

/**
 * 思考过程组件
 * 支持折叠/展开、自动折叠、视频播放
 */
export function TrainOfThoughtComponent(props: TrainOfThoughtComponentProps) {
  const [collapsed, setCollapsed] = useState(props.completed);
  const [trainOfThoughtGroups, setTrainOfThoughtGroups] = useState<TrainOfThoughtGroup[]>([]);

  // 动画变体
  const variants = {
    open: {
      height: 'auto',
      opacity: 1,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
    closed: {
      height: 0,
      opacity: 0,
      transition: { duration: 0.3, ease: 'easeIn' },
    },
  } as const;

  // 完成后自动折叠
  useEffect(() => {
    if (props.completed) {
      setCollapsed(true);
    }
  }, [props.completed]);

  // 处理思考数据
  useEffect(() => {
    if (!props.trainOfThought || props.trainOfThought.length === 0) {
      setTrainOfThoughtGroups([]);
      return;
    }

    // 将字符串数组转换为 TrainOfThoughtObject 数组
    let trainOfThoughtObjects: TrainOfThoughtObject[];

    if (typeof props.trainOfThought[0] === 'string') {
      trainOfThoughtObjects = (props.trainOfThought as string[]).map((data) => ({
        type: 'text',
        data: data,
      }));
    } else {
      trainOfThoughtObjects = props.trainOfThought as TrainOfThoughtObject[];
    }

    const groups = extractTrainOfThoughtGroups(trainOfThoughtObjects);
    setTrainOfThoughtGroups(groups);
  }, [props.trainOfThought]);

  // 如果没有思考数据，不渲染
  if (trainOfThoughtGroups.length === 0 && props.completed) {
    return null;
  }

  return (
    <div
      className={`${!collapsed ? 'border border-default-200 bg-default-50' : ''} rounded-lg mb-3`}
      key={props.keyId}
    >
      {/* 加载指示器 */}
      {!props.completed && (
        <div className="flex items-center gap-2 p-2">
          <Spinner size="sm" />
          <span className="text-xs text-default-400">思考中...</span>
        </div>
      )}
      
      {/* 折叠/展开按钮 */}
      {props.completed && (
        collapsed ? (
          <Button
            className="w-fit text-left justify-start content-start text-xs"
            onPress={() => setCollapsed(false)}
            variant="light"
            size="sm"
          >
            <Icon icon="mdi:brain" className="w-4 h-4 mr-1" />
            思考过程
            <Icon icon="mdi:chevron-down" className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            className="w-fit text-left justify-start content-start text-xs p-2"
            onPress={() => setCollapsed(true)}
            variant="light"
            size="sm"
          >
            收起
            <Icon icon="mdi:chevron-up" className="w-4 h-4 ml-1" />
          </Button>
        )
      )}
      
      {/* 思考内容 */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div 
            initial="closed" 
            animate="open" 
            exit="closed" 
            variants={variants}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2">
              {trainOfThoughtGroups.map((group, groupIndex) => (
                <div key={`train-group-${groupIndex}`}>
                  {/* 视频组 */}
                  {group.type === 'video' && group.frames && group.frames.length > 0 && (
                    <TrainOfThoughtVideoPlayer
                      frames={group.frames}
                      autoPlay={false}
                      playbackSpeed={1500}
                    />
                  )}
                  
                  {/* 文本组 */}
                  {group.type === 'text' && group.textEntries && group.textEntries.map((entry, entryIndex) => {
                    const lastIndex = trainOfThoughtGroups.length - 1;
                    const isLastGroup = groupIndex === lastIndex;
                    const isLastEntry = entryIndex === group.textEntries!.length - 1;
                    const isPrimaryEntry = isLastGroup && isLastEntry && props.lastMessage && !props.completed;

                    return (
                      <TrainOfThoughtItem
                        key={`train-text-${groupIndex}-${entryIndex}-${entry.data.length}`}
                        message={entry.data}
                        primary={isPrimaryEntry}
                        agentColor={props.agentColor}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TrainOfThoughtComponent;
