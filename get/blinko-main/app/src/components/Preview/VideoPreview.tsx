/**
 * VideoPreview 组件
 * 视频预览播放器，支持从指定时间戳开始播放
 */

import { useRef, useEffect, useState } from 'react';
import { Card, CardBody, Button, Slider, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';

interface VideoPreviewProps {
  /** 视频文件路径或 URL */
  src: string;
  /** 开始时间（秒） */
  startTime?: number;
  /** 结束时间（秒），用于高亮片段 */
  endTime?: number;
  /** 标题 */
  title?: string;
  /** 是否自动播放 */
  autoPlay?: boolean;
  /** 高度 */
  height?: number | string;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 格式化时间为 MM:SS 或 HH:MM:SS
 */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const VideoPreview = ({
  src,
  startTime = 0,
  endTime,
  title,
  autoPlay = false,
  height = 300,
  onClose,
}: VideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初始化视频
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
      // 跳转到开始时间
      if (startTime > 0) {
        video.currentTime = startTime;
      }
      if (autoPlay) {
        video.play().catch(() => {});
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      setError('视频加载失败');
      setIsLoading(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
    };
  }, [src, startTime, autoPlay]);

  // 播放/暂停
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  };

  // 跳转到指定时间
  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
  };

  // 跳转到开始时间
  const jumpToStart = () => {
    seekTo(startTime);
  };

  // 快进/快退
  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  return (
    <Card className="w-full overflow-hidden">
      {/* 标题栏 */}
      {(title || onClose) && (
        <div className="flex items-center justify-between px-4 py-2 bg-default-100">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:video" className="text-primary" />
            <span className="font-medium text-sm truncate">{title || '视频预览'}</span>
          </div>
          {onClose && (
            <Button size="sm" variant="light" isIconOnly onPress={onClose}>
              <Icon icon="mdi:close" />
            </Button>
          )}
        </div>
      )}

      <CardBody className="p-0">
        {/* 视频播放器 */}
        <div className="relative bg-black" style={{ height }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon icon="mdi:loading" className="text-4xl text-white animate-spin" />
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
              <Icon icon="mdi:alert-circle" className="text-4xl mb-2" />
              <span>{error}</span>
            </div>
          )}

          <video
            ref={videoRef}
            src={src}
            className="w-full h-full object-contain"
            playsInline
          />

          {/* 时间戳标记 */}
          {startTime > 0 && (
            <Chip
              size="sm"
              color="primary"
              variant="solid"
              className="absolute top-2 left-2"
            >
              从 {formatTime(startTime)} 开始
            </Chip>
          )}
        </div>

        {/* 控制栏 */}
        <div className="p-3 space-y-2">
          {/* 进度条 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-default-500 w-12">
              {formatTime(currentTime)}
            </span>
            <Slider
              size="sm"
              step={0.1}
              maxValue={duration || 100}
              minValue={0}
              value={currentTime}
              onChange={(value) => seekTo(value as number)}
              className="flex-1"
              renderThumb={(props) => (
                <div
                  {...props}
                  className="w-3 h-3 bg-primary rounded-full cursor-pointer"
                />
              )}
            />
            <span className="text-xs text-default-500 w-12 text-right">
              {formatTime(duration)}
            </span>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center justify-center gap-2">
            {/* 跳转到开始时间 */}
            {startTime > 0 && (
              <Button
                size="sm"
                variant="flat"
                onPress={jumpToStart}
                startContent={<Icon icon="mdi:skip-backward" />}
              >
                跳转到匹配位置
              </Button>
            )}
            
            {/* 快退 */}
            <Button size="sm" variant="light" isIconOnly onPress={() => skip(-10)}>
              <Icon icon="mdi:rewind-10" />
            </Button>

            {/* 播放/暂停 */}
            <Button
              size="md"
              color="primary"
              isIconOnly
              onPress={togglePlay}
            >
              <Icon icon={isPlaying ? 'mdi:pause' : 'mdi:play'} className="text-xl" />
            </Button>

            {/* 快进 */}
            <Button size="sm" variant="light" isIconOnly onPress={() => skip(10)}>
              <Icon icon="mdi:fast-forward-10" />
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default VideoPreview;
