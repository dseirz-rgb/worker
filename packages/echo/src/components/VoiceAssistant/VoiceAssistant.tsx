// get/blinko-main/app/src/components/VoiceAssistant/VoiceAssistant.tsx
/**
 * 语音助手组件 - 豆包/Siri 风格设计
 * 特点：流动光晕、优雅动画、深色主题
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  LiveKitRoom,
  useVoiceAssistant,
  RoomAudioRenderer,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { BarVisualizer } from './BarVisualizer';
import { clsx } from 'clsx';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'cold-starting';
type MicPermission = 'unknown' | 'granted' | 'denied' | 'prompt';
type AgentState = 'idle' | 'listening' | 'speaking' | 'thinking';

// 冷启动预估时间（秒）
const COLD_START_ESTIMATE_SECONDS = 30;

interface VoiceAssistantProps {
  onConnectionChange?: (state: ConnectionState) => void;
  onError?: (error: Error) => void;
  className?: string;
}

// 状态文字映射
const stateLabels: Record<AgentState, string> = {
  idle: '准备就绪',
  listening: '正在听...',
  speaking: '正在说...',
  thinking: '思考中...',
};

// 麦克风图标
const MicIcon: React.FC<{ className?: string; muted?: boolean }> = ({ className, muted }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
    {muted && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>}
  </svg>
);

// 关闭图标
const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 静音图标
const MuteIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
  </svg>
);

// 全屏图标
const FullscreenIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 内部组件：语音助手 UI
const VoiceAssistantUI: React.FC<{ onDisconnect: () => void }> = ({ onDisconnect }) => {
  const { state, audioTrack } = useVoiceAssistant();
  const room = useRoomContext();
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // 获取本地音频轨道
  const tracks = useTracks([Track.Source.Microphone]);
  const localAudioTrack = tracks.find(t => t.participant.isLocal);
  
  const getAgentState = (): AgentState => {
    switch (state) {
      case 'listening': return 'listening';
      case 'thinking': return 'thinking';
      case 'speaking': return 'speaking';
      default: return 'idle';
    }
  };
  
  // 切换静音
  const toggleMute = useCallback(async () => {
    if (localAudioTrack?.publication) {
      const newMuted = !isMuted;
      await room.localParticipant.setMicrophoneEnabled(!newMuted);
      setIsMuted(newMuted);
    }
  }, [room, localAudioTrack, isMuted]);
  
  // 切换全屏
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);
  
  const agentState = getAgentState();
  
  return (
    <div className="relative flex flex-col items-center justify-between min-h-[500px] w-full py-8">
      {/* 关闭按钮 */}
      <button
        onClick={onDisconnect}
        className={clsx(
          'absolute top-4 right-4 p-2 rounded-full transition-all duration-200',
          'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200',
          'hover:bg-white/10'
        )}
        title="关闭"
      >
        <CloseIcon className="w-5 h-5" />
      </button>
      
      {/* 主要内容区 - 居中 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        {/* 波形可视化 */}
        <BarVisualizer
          state={agentState}
          audioTrack={audioTrack}
          barCount={9}
        />
        
        {/* 状态文字 */}
        <div className="text-center space-y-1 mt-2">
          <p className={clsx(
            'text-lg font-medium transition-colors duration-300',
            agentState === 'listening' && 'text-blue-500',
            agentState === 'speaking' && 'text-emerald-500',
            agentState === 'thinking' && 'text-amber-500',
            agentState === 'idle' && 'text-gray-500 dark:text-gray-400',
          )}>
            {stateLabels[agentState]}
          </p>
          {agentState === 'idle' && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              对着麦克风说话开始对话
            </p>
          )}
        </div>
      </div>
      
      {/* 底部控制栏 - 固定在底部 */}
      <div className="flex items-center gap-4 mt-6">
        {/* 麦克风按钮 */}
        <button
          onClick={toggleMute}
          className={clsx(
            'p-4 rounded-full transition-all duration-200',
            'hover:scale-105 active:scale-95',
            isMuted 
              ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
              : 'bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-white/20'
          )}
          title={isMuted ? '取消静音' : '静音'}
        >
          {isMuted ? <MuteIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}
        </button>
        
        {/* 结束对话按钮 */}
        <button
          onClick={onDisconnect}
          className={clsx(
            'px-8 py-3 rounded-full font-medium transition-all duration-200',
            'bg-red-500 hover:bg-red-600 text-white',
            'hover:scale-105 active:scale-95',
            'shadow-lg shadow-red-500/25'
          )}
        >
          结束对话
        </button>
        
        {/* 全屏按钮 */}
        <button
          onClick={toggleFullscreen}
          className={clsx(
            'p-4 rounded-full transition-all duration-200',
            'bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-white/20',
            'hover:scale-105 active:scale-95'
          )}
          title={isFullscreen ? '退出全屏' : '全屏'}
        >
          <FullscreenIcon className="w-6 h-6" />
        </button>
      </div>
      
      {/* 音频渲染器 */}
      <RoomAudioRenderer />
    </div>
  );
};

// 检查麦克风权限
async function checkMicrophonePermission(): Promise<MicPermission> {
  try {
    if (navigator.permissions) {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state as MicPermission;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// 请求麦克风权限
async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch {
    return false;
  }
}


// 初始状态卡片组件
const InitialCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'warning' | 'error';
}> = ({ icon, title, description, action, variant = 'default' }) => {
  const bgColor = {
    default: 'from-blue-500/20 to-purple-500/20',
    warning: 'from-amber-500/20 to-orange-500/20',
    error: 'from-red-500/20 to-pink-500/20',
  }[variant];
  
  return (
    <div className="flex flex-col items-center justify-center gap-5 p-8 min-h-[400px]">
      {/* 图标容器 */}
      <div className={clsx(
        'w-28 h-28 rounded-full flex items-center justify-center',
        'bg-gradient-to-br',
        bgColor,
        'shadow-2xl',
        'animate-pulse-slow'
      )}>
        {icon}
      </div>
      
      {/* 文字 */}
      <div className="text-center space-y-2">
        <p className={clsx(
          'text-lg font-semibold',
          variant === 'error' && 'text-red-500',
          variant === 'warning' && 'text-amber-500',
          variant === 'default' && 'text-gray-700 dark:text-gray-200'
        )}>
          {title}
        </p>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
            {description}
          </p>
        )}
      </div>
      
      {/* 操作按钮 */}
      {action}
    </div>
  );
};

// 主按钮组件
const PrimaryButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  variant?: 'blue' | 'amber' | 'gray';
}> = ({ onClick, disabled, loading, children, variant = 'blue' }) => {
  const colors = {
    blue: 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-blue-500/30',
    amber: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/30',
    gray: 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 shadow-gray-500/10',
  }[variant];
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        'px-7 py-3 rounded-full font-medium transition-all duration-200',
        'hover:scale-105 active:scale-95',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        'shadow-lg',
        variant !== 'gray' && 'text-white',
        colors
      )}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          处理中...
        </span>
      ) : children}
    </button>
  );
};

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  onConnectionChange,
  onError,
  className,
}) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [token, setToken] = useState<string>('');
  const [serverUrl, setServerUrl] = useState<string>('');
  const [error, setError] = useState<Error | null>(null);
  const [micPermission, setMicPermission] = useState<MicPermission>('unknown');
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);
  const [coldStartCountdown, setColdStartCountdown] = useState(COLD_START_ESTIMATE_SECONDS);
  
  // 冷启动倒计时
  useEffect(() => {
    if (connectionState !== 'cold-starting') {
      setColdStartCountdown(COLD_START_ESTIMATE_SECONDS);
      return;
    }
    
    const timer = setInterval(() => {
      setColdStartCountdown(prev => {
        if (prev <= 1) return 1; // 保持在 1，不归零
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [connectionState]);
  
  // 初始化时检查麦克风权限
  useEffect(() => {
    checkMicrophonePermission().then(setMicPermission);
  }, []);
  
  // 请求麦克风权限
  const handleRequestPermission = useCallback(async () => {
    setIsCheckingPermission(true);
    const granted = await requestMicrophonePermission();
    setMicPermission(granted ? 'granted' : 'denied');
    setIsCheckingPermission(false);
  }, []);
  
  // 获取 token 并连接
  const connect = useCallback(async () => {
    try {
      if (micPermission === 'denied') {
        throw new Error('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风');
      }
      
      if (micPermission !== 'granted') {
        const granted = await requestMicrophonePermission();
        if (!granted) {
          throw new Error('需要麦克风权限才能使用语音助手');
        }
        setMicPermission('granted');
      }
      
      // 先显示冷启动状态
      setConnectionState('cold-starting');
      onConnectionChange?.('connecting');
      setError(null);
      
      // 1. 先预热 Voice Agent 服务（可能需要冷启动）
      const warmupStart = Date.now();
      try {
        const warmupResponse = await fetch('/api/livekit/warmup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!warmupResponse.ok) {
          console.warn('Voice Agent warmup failed, continuing anyway...');
        }
      } catch (warmupErr) {
        console.warn('Voice Agent warmup error:', warmupErr);
        // 预热失败不阻塞，继续尝试连接
      }
      const warmupTime = Date.now() - warmupStart;
      console.log(`Voice Agent warmup took ${warmupTime}ms`);
      
      // 2. 获取 LiveKit token
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: `user_${Date.now()}` }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || '获取连接令牌失败');
      }
      
      const data = await response.json();
      
      if (!data.token || !data.serverUrl) {
        throw new Error('服务器返回的数据不完整');
      }
      
      // 如果预热很快（<3秒），说明服务已经热启动
      if (warmupTime < 3000) {
        setConnectionState('connecting');
      }
      // 否则保持 cold-starting 状态直到 LiveKit 连接成功
      
      setToken(data.token);
      setServerUrl(data.serverUrl);
      setConnectionState('connected');
      onConnectionChange?.('connected');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('连接失败');
      setError(error);
      setConnectionState('error');
      onConnectionChange?.('error');
      onError?.(error);
    }
  }, [onConnectionChange, onError, micPermission]);
  
  // 断开连接
  const disconnect = useCallback(() => {
    setToken('');
    setServerUrl('');
    setConnectionState('disconnected');
    setError(null);
    onConnectionChange?.('disconnected');
  }, [onConnectionChange]);
  
  // 麦克风权限被拒绝
  if (micPermission === 'denied') {
    return (
      <div className={clsx('relative', className)}>
        <InitialCard
          variant="warning"
          icon={<MicIcon className="w-14 h-14 text-amber-500" muted />}
          title="麦克风权限被拒绝"
          description="请在浏览器设置中允许访问麦克风，然后刷新页面重试"
          action={
            <PrimaryButton onClick={() => window.location.reload()} variant="amber">
              刷新页面
            </PrimaryButton>
          }
        />
      </div>
    );
  }
  
  // 需要请求麦克风权限
  if (micPermission === 'prompt' || (micPermission === 'unknown' && connectionState === 'disconnected')) {
    return (
      <div className={clsx('relative', className)}>
        <InitialCard
          icon={<MicIcon className="w-14 h-14 text-blue-500" />}
          title="需要麦克风权限"
          description="语音助手需要访问您的麦克风才能进行对话"
          action={
            <PrimaryButton 
              onClick={handleRequestPermission} 
              loading={isCheckingPermission}
            >
              允许访问麦克风
            </PrimaryButton>
          }
        />
      </div>
    );
  }
  
  // 未连接状态
  if (connectionState === 'disconnected') {
    return (
      <div className={clsx('relative', className)}>
        <InitialCard
          icon={
            <div 
              className="w-full h-full rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
              onClick={connect}
            >
              <MicIcon className="w-14 h-14 text-white" />
            </div>
          }
          title="语音助手"
          description="点击开始与 AI 进行语音对话"
          action={
            <PrimaryButton onClick={connect}>
              开始对话
            </PrimaryButton>
          }
        />
      </div>
    );
  }
  
  // 连接中状态
  if (connectionState === 'connecting') {
    return (
      <div className={clsx('relative', className)}>
        <InitialCard
          icon={
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-spin opacity-50" 
                style={{ animationDuration: '3s' }} 
              />
              <MicIcon className="w-14 h-14 text-blue-500 relative z-10" />
            </div>
          }
          title="正在连接..."
          description="请稍候，正在建立语音连接"
        />
      </div>
    );
  }
  
  // 冷启动状态 - 显示倒计时
  if (connectionState === 'cold-starting') {
    return (
      <div className={clsx('relative', className)}>
        <InitialCard
          icon={
            <div className="relative">
              {/* 外圈进度环 */}
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-gray-200 dark:text-gray-700"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${(1 - coldStartCountdown / COLD_START_ESTIMATE_SECONDS) * 283} 283`}
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
              </svg>
              {/* 中心倒计时数字 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-blue-500">{coldStartCountdown}</span>
              </div>
            </div>
          }
          title="正在唤醒语音助手..."
          description="服务正在启动中，首次连接可能需要 20-30 秒"
        />
      </div>
    );
  }
  
  // 错误状态
  if (connectionState === 'error') {
    return (
      <div className={clsx('relative', className)}>
        <InitialCard
          variant="error"
          icon={
            <svg className="w-14 h-14 text-red-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          }
          title={error?.message || '连接失败'}
          description="请检查网络连接后重试"
          action={
            <div className="flex gap-3">
              <PrimaryButton onClick={connect}>
                重试
              </PrimaryButton>
              <PrimaryButton onClick={disconnect} variant="gray">
                取消
              </PrimaryButton>
            </div>
          }
        />
      </div>
    );
  }
  
  // 已连接状态
  return (
    <div className={clsx('relative', className)}>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        audio={true}
        onDisconnected={disconnect}
      >
        <VoiceAssistantUI onDisconnect={disconnect} />
      </LiveKitRoom>
    </div>
  );
};
