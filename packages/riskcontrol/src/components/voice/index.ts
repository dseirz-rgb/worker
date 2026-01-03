/**
 * Voice 组件模块导出
 * 
 * 提供语音助手相关组件和 Hooks
 */

// 主组件
export { LiveKitVoiceAssistant } from './LiveKitVoiceAssistant';
export { EnhancedVoiceAssistant } from './EnhancedVoiceAssistant';

// 可视化组件
export { OrbVisualizer } from './OrbVisualizer';
export { StateIndicator } from './StateIndicator';

// 状态管理 Hook
export { useVoiceAssistantState } from './useVoiceAssistantState';

// 音频分析 Hook
export { useAudioAnalyzer } from './useAudioAnalyzer';

// 类型导出
export type { TranscriptItem, UseVoiceAssistantStateReturn } from './useVoiceAssistantState';
export type { AudioAnalysisData, UseAudioAnalyzerOptions } from './useAudioAnalyzer';
export type { OrbState, OrbVisualizerProps } from './OrbVisualizer';
export type { ConnectionState, StateIndicatorProps } from './StateIndicator';
