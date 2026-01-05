/**
 * Investment Agent 属性测试
 * 
 * **Property 1: Agent Initialization Consistency**
 * **Validates: Requirements 1.1, 1.2, 1.4**
 * 
 * @module services/echo-server/aiServer/investment/investmentAgent.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fc from 'fast-check';

// ============================================================================
// Mock 模块
// ============================================================================

// Mock AiModelFactory
vi.mock('../aiModelFactory', () => ({
  AiModelFactory: {
    GetProvider: vi.fn().mockResolvedValue({
      LLM: {
        generate: vi.fn().mockResolvedValue({ text: 'Mock response' }),
      },
    }),
  },
}));

// Mock Mastra
const mockAgent = {
  generate: vi.fn().mockResolvedValue({ text: 'Mock AI response' }),
  stream: vi.fn().mockReturnValue({
    textStream: (async function* () {
      yield 'Mock ';
      yield 'stream ';
      yield 'response';
    })(),
  }),
};

vi.mock('@mastra/core', () => ({
  Agent: vi.fn().mockImplementation((config) => ({
    ...mockAgent,
    name: config.name,
    instructions: config.instructions,
  })),
  Mastra: vi.fn().mockImplementation((config) => ({
    getAgent: vi.fn().mockReturnValue(mockAgent),
    agents: config.agents,
  })),
}));

// Mock investmentDb
let mockConversations: any[] = [];
let mockMessages: any[] = [];
let mockUserProfile: any = null;
let nextConvId = 1;
let nextMsgId = 1;

vi.mock('../../lib/investmentDb', () => ({
  getUserProfile: vi.fn().mockImplementation(async () => mockUserProfile),
  saveMessage: vi.fn().mockImplementation(async (msg) => {
    const saved = { id: nextMsgId++, ...msg, created_at: new Date().toISOString() };
    mockMessages.push(saved);
    return saved;
  }),
  getMessages: vi.fn().mockImplementation(async (convId) => {
    return mockMessages.filter(m => m.conversation_id === convId);
  }),
  createConversation: vi.fn().mockImplementation(async (accountId, title) => {
    const conv = { id: nextConvId++, account_id: accountId, title, created_at: new Date().toISOString() };
    mockConversations.push(conv);
    return conv;
  }),
  getStockPositions: vi.fn().mockResolvedValue([]),
  getOptionPositions: vi.fn().mockResolvedValue([]),
  getRecentTransactions: vi.fn().mockResolvedValue([]),
  getDashboardSnapshot: vi.fn().mockResolvedValue(null),
}));

// Mock contextBuilder
vi.mock('./contextBuilder', () => ({
  buildContext: vi.fn().mockResolvedValue('# 投资组合数据\n\n测试数据'),
}));

// Mock adaptiveRagService
vi.mock('./adaptiveRagService', () => ({
  getInvestmentContext: vi.fn().mockResolvedValue({
    text: '# 投资上下文\n\n测试上下文数据',
    citations: [
      { source: '📊 结构化数据', title: '投资组合', content_snippet: '测试数据' },
    ],
  }),
}));

// 导入被测模块（在 mock 之后）
import { InvestmentAgent, investmentAgent } from './investmentAgent';

// ============================================================================
// 属性测试
// ============================================================================

describe('Investment Agent 属性测试', () => {
  let agent: InvestmentAgent;

  beforeEach(() => {
    // 重置 mock 状态
    mockConversations = [];
    mockMessages = [];
    mockUserProfile = null;
    nextConvId = 1;
    nextMsgId = 1;
    
    agent = new InvestmentAgent();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 1: Agent Initialization Consistency
   * 
   * *For any* Investment Agent initialization, the resulting agent SHALL have
   * a valid system prompt containing the "Investment Mirror" persona keywords
   * and be registered in the agent manager.
   * 
   * **Validates: Requirements 1.1, 1.2, 1.4**
   */
  describe('Property 1: Agent Initialization Consistency', () => {
    it('初始化后应包含 Investment Mirror 人格关键词', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null), // 无需输入参数
          async () => {
            // 初始化 Agent
            await agent.initialize();

            // 获取配置
            const config = agent.getConfig();

            // 验证名称
            expect(config.name).toBe('investment-mirror');
            expect(config.displayName).toBe('Investment Mirror');

            // 验证人格描述包含关键词
            expect(config.persona).toContain('投资');
            expect(config.persona).toContain('PIP');

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('多次初始化应保持幂等性', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (initCount) => {
            // 多次初始化
            for (let i = 0; i < initCount; i++) {
              await agent.initialize();
            }

            // 获取配置
            const config = agent.getConfig();

            // 验证配置一致
            expect(config.name).toBe('investment-mirror');
            expect(config.displayName).toBe('Investment Mirror');

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('getConfig 应返回完整的 Agent 配置', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const config = agent.getConfig();

            // 验证配置结构
            expect(config).toHaveProperty('name');
            expect(config).toHaveProperty('displayName');
            expect(config).toHaveProperty('persona');

            // 验证类型
            expect(typeof config.name).toBe('string');
            expect(typeof config.displayName).toBe('string');
            expect(typeof config.persona).toBe('string');

            // 验证非空
            expect(config.name.length).toBeGreaterThan(0);
            expect(config.displayName.length).toBeGreaterThan(0);
            expect(config.persona.length).toBeGreaterThan(0);

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * 对话功能测试
   */
  describe('对话功能', () => {
    it('chat 应返回有效的响应结构', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.integer({ min: 1, max: 100 }),
          async (message, accountId) => {
            const response = await agent.chat(
              { message, includeContext: true },
              accountId
            );

            // 验证响应结构
            expect(response).toHaveProperty('message');
            expect(response).toHaveProperty('citations');
            expect(response).toHaveProperty('conversationId');
            expect(response).toHaveProperty('messageId');

            // 验证类型
            expect(typeof response.message).toBe('string');
            expect(Array.isArray(response.citations)).toBe(true);
            expect(typeof response.conversationId).toBe('number');
            expect(typeof response.messageId).toBe('number');

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('chat 应保存用户消息和 AI 响应', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (message) => {
            const initialMsgCount = mockMessages.length;

            await agent.chat({ message }, 1);

            // 应该保存了 2 条消息（用户 + AI）
            expect(mockMessages.length).toBe(initialMsgCount + 2);

            // 验证消息角色
            const userMsg = mockMessages[mockMessages.length - 2];
            const aiMsg = mockMessages[mockMessages.length - 1];

            expect(userMsg.role).toBe('user');
            expect(userMsg.content).toBe(message);
            expect(aiMsg.role).toBe('assistant');

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('chat 应在没有 conversationId 时创建新对话', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (message) => {
            const initialConvCount = mockConversations.length;

            const response = await agent.chat({ message }, 1);

            // 应该创建了新对话
            expect(mockConversations.length).toBe(initialConvCount + 1);
            expect(response.conversationId).toBeGreaterThan(0);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * 每日洞察测试
   */
  describe('每日洞察生成', () => {
    it('generateDailyInsight 应返回有效的洞察结构', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (accountId) => {
            const insight = await agent.generateDailyInsight(accountId);

            // 验证结构
            expect(insight).toHaveProperty('date');
            expect(insight).toHaveProperty('content');
            expect(insight).toHaveProperty('riskLevel');

            // 验证日期格式
            expect(insight.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

            // 验证内容长度
            expect(insight.content.length).toBeLessThanOrEqual(100);

            // 验证风险等级
            expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(insight.riskLevel);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('generateDailyInsight 应在错误时返回默认洞察', async () => {
      // 模拟错误
      mockAgent.generate.mockRejectedValueOnce(new Error('AI error'));

      const insight = await agent.generateDailyInsight(1);

      // 应该返回默认洞察
      expect(insight).toHaveProperty('date');
      expect(insight).toHaveProperty('content');
      expect(insight).toHaveProperty('riskLevel');
      expect(insight.riskLevel).toBe('LOW');
    });
  });

  /**
   * 默认实例测试
   */
  describe('默认实例', () => {
    it('investmentAgent 应是有效的 InvestmentAgent 实例', () => {
      expect(investmentAgent).toBeInstanceOf(InvestmentAgent);
      expect(investmentAgent.getConfig()).toHaveProperty('name');
    });
  });
});
