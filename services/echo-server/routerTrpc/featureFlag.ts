/**
 * Feature Flag 路由 - AI 服务统一迁移
 * 
 * 提供功能开关管理的 tRPC 端点
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '../prisma';

// 预定义的功能开关
const PREDEFINED_FLAGS = [
  {
    key: 'use_mastra_research',
    description: '使用 Mastra Research Agent 替代 Khoj Research',
    defaultValue: false,
  },
  {
    key: 'use_mastra_agents',
    description: '使用 Mastra Agent 系统',
    defaultValue: true,
  },
  {
    key: 'use_mastra_automation',
    description: '使用 Mastra 自动化系统',
    defaultValue: true,
  },
  {
    key: 'khoj_fallback_enabled',
    description: '启用 Khoj 降级回退',
    defaultValue: true,
  },
  {
    key: 'hybrid_mode',
    description: '混合模式：同时支持 Mastra 和 Khoj',
    defaultValue: true,
  },
  {
    key: 'use_native_documents',
    description: '使用原生文档管理系统替代 Paperless-ngx',
    defaultValue: false,
  },
];

export const featureFlagRouter = router({
  /**
   * 获取所有功能开关
   */
  getFlags: authProcedure
    .query(async ({ ctx }) => {
      const accountId = Number(ctx.sub);

      // 获取全局开关
      const globalFlags = await prisma.featureFlag.findMany({
        where: { accountId: null },
      });

      // 获取用户开关
      const userFlags = await prisma.featureFlag.findMany({
        where: { accountId },
      });

      // 合并开关，用户设置优先
      const flagMap = new Map<string, any>();

      // 先添加预定义开关的默认值
      for (const flag of PREDEFINED_FLAGS) {
        flagMap.set(flag.key, {
          key: flag.key,
          value: flag.defaultValue,
          description: flag.description,
          source: 'default',
        });
      }

      // 添加全局开关
      for (const flag of globalFlags) {
        flagMap.set(flag.key, {
          key: flag.key,
          value: flag.value,
          metadata: flag.metadata,
          source: 'global',
        });
      }

      // 添加用户开关（覆盖全局）
      for (const flag of userFlags) {
        flagMap.set(flag.key, {
          key: flag.key,
          value: flag.value,
          metadata: flag.metadata,
          source: 'user',
        });
      }

      return Array.from(flagMap.values());
    }),

  /**
   * 获取单个功能开关
   */
  getFlag: authProcedure
    .input(z.object({
      key: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      // 先查用户设置
      const userFlag = await prisma.featureFlag.findFirst({
        where: {
          key: input.key,
          accountId,
        },
      });

      if (userFlag) {
        return {
          key: userFlag.key,
          value: userFlag.value,
          metadata: userFlag.metadata,
          source: 'user',
        };
      }

      // 再查全局设置
      const globalFlag = await prisma.featureFlag.findFirst({
        where: {
          key: input.key,
          accountId: null,
        },
      });

      if (globalFlag) {
        return {
          key: globalFlag.key,
          value: globalFlag.value,
          metadata: globalFlag.metadata,
          source: 'global',
        };
      }

      // 返回预定义默认值
      const predefined = PREDEFINED_FLAGS.find(f => f.key === input.key);
      if (predefined) {
        return {
          key: predefined.key,
          value: predefined.defaultValue,
          description: predefined.description,
          source: 'default',
        };
      }

      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Feature flag "${input.key}" not found`,
      });
    }),

  /**
   * 设置功能开关
   */
  setFlag: authProcedure
    .input(z.object({
      key: z.string(),
      value: z.boolean(),
      global: z.boolean().default(false),
      metadata: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      // 检查是否是管理员（只有管理员可以设置全局开关）
      if (input.global && ctx.role !== 'superadmin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can set global feature flags',
        });
      }

      const targetAccountId = input.global ? null : accountId;

      // 使用 upsert
      const flag = await prisma.featureFlag.upsert({
        where: {
          key_accountId: {
            key: input.key,
            accountId: targetAccountId,
          },
        },
        update: {
          value: input.value,
          metadata: input.metadata,
        },
        create: {
          key: input.key,
          value: input.value,
          accountId: targetAccountId,
          metadata: input.metadata,
        },
      });

      return {
        key: flag.key,
        value: flag.value,
        metadata: flag.metadata,
        source: input.global ? 'global' : 'user',
      };
    }),

  /**
   * 删除用户功能开关（恢复默认）
   */
  resetFlag: authProcedure
    .input(z.object({
      key: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      await prisma.featureFlag.deleteMany({
        where: {
          key: input.key,
          accountId,
        },
      });

      return { success: true };
    }),

  /**
   * 获取用户的所有功能开关
   */
  getUserFlags: authProcedure
    .query(async ({ ctx }) => {
      const accountId = Number(ctx.sub);

      const flags = await prisma.featureFlag.findMany({
        where: { accountId },
      });

      return flags.map(f => ({
        key: f.key,
        value: f.value,
        metadata: f.metadata,
      }));
    }),

  /**
   * 批量设置功能开关
   */
  setFlags: authProcedure
    .input(z.object({
      flags: z.array(z.object({
        key: z.string(),
        value: z.boolean(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      const results = [];
      for (const flag of input.flags) {
        const result = await prisma.featureFlag.upsert({
          where: {
            key_accountId: {
              key: flag.key,
              accountId,
            },
          },
          update: {
            value: flag.value,
          },
          create: {
            key: flag.key,
            value: flag.value,
            accountId,
          },
        });
        results.push({
          key: result.key,
          value: result.value,
        });
      }

      return results;
    }),

  /**
   * 获取预定义功能开关列表
   */
  getPredefinedFlags: authProcedure
    .query(async () => {
      return PREDEFINED_FLAGS;
    }),

  /**
   * 检查功能是否启用
   */
  isEnabled: authProcedure
    .input(z.object({
      key: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const accountId = Number(ctx.sub);

      // 先查用户设置
      const userFlag = await prisma.featureFlag.findFirst({
        where: {
          key: input.key,
          accountId,
        },
      });

      if (userFlag) {
        return userFlag.value;
      }

      // 再查全局设置
      const globalFlag = await prisma.featureFlag.findFirst({
        where: {
          key: input.key,
          accountId: null,
        },
      });

      if (globalFlag) {
        return globalFlag.value;
      }

      // 返回预定义默认值
      const predefined = PREDEFINED_FLAGS.find(f => f.key === input.key);
      return predefined?.defaultValue ?? false;
    }),
});
