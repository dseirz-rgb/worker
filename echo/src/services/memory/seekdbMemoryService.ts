/**
 * 基于 SeekDB 的记忆服务
 * 为 AI 助手提供语义记忆检索能力
 */

import { seekdbService, type SearchResult } from '../database/seekdbService';

// ============== 类型定义 ==============

export interface MemoryItem {
  id: string;
  content: string;
  userId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySearchResult {
  memory: MemoryItem;
  score: number;
}

export interface AddMemoryOptions {
  source?: string;
  sourceId?: string;
  domain?: string;
  category?: string;
}

export interface SearchMemoryOptions {
  limit?: number;
  domain?: string;
}

// ============== SeekDB Memory Service ==============

export class SeekDBMemoryService {
  /**
   * 添加记忆
   */
  async add(
    content: string,
    userId: string,
    options?: AddMemoryOptions
  ): Promise<MemoryItem> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await seekdbService.createMemory({
      id,
      content,
      userId,
      source: options?.source || 'chat',
      sourceId: options?.sourceId,
      category: options?.category || 'general',
      domain: options?.domain || 'general',
      createdAt: now,
    });

    return {
      id,
      content,
      userId,
      metadata: {
        source: options?.source || 'chat',
        sourceId: options?.sourceId,
        category: options?.category || 'general',
        domain: options?.domain || 'general',
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * 搜索记忆
   */
  async search(
    query: string,
    userId: string,
    options?: SearchMemoryOptions
  ): Promise<MemorySearchResult[]> {
    const results = await seekdbService.search({
      query,
      collection: 'memories',
      limit: options?.limit || 10,
      domain: options?.domain,
      searchType: 'hybrid',
    });

    return results.map((r: SearchResult) => ({
      memory: {
        id: r.id,
        content: r.content,
        userId,
        metadata: r.metadata,
        createdAt: (r.metadata.created_at as string) || '',
        updatedAt: (r.metadata.created_at as string) || '',
      },
      score: r.score,
    }));
  }

  /**
   * 获取 AI 上下文
   * 根据查询返回最相关的记忆作为上下文
   */
  async getContext(
    query: string,
    userId: string,
    maxItems = 5
  ): Promise<string> {
    const results = await this.search(query, userId, { limit: maxItems });

    if (results.length === 0) {
      return '';
    }

    const contextLines = results.map((r) => `- ${r.memory.content}`);
    return `相关记忆：\n${contextLines.join('\n')}`;
  }

  /**
   * 获取记忆
   */
  async get(memoryId: string): Promise<MemoryItem | null> {
    const result = await seekdbService.getMemory(memoryId);
    if (!result) return null;

    return {
      id: result.id,
      content: result.content,
      userId: (result.metadata.user_id as string) || 'default',
      metadata: result.metadata,
      createdAt: (result.metadata.created_at as string) || '',
      updatedAt: (result.metadata.created_at as string) || '',
    };
  }

  /**
   * 列出用户的所有记忆
   */
  async list(
    userId: string,
    limit = 100,
    domain?: string
  ): Promise<MemoryItem[]> {
    const results = await seekdbService.listMemories(limit, userId, domain);

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      userId,
      metadata: r.metadata,
      createdAt: (r.metadata.created_at as string) || '',
      updatedAt: (r.metadata.created_at as string) || '',
    }));
  }

  /**
   * 删除记忆
   */
  async delete(memoryId: string): Promise<boolean> {
    return seekdbService.deleteMemory(memoryId);
  }

  /**
   * 批量添加记忆
   */
  async addBatch(
    items: Array<{ content: string; userId: string; options?: AddMemoryOptions }>
  ): Promise<MemoryItem[]> {
    const results: MemoryItem[] = [];
    
    for (const item of items) {
      const memory = await this.add(item.content, item.userId, item.options);
      results.push(memory);
    }
    
    return results;
  }

  /**
   * 按领域搜索记忆
   */
  async searchByDomain(
    query: string,
    userId: string,
    domain: string,
    limit = 10
  ): Promise<MemorySearchResult[]> {
    return this.search(query, userId, { limit, domain });
  }

  /**
   * 获取最近的记忆
   */
  async getRecent(userId: string, limit = 10): Promise<MemoryItem[]> {
    // 使用空查询获取最近的记忆
    const results = await seekdbService.listMemories(limit, userId);
    
    return results.map((r) => ({
      id: r.id,
      content: r.content,
      userId,
      metadata: r.metadata,
      createdAt: (r.metadata.created_at as string) || '',
      updatedAt: (r.metadata.created_at as string) || '',
    }));
  }
}

// 单例导出
export const seekdbMemoryService = new SeekDBMemoryService();
