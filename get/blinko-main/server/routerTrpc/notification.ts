/**
 * Echo v3.2: 通知系统 tRPC 路由
 * 提供通知列表、已读标记和未读计数功能
 */

import { authProcedure, router } from '@server/middleware';
import { z } from 'zod';
import { prisma } from '../prisma';

/**
 * 创建通知的辅助函数 (供内部服务调用)
 */
export async function CreateNotification(params: {
  type: string;
  title: string;
  content: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  accountId?: number;
  useAdmin?: boolean;
}) {
  const { useAdmin, accountId, metadata, ...rest } = params;
  
  // 如果使用 admin，获取第一个管理员账户
  let targetAccountId = accountId;
  if (useAdmin) {
    const adminAccount = await prisma.accounts.findFirst({
      where: { role: 'superadmin' },
    });
    targetAccountId = adminAccount?.id ?? 1;
  }
  
  if (!targetAccountId) {
    console.warn('[CreateNotification] No accountId provided and no admin found');
    return null;
  }

  const notification = await prisma.notifications.create({
    data: {
      ...rest,
      metadata: metadata as any,
      accountId: targetAccountId,
    },
  });

  return notification;
}

export const notificationRouter = router({
  /**
   * 获取通知列表 (支持两种分页方式)
   */
  list: authProcedure
    .input(
      z.object({
        unreadOnly: z.boolean().optional().default(false),
        type: z.string().optional(), // 按类型筛选
        limit: z.number().min(1).max(100).optional().default(20),
        cursor: z.number().optional(), // 游标分页
        // 兼容旧的 page/size 分页
        page: z.number().min(1).optional(),
        size: z.number().min(1).max(100).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      const { unreadOnly, type, limit, cursor, page, size } = input;

      // 如果使用 page/size 分页方式
      if (page !== undefined && size !== undefined) {
        const skip = (page - 1) * size;
        const notifications = await prisma.notifications.findMany({
          where: {
            accountId,
            ...(unreadOnly && { isRead: false }),
            ...(type && { type }),
          },
          orderBy: { createdAt: 'desc' },
          take: size,
          skip,
        });
        // 返回数组格式以兼容 PromisePageState
        return notifications;
      }

      // 使用游标分页方式
      const notifications = await prisma.notifications.findMany({
        where: {
          accountId,
          ...(unreadOnly && { isRead: false }),
          ...(type && { type }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // 多取一条用于判断是否有下一页
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });

      // 判断是否有下一页
      let nextCursor: number | undefined;
      if (notifications.length > limit) {
        const nextItem = notifications.pop();
        nextCursor = nextItem?.id;
      }

      return {
        notifications,
        nextCursor,
      };
    }),

  /**
   * 标记通知为已读
   */
  markRead: authProcedure
    .input(
      z.object({
        notificationIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);

      const result = await prisma.notifications.updateMany({
        where: {
          id: { in: input.notificationIds },
          accountId, // 确保只能标记自己的通知
        },
        data: { isRead: true },
      });

      return { success: true, count: result.count };
    }),

  /**
   * 标记通知为已读 (别名，兼容旧 API)
   */
  markAsRead: authProcedure
    .input(
      z.object({
        id: z.number().optional(),
        all: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);

      if (input.all) {
        // 标记所有为已读
        await prisma.notifications.updateMany({
          where: {
            accountId,
            isRead: false,
          },
          data: { isRead: true },
        });
      } else if (input.id) {
        // 标记单个为已读
        await prisma.notifications.updateMany({
          where: {
            id: input.id,
            accountId,
          },
          data: { isRead: true },
        });
      }

      return { success: true };
    }),

  /**
   * 标记所有通知为已读
   */
  markAllRead: authProcedure.mutation(async ({ ctx }) => {
    const accountId = Number(ctx.id);

    const result = await prisma.notifications.updateMany({
      where: {
        accountId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { success: true, count: result.count };
  }),

  /**
   * 获取未读通知数量
   */
  getUnreadCount: authProcedure.query(async ({ ctx }) => {
    const accountId = Number(ctx.id);

    const count = await prisma.notifications.count({
      where: {
        accountId,
        isRead: false,
      },
    });

    return { count };
  }),

  /**
   * 获取未读通知数量 (别名，兼容旧 API)
   */
  unreadCount: authProcedure.query(async ({ ctx }) => {
    const accountId = Number(ctx.id);

    const count = await prisma.notifications.count({
      where: {
        accountId,
        isRead: false,
      },
    });

    return count;
  }),

  /**
   * 删除通知
   */
  delete: authProcedure
    .input(
      z.object({
        notificationIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);

      const result = await prisma.notifications.deleteMany({
        where: {
          id: { in: input.notificationIds },
          accountId,
        },
      });

      return { success: true, count: result.count };
    }),

  /**
   * 清空所有已读通知
   */
  clearRead: authProcedure.mutation(async ({ ctx }) => {
    const accountId = Number(ctx.id);

    const result = await prisma.notifications.deleteMany({
      where: {
        accountId,
        isRead: true,
      },
    });

    return { success: true, count: result.count };
  }),

  /**
   * 创建通知 (内部使用)
   */
  create: authProcedure
    .input(
      z.object({
        type: z.string(),
        title: z.string(),
        content: z.string(),
        actionUrl: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      const { metadata, ...rest } = input;

      const notification = await prisma.notifications.create({
        data: {
          ...rest,
          metadata: metadata as any,
          accountId,
        },
      });

      return notification;
    }),
});
