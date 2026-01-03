/**
 * LiveKit Voice Assistant 组件
 * 
 * 基于: https://github.com/livekit-examples/voice-assistant-frontend
 * 改动: 1. 适配 Vite + React 项目  2. 简化为单组件  3. 中文 UI
 */

import { useState, useCallback, useEffect } from 'react';
import {
  LiveKitRoom,
  useVoiceAssistant,
  BarVisualizer,
  RoomAudioRenderer,
  useTrackToggle,
  useMaybeRoomContext,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { cn } from '@/lib/utils';
import { Phone, PhoneOff, Loader2, Mic, MicOff } from 'lucide-react';

interface LiveKitVoiceAssistantProps {
  /** 关闭回调 */
  onClose?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * LiveKit Voice Assistant 主组件
 * 
 * 提供语音对话功能，包括：
 * - 自动获取 Token 并连接
 * - 官方风格音频可视化
 * - 麦克风控制
 * - 自动重连（最多 3 次，指数退避）
 */
export function LiveKitVoiceAssistant({ onClose, className }: LiveKitVoiceAssistantProps) {
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
        console.log('LiveKitVoiceAssistant: 组件卸载，清理连接资源');
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
        {/* 音频图标 */}
        <WelcomeIcon />
        
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
        
        {/* 关闭按钮 */}
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
      <SessionView onClose={onClose} onDisconnect={disconnect} error={error} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// 欢迎图标 - 来自官方前端
function WelcomeIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-foreground mb-4 size-16"
    >
      <path
        d="M15 24V40C15 40.7957 14.6839 41.5587 14.1213 42.1213C13.5587 42.6839 12.7956 43 12 43C11.2044 43 10.4413 42.6839 9.87868 42.1213C9.31607 41.5587 9 40.7957 9 40V24C9 23.2044 9.31607 22.4413 9.87868 21.8787C10.4413 21.3161 11.2044 21 12 21C12.7956 21 13.5587 21.3161 14.1213 21.8787C14.6839 22.4413 15 23.2044 15 24ZM22 5C21.2044 5 20.4413 5.31607 19.8787 5.87868C19.3161 6.44129 19 7.20435 19 8V56C19 56.7957 19.3161 57.5587 19.8787 58.1213C20.4413 58.6839 21.2044 59 22 59C22.7956 59 23.5587 58.6839 24.1213 58.1213C24.6839 57.5587 25 56.7957 25 56V8C25 7.20435 24.6839 6.44129 24.1213 5.87868C23.5587 5.31607 22.7956 5 22 5ZM32 13C31.2044 13 30.4413 13.3161 29.8787 13.8787C29.3161 14.4413 29 15.2044 29 16V48C29 48.7957 29.3161 49.5587 29.8787 50.1213C30.4413 50.6839 31.2044 51 32 51C32.7956 51 33.5587 50.6839 34.1213 50.1213C34.6839 49.5587 35 48.7957 35 48V16C35 15.2044 34.6839 14.4413 34.1213 13.8787C33.5587 13.3161 32.7956 13 32 13ZM42 21C41.2043 21 40.4413 21.3161 39.8787 21.8787C39.3161 22.4413 39 23.2044 39 24V40C39 40.7957 39.3161 41.5587 39.8787 42.1213C40.4413 42.6839 41.2043 43 42 43C42.7957 43 43.5587 42.6839 44.1213 42.1213C44.6839 41.5587 45 40.7957 45 40V24C45 23.2044 44.6839 22.4413 44.1213 21.8787C43.5587 21.3161 42.7957 21 42 21ZM52 17C51.2043 17 50.4413 17.3161 49.8787 17.8787C49.3161 18.4413 49 19.2044 49 20V44C49 44.7957 49.3161 45.5587 49.8787 46.1213C50.4413 46.6839 51.2043 47 52 47C52.7957 47 53.5587 46.6839 54.1213 46.1213C54.6839 45.5587 55 44.7957 55 44V20C55 19.2044 54.6839 18.4413 54.1213 17.8787C53.5587 17.3161 52.7957 17 52 17Z"
        fill="currentColor"
      />
    </svg>
  );
}

// 会话视图 - 基于官方 session-view.tsx
interface SessionViewProps {
  onClose?: () => void;
  onDisconnect: () => void;
  error?: string | null;
}

function SessionView({ onClose, onDisconnect, error }: SessionViewProps) {
  const { state, audioTrack } = useVoiceAssistant();
  
  // 状态映射 - 中文标签
  const stateLabels: Record<string, string> = {
    disconnected: '未连接',
    connecting: '连接中...',
    initializing: '初始化中...',
    listening: '聆听中',
    thinking: '思考中',
    speaking: '说话中',
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      {/* 连接错误提示 */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}
      
      {/* 音频可视化 - 官方风格 */}
      <div className="w-[120px] h-[120px] flex items-center justify-center rounded-lg border border-border bg-muted/50">
        <BarVisualizer
          state={state}
          barCount={5}
          trackRef={audioTrack}
          className="flex h-full items-center justify-center gap-1 p-4"
        />
      </div>
      
      {/* 状态显示 */}
      <div className="px-4 py-2 rounded-full bg-muted">
        <p className="text-sm font-medium text-muted-foreground">
          {stateLabels[state] || state}
        </p>
      </div>
      
      {/* 控制栏 */}
      <ControlBar onDisconnect={onDisconnect} />
      
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

// 控制栏组件
interface ControlBarProps {
  onDisconnect: () => void;
}

function ControlBar({ onDisconnect }: ControlBarProps) {
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
            ? "bg-primary/20 text-primary hover:bg-primary/30" 
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

export default LiveKitVoiceAssistant;
