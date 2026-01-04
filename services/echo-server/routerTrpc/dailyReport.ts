/**
 * Echo v3.2: 日报 tRPC 路由
 * 提供日报生成、查询和设置管理功能
 */

import { authProcedure, router } from '@server/middleware';
import { z } from 'zod/v3';
import { prisma } from '../prisma';
import {
  generateDailyReport,
  getDailyReport,
  listDailyReports,
  ReportType,
  createReportScheduler,
} from '../aiServer/reportGenerator';
import { startOfDay } from 'date-fns';

export const dailyReportRouter = router({
  /**
   * 生成日报
   * @param type - 日报类型: 'morning' | 'evening'
   * @param date - 日期 (可选，默认今天)
   */
  generate: authProcedure
    .input(
      z.object({
        type: z.enum(['morning', 'evening']),
        date: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { type, date = new Date() } = input;
      const accountId = Number(ctx.id);

      const { report, content } = await generateDailyReport(accountId, type, date);

      // 发送通知
      await prisma.notifications.create({
        data: {
          type: 'report',
          title: type === 'morning' ? '早报已生成' : '晚报已生成',
          content: content.summary,
          actionUrl: `/daily-report/${type}/${report.date.toISOString().split('T')[0]}`,
          accountId,
        },
      });

      return { success: true, report, content };
    }),

  /**
   * 获取指定日期的日报
   */
  get: authProcedure
    .input(
      z.object({
        type: z.enum(['morning', 'evening']),
        date: z.date(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { type, date } = input;
      const accountId = Number(ctx.id);

      const report = await getDailyReport(accountId, type, date);
      return report;
    }),

  /**
   * 获取日报列表
   */
  list: authProcedure
    .input(
      z.object({
        type: z.enum(['morning', 'evening', 'all']).optional().default('all'),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(100).optional().default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      const reports = await listDailyReports(accountId, input);
      return reports;
    }),

  /**
   * 获取日报设置
   */
  getSettings: authProcedure.query(async ({ ctx }) => {
    const accountId = Number(ctx.id);

    // 从 userPreference 获取日报设置
    const settings = await prisma.userPreference.findMany({
      where: {
        accountId,
        category: 'report',
      },
    });

    // 转换为对象格式
    const settingsMap: Record<string, string> = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });

    return {
      morningReportTime: settingsMap['morningReportTime'] || '08:00',
      eveningReportTime: settingsMap['eveningReportTime'] || '21:00',
      morningReportEnabled: settingsMap['morningReportEnabled'] !== 'false',
      eveningReportEnabled: settingsMap['eveningReportEnabled'] !== 'false',
      notificationEnabled: settingsMap['notificationEnabled'] !== 'false',
    };
  }),

  /**
   * 更新日报设置
   */
  updateSettings: authProcedure
    .input(
      z.object({
        morningReportTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        eveningReportTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        morningReportEnabled: z.boolean().optional(),
        eveningReportEnabled: z.boolean().optional(),
        notificationEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);

      // 更新各个设置项
      const updates: Array<{ key: string; value: string }> = [];
      
      if (input.morningReportTime !== undefined) {
        updates.push({ key: 'morningReportTime', value: input.morningReportTime });
      }
      if (input.eveningReportTime !== undefined) {
        updates.push({ key: 'eveningReportTime', value: input.eveningReportTime });
      }
      if (input.morningReportEnabled !== undefined) {
        updates.push({ key: 'morningReportEnabled', value: String(input.morningReportEnabled) });
      }
      if (input.eveningReportEnabled !== undefined) {
        updates.push({ key: 'eveningReportEnabled', value: String(input.eveningReportEnabled) });
      }
      if (input.notificationEnabled !== undefined) {
        updates.push({ key: 'notificationEnabled', value: String(input.notificationEnabled) });
      }

      // 批量 upsert
      await Promise.all(
        updates.map(({ key, value }) =>
          prisma.userPreference.upsert({
            where: {
              accountId_category_key: {
                accountId,
                category: 'report',
                key,
              },
            },
            update: { value },
            create: {
              accountId,
              category: 'report',
              key,
              value,
              source: 'explicit',
            },
          })
        )
      );

      // 同步调度设置
      const scheduler = createReportScheduler(accountId);
      await scheduler.syncScheduleFromSettings();

      return { success: true };
    }),

  /**
   * 获取今日日报状态
   * 返回今日早报和晚报是否已生成
   */
  getTodayStatus: authProcedure.query(async ({ ctx }) => {
    const accountId = Number(ctx.id);
    const today = startOfDay(new Date());

    const [morningReport, eveningReport] = await Promise.all([
      prisma.dailyReport.findUnique({
        where: {
          type_date_accountId: {
            type: 'morning',
            date: today,
            accountId,
          },
        },
        select: { id: true, generatedAt: true },
      }),
      prisma.dailyReport.findUnique({
        where: {
          type_date_accountId: {
            type: 'evening',
            date: today,
            accountId,
          },
        },
        select: { id: true, generatedAt: true },
      }),
    ]);

    return {
      morning: morningReport ? { generated: true, generatedAt: morningReport.generatedAt } : { generated: false },
      evening: eveningReport ? { generated: true, generatedAt: eveningReport.generatedAt } : { generated: false },
    };
  }),

  /**
   * 获取调度状态
   * 返回早报和晚报的调度启用状态
   */
  getScheduleStatus: authProcedure.query(async ({ ctx }) => {
    const accountId = Number(ctx.id);
    const scheduler = createReportScheduler(accountId);
    return scheduler.getScheduleStatus();
  }),

  /**
   * 初始化日报调度
   * 根据用户设置创建调度任务
   */
  initSchedule: authProcedure.mutation(async ({ ctx }) => {
    const accountId = Number(ctx.id);
    const scheduler = createReportScheduler(accountId);
    await scheduler.syncScheduleFromSettings();
    return { success: true };
  }),
});
