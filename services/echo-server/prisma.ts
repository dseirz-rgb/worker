/**
 * Instantiates a single instance PrismaClient and save it on the global object.
 * @see https://www.prisma.io/docs/support/help-articles/nextjs-prisma-client-dev-practices
 */
import { PrismaClient } from '@prisma/client';

const prismaGlobal = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

// 在测试环境下，如果没有 DATABASE_URL，创建一个 mock 客户端
const createPrismaClient = (): PrismaClient => {
  const dbUrl = process.env.DATABASE_URL;
  
  // 测试环境下如果没有真实数据库连接，返回一个空的 mock
  if (process.env.NODE_ENV === 'test' && (!dbUrl || dbUrl === 'postgresql://test:test@localhost:5432/test')) {
    // 返回一个 Proxy 作为 mock，避免初始化错误
    return new Proxy({} as PrismaClient, {
      get: (target, prop) => {
        if (prop === '$connect' || prop === '$disconnect') {
          return async () => {};
        }
        // 返回一个可链式调用的 mock
        return new Proxy(() => Promise.resolve(null), {
          get: () => () => Promise.resolve(null),
        });
      },
    });
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });
};

export const prisma: PrismaClient = prismaGlobal.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  prismaGlobal.prisma = prisma;
}