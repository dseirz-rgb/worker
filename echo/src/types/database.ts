/**
 * 数据库类型定义
 * 定义所有数据模型的 TypeScript 接口
 */

// 生活领域
export type LifeDomain = 
  | 'work'        // 工作
  | 'investment'  // 投资
  | 'development' // 开发
  | 'learning'    // 学习
  | 'family'      // 家庭
  | 'health'      // 健康
  | 'entertainment' // 娱乐
  | 'general';    // 通用

// 笔记类型
export type NoteType = 'text' | 'voice' | 'image';

// 任务优先级
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// 任务状态
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

// 提醒类型
export type ReminderType = 
  | 'task_deadline'
  | 'habit_reminder'
  | 'emotional_feedback'
  | 'family_care'
  | 'health_alert'
  | 'learning_prompt'
  | 'investment_warning';

// 提醒状态
export type ReminderStatus = 'pending' | 'sent' | 'dismissed' | 'snoozed';

// 同步动作
export type SyncAction = 'create' | 'update' | 'delete';

/**
 * 笔记接口
 * 参考 Blinko 的设计，支持更丰富的笔记功能
 */
export interface Note {
  id: string;
  content: string;
  type: NoteType;
  domain: LifeDomain;
  tags: string[];
  memoryId?: string;
  // Blinko 风格扩展字段
  isPinned?: boolean;        // 是否置顶
  isArchived?: boolean;      // 是否归档
  aiSummary?: string;        // AI 生成的摘要
  links?: string[];          // 提取的链接
  attachments?: string[];    // 附件路径
  parentId?: string;         // 父笔记 ID（支持笔记嵌套）
  relatedNoteIds?: string[]; // 相关笔记 ID
  source?: string;           // 来源（手动、语音、截图等）
  location?: {               // 位置信息
    latitude: number;
    longitude: number;
    address?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建笔记输入
 */
export interface CreateNoteInput {
  content: string;
  type?: NoteType;
  domain?: LifeDomain;
  tags?: string[];
}

/**
 * 更新笔记输入
 */
export interface UpdateNoteInput {
  content?: string;
  type?: NoteType;
  domain?: LifeDomain;
  tags?: string[];
}

/**
 * 任务接口
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline?: string;
  domain: LifeDomain;
  assigneeId?: string;
  parentId?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * 创建任务输入
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  deadline?: string;
  domain?: LifeDomain;
  assigneeId?: string;
  parentId?: string;
}

/**
 * 更新任务输入
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  deadline?: string;
  domain?: LifeDomain;
  assigneeId?: string;
}

/**
 * 提醒接口
 */
export interface Reminder {
  id: string;
  type: ReminderType;
  title: string;
  message: string;
  priority: TaskPriority;
  scheduledAt: string;
  status: ReminderStatus;
  context: Record<string, unknown>;
  createdAt: string;
}

/**
 * 创建提醒输入
 */
export interface CreateReminderInput {
  type: ReminderType;
  title: string;
  message: string;
  priority?: TaskPriority;
  scheduledAt: string;
  context?: Record<string, unknown>;
}

/**
 * 同步状态记录
 */
export interface SyncRecord {
  id: string;
  tableName: string;
  recordId: string;
  action: SyncAction;
  synced: boolean;
  createdAt: string;
}

/**
 * 数据库操作结果
 */
export interface DbResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}


// 情绪状态
export type Mood = 'positive' | 'neutral' | 'negative';

/**
 * 情绪状态接口
 */
export interface EmotionalState {
  id: string;
  mood: Mood;
  energy: number;  // 1-10
  stress: number;  // 1-10
  source?: string;
  notes?: string;
  recordedAt: string;
}

/**
 * 创建情绪状态输入
 */
export interface CreateEmotionalStateInput {
  mood: Mood;
  energy: number;
  stress: number;
  source?: string;
  notes?: string;
}

/**
 * 团队成员接口
 */
export interface TeamMember {
  id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  skills: string[];
  preferences: Record<string, unknown>;
  lastOneOnOne?: string;
  joinDate: string;
  createdAt: string;
}

/**
 * 创建团队成员输入
 */
export interface CreateTeamMemberInput {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  skills?: string[];
  preferences?: Record<string, unknown>;
}

/**
 * 更新团队成员输入
 */
export interface UpdateTeamMemberInput {
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
  skills?: string[];
  preferences?: Record<string, unknown>;
  lastOneOnOne?: string;
}

/**
 * 1:1 会议记录接口
 */
export interface OneOnOneRecord {
  id: string;
  memberId: string;
  date: string;
  topics: string[];
  notes: string;
  actionItems: string[];
  mood?: 'positive' | 'neutral' | 'negative';
  createdAt: string;
}

/**
 * 创建 1:1 记录输入
 */
export interface CreateOneOnOneInput {
  memberId: string;
  date?: string;
  topics?: string[];
  notes: string;
  actionItems?: string[];
  mood?: 'positive' | 'neutral' | 'negative';
}

/**
 * 任务分配接口
 */
export interface TaskAssignment {
  id: string;
  taskId: string;
  memberId: string;
  assignedAt: string;
  dueDate?: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'blocked';
  progress: number; // 0-100
  notes?: string;
}

/**
 * 创建任务分配输入
 */
export interface CreateTaskAssignmentInput {
  taskId: string;
  memberId: string;
  dueDate?: string;
  notes?: string;
}

/**
 * 工作量统计
 */
export interface WorkloadStats {
  memberId: string;
  memberName: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  completionRate: number;
}

/**
 * 管理技能记录
 */
export interface ManagementSkillRecord {
  id: string;
  category: 'communication' | 'delegation' | 'feedback' | 'motivation' | 'conflict' | 'coaching' | 'other';
  title: string;
  content: string;
  source?: string;
  keyLearnings: string[];
  practiceDate?: string;
  createdAt: string;
}

/**
 * 创建管理技能记录输入
 */
export interface CreateManagementSkillInput {
  category: ManagementSkillRecord['category'];
  title: string;
  content: string;
  source?: string;
  keyLearnings?: string[];
  practiceDate?: string;
}

// 家庭关系类型
export type FamilyRelationship = 'spouse' | 'child' | 'parent';

/**
 * 家庭成员接口
 */
export interface FamilyMember {
  id: string;
  name: string;
  relationship: FamilyRelationship;
  birthdate?: string;
  createdAt: string;
}

/**
 * 创建家庭成员输入
 */
export interface CreateFamilyMemberInput {
  name: string;
  relationship: FamilyRelationship;
  birthdate?: string;
}

// 里程碑类型
export type MilestoneType = 'development' | 'language' | 'social' | 'other';

/**
 * 里程碑接口
 */
export interface Milestone {
  id: string;
  familyMemberId: string;
  title: string;
  description?: string;
  milestoneDate: string;
  type: MilestoneType;
  createdAt: string;
}

/**
 * 创建里程碑输入
 */
export interface CreateMilestoneInput {
  familyMemberId: string;
  title: string;
  description?: string;
  milestoneDate: string;
  type: MilestoneType;
}

/**
 * 活动记录接口
 */
export interface Activity {
  id: string;
  appName: string;
  windowTitle?: string;
  domain?: LifeDomain;
  project?: string;
  durationSeconds: number;
  startedAt: string;
  endedAt: string;
}

/**
 * 对话接口
 */
export interface Conversation {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

// 消息角色
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * 消息接口
 */
export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

/**
 * 创建消息输入
 */
export interface CreateMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
}

// ==================
// 语音笔记相关类型
// ==================

// 语音笔记状态
export type VoiceNoteStatus = 'recording' | 'transcribing' | 'processing' | 'completed' | 'failed';

/**
 * 语音笔记接口
 */
export interface VoiceNote {
  id: string;
  // 音频相关
  audioUrl?: string;           // 音频文件 URL
  audioDuration: number;       // 音频时长（秒）
  audioSize?: number;          // 音频文件大小（字节）
  
  // 转写相关
  transcript: string;          // 转写文本
  transcriptConfidence?: number; // 转写置信度 (0-1)
  
  // 智能提取
  summary?: string;            // AI 生成的摘要
  actionItems: ActionItem[];   // 提取的行动项
  mentions: string[];          // 提及的人员
  keywords: string[];          // 关键词
  
  // 关联
  noteId?: string;             // 关联的笔记 ID
  taskIds: string[];           // 创建的任务 ID 列表
  
  // 元数据
  domain: LifeDomain;
  status: VoiceNoteStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * 行动项接口
 */
export interface ActionItem {
  id: string;
  content: string;             // 行动项内容
  assignee?: string;           // 负责人
  deadline?: string;           // 截止日期
  priority: TaskPriority;      // 优先级
  isCompleted: boolean;        // 是否已完成
  taskId?: string;             // 关联的任务 ID
}

/**
 * 创建语音笔记输入
 */
export interface CreateVoiceNoteInput {
  audioBlob: Blob;             // 音频数据
  audioDuration: number;       // 音频时长
  domain?: LifeDomain;
}

/**
 * 语音转写结果
 */
export interface TranscriptionResult {
  transcript: string;
  confidence?: number;
  segments?: TranscriptSegment[];
}

/**
 * 转写片段
 */
export interface TranscriptSegment {
  text: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

/**
 * 智能提取结果
 */
export interface SmartExtractionResult {
  summary: string;
  actionItems: ActionItem[];
  mentions: string[];
  keywords: string[];
  suggestedDomain: LifeDomain;
  suggestedTags: string[];
}
