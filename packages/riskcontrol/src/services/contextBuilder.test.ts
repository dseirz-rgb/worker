/**
 * Context Builder 属性测试
 * 
 * 使用 fast-check 进行属性测试，验证 Context Builder 的正确性。
 * 
 * 测试的属性：
 * - Property 7: Structured Context JSON Validity
 * - Property 8: Position Truncation with Summary
 * - Property 11: Context Source Attribution
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  buildStructuredContext,
  buildKnowledgeContext,
  mergeContexts,
  extractJSON,
  type PortfolioSummary,
  type PositionDetail,
  type OptionDetail,
  type TransactionDetail,
  type PortfolioContext,
  type KnowledgeContext,
  type Entity,
  type Relation,
  type CurrencyValue
} from './contextBuilder';

// ============================================================================
// Arbitrary Generators (数据生成器)
// ============================================================================

/** 货币类型生成器 */
const arbitraryCurrency = fc.constantFrom<'USD' | 'HKD' | 'CNY'>('USD', 'HKD', 'CNY');

/** 货币值生成器 */
const arbitraryCurrencyValue = (currency?: 'USD' | 'HKD' | 'CNY'): fc.Arbitrary<CurrencyValue> =>
  fc.record({
    value: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
    currency: currency ? fc.constant(currency) : arbitraryCurrency
  });

/** 股票代码生成器 */
const arbitraryTicker = fc.stringMatching(/^[A-Z]{1,5}$/);

/** 持仓详情生成器 */
const arbitraryPosition = (): fc.Arbitrary<PositionDetail> =>
  arbitraryCurrency.chain(currency =>
    fc.record({
      ticker: arbitraryTicker,
      name: fc.string({ minLength: 1, maxLength: 50 }),
      quantity: fc.integer({ min: 1, max: 100000 }),
      current_price: arbitraryCurrencyValue(currency),
      avg_cost: arbitraryCurrencyValue(currency),
      market_value_cny: fc.float({ min: Math.fround(100), max: Math.fround(10000000), noNaN: true }),
      weight_percent: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
      unrealized_pnl_percent: fc.float({ min: Math.fround(-100), max: Math.fround(1000), noNaN: true })
    })
  );

/** 期权详情生成器 */
const arbitraryOption = (): fc.Arbitrary<OptionDetail> =>
  fc.record({
    symbol: fc.string({ minLength: 5, maxLength: 20 }),
    underlying: arbitraryTicker,
    option_type: fc.constantFrom<'CALL' | 'PUT'>('CALL', 'PUT'),
    strike_price: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
    expiry_date: fc.integer({ min: 0, max: 2500 })
      .map(days => {
        const d = new Date('2024-01-01');
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
      }),
    quantity: fc.integer({ min: -100, max: 100 }),
    current_price: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
    market_value_cny: fc.float({ min: Math.fround(-1000000), max: Math.fround(1000000), noNaN: true }),
    weight_percent: fc.float({ min: Math.fround(-10), max: Math.fround(10), noNaN: true })
  });

/** 交易记录生成器 */
const arbitraryTransaction = (): fc.Arbitrary<TransactionDetail> =>
  arbitraryCurrency.chain(currency =>
    fc.record({
      date: fc.integer({ min: 0, max: 2000 })
        .map(days => {
          const d = new Date('2020-01-01');
          d.setDate(d.getDate() + days);
          return d.toISOString().split('T')[0];
        }),
      action: fc.constantFrom<'BUY' | 'SELL' | 'SHORT' | 'COVER'>('BUY', 'SELL', 'SHORT', 'COVER'),
      ticker: arbitraryTicker,
      quantity: fc.integer({ min: 1, max: 10000 }),
      price: arbitraryCurrencyValue(currency)
    })
  );

/** 投资组合摘要生成器 */
const arbitrarySummary = (positionCount: number, optionCount: number): fc.Arbitrary<PortfolioSummary> =>
  fc.record({
    snapshot_date: fc.integer({ min: 0, max: 730 })
      .map(days => {
        const d = new Date('2024-01-01');
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
      }),
    total_net_worth_cny: fc.float({ min: Math.fround(10000), max: Math.fround(100000000), noNaN: true }),
    total_positions: fc.constant(positionCount),
    total_options: fc.constant(optionCount),
    cash_ratio_percent: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
    ytd_return_percent: fc.float({ min: Math.fround(-50), max: Math.fround(200), noNaN: true })
  });

/** 实体生成器 */
const arbitraryEntity = (): fc.Arbitrary<Entity> =>
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 30 }),
    description: fc.string({ minLength: 1, maxLength: 200 }),
    type: fc.option(fc.constantFrom('CONCEPT', 'PERSON', 'COMPANY', 'STRATEGY'), { nil: undefined })
  });

/** 关系生成器 */
const arbitraryRelation = (): fc.Arbitrary<Relation> =>
  fc.record({
    source: fc.string({ minLength: 1, maxLength: 30 }),
    relation: fc.constantFrom('倡导', '属于', '影响', '包含', '相关'),
    target: fc.string({ minLength: 1, maxLength: 30 })
  });

/** 知识库上下文生成器 */
const arbitraryKnowledgeContext = (): fc.Arbitrary<KnowledgeContext> =>
  fc.record({
    entities: fc.array(arbitraryEntity(), { minLength: 0, maxLength: 10 }),
    relations: fc.array(arbitraryRelation(), { minLength: 0, maxLength: 10 }),
    relevantContent: fc.string({ minLength: 0, maxLength: 1000 })
  });

// ============================================================================
// Property 7: Structured Context JSON Validity
// ============================================================================

describe('Property 7: Structured Context JSON Validity', () => {
  it('should always produce valid JSON with required fields', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryPosition(), { minLength: 0, maxLength: 50 }),
        fc.array(arbitraryOption(), { minLength: 0, maxLength: 10 }),
        fc.array(arbitraryTransaction(), { minLength: 0, maxLength: 20 }),
        (positions, options, transactions) => {
          // 生成摘要
          const summaryArb = arbitrarySummary(positions.length, options.length);
          const summary = fc.sample(summaryArb, 1)[0];
          
          const data: PortfolioContext = {
            summary,
            positions,
            options,
            transactions
          };
          
          const context = buildStructuredContext(data);
          
          // 1. 应该能提取出有效 JSON
          const parsed = extractJSON(context);
          expect(parsed).not.toBeNull();
          
          if (parsed) {
            const json = parsed as Record<string, unknown>;
            
            // 2. 应该包含 portfolio_summary
            expect(json.portfolio_summary).toBeDefined();
            const portfolioSummary = json.portfolio_summary as Record<string, unknown>;
            expect(typeof portfolioSummary.total_net_worth_cny).toBe('number');
            expect(typeof portfolioSummary.total_positions).toBe('number');
            expect(typeof portfolioSummary.cash_ratio_percent).toBe('number');
            
            // 3. 应该包含 stock_positions 数组
            expect(Array.isArray(json.stock_positions)).toBe(true);
            
            // 4. 每个持仓应该有货币信息
            const stockPositions = json.stock_positions as Array<Record<string, unknown>>;
            stockPositions.forEach(p => {
              expect(p.current_price).toBeDefined();
              const currentPrice = p.current_price as Record<string, unknown>;
              expect(currentPrice.currency).toMatch(/^(USD|HKD|CNY)$/);
              expect(typeof currentPrice.value).toBe('number');
            });
            
            // 5. 应该包含 recent_transactions 数组
            expect(Array.isArray(json.recent_transactions)).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty data gracefully', () => {
    const emptyData: PortfolioContext = {
      summary: {
        snapshot_date: '2024-12-27',
        total_net_worth_cny: 0,
        total_positions: 0,
        total_options: 0,
        cash_ratio_percent: 100,
        ytd_return_percent: 0
      },
      positions: [],
      options: [],
      transactions: []
    };
    
    const context = buildStructuredContext(emptyData);
    const parsed = extractJSON(context);
    
    expect(parsed).not.toBeNull();
    if (parsed) {
      const json = parsed as Record<string, unknown>;
      expect((json.stock_positions as unknown[]).length).toBe(0);
      expect((json.option_positions as unknown[]).length).toBe(0);
      expect((json.recent_transactions as unknown[]).length).toBe(0);
    }
  });
});

// ============================================================================
// Property 8: Position Truncation with Summary
// ============================================================================

describe('Property 8: Position Truncation with Summary', () => {
  it('should truncate to top 20 when more than 20 positions', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryPosition(), { minLength: 21, maxLength: 100 }),
        (positions) => {
          const summary = fc.sample(arbitrarySummary(positions.length, 0), 1)[0];
          
          const data: PortfolioContext = {
            summary,
            positions,
            options: [],
            transactions: []
          };
          
          const context = buildStructuredContext(data);
          const parsed = extractJSON(context);
          
          expect(parsed).not.toBeNull();
          if (parsed) {
            const json = parsed as Record<string, unknown>;
            const stockPositions = json.stock_positions as Array<Record<string, unknown>>;
            
            // 1. 应该正好有 20 个持仓
            expect(stockPositions.length).toBe(20);
            
            // 2. 应该按市值降序排序
            for (let i = 1; i < stockPositions.length; i++) {
              const prev = stockPositions[i - 1].market_value_cny as number;
              const curr = stockPositions[i].market_value_cny as number;
              expect(prev).toBeGreaterThanOrEqual(curr);
            }
            
            // 3. 应该包含截断说明
            const truncatedCount = positions.length - 20;
            expect(context).toContain(`(${truncatedCount}) additional positions not shown`);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not truncate when 20 or fewer positions', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryPosition(), { minLength: 1, maxLength: 20 }),
        arbitrarySummary(20, 0), // 直接使用 arbitrary 而不是 fc.sample
        (positions, summaryTemplate) => {
          // 更新 summary 的 position count
          const summary = { ...summaryTemplate, total_positions: positions.length };
          
          const data: PortfolioContext = {
            summary,
            positions,
            options: [],
            transactions: []
          };
          
          const context = buildStructuredContext(data);
          const parsed = extractJSON(context);
          
          expect(parsed).not.toBeNull();
          if (parsed) {
            const json = parsed as Record<string, unknown>;
            const stockPositions = json.stock_positions as Array<Record<string, unknown>>;
            
            // 应该包含所有持仓
            expect(stockPositions.length).toBe(positions.length);
            
            // 不应该有截断说明
            expect(context).not.toContain('additional positions not shown');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include top positions by market value', () => {
    // 创建一组已知市值的持仓
    const positions: PositionDetail[] = Array.from({ length: 30 }, (_, i) => ({
      ticker: `STOCK${i}`,
      name: `Stock ${i}`,
      quantity: 100,
      current_price: { value: 100, currency: 'USD' as const },
      avg_cost: { value: 90, currency: 'USD' as const },
      market_value_cny: (30 - i) * 10000, // 市值从高到低
      weight_percent: 3,
      unrealized_pnl_percent: 10
    }));
    
    const data: PortfolioContext = {
      summary: {
        snapshot_date: '2024-12-27',
        total_net_worth_cny: 3000000,
        total_positions: 30,
        total_options: 0,
        cash_ratio_percent: 10,
        ytd_return_percent: 15
      },
      positions,
      options: [],
      transactions: []
    };
    
    const context = buildStructuredContext(data);
    const parsed = extractJSON(context);
    
    expect(parsed).not.toBeNull();
    if (parsed) {
      const json = parsed as Record<string, unknown>;
      const stockPositions = json.stock_positions as Array<Record<string, unknown>>;
      
      // 应该包含市值最高的 20 个（STOCK0 到 STOCK19）
      const tickers = stockPositions.map(p => p.ticker);
      for (let i = 0; i < 20; i++) {
        expect(tickers).toContain(`STOCK${i}`);
      }
      
      // 不应该包含市值较低的（STOCK20 到 STOCK29）
      for (let i = 20; i < 30; i++) {
        expect(tickers).not.toContain(`STOCK${i}`);
      }
    }
  });
});

// ============================================================================
// Property 11: Context Source Attribution
// ============================================================================

describe('Property 11: Context Source Attribution', () => {
  it('should clearly label structured data source', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryPosition(), { minLength: 1, maxLength: 10 }),
        (positions) => {
          const summary = fc.sample(arbitrarySummary(positions.length, 0), 1)[0];
          
          const structuredContext = buildStructuredContext({
            summary,
            positions,
            options: [],
            transactions: []
          });
          
          const merged = mergeContexts(structuredContext, null);
          
          // 应该包含结构化数据来源标签
          expect(merged).toContain('投资组合数据');
          expect(merged).toContain('📊');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should clearly label knowledge base source', () => {
    fc.assert(
      fc.property(
        arbitraryKnowledgeContext(),
        (knowledgeData) => {
          const knowledgeContext = buildKnowledgeContext(knowledgeData);
          const merged = mergeContexts(null, knowledgeContext);
          
          // 应该包含知识库来源标签
          expect(merged).toContain('相关知识库内容');
          expect(merged).toContain('📚');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include both sources when both provided', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryPosition(), { minLength: 1, maxLength: 5 }),
        arbitraryKnowledgeContext(),
        (positions, knowledgeData) => {
          const summary = fc.sample(arbitrarySummary(positions.length, 0), 1)[0];
          
          const structuredContext = buildStructuredContext({
            summary,
            positions,
            options: [],
            transactions: []
          });
          const knowledgeContext = buildKnowledgeContext(knowledgeData);
          
          const merged = mergeContexts(structuredContext, knowledgeContext);
          
          // 应该同时包含两个来源标签
          expect(merged).toContain('投资组合数据');
          expect(merged).toContain('相关知识库内容');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty contexts gracefully', () => {
    const merged = mergeContexts(null, null);
    expect(merged).toContain('暂无相关上下文数据');
  });
});

// ============================================================================
// Knowledge Context Tests
// ============================================================================

describe('buildKnowledgeContext', () => {
  it('should format entities correctly', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryEntity(), { minLength: 1, maxLength: 10 }),
        (entities) => {
          const context = buildKnowledgeContext({
            entities,
            relations: [],
            relevantContent: ''
          });
          
          // 每个实体名称应该出现在输出中
          entities.forEach(e => {
            expect(context).toContain(e.name);
          });
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should format relations correctly', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryRelation(), { minLength: 1, maxLength: 10 }),
        (relations) => {
          const context = buildKnowledgeContext({
            entities: [],
            relations,
            relevantContent: ''
          });
          
          // 每个关系应该以箭头格式出现
          relations.forEach(r => {
            expect(context).toContain(`${r.source} → ${r.relation} → ${r.target}`);
          });
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
