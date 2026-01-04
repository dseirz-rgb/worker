/**
 * Echo v3.2: 建议系统 tRPC 路由
 * 提供建议获取、响应和统计功能
 */

import { authProcedure, router } from '@server/middleware';
import { z } from 'zod/v3';
import { createSuggestionEngine, SuggestionAction } from '../aiServer/suggestionEngine';

export const suggestionRouter = router({
  /**
   * 获取待处理建议
   */
  getPending: authProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).optional().default(5),
      })
    )
    .query(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      const engine = createSuggestionEngine(accountId);
      
      const suggestions = await engine.getPendingSuggestions(input.limit);
      return suggestions;
    }),

  /**
   * 生成新建议
   * 基于用户的任务、笔记和活动数据生成建议
   */
  generate: authProcedure.mutation(async ({ ctx }) => {
    const accountId = Number(ctx.id);
    const engine = createSuggestionEngine(accountId);
    
    const suggestions = await engine.generateSuggestions();
    return { success: true, count: suggestions.length, suggestions };
  }),

  /**
   * 响应建议
   * @param suggestionId - 建议 ID
   * @param action - 操作: 'accept' | 'postpone' | 'reject'
   * @param reason - 拒绝原因 (可选)
   * @param postponeDuration - 推迟时长，分钟 (可选)
   */
  respond: authProcedure
    .input(
      z.object({
        suggestionId: z.number(),
        action: z.enum(['accept', 'postpone', 'reject']),
        reason: z.string().optional(),
        postponeDuration: z.number().min(1).max(10080).optional(), // 最多 7 天
      })
    )
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      const engine = createSuggestionEngine(accountId);

      const suggestion = await engine.respondToSuggestion({
        suggestionId: input.suggestionId,
        action: input.action as SuggestionAction,
        reason: input.reason,
        postponeDuration: input.postponeDuration,
      });

      return { success: true, suggestion };
    }),

  /**
   * 获取建议统计
   * 返回接受率、拒绝率等统计数据
   */
  getStats: authProcedure.query(async ({ ctx }) => {
    const accountId = Number(ctx.id);
    const engine = createSuggestionEngine(accountId);
    
    const stats = await engine.getStats();
    return stats;
  }),

  /**
   * 批量响应建议
   * 一次性处理多个建议
   */
  batchRespond: authProcedure
    .input(
      z.object({
        responses: z.array(
          z.object({
            suggestionId: z.number(),
            action: z.enum(['accept', 'postpone', 'reject']),
            reason: z.string().optional(),
            postponeDuration: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      const engine = createSuggestionEngine(accountId);

      const results = await Promise.allSettled(
        input.responses.map((response) =>
          engine.respondToSuggestion({
            suggestionId: response.suggestionId,
            action: response.action as SuggestionAction,
            reason: response.reason,
            postponeDuration: response.postponeDuration,
          })
        )
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      return { success: true, succeeded, failed };
    }),
});
