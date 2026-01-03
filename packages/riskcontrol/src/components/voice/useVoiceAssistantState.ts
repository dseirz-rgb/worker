/**
 * Voice Assistant 状态管理 Hook
 * 
 * 基于: https://github.com/livekit/components-js
 * 改动: 1. 添加转录数据处理  2. 集成到现有类型系统
 */

import { useState, useCallback, useEffect } from 'react';
import { useRoomContext, useParticipants } from '@livekit/components-react';
import { RoomEvent, DataPacket_Kind, Participant, RemoteParticipant } from 'livekit-client';

/**
 * 转录条目接口
 */
export interface TranscriptItem {
  /** 唯一标识 */
  id: string;
  /** 转录文本 */
  text: string;
  /** 角色：用户或助手 */
  role: 'user' | 'assistant';
  /** 时间戳 */
  timestamp: Date;
  /** 是否为最终结果（非中间结果） */
  isFinal: boolean;
}

/**
 * 数据包类型定义
 */
interface TranscriptData {
  type: 'transcript';
  text: string;
  role: 'user' | 'assistant';
  isFinal?: boolean;
}

/**
 * Hook 返回值类型
 */
export interface UseVoiceAssistantStateReturn {
  /** 转录记录列表 */
  transcripts: TranscriptItem[];
  /** 错误信息 */
  error: string | null;
  /** 清除转录记录 */
  clearTranscripts: () => void;
  /** 是否有 Agent 参与者 */
  hasAgent: boolean;
  /** Agent 参与者信息 */
  agentParticipant: Participant | undefined;
}

/**
 * Voice Assistant 状态管理 Hook
 * 
 * 提供以下功能：
 * - 监听并收集转录数据
 * - 管理错误状态
 * - 检测 Agent 参与者
 * 
 * @returns {UseVoiceAssistantStateReturn} 状态和方法
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { transcripts, clearTranscripts, hasAgent } = useVoiceAssistantState();
 *   
 *   return (
 *     <div>
 *       {transcripts.map(t => <p key={t.id}>{t.text}</p>)}
 *       <button onClick={clearTranscripts}>清除</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useVoiceAssistantState(): UseVoiceAssistantStateReturn {
  const room = useRoomContext();
  const participants = useParticipants();
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 查找 Agent 参与者（通常以 agent- 开头或有特定元数据）
  const agentParticipant = participants.find(p => 
    p.identity.startsWith('agent-') || 
    p.metadata?.includes('agent')
  );
  const hasAgent = !!agentParticipant;

  // 监听转录数据
  useEffect(() => {
    if (!room) return;

    const handleData = (
      payload: Uint8Array, 
      _participant?: RemoteParticipant, 
      _kind?: DataPacket_Kind
    ) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text) as TranscriptData;
        
        // 只处理转录类型的数据
        if (data.type === 'transcript') {
          const newTranscript: TranscriptItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            text: data.text,
            role: data.role,
            timestamp: new Date(),
            isFinal: data.isFinal ?? true,
          };
          
          setTranscripts(prev => {
            // 如果是中间结果，更新最后一条同角色的记录
            if (!newTranscript.isFinal) {
              const lastIndex = prev.findLastIndex(t => t.role === newTranscript.role && !t.isFinal);
              if (lastIndex !== -1) {
                const updated = [...prev];
                updated[lastIndex] = newTranscript;
                return updated;
              }
            }
            return [...prev, newTranscript];
          });
        }
      } catch (e) {
        // 忽略非 JSON 数据，这是正常的
        // 可能是其他类型的数据包
      }
    };

    // 监听断开连接
    const handleDisconnected = () => {
      setError(null);
    };

    room.on(RoomEvent.DataReceived, handleData);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
      room.off(RoomEvent.Disconnected, handleDisconnected);
    };
  }, [room]);

  // 清除转录记录
  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setError(null);
  }, []);

  return {
    transcripts,
    error,
    clearTranscripts,
    hasAgent,
    agentParticipant,
  };
}

export default useVoiceAssistantState;
