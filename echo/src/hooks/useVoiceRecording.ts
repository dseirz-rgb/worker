/**
 * 语音录制 Hook
 * 
 * 提供语音录制的状态管理和操作方法
 */

import * as React from 'react';
import {
  AudioRecorder,
  createVoiceNote,
  getAllVoiceNotes,
  deleteVoiceNote,
  isRecordingSupported,
  type RecordingState,
} from '@/services/voice';
import type { VoiceNote, VoiceNoteStatus, LifeDomain } from '@/types/database';

// ==================
// 类型定义
// ==================

interface UseVoiceRecordingOptions {
  /** 默认领域 */
  defaultDomain?: LifeDomain;
  /** 录音完成回调 */
  onRecordingComplete?: (voiceNote: VoiceNote) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

interface UseVoiceRecordingReturn {
  // 状态
  isSupported: boolean;
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  processingStatus: VoiceNoteStatus | null;
  error: string | null;
  
  // 语音笔记列表
  voiceNotes: VoiceNote[];
  
  // 操作方法
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<VoiceNote | null>;
  cancelRecording: () => void;
  deleteVoiceNote: (id: string) => void;
  refreshVoiceNotes: () => void;
  clearError: () => void;
}

// ==================
// Hook 实现
// ==================

export function useVoiceRecording(
  options: UseVoiceRecordingOptions = {}
): UseVoiceRecordingReturn {
  const { defaultDomain = 'general', onRecordingComplete, onError } = options;

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
  const [voiceNotes, setVoiceNotes] = React.useState<VoiceNote[]>([]);

  // Refs
  const recorderRef = React.useRef<AudioRecorder | null>(null);
  const durationIntervalRef = React.useRef<number | null>(null);

  // 检查浏览器支持
  React.useEffect(() => {
    setIsSupported(isRecordingSupported());
  }, []);

  // 加载语音笔记列表
  React.useEffect(() => {
    refreshVoiceNotes();
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

  // 刷新语音笔记列表
  const refreshVoiceNotes = React.useCallback(() => {
    setVoiceNotes(getAllVoiceNotes());
  }, []);

  // 开始录音
  const startRecording = React.useCallback(async () => {
    try {
      setError(null);

      const recorder = new AudioRecorder();
      recorderRef.current = recorder;

      recorder.setOnStateChange(setRecordingState);
      recorder.setOnAudioLevel(setAudioLevel);

      await recorder.start();

      // 更新时长显示
      durationIntervalRef.current = window.setInterval(() => {
        setRecordingState((prev) => ({
          ...prev,
          duration: recorder.getDuration(),
        }));
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '录音失败';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [onError]);

  // 暂停录音
  const pauseRecording = React.useCallback(() => {
    recorderRef.current?.pause();
  }, []);

  // 继续录音
  const resumeRecording = React.useCallback(() => {
    recorderRef.current?.resume();
  }, []);

  // 停止录音并处理
  const stopRecording = React.useCallback(async (): Promise<VoiceNote | null> => {
    if (!recorderRef.current) return null;

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
      refreshVoiceNotes();
      onRecordingComplete?.(voiceNote);

      return voiceNote;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '处理失败';
      setError(errorMessage);
      setProcessingStatus(null);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      return null;
    }
  }, [defaultDomain, onRecordingComplete, onError, refreshVoiceNotes]);

  // 取消录音
  const cancelRecording = React.useCallback(() => {
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
  }, []);

  // 删除语音笔记
  const handleDeleteVoiceNote = React.useCallback((id: string) => {
    deleteVoiceNote(id);
    refreshVoiceNotes();
  }, [refreshVoiceNotes]);

  // 清除错误
  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    // 状态
    isSupported,
    isRecording: recordingState.isRecording,
    isPaused: recordingState.isPaused,
    duration: recordingState.duration,
    audioLevel,
    processingStatus,
    error,
    
    // 语音笔记列表
    voiceNotes,
    
    // 操作方法
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    deleteVoiceNote: handleDeleteVoiceNote,
    refreshVoiceNotes,
    clearError,
  };
}

export default useVoiceRecording;
