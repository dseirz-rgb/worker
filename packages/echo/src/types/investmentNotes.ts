/**
 * 投资笔记类型定义
 * 
 * 用于 Echo 投资模块的笔记功能
 * 数据存储在 Investment DB (Supabase) 的 documents 表
 * 
 * @module @echoai/types/investmentNotes
 */

// ============================================
// 笔记来源类型
// ============================================

/**
 * 笔记来源类型
 * 对应 documents 表的 source_type 字段
 */
export type NoteSourceType = 
  | 'note'              // 投资日记
  | 'principle'         // 投资原则
  | 'uploaded_file'     // 上传的文档
  | 'wechat_article'    // 微信文章
  | 'wechat_group_chat'; // 群聊精华

/**
 * 笔记分类 Tab
 */
export type NoteTab = 'journal' | 'principles' | 'knowledge' | 'history';

// ============================================
// 持仓快照
// ============================================

/**
 * 单个持仓快照
 */
export interface PositionSnapshot {
  ticker: string;
  weight: number;
  pnl: number;
  quantity?: number;
  avgCost?: number;
  currentPrice?: number;
  unrealizedPnLPercent?: number;
}

/**
 * 资产组合快照
 * 保存笔记时的资产状态
 */
export interface PortfolioSnapshot {
  date: string;
  totalNetWorth: number;
  cashRatio: number;
  relatedPosition?: PositionSnapshot;
  topPositions: PositionSnapshot[];
}

// ============================================
// 投资笔记
// ============================================

/**
 * 投资笔记接口
 * 对应 documents 表结构
 */
export interface InvestmentNote {
  id: number;
  user_id: number;
  title: string;
  content: string;
  tags: string[];
  source_type: NoteSourceType;
  related_ticker?: string;
  portfolio_snapshot?: PortfolioSnapshot;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * 创建/更新笔记的参数
 */
export interface UpsertNoteParams {
  id?: number;
  title: string;
  content: string;
  tags?: string[];
  source_type?: NoteSourceType;
  related_ticker?: string;
  portfolio_snapshot?: PortfolioSnapshot;
  metadata?: Record<string, unknown>;
}

// ============================================
// 筛选条件
// ============================================

/**
 * 笔记筛选条件
 */
export interface NoteFilter {
  source_type?: NoteSourceType | NoteSourceType[];
  search?: string;
  ticker?: string;
  tags?: string[];
}

// ============================================
// 编辑器状态
// ============================================

/**
 * 编辑器模式
 */
export type EditorMode = 'create' | 'edit' | 'view';

/**
 * 编辑器状态
 */
export interface EditorState {
  isOpen: boolean;
  mode: EditorMode;
  note: Partial<InvestmentNote> | null;
}

// ============================================
// 历史对话
// ============================================

/**
 * 历史对话记录
 * 对应 conversations 表
 */
export interface Conversation {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// 知识库分组
// ============================================

/**
 * 知识库书籍分组
 * 聚合多个 Part 的文档
 */
export interface KnowledgeBook {
  title: string;
  count: number;
  ids: number[];
  lastUpdated: string;
  sourceType: string;
}
