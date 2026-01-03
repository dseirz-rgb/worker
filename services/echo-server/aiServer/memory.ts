/**
 * AI 记忆系统 - Echo on Blinko 扩展
 * 
 * 实现三层记忆架构:
 * - 短期记忆 (Short-term): 当前会话上下文，自动过期
 * - 长期记忆 (Long-term): 持久化的重要信息和用户偏好
 * - 工作记忆 (Working): 当前任务相关的临时信息
 * 
 * 基于 mem0 概念实现，但使用 Prisma + PostgreSQL
 */

import { prisma } from '../prisma';
import { AiModelFactory } from './aiModelFactory';
import { embed } from 'ai';
import dayjs from 'dayjs';

// 记忆类型
export type MemoryType = 'short_term' | 'long_term' | 'working';

// 记忆接口
export interface Memory {
  id: number;
  type: MemoryType;
  content: string;
  importance: number;
  accessCount: number;
  lastAccess: Date;
  expiresAt: Date | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

// 用户偏好接口
export interface UserPreference {
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: 'explicit' | 'inferred';
}

// 记忆配置
const MEMORY_CONFIG = {
  // 短期记忆过期时间 (小时)
  shortTermExpiry: 24,
  // 工作记忆过期时间 (小时)
  workingMemoryExpiry: 2,
  // 最大短期记忆数量
  maxShortTermMemories: 50,
  // 最大工作记忆数量
  maxWorkingMemories: 10,
  // 重要性衰减因子
  importanceDecay: 0.95,
  // 访问增益
  accessBoost: 0.1,
};

/**
 * 记忆管理器
 */
export class MemoryManager {
  private accountId: number;

  constructor(accountId: number) {
    this.accountId = accountId;
  }

  /**
   * 添加记忆
   */
  async addMemory(
    content: string,
    type: MemoryType = 'short_term',
    options?: {
      importance?: number;
      metadata?: Record<string, any>;
      expiresIn?: number; // 小时
    }
  ): Promise<Memory> {
    const { importance = 0.5, metadata = null, expiresIn } = options || {};

    // 计算过期时间
    let expiresAt: Date | null = null;
    if (type === 'short_term') {
      expiresAt = dayjs().add(expiresIn || MEMORY_CONFIG.shortTermExpiry, 'hour').toDate();
    } else if (type === 'working') {
      expiresAt = dayjs().add(expiresIn || MEMORY_CONFIG.workingMemoryExpiry, 'hour').toDate();
    }

    // 生成向量嵌入 (如果配置了嵌入模型)
    let embedding: number[] | null = null;
    try {
      const { Embeddings } = await AiModelFactory.GetProvider();
      if (Embeddings) {
        const result = await embed({ value: content, model: Embeddings });
        embedding = result.embedding;
      }
    } catch (e) {
      console.warn('[Memory] 生成嵌入失败:', e);
    }

    const memory = await prisma.memory.create({
      data: {
        type,
        content,
        importance,
        embedding: embedding ? { vector: embedding } : null,
        expiresAt,
        metadata,
        accountId: this.accountId,
      },
    });

    // 清理过期和超量的记忆
    await this.cleanup(type);

    return memory as Memory;
  }

  /**
   * 检索相关记忆
   */
  async retrieveMemories(
    query: string,
    options?: {
      types?: MemoryType[];
      limit?: number;
      minImportance?: number;
    }
  ): Promise<Memory[]> {
    const { types = ['short_term', 'long_term', 'working'], limit = 10, minImportance = 0 } = options || {};

    // 获取所有有效记忆
    const memories = await prisma.memory.findMany({
      where: {
        accountId: this.accountId,
        type: { in: types },
        importance: { gte: minImportance },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: [
        { importance: 'desc' },
        { lastAccess: 'desc' },
      ],
      take: limit * 2, // 取更多用于后续过滤
    });

    // 如果有嵌入模型，使用向量相似度排序
    let sortedMemories = memories;
    try {
      const { Embeddings } = await AiModelFactory.GetProvider();
      if (Embeddings && memories.some(m => m.embedding)) {
        const { embedding: queryEmbedding } = await embed({ value: query, model: Embeddings });
        
        // 计算相似度并排序
        sortedMemories = memories
          .map(m => {
            const memEmbedding = (m.embedding as any)?.vector;
            if (!memEmbedding) return { ...m, similarity: 0 };
            const similarity = this.cosineSimilarity(queryEmbedding, memEmbedding);
            return { ...m, similarity };
          })
          .sort((a, b) => (b as any).similarity - (a as any).similarity);
      }
    } catch (e) {
      console.warn('[Memory] 向量检索失败，使用默认排序:', e);
    }

    // 更新访问记录
    const selectedMemories = sortedMemories.slice(0, limit);
    await this.updateAccessRecords(selectedMemories.map(m => m.id));

    return selectedMemories as Memory[];
  }

  /**
   * 获取用户偏好
   */
  async getPreferences(category?: string): Promise<UserPreference[]> {
    const preferences = await prisma.userPreference.findMany({
      where: {
        accountId: this.accountId,
        ...(category ? { category } : {}),
      },
      orderBy: { confidence: 'desc' },
    });

    return preferences.map(p => ({
      category: p.category,
      key: p.key,
      value: p.value,
      confidence: p.confidence,
      source: p.source as 'explicit' | 'inferred',
    }));
  }

  /**
   * 设置用户偏好
   */
  async setPreference(
    category: string,
    key: string,
    value: string,
    options?: {
      confidence?: number;
      source?: 'explicit' | 'inferred';
    }
  ): Promise<void> {
    const { confidence = 0.8, source = 'explicit' } = options || {};

    await prisma.userPreference.upsert({
      where: {
        accountId_category_key: {
          accountId: this.accountId,
          category,
          key,
        },
      },
      update: {
        value,
        confidence,
        source,
      },
      create: {
        accountId: this.accountId,
        category,
        key,
        value,
        confidence,
        source,
      },
    });
  }

  /**
   * 从对话中提取并存储记忆
   */
  async extractAndStoreMemories(
    messages: Array<{ role: string; content: string }>,
    conversationId?: number
  ): Promise<void> {
    // 提取用户消息
    const userMessages = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n');

    if (!userMessages.trim()) return;

    // 使用 AI 提取关键信息
    try {
      const agent = await AiModelFactory.BaseChatAgent({ withTools: false });
      const extractionPrompt = `分析以下用户消息，提取重要的信息和偏好。

用户消息:
${userMessages}

请以 JSON 格式返回:
{
  "facts": ["用户提到的重要事实"],
  "preferences": [{"category": "类别", "key": "键", "value": "值"}],
  "topics": ["用户感兴趣的话题"]
}

只返回 JSON，不要其他内容。`;

      const result = await agent.generate([
        { role: 'user' as const, content: extractionPrompt }
      ]);

      // 解析结果
      const jsonMatch = result.text?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);

        // 存储事实为长期记忆
        for (const fact of extracted.facts || []) {
          await this.addMemory(fact, 'long_term', { importance: 0.7 });
        }

        // 存储偏好
        for (const pref of extracted.preferences || []) {
          await this.setPreference(pref.category, pref.key, pref.value, {
            source: 'inferred',
            confidence: 0.6,
          });
        }

        // 存储话题为短期记忆
        for (const topic of extracted.topics || []) {
          await this.addMemory(`用户对 ${topic} 感兴趣`, 'short_term', { importance: 0.5 });
        }
      }
    } catch (e) {
      console.warn('[Memory] 提取记忆失败:', e);
    }
  }

  /**
   * 构建记忆上下文
   */
  async buildMemoryContext(query: string): Promise<string> {
    // 获取相关记忆
    const memories = await this.retrieveMemories(query, {
      types: ['long_term', 'short_term'],
      limit: 5,
      minImportance: 0.3,
    });

    // 获取用户偏好
    const preferences = await this.getPreferences();

    // 构建上下文
    const parts: string[] = [];

    if (memories.length > 0) {
      parts.push('## 相关记忆');
      memories.forEach((m, i) => {
        parts.push(`${i + 1}. ${m.content}`);
      });
    }

    if (preferences.length > 0) {
      parts.push('\n## 用户偏好');
      const prefsByCategory = preferences.reduce((acc, p) => {
        if (!acc[p.category]) acc[p.category] = [];
        acc[p.category].push(`${p.key}: ${p.value}`);
        return acc;
      }, {} as Record<string, string[]>);

      for (const [category, prefs] of Object.entries(prefsByCategory)) {
        parts.push(`- ${category}: ${prefs.join(', ')}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * 清理过期和超量的记忆
   */
  private async cleanup(type: MemoryType): Promise<void> {
    // 删除过期记忆
    await prisma.memory.deleteMany({
      where: {
        accountId: this.accountId,
        expiresAt: { lt: new Date() },
      },
    });

    // 检查数量限制
    const maxCount = type === 'short_term' 
      ? MEMORY_CONFIG.maxShortTermMemories 
      : MEMORY_CONFIG.maxWorkingMemories;

    const count = await prisma.memory.count({
      where: {
        accountId: this.accountId,
        type,
      },
    });

    if (count > maxCount) {
      // 删除最不重要的记忆
      const toDelete = await prisma.memory.findMany({
        where: {
          accountId: this.accountId,
          type,
        },
        orderBy: [
          { importance: 'asc' },
          { lastAccess: 'asc' },
        ],
        take: count - maxCount,
        select: { id: true },
      });

      await prisma.memory.deleteMany({
        where: {
          id: { in: toDelete.map(m => m.id) },
        },
      });
    }
  }

  /**
   * 更新访问记录
   */
  private async updateAccessRecords(ids: number[]): Promise<void> {
    await prisma.memory.updateMany({
      where: { id: { in: ids } },
      data: {
        accessCount: { increment: 1 },
        lastAccess: new Date(),
      },
    });
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 衰减所有记忆的重要性
   */
  async decayImportance(): Promise<void> {
    await prisma.$executeRaw`
      UPDATE memory 
      SET importance = importance * ${MEMORY_CONFIG.importanceDecay}
      WHERE "accountId" = ${this.accountId}
      AND importance > 0.1
    `;
  }

  /**
   * 提升记忆重要性
   */
  async boostImportance(memoryId: number): Promise<void> {
    await prisma.memory.update({
      where: { id: memoryId },
      data: {
        importance: {
          increment: MEMORY_CONFIG.accessBoost,
        },
      },
    });
  }

  /**
   * 清除所有记忆
   */
  async clearAll(type?: MemoryType): Promise<void> {
    await prisma.memory.deleteMany({
      where: {
        accountId: this.accountId,
        ...(type ? { type } : {}),
      },
    });
  }

  /**
   * 获取记忆统计
   */
  async getStats(): Promise<{
    shortTerm: number;
    longTerm: number;
    working: number;
    preferences: number;
  }> {
    const [shortTerm, longTerm, working, preferences] = await Promise.all([
      prisma.memory.count({ where: { accountId: this.accountId, type: 'short_term' } }),
      prisma.memory.count({ where: { accountId: this.accountId, type: 'long_term' } }),
      prisma.memory.count({ where: { accountId: this.accountId, type: 'working' } }),
      prisma.userPreference.count({ where: { accountId: this.accountId } }),
    ]);

    return { shortTerm, longTerm, working, preferences };
  }
}

/**
 * 创建记忆管理器实例
 */
export function createMemoryManager(accountId: number): MemoryManager {
  return new MemoryManager(accountId);
}
