/**
 * Automation 路由 - AI 服务统一迁移
 * 
 * 提供自动化任务管理的 tRPC 端点
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod/v3';
import { TRPCError } from '@trpc/server';
import { automationManager } from '@server/aiServer/automationManager';

export const automationRouter = router({
  /**
   * 创建自动化任务
   */
  createAutomation: authProcedure
    .input(z.object({
      name: z.string().min(1, '名称不能为空').max(100),
      query: z.string().min(1, '查询不能为空').max(2000),
      schedule: z.string().optional(),
      naturalSchedule: z.string().optional(),
      agentId: z.number().optional(),
      resultStorage: z.enum(['note', 'memory', 'both']).default('note'),
      notificationChannels: z.array(z.string()).default([]),
      isEnabled: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      // 必须提供 schedule 或 naturalSchedule
      if (!input.schedule && !input.naturalSchedule) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '请提供调度时间 (schedule 或 naturalSchedule)',
        });
      }

      try {
        const automation = await automationManager.createAutomation({
          ...input,
          accountId,
        });

        return automation;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create automation',
        });
      }
    }),

  /**
   * 获取自动化任务列表
   */
  getAutomations: authProcedure
    .query(async ({ ctx }) => {
      const accountId = Number(ctx.sub);
      return automationManager.getAutomations(accountId);
    }),

  /**
   * 获取单个自动化任务
   */
  getAutomation: authProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const automation = await automationManager.getAutomation(input.id);
      
      if (!automation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Automation not found',
        });
      }

      // 检查权限
      const accountId = Number(ctx.sub);
      if (automation.accountId !== accountId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      return automation;
    }),

  /**
   * 更新自动化任务
   */
  updateAutomation: authProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      query: z.string().min(1).max(2000).optional(),
      schedule: z.string().optional(),
      naturalSchedule: z.string().optional(),
      agentId: z.number().nullable().optional(),
      resultStorage: z.enum(['note', 'memory', 'both']).optional(),
      notificationChannels: z.array(z.string()).optional(),
      isEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);
      const { id, ...data } = input;

      // 检查权限
      const existing = await automationManager.getAutomation(id);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Automation not found',
        });
      }

      if (existing.accountId !== accountId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own automations',
        });
      }

      try {
        return await automationManager.updateAutomation(id, data);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update automation',
        });
      }
    }),

  /**
   * 删除自动化任务
   */
  deleteAutomation: authProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      // 检查权限
      const existing = await automationManager.getAutomation(input.id);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Automation not found',
        });
      }

      if (existing.accountId !== accountId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own automations',
        });
      }

      try {
        await automationManager.deleteAutomation(input.id);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete automation',
        });
      }
    }),

  /**
   * 切换自动化任务状态
   */
  toggleAutomation: authProcedure
    .input(z.object({
      id: z.number(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      // 检查权限
      const existing = await automationManager.getAutomation(input.id);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Automation not found',
        });
      }

      if (existing.accountId !== accountId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      try {
        return await automationManager.toggleAutomation(input.id, input.enabled);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to toggle automation',
        });
      }
    }),

  /**
   * 手动运行自动化任务
   */
  runAutomation: authProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      // 检查权限
      const existing = await automationManager.getAutomation(input.id);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Automation not found',
        });
      }

      if (existing.accountId !== accountId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      try {
        const run = await automationManager.runAutomation(input.id);
        return run;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to run automation',
        });
      }
    }),

  /**
   * 获取运行历史
   */
  getRunHistory: authProcedure
    .input(z.object({
      automationId: z.number(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      // 检查权限
      const existing = await automationManager.getAutomation(input.automationId);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Automation not found',
        });
      }

      if (existing.accountId !== accountId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      return automationManager.getRunHistory(input.automationId, input.limit);
    }),

  /**
   * 解析自然语言调度
   */
  parseSchedule: authProcedure
    .input(z.object({
      naturalSchedule: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      try {
        const cron = await automationManager.parseNaturalSchedule(input.naturalSchedule);
        return { cron, naturalSchedule: input.naturalSchedule };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to parse schedule',
        });
      }
    }),
});
