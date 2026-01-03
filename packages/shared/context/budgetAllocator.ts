/**
 * Budget 分配器
 * 
 * 管理 token 预算分配，确保不同类型的上下文获得合理的配额
 */

import {
  BudgetConfig,
  BudgetConfigFile,
  ContextItem,
  ContextType,
  DEFAULT_BUDGET_CONFIG,
  isValidBudgetConfig,
} from './types';

/** 默认模型 token 限制 */
const DEFAULT_MODEL_LIMIT = 128000;

/** 默认压缩阈值（80%） */
const DEFAULT_COMPRESSION_THRESHOLD = 80;

/** 上下文类型到预算配置键的映射 */
const TYPE_TO_CONFIG_KEY: Record<ContextType, keyof BudgetConfig | null> = {
  steering: 'steering',
  spec: 'specs',
  file: 'files',
  conversation: 'conversation',
  tool_result: null, // tool_result 共享 files 的配额
};

/**
 * Budget 分配器类
 */
export class BudgetAllocator {
  private config: BudgetConfig;
  private modelLimit: number;
  private compressionThreshold: number;
  private preserveCritical: boolean;

  constructor(configFile?: Partial<BudgetConfigFile>) {
    this.config = configFile?.allocation ?? { ...DEFAULT_BUDGET_CONFIG };
    this.modelLimit = configFile?.modelLimit ?? DEFAULT_MODEL_LIMIT;
    this.compressionThreshold = configFile?.compression?.threshold ?? DEFAULT_COMPRESSION_THRESHOLD;
    this.preserveCritical = configFile?.compression?.preserveCritical ?? true;

    // 验证配置
    if (!isValidBudgetConfig(this.config)) {
      console.warn('Invalid budget config, using defaults');
      this.config = { ...DEFAULT_BUDGET_CONFIG };
    }
  }

  /**
   * 获取当前预算配置
   */
  getConfig(): BudgetConfig {
    return { ...this.config };
  }

  /**
   * 更新预算配置
   * 
   * @param config - 部分配置更新
   * @returns 是否更新成功
   */
  updateConfig(config: Partial<BudgetConfig>): boolean {
    const newConfig = { ...this.config, ...config };
    
    if (!isValidBudgetConfig(newConfig)) {
      return false;
    }
    
    this.config = newConfig;
    return true;
  }

  /**
   * 获取模型 token 限制
   */
  getModelLimit(): number {
    return this.modelLimit;
  }

  /**
   * 设置模型 token 限制
   */
  setModelLimit(limit: number): void {
    if (limit > 0) {
      this.modelLimit = limit;
    }
  }

  /**
   * 计算每种类型的 token 限制
   * 
   * @param totalBudget - 总预算（可选，默认使用 modelLimit）
   * @returns 每种类型的 token 限制
   */
  calculateLimits(totalBudget?: number): Record<ContextType, number> {
    const budget = totalBudget ?? this.modelLimit;
    
    return {
      steering: Math.floor(budget * this.config.steering / 100),
      spec: Math.floor(budget * this.config.specs / 100),
      file: Math.floor(budget * this.config.files / 100),
      conversation: Math.floor(budget * this.config.conversation / 100),
      tool_result: Math.floor(budget * this.config.files / 100), // 共享 files 配额
    };
  }

  /**
   * 计算上下文项的总 token 数
   * 
   * @param items - 上下文项列表
   * @returns 总 token 数
   */
  calculateTotalTokens(items: ContextItem[]): number {
    return items.reduce((sum, item) => sum + item.tokenCount, 0);
  }

  /**
   * 按类型统计 token 使用
   * 
   * @param items - 上下文项列表
   * @returns 每种类型的 token 使用量
   */
  calculateTokensByType(items: ContextItem[]): Record<ContextType, number> {
    const result: Record<ContextType, number> = {
      steering: 0,
      spec: 0,
      file: 0,
      conversation: 0,
      tool_result: 0,
    };
    
    for (const item of items) {
      result[item.type] += item.tokenCount;
    }
    
    return result;
  }

  /**
   * 检查是否超出总预算
   * 
   * @param items - 上下文项列表
   * @returns 是否超出预算
   */
  isOverBudget(items: ContextItem[]): boolean {
    const total = this.calculateTotalTokens(items);
    return total > this.modelLimit;
  }

  /**
   * 检查是否需要压缩
   * 
   * @param items - 上下文项列表
   * @returns 是否需要压缩
   */
  needsCompression(items: ContextItem[]): boolean {
    const total = this.calculateTotalTokens(items);
    const threshold = this.modelLimit * this.compressionThreshold / 100;
    return total > threshold;
  }

  /**
   * 获取超出预算的 token 数
   * 
   * @param items - 上下文项列表
   * @returns 超出的 token 数（负数表示未超出）
   */
  getOverBudgetAmount(items: ContextItem[]): number {
    const total = this.calculateTotalTokens(items);
    return total - this.modelLimit;
  }

  /**
   * 获取每种类型的预算使用百分比
   * 
   * @param items - 上下文项列表
   * @returns 每种类型的使用百分比
   */
  getUsagePercentages(items: ContextItem[]): Record<ContextType, number> {
    const limits = this.calculateLimits();
    const usage = this.calculateTokensByType(items);
    
    const result: Record<ContextType, number> = {
      steering: 0,
      spec: 0,
      file: 0,
      conversation: 0,
      tool_result: 0,
    };
    
    for (const type of Object.keys(result) as ContextType[]) {
      const limit = limits[type];
      if (limit > 0) {
        result[type] = Math.round(usage[type] / limit * 100);
      }
    }
    
    return result;
  }

  /**
   * 获取上下文组成摘要
   * 
   * @param items - 上下文项列表
   * @returns 组成摘要
   */
  getCompositionSummary(items: ContextItem[]): {
    total: number;
    limit: number;
    usagePercent: number;
    byType: Record<ContextType, { tokens: number; percent: number }>;
  } {
    const total = this.calculateTotalTokens(items);
    const byTypeTokens = this.calculateTokensByType(items);
    
    const byType: Record<ContextType, { tokens: number; percent: number }> = {
      steering: { tokens: 0, percent: 0 },
      spec: { tokens: 0, percent: 0 },
      file: { tokens: 0, percent: 0 },
      conversation: { tokens: 0, percent: 0 },
      tool_result: { tokens: 0, percent: 0 },
    };
    
    for (const type of Object.keys(byType) as ContextType[]) {
      const tokens = byTypeTokens[type];
      byType[type] = {
        tokens,
        percent: total > 0 ? Math.round(tokens / total * 100) : 0,
      };
    }
    
    return {
      total,
      limit: this.modelLimit,
      usagePercent: Math.round(total / this.modelLimit * 100),
      byType,
    };
  }

  /**
   * 是否保护 critical 优先级
   */
  shouldPreserveCritical(): boolean {
    return this.preserveCritical;
  }

  /**
   * 导出配置为 BudgetConfigFile 格式
   */
  exportConfig(): BudgetConfigFile {
    return {
      modelLimit: this.modelLimit,
      allocation: { ...this.config },
      compression: {
        threshold: this.compressionThreshold,
        preserveCritical: this.preserveCritical,
      },
    };
  }
}

/**
 * 创建默认的 Budget 分配器
 */
export function createDefaultBudgetAllocator(): BudgetAllocator {
  return new BudgetAllocator();
}

/**
 * 从配置文件创建 Budget 分配器
 * 
 * @param configJson - 配置文件 JSON 字符串
 * @returns Budget 分配器
 */
export function createBudgetAllocatorFromJson(configJson: string): BudgetAllocator {
  try {
    const config = JSON.parse(configJson) as Partial<BudgetConfigFile>;
    return new BudgetAllocator(config);
  } catch {
    console.warn('Failed to parse budget config, using defaults');
    return new BudgetAllocator();
  }
}
