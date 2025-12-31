/**
 * Research 路由 - AI 服务统一迁移
 * 
 * 提供研究功能的 tRPC 端点
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { ResearchAgent, ResearchError, collectResearchIterations } from '@server/aiServer/researchAgent';
import { prisma } from '../prisma';

export const researchRouter = router({
  /**
   * 开始研究 - 流式返回迭代结果
   */
  startResearch: authProcedure
    .input(z.object({
      query: z.string().min(1, '查询不能为空'),
      config: z.object({
        maxIterations: z.number().min(1).max(10).optional(),
        searchDepth: z.enum(['shallow', 'deep']).optional(),
        tools: z.array(z.enum(['rag', 'web', 'files'])).optional(),
        timeout: z.number().min(10000).max(300000).optional(),
      }).optional(),
    }))
    .mutation(async function* ({ input, ctx }) {
      const accountId = Number(ctx.sub);
      
      try {
        const agent = new ResearchAgent(accountId, input.config);
        
        for await (const iteration of agent.research(input.query)) {
          yield {
            type: 'iteration' as const,
            data: iteration,
          };
        }

        // 获取最终结果
        const session = await prisma.researchSession.findFirst({
          where: {
            accountId,
            query: input.query,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (session) {
          yield {
            type: 'complete' as const,
            data: {
              id: session.id,
              summary: session.summary,
              confidence: session.confidence,
              status: session.status,
            },
          };
        }
      } catch (error) {
        if (error instanceof ResearchError) {
          yield {
            type: 'error' as const,
            data: {
              code: error.code,
              message: error.message,
              partialResult: error.partialResult,
            },
          };
        } else {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Research failed',
          });
        }
      }
    }),

  /**
   * 获取研究会话详情
   */
  getResearchSession: authProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      const session = await prisma.researchSession.findFirst({
        where: {
          id: input.id,
          accountId,
        },
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Research session not found',
        });
      }

      return {
        id: session.id,
        query: session.query,
        summary: session.summary,
        iterations: session.iterations,
        sources: session.sources,
        confidence: session.confidence,
        status: session.status,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
      };
    }),

  /**
   * 列出研究会话
   */
  listResearchSessions: authProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(50).default(20),
      status: z.enum(['completed', 'partial', 'timeout']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);
      const skip = (input.page - 1) * input.pageSize;

      const where: any = { accountId };
      if (input.status) {
        where.status = input.status;
      }

      const [sessions, total] = await Promise.all([
        prisma.researchSession.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: input.pageSize,
          select: {
            id: true,
            query: true,
            summary: true,
            confidence: true,
            status: true,
            createdAt: true,
            completedAt: true,
          },
        }),
        prisma.researchSession.count({ where }),
      ]);

      return {
        sessions,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.ceil(total / input.pageSize),
        },
      };
    }),

  /**
   * 删除研究会话
   */
  deleteResearchSession: authProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      const session = await prisma.researchSession.findFirst({
        where: {
          id: input.id,
          accountId,
        },
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Research session not found',
        });
      }

      await prisma.researchSession.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * 快速研究 - 非流式，直接返回结果
   */
  quickResearch: authProcedure
    .input(z.object({
      query: z.string().min(1),
      maxIterations: z.number().min(1).max(5).default(3),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      try {
        const agent = new ResearchAgent(accountId, {
          maxIterations: input.maxIterations,
          timeout: 60000,
        });

        const result = await collectResearchIterations(agent.research(input.query));

        return {
          summary: result.summary,
          sources: result.sources,
          confidence: result.confidence,
          iterationCount: result.iterations.length,
          totalTime: result.totalTime,
        };
      } catch (error) {
        if (error instanceof ResearchError && error.partialResult) {
          return {
            summary: '研究未完成，以下是部分结果...',
            sources: error.partialResult.sources || [],
            confidence: error.partialResult.confidence || 0,
            iterationCount: error.partialResult.iterations?.length || 0,
            totalTime: error.partialResult.totalTime || 0,
            isPartial: true,
          };
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Research failed',
        });
      }
    }),
});
