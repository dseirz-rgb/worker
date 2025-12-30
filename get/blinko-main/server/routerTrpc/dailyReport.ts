/**
 * 日报路由 - Echo on Blinko 扩展
 * 提供日报生成和查询功能
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod';
import { DailyReportJob } from '../jobs/dailyReportJob';

export const dailyReportRouter = router({
  /**
   * 手动生成今日日报
   */
  generate: authProcedure
    .mutation(async ({ ctx }) => {
      const content = await DailyReportJob.generateForUser(Number(ctx.id));
      return { success: true, content };
    }),

  /**
   * 触发定时任务立即执行 (管理员)
   */
  triggerNow: authProcedure
    .mutation(async () => {
      const jobId = await DailyReportJob.TriggerNow();
      return { success: true, jobId };
    }),

  /**
   * 获取任务调度状态
   */
  getStatus: authProcedure
    .query(async () => {
      const isScheduled = await DailyReportJob.isScheduled();
      const schedule = await DailyReportJob.getSchedule();
      return { 
        isScheduled, 
        schedule: schedule?.cron || null,
        taskName: 'dailyReport'
      };
    }),

  /**
   * 更新调度时间
   */
  updateSchedule: authProcedure
    .input(z.object({
      cronTime: z.string().regex(/^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/, 
        '无效的 cron 表达式')
    }))
    .mutation(async ({ input }) => {
      await DailyReportJob.SetCronTime(input.cronTime);
      return { success: true, cronTime: input.cronTime };
    }),

  /**
   * 启动日报任务
   */
  start: authProcedure
    .input(z.object({
      cronTime: z.string().optional(),
      immediate: z.boolean().optional().default(false)
    }))
    .mutation(async ({ input }) => {
      await DailyReportJob.Start(input.cronTime, input.immediate);
      return { success: true };
    }),

  /**
   * 停止日报任务
   */
  stop: authProcedure
    .mutation(async () => {
      await DailyReportJob.Stop();
      return { success: true };
    }),
});
