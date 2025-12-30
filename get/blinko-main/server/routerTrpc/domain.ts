/**
 * 领域管理路由 - Echo on Blinko 扩展
 * 提供领域的 CRUD 和统计功能
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '../prisma';

export const domainRouter = router({
  /**
   * 创建领域
   */
  create: authProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
      icon: z.string().max(50).optional(),
      keywords: z.array(z.string()).default([]),
    }))
    .mutation(async ({ input, ctx }) => {
      const domain = await prisma.domain.create({
        data: {
          ...input,
          accountId: Number(ctx.id),
        },
      });
      return domain;
    }),

  /**
   * 获取领域列表
   */
  list: authProcedure
    .query(async ({ ctx }) => {
      const domains = await prisma.domain.findMany({
        where: { accountId: Number(ctx.id) },
        orderBy: { name: 'asc' },
      });
      return domains;
    }),

  /**
   * 更新领域
   */
  update: authProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      icon: z.string().max(50).optional(),
      keywords: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const domain = await prisma.domain.updateMany({
        where: { id, accountId: Number(ctx.id) },
        data,
      });
      return domain;
    }),

  /**
   * 删除领域
   */
  delete: authProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await prisma.domain.deleteMany({
        where: { id: input.id, accountId: Number(ctx.id) },
      });
      return { success: true };
    }),

  /**
   * 获取领域统计
   */
  stats: authProcedure
    .input(z.object({
      domainId: z.number(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where: any = {
        domainId: input.domainId,
        accountId: Number(ctx.id),
      };
      if (input.startDate) {
        where.startTime = { gte: new Date(input.startDate) };
      }
      if (input.endDate) {
        where.endTime = { lte: new Date(input.endDate) };
      }
      const activities = await prisma.activityRecord.findMany({ where });
      const totalDuration = activities.reduce((sum, a) => sum + a.duration, 0);
      const appStats = activities.reduce((acc, a) => {
        acc[a.appName] = (acc[a.appName] || 0) + a.duration;
        return acc;
      }, {} as Record<string, number>);
      return { totalDuration, appStats, activityCount: activities.length };
    }),
});
