/**
 * 上下文序列化器
 * 
 * 负责上下文状态的序列化和反序列化，支持会话持久化
 */

import {
  ContextState,
  ContextItem,
  BudgetConfig,
  CacheStats,
  ValidationResult,
  ContextType,
  Priority,
  InclusionMode,
  DEFAULT_BUDGET_CONFIG,
} from './types';

/** 当前序列化版本 */
const CURRENT_VERSION = '1.0.0';

/** 序列化后的 JSON 结构 */
interface SerializedContextState {
  version: string;
  timestamp: string;
  items: SerializedContextItem[];
  budgetConfig: BudgetConfig;
  cacheStats: CacheStats;
}

/** 序列化后的上下文项 */
interface SerializedContextItem {
  id: string;
  type: ContextType;
  content: string;
  tokenCount: number;
  priority: Priority;
  metadata: Record<string, unknown>;
  createdAt: string;
  lastAccessedAt: string;
}

/**
 * 上下文序列化器类
 */
export class ContextSerializer {
  /**
   * 序列化上下文状态
   * 
   * @param state - 上下文状态
   * @returns JSON 字符串
   */
  serialize(state: ContextState): string {
    const serialized: SerializedContextState = {
      version: state.version || CURRENT_VERSION,
      timestamp: state.timestamp.toISOString(),
      items: state.items.map((item) => this.serializeItem(item)),
      budgetConfig: { ...state.budgetConfig },
      cacheStats: { ...state.cacheStats },
    };

    return JSON.stringify(serialized, null, 2);
  }

  /**
   * 反序列化上下文状态
   * 
   * @param json - JSON 字符串
   * @returns 上下文状态
   * @throws 如果 JSON 无效
   */
  deserialize(json: string): ContextState {
    const parsed = JSON.parse(json) as SerializedContextState;

    // 验证版本
    if (!parsed.version) {
      throw new Error('Missing version in serialized state');
    }

    return {
      version: parsed.version,
      timestamp: new Date(parsed.timestamp),
      items: parsed.items.map((item) => this.deserializeItem(item)),
      budgetConfig: parsed.budgetConfig || { ...DEFAULT_BUDGET_CONFIG },
      cacheStats: parsed.cacheStats || {
        totalItems: 0,
        pinnedItems: 0,
        totalTokens: 0,
        hitRate: 0,
      },
    };
  }

  /**
   * 验证上下文状态
   * 
   * @param state - 上下文状态
   * @returns 验证结果
   */
  validate(state: ContextState): ValidationResult {
    const errors: string[] = [];

    // 验证版本
    if (!state.version) {
      errors.push('Missing version');
    }

    // 验证时间戳
    if (!(state.timestamp instanceof Date) || isNaN(state.timestamp.getTime())) {
      errors.push('Invalid timestamp');
    }

    // 验证 items
    if (!Array.isArray(state.items)) {
      errors.push('Items must be an array');
    } else {
      for (let i = 0; i < state.items.length; i++) {
        const itemErrors = this.validateItem(state.items[i], i);
        errors.push(...itemErrors);
      }
    }

    // 验证 budgetConfig
    const budgetErrors = this.validateBudgetConfig(state.budgetConfig);
    errors.push(...budgetErrors);

    // 验证 cacheStats
    const cacheErrors = this.validateCacheStats(state.cacheStats);
    errors.push(...cacheErrors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 安全反序列化（带验证）
   * 
   * @param json - JSON 字符串
   * @returns 上下文状态和验证结果
   */
  safeDeserialize(json: string): {
    state: ContextState | null;
    validation: ValidationResult;
  } {
    try {
      const state = this.deserialize(json);
      const validation = this.validate(state);

      return {
        state: validation.isValid ? state : null,
        validation,
      };
    } catch (error) {
      return {
        state: null,
        validation: {
          isValid: false,
          errors: [`Deserialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        },
      };
    }
  }

  /**
   * 序列化单个上下文项
   */
  private serializeItem(item: ContextItem): SerializedContextItem {
    return {
      id: item.id,
      type: item.type,
      content: item.content,
      tokenCount: item.tokenCount,
      priority: item.priority,
      metadata: { ...item.metadata },
      createdAt: item.createdAt.toISOString(),
      lastAccessedAt: item.lastAccessedAt.toISOString(),
    };
  }

  /**
   * 反序列化单个上下文项
   */
  private deserializeItem(item: SerializedContextItem): ContextItem {
    return {
      id: item.id,
      type: item.type,
      content: item.content,
      tokenCount: item.tokenCount,
      priority: item.priority,
      metadata: {
        source: (item.metadata.source as string) || '',
        inclusionMode: item.metadata.inclusionMode as InclusionMode | undefined,
        fileMatchPattern: item.metadata.fileMatchPattern as string | undefined,
        isPinned: item.metadata.isPinned as boolean | undefined,
        isCompressed: item.metadata.isCompressed as boolean | undefined,
        originalTokenCount: item.metadata.originalTokenCount as number | undefined,
      },
      createdAt: new Date(item.createdAt),
      lastAccessedAt: new Date(item.lastAccessedAt),
    };
  }

  /**
   * 验证单个上下文项
   */
  private validateItem(item: ContextItem, index: number): string[] {
    const errors: string[] = [];
    const prefix = `Item[${index}]`;

    if (!item.id) {
      errors.push(`${prefix}: Missing id`);
    }

    if (!isValidContextType(item.type)) {
      errors.push(`${prefix}: Invalid type "${item.type}"`);
    }

    if (typeof item.content !== 'string') {
      errors.push(`${prefix}: Content must be a string`);
    }

    if (typeof item.tokenCount !== 'number' || item.tokenCount < 0) {
      errors.push(`${prefix}: Invalid tokenCount`);
    }

    if (!isValidPriority(item.priority)) {
      errors.push(`${prefix}: Invalid priority "${item.priority}"`);
    }

    if (!item.metadata || typeof item.metadata !== 'object') {
      errors.push(`${prefix}: Invalid metadata`);
    }

    return errors;
  }

  /**
   * 验证预算配置
   */
  private validateBudgetConfig(config: BudgetConfig): string[] {
    const errors: string[] = [];

    if (!config) {
      errors.push('Missing budgetConfig');
      return errors;
    }

    const { steering, specs, files, conversation } = config;

    if (typeof steering !== 'number' || steering < 0 || steering > 100) {
      errors.push('Invalid budgetConfig.steering');
    }

    if (typeof specs !== 'number' || specs < 0 || specs > 100) {
      errors.push('Invalid budgetConfig.specs');
    }

    if (typeof files !== 'number' || files < 0 || files > 100) {
      errors.push('Invalid budgetConfig.files');
    }

    if (typeof conversation !== 'number' || conversation < 0 || conversation > 100) {
      errors.push('Invalid budgetConfig.conversation');
    }

    const sum = (steering || 0) + (specs || 0) + (files || 0) + (conversation || 0);
    if (sum !== 100) {
      errors.push(`Budget allocation must sum to 100, got ${sum}`);
    }

    return errors;
  }

  /**
   * 验证缓存统计
   */
  private validateCacheStats(stats: CacheStats): string[] {
    const errors: string[] = [];

    if (!stats) {
      errors.push('Missing cacheStats');
      return errors;
    }

    if (typeof stats.totalItems !== 'number' || stats.totalItems < 0) {
      errors.push('Invalid cacheStats.totalItems');
    }

    if (typeof stats.pinnedItems !== 'number' || stats.pinnedItems < 0) {
      errors.push('Invalid cacheStats.pinnedItems');
    }

    if (typeof stats.totalTokens !== 'number' || stats.totalTokens < 0) {
      errors.push('Invalid cacheStats.totalTokens');
    }

    if (typeof stats.hitRate !== 'number' || stats.hitRate < 0 || stats.hitRate > 1) {
      errors.push('Invalid cacheStats.hitRate');
    }

    return errors;
  }
}

/**
 * 验证上下文类型
 */
function isValidContextType(type: string): type is ContextType {
  return ['steering', 'spec', 'file', 'conversation', 'tool_result'].includes(type);
}

/**
 * 验证优先级
 */
function isValidPriority(priority: string): priority is Priority {
  return ['critical', 'high', 'medium', 'low'].includes(priority);
}

/**
 * 创建序列化器实例
 */
export function createContextSerializer(): ContextSerializer {
  return new ContextSerializer();
}

/**
 * 创建空的上下文状态
 */
export function createEmptyContextState(): ContextState {
  return {
    version: CURRENT_VERSION,
    timestamp: new Date(),
    items: [],
    budgetConfig: { ...DEFAULT_BUDGET_CONFIG },
    cacheStats: {
      totalItems: 0,
      pinnedItems: 0,
      totalTokens: 0,
      hitRate: 0,
    },
  };
}

/**
 * 比较两个上下文状态是否等价（忽略时间戳）
 */
export function isEquivalentState(a: ContextState, b: ContextState): boolean {
  // 比较版本
  if (a.version !== b.version) return false;

  // 比较 items 数量
  if (a.items.length !== b.items.length) return false;

  // 比较每个 item
  for (let i = 0; i < a.items.length; i++) {
    if (!isEquivalentItem(a.items[i], b.items[i])) return false;
  }

  // 比较 budgetConfig
  if (
    a.budgetConfig.steering !== b.budgetConfig.steering ||
    a.budgetConfig.specs !== b.budgetConfig.specs ||
    a.budgetConfig.files !== b.budgetConfig.files ||
    a.budgetConfig.conversation !== b.budgetConfig.conversation
  ) {
    return false;
  }

  // 比较 cacheStats
  if (
    a.cacheStats.totalItems !== b.cacheStats.totalItems ||
    a.cacheStats.pinnedItems !== b.cacheStats.pinnedItems ||
    a.cacheStats.totalTokens !== b.cacheStats.totalTokens ||
    Math.abs(a.cacheStats.hitRate - b.cacheStats.hitRate) > 0.001
  ) {
    return false;
  }

  return true;
}

/**
 * 比较两个上下文项是否等价
 */
function isEquivalentItem(a: ContextItem, b: ContextItem): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.content === b.content &&
    a.tokenCount === b.tokenCount &&
    a.priority === b.priority &&
    a.metadata.source === b.metadata.source
  );
}
