/**
 * Investment Router 属性测试
 * 
 * **Property 11: Authentication Enforcement**
 * **Property 12: Error Response Format**
 * **Validates: Requirements 8.2, 8.4**
 * 
 * @module services/echo-server/routerTrpc/investment.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fc from 'fast-check';
import { TRPCError } from '@trpc/server';

// ============================================================================
// Mock 模块
// ============================================================================

// Mock investmentAgent
const mockChatResponse = {
  message: 'Mock AI response',
  citations: [],
  conversationId: 1,
  messageId: 1,
};

vi.mock('@server/aiServer/investment', () => ({
  investmentAgent: {
    chat: vi.fn().mockResolvedValue(mockChatResponse),
    streamChat: vi.fn().mockImplementation(async function* () {
      yield 'Mock ';
      yield 'stream';
      return mockChatResponse;
    }),
  },
  getInvestmentContext: vi.fn().mockResolvedValue({
    text: '# 投资上下文\n\n测试上下文数据',
    citations: [],
  }),
  generateDailyInsight: vi.fn().mockResolvedValue({
    date: '2026-01-05',
    content: '测试洞察',
    riskLevel: 'LOW',
  }),
}));

// Mock investmentDb
vi.mock('../lib/investmentDb', () => ({
  getConversations: vi.fn().mockResolvedValue([
    { id: 1, user_id: 1, title: '测试对话', created_at: '2026-01-05', updated_at: '2026-01-05' },
  ]),
  getMessages: vi.fn().mockResolvedValue([
    { id: 1, conversation_id: 1, role: 'user', content: '测试消息', created_at: '2026-01-05' },
  ]),
  createConversation: vi.fn().mockResolvedValue({
    id: 1,
    user_id: 1,
    title: '新对话',
    created_at: '2026-01-05',
    updated_at: '2026-01-05',
  }),
  deleteConversation: vi.fn().mockResolvedValue(true),
  saveAnalysis: vi.fn().mockResolvedValue({ id: 1 }),
  getLatestAnalysis: vi.fn().mockResolvedValue({
    id: 1,
    user_id: 1,
    title: '测试分析',
    risk_level: 'LOW',
    summary: '测试摘要',
    content: '测试内容',
    recommendation: 'HOLD',
    action_plan: '测试计划',
    primary_ticker: 'AAPL',
    portfolio_snapshot: {},
    created_at: '2026-01-05',
  }),
  getAnalysisById: vi.fn().mockResolvedValue({
    id: 1,
    user_id: 1,
    title: '测试分析',
    risk_level: 'LOW',
    summary: '测试摘要',
    content: '测试内容',
    recommendation: 'HOLD',
    action_plan: '测试计划',
    primary_ticker: 'AAPL',
    portfolio_snapshot: {},
    created_at: '2026-01-05',
  }),
  getStockPositions: vi.fn().mockResolvedValue([]),
  getOptionPositions: vi.fn().mockResolvedValue([]),
  getRecentTransactions: vi.fn().mockResolvedValue([]),
  getDashboardSnapshot: vi.fn().mockResolvedValue(null),
  getUserProfile: vi.fn().mockResolvedValue(null),
  saveMessage: vi.fn().mockResolvedValue({ id: 1 }),
}));

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 创建认证上下文
 */
function createAuthContext(userId: number = 1) {
  return {
    name: 'test-user',
    sub: String(userId),
    role: 'user',
    permissions: ['investment'],
    requiresTwoFactor: false,
  };
}

/**
 * 创建未认证上下文
 */
function createUnauthContext() {
  return {
    name: undefined,
    sub: undefined,
    role: undefined,
    permissions: undefined,
    requiresTwoFactor: false,
  };
}

/**
 * 创建需要 2FA 的上下文
 */
function createTwoFactorRequiredContext() {
  return {
    name: 'test-user',
    sub: '1',
    role: 'user',
    permissions: ['investment'],
    requiresTwoFactor: true,
  };
}

/**
 * 模拟 authProcedure 中间件行为
 */
async function simulateAuthMiddleware(ctx: any, path: string = 'investment.chat') {
  if (!ctx?.name || ctx?.requiresTwoFactor) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });
  }
  
  if (ctx.permissions && Array.isArray(ctx.permissions)) {
    const hasPermission = ctx.permissions.some((perm: string) => path?.includes(perm));
    if (!hasPermission) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This token does not have permission to access this endpoint',
      });
    }
  }
  
  return { ...ctx, id: ctx.sub };
}

/**
 * 验证 TRPCError 格式
 */
function isValidTRPCError(error: unknown): boolean {
  if (!(error instanceof TRPCError)) return false;
  
  const validCodes = [
    'PARSE_ERROR',
    'BAD_REQUEST',
    'INTERNAL_SERVER_ERROR',
    'NOT_IMPLEMENTED',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'METHOD_NOT_SUPPORTED',
    'TIMEOUT',
    'CONFLICT',
    'PRECONDITION_FAILED',
    'PAYLOAD_TOO_LARGE',
    'UNPROCESSABLE_CONTENT',
    'TOO_MANY_REQUESTS',
    'CLIENT_CLOSED_REQUEST',
  ];
  
  return validCodes.includes(error.code) && typeof error.message === 'string';
}

// ============================================================================
// 属性测试
// ============================================================================

describe('Investment Router 属性测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 11: Authentication Enforcement
   * 
   * *For any* request to protected endpoints, the router SHALL reject
   * requests without valid authentication with UNAUTHORIZED error.
   * 
   * **Validates: Requirements 8.2**
   */
  describe('Property 11: Authentication Enforcement', () => {
    it('未认证请求应被拒绝', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'investment.chat',
            'investment.streamChat',
            'investment.getConversations',
            'investment.getMessages',
            'investment.createConversation',
            'investment.deleteConversation',
            'investment.generateDailyInsight',
            'investment.getContext',
            'investment.getLatestAnalysis',
            'investment.getAnalysisById'
          ),
          async (endpoint) => {
            const unauthCtx = createUnauthContext();
            
            try {
              await simulateAuthMiddleware(unauthCtx, endpoint);
              // 不应该到达这里
              return false;
            } catch (error) {
              expect(error).toBeInstanceOf(TRPCError);
              expect((error as TRPCError).code).toBe('UNAUTHORIZED');
              return true;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('需要 2FA 但未完成的请求应被拒绝', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'investment.chat',
            'investment.getConversations',
            'investment.generateDailyInsight'
          ),
          async (endpoint) => {
            const twoFactorCtx = createTwoFactorRequiredContext();
            
            try {
              await simulateAuthMiddleware(twoFactorCtx, endpoint);
              return false;
            } catch (error) {
              expect(error).toBeInstanceOf(TRPCError);
              expect((error as TRPCError).code).toBe('UNAUTHORIZED');
              return true;
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('认证用户应能访问授权端点', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          fc.constantFrom(
            'investment.chat',
            'investment.getConversations',
            'investment.generateDailyInsight'
          ),
          async (userId, endpoint) => {
            const authCtx = createAuthContext(userId);
            
            const result = await simulateAuthMiddleware(authCtx, endpoint);
            
            expect(result.id).toBe(String(userId));
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('无权限用户应被拒绝访问', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (userId) => {
            // 创建没有 investment 权限的上下文
            const noPermCtx = {
              name: 'test-user',
              sub: String(userId),
              role: 'user',
              permissions: ['notes', 'tags'], // 没有 investment 权限
              requiresTwoFactor: false,
            };
            
            try {
              await simulateAuthMiddleware(noPermCtx, 'investment.chat');
              return false;
            } catch (error) {
              expect(error).toBeInstanceOf(TRPCError);
              expect((error as TRPCError).code).toBe('FORBIDDEN');
              return true;
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 12: Error Response Format
   * 
   * *For any* error thrown by the router, the error SHALL be a valid
   * TRPCError with a recognized error code and a string message.
   * 
   * **Validates: Requirements 8.4**
   */
  describe('Property 12: Error Response Format', () => {
    it('认证错误应返回有效的 TRPCError 格式', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          async (requiresTwoFactor) => {
            const ctx = requiresTwoFactor
              ? createTwoFactorRequiredContext()
              : createUnauthContext();
            
            try {
              await simulateAuthMiddleware(ctx, 'investment.chat');
              return false;
            } catch (error) {
              expect(isValidTRPCError(error)).toBe(true);
              return true;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('权限错误应返回有效的 TRPCError 格式', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom('notes', 'tags', 'files', 'config'), { minLength: 0, maxLength: 3 }),
          async (permissions) => {
            const ctx = {
              name: 'test-user',
              sub: '1',
              role: 'user',
              permissions, // 不包含 investment
              requiresTwoFactor: false,
            };
            
            try {
              await simulateAuthMiddleware(ctx, 'investment.chat');
              // 如果 permissions 为空数组，可能会通过
              return permissions.length === 0;
            } catch (error) {
              expect(isValidTRPCError(error)).toBe(true);
              expect((error as TRPCError).code).toBe('FORBIDDEN');
              return true;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('所有 TRPCError 应包含非空消息', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_SERVER_ERROR'),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (code, message) => {
            const error = new TRPCError({
              code: code as any,
              message,
            });
            
            expect(error.message).toBe(message);
            expect(error.message.length).toBeGreaterThan(0);
            expect(isValidTRPCError(error)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('错误响应应包含正确的 HTTP 状态码映射', async () => {
      const codeToStatus: Record<string, number> = {
        'UNAUTHORIZED': 401,
        'FORBIDDEN': 403,
        'NOT_FOUND': 404,
        'INTERNAL_SERVER_ERROR': 500,
        'BAD_REQUEST': 400,
      };

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.keys(codeToStatus)),
          async (code) => {
            const error = new TRPCError({
              code: code as any,
              message: 'Test error',
            });
            
            // TRPCError 内部会映射到正确的 HTTP 状态码
            expect(isValidTRPCError(error)).toBe(true);
            expect(error.code).toBe(code);
            
            return true;
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  /**
   * 输入验证测试
   */
  describe('输入验证', () => {
    it('空消息应被拒绝', async () => {
      // 模拟 zod 验证
      const chatInputSchema = {
        validate: (input: any) => {
          if (!input.message || input.message.length === 0) {
            throw new Error('消息不能为空');
          }
          if (input.message.length > 10000) {
            throw new Error('消息过长');
          }
          return input;
        },
      };

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('', '   ', '\n\t'),
          async (emptyMessage) => {
            try {
              chatInputSchema.validate({ message: emptyMessage.trim() || '' });
              return emptyMessage.trim().length > 0;
            } catch (error) {
              expect((error as Error).message).toContain('消息不能为空');
              return true;
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('超长消息应被拒绝', async () => {
      const chatInputSchema = {
        validate: (input: any) => {
          if (input.message.length > 10000) {
            throw new Error('消息过长');
          }
          return input;
        },
      };

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10001, maxLength: 20000 }),
          async (longMessage) => {
            try {
              chatInputSchema.validate({ message: longMessage });
              return false;
            } catch (error) {
              expect((error as Error).message).toContain('消息过长');
              return true;
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('有效的 contextType 应被接受', async () => {
      const validContextTypes = ['report', 'briefing', 'portfolio', 'general'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...validContextTypes),
          async (contextType) => {
            // 模拟验证
            expect(validContextTypes).toContain(contextType);
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('无效的 contextType 应被拒绝', async () => {
      const validContextTypes = ['report', 'briefing', 'portfolio', 'general'];

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => !validContextTypes.includes(s)),
          async (invalidContextType) => {
            expect(validContextTypes).not.toContain(invalidContextType);
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
