/**
 * Voice Call Page
 * 
 * 基于 LiveKit 的语音通话页面
 * 使用 EnhancedVoiceAssistant 组件实现语音对话（类 Siri 风格）
 */

import React from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { EnhancedVoiceAssistant } from '@/components/voice/EnhancedVoiceAssistant';

export default function VoiceCall() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0b0f] via-[#0d0e14] to-[#0f1015] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 safe-area-top">
        <button
          onClick={() => setLocation('/')}
          className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={20} className="text-white/70" />
        </button>
        <div className="text-white/50 text-sm">语音助手</div>
        <div className="w-10" /> {/* Spacer for alignment */}
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <EnhancedVoiceAssistant 
          onClose={() => setLocation('/')}
          className="w-full max-w-md"
        />
      </div>

      {/* Safe area bottom padding */}
      <div className="h-4 safe-area-bottom" />
    </div>
  );
}
