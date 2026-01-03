/**
 * OrbVisualizer 组件 - 类似 Siri 的球形音频可视化
 * 
 * 使用 CSS 动画 + Canvas API 实现不同状态的动画效果：
 * - disconnected: 静止，灰色
 * - connecting: 脉冲呼吸动画，灰色渐变
 * - listening: 缓慢呼吸 + 轻微波动，绿色渐变
 * - thinking: 快速脉冲，蓝色渐变
 * - speaking: 动态波形，紫色渐变
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

export type OrbState = 'disconnected' | 'connecting' | 'initializing' | 'listening' | 'thinking' | 'speaking';

export interface OrbVisualizerProps {
  /** 当前状态 */
  state: OrbState;
  /** 音频轨道引用 (用于音频可视化) */
  audioTrack?: any;
  /** 球体大小 (默认 160) */
  size?: number;
  /** 自定义类名 */
  className?: string;
}

// 颜色配置
const STATE_COLORS = {
  disconnected: { primary: '#6b7280', secondary: '#4b5563', glow: 'rgba(107, 114, 128, 0.3)' },
  connecting: { primary: '#6b7280', secondary: '#9ca3af', glow: 'rgba(107, 114, 128, 0.4)' },
  initializing: { primary: '#6b7280', secondary: '#9ca3af', glow: 'rgba(107, 114, 128, 0.4)' },
  listening: { primary: '#22c55e', secondary: '#4ade80', glow: 'rgba(34, 197, 94, 0.4)' },
  thinking: { primary: '#3b82f6', secondary: '#60a5fa', glow: 'rgba(59, 130, 246, 0.4)' },
  speaking: { primary: '#a855f7', secondary: '#c084fc', glow: 'rgba(168, 85, 247, 0.4)' },
} as const;

// 动画配置
const ANIMATION_CONFIG = {
  disconnected: { breathSpeed: 0, waveSpeed: 0, waveAmplitude: 0, pulseScale: 1 },
  connecting: { breathSpeed: 2, waveSpeed: 0, waveAmplitude: 0, pulseScale: 1.08 },
  initializing: { breathSpeed: 2, waveSpeed: 0, waveAmplitude: 0, pulseScale: 1.08 },
  listening: { breathSpeed: 3, waveSpeed: 1, waveAmplitude: 3, pulseScale: 1.05 },
  thinking: { breathSpeed: 1, waveSpeed: 3, waveAmplitude: 5, pulseScale: 1.1 },
  speaking: { breathSpeed: 0.5, waveSpeed: 4, waveAmplitude: 8, pulseScale: 1.15 },
} as const;

/**
 * OrbVisualizer - 类似 Siri 的球形音频可视化组件
 */
export function OrbVisualizer({ 
  state, 
  audioTrack, 
  size = 160, 
  className 
}: OrbVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const colors = STATE_COLORS[state];
  const config = ANIMATION_CONFIG[state];

  // 初始化音频分析器
  useEffect(() => {
    if (!audioTrack?.publication?.track) return;

    try {
      const mediaStream = new MediaStream([audioTrack.publication.track.mediaStreamTrack]);
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      const source = audioContextRef.current.createMediaStreamSource(mediaStream);
      source.connect(analyserRef.current);
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
    } catch (error) {
      console.warn('音频分析器初始化失败:', error);
    }

    return () => {
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
  }, [audioTrack]);

  // 获取音频级别
  const getAudioLevel = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return 0;
    
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i];
    }
    return sum / dataArrayRef.current.length / 255;
  }, []);

  // Canvas 绘制函数
  const draw = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    const centerX = size / 2;
    const centerY = size / 2;
    const baseRadius = size * 0.35;
    
    // 清除画布
    ctx.clearRect(0, 0, size, size);
    
    // 获取音频级别 (仅在 speaking 状态使用)
    const audioLevel = state === 'speaking' ? getAudioLevel() : 0;
    
    // 计算呼吸效果
    const breathOffset = config.breathSpeed > 0 
      ? Math.sin(time * config.breathSpeed * 0.001) * 0.05 
      : 0;
    
    // 计算脉冲效果
    const pulseOffset = config.breathSpeed > 0
      ? (Math.sin(time * config.breathSpeed * 0.002) + 1) / 2 * (config.pulseScale - 1)
      : 0;
    
    // 最终半径
    const radius = baseRadius * (1 + breathOffset + pulseOffset + audioLevel * 0.2);
    
    // 绘制外发光
    const glowGradient = ctx.createRadialGradient(
      centerX, centerY, radius * 0.8,
      centerX, centerY, radius * 1.5
    );
    glowGradient.addColorStop(0, colors.glow);
    glowGradient.addColorStop(1, 'transparent');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = glowGradient;
    ctx.fill();
    
    // 绘制波形层 (多层叠加)
    const layers = 3;
    for (let layer = layers - 1; layer >= 0; layer--) {
      const layerRadius = radius * (1 - layer * 0.1);
      const layerOpacity = 1 - layer * 0.2;
      
      ctx.beginPath();
      
      if (config.waveAmplitude > 0) {
        // 绘制波形球体
        const points = 64;
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          
          // 波形偏移
          const waveOffset = Math.sin(angle * 4 + time * config.waveSpeed * 0.003) 
            * config.waveAmplitude 
            * (1 + audioLevel * 2);
          
          const x = centerX + Math.cos(angle) * (layerRadius + waveOffset);
          const y = centerY + Math.sin(angle) * (layerRadius + waveOffset);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
      } else {
        // 绘制圆形
        ctx.arc(centerX, centerY, layerRadius, 0, Math.PI * 2);
      }
      
      // 渐变填充
      const gradient = ctx.createRadialGradient(
        centerX - radius * 0.3, centerY - radius * 0.3, 0,
        centerX, centerY, layerRadius
      );
      gradient.addColorStop(0, colors.secondary);
      gradient.addColorStop(0.7, colors.primary);
      gradient.addColorStop(1, colors.primary);
      
      ctx.fillStyle = gradient;
      ctx.globalAlpha = layerOpacity;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    
    // 绘制高光
    const highlightGradient = ctx.createRadialGradient(
      centerX - radius * 0.3, centerY - radius * 0.3, 0,
      centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.5
    );
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    highlightGradient.addColorStop(1, 'transparent');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = highlightGradient;
    ctx.fill();
    
  }, [size, state, colors, config, getAudioLevel]);

  // 动画循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 设置高 DPI 支持
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    
    let startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      draw(ctx, elapsed);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [size, draw]);

  // CSS 动画类名
  const animationClass = useMemo(() => {
    switch (state) {
      case 'connecting':
      case 'initializing':
        return 'animate-pulse';
      case 'thinking':
        return 'animate-pulse';
      default:
        return '';
    }
  }, [state]);

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center",
        "transition-all duration-500 ease-out",
        animationClass,
        className
      )}
      style={{ width: size, height: size }}
    >
      {/* 背景光晕 */}
      <div 
        className={cn(
          "absolute inset-0 rounded-full blur-xl opacity-50",
          "transition-all duration-500"
        )}
        style={{ 
          backgroundColor: colors.glow,
          transform: `scale(${config.pulseScale})`,
        }}
      />
      
      {/* Canvas 绘制层 */}
      <canvas
        ref={canvasRef}
        className="relative z-10"
        style={{ 
          width: size, 
          height: size,
        }}
      />
      
      {/* 状态指示器 (可选) */}
      {state === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="w-2 h-2 bg-white rounded-full animate-ping" />
        </div>
      )}
    </div>
  );
}

export default OrbVisualizer;
