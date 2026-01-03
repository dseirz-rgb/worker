/**
 * 工具注册系统属性测试
 * 
 * **Validates: Requirements 5.5**
 * Property 4: 工具权限隔离
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { ToolRegistry, ToolContext, ToolDefinition } from './toolRegistry';
import { z } from 'zod/v3';

// Mock prisma
vi.mock('@server/prisma', () => ({
  prisma: {
    agent: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@server/prisma';

describe('ToolRegistry 属性测试', () => {
  beforeEach(() => {
    // 清除所有工具
    (ToolRegistry as any).tools.clear();
    (ToolRegistry as any).executionLogs = [];
    vi.clearAllMocks();
  });

  /**
   * Property 4: 工具权限隔离
   * 
   * *For any* tool execution, if the Agent does not have the required permission,
   * the System SHALL reject the execution and return an error.
   */
  describe('Property 4: 工具权限隔离', () => {
    it('无权限工具应被拒绝执行', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成工具名称
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
          // 生成权限列表
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          // 生成 accountId
          fc.integer({ min: 1, max: 1000 }),
          // 生成 agentId
          fc.integer({ min: 1, max: 1000 }),
          async (toolName, permissions, accountId, agentId) => {
            // 注册需要权限的工具
            const tool: ToolDefinition = {
              name: toolName,
              description: `测试工具 ${toolName}`,
              parameters: z.object({ input: z.string() }),
              execute: async () => ({ success: true }),
              permissions,
              category: 'system',
            };
            ToolRegistry.register(tool);

            // Mock agent 没有该工具权限
            (prisma.agent.findUnique as any).mockResolvedValue({
              id: agentId,
              tools: [], // 空工具列表
            });

            const context: ToolContext = { accountId, agentId };

            // 执行应该抛出权限错误
            await expect(
              ToolRegistry.execute(toolName, { input: 'test' }, context)
            ).rejects.toThrow(/Permission denied/);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('有权限工具应成功执行', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 1000 }),
          async (toolName, accountId, agentId) => {
            // 注册需要权限的工具
            const tool: ToolDefinition = {
              name: toolName,
              description: `测试工具 ${toolName}`,
              parameters: z.object({ input: z.string() }),
              execute: async (params) => ({ success: true, input: params.input }),
              permissions: ['test_permission'],
              category: 'system',
            };
            ToolRegistry.register(tool);

            // Mock agent 有该工具权限
            (prisma.agent.findUnique as any).mockResolvedValue({
              id: agentId,
              tools: [toolName], // 包含该工具
            });

            const context: ToolContext = { accountId, agentId };

            // 执行应该成功
            const result = await ToolRegistry.execute(toolName, { input: 'test' }, context);
            expect(result).toEqual({ success: true, input: 'test' });

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('无权限要求的工具应直接执行', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
          fc.integer({ min: 1, max: 1000 }),
          async (toolName, accountId) => {
            // 注册无权限要求的工具
            const tool: ToolDefinition = {
              name: toolName,
              description: `测试工具 ${toolName}`,
              parameters: z.object({ value: z.number() }),
              execute: async (params) => ({ doubled: params.value * 2 }),
              // 无 permissions 字段
              category: 'system',
            };
            ToolRegistry.register(tool);

            const context: ToolContext = { accountId };
            const testValue = Math.floor(Math.random() * 100);

            // 执行应该成功
            const result = await ToolRegistry.execute(toolName, { value: testValue }, context);
            expect(result).toEqual({ doubled: testValue * 2 });

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('工具注册和获取', () => {
    it('注册的工具应能被正确获取', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
              description: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (toolConfigs) => {
            // 确保名称唯一
            const uniqueConfigs = toolConfigs.filter(
              (config, index, self) => self.findIndex(c => c.name === config.name) === index
            );

            // 注册工具
            for (const config of uniqueConfigs) {
              ToolRegistry.register({
                name: config.name,
                description: config.description,
                parameters: z.object({}),
                execute: async () => ({}),
              });
            }

            // 验证所有工具都能获取
            for (const config of uniqueConfigs) {
              const tool = ToolRegistry.getTool(config.name);
              expect(tool).toBeDefined();
              expect(tool?.name).toBe(config.name);
              expect(tool?.description).toBe(config.description);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('执行日志', () => {
    it('每次执行都应记录日志', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 1000 }),
          async (executionCount, accountId) => {
            const toolName = 'logTestTool';
            
            ToolRegistry.register({
              name: toolName,
              description: '日志测试工具',
              parameters: z.object({ count: z.number() }),
              execute: async (params) => ({ count: params.count }),
            });

            const context: ToolContext = { accountId };

            // 执行多次
            for (let i = 0; i < executionCount; i++) {
              await ToolRegistry.execute(toolName, { count: i }, context);
            }

            // 验证日志数量
            const logs = ToolRegistry.getExecutionLogs({ toolName });
            expect(logs.length).toBeGreaterThanOrEqual(executionCount);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
