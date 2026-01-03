/**
 * AI 服务路由器属性测试
 * 
 * **Validates: Requirements 7.2, 7.4**
 * Property 6: 功能开关路由正确性
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock prisma
const mockFlags = new Map<string, any>();

vi.mock('@server/prisma', () => ({
  prisma: {
    featureFlag: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const key = where.key;
        const accountId = where.accountId;
        
        // 先查用户设置
        const userKey = `${key}_${accountId}`;
        if (mockFlags.has(userKey)) {
          return Promise.resolve(mockFlags.get(userKey));
        }
        
        // 再查全局设置
        const globalKey = `${key}_null`;
        if (mockFlags.has(globalKey)) {
          return Promise.resolve(mockFlags.get(globalKey));
        }
        
        return Promise.resolve(null);
      }),
    },
  },
}));

// Mock ResearchAgent
vi.mock('./researchAgent', () => ({
  ResearchAgent: vi.fn().mockImplementation(() => ({
    research: vi.fn().mockImplementation(async function* () {
      yield { iteration: 1, findings: 'test', sources: [] };
    }),
  })),
}));

// Mock agentManager
vi.mock('./agentManager', () => ({
  agentManager: {
    chat: vi.fn().mockResolvedValue({ text: 'Mastra response' }),
  },
}));

import { AIServiceRouter } from './serviceRouter';

describe('AIServiceRouter 属性测试', () => {
  let router: AIServiceRouter;

  beforeEach(() => {
    mockFlags.clear();
    router = new AIServiceRouter();
    router.resetMetrics();
    vi.clearAllMocks();
  });

  /**
   * Property 6: 功能开关路由正确性
   * 
   * *For any* feature flag configuration, requests SHALL be routed correctly
   * based on the flag value.
   */
  describe('Property 6: 功能开关路由正确性', () => {
    it('当 flag 为 true 时功能应启用', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('research', 'agent', 'automation', 'chat') as fc.Arbitrary<'research' | 'agent' | 'automation' | 'chat'>,
          fc.integer({ min: 1, max: 1000 }),
          async (feature, accountId) => {
            const flagKey = {
              research: 'use_mastra_research',
              agent: 'use_mastra_agents',
              automation: 'use_mastra_automation',
              chat: 'use_mastra_agents',
            }[feature];

            mockFlags.set(`${flagKey}_${accountId}`, { key: flagKey, value: true, accountId });

            const isEnabled = await router.isFeatureEnabled(feature, accountId);
            expect(isEnabled).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('当 flag 为 false 时功能应禁用', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('research', 'agent', 'automation', 'chat') as fc.Arbitrary<'research' | 'agent' | 'automation' | 'chat'>,
          fc.integer({ min: 1, max: 1000 }),
          async (feature, accountId) => {
            const flagKey = {
              research: 'use_mastra_research',
              agent: 'use_mastra_agents',
              automation: 'use_mastra_automation',
              chat: 'use_mastra_agents',
            }[feature];

            mockFlags.set(`${flagKey}_${accountId}`, { key: flagKey, value: false, accountId });

            const isEnabled = await router.isFeatureEnabled(feature, accountId);
            expect(isEnabled).toBe(false);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('用户设置应覆盖全局设置', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('research', 'agent') as fc.Arbitrary<'research' | 'agent'>,
          fc.integer({ min: 1, max: 1000 }),
          fc.boolean(),
          fc.boolean(),
          async (feature, accountId, globalValue, userValue) => {
            const flagKey = {
              research: 'use_mastra_research',
              agent: 'use_mastra_agents',
            }[feature];

            // 设置全局 flag
            mockFlags.set(`${flagKey}_null`, { key: flagKey, value: globalValue, accountId: null });
            
            // 设置用户 flag
            mockFlags.set(`${flagKey}_${accountId}`, { key: flagKey, value: userValue, accountId });

            const isEnabled = await router.isFeatureEnabled(feature, accountId);
            
            // 用户设置应该生效
            expect(isEnabled).toBe(userValue);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('无 flag 时应默认启用', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('research', 'agent', 'automation', 'chat') as fc.Arbitrary<'research' | 'agent' | 'automation' | 'chat'>,
          fc.integer({ min: 1, max: 1000 }),
          async (feature, accountId) => {
            // 不设置任何 flag
            mockFlags.clear();

            const isEnabled = await router.isFeatureEnabled(feature, accountId);
            
            // 默认应该启用
            expect(isEnabled).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('使用指标追踪', () => {
    it('每次请求都应记录指标', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (requestCount) => {
            router.resetMetrics();

            // 模拟多次请求
            for (let i = 0; i < requestCount; i++) {
              (router as any).recordMetrics(true, 100);
            }

            const metrics = router.getMetrics();
            expect(metrics.requests).toBe(requestCount);
            expect(metrics.successes).toBe(requestCount);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('失败请求应正确记录', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          async (successCount, failureCount) => {
            router.resetMetrics();

            for (let i = 0; i < successCount; i++) {
              (router as any).recordMetrics(true, 100);
            }

            for (let i = 0; i < failureCount; i++) {
              (router as any).recordMetrics(false, 100);
            }

            const metrics = router.getMetrics();
            expect(metrics.requests).toBe(successCount + failureCount);
            expect(metrics.successes).toBe(successCount);
            expect(metrics.failures).toBe(failureCount);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('健康状态', () => {
    it('成功率应正确计算', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          async (successes, failures) => {
            router.resetMetrics();

            for (let i = 0; i < successes; i++) {
              (router as any).recordMetrics(true, 100);
            }

            for (let i = 0; i < failures; i++) {
              (router as any).recordMetrics(false, 100);
            }

            const health = router.getHealthStatus();
            const expectedRate = successes / (successes + failures);

            expect(health.successRate).toBeCloseTo(expectedRate, 5);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('高成功率应标记为健康', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 91, max: 100 }),
          async (successRate) => {
            router.resetMetrics();

            // 模拟 100 次请求
            const successes = successRate;
            const failures = 100 - successRate;

            for (let i = 0; i < successes; i++) {
              (router as any).recordMetrics(true, 100);
            }

            for (let i = 0; i < failures; i++) {
              (router as any).recordMetrics(false, 100);
            }

            const health = router.getHealthStatus();
            expect(health.healthy).toBe(true);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
