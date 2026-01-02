/**
 * AI 上下文管理系统 - 核心类型定义
 * 
 * 定义上下文管理所需的所有接口和类型
 */

// ============ 基础类型 ============

/** 上下文类型 */
export type ContextType =
  | 'steering'      // steering 文件
  | 'spec'          // spec 文档
  | 'file'          // 打开的文件
  | 'conversation'  // 对话历史
  | 'tool_result';  // MCP 工具结果

/** 优先级 */
export type Priority = 'critical' | 'high' | 'medium' | 'low';

/** Steering 文件加载模式 */
export type InclusionMode = 'always' | 'fileMatch' | 'manual';

/** Steering 文件来源层级 */
export type SteeringLevel = 'workspace' | 'global';

// ============ 上下文项 ============

/** 上下文元数据 */
export interface ContextMetadata {
  /** 来源路径 */
  source: string;
  /** steering 文件的加载模式 */
  inclusionMode?: InclusionMode;
  /** fileMatch 模式的匹配规则 */
  fileMatchPattern?: string;
  /** 是否被 pin */
  isPinned?: boolean;
  /** 是否已压缩 */
  isCompressed?: boolean;
  /** 压缩前的 token 数 */
  originalTokenCount?: number;
  /** steering 文件的来源层级 */
  steeringLevel?: SteeringLevel;
}

/** 上下文项 */
export interface ContextItem {
  /** 唯一标识符 */
  id: string;
  /** 上下文类型 */
  type: ContextType;
  /** 内容 */
  content: string;
  /** token 数量 */
  tokenCount: number;
  /** 优先级 */
  priority: Priority;
  /** 元数据 */
  metadata: ContextMetadata;
  /** 创建时间 */
  createdAt: Date;
  /** 最后访问时间 */
  lastAccessedAt: Date;
}

// ============ 文件引用 ============

/** 文件引用解析结果 */
export interface FileReference {
  /** 原始语法 "#[[file:path]]" */
  syntax: string;
  /** 解析出的路径 */
  path: string;
  /** 在内容中的起始位置 */
  startIndex: number;
  /** 在内容中的结束位置 */
  endIndex: number;
}

// ============ 预算配置 ============

/** 预算分配配置 */
export interface BudgetConfig {
  /** steering 文件占比 (0-100) */
  steering: number;
  /** spec 文档占比 (0-100) */
  specs: number;
  /** 打开文件占比 (0-100) */
  files: number;
  /** 对话历史占比 (0-100) */
  conversation: number;
}

/** 默认预算配置 */
export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  steering: 20,
  specs: 30,
  files: 30,
  conversation: 20,
};

/** 预算配置文件结构 */
export interface BudgetConfigFile {
  /** 模型的 token 限制 */
  modelLimit: number;
  /** 分配比例 */
  allocation: BudgetConfig;
  /** 压缩配置 */
  compression: {
    /** 触发压缩的阈值（百分比） */
    threshold: number;
    /** 是否保护 critical 优先级 */
    preserveCritical: boolean;
  };
}

// ============ 压缩相关 ============

/** 压缩操作类型 */
export type CompressionAction = 'removed' | 'summarized' | 'truncated';

/** 压缩日志条目 */
export interface CompressionLogEntry {
  /** 上下文项 ID */
  itemId: string;
  /** 压缩操作 */
  action: CompressionAction;
  /** 原始 token 数 */
  originalTokens: number;
  /** 结果 token 数 */
  resultTokens: number;
  /** 压缩原因 */
  reason: string;
}

/** 压缩结果 */
export interface CompressionResult {
  /** 压缩后的上下文项 */
  items: ContextItem[];
  /** 被移除的项 */
  removedItems: ContextItem[];
  /** 压缩日志 */
  compressionLog: CompressionLogEntry[];
}

// ============ 缓存相关 ============

/** 缓存统计 */
export interface CacheStats {
  /** 总缓存项数 */
  totalItems: number;
  /** 被 pin 的项数 */
  pinnedItems: number;
  /** 总 token 数 */
  totalTokens: number;
  /** 缓存命中率 */
  hitRate: number;
}

/** 缓存项 */
export interface CacheEntry {
  /** 缓存键 */
  key: string;
  /** 工具名称 */
  toolName: string;
  /** 调用参数 */
  params: Record<string, unknown>;
  /** 结果内容 */
  result: string;
  /** token 数量 */
  tokenCount: number;
  /** 是否被 pin */
  isPinned: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** 最后访问时间 */
  lastAccessedAt: Date;
  /** 访问次数 */
  accessCount: number;
}

// ============ 序列化相关 ============

/** 上下文状态（用于序列化） */
export interface ContextState {
  /** 版本号 */
  version: string;
  /** 时间戳 */
  timestamp: Date;
  /** 上下文项列表 */
  items: ContextItem[];
  /** 预算配置 */
  budgetConfig: BudgetConfig;
  /** 缓存统计 */
  cacheStats: CacheStats;
}

/** 验证结果 */
export interface ValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误信息列表 */
  errors: string[];
}

// ============ 任务上下文 ============

/** 任务执行上下文 */
export interface TaskContext {
  /** spec 目录路径 */
  specPath: string;
  /** 当前任务 ID */
  taskId: string;
  /** 任务描述 */
  taskDescription: string;
}

// ============ 工具函数 ============

/** 验证预算配置是否有效 */
export function isValidBudgetConfig(config: BudgetConfig): boolean {
  const { steering, specs, files, conversation } = config;
  
  // 检查每个值是否在 0-100 范围内
  const allInRange = [steering, specs, files, conversation].every(
    (v) => v >= 0 && v <= 100
  );
  
  // 检查总和是否为 100
  const sumIs100 = steering + specs + files + conversation === 100;
  
  return allInRange && sumIs100;
}

/** 优先级排序权重 */
export const PRIORITY_WEIGHTS: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** 比较两个优先级 */
export function comparePriority(a: Priority, b: Priority): number {
  return PRIORITY_WEIGHTS[b] - PRIORITY_WEIGHTS[a];
}
