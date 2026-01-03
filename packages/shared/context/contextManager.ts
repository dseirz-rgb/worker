/**
 * 上下文管理器主类
 * 
 * 整合所有组件，提供统一的上下文管理 API：
 * - 上下文组装流程
 * - 手动移除上下文项
 * - 上下文统计
 * - 会话持久化
 */

import {
  ContextItem,
  ContextState,
  ContextType,
  TaskContext,
  BudgetConfig,
  CacheStats,
  CompressionResult,
} from './types';
import { BudgetAllocator, createDefaultBudgetAllocator } from './budgetAllocator';
import { CompressionEngine, createCompressionEngine, estimateTokenCount } from './compressionEngine';
import { CacheManager, createCacheManager } from './cacheManager';
import { ContextSerializer, createContextSerializer, createEmptyContextState } from './contextSerializer';
import { OutputSummarizer, createOutputSummarizer } from './outputSummarizer';
import { SteeringFile, loadSteeringFiles, LoadOptions } from './steeringLoader';
import { SpecDirectory, loadSpecDocuments } from './specLoader';

/** 上下文管理器配置 */
export interface ContextManagerConfig {
  /** token 计数函数 */
  tokenCounter?: (content: string) => number;
  /** 预算配置 */
  budgetConfig?: Partial<BudgetConfig>;
  /** 模型 token 限制 */
  modelLimit?: number;
}

/** 上下文组装选项 */
export interface AssembleOptions {
  /** 当前活跃的文件列表 */
  activeFiles: string[];
  /** 用户显式引用的 steering 文件 */
  manualReferences: string[];
  /** 任务上下文（可选） */
  taskContext?: TaskContext;
}

/** 上下文统计信息 */
export interface ContextStats {
  /** 总 token 数 */
  totalTokens: number;
  /** 模型限制 */
  modelLimit: number;
  /** 使用百分比 */
  usagePercent: number;
  /** 各类型统计 */
  byType: Record<ContextType, { count: number; tokens: number; percent: number }>;
  /** 活跃的 steering 文件 */
  activeSteeringFiles: string[];
  /** 是否需要压缩 */
  needsCompression: boolean;
}

/**
 * 上下文管理器类
 */
export class ContextManager {
  private items: Map<string, ContextItem> = new Map();
  private removedIds: Set<string> = new Set();
  
  private budgetAllocator: BudgetAllocator;
  private compressionEngine: CompressionEngine;
  private cacheManager: CacheManager;
  private serializer: ContextSerializer;
  private outputSummarizer: OutputSummarizer;
  private tokenCounter: (content: string) => number;

  constructor(config?: ContextManagerConfig) {
    this.tokenCounter = config?.tokenCounter ?? estimateTokenCount;
    this.budgetAllocator = createDefaultBudgetAllocator();
    this.compressionEngine = createCompressionEngine();
    this.cacheManager = createCacheManager({ tokenCounter: this.tokenCounter });
    this.serializer = createContextSerializer();
    this.outputSummarizer = createOutputSummarizer({ tokenCounter: this.tokenCounter });

    if (config?.budgetConfig) {
      this.budgetAllocator.updateConfig(config.budgetConfig);
    }
    if (config?.modelLimit) {
      this.budgetAllocator.setModelLimit(config.modelLimit);
    }
  }

  /**
   * 组装上下文
   * 
   * @param steeringFiles - steering 文件列表
   * @param specDir - spec 目录信息
   * @param options - 组装选项
   * @returns 组装后的上下文项列表
   */
  assembleContext(
    steeringFiles: SteeringFile[],
    specDir: SpecDirectory | undefined,
    options: AssembleOptions
  ): ContextItem[] {
    // 1. 加载 steering 文件
    const loadOptions: LoadOptions = {
      activeFiles: options.activeFiles,
      manualReferences: options.manualReferences,
    };
    const steeringItems = loadSteeringFiles(steeringFiles, loadOptions, this.tokenCounter);

    // 2. 加载 spec 文档
    const specItems = specDir
      ? loadSpecDocuments(specDir, options.taskContext, this.tokenCounter)
      : [];

    // 3. 合并所有上下文项
    const allItems = [...steeringItems, ...specItems];

    // 4. 过滤已移除的项
    const filteredItems = allItems.filter((item) => !this.removedIds.has(item.id));

    // 5. 更新内部状态
    for (const item of filteredItems) {
      this.items.set(item.id, item);
    }

    // 6. 检查是否需要压缩
    if (this.budgetAllocator.needsCompression(filteredItems)) {
      const result = this.compressContext(filteredItems);
      return result.items;
    }

    return filteredItems;
  }

  /**
   * 添加上下文项
   * 
   * @param item - 上下文项
   */
  addItem(item: ContextItem): void {
    this.items.set(item.id, item);
    this.removedIds.delete(item.id);
  }

  /**
   * 移除上下文项
   * 
   * @param itemId - 上下文项 ID
   * @returns 是否成功移除
   */
  removeItem(itemId: string): boolean {
    const existed = this.items.has(itemId);
    this.items.delete(itemId);
    this.removedIds.add(itemId);
    return existed;
  }

  /**
   * 获取上下文项
   * 
   * @param itemId - 上下文项 ID
   * @returns 上下文项或 undefined
   */
  getItem(itemId: string): ContextItem | undefined {
    return this.items.get(itemId);
  }

  /**
   * 获取所有上下文项
   */
  getAllItems(): ContextItem[] {
    return Array.from(this.items.values());
  }

  /**
   * 压缩上下文
   * 
   * @param items - 上下文项列表（可选，默认使用当前所有项）
   * @returns 压缩结果
   */
  compressContext(items?: ContextItem[]): CompressionResult {
    const targetItems = items ?? this.getAllItems();
    const targetTokens = this.budgetAllocator.getModelLimit();

    return this.compressionEngine.compress(targetItems, {
      targetTokens,
      preserveCritical: this.budgetAllocator.shouldPreserveCritical(),
      tokenCounter: this.tokenCounter,
    });
  }

  /**
   * 获取上下文统计信息
   */
  getStats(): ContextStats {
    const items = this.getAllItems();
    const summary = this.budgetAllocator.getCompositionSummary(items);

    // 统计各类型
    const byType: Record<ContextType, { count: number; tokens: number; percent: number }> = {
      steering: { count: 0, tokens: 0, percent: 0 },
      spec: { count: 0, tokens: 0, percent: 0 },
      file: { count: 0, tokens: 0, percent: 0 },
      conversation: { count: 0, tokens: 0, percent: 0 },
      tool_result: { count: 0, tokens: 0, percent: 0 },
    };

    for (const item of items) {
      byType[item.type].count++;
      byType[item.type].tokens += item.tokenCount;
    }

    // 计算百分比
    for (const type of Object.keys(byType) as ContextType[]) {
      byType[type].percent = summary.total > 0
        ? Math.round(byType[type].tokens / summary.total * 100)
        : 0;
    }

    // 获取活跃的 steering 文件
    const activeSteeringFiles = items
      .filter((item) => item.type === 'steering')
      .map((item) => item.metadata.source);

    return {
      totalTokens: summary.total,
      modelLimit: summary.limit,
      usagePercent: summary.usagePercent,
      byType,
      activeSteeringFiles,
      needsCompression: this.budgetAllocator.needsCompression(items),
    };
  }

  /**
   * 缓存工具结果
   */
  cacheToolResult(toolName: string, params: Record<string, unknown>, result: string): void {
    this.cacheManager.cacheToolResult(toolName, params, result);
  }

  /**
   * 获取缓存的工具结果
   */
  getCachedToolResult(toolName: string, params: Record<string, unknown>): string | null {
    return this.cacheManager.getCachedResult(toolName, params);
  }

  /**
   * Pin 工具结果
   */
  pinToolResult(toolName: string, params: Record<string, unknown>): boolean {
    return this.cacheManager.pinResult(toolName, params);
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): CacheStats {
    return this.cacheManager.getCacheStats();
  }

  /**
   * 检查输出是否需要摘要
   */
  checkNeedsSummarization(content: string): boolean {
    return this.outputSummarizer.checkNeedsSummarization(content).needsSummarization;
  }

  /**
   * 处理大输出
   */
  async processLargeOutput(content: string): Promise<string> {
    const result = await this.outputSummarizer.processOutput(content);
    return result.resultContent;
  }

  /**
   * 序列化当前状态
   */
  serialize(): string {
    const state: ContextState = {
      version: '1.0.0',
      timestamp: new Date(),
      items: this.getAllItems(),
      budgetConfig: this.budgetAllocator.getConfig(),
      cacheStats: this.cacheManager.getCacheStats(),
    };

    return this.serializer.serialize(state);
  }

  /**
   * 从序列化状态恢复
   * 
   * @param json - JSON 字符串
   * @returns 是否成功恢复
   */
  restore(json: string): boolean {
    const { state, validation } = this.serializer.safeDeserialize(json);

    if (!state || !validation.isValid) {
      console.warn('Failed to restore context:', validation.errors);
      return false;
    }

    // 恢复上下文项
    this.items.clear();
    this.removedIds.clear();
    for (const item of state.items) {
      this.items.set(item.id, item);
    }

    // 恢复预算配置
    this.budgetAllocator.updateConfig(state.budgetConfig);

    return true;
  }

  /**
   * 清除所有上下文
   */
  clear(): void {
    this.items.clear();
    this.removedIds.clear();
    this.cacheManager.clearSessionCache();
  }

  /**
   * 清除持久化的上下文
   */
  clearPersistedContext(): void {
    // 这里只清除内存中的状态
    // 实际的存储清除需要由调用方处理
    this.clear();
  }

  /**
   * 获取预算分配器
   */
  getBudgetAllocator(): BudgetAllocator {
    return this.budgetAllocator;
  }

  /**
   * 获取压缩日志
   */
  getCompressionLog() {
    return this.compressionEngine.getCompressionLog();
  }
}

/**
 * 创建上下文管理器实例
 */
export function createContextManager(config?: ContextManagerConfig): ContextManager {
  return new ContextManager(config);
}
