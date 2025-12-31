/**
 * Khoj AI 服务 tRPC Router
 * 
 * 提供 Khoj 服务的完整 API 代理：
 * - 健康检查和状态查询
 * - 聊天对话管理
 * - 语义搜索
 * - Agent 管理
 * - 自动化任务
 * - 文档索引
 */

import { router, publicProcedure } from '../middleware';
import { z } from 'zod';
import { getKhojClient, KhojClientError } from '../lib/khojClient';
import { serviceRegistry } from '../lib/serviceRegistry';
import { TRPCError } from '@trpc/server';

// ============ 辅助函数 ============

/**
 * 统一错误处理
 * 将 KhojClientError 转换为 TRPCError
 */
function handleKhojError(error: unknown): never {
  if (error instanceof KhojClientError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message,
      cause: error,
    });
  }
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

/**
 * 检查服务可用性
 * 服务不可用时抛出 SERVICE_UNAVAILABLE 错误
 */
function ensureServiceAvailable(): void {
  if (!serviceRegistry.isAvailable('khoj')) {
    throw new TRPCError({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Khoj 服务当前不可用',
    });
  }
}

// ============ Router 定义 ============

export const khojRouter = router({
  // ============ 健康检查 ============
  
  /**
   * 测试 Khoj 连接
   */
  testConnection: publicProcedure
    .input(z.object({ baseUrl: z.string().optional() }))
    .mutation(async () => {
      const client = getKhojClient();
      return await client.healthCheck();
    }),

  /**
   * 获取 Khoj 服务状态
   */
  getStatus: publicProcedure.query(async () => {
    const status = serviceRegistry.getStatus('khoj');
    return {
      success: status?.status === 'healthy',
      message: status?.error || 'Khoj 服务正常',
      url: serviceRegistry.getConfig('khoj')?.baseUrl,
      latency: status?.latency,
      lastCheck: status?.lastCheck,
    };
  }),

  // ============ 聊天 API ============

  /**
   * 发送聊天消息
   */
  chat: publicProcedure
    .input(z.object({
      message: z.string().min(1),
      conversationId: z.string().optional(),
      agent: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        const response = await client.chat(input.message, {
          conversationId: input.conversationId,
          agent: input.agent,
          stream: false,
        });
        return response;
      } catch (error) {
        handleKhojError(error);
      }
    }),

  /**
   * 获取对话列表
   */
  getConversations: publicProcedure.query(async () => {
    ensureServiceAvailable();
    try {
      const client = getKhojClient();
      return await client.getConversations();
    } catch (error) {
      handleKhojError(error);
    }
  }),

  /**
   * 获取单个对话详情
   */
  getConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        return await client.getConversation(input.id);
      } catch (error) {
        handleKhojError(error);
      }
    }),

  /**
   * 删除对话
   */
  deleteConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        await client.deleteConversation(input.id);
        return { success: true };
      } catch (error) {
        handleKhojError(error);
      }
    }),

  // ============ 搜索 API ============

  /**
   * 语义搜索
   */
  search: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      type: z.enum(['all', 'org', 'markdown', 'pdf']).optional(),
      limit: z.number().min(1).max(100).optional(),
      rerank: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        return await client.search(input.query, {
          type: input.type,
          limit: input.limit,
          rerank: input.rerank,
        });
      } catch (error) {
        handleKhojError(error);
      }
    }),

  // ============ Agent API ============

  /**
   * 获取 Agent 列表
   */
  getAgents: publicProcedure.query(async () => {
    ensureServiceAvailable();
    try {
      const client = getKhojClient();
      return await client.getAgents();
    } catch (error) {
      handleKhojError(error);
    }
  }),

  /**
   * 获取单个 Agent
   */
  getAgent: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        return await client.getAgent(input.slug);
      } catch (error) {
        handleKhojError(error);
      }
    }),

  /**
   * 创建 Agent
   */
  createAgent: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      personality: z.string(),
      tools: z.array(z.string()).optional(),
      public: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        return await client.createAgent(input);
      } catch (error) {
        handleKhojError(error);
      }
    }),

  /**
   * 更新 Agent
   */
  updateAgent: publicProcedure
    .input(z.object({
      slug: z.string(),
      name: z.string().optional(),
      personality: z.string().optional(),
      tools: z.array(z.string()).optional(),
      public: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        const { slug, ...data } = input;
        return await client.updateAgent(slug, data);
      } catch (error) {
        handleKhojError(error);
      }
    }),

  /**
   * 删除 Agent
   */
  deleteAgent: publicProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        await client.deleteAgent(input.slug);
        return { success: true };
      } catch (error) {
        handleKhojError(error);
      }
    }),

  // ============ 自动化 API ============

  /**
   * 获取自动化任务列表
   */
  getAutomations: publicProcedure.query(async () => {
    ensureServiceAvailable();
    try {
      const client = getKhojClient();
      return await client.getAutomations();
    } catch (error) {
      handleKhojError(error);
    }
  }),

  /**
   * 创建自动化任务
   */
  createAutomation: publicProcedure
    .input(z.object({
      subject: z.string(),
      query_to_run: z.string(),
      scheduling_request: z.string(),
    }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        return await client.createAutomation(input);
      } catch (error) {
        handleKhojError(error);
      }
    }),

  /**
   * 删除自动化任务
   */
  deleteAutomation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        await client.deleteAutomation(input.id);
        return { success: true };
      } catch (error) {
        handleKhojError(error);
      }
    }),

  // ============ 索引 API ============

  /**
   * 索引文档
   */
  indexDocument: publicProcedure
    .input(z.object({
      content: z.string(),
      filename: z.string(),
    }))
    .mutation(async ({ input }) => {
      ensureServiceAvailable();
      try {
        const client = getKhojClient();
        return await client.indexDocument(input.content, input.filename);
      } catch (error) {
        handleKhojError(error);
      }
    }),

  /**
   * 获取索引状态
   */
  getIndexStatus: publicProcedure.query(async () => {
    ensureServiceAvailable();
    try {
      const client = getKhojClient();
      return await client.getIndexStatus();
    } catch (error) {
      handleKhojError(error);
    }
  }),
});
