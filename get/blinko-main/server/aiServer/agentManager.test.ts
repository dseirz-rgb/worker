/**
 * Agent 管理系统属性测试
 * 
 * **Validates: Requirements 3.2, 3.3**
 * Property 2: Agent 配置持久性
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fc from 'fast-check';

// Mock prisma
const mockAgents = new Map<number, any>();
let nextId = 1;

vi.mock('@server/prisma', () => ({
  prisma: {
    agent: {
      create: vi.fn().mockImplementation(({ data }) => {
        const id = nextId++;
        const agent = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
        mockAgents.set(id, agent);
        return Promise.resolve(agent);
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(mockAgents.get(where.id) || null);
      }),
      findMany: vi.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(mockAgents.values()));
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const agent = mockAgents.get(where.id);
        if (!agent) throw new Error('Not found');
        const updated = { ...agent, ...data, updatedAt: new Date() };
        mockAgents.set(where.id, updated);
        return Promise.resolve(updated);
      }),
      delete: vi.fn().mockImplementation(({ where }) => {
        const agent = mockAgents.get(where.id);
        mockAgents.delete(where.id);
        return Promise.resolve(agent);
      }),
      findFirst: vi.fn().mockImplementation(({ where }) => {
        for (const agent of mockAgents.values()) {
          if (where.name && agent.name === where.name) return Promise.resolve(agent);
          if (where.slug && agent.slug === where.slug) return Promise.resolve(agent);
        }
        return Promise.resolve(null);
      }),
    },
  },
}));

// Mock AiModelFactory
vi.mock('./aiModelFactory', () => ({
  AiModelFactory: {
    GetProvider: vi.fn().mockResolvedValue({
      LLM: {},
    }),
  },
}));

// Mock ToolRegistry
vi.mock('./tools/toolRegistry', () => ({
  ToolRegistry: {
    toMastraTools: vi.fn().mockReturnValue({}),
  },
}));

// Mock Mastra
vi.mock('@mastra/core', () => ({
  Agent: vi.fn().mockImplementation(() => ({})),
  Mastra: vi.fn().mockImplementation(() => ({
    getAgent: vi.fn().mockReturnValue({
      generate: vi.fn().mockResolvedValue({ text: 'Mock response' }),
      stream: vi.fn().mockReturnValue({ textStream: [] }),
    }),
  })),
}));

vi.mock('@mastra/loggers', () => ({
  PinoLogger: vi.fn(),
}));

import { AgentManager, CreateAgentInput } from './agentManager';

describe('AgentManager 属性测试', () => {
  let manager: AgentManager;

  beforeEach(() => {
    mockAgents.clear();
    nextId = 1;
    manager = new AgentManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockAgents.clear();
  });

  /**
   * Property 2: Agent 配置持久性
   * 
   * *For any* Agent created through the UI, retrieving that Agent SHALL return
   * the same configuration (name, persona, tools, systemPrompt) that was saved.
   */
  describe('Property 2: Agent 配置持久性', () => {
    it('创建的 Agent 应能被完整检索', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            persona: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
            systemPrompt: fc.string({ minLength: 10, maxLength: 2000 }),
            tools: fc.array(fc.constantFrom('searchNotes', 'webSearch', 'createNote', 'readWebpage'), { maxLength: 4 }),
            privacy: fc.constantFrom('public', 'private') as fc.Arbitrary<'public' | 'private'>,
          }),
          fc.integer({ min: 1, max: 1000 }),
          async (config, accountId) => {
            const input: CreateAgentInput = {
              name: config.name,
              persona: config.persona,
              systemPrompt: config.systemPrompt,
              tools: config.tools,
              privacy: config.privacy,
              accountId,
            };

            // 创建 Agent
            const created = await manager.createAgent(input);

            // 检索 Agent
            const retrieved = await manager.getAgent(created.id);

            // 验证配置一致性
            expect(retrieved).not.toBeNull();
            expect(retrieved!.name).toBe(config.name);
            expect(retrieved!.persona).toBe(config.persona || null);
            expect(retrieved!.systemPrompt).toBe(config.systemPrompt);
            expect(retrieved!.tools).toEqual(config.tools);
            expect(retrieved!.privacy).toBe(config.privacy);
            expect(retrieved!.accountId).toBe(accountId);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('更新的 Agent 配置应被正确保存', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 初始配置
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            systemPrompt: fc.string({ minLength: 10, maxLength: 500 }),
          }),
          // 更新配置
          fc.record({
            name: fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { nil: undefined }),
            persona: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
            systemPrompt: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: undefined }),
          }),
          fc.integer({ min: 1, max: 1000 }),
          async (initial, updates, accountId) => {
            // 创建初始 Agent
            const created = await manager.createAgent({
              name: initial.name,
              systemPrompt: initial.systemPrompt,
              accountId,
            });

            // 更新 Agent
            const updateData: any = {};
            if (updates.name) updateData.name = updates.name;
            if (updates.persona !== undefined) updateData.persona = updates.persona;
            if (updates.systemPrompt) updateData.systemPrompt = updates.systemPrompt;

            if (Object.keys(updateData).length > 0) {
              await manager.updateAgent(created.id, updateData);
            }

            // 检索更新后的 Agent
            const retrieved = await manager.getAgent(created.id);

            // 验证更新后的配置
            expect(retrieved).not.toBeNull();
            expect(retrieved!.name).toBe(updates.name || initial.name);
            expect(retrieved!.systemPrompt).toBe(updates.systemPrompt || initial.systemPrompt);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('删除的 Agent 应无法检索', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 200 }),
          fc.integer({ min: 1, max: 1000 }),
          async (name, systemPrompt, accountId) => {
            // 创建 Agent
            const created = await manager.createAgent({
              name,
              systemPrompt,
              accountId,
            });

            // 验证创建成功
            const beforeDelete = await manager.getAgent(created.id);
            expect(beforeDelete).not.toBeNull();

            // 删除 Agent
            await manager.deleteAgent(created.id);

            // 验证删除成功
            const afterDelete = await manager.getAgent(created.id);
            expect(afterDelete).toBeNull();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Agent slug 应唯一', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            { minLength: 2, maxLength: 5 }
          ),
          fc.integer({ min: 1, max: 1000 }),
          async (names, accountId) => {
            const slugs = new Set<string>();

            for (const name of names) {
              const agent = await manager.createAgent({
                name,
                systemPrompt: 'Test system prompt for ' + name,
                accountId,
              });

              // 验证 slug 唯一
              expect(slugs.has(agent.slug)).toBe(false);
              slugs.add(agent.slug);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Agent 列表查询', () => {
    it('应返回用户的所有 Agent 和公开 Agent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 5 }),
          async (accountId, agentCount) => {
            // 创建多个 Agent
            for (let i = 0; i < agentCount; i++) {
              await manager.createAgent({
                name: `Agent ${i}`,
                systemPrompt: `System prompt ${i}`,
                privacy: i % 2 === 0 ? 'public' : 'private',
                accountId,
              });
            }

            // 获取列表
            const agents = await manager.getAgents(accountId);

            // 验证数量
            expect(agents.length).toBeGreaterThanOrEqual(agentCount);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
