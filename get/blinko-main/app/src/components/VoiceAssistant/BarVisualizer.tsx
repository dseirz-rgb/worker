// get/blinko-main/app/src/components/VoiceAssistant/BarVisualizer.tsx
/**
 * 语音波形可视化组件
 * 采用流动光晕设计，类似 Siri/豆包 的视觉效果
 */
import React, { useEffect, useRef, useState } from 'react';
import { useAudioWaveform, TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { clsx } from 'clsx';

type AgentState = 'idle' | 'listening' | 'speaking' | 'thinking';

interface BarVisualizerProps {
  state: AgentState;
  audioTrack?: TrackReferenceOrPlaceholder;
  barCount?: number;
  className?: string;
}

// 流动光晕组件 - 类似 Siri 的球形效果
const GlowOrb: React.FC<{ state: AgentState; audioLevel: number }> = ({ state, audioLevel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const size = 200;
    canvas.width = size * 2;
    canvas.height = size * 2;
    
    const animate = () => {
      timeRef.current += 0.02;
      const t = timeRef.current;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = size;
      const centerY = size;
      
      // 根据状态调整颜色和动画
      const getColors = () => {
        switch (state) {
          case 'listening':
            return {
              primary: `hsla(220, 90%, 60%, ${0.6 + audioLevel * 0.3})`,
              secondary: `hsla(280, 80%, 55%, ${0.5 + audioLevel * 0.3})`,
              tertiary: `hsla(200, 85%, 50%, ${0.4 + audioLevel * 0.2})`,
            };
          case 'speaking':
            return {
              primary: `hsla(150, 80%, 50%, ${0.6 + audioLevel * 0.3})`,
              secondary: `hsla(180, 70%, 45%, ${0.5 + audioLevel * 0.3})`,
              tertiary: `hsla(120, 75%, 55%, ${0.4 + audioLevel * 0.2})`,
            };
          case 'thinking':
            return {
              primary: 'hsla(45, 90%, 55%, 0.6)',
              secondary: 'hsla(30, 85%, 50%, 0.5)',
              tertiary: 'hsla(60, 80%, 60%, 0.4)',
            };
          default:
            return {
              primary: 'hsla(240, 60%, 50%, 0.4)',
              secondary: 'hsla(260, 50%, 45%, 0.3)',
              tertiary: 'hsla(220, 55%, 55%, 0.25)',
            };
        }
      };
      
      const colors = getColors();
      const baseRadius = 60 + audioLevel * 30;
      const pulseSpeed = state === 'idle' ? 0.5 : state === 'thinking' ? 1.5 : 1;
      
      // 绘制多层流动光晕
      for (let layer = 3; layer >= 0; layer--) {
        const layerOffset = layer * 0.5;
        const radius = baseRadius + layer * 15 + Math.sin(t * pulseSpeed + layerOffset) * (10 + audioLevel * 15);
        
        const gradient = ctx.createRadialGradient(
          centerX + Math.sin(t + layerOffset) * 10,
          centerY + Math.cos(t * 0.8 + layerOffset) * 10,
          0,
          centerX,
          centerY,
          radius * 1.5
        );
        
        const alpha = (0.3 - layer * 0.05) * (state === 'idle' ? 0.6 : 1);
        gradient.addColorStop(0, colors.primary);
        gradient.addColorStop(0.4, colors.secondary);
        gradient.addColorStop(0.7, colors.tertiary);
        gradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
      
      // 核心发光点
      const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 30);
      coreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      coreGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
      coreGradient.addColorStop(1, 'transparent');
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30 + audioLevel * 10, 0, Math.PI * 2);
      ctx.fillStyle = coreGradient;
      ctx.fill();
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [state, audioLevel]);
  
  return (
    <canvas
      ref={canvasRef}
      className="w-48 h-48"
      style={{ filter: 'blur(1px)' }}
    />
  );
};

// 波形条组件
const WaveBars: React.FC<{ bars: number[]; state: AgentState }> = ({ bars, state }) => {
  const getBarStyle = (index: number, height: number) => {
    const baseColor = state === 'listening' 
      ? 'from-blue-400 to-purple-500'
      : state === 'speaking'
      ? 'from-emerald-400 to-cyan-500'
      : state === 'thinking'
      ? 'from-amber-400 to-orange-500'
      : 'from-slate-400 to-slate-500';
    
    return {
      height: `${Math.max(15, height)}%`,
      animationDelay: `${index * 50}ms`,
    };
  };
  
  return (
    <div className="flex items-center justify-center gap-1.5 h-12 px-4">
      {bars.map((height, index) => (
        <div
          key={index}
          className={clsx(
            'w-1.5 rounded-full transition-all duration-100 ease-out',
            'bg-gradient-to-t',
            state === 'listening' && 'from-blue-400 to-purple-500',
            state === 'speaking' && 'from-emerald-400 to-cyan-500',
            state === 'thinking' && 'from-amber-400 to-orange-500',
            state === 'idle' && 'from-slate-500 to-slate-400',
          )}
          style={getBarStyle(index, height)}
        />
      ))}
    </div>
  );
};

export const BarVisualizer: React.FC<BarVisualizerProps> = ({
  state,
  audioTrack,
  barCount = 9,
  className,
}) => {
  const { bars } = useAudioWaveform(audioTrack, { barCount });
  const [audioLevel, setAudioLevel] = useState(0);
  
  // 计算平均音频电平
  useEffect(() => {
    if (bars.length > 0) {
      const avg = bars.reduce((sum, val) => sum + val, 0) / bars.length / 100;
      setAudioLevel(Math.min(1, avg));
    }
  }, [bars]);
  
  return (
    <div className={clsx('flex flex-col items-center gap-4', className)}>
      <GlowOrb state={state} audioLevel={state === 'idle' ? 0.1 : audioLevel} />
      <WaveBars bars={bars} state={state} />
    </div>
  );
};
