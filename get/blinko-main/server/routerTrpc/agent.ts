/**
 * Agent 路由 - AI 服务统一迁移
 * 
 * 提供 Agent 管理和对话的 tRPC 端点
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { agentManager } from '@server/aiServer/agentManager';
import { ToolRegistry } from '@server/aiServer/tools/toolRegistry';

export const agentRouter = router({
  /**
   * 创建 Agent
   */
  createAgent: authProcedure
    .input(z.object({
      name: z.string().min(1, '名称不能为空').max(100),
      persona: z.string().max(500).optional(),
      systemPrompt: z.string().min(10, '系统提示至少 10 个字符').max(5000),
      tools: z.array(z.string()).default([]),
      modelId: z.number().optional(),
      privacy: z.enum(['public', 'private']).default('private'),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      try {
        const agent = await agentManager.createAgent({
          ...input,
          accountId,
        });

        return agent;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create agent',
        });
      }
    }),

  /**
   * 获取 Agent 列表
   */
  getAgents: authProcedure
    .query(async ({ ctx }) => {
      const accountId = Number(ctx.sub);
      return agentManager.getAgents(accountId);
    }),

  /**
   * 获取单个 Agent
   */
  getAgent: authProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const agent = await agentManager.getAgent(input.id);
      
      if (!agent) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Agent not found',
        });
      }

      // 检查权限
      const accountId = Number(ctx.sub);
      if (agent.privacy === 'private' && agent.accountId !== accountId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      return agent;
    }),

  /**
   * 更新 Agent
   */
  updateAgent: authProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      persona: z.string().max(500).optional(),
      systemPrompt: z.string().min(10).max(5000).optional(),
      tools: z.array(z.string()).optional(),
      modelId: z.number().nullable().optional(),
      privacy: z.enum(['public', 'private']).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);
      const { id, ...data } = input;

      // 检查权限
      const existing = await agentManager.getAgent(id);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Agent not found',
        });
      }

      if (existing.accountId !== accountId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own agents',
        });
      }

      try {
        return await agentManager.updateAgent(id, data);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update agent',
        });
      }
    }),

  /**
   * 删除 Agent
   */
  deleteAgent: authProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      // 检查权限
      const existing = await agentManager.getAgent(input.id);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Agent not found',
        });
      }

      if (existing.accountId !== accountId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own agents',
        });
      }

      try {
        await agentManager.deleteAgent(input.id);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete agent',
        });
      }
    }),

  /**
   * 与 Agent 对话
   */
  chatWithAgent: authProcedure
    .input(z.object({
      agentId: z.number(),
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      try {
        const response = await agentManager.chat(
          input.agentId,
          input.messages,
          { accountId }
        );

        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Chat failed',
        });
      }
    }),

  /**
   * 与 Agent 流式对话
   */
  streamChatWithAgent: authProcedure
    .input(z.object({
      agentId: z.number(),
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      })),
    }))
    .mutation(async function* ({ input, ctx }) {
      const accountId = Number(ctx.sub);

      try {
        for await (const chunk of agentManager.streamChat(
          input.agentId,
          input.messages,
          { accountId }
        )) {
          yield { chunk };
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Stream chat failed',
        });
      }
    }),

  /**
   * 获取默认 Agent 列表
   */
  getDefaultAgents: authProcedure
    .query(async () => {
      return agentManager.getDefaultAgents();
    }),

  /**
   * 初始化默认 Agent
   */
  initializeDefaultAgents: authProcedure
    .mutation(async ({ ctx }) => {
      const accountId = Number(ctx.sub);
      await agentManager.initializeDefaultAgents(accountId);
      return { success: true };
    }),

  /**
   * 获取可用工具列表
   */
  getAvailableTools: authProcedure
    .query(async () => {
      const tools = ToolRegistry.getTools();
      return tools.map(t => ({
        name: t.name,
        description: t.description,
        category: t.category,
        permissions: t.permissions,
      }));
    }),
});
