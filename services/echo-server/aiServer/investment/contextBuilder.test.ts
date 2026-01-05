/**
 * Context Builder 属性测试
 * 
 * **Property 2: Context Builder Data Completeness**
 * **Property 3: Context Builder Graceful Degradation**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 * 
 * @module services/echo-server/aiServer/investment/contextBuilder.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fc from 'fast-check';

import type {
  PortfolioContext,
  PortfolioSummary,
  PositionDetail,
  OptionDetail,
  TransactionDetail,
  KnowledgeContext,
  CurrencyValue,
} from './types';

// ============================================================================
// Mock 数据库模块
// ============================================================================

let mockDashboardSnapshot: any = null;
let mockStockPositions: any[] = [];
let mockOptionPositions: any[] = [];
let mockTransactions: any[] = [];
let shouldThrowError = false;

vi.mock('../../lib/investmentDb', () => ({
  getDashboardSnapshot: vi.fn().mockImplementation(async () => {
    if (shouldThrowError) throw new Error('Database connection failed');
    return mockDashboardSnapshot;
  }),
  getStockPositions: vi.fn().mockImplementation(async () => {
    if (shouldThrowError) throw new Error('Database connection failed');
    return mockStockPositions;
  }),
  getOptionPositions: vi.fn().mockImplementation(async () => {
    if (shouldThrowError) throw new Error('Database connection failed');
    return mockOptionPositions;
  }),
  getRecentTransactions: vi.fn().mockImplementation(async () => {
    if (shouldThrowError) throw new Error('Database connection failed');
    return mockTransactions;
  }),
}));

// 导入被测模块（在 mock 之后）
import {
  buildStructuredContext,
  buildKnowledgeContext,
  mergeContexts,
  buildContext,
  clearContextCache,
  convertToPositionDetail,
  convertToOptionDetail,
  convertToTransactionDetail,
  extractJSON,
} from './contextBuilder';

// ============================================================================
// 测试数据生成器
// ============================================================================

/**
 * 安全的日期字符串生成器（避免 Invalid Date 问题）
 */
const safeDateStringArb = (minDaysFromBase = 0, maxDaysFromBase = 2000) => 
  fc.integer({ min: minDaysFromBase, max: maxDaysFromBase }).map(days => {
    const d = new Date('2020-01-01');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  });

/**
 * 生成随机货币值
 */
const currencyValueArb = fc.record({
  value: fc.float({ min: 0, max: 1000000, noNaN: true }),
  currency: fc.constantFrom('USD', 'HKD', 'CNY') as fc.Arbitrary<'USD' | 'HKD' | 'CNY'>,
});

/**
 * 生成随机持仓详情
 */
const positionDetailArb: fc.Arbitrary<PositionDetail> = fc.record({
  ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  quantity: fc.integer({ min: 1, max: 10000 }),
  current_price: currencyValueArb,
  avg_cost: currencyValueArb,
  market_value_cny: fc.float({ min: 0, max: 10000000, noNaN: true }),
  weight_percent: fc.float({ min: 0, max: 100, noNaN: true }),
  unrealized_pnl_percent: fc.float({ min: -100, max: 1000, noNaN: true }),
});

/**
 * 生成随机期权详情
 */
const optionDetailArb: fc.Arbitrary<OptionDetail> = fc.record({
  symbol: fc.stringMatching(/^[A-Z]{1,5}\d{6}[CP]\d+$/),
  underlying: fc.stringMatching(/^[A-Z]{1,5}$/),
  option_type: fc.constantFrom('CALL', 'PUT') as fc.Arbitrary<'CALL' | 'PUT'>,
  strike_price: fc.float({ min: 1, max: 10000, noNaN: true }),
  expiry_date: safeDateStringArb(0, 365), // 未来一年内
  quantity: fc.integer({ min: -100, max: 100 }).filter(n => n !== 0),
  current_price: fc.float({ min: 0, max: 1000, noNaN: true }),
  market_value_cny: fc.float({ min: -1000000, max: 1000000, noNaN: true }),
  weight_percent: fc.float({ min: -50, max: 50, noNaN: true }),
  days_to_expiry: fc.integer({ min: 0, max: 365 }),
});

/**
 * 生成随机交易详情
 */
const transactionDetailArb: fc.Arbitrary<TransactionDetail> = fc.record({
  date: safeDateStringArb(0, 1500), // 过去约4年
  action: fc.constantFrom('BUY', 'SELL', 'SHORT', 'COVER') as fc.Arbitrary<'BUY' | 'SELL' | 'SHORT' | 'COVER'>,
  ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
  quantity: fc.integer({ min: 1, max: 10000 }),
  price: currencyValueArb,
});

/**
 * 生成随机投资组合摘要
 */
const portfolioSummaryArb: fc.Arbitrary<PortfolioSummary> = fc.record({
  snapshot_date: safeDateStringArb(0, 1500),
  total_net_worth_cny: fc.float({ min: 0, max: 100000000, noNaN: true }),
  total_positions: fc.integer({ min: 0, max: 100 }),
  total_options: fc.integer({ min: 0, max: 50 }),
  cash_ratio_percent: fc.float({ min: 0, max: 100, noNaN: true }),
  ytd_return_percent: fc.float({ min: -100, max: 1000, noNaN: true }),
  drawdown_percent: fc.float({ min: 0, max: 100, noNaN: true }),
  leverage_ratio: fc.float({ min: 0, max: 10, noNaN: true }),
});

/**
 * 生成随机投资组合上下文
 */
const portfolioContextArb: fc.Arbitrary<PortfolioContext> = fc.record({
  summary: portfolioSummaryArb,
  positions: fc.array(positionDetailArb, { minLength: 0, maxLength: 30 }),
  options: fc.array(optionDetailArb, { minLength: 0, maxLength: 10 }),
  transactions: fc.array(transactionDetailArb, { minLength: 0, maxLength: 20 }),
});

/**
 * 生成随机知识库上下文
 */
const knowledgeContextArb: fc.Arbitrary<KnowledgeContext> = fc.record({
  entities: fc.array(
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      description: fc.string({ minLength: 1, maxLength: 200 }),
      type: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
    }),
    { minLength: 0, maxLength: 5 }
  ),
  relations: fc.array(
    fc.record({
      source: fc.string({ minLength: 1, maxLength: 50 }),
      relation: fc.string({ minLength: 1, maxLength: 30 }),
      target: fc.string({ minLength: 1, maxLength: 50 }),
    }),
    { minLength: 0, maxLength: 5 }
  ),
  relevantContent: fc.string({ minLength: 0, maxLength: 500 }),
});

// ============================================================================
// 属性测试
// ============================================================================

describe('Context Builder 属性测试', () => {
  beforeEach(() => {
    // 重置 mock 状态
    mockDashboardSnapshot = null;
    mockStockPositions = [];
    mockOptionPositions = [];
    mockTransactions = [];
    shouldThrowError = false;
    clearContextCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearContextCache();
  });

  /**
   * Property 2: Context Builder Data Completeness
   * 
   * *For any* account with portfolio data, the Context Builder SHALL return
   * a result containing: positions array, dashboard snapshot, and formatted
   * text string. The formatted text SHALL contain all position tickers and
   * net worth value.
   * 
   * **Validates: Requirements 2.1, 2.2, 2.3**
   */
  describe('Property 2: Context Builder Data Completeness', () => {
    it('buildStructuredContext 应包含所有持仓 ticker 和净值', async () => {
      await fc.assert(
        fc.asyncProperty(
          portfolioContextArb,
          async (context) => {
            const result = buildStructuredContext(context);

            // 验证结果是字符串
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);

            // 验证包含 JSON 代码块
            expect(result).toContain('```json');
            expect(result).toContain('```');

            // 提取并验证 JSON
            const json = extractJSON(result);
            expect(json).not.toBeNull();

            // 验证 JSON 结构
            const parsed = json as any;
            expect(parsed).toHaveProperty('portfolio_summary');
            expect(parsed).toHaveProperty('stock_positions');
            expect(parsed).toHaveProperty('option_positions');
            expect(parsed).toHaveProperty('recent_transactions');

            // 验证净值包含在结果中
            expect(parsed.portfolio_summary.total_net_worth_cny).toBe(context.summary.total_net_worth_cny);

            // 验证持仓 ticker（最多显示 20 个）
            const displayedPositions = context.positions
              .sort((a, b) => b.market_value_cny - a.market_value_cny)
              .slice(0, 20);

            for (const pos of displayedPositions) {
              const found = parsed.stock_positions.some((p: any) => p.ticker === pos.ticker);
              expect(found).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('buildStructuredContext 应正确截断超过 20 个持仓', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(positionDetailArb, { minLength: 21, maxLength: 50 }),
          async (positions) => {
            const context: PortfolioContext = {
              summary: {
                snapshot_date: '2024-01-01',
                total_net_worth_cny: 1000000,
                total_positions: positions.length,
                total_options: 0,
                cash_ratio_percent: 10,
                ytd_return_percent: 5,
              },
              positions,
              options: [],
              transactions: [],
            };

            const result = buildStructuredContext(context);

            // 验证截断说明
            expect(result).toContain('additional positions not shown');
            expect(result).toContain('Top 20');

            // 验证 JSON 中只有 20 个持仓
            const json = extractJSON(result) as any;
            expect(json.stock_positions.length).toBe(20);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('buildContext 应返回包含所有数据源的完整上下文', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            netWorth: fc.float({ min: 1000, max: 10000000, noNaN: true }),
            positionCount: fc.integer({ min: 1, max: 10 }),
          }),
          async ({ netWorth, positionCount }) => {
            // 设置 mock 数据
            mockDashboardSnapshot = {
              date: '2024-01-01',
              net_worth_cny: netWorth,
              total_positions: positionCount,
              option_positions: 0,
              cash_ratio: 10,
              drawdown_percent: 5,
              leverage_ratio: 1,
            };

            mockStockPositions = Array.from({ length: positionCount }, (_, i) => ({
              ticker: `TST${i}`,
              name: `Test Stock ${i}`,
              quantity: 100,
              current_price: 50,
              avg_cost: 45,
              currency: 'USD',
              market_value_cny: 35000,
              weight_percent: 10,
              unrealized_pnl_percent: 11,
            }));

            mockOptionPositions = [];
            mockTransactions = [];

            const result = await buildContext(1, true);

            // 验证结果包含投资组合数据
            expect(result).toContain('投资组合数据');
            expect(result).toContain('portfolio_summary');

            // 验证包含净值
            expect(result).toContain(netWorth.toString().slice(0, 5)); // 检查净值的前几位

            // 验证包含所有持仓 ticker
            for (let i = 0; i < positionCount; i++) {
              expect(result).toContain(`TST${i}`);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 3: Context Builder Graceful Degradation
   * 
   * *For any* account without portfolio data or database error, the Context
   * Builder SHALL return a non-empty fallback message without throwing an
   * exception.
   * 
   * **Validates: Requirements 2.4**
   */
  describe('Property 3: Context Builder Graceful Degradation', () => {
    it('数据库错误时应返回有效上下文而非抛出异常', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          async (accountId) => {
            // 设置 mock 抛出错误
            shouldThrowError = true;

            // 不应抛出异常
            let result: string;
            let threwError = false;

            try {
              result = await buildContext(accountId, true);
            } catch (e) {
              threwError = true;
              result = '';
            }

            // 验证没有抛出异常（优雅降级的核心要求）
            expect(threwError).toBe(false);

            // 验证返回非空字符串
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);

            // 验证包含基本结构（即使数据为空也应有结构）
            expect(result).toContain('投资助手上下文信息');

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('空数据时应返回有效上下文', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          async (accountId) => {
            // 设置空数据
            mockDashboardSnapshot = null;
            mockStockPositions = [];
            mockOptionPositions = [];
            mockTransactions = [];

            const result = await buildContext(accountId, true);

            // 验证返回非空字符串
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);

            // 验证包含基本结构
            expect(result).toContain('投资助手上下文信息');

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('部分数据缺失时应继续处理', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            hasSnapshot: fc.boolean(),
            hasPositions: fc.boolean(),
            hasTransactions: fc.boolean(),
          }),
          async ({ hasSnapshot, hasPositions, hasTransactions }) => {
            // 根据配置设置部分数据
            mockDashboardSnapshot = hasSnapshot ? {
              date: '2024-01-01',
              net_worth_cny: 1000000,
              total_positions: 5,
              option_positions: 0,
              cash_ratio: 10,
              drawdown_percent: 5,
              leverage_ratio: 1,
            } : null;

            mockStockPositions = hasPositions ? [{
              ticker: 'AAPL',
              name: 'Apple Inc',
              quantity: 100,
              current_price: 150,
              avg_cost: 140,
              currency: 'USD',
              market_value_cny: 100000,
              weight_percent: 10,
              unrealized_pnl_percent: 7,
            }] : [];

            mockTransactions = hasTransactions ? [{
              date: '2024-01-01',
              action: 'BUY',
              ticker: 'AAPL',
              quantity: 100,
              price: 140,
              currency: 'USD',
            }] : [];

            mockOptionPositions = [];

            const result = await buildContext(1, true);

            // 验证返回非空字符串
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);

            // 验证包含基本结构
            expect(result).toContain('投资助手上下文信息');

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * 辅助函数测试
   */
  describe('数据转换函数', () => {
    it('convertToPositionDetail 应正确转换数据库格式', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
            name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
            quantity: fc.integer({ min: 1, max: 10000 }),
            current_price: fc.float({ min: 0, max: 10000, noNaN: true }),
            avg_cost: fc.float({ min: 0, max: 10000, noNaN: true }),
            currency: fc.option(fc.constantFrom('USD', 'HKD', 'CNY'), { nil: null }),
            market_value_cny: fc.float({ min: 0, max: 10000000, noNaN: true }),
            weight_percent: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: null }),
            unrealized_pnl_percent: fc.option(fc.float({ min: -100, max: 1000, noNaN: true }), { nil: null }),
          }),
          async (raw) => {
            const result = convertToPositionDetail(raw as any);

            // 验证必填字段
            expect(result.ticker).toBe(raw.ticker);
            expect(result.name).toBe(raw.name || raw.ticker);
            expect(result.quantity).toBe(raw.quantity);
            expect(result.market_value_cny).toBe(raw.market_value_cny);

            // 验证货币值结构
            expect(result.current_price).toHaveProperty('value');
            expect(result.current_price).toHaveProperty('currency');
            expect(result.avg_cost).toHaveProperty('value');
            expect(result.avg_cost).toHaveProperty('currency');

            // 验证默认值
            expect(result.weight_percent).toBe(raw.weight_percent || 0);
            expect(result.unrealized_pnl_percent).toBe(raw.unrealized_pnl_percent || 0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('convertToTransactionDetail 应正确转换交易记录', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            date: safeDateStringArb(0, 1500),
            action: fc.constantFrom('BUY', 'SELL', 'SHORT', 'COVER'),
            ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
            quantity: fc.integer({ min: 1, max: 10000 }),
            price: fc.option(fc.float({ min: 0, max: 10000, noNaN: true }), { nil: null }),
            currency: fc.option(fc.constantFrom('USD', 'HKD', 'CNY'), { nil: null }),
          }),
          async (raw) => {
            const result = convertToTransactionDetail(raw as any);

            expect(result.date).toBe(raw.date);
            expect(result.action).toBe(raw.action);
            expect(result.ticker).toBe(raw.ticker);
            expect(result.quantity).toBe(raw.quantity);
            expect(result.price).toHaveProperty('value');
            expect(result.price).toHaveProperty('currency');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 上下文合并测试
   */
  describe('mergeContexts', () => {
    it('应正确合并多个上下文来源', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.option(fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0), { nil: null }),
          fc.option(fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0), { nil: null }),
          async (structured, knowledge) => {
            const result = mergeContexts(structured, knowledge);

            // 验证返回非空字符串
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);

            // 验证包含标题
            expect(result).toContain('投资助手上下文信息');

            // 验证包含对应内容
            if (structured && structured.trim()) {
              expect(result).toContain('📊 数据来源');
              expect(result).toContain(structured);
            }

            if (knowledge && knowledge.trim()) {
              expect(result).toContain('📚 数据来源');
              expect(result).toContain(knowledge);
            }

            // 如果都为空，应显示无数据提示
            if ((!structured || !structured.trim()) && (!knowledge || !knowledge.trim())) {
              expect(result).toContain('暂无相关上下文数据');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 知识库上下文构建测试
   */
  describe('buildKnowledgeContext', () => {
    it('应正确格式化知识库内容', async () => {
      await fc.assert(
        fc.asyncProperty(
          knowledgeContextArb,
          async (context) => {
            const result = buildKnowledgeContext(context);

            // 验证返回非空字符串
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);

            // 验证包含标题
            expect(result).toContain('相关知识库内容');

            // 验证实体部分
            if (context.entities.length > 0) {
              expect(result).toContain('相关实体');
              for (const entity of context.entities) {
                expect(result).toContain(entity.name);
              }
            }

            // 验证关系部分
            if (context.relations.length > 0) {
              expect(result).toContain('实体关系');
              for (const relation of context.relations) {
                expect(result).toContain(relation.source);
                expect(result).toContain(relation.target);
              }
            }

            // 验证相关内容部分
            if (context.relevantContent.trim()) {
              expect(result).toContain('相关文档摘要');
              expect(result).toContain(context.relevantContent);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 缓存测试
   */
  describe('缓存机制', () => {
    it('相同 accountId 应使用缓存', async () => {
      mockDashboardSnapshot = {
        date: '2024-01-01',
        net_worth_cny: 1000000,
        total_positions: 5,
        option_positions: 0,
        cash_ratio: 10,
        drawdown_percent: 5,
        leverage_ratio: 1,
      };
      mockStockPositions = [{
        ticker: 'AAPL',
        name: 'Apple',
        quantity: 100,
        current_price: 150,
        avg_cost: 140,
        currency: 'USD',
        market_value_cny: 100000,
        weight_percent: 10,
        unrealized_pnl_percent: 7,
      }];

      // 第一次调用
      const result1 = await buildContext(1, true);

      // 修改 mock 数据
      mockDashboardSnapshot.net_worth_cny = 2000000;

      // 第二次调用（应使用缓存）
      const result2 = await buildContext(1, false);

      // 验证使用了缓存（结果相同）
      expect(result1).toBe(result2);

      // 强制刷新
      const result3 = await buildContext(1, true);

      // 验证刷新后数据更新
      expect(result3).not.toBe(result1);
    });

    it('clearContextCache 应清除缓存', async () => {
      mockDashboardSnapshot = {
        date: '2024-01-01',
        net_worth_cny: 1000000,
        total_positions: 5,
        option_positions: 0,
        cash_ratio: 10,
        drawdown_percent: 5,
        leverage_ratio: 1,
      };
      mockStockPositions = [];

      // 第一次调用
      await buildContext(1, true);

      // 修改数据
      mockDashboardSnapshot.net_worth_cny = 3000000;

      // 清除缓存
      clearContextCache(1);

      // 再次调用（应获取新数据）
      const result = await buildContext(1, false);

      // 验证包含新数据
      expect(result).toContain('3000000');
    });
  });
});
