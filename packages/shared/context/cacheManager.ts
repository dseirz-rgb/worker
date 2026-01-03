/**
 * 缓存管理器
 * 
 * 管理 MCP 工具结果缓存：
 * - 缓存工具调用结果
 * - 支持 pin 功能防止淘汰
 * - LRU 淘汰策略
 * - 会话结束时清除缓存
 */

import { CacheEntry, CacheStats } from './types';

/** 缓存配置 */
export interface CacheConfig {
  /** 最大缓存项数 */
  maxItems: number;
  /** 最大 token 数 */
  maxTokens: number;
  /** token 计数函数 */
  tokenCounter: (content: string) => number;
}

/** 默认缓存配置 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxItems: 100,
  maxTokens: 50000,
  tokenCounter: (content: string) => Math.ceil(content.length / 4),
};

/**
 * 缓存管理器类
 */
export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  /**
   * 生成缓存键
   * 
   * @param toolName - 工具名称
   * @param params - 调用参数
   * @returns 缓存键
   */
  private generateCacheKey(toolName: string, params: Record<string, unknown>): string {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort());
    return `${toolName}:${paramsStr}`;
  }

  /**
   * 缓存工具结果
   * 
   * @param toolName - 工具名称
   * @param params - 调用参数
   * @param result - 结果内容
   */
  cacheToolResult(
    toolName: string,
    params: Record<string, unknown>,
    result: string
  ): void {
    const key = this.generateCacheKey(toolName, params);
    const tokenCount = this.config.tokenCounter(result);
    const now = new Date();

    // 检查是否需要淘汰
    this.evictIfNeeded(tokenCount);

    const entry: CacheEntry = {
      key,
      toolName,
      params: { ...params },
      result,
      tokenCount,
      isPinned: false,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
    };

    this.cache.set(key, entry);
  }

  /**
   * 获取缓存的结果
   * 
   * @param toolName - 工具名称
   * @param params - 调用参数
   * @returns 缓存的结果，如果不存在则返回 null
   */
  getCachedResult(
    toolName: string,
    params: Record<string, unknown>
  ): string | null {
    const key = this.generateCacheKey(toolName, params);
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    // 更新访问信息
    entry.lastAccessedAt = new Date();
    entry.accessCount++;
    this.hitCount++;

    return entry.result;
  }

  /**
   * Pin 一个缓存项
   * 
   * @param toolName - 工具名称
   * @param params - 调用参数
   * @returns 是否成功
   */
  pinResult(toolName: string, params: Record<string, unknown>): boolean {
    const key = this.generateCacheKey(toolName, params);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    entry.isPinned = true;
    return true;
  }

  /**
   * 通过缓存键 Pin 一个缓存项
   * 
   * @param cacheKey - 缓存键
   * @returns 是否成功
   */
  pinResultByKey(cacheKey: string): boolean {
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return false;
    }

    entry.isPinned = true;
    return true;
  }

  /**
   * Unpin 一个缓存项
   * 
   * @param toolName - 工具名称
   * @param params - 调用参数
   * @returns 是否成功
   */
  unpinResult(toolName: string, params: Record<string, unknown>): boolean {
    const key = this.generateCacheKey(toolName, params);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    entry.isPinned = false;
    return true;
  }

  /**
   * 清除会话缓存
   */
  clearSessionCache(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): CacheStats {
    let totalTokens = 0;
    let pinnedItems = 0;

    for (const entry of this.cache.values()) {
      totalTokens += entry.tokenCount;
      if (entry.isPinned) {
        pinnedItems++;
      }
    }

    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;

    return {
      totalItems: this.cache.size,
      pinnedItems,
      totalTokens,
      hitRate,
    };
  }

  /**
   * 检查缓存是否存在
   * 
   * @param toolName - 工具名称
   * @param params - 调用参数
   * @returns 是否存在
   */
  has(toolName: string, params: Record<string, unknown>): boolean {
    const key = this.generateCacheKey(toolName, params);
    return this.cache.has(key);
  }

  /**
   * 删除缓存项
   * 
   * @param toolName - 工具名称
   * @param params - 调用参数
   * @returns 是否成功删除
   */
  delete(toolName: string, params: Record<string, unknown>): boolean {
    const key = this.generateCacheKey(toolName, params);
    return this.cache.delete(key);
  }

  /**
   * 获取所有缓存项
   */
  getAllEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * 获取所有 pinned 的缓存项
   */
  getPinnedEntries(): CacheEntry[] {
    return Array.from(this.cache.values()).filter((entry) => entry.isPinned);
  }

  /**
   * 如果需要，淘汰缓存项
   * 
   * @param newTokens - 新增的 token 数
   */
  private evictIfNeeded(newTokens: number): void {
    const stats = this.getCacheStats();

    // 检查是否超出限制
    const needsEviction =
      this.cache.size >= this.config.maxItems ||
      stats.totalTokens + newTokens > this.config.maxTokens;

    if (!needsEviction) {
      return;
    }

    // 获取可淘汰的项（非 pinned）
    const evictable = Array.from(this.cache.entries())
      .filter(([, entry]) => !entry.isPinned)
      .sort((a, b) => {
        // LRU: 按最后访问时间排序
        return a[1].lastAccessedAt.getTime() - b[1].lastAccessedAt.getTime();
      });

    // 淘汰直到满足条件
    let currentTokens = stats.totalTokens;
    let currentItems = this.cache.size;

    for (const [key, entry] of evictable) {
      if (
        currentItems < this.config.maxItems &&
        currentTokens + newTokens <= this.config.maxTokens
      ) {
        break;
      }

      this.cache.delete(key);
      currentTokens -= entry.tokenCount;
      currentItems--;
    }
  }

  /**
   * 获取缓存配置
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * 更新缓存配置
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * 创建缓存管理器实例
 */
export function createCacheManager(config?: Partial<CacheConfig>): CacheManager {
  return new CacheManager(config);
}
