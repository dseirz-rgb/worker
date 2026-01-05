/**
 * Investment Router - 投资 AI 功能 tRPC 端点
 * 
 * 提供投资模块的 AI 功能：
 * - 对话管理
 * - 流式对话
 * - 每日洞察
 * - 风控研报
 * 
 * @module services/echo-server/routerTrpc/investment
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod/v3';
import { TRPCError } from '@trpc/server';
import {
  investmentAgent,
  getInvestmentContext,
  generateDailyInsight,
} from '@server/aiServer/investment';
import {
  getConversations,
  getMessages,
  createConversation,
  deleteConversation,
  saveAnalysis,
  getLatestAnalysis,
  getAnalysisById,
} from '../lib/investmentDb';

// ============================================================================
// Input Schemas
// ============================================================================

const chatInputSchema = z.object({
  conversationId: z.number().optional(),
  message: z.string().min(1, '消息不能为空').max(10000),
  contextType: z.enum(['report', 'briefing', 'portfolio', 'general']).default('general'),
  includeContext: z.boolean().default(true),
});

const conversationIdSchema = z.object({
  conversationId: z.number(),
});

const createConversationSchema = z.object({
  title: z.string().max(100).optional(),
});


// ============================================================================
// Router
// ============================================================================

export const investmentRouter = router({
  /**
   * 发送消息（同步）
   */
  chat: authProcedure
    .input(chatInputSchema)
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      try {
        const response = await investmentAgent.chat(input, accountId);
        return response;
      } catch (error) {
        console.error('[Investment Router] chat error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : '对话失败',
        });
      }
    }),

  /**
   * 流式对话
   */
  streamChat: authProcedure
    .input(chatInputSchema)
    .mutation(async function* ({ input, ctx }) {
      const accountId = Number(ctx.sub);

      try {
        const generator = investmentAgent.streamChat(input, accountId);
        
        for await (const chunk of generator) {
          yield { chunk };
        }
      } catch (error) {
        console.error('[Investment Router] streamChat error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : '流式对话失败',
        });
      }
    }),

  /**
   * 获取对话列表
   */
  getConversations: authProcedure
    .query(async ({ ctx }) => {
      const accountId = Number(ctx.sub);

      try {
        const conversations = await getConversations(accountId);
        return conversations;
      } catch (error) {
        console.error('[Investment Router] getConversations error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '获取对话列表失败',
        });
      }
    }),

  /**
   * 获取对话消息
   */
  getMessages: authProcedure
    .input(conversationIdSchema)
    .query(async ({ input }) => {
      try {
        const messages = await getMessages(input.conversationId);
        return messages;
      } catch (error) {
        console.error('[Investment Router] getMessages error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '获取消息失败',
        });
      }
    }),

  /**
   * 创建新对话
   */
  createConversation: authProcedure
    .input(createConversationSchema)
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      try {
        const conversation = await createConversation(accountId, input.title);
        if (!conversation) {
          throw new Error('创建对话失败');
        }
        return conversation;
      } catch (error) {
        console.error('[Investment Router] createConversation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '创建对话失败',
        });
      }
    }),

  /**
   * 删除对话
   */
  deleteConversation: authProcedure
    .input(conversationIdSchema)
    .mutation(async ({ input }) => {
      try {
        const success = await deleteConversation(input.conversationId);
        if (!success) {
          throw new Error('删除对话失败');
        }
        return { success: true };
      } catch (error) {
        console.error('[Investment Router] deleteConversation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '删除对话失败',
        });
      }
    }),


  /**
   * 生成每日洞察
   */
  generateDailyInsight: authProcedure
    .mutation(async ({ ctx }) => {
      const accountId = Number(ctx.sub);

      try {
        const insight = await generateDailyInsight(accountId);
        return insight;
      } catch (error) {
        console.error('[Investment Router] generateDailyInsight error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '生成每日洞察失败',
        });
      }
    }),

  /**
   * 获取投资上下文（用于调试）
   */
  getContext: authProcedure
    .input(z.object({
      query: z.string().min(1).max(1000),
    }))
    .query(async ({ input }) => {
      try {
        const result = await getInvestmentContext(input.query);
        return result;
      } catch (error) {
        console.error('[Investment Router] getContext error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '获取上下文失败',
        });
      }
    }),

  /**
   * 获取最新的 AI 分析报告
   */
  getLatestAnalysis: authProcedure
    .query(async ({ ctx }) => {
      const accountId = Number(ctx.sub);

      try {
        const analysis = await getLatestAnalysis(accountId);
        return analysis;
      } catch (error) {
        console.error('[Investment Router] getLatestAnalysis error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '获取分析报告失败',
        });
      }
    }),

  /**
   * 根据 ID 获取 AI 分析报告
   */
  getAnalysisById: authProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(async ({ input }) => {
      try {
        const analysis = await getAnalysisById(input.id);
        if (!analysis) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '分析报告不存在',
          });
        }
        return analysis;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[Investment Router] getAnalysisById error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '获取分析报告失败',
        });
      }
    }),
});
