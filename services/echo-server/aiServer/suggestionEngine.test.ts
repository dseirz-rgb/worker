/**
 * Echo v3.2: 建议系统属性测试
 * 使用 fast-check 进行属性测试，验证建议状态转换的正确性
 * 
 * **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  SuggestionEngine,
  SuggestionStatus,
  SuggestionAction,
  SuggestionType,
  SuggestionPriority,
} from './suggestionEngine';

// Mock prisma
vi.mock('../prisma', () => ({
  prisma: {
    suggestion: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    notes: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    activityRecord: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../prisma';

describe('SuggestionEngine 属性测试', () => {
  const mockAccountId = 1;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 1: 建议状态转换正确性
   * 建议状态只能按规定路径转换: pending -> accepted/postponed/rejected
   * **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
   */
  describe('Property 1: 状态转换正确性', () => {
    // 生成有效的建议操作
    const actionArb = fc.constantFrom<SuggestionAction>('accept', 'postpone', 'reject');

    it('pending 状态的建议应能正确转换到目标状态', async () => {
      await fc.assert(
        fc.asyncProperty(
          actionArb,
          fc.integer({ min: 1, max: 1000 }),
          async (action, suggestionId) => {
            // 创建 pending 状态的建议
            const pendingSuggestion = {
              id: suggestionId,
              type: 'task' as SuggestionType,
              content: '测试建议',
              source: '测试来源',
              priority: 'medium' as SuggestionPriority,
              status: 'pending' as SuggestionStatus,
              postponedUntil: null,
              rejectReason: null,
              createdAt: new Date(),
              respondedAt: null,
              accountId: mockAccountId,
            };

            (prisma.suggestion.findFirst as any).mockResolvedValue(pendingSuggestion);
            (prisma.suggestion.update as any).mockImplementation(({ data }) => 
              Promise.resolve({ ...pendingSuggestion, ...data })
            );
            (prisma.notes.create as any).mockResolvedValue({ id: 1 });

            const engine = new SuggestionEngine(mockAccountId);
            const result = await engine.respondToSuggestion({
              suggestionId,
              action,
              reason: action === 'reject' ? '测试拒绝原因' : undefined,
              postponeDuration: action === 'postpone' ? 60 : undefined,
            });

            // 验证状态转换正确
            const expectedStatus: Record<SuggestionAction, SuggestionStatus> = {
              accept: 'accepted',
              postpone: 'postponed',
              reject: 'rejected',
            };
            expect(result.status).toBe(expectedStatus[action]);

            // 验证 respondedAt 已设置
            expect(result.respondedAt).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('非 pending 状态的建议不应被再次处理', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<SuggestionStatus>('accepted', 'postponed', 'rejected'),
          actionArb,
          async (currentStatus, action) => {
            const processedSuggestion = {
              id: 1,
              type: 'task' as SuggestionType,
              content: '已处理的建议',
              source: '测试',
              priority: 'medium' as SuggestionPriority,
              status: currentStatus,
              postponedUntil: null,
              rejectReason: null,
              createdAt: new Date(),
              respondedAt: new Date(),
              accountId: mockAccountId,
            };

            (prisma.suggestion.findFirst as any).mockResolvedValue(processedSuggestion);

            const engine = new SuggestionEngine(mockAccountId);
            
            // 应该抛出错误
            await expect(
              engine.respondToSuggestion({ suggestionId: 1, action })
            ).rejects.toThrow('建议已被处理');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 2: 推迟时间计算正确性
   * 推迟操作应正确设置 postponedUntil 时间
   * **Validates: Requirements 2.4**
   */
  describe('Property 2: 推迟时间正确性', () => {
    it('推迟时间应在当前时间之后', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10080 }), // 1 分钟到 7 天
          async (postponeDuration) => {
            const pendingSuggestion = {
              id: 1,
              type: 'task' as SuggestionType,
              content: '测试建议',
              source: '测试',
              priority: 'medium' as SuggestionPriority,
              status: 'pending' as SuggestionStatus,
              postponedUntil: null,
              rejectReason: null,
              createdAt: new Date(),
              respondedAt: null,
              accountId: mockAccountId,
            };

            let capturedPostponedUntil: Date | null = null;
            
            (prisma.suggestion.findFirst as any).mockResolvedValue(pendingSuggestion);
            (prisma.suggestion.update as any).mockImplementation(({ data }) => {
              capturedPostponedUntil = data.postponedUntil;
              return Promise.resolve({ ...pendingSuggestion, ...data });
            });

            const beforeTime = new Date();
            const engine = new SuggestionEngine(mockAccountId);
            await engine.respondToSuggestion({
              suggestionId: 1,
              action: 'postpone',
              postponeDuration,
            });
            const afterTime = new Date();

            // 验证 postponedUntil 在合理范围内
            expect(capturedPostponedUntil).toBeTruthy();
            const postponedTime = new Date(capturedPostponedUntil!);
            
            // postponedUntil 应该在 beforeTime + duration 和 afterTime + duration 之间
            const minExpected = new Date(beforeTime.getTime() + postponeDuration * 60 * 1000);
            const maxExpected = new Date(afterTime.getTime() + postponeDuration * 60 * 1000 + 1000);
            
            expect(postponedTime.getTime()).toBeGreaterThanOrEqual(minExpected.getTime() - 1000);
            expect(postponedTime.getTime()).toBeLessThanOrEqual(maxExpected.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: 接受建议创建任务
   * 接受 task 类型建议时应创建待办事项
   * **Validates: Requirements 2.3**
   */
  describe('Property 3: 接受建议创建任务', () => {
    it('接受 task 类型建议应创建待办', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }),
          async (content) => {
            const taskSuggestion = {
              id: 1,
              type: 'task' as SuggestionType,
              content,
              source: '测试',
              priority: 'medium' as SuggestionPriority,
              status: 'pending' as SuggestionStatus,
              postponedUntil: null,
              rejectReason: null,
              createdAt: new Date(),
              respondedAt: null,
              accountId: mockAccountId,
            };

            let taskCreated = false;
            let createdTaskContent = '';

            (prisma.suggestion.findFirst as any).mockResolvedValue(taskSuggestion);
            (prisma.suggestion.update as any).mockImplementation(({ data }) =>
              Promise.resolve({ ...taskSuggestion, ...data })
            );
            (prisma.notes.create as any).mockImplementation(({ data }) => {
              taskCreated = true;
              createdTaskContent = data.content;
              return Promise.resolve({ id: 1, ...data });
            });

            const engine = new SuggestionEngine(mockAccountId);
            await engine.respondToSuggestion({
              suggestionId: 1,
              action: 'accept',
            });

            // 验证任务已创建
            expect(taskCreated).toBe(true);
            expect(createdTaskContent).toContain(content);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 4: 拒绝原因记录
   * 拒绝建议时应正确记录原因
   * **Validates: Requirements 2.5**
   */
  describe('Property 4: 拒绝原因记录', () => {
    it('拒绝时应记录原因', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 500 }),
          async (reason) => {
            const pendingSuggestion = {
              id: 1,
              type: 'insight' as SuggestionType,
              content: '测试建议',
              source: '测试',
              priority: 'low' as SuggestionPriority,
              status: 'pending' as SuggestionStatus,
              postponedUntil: null,
              rejectReason: null,
              createdAt: new Date(),
              respondedAt: null,
              accountId: mockAccountId,
            };

            let capturedReason: string | null = null;

            (prisma.suggestion.findFirst as any).mockResolvedValue(pendingSuggestion);
            (prisma.suggestion.update as any).mockImplementation(({ data }) => {
              capturedReason = data.rejectReason;
              return Promise.resolve({ ...pendingSuggestion, ...data });
            });

            const engine = new SuggestionEngine(mockAccountId);
            await engine.respondToSuggestion({
              suggestionId: 1,
              action: 'reject',
              reason: reason || undefined,
            });

            // 验证原因记录
            if (reason) {
              expect(capturedReason).toBe(reason);
            } else {
              expect(capturedReason).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: 统计计算正确性
   * 统计数据应正确反映建议状态分布
   * **Validates: Requirements 2.7**
   */
  describe('Property 5: 统计计算正确性', () => {
    it('接受率计算应正确', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          async (accepted, rejected, postponed, pending) => {
            const total = accepted + rejected + postponed + pending;

            (prisma.suggestion.count as any)
              .mockResolvedValueOnce(total)
              .mockResolvedValueOnce(accepted)
              .mockResolvedValueOnce(rejected)
              .mockResolvedValueOnce(postponed)
              .mockResolvedValueOnce(pending);

            const engine = new SuggestionEngine(mockAccountId);
            const stats = await engine.getStats();

            // 验证总数
            expect(stats.total).toBe(total);
            expect(stats.accepted).toBe(accepted);
            expect(stats.rejected).toBe(rejected);
            expect(stats.postponed).toBe(postponed);
            expect(stats.pending).toBe(pending);

            // 验证接受率计算
            const responded = accepted + rejected;
            if (responded > 0) {
              const expectedAcceptRate = Math.round((accepted / responded) * 100) / 100;
              expect(stats.acceptRate).toBe(expectedAcceptRate);
            } else {
              expect(stats.acceptRate).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: 建议不存在时的错误处理
   * 操作不存在的建议应抛出错误
   * **Validates: Requirements 2.2**
   */
  describe('Property 6: 错误处理', () => {
    it('操作不存在的建议应抛出错误', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          fc.constantFrom<SuggestionAction>('accept', 'postpone', 'reject'),
          async (suggestionId, action) => {
            (prisma.suggestion.findFirst as any).mockResolvedValue(null);

            const engine = new SuggestionEngine(mockAccountId);
            
            await expect(
              engine.respondToSuggestion({ suggestionId, action })
            ).rejects.toThrow('建议不存在');
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
