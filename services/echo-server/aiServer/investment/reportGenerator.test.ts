/**
 * 报告生成属性测试
 * 
 * **Property 9: Risk Report Structure Completeness**
 * **Property 10: Risk Report Persistence**
 * **Validates: Requirements 7.2, 7.3, 7.4, 7.5**
 * 
 * @module services/echo-server/aiServer/investment/reportGenerator.test
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
let mockAnalyses: any[] = [];
let nextAnalysisId = 1;

const mockStockPositions = [
  {
    id: 1,
    ticker: 'AAPL',
    name: 'Apple Inc.',
    market: 'US',
    weight_percent: 25,
    market_value_cny: 100000,
    avg_cost: 150,
    unrealized_pnl_cny: 5000,
  },
  {
    id: 2,
    ticker: 'MSFT',
    name: 'Microsoft Corp.',
    market: 'US',
    weight_percent: 20,
    market_value_cny: 80000,
    avg_cost: 300,
    unrealized_pnl_cny: 3000,
  },
];

const mockDashboardSnapshot = {
  id: 1,
  date: '2026-01-05',
  net_worth_cny: 500000,
  cash_total_cny: 50000,
  cash_ratio: 0.1,
  high_water_mark: 520000,
  drawdown_percent: 3.85,
  margin_loan_cny: 0,
};

vi.mock('../../lib/investmentDb', () => ({
  getUserProfile: vi.fn().mockResolvedValue({ content: '测试用户档案' }),
  saveMessage: vi.fn().mockResolvedValue({ id: 1 }),
  getMessages: vi.fn().mockResolvedValue([]),
  createConversation: vi.fn().mockResolvedValue({ id: 1 }),
  getStockPositions: vi.fn().mockImplementation(async () => mockStockPositions),
  getOptionPositions: vi.fn().mockResolvedValue([]),
  getRecentTransactions: vi.fn().mockResolvedValue([]),
  getDashboardSnapshot: vi.fn().mockImplementation(async () => mockDashboardSnapshot),
  saveAnalysis: vi.fn().mockImplementation(async (analysis) => {
    const saved = { id: nextAnalysisId++, ...analysis, created_at: new Date().toISOString() };
    mockAnalyses.push(saved);
    return saved;
  }),
  getLatestAnalysis: vi.fn().mockImplementation(async () => {
    return mockAnalyses.length > 0 ? mockAnalyses[mockAnalyses.length - 1] : null;
  }),
}));

// Mock adaptiveRagService
vi.mock('./adaptiveRagService', () => ({
  getInvestmentContext: vi.fn().mockResolvedValue({
    text: '# 投资上下文\n\n测试上下文数据',
    citations: [],
  }),
}));

// 导入被测模块（在 mock 之后）
import { InvestmentAgent } from './investmentAgent';
import { saveAnalysis, getLatestAnalysis } from '../../lib/investmentDb';

// ============================================================================
// 属性测试
// ============================================================================

describe('报告生成属性测试', () => {
  let agent: InvestmentAgent;

  beforeEach(() => {
    // 重置 mock 状态
    mockAnalyses = [];
    nextAnalysisId = 1;
    
    agent = new InvestmentAgent();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 9: Risk Report Structure Completeness
   * 
   * *For any* risk report generation, the resulting report SHALL contain
   * all required fields: title, riskLevel, summary, content, recommendation,
   * actionPlan, primaryTicker, and portfolioSnapshot.
   * 
   * **Validates: Requirements 7.2, 7.3**
   */
  describe('Property 9: Risk Report Structure Completeness', () => {
    it('生成的报告应包含所有必需字段', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (accountId) => {
            const report = await agent.generateRiskReport(accountId);

            // 验证必需字段存在
            expect(report).toHaveProperty('title');
            expect(report).toHaveProperty('riskLevel');
            expect(report).toHaveProperty('summary');
            expect(report).toHaveProperty('content');
            expect(report).toHaveProperty('recommendation');
            expect(report).toHaveProperty('actionPlan');
            expect(report).toHaveProperty('primaryTicker');
            expect(report).toHaveProperty('portfolioSnapshot');

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('riskLevel 应为有效的风险等级', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (accountId) => {
            const report = await agent.generateRiskReport(accountId);

            // 验证风险等级
            expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(report.riskLevel);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('recommendation 应为有效的建议类型', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (accountId) => {
            const report = await agent.generateRiskReport(accountId);

            // 验证建议类型
            expect(['BUY', 'SELL', 'HOLD', 'REBALANCE', 'WARNING']).toContain(report.recommendation);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('portfolioSnapshot 应包含投资组合摘要信息', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (accountId) => {
            const report = await agent.generateRiskReport(accountId);

            // 验证 portfolioSnapshot 结构
            expect(report.portfolioSnapshot).toBeDefined();
            expect(typeof report.portfolioSnapshot).toBe('object');

            // 如果有数据，应包含关键字段
            if (Object.keys(report.portfolioSnapshot).length > 0) {
              expect(report.portfolioSnapshot).toHaveProperty('totalValue');
              expect(report.portfolioSnapshot).toHaveProperty('positionCount');
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('title 和 summary 应为非空字符串', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (accountId) => {
            const report = await agent.generateRiskReport(accountId);

            // 验证字符串字段
            expect(typeof report.title).toBe('string');
            expect(report.title.length).toBeGreaterThan(0);
            expect(typeof report.summary).toBe('string');
            expect(report.summary.length).toBeGreaterThan(0);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 10: Risk Report Persistence
   * 
   * *For any* successfully generated risk report, the report SHALL be
   * persisted to the ai_analyses table with all required fields.
   * 
   * **Validates: Requirements 7.4, 7.5**
   */
  describe('Property 10: Risk Report Persistence', () => {
    it('生成报告后应调用 saveAnalysis', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (accountId) => {
            const initialCount = mockAnalyses.length;

            await agent.generateRiskReport(accountId);

            // 验证 saveAnalysis 被调用
            expect(saveAnalysis).toHaveBeenCalled();
            expect(mockAnalyses.length).toBe(initialCount + 1);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('持久化的分析应包含正确的 user_id', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (accountId) => {
            await agent.generateRiskReport(accountId);

            // 获取最后保存的分析
            const lastAnalysis = mockAnalyses[mockAnalyses.length - 1];

            // 验证 user_id
            expect(lastAnalysis.user_id).toBe(accountId);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('持久化的分析应包含 portfolio_snapshot', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (accountId) => {
            await agent.generateRiskReport(accountId);

            // 获取最后保存的分析
            const lastAnalysis = mockAnalyses[mockAnalyses.length - 1];

            // 验证 portfolio_snapshot
            expect(lastAnalysis).toHaveProperty('portfolio_snapshot');
            expect(typeof lastAnalysis.portfolio_snapshot).toBe('object');

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('持久化的分析应包含有效的 risk_level 和 recommendation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (accountId) => {
            await agent.generateRiskReport(accountId);

            // 获取最后保存的分析
            const lastAnalysis = mockAnalyses[mockAnalyses.length - 1];

            // 验证字段
            expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(lastAnalysis.risk_level);
            expect(['BUY', 'SELL', 'HOLD', 'REBALANCE', 'WARNING']).toContain(lastAnalysis.recommendation);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('多次生成报告应创建多条分析记录', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          async (reportCount) => {
            const initialCount = mockAnalyses.length;

            // 生成多个报告
            for (let i = 0; i < reportCount; i++) {
              await agent.generateRiskReport(i + 1);
            }

            // 验证记录数量
            expect(mockAnalyses.length).toBe(initialCount + reportCount);

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * 错误处理测试
   */
  describe('错误处理', () => {
    it('数据库错误时应返回降级报告', async () => {
      // 模拟数据库错误
      const { getStockPositions } = await import('../../lib/investmentDb');
      vi.mocked(getStockPositions).mockRejectedValueOnce(new Error('DB error'));

      const report = await agent.generateRiskReport(1);

      // 应该返回降级报告
      expect(report).toHaveProperty('title');
      expect(report).toHaveProperty('riskLevel');
      expect(report.riskLevel).toBe('MEDIUM');
      expect(report.summary).toContain('错误');
    });
  });
});
