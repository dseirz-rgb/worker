/**
 * Khoj 组件导出
 * 从 Khoj 源码移植的前端组件
 */

// 公共工具
export * from './common';

// 对话输入区域
export { ChatInputArea, ChatInputFocus } from './chatInputArea';
export type { ChatOptions } from './chatInputArea';

// 对话消息
export { ChatMessage, TrainOfThought } from './chatMessage';
export type {
  Context,
  OnlineContext,
  OnlineContextData,
  CodeContext,
  CodeContextData,
  TrainOfThoughtObject,
  AgentData,
  SingleChatMessage,
} from './chatMessage';

// 对话历史
export { ChatHistory } from './chatHistory';
export type { StreamMessage, ChatHistoryData } from './chatHistory';

// 自动化任务
export {
  AutomationCard,
  AutomationForm,
  CRON_PRESETS,
  CRON_PRESET_OPTIONS,
  cronToHuman,
  formatNextRunTime,
  isValidCron,
} from './automationCard';
export type {
  KhojAutomation,
  AutomationFormData,
  CronPresetOption,
} from './automationCard';

// Agent 卡片和表单
export { AgentCard, AgentForm } from './agentCard';
export type { AgentCardProps, KhojAgent, AgentFormProps, AgentFormData } from './agentCard';
