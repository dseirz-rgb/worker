/**
 * EchoAI 组件导出
 * 基于 Mastra AI 服务的前端组件
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
export type { StreamMessage, Citation } from './chatHistory';

// 对话页面
export { ChatPage } from './ChatPage';
export { ChatSidebar } from './ChatSidebar';

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
  KhojAutomation as EchoAutomation,  // 别名，保持兼容
  AutomationFormData,
  CronPresetOption,
} from './automationCard';

// Agent 卡片和表单
export { AgentCard, AgentForm } from './agentCard';
export type { 
  AgentCardProps, 
  KhojAgent as EchoAgent,  // 别名，保持兼容
  AgentFormProps, 
  AgentFormData 
} from './agentCard';

// 日报组件
export { DailyReport } from './DailyReport';

// 建议卡片
export {
  StepOneSuggestionCard,
  StepTwoSuggestionCard,
  StepOneSuggestionRevertCard,
  SuggestionType,
  stepOneSuggestions,
  stepTwoSuggestion,
  getStepTwoSuggestions,
  convertSuggestionTitleToIconClass,
  // Echo v3.2: 智能建议系统
  SuggestionList,
  SuggestionResponseCard,
} from './suggestions';
export type {
  StepOneSuggestion,
  StepTwoSuggestion,
  Suggestion,
} from './suggestions';

// 引用面板
export {
  ReferencePanel,
  TeaserReferencesSection,
  constructAllReferences,
} from './referencePanel';
export type {
  NotesReferenceData,
  OnlineReferenceData,
  CodeReferenceData,
  ReferencePanelProps,
} from './referencePanel';

// 思考过程组件
export {
  TrainOfThoughtComponent,
  TrainOfThoughtItem,
} from './trainOfThought';
export type { TrainOfThoughtObject as TrainOfThoughtObjectType } from './trainOfThought';

// 图表组件
export { MermaidDiagram, ExcalidrawDiagram } from './diagrams';
