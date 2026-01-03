/**
 * useAudioAnalyzer Hook - 音频频率分析
 * 
 * 基于: 项目内 OrbVisualizer.tsx 中的音频分析逻辑
 * 改动: 1. 提取为独立 Hook  2. 添加频段数据  3. 增强错误处理和降级逻辑
 * 
 * 使用 Web Audio API 分析音频频率，返回频率数据、音量和频段信息
 * 用于音频可视化组件
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 音频分析数据接口
 */
export interface AudioAnalysisData {
  /** 原始频率数据 (0-255) */
  frequencyData: Uint8Array;
  /** 平均音量 (0-1) */
  volume: number;
  /** 频段数据 (用于可视化，默认 8 个频段，值范围 0-1) */
  bands: number[];
}

/**
 * Hook 配置选项
 */
export interface UseAudioAnalyzerOptions {
  /** FFT 大小，必须是 2 的幂次方 (默认 256) */
  fftSize?: number;
  /** 频段数量 (默认 8) */
  bandCount?: number;
  /** 平滑时间常数 (0-1，默认 0.8) */
  smoothingTimeConstant?: number;
  /** 是否启用分析 (默认 true) */
  enabled?: boolean;
}

/** 默认配置 */
const DEFAULT_OPTIONS: Required<UseAudioAnalyzerOptions> = {
  fftSize: 256,
  bandCount: 8,
  smoothingTimeConstant: 0.8,
  enabled: true,
};

/** 创建空的频率数据数组 */
const createEmptyFrequencyData = (): Uint8Array => new Uint8Array(128);

/** 空数据（降级时使用） */
const EMPTY_DATA: AudioAnalysisData = {
  frequencyData: createEmptyFrequencyData(),
  volume: 0,
  bands: Array(8).fill(0),
};

/**
 * 计算频段数据（纯函数）
 * 将频率数据分组为指定数量的频段
 */
function calculateBandsFromData(dataArray: Uint8Array<ArrayBufferLike>, count: number): number[] {
  if (dataArray.length === 0) return Array(count).fill(0);

  const bands: number[] = [];
  const binCount = dataArray.length;
  const binsPerBand = Math.floor(binCount / count);

  for (let i = 0; i < count; i++) {
    const start = i * binsPerBand;
    const end = Math.min(start + binsPerBand, binCount);
    
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += dataArray[j];
    }
    
    // 归一化到 0-1 范围
    const average = sum / (end - start);
    bands.push(average / 255);
  }

  return bands;
}

/**
 * 计算平均音量（纯函数）
 */
function calculateVolumeFromData(dataArray: Uint8Array<ArrayBufferLike>): number {
  if (dataArray.length === 0) return 0;

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  
  return sum / dataArray.length / 255;
}

/**
 * 音频频率分析 Hook
 * 
 * 使用 Web Audio API 分析来自 LiveKit 的音频轨道，
 * 返回频率数据、音量和频段信息，用于音频可视化。
 * 
 * @param audioTrack - LiveKit 音频轨道引用 (来自 useVoiceAssistant)
 * @param options - 配置选项
 * @returns 音频分析数据
 * 
 * @example
 * ```tsx
 * function VoiceVisualizer() {
 *   const { audioTrack } = useVoiceAssistant();
 *   const { volume, bands } = useAudioAnalyzer(audioTrack);
 *   
 *   return (
 *     <div>
 *       <p>音量: {(volume * 100).toFixed(0)}%</p>
 *       {bands.map((band, i) => (
 *         <div key={i} style={{ height: `${band * 100}%` }} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAudioAnalyzer(
  audioTrack?: unknown,
  options: UseAudioAnalyzerOptions = {}
): AudioAnalysisData {
  const {
    fftSize,
    bandCount,
    smoothingTimeConstant,
    enabled,
  } = { ...DEFAULT_OPTIONS, ...options };

  // 状态
  const [analysisData, setAnalysisData] = useState<AudioAnalysisData>(EMPTY_DATA);

  // Refs - 避免重复创建
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array<ArrayBufferLike> | null>(null);
  const bandCountRef = useRef(bandCount);

  // 更新 bandCount ref
  useEffect(() => {
    bandCountRef.current = bandCount;
  }, [bandCount]);

  /**
   * 分析循环
   */
  const analyze = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) {
      animationFrameRef.current = requestAnimationFrame(analyze);
      return;
    }

    // 获取频率数据到预分配的数组
    // @ts-expect-error TypeScript 5.x Uint8Array 泛型类型兼容性问题
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);

    // 计算分析数据
    const currentData = dataArrayRef.current;
    const volume = calculateVolumeFromData(currentData);
    const bands = calculateBandsFromData(currentData, bandCountRef.current);

    // 创建副本用于状态更新（避免引用问题）
    // 使用 Array.from 转换以避免 TypeScript 5.x 的 Uint8Array 泛型类型问题
    const frequencyDataCopy = new Uint8Array(Array.from(currentData));

    setAnalysisData({
      frequencyData: frequencyDataCopy,
      volume,
      bands,
    });

    animationFrameRef.current = requestAnimationFrame(analyze);
  }, []);

  /**
   * 初始化音频分析器
   */
  useEffect(() => {
    // 检查是否启用
    if (!enabled) {
      setAnalysisData(EMPTY_DATA);
      return;
    }

    // 检查音频轨道是否可用
    // LiveKit 的 audioTrack 结构: audioTrack?.publication?.track?.mediaStreamTrack
    const track = audioTrack as { publication?: { track?: { mediaStreamTrack?: MediaStreamTrack } } } | undefined;
    const mediaStreamTrack = track?.publication?.track?.mediaStreamTrack;
    
    if (!mediaStreamTrack) {
      // 音频轨道不可用，返回空数据（优雅降级）
      setAnalysisData(EMPTY_DATA);
      return;
    }

    // 检查浏览器支持
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('[useAudioAnalyzer] 浏览器不支持 Web Audio API，使用降级模式');
      setAnalysisData(EMPTY_DATA);
      return;
    }

    let isCleanedUp = false;

    const initializeAnalyzer = async () => {
      try {
        // 创建 AudioContext
        audioContextRef.current = new AudioContextClass();

        // 创建 AnalyserNode
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = fftSize;
        analyserRef.current.smoothingTimeConstant = smoothingTimeConstant;

        // 创建 MediaStream 并连接
        const mediaStream = new MediaStream([mediaStreamTrack]);
        sourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStream);
        sourceRef.current.connect(analyserRef.current);

        // 初始化数据数组
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);

        // 恢复 AudioContext（某些浏览器需要用户交互后才能播放）
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        // 开始分析循环
        if (!isCleanedUp) {
          animationFrameRef.current = requestAnimationFrame(analyze);
        }

      } catch (error) {
        console.warn('[useAudioAnalyzer] 初始化失败，使用降级模式:', error);
        setAnalysisData(EMPTY_DATA);
      }
    };

    initializeAnalyzer();

    // 清理函数
    return () => {
      isCleanedUp = true;

      // 取消动画帧
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }

      // 断开连接
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {
          // 忽略断开连接错误
        }
        sourceRef.current = null;
      }

      // 关闭 AudioContext
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {
          // 忽略关闭错误
        });
        audioContextRef.current = null;
      }

      analyserRef.current = null;
      dataArrayRef.current = null;
    };
  }, [audioTrack, enabled, fftSize, smoothingTimeConstant, analyze]);

  return analysisData;
}

export default useAudioAnalyzer;
