/**
 * 语音录制组件
 * 
 * 功能：
 * - 录音按钮和状态显示
 * - 音量可视化
 * - 录音时长显示
 * - 暂停/继续/取消操作
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Mic,
  MicOff,
  Square,
  Pause,
  Play,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AudioRecorder,
  formatDuration,
  isRecordingSupported,
  createVoiceNote,
  type RecordingState,
} from '@/services/voice';
import type { VoiceNote, VoiceNoteStatus, LifeDomain } from '@/types/database';

// ==================
// 类型定义
// ==================

interface VoiceRecorderProps {
  /** 录音完成回调 */
  onRecordingComplete?: (voiceNote: VoiceNote) => void;
  /** 录音取消回调 */
  onCancel?: () => void;
  /** 默认领域 */
  defaultDomain?: LifeDomain;
  /** 自定义类名 */
  className?: string;
  /** 紧凑模式 */
  compact?: boolean;
}

// ==================
// 组件实现
// ==================

export function VoiceRecorder({
  onRecordingComplete,
  onCancel,
  defaultDomain = 'general',
  className,
  compact = false,
}: VoiceRecorderProps) {
  // 状态
  const [isSupported, setIsSupported] = React.useState(true);
  const [recordingState, setRecordingState] = React.useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
  });
  const [audioLevel, setAudioLevel] = React.useState(0);
  const [processingStatus, setProcessingStatus] = React.useState<VoiceNoteStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Refs
  const recorderRef = React.useRef<AudioRecorder | null>(null);
  const durationIntervalRef = React.useRef<number | null>(null);

  // 检查浏览器支持
  React.useEffect(() => {
    setIsSupported(isRecordingSupported());
  }, []);

  // 清理
  React.useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      recorderRef.current?.cancel();
    };
  }, []);

  // 开始录音
  const handleStartRecording = async () => {
    try {
      setError(null);
      
      const recorder = new AudioRecorder();
      recorderRef.current = recorder;

      recorder.setOnStateChange(setRecordingState);
      recorder.setOnAudioLevel(setAudioLevel);

      await recorder.start();

      // 更新时长显示
      durationIntervalRef.current = window.setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          duration: recorder.getDuration(),
        }));
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '录音失败');
    }
  };

  // 暂停录音
  const handlePauseRecording = () => {
    recorderRef.current?.pause();
  };

  // 继续录音
  const handleResumeRecording = () => {
    recorderRef.current?.resume();
  };

  // 停止录音并处理
  const handleStopRecording = async () => {
    if (!recorderRef.current) return;

    try {
      // 清除时长更新
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // 停止录音
      const { blob, duration } = await recorderRef.current.stop();
      recorderRef.current = null;

      // 重置录音状态
      setRecordingState({
        isRecording: false,
        isPaused: false,
        duration: 0,
        audioLevel: 0,
      });

      // 开始处理
      setProcessingStatus('transcribing');

      const voiceNote = await createVoiceNote(
        {
          audioBlob: blob,
          audioDuration: duration,
          domain: defaultDomain,
        },
        setProcessingStatus
      );

      // 完成
      setProcessingStatus(null);
      onRecordingComplete?.(voiceNote);
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败');
      setProcessingStatus(null);
    }
  };

  // 取消录音
  const handleCancelRecording = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    recorderRef.current?.cancel();
    recorderRef.current = null;

    setRecordingState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioLevel: 0,
    });

    onCancel?.();
  };

  // 不支持录音
  if (!isSupported) {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground', className)}>
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">您的浏览器不支持录音功能</span>
      </div>
    );
  }

  // 处理中状态
  if (processingStatus) {
    return (
      <Card className={cn('', className)}>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">
                {processingStatus === 'transcribing' && '正在转写...'}
                {processingStatus === 'processing' && '正在智能分析...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {processingStatus === 'transcribing' && '将语音转换为文字'}
                {processingStatus === 'processing' && '提取行动项和关键信息'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 紧凑模式 - 只显示录音按钮
  if (compact && !recordingState.isRecording) {
    return (
      <Button
        variant="outline"
        size="icon"
        className={cn('h-8 w-8', className)}
        onClick={handleStartRecording}
        title="语音输入"
      >
        <Mic className="h-4 w-4" />
      </Button>
    );
  }

  // 录音中状态
  if (recordingState.isRecording || recordingState.isPaused) {
    return (
      <Card className={cn('', className)}>
        <CardContent className="py-4">
          <div className="space-y-4">
            {/* 录音状态和时长 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'h-3 w-3 rounded-full',
                    recordingState.isPaused
                      ? 'bg-yellow-500'
                      : 'bg-red-500 animate-pulse'
                  )}
                />
                <span className="text-sm font-medium">
                  {recordingState.isPaused ? '已暂停' : '录音中'}
                </span>
              </div>
              <span className="text-lg font-mono">
                {formatDuration(recordingState.duration)}
              </span>
            </div>

            {/* 音量可视化 */}
            <div className="h-8 flex items-center gap-0.5">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 rounded-full transition-all duration-75',
                    i / 20 < audioLevel
                      ? 'bg-primary'
                      : 'bg-muted'
                  )}
                  style={{
                    height: `${Math.max(4, Math.random() * 100 * audioLevel)}%`,
                  }}
                />
              ))}
            </div>

            {/* 控制按钮 */}
            <div className="flex items-center justify-center gap-2">
              {/* 取消按钮 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancelRecording}
                title="取消"
              >
                <X className="h-5 w-5" />
              </Button>

              {/* 暂停/继续按钮 */}
              <Button
                variant="outline"
                size="icon"
                onClick={recordingState.isPaused ? handleResumeRecording : handlePauseRecording}
                title={recordingState.isPaused ? '继续' : '暂停'}
              >
                {recordingState.isPaused ? (
                  <Play className="h-5 w-5" />
                ) : (
                  <Pause className="h-5 w-5" />
                )}
              </Button>

              {/* 停止按钮 */}
              <Button
                variant="default"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={handleStopRecording}
                title="完成"
              >
                <Square className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 默认状态 - 显示开始录音按钮
  return (
    <div className={cn('space-y-2', className)}>
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
      
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={handleStartRecording}
      >
        <Mic className="h-4 w-4" />
        开始语音录制
      </Button>
      
      <p className="text-xs text-muted-foreground text-center">
        点击开始录音，完成后自动转写并提取行动项
      </p>
    </div>
  );
}

// ==================
// 浮动录音按钮
// ==================

interface FloatingVoiceButtonProps {
  onRecordingComplete?: (voiceNote: VoiceNote) => void;
  defaultDomain?: LifeDomain;
  className?: string;
}

export function FloatingVoiceButton({
  onRecordingComplete,
  defaultDomain = 'general',
  className,
}: FloatingVoiceButtonProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleComplete = (voiceNote: VoiceNote) => {
    setIsExpanded(false);
    onRecordingComplete?.(voiceNote);
  };

  const handleCancel = () => {
    setIsExpanded(false);
  };

  if (isExpanded) {
    return (
      <div className={cn('fixed bottom-20 right-4 z-50 w-72', className)}>
        <VoiceRecorder
          onRecordingComplete={handleComplete}
          onCancel={handleCancel}
          defaultDomain={defaultDomain}
        />
      </div>
    );
  }

  return (
    <Button
      variant="default"
      size="icon"
      className={cn(
        'fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg',
        className
      )}
      onClick={() => setIsExpanded(true)}
    >
      <Mic className="h-6 w-6" />
    </Button>
  );
}

export default VoiceRecorder;
