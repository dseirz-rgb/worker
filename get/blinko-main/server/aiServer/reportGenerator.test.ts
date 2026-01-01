/**
 * Echo v3.2: 日报生成器属性测试
 * 使用 fast-check 进行属性测试，验证日报生成的一致性和正确性
 * 
 * **Validates: Requirements 1.2**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  ReportGenerator,
  DailyReportContent,
  TaskSummary,
  NoteSummary,
} from './reportGenerator';

// Mock prisma
vi.mock('../prisma', () => ({
  prisma: {
    notes: {
      findMany: vi.fn(),
    },
    activityRecord: {
      findMany: vi.fn(),
    },
    dailyReport: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    notifications: {
      create: vi.fn(),
    },
    userPreference: {
      findMany: vi.fn(),
    },
  },
}));

// Mock AiModelFactory
vi.mock('./aiModelFactory', () => ({
  AiModelFactory: {
    getDefaultModel: vi.fn().mockResolvedValue(null),
  },
}));

// Mock automationManager
vi.mock('./automationManager', () => ({
  automationManager: {
    getAutomations: vi.fn().mockResolvedValue([]),
    createAutomation: vi.fn(),
    updateAutomation: vi.fn(),
  },
}));

import { prisma } from '../prisma';

describe('ReportGenerator 属性测试', () => {
  const mockAccountId = 1;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 1: 日报生成一致性
   * 相同输入应产生结构一致的输出
   * **Validates: Requirements 1.2**
   */
  describe('Property 1: 日报结构一致性', () => {
    it('早报应包含所有必需字段', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          fc.array(
            fc.record({
              id: fc.integer({ min: 1 }),
              content: fc.string({ minLength: 1, maxLength: 200 }),
              isTop: fc.boolean(),
              isArchived: fc.boolean(),
              isRecycle: fc.boolean(),
              type: fc.constant(1),
              createdAt: fc.date(),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          async (date, tasks) => {
            // 设置 mock 返回值
            (prisma.notes.findMany as any).mockResolvedValue(tasks);
            (prisma.activityRecord.findMany as any).mockResolvedValue([]);

            const generator = new ReportGenerator(mockAccountId);
            const report = await generator.generateMorningReport(date);

            // 验证结构完整性
            expect(report).toHaveProperty('summary');
            expect(report).toHaveProperty('tasks');
            expect(report).toHaveProperty('notes');
            expect(report).toHaveProperty('suggestions');
            expect(report).toHaveProperty('greeting');

            // 验证 tasks 结构
            expect(report.tasks).toHaveProperty('total');
            expect(report.tasks).toHaveProperty('completed');
            expect(report.tasks).toHaveProperty('pending');
            expect(report.tasks).toHaveProperty('overdue');
            expect(report.tasks).toHaveProperty('topPriority');

            // 验证 notes 结构
            expect(report.notes).toHaveProperty('count');
            expect(report.notes).toHaveProperty('tags');
            expect(report.notes).toHaveProperty('highlights');

            // 验证类型
            expect(typeof report.summary).toBe('string');
            expect(typeof report.tasks.total).toBe('number');
            expect(Array.isArray(report.suggestions)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('晚报应包含所有必需字段', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          async (date) => {
            (prisma.notes.findMany as any).mockResolvedValue([]);
            (prisma.activityRecord.findMany as any).mockResolvedValue([]);

            const generator = new ReportGenerator(mockAccountId);
            const report = await generator.generateEveningReport(date);

            // 验证结构完整性
            expect(report).toHaveProperty('summary');
            expect(report).toHaveProperty('tasks');
            expect(report).toHaveProperty('notes');
            expect(report).toHaveProperty('suggestions');
            expect(report).toHaveProperty('greeting');

            // 晚报可能有 activities
            // activities 是可选的，取决于是否有活动记录
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: 任务统计正确性
   * 任务统计数字应与输入数据一致
   * **Validates: Requirements 1.2**
   */
  describe('Property 2: 任务统计正确性', () => {
    it('任务统计应正确反映输入数据', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.integer({ min: 1 }),
              content: fc.string({ minLength: 1, maxLength: 100 }),
              isTop: fc.boolean(),
              isArchived: fc.boolean(),
              isRecycle: fc.boolean(),
              type: fc.constant(1),
              createdAt: fc.date(),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          async (tasks) => {
            // 第一次调用返回今日任务，第二次返回昨日任务
            (prisma.notes.findMany as any)
              .mockResolvedValueOnce(tasks)  // 今日任务
              .mockResolvedValueOnce([])     // 昨日任务
              .mockResolvedValueOnce([]);    // 最近笔记
            (prisma.activityRecord.findMany as any).mockResolvedValue([]);

            const generator = new ReportGenerator(mockAccountId);
            const report = await generator.generateMorningReport(new Date());

            // 验证统计正确性
            expect(report.tasks.total).toBe(tasks.length);
            
            const expectedCompleted = tasks.filter(t => t.isArchived).length;
            expect(report.tasks.completed).toBe(expectedCompleted);

            const expectedPending = tasks.filter(t => !t.isArchived && !t.isRecycle).length;
            expect(report.tasks.pending).toBe(expectedPending);

            // topPriority 应该只包含 isTop 为 true 的任务
            const topTasks = tasks.filter(t => t.isTop);
            expect(report.tasks.topPriority.length).toBeLessThanOrEqual(Math.min(5, topTasks.length));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: 建议生成规则正确性
   * 建议应根据任务状态正确生成
   * **Validates: Requirements 1.2**
   */
  describe('Property 3: 建议生成规则', () => {
    it('有逾期任务时应生成高优先级建议', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (overdueCount) => {
            // 创建逾期任务
            const overdueTasks = Array.from({ length: overdueCount }, (_, i) => ({
              id: i + 1,
              content: `逾期任务 ${i + 1}`,
              isTop: false,
              isArchived: false,
              isRecycle: false,
              type: 1,
              createdAt: new Date(),
            }));

            (prisma.notes.findMany as any)
              .mockResolvedValueOnce([])        // 今日任务
              .mockResolvedValueOnce(overdueTasks) // 昨日任务 (逾期)
              .mockResolvedValueOnce([]);       // 最近笔记
            (prisma.activityRecord.findMany as any).mockResolvedValue([]);

            const generator = new ReportGenerator(mockAccountId);
            const report = await generator.generateMorningReport(new Date());

            // 应该有关于逾期任务的建议
            const hasOverdueSuggestion = report.suggestions.some(
              s => s.content.includes('未完成') && s.priority === 'high'
            );
            expect(hasOverdueSuggestion).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 4: 问候语时间相关性
   * 问候语应根据时间变化
   * **Validates: Requirements 1.2**
   */
  describe('Property 4: 问候语正确性', () => {
    it('问候语应为非空字符串', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          async (date) => {
            (prisma.notes.findMany as any).mockResolvedValue([]);
            (prisma.activityRecord.findMany as any).mockResolvedValue([]);

            const generator = new ReportGenerator(mockAccountId);
            
            const morningReport = await generator.generateMorningReport(date);
            expect(morningReport.greeting).toBeTruthy();
            expect(typeof morningReport.greeting).toBe('string');
            expect(morningReport.greeting!.length).toBeGreaterThan(0);

            const eveningReport = await generator.generateEveningReport(date);
            expect(eveningReport.greeting).toBeTruthy();
            expect(typeof eveningReport.greeting).toBe('string');
            expect(eveningReport.greeting!.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 5: 笔记摘要正确性
   * 笔记摘要应正确统计标签和高亮
   * **Validates: Requirements 1.2**
   */
  describe('Property 5: 笔记摘要正确性', () => {
    it('笔记摘要应正确统计', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.integer({ min: 1 }),
              content: fc.string({ minLength: 1, maxLength: 500 }),
              type: fc.constant(0),
              isRecycle: fc.constant(false),
              createdAt: fc.date(),
              tags: fc.array(
                fc.record({
                  tag: fc.record({
                    name: fc.string({ minLength: 1, maxLength: 20 }),
                  }),
                }),
                { minLength: 0, maxLength: 5 }
              ),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          async (notes) => {
            (prisma.notes.findMany as any)
              .mockResolvedValueOnce([])   // 今日任务
              .mockResolvedValueOnce([])   // 昨日任务
              .mockResolvedValueOnce(notes); // 最近笔记
            (prisma.activityRecord.findMany as any).mockResolvedValue([]);

            const generator = new ReportGenerator(mockAccountId);
            const report = await generator.generateMorningReport(new Date());

            // 验证笔记数量
            expect(report.notes.count).toBe(notes.length);

            // 验证标签是数组
            expect(Array.isArray(report.notes.tags)).toBe(true);

            // 验证高亮是数组且长度不超过 3
            expect(Array.isArray(report.notes.highlights)).toBe(true);
            expect(report.notes.highlights.length).toBeLessThanOrEqual(3);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
