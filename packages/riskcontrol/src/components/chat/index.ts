/**
 * Chat 组件模块导出
 *
 * @module components/chat
 */

// 主要组件
export { ChatWindow } from './ChatWindow';
export { ChatSidebar } from './ChatSidebar';

// 增强版组件 (基于 Khoj)
export { EnhancedChatInput } from './EnhancedChatInput';
export type { AttachedFileText, ChatInputFocus } from './EnhancedChatInput';

export { ChatMessage, TrainOfThought as ChatMessageTrainOfThought } from './ChatMessage';
export type { ChatMessageData, Citation, TrainOfThoughtObject } from './ChatMessage';

export { TrainOfThought, TrainOfThoughtIndicator } from './TrainOfThought';
export type { ThoughtStep, TrainOfThoughtProps } from './TrainOfThought';

// 辅助组件
export { AgentThinkingDisplay, AgentThinkingIndicator } from './AgentThinkingDisplay';
export { ProcessingIndicator } from './ProcessingIndicator';
export { KnowledgeBaseDialog } from './KnowledgeBaseDialog';
