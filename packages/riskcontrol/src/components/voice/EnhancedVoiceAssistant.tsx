/**
 * EnhancedVoiceAssistant 组件 - 增强版语音助手
 * 
 * 基于: LiveKitVoiceAssistant.tsx
 * 改动: 
 * 1. 替换 BarVisualizer 为 OrbVisualizer（类 Siri 球形可视化）
 * 2. 添加 StateIndicator 颜色编码状态显示
 * 3. 优化连接状态动画
 */

import { useState, useCallback, useEffect } from 'react';
import {
  LiveKitRoom,
  useVoiceAssistant,
  RoomAudioRenderer,
  useTrackToggle,
  useMaybeRoomContext,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { cn } from '@/lib/utils';
import { Phone, PhoneOff, Loader2, Mic, MicOff } from 'lucide-react';
import { OrbVisualizer } from './OrbVisualizer';
import { StateIndicator } from './StateIndicator';

interface EnhancedVoiceAssistantProps {
  /** 关闭回调 */
  onClose?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * EnhancedVoiceAssistant - 增强版语音助手组件
 * 
 * 提供语音对话功能，包括：
 * - 类 Siri 球形音频可视化
 * - 颜色编码状态指示器
 * - 自动获取 Token 并连接
 * - 自动重连（最多 3 次，指数退避）
 */
export function EnhancedVoiceAssistant({ onClose, className }: EnhancedVoiceAssistantProps) {
  const [token, setToken] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取 Token 并连接
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: `voice-${Date.now()}`,
          participantName: 'user',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '获取 Token 失败');
      }
      
      const data = await response.json();
      setToken(data.token);
      setUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    setToken('');
    setUrl('');
  }, []);

  // 处理 LiveKit 连接错误
  const handleLiveKitError = useCallback((error: Error) => {
    console.error('LiveKit 连接错误:', error);
    setError('连接失败，请重试');
  }, []);

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      if (token) {
        console.log('EnhancedVoiceAssistant: 组件卸载，清理连接资源');
        disconnect();
      }
    };
  }, [token, disconnect]);

  // 未连接状态 - 显示连接按钮
  if (!token) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center p-8 space-y-6",
        "bg-background rounded-2xl border border-border",
        className
      )}>
        {/* 球形可视化 - 未连接状态 */}
        <OrbVisualizer 
          state={isConnecting ? 'connecting' : 'disconnected'} 
          size={160}
        />
        
        {/* 状态指示器 */}
        <StateIndicator state={isConnecting ? 'connecting' : 'disconnected'} />
        
        {/* 标题 */}
        <div className="text-center">
          <p className="text-foreground font-medium">与 AI 语音助手实时对话</p>
        </div>
        
        {/* 错误提示 */}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}
        
        {/* 连接按钮 */}
        <button
          onClick={connect}
          disabled={isConnecting}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-full",
            "bg-primary text-primary-foreground font-medium",
            "hover:bg-primary/80",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all duration-300"
          )}
        >
          {isConnecting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>连接中...</span>
            </>
          ) : (
            <>
              <Phone size={20} />
              <span>开始通话</span>
            </>
          )}
        </button>
        
        {/* 取消按钮 */}
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            取消
          </button>
        )}
      </div>
    );
  }

  // 已连接状态 - 显示 LiveKit Room
  return (
    <LiveKitRoom
      token={token}
      serverUrl={url}
      connect={true}
      audio={{
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }}
      video={false}
      onDisconnected={disconnect}
      options={{
        reconnectPolicy: {
          nextRetryDelayInMs: (context) => {
            if (context.retryCount >= 3) {
              console.log('LiveKit 重连失败：已达到最大重试次数');
              return null;
            }
            const delay = Math.min(1000 * Math.pow(2, context.retryCount), 10000);
            console.log(`LiveKit 重连尝试 ${context.retryCount + 1}/3，延迟 ${delay}ms`);
            return delay;
          },
        },
      }}
      onError={handleLiveKitError}
      className={cn(
        "bg-background rounded-2xl border border-border",
        className
      )}
    >
      <EnhancedSessionView onClose={onClose} onDisconnect={disconnect} error={error} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// 增强版会话视图
interface EnhancedSessionViewProps {
  onClose?: () => void;
  onDisconnect: () => void;
  error?: string | null;
}

function EnhancedSessionView({ onClose, onDisconnect, error }: EnhancedSessionViewProps) {
  const { state, audioTrack } = useVoiceAssistant();
  
  // 映射 LiveKit AgentState 到我们的状态类型
  const mapState = (agentState: string): 'disconnected' | 'connecting' | 'initializing' | 'listening' | 'thinking' | 'speaking' => {
    switch (agentState) {
      case 'listening':
        return 'listening';
      case 'thinking':
        return 'thinking';
      case 'speaking':
        return 'speaking';
      case 'connecting':
        return 'connecting';
      case 'initializing':
        return 'initializing';
      case 'disconnected':
      default:
        return 'disconnected';
    }
  };
  
  const mappedState = mapState(state);

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      {/* 连接错误提示 */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}
      
      {/* 球形音频可视化 - 类 Siri 风格 */}
      <OrbVisualizer
        state={mappedState}
        audioTrack={audioTrack}
        size={160}
      />
      
      {/* 颜色编码状态指示器 */}
      <div className="px-4 py-2 rounded-full bg-muted">
        <StateIndicator state={mappedState} className="font-medium" />
      </div>
      
      {/* 控制栏 */}
      <EnhancedControlBar onDisconnect={onDisconnect} />
      
      {/* 关闭按钮 */}
      {onClose && (
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          关闭
        </button>
      )}
    </div>
  );
}

// 增强版控制栏组件
interface EnhancedControlBarProps {
  onDisconnect: () => void;
}

function EnhancedControlBar({ onDisconnect }: EnhancedControlBarProps) {
  const room = useMaybeRoomContext();
  const { enabled, toggle, pending } = useTrackToggle({ source: Track.Source.Microphone });

  return (
    <div className="flex items-center gap-3 p-3 rounded-full bg-muted border border-border">
      {/* 麦克风切换 */}
      <button
        onClick={() => toggle()}
        disabled={pending}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full transition-colors",
          enabled 
            ? "bg-green-500/20 text-green-500 hover:bg-green-500/30" 
            : "bg-destructive/20 text-destructive hover:bg-destructive/30",
          pending && "opacity-50 cursor-not-allowed"
        )}
        aria-label={enabled ? '关闭麦克风' : '打开麦克风'}
      >
        {pending ? (
          <Loader2 size={18} className="animate-spin" />
        ) : enabled ? (
          <Mic size={18} />
        ) : (
          <MicOff size={18} />
        )}
      </button>
      
      {/* 挂断按钮 */}
      <button
        onClick={onDisconnect}
        disabled={!room}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full",
          "bg-destructive/10 text-destructive",
          "hover:bg-destructive/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "transition-colors duration-200 font-medium text-sm"
        )}
      >
        <PhoneOff size={16} />
        <span>结束通话</span>
      </button>
    </div>
  );
}

export default EnhancedVoiceAssistant;
