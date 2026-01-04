/**
 * 记忆系统 tRPC 路由 - Echo on Blinko 扩展
 * 
 * 提供 AI 记忆系统的 API 接口
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod/v3';
import { createMemoryManager, MemoryType } from '../aiServer/memory';

// 记忆类型枚举
const MemoryTypeEnum = z.enum(['short_term', 'long_term', 'working']);

export const memoryRouter = router({
  /**
   * 添加记忆
   */
  add: authProcedure
    .input(z.object({
      content: z.string().min(1),
      type: MemoryTypeEnum.default('short_term'),
      importance: z.number().min(0).max(1).optional(),
      metadata: z.record(z.any()).optional(),
      expiresIn: z.number().positive().optional(), // 小时
    }))
    .mutation(async ({ ctx, input }) => {
      const manager = createMemoryManager(Number(ctx.id));
      const memory = await manager.addMemory(input.content, input.type as MemoryType, {
        importance: input.importance,
        metadata: input.metadata,
        expiresIn: input.expiresIn,
      });
      return memory;
    }),

  /**
   * 检索相关记忆
   */
  retrieve: authProcedure
    .input(z.object({
      query: z.string().min(1),
      types: z.array(MemoryTypeEnum).optional(),
      limit: z.number().min(1).max(50).default(10),
      minImportance: z.number().min(0).max(1).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const manager = createMemoryManager(Number(ctx.id));
      const memories = await manager.retrieveMemories(input.query, {
        types: input.types as MemoryType[],
        limit: input.limit,
        minImportance: input.minImportance,
      });
      return memories;
    }),

  /**
   * 获取用户偏好
   */
  getPreferences: authProcedure
    .input(z.object({
      category: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const manager = createMemoryManager(Number(ctx.id));
      return await manager.getPreferences(input?.category);
    }),

  /**
   * 设置用户偏好
   */
  setPreference: authProcedure
    .input(z.object({
      category: z.string().min(1),
      key: z.string().min(1),
      value: z.string(),
      confidence: z.number().min(0).max(1).optional(),
      source: z.enum(['explicit', 'inferred']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const manager = createMemoryManager(Number(ctx.id));
      await manager.setPreference(input.category, input.key, input.value, {
        confidence: input.confidence,
        source: input.source,
      });
      return { success: true };
    }),

  /**
   * 删除偏好
   */
  deletePreference: authProcedure
    .input(z.object({
      category: z.string().min(1),
      key: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { prisma } = await import('../prisma');
      await prisma.userPreference.delete({
        where: {
          accountId_category_key: {
            accountId: Number(ctx.id),
            category: input.category,
            key: input.key,
          },
        },
      });
      return { success: true };
    }),

  /**
   * 构建记忆上下文
   */
  buildContext: authProcedure
    .input(z.object({
      query: z.string().min(1),
    }))
    .query(async ({ ctx, input }) => {
      const manager = createMemoryManager(Number(ctx.id));
      const context = await manager.buildMemoryContext(input.query);
      return { context };
    }),

  /**
   * 获取记忆统计
   */
  stats: authProcedure
    .query(async ({ ctx }) => {
      const manager = createMemoryManager(Number(ctx.id));
      return await manager.getStats();
    }),

  /**
   * 清除记忆
   */
  clear: authProcedure
    .input(z.object({
      type: MemoryTypeEnum.optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      const manager = createMemoryManager(Number(ctx.id));
      await manager.clearAll(input?.type as MemoryType);
      return { success: true };
    }),

  /**
   * 衰减记忆重要性
   */
  decay: authProcedure
    .mutation(async ({ ctx }) => {
      const manager = createMemoryManager(Number(ctx.id));
      await manager.decayImportance();
      return { success: true };
    }),
});
