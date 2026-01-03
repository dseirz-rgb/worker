/**
 * 活动记录路由 - Echo on Blinko 扩展
 * 提供活动记录的查询和统计功能
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod';
import { prisma } from '../prisma';

export const activityRouter = router({
  /**
   * 记录活动 (由 Tauri 客户端调用)
   */
  record: authProcedure
    .input(z.object({
      appName: z.string().max(255),
      windowTitle: z.string(),
      bundleId: z.string().max(255).optional(),
      url: z.string().optional(),
      duration: z.number().min(0),
      domainId: z.number().optional(),
      startTime: z.string().datetime(),
      endTime: z.string().datetime(),
    }))
    .mutation(async ({ input, ctx }) => {
      const record = await prisma.activityRecord.create({
        data: {
          ...input,
          startTime: new Date(input.startTime),
          endTime: new Date(input.endTime),
          accountId: Number(ctx.id),
        },
      });
      return record;
    }),

  /**
   * 按日期范围获取活动
   */
  getByDateRange: authProcedure
    .input(z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      domainId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where: any = {
        accountId: Number(ctx.id),
        startTime: { gte: new Date(input.startDate) },
        endTime: { lte: new Date(input.endDate) },
      };
      if (input.domainId) {
        where.domainId = input.domainId;
      }
      return prisma.activityRecord.findMany({
        where,
        orderBy: { startTime: 'asc' },
        include: { domain: true },
      });
    }),

  /**
   * 按应用统计
   */
  statsByApp: authProcedure
    .input(z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }))
    .query(async ({ input, ctx }) => {
      const activities = await prisma.activityRecord.findMany({
        where: {
          accountId: Number(ctx.id),
          startTime: { gte: new Date(input.startDate) },
          endTime: { lte: new Date(input.endDate) },
        },
      });
      const stats = activities.reduce((acc, a) => {
        if (!acc[a.appName]) {
          acc[a.appName] = { appName: a.appName, totalDuration: 0, count: 0 };
        }
        acc[a.appName].totalDuration += a.duration;
        acc[a.appName].count += 1;
        return acc;
      }, {} as Record<string, { appName: string; totalDuration: number; count: number }>);
      return Object.values(stats).sort((a, b) => b.totalDuration - a.totalDuration);
    }),

  /**
   * 按领域统计
   */
  statsByDomain: authProcedure
    .input(z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }))
    .query(async ({ input, ctx }) => {
      const activities = await prisma.activityRecord.findMany({
        where: {
          accountId: Number(ctx.id),
          startTime: { gte: new Date(input.startDate) },
          endTime: { lte: new Date(input.endDate) },
        },
        include: { domain: true },
      });
      const stats = activities.reduce((acc, a) => {
        const domainName = a.domain?.name || '未分类';
        if (!acc[domainName]) {
          acc[domainName] = { domainName, totalDuration: 0, count: 0 };
        }
        acc[domainName].totalDuration += a.duration;
        acc[domainName].count += 1;
        return acc;
      }, {} as Record<string, { domainName: string; totalDuration: number; count: number }>);
      return Object.values(stats).sort((a, b) => b.totalDuration - a.totalDuration);
    }),

  /**
   * 今日时间线
   */
  todayTimeline: authProcedure
    .query(async ({ ctx }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return prisma.activityRecord.findMany({
        where: {
          accountId: Number(ctx.id),
          startTime: { gte: today },
          endTime: { lt: tomorrow },
        },
        orderBy: { startTime: 'asc' },
        include: { domain: true },
      });
    }),

  /**
   * 获取今日统计摘要
   */
  todaySummary: authProcedure
    .query(async ({ ctx }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const activities = await prisma.activityRecord.findMany({
        where: {
          accountId: Number(ctx.id),
          startTime: { gte: today },
          endTime: { lt: tomorrow },
        },
      });
      const totalDuration = activities.reduce((sum, a) => sum + a.duration, 0);
      const uniqueApps = new Set(activities.map(a => a.appName)).size;
      return { totalDuration, activityCount: activities.length, uniqueApps };
    }),
});
