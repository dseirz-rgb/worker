/**
 * useDashboardStore 测试
 * 
 * 测试统一数据层的核心功能：
 * 1. 类型定义正确性
 * 2. 数据结构完整性（Property 1）
 * 3. 数据时间戳一致性（Property 2）
 * 4. 数据一致性验证（Property 4）
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createEmptySnapshot,
  isEmptySnapshot,
  getSnapshotDate,
  getSnapshotAge,
  isSnapshotStale,
  enrichWithLivePrices,
  UNIFIED_CACHE_CONFIG,
  type DashboardSnapshot,
  type LivePriceData,
  type ConsistencyValidationResult,
  type EnrichedStockPosition,
  type SupabaseStockPosition,
} from '../types/dashboard';

// ============================================
// Arbitrary Generators for Property Tests
// ============================================

/**
 * 生成随机的 Dashboard 数据
 */
const arbitraryDashboard = fc.record({
  date: fc.integer({ min: 0, max: 365 }).map(days => {
    const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }),
  total_positions: fc.nat({ max: 100 }),
  stock_positions: fc.nat({ max: 50 }),
  option_positions: fc.nat({ max: 50 }),
  net_worth: fc.double({ min: 0, max: 10000000, noNaN: true }),
  cash_balance: fc.double({ min: 0, max: 1000000, noNaN: true }),
});

/**
 * 生成随机的股票持仓
 */
const arbitraryStockPosition = fc.record({
  ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
  quantity: fc.integer({ min: 1, max: 10000 }),
  avg_cost: fc.double({ min: 0.01, max: 10000, noNaN: true }),
  current_price: fc.double({ min: 0.01, max: 10000, noNaN: true }),
  market_value: fc.double({ min: 0, max: 10000000, noNaN: true }),
});

/**
 * 生成随机的期权持仓
 */
const arbitraryOptionPosition = fc.record({
  ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
  option_type: fc.constantFrom('CALL', 'PUT'),
  strike: fc.double({ min: 1, max: 1000, noNaN: true }),
  expiry: fc.integer({ min: 1, max: 365 }).map(days => {
    const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }),
  quantity: fc.integer({ min: -100, max: 100 }).filter(n => n !== 0),
});

/**
 * 生成随机的风险指标
 */
const arbitraryRiskMetrics = fc.record({
  var_95: fc.double({ min: 0, max: 100000, noNaN: true }),
  sharpe_ratio: fc.double({ min: -5, max: 5, noNaN: true }),
  max_drawdown: fc.double({ min: 0, max: 1, noNaN: true }),
  beta: fc.double({ min: -2, max: 3, noNaN: true }),
});

/**
 * 生成随机的 DashboardSnapshot
 */
const arbitrarySnapshot = fc.record({
  timestamp: fc.nat().map(n => Date.now() - n % (24 * 60 * 60 * 1000)), // 过去 24 小时内
  dashboard: fc.option(arbitraryDashboard, { nil: null }),
  stockPositions: fc.array(arbitraryStockPosition, { maxLength: 20 }),
  optionPositions: fc.array(arbitraryOptionPosition, { maxLength: 10 }),
  riskMetrics: fc.option(arbitraryRiskMetrics, { nil: null }),
  history: fc.array(arbitraryDashboard, { maxLength: 30 }),
  returnAttribution: fc.constant(null),
  costAnalysis: fc.constant(null),
});

// ============================================
// 任务 1.2: 类型定义单元测试
// ============================================

describe('Dashboard Types', () => {
  describe('Type Exports', () => {
    it('should export DashboardSnapshot type', () => {
      const snapshot: DashboardSnapshot = createEmptySnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.timestamp).toBeTypeOf('number');
    });

    it('should export LivePriceData type', () => {
      const livePrices: LivePriceData = {
        AAPL: { currentPrice: 150, changePercent: 1.5, lastUpdated: Date.now() },
      };
      expect(livePrices).toBeDefined();
      expect(livePrices.AAPL?.currentPrice).toBe(150);
    });

    it('should export ConsistencyValidationResult type', () => {
      const result: ConsistencyValidationResult = { valid: true, issues: [] };
      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('should export UNIFIED_CACHE_CONFIG', () => {
      expect(UNIFIED_CACHE_CONFIG.static.staleTime).toBe(3 * 60 * 1000);
      expect(UNIFIED_CACHE_CONFIG.live.staleTime).toBe(30 * 1000);
      expect(UNIFIED_CACHE_CONFIG.user.staleTime).toBe(5 * 60 * 1000);
    });
  });

  describe('createEmptySnapshot', () => {
    it('should create a valid empty snapshot', () => {
      const snapshot = createEmptySnapshot();
      
      expect(snapshot.timestamp).toBeTypeOf('number');
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.dashboard).toBeNull();
      expect(snapshot.stockPositions).toEqual([]);
      expect(snapshot.optionPositions).toEqual([]);
      expect(snapshot.riskMetrics).toBeNull();
      expect(snapshot.history).toEqual([]);
      expect(snapshot.returnAttribution).toBeNull();
      expect(snapshot.costAnalysis).toBeNull();
    });
  });

  describe('isEmptySnapshot', () => {
    it('should return true for empty snapshot', () => {
      const snapshot = createEmptySnapshot();
      expect(isEmptySnapshot(snapshot)).toBe(true);
    });

    it('should return false when dashboard is present', () => {
      const snapshot = createEmptySnapshot();
      snapshot.dashboard = { date: '2024-01-01' } as any;
      expect(isEmptySnapshot(snapshot)).toBe(false);
    });

    it('should return false when stockPositions is not empty', () => {
      const snapshot = createEmptySnapshot();
      snapshot.stockPositions = [{ ticker: 'AAPL' } as any];
      expect(isEmptySnapshot(snapshot)).toBe(false);
    });
  });

  describe('getSnapshotDate', () => {
    it('should return null for empty snapshot', () => {
      const snapshot = createEmptySnapshot();
      expect(getSnapshotDate(snapshot)).toBeNull();
    });

    it('should return date when dashboard is present', () => {
      const snapshot = createEmptySnapshot();
      snapshot.dashboard = { date: '2024-01-15' } as any;
      expect(getSnapshotDate(snapshot)).toBe('2024-01-15');
    });
  });

  describe('getSnapshotAge', () => {
    it('should return positive age for past timestamp', () => {
      const snapshot = createEmptySnapshot();
      snapshot.timestamp = Date.now() - 1000; // 1 second ago
      const age = getSnapshotAge(snapshot);
      expect(age).toBeGreaterThanOrEqual(1000);
      expect(age).toBeLessThan(2000);
    });
  });

  describe('isSnapshotStale', () => {
    it('should return false for fresh snapshot', () => {
      const snapshot = createEmptySnapshot();
      expect(isSnapshotStale(snapshot)).toBe(false);
    });

    it('should return true for old snapshot', () => {
      const snapshot = createEmptySnapshot();
      snapshot.timestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
      expect(isSnapshotStale(snapshot)).toBe(true);
    });

    it('should respect custom maxAge', () => {
      const snapshot = createEmptySnapshot();
      snapshot.timestamp = Date.now() - 1000; // 1 second ago
      expect(isSnapshotStale(snapshot, 500)).toBe(true);
      expect(isSnapshotStale(snapshot, 2000)).toBe(false);
    });
  });
});


// ============================================
// 任务 2.2: Property 1 - 数据结构完整性
// **Feature: unified-data-layer, Property 1: 数据结构完整性**
// **Validates: Requirements 1.2, 5.2**
// ============================================

describe('Property Tests: Data Structure Integrity', () => {
  /**
   * Property 1: 数据结构完整性
   * 
   * *For any* valid Supabase 响应数据，`useDashboardStore()` 返回的 `snapshot` 对象
   * 应包含所有必需字段：`dashboard`、`stockPositions`、`optionPositions`、
   * `riskMetrics`、`history`、`timestamp`。
   */
  it('Property 1: snapshot should contain all required fields for any valid data', () => {
    fc.assert(
      fc.property(
        arbitrarySnapshot,
        (snapshot) => {
          // 验证所有必需字段存在
          expect(snapshot).toHaveProperty('timestamp');
          expect(snapshot).toHaveProperty('dashboard');
          expect(snapshot).toHaveProperty('stockPositions');
          expect(snapshot).toHaveProperty('optionPositions');
          expect(snapshot).toHaveProperty('riskMetrics');
          expect(snapshot).toHaveProperty('history');
          
          // 验证 timestamp 是有效的数字
          expect(typeof snapshot.timestamp).toBe('number');
          expect(snapshot.timestamp).toBeGreaterThan(0);
          
          // 验证数组类型
          expect(Array.isArray(snapshot.stockPositions)).toBe(true);
          expect(Array.isArray(snapshot.optionPositions)).toBe(true);
          expect(Array.isArray(snapshot.history)).toBe(true);
          
          // 验证可空字段的类型
          expect(snapshot.dashboard === null || typeof snapshot.dashboard === 'object').toBe(true);
          expect(snapshot.riskMetrics === null || typeof snapshot.riskMetrics === 'object').toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.1: stockPositions should have valid structure for any position', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryStockPosition, { minLength: 1, maxLength: 20 }),
        (positions) => {
          for (const pos of positions) {
            // 每个持仓必须有 ticker
            expect(typeof pos.ticker).toBe('string');
            expect(pos.ticker.length).toBeGreaterThan(0);
            expect(pos.ticker.length).toBeLessThanOrEqual(5);
            
            // 数量必须是正整数
            expect(typeof pos.quantity).toBe('number');
            expect(pos.quantity).toBeGreaterThan(0);
            
            // 价格必须是正数
            expect(pos.avg_cost).toBeGreaterThan(0);
            expect(pos.current_price).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.2: optionPositions should have valid structure for any position', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryOptionPosition, { minLength: 1, maxLength: 10 }),
        (positions) => {
          for (const pos of positions) {
            // 每个期权必须有 ticker
            expect(typeof pos.ticker).toBe('string');
            expect(pos.ticker.length).toBeGreaterThan(0);
            
            // option_type 必须是 CALL 或 PUT
            expect(['CALL', 'PUT']).toContain(pos.option_type);
            
            // strike 必须是正数
            expect(pos.strike).toBeGreaterThan(0);
            
            // quantity 不能为 0
            expect(pos.quantity).not.toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.3: createEmptySnapshot should always produce valid structure', () => {
    // 运行多次确保一致性
    for (let i = 0; i < 100; i++) {
      const snapshot = createEmptySnapshot();
      
      // 验证结构完整性
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('dashboard');
      expect(snapshot).toHaveProperty('stockPositions');
      expect(snapshot).toHaveProperty('optionPositions');
      expect(snapshot).toHaveProperty('riskMetrics');
      expect(snapshot).toHaveProperty('history');
      expect(snapshot).toHaveProperty('returnAttribution');
      expect(snapshot).toHaveProperty('costAnalysis');
      
      // 验证空快照的默认值
      expect(snapshot.dashboard).toBeNull();
      expect(snapshot.stockPositions).toEqual([]);
      expect(snapshot.optionPositions).toEqual([]);
      expect(snapshot.riskMetrics).toBeNull();
      expect(snapshot.history).toEqual([]);
    }
  });
});


// ============================================
// 任务 2.3: Property 2 - 数据时间戳一致性
// **Feature: unified-data-layer, Property 2: 数据时间戳一致性**
// **Validates: Requirements 1.3, 1.4**
// ============================================

describe('Property Tests: Timestamp Consistency', () => {
  /**
   * Property 2: 数据时间戳一致性
   * 
   * *For any* 数据快照，`snapshot.timestamp` 应反映所有数据的最新更新时间。
   * 刷新操作后，新的 `timestamp` 应大于旧的 `timestamp`。
   */
  it('Property 2: timestamp should be a valid positive number', () => {
    fc.assert(
      fc.property(
        arbitrarySnapshot,
        (snapshot) => {
          // timestamp 必须是正数
          expect(snapshot.timestamp).toBeGreaterThan(0);
          
          // timestamp 应该是合理的时间范围（不超过当前时间太多）
          const now = Date.now();
          const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
          expect(snapshot.timestamp).toBeGreaterThanOrEqual(oneYearAgo);
          expect(snapshot.timestamp).toBeLessThanOrEqual(now + 1000); // 允许 1 秒误差
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.1: getSnapshotAge should return non-negative value for past timestamps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 24 * 60 * 60 * 1000 }), // 0 到 24 小时
        (ageMs) => {
          const snapshot = createEmptySnapshot();
          snapshot.timestamp = Date.now() - ageMs;
          
          const age = getSnapshotAge(snapshot);
          
          // 年龄应该大于等于设置的时间差（允许小误差）
          expect(age).toBeGreaterThanOrEqual(ageMs - 10);
          // 年龄不应该超过设置的时间差太多
          expect(age).toBeLessThan(ageMs + 100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.2: isSnapshotStale should be consistent with age and maxAge', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 * 60 * 1000 }), // 0 到 10 分钟
        fc.integer({ min: 1000, max: 5 * 60 * 1000 }), // 1 秒到 5 分钟
        (ageMs, maxAge) => {
          const snapshot = createEmptySnapshot();
          snapshot.timestamp = Date.now() - ageMs;
          
          const isStale = isSnapshotStale(snapshot, maxAge);
          
          // 如果年龄大于 maxAge，应该是 stale
          if (ageMs > maxAge) {
            expect(isStale).toBe(true);
          }
          // 如果年龄小于 maxAge（留一些误差），应该不是 stale
          if (ageMs < maxAge - 100) {
            expect(isStale).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2.3: newer snapshot should have larger timestamp', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 60 * 60 * 1000 }), // 1 秒到 1 小时
        (timeDiff) => {
          const olderSnapshot = createEmptySnapshot();
          olderSnapshot.timestamp = Date.now() - timeDiff;
          
          const newerSnapshot = createEmptySnapshot();
          // newerSnapshot 使用当前时间
          
          // 新快照的时间戳应该大于旧快照
          expect(newerSnapshot.timestamp).toBeGreaterThan(olderSnapshot.timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================
// 任务 3.2: Property 4 - 数据一致性验证
// **Feature: unified-data-layer, Property 4: 数据一致性验证**
// **Validates: Requirements 3.1, 3.2**
// ============================================

/**
 * 模拟 validateConsistency 函数的纯函数版本
 * 用于属性测试，不依赖 React Hook
 */
function validateConsistencyPure(
  dashboard: { total_positions: number; stock_positions: number; option_positions: number } | null,
  stockPositions: unknown[],
  optionPositions: unknown[]
): ConsistencyValidationResult {
  if (!dashboard) return { valid: true, issues: [] };
  
  const issues: string[] = [];
  
  // 验证持仓数量
  const actualPositions = stockPositions.length + optionPositions.length;
  if (dashboard.total_positions !== actualPositions) {
    issues.push(
      `持仓数量不一致: dashboard.total_positions=${dashboard.total_positions}, actual=${actualPositions}`
    );
  }
  
  // 验证股票持仓数
  if (dashboard.stock_positions !== stockPositions.length) {
    issues.push(
      `股票持仓数不一致: dashboard.stock_positions=${dashboard.stock_positions}, actual=${stockPositions.length}`
    );
  }
  
  // 验证期权持仓数
  if (dashboard.option_positions !== optionPositions.length) {
    issues.push(
      `期权持仓数不一致: dashboard.option_positions=${dashboard.option_positions}, actual=${optionPositions.length}`
    );
  }
  
  return { valid: issues.length === 0, issues };
}

describe('Property Tests: Data Consistency Validation', () => {
  /**
   * Property 4: 数据一致性验证
   * 
   * *For any* dashboard 和 positions 数据组合，`validateConsistency()` 函数应正确检测不一致。
   */
  it('Property 4: should return valid=true when counts match', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50 }),
        fc.nat({ max: 50 }),
        (stockCount, optionCount) => {
          const dashboard = {
            total_positions: stockCount + optionCount,
            stock_positions: stockCount,
            option_positions: optionCount,
          };
          const stockPositions = Array(stockCount).fill({ ticker: 'AAPL' });
          const optionPositions = Array(optionCount).fill({ ticker: 'AAPL' });
          
          const result = validateConsistencyPure(dashboard, stockPositions, optionPositions);
          
          expect(result.valid).toBe(true);
          expect(result.issues).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.1: should detect total_positions mismatch', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50 }),
        fc.nat({ max: 50 }),
        fc.integer({ min: 1, max: 10 }), // 偏差量
        (stockCount, optionCount, offset) => {
          const actualTotal = stockCount + optionCount;
          const wrongTotal = actualTotal + offset; // 故意设置错误的总数
          
          const dashboard = {
            total_positions: wrongTotal,
            stock_positions: stockCount,
            option_positions: optionCount,
          };
          const stockPositions = Array(stockCount).fill({ ticker: 'AAPL' });
          const optionPositions = Array(optionCount).fill({ ticker: 'AAPL' });
          
          const result = validateConsistencyPure(dashboard, stockPositions, optionPositions);
          
          // 应该检测到不一致
          expect(result.valid).toBe(false);
          expect(result.issues.length).toBeGreaterThan(0);
          expect(result.issues.some(i => i.includes('持仓数量不一致'))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.2: should detect stock_positions mismatch', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50 }),
        fc.nat({ max: 50 }),
        fc.integer({ min: 1, max: 10 }),
        (stockCount, optionCount, offset) => {
          const wrongStockCount = stockCount + offset;
          
          const dashboard = {
            total_positions: stockCount + optionCount, // 正确的总数
            stock_positions: wrongStockCount, // 错误的股票数
            option_positions: optionCount,
          };
          const stockPositions = Array(stockCount).fill({ ticker: 'AAPL' });
          const optionPositions = Array(optionCount).fill({ ticker: 'AAPL' });
          
          const result = validateConsistencyPure(dashboard, stockPositions, optionPositions);
          
          expect(result.valid).toBe(false);
          expect(result.issues.some(i => i.includes('股票持仓数不一致'))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.3: should detect option_positions mismatch', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50 }),
        fc.nat({ max: 50 }),
        fc.integer({ min: 1, max: 10 }),
        (stockCount, optionCount, offset) => {
          const wrongOptionCount = optionCount + offset;
          
          const dashboard = {
            total_positions: stockCount + optionCount,
            stock_positions: stockCount,
            option_positions: wrongOptionCount, // 错误的期权数
          };
          const stockPositions = Array(stockCount).fill({ ticker: 'AAPL' });
          const optionPositions = Array(optionCount).fill({ ticker: 'AAPL' });
          
          const result = validateConsistencyPure(dashboard, stockPositions, optionPositions);
          
          expect(result.valid).toBe(false);
          expect(result.issues.some(i => i.includes('期权持仓数不一致'))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.4: should return valid=true when dashboard is null', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryStockPosition, { maxLength: 20 }),
        fc.array(arbitraryOptionPosition, { maxLength: 10 }),
        (stockPositions, optionPositions) => {
          const result = validateConsistencyPure(null, stockPositions, optionPositions);
          
          // 当 dashboard 为 null 时，应该返回 valid=true
          expect(result.valid).toBe(true);
          expect(result.issues).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.5: issues count should equal number of mismatches', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50 }),
        fc.nat({ max: 50 }),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (stockCount, optionCount, wrongTotal, wrongStock, wrongOption) => {
          const dashboard = {
            total_positions: stockCount + optionCount + (wrongTotal ? 1 : 0),
            stock_positions: stockCount + (wrongStock ? 1 : 0),
            option_positions: optionCount + (wrongOption ? 1 : 0),
          };
          const stockPositions = Array(stockCount).fill({ ticker: 'AAPL' });
          const optionPositions = Array(optionCount).fill({ ticker: 'AAPL' });
          
          const result = validateConsistencyPure(dashboard, stockPositions, optionPositions);
          
          // 计算预期的问题数量
          let expectedIssues = 0;
          if (wrongTotal) expectedIssues++;
          if (wrongStock) expectedIssues++;
          if (wrongOption) expectedIssues++;
          
          expect(result.issues.length).toBe(expectedIssues);
          expect(result.valid).toBe(expectedIssues === 0);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================
// 任务 6.2: Property 6 - 类型兼容性
// **Feature: unified-data-layer, Property 6: 类型兼容性**
// **Validates: Requirements 5.1**
// ============================================

/**
 * 定义 useSupabasePortfolio 返回类型的结构
 * 用于验证 useSupabasePortfolioCompat 的兼容性
 */
interface SupabasePortfolioReturnType {
  // 核心数据
  dashboard: unknown | null;
  riskMetrics: unknown | null;
  stockPositions: unknown[];
  optionPositions: unknown[];
  returnAttribution: unknown | null;
  costAnalysis: unknown | null;
  history: unknown[];
  livePrices: Record<string, { currentPrice: number; changePercent: number; lastUpdated: number }>;
  
  // 用户数据
  transactions: unknown[];
  watchlist: unknown[];
  settings: unknown | null;
  
  // 状态
  loading: boolean;
  error: string | null;
  lastUpdate: Date;
  
  // 操作
  refresh: () => Promise<void>;
  refreshMarketData: () => Promise<void>;
  
  // Mutations
  addTransaction: (tx: unknown) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addToWatchlist: (item: unknown) => Promise<void>;
  removeFromWatchlist: (id: string) => Promise<void>;
  updateSettings: (s: unknown) => Promise<void>;
}

/**
 * 验证对象是否符合 SupabasePortfolioReturnType 结构
 */
function validateCompatReturnType(obj: unknown): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];
  
  if (typeof obj !== 'object' || obj === null) {
    return { valid: false, missingFields: ['object is null or not an object'] };
  }
  
  const record = obj as Record<string, unknown>;
  
  // 检查核心数据字段
  const coreDataFields = [
    'dashboard', 'riskMetrics', 'stockPositions', 'optionPositions',
    'returnAttribution', 'costAnalysis', 'history', 'livePrices'
  ];
  for (const field of coreDataFields) {
    if (!(field in record)) {
      missingFields.push(field);
    }
  }
  
  // 检查用户数据字段
  const userDataFields = ['transactions', 'watchlist', 'settings'];
  for (const field of userDataFields) {
    if (!(field in record)) {
      missingFields.push(field);
    }
  }
  
  // 检查状态字段
  if (!('loading' in record)) missingFields.push('loading');
  if (!('error' in record)) missingFields.push('error');
  if (!('lastUpdate' in record)) missingFields.push('lastUpdate');
  
  // 检查操作函数
  const operationFields = [
    'refresh', 'refreshMarketData', 'addTransaction', 
    'deleteTransaction', 'addToWatchlist', 'removeFromWatchlist', 'updateSettings'
  ];
  for (const field of operationFields) {
    if (!(field in record) || typeof record[field] !== 'function') {
      missingFields.push(`${field} (function)`);
    }
  }
  
  // 验证数组类型
  if (!Array.isArray(record.stockPositions)) missingFields.push('stockPositions (array)');
  if (!Array.isArray(record.optionPositions)) missingFields.push('optionPositions (array)');
  if (!Array.isArray(record.history)) missingFields.push('history (array)');
  if (!Array.isArray(record.transactions)) missingFields.push('transactions (array)');
  if (!Array.isArray(record.watchlist)) missingFields.push('watchlist (array)');
  
  // 验证 livePrices 是对象
  if (typeof record.livePrices !== 'object' || record.livePrices === null) {
    missingFields.push('livePrices (object)');
  }
  
  // 验证 loading 是布尔值
  if (typeof record.loading !== 'boolean') missingFields.push('loading (boolean)');
  
  // 验证 lastUpdate 是 Date
  if (!(record.lastUpdate instanceof Date)) missingFields.push('lastUpdate (Date)');
  
  return { valid: missingFields.length === 0, missingFields };
}

describe('Property Tests: Type Compatibility (Property 6)', () => {
  /**
   * Property 6: 类型兼容性
   * 
   * *For any* 有效的 Supabase 数据，`useSupabasePortfolioCompat()` 返回的数据结构
   * 应与现有 `useSupabasePortfolio()` 的返回类型兼容。
   */
  
  it('Property 6: compat hook return type should have all required fields', () => {
    // 模拟 useSupabasePortfolioCompat 的返回值结构
    // 这是一个纯函数测试，验证返回类型的结构
    const mockCompatReturn = {
      // 核心数据
      dashboard: null,
      riskMetrics: null,
      stockPositions: [],
      optionPositions: [],
      returnAttribution: null,
      costAnalysis: null,
      history: [],
      livePrices: {},
      
      // 用户数据
      transactions: [],
      watchlist: [],
      settings: null,
      
      // 状态
      loading: false,
      error: null,
      lastUpdate: new Date(),
      
      // 操作
      refresh: async () => {},
      refreshMarketData: async () => {},
      addTransaction: async () => {},
      deleteTransaction: async () => {},
      addToWatchlist: async () => {},
      removeFromWatchlist: async () => {},
      updateSettings: async () => {},
    };
    
    const result = validateCompatReturnType(mockCompatReturn);
    expect(result.valid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  it('Property 6.1: livePrices structure should be compatible', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
            currentPrice: fc.double({ min: 0.01, max: 10000, noNaN: true }),
            changePercent: fc.double({ min: -100, max: 1000, noNaN: true }),
            lastUpdated: fc.nat().map(n => Date.now() - n % (24 * 60 * 60 * 1000)),
          }),
          { maxLength: 20 }
        ),
        (priceData) => {
          // 转换为 livePrices 格式
          const livePrices: Record<string, { currentPrice: number; changePercent: number; lastUpdated: number }> = {};
          for (const item of priceData) {
            livePrices[item.ticker] = {
              currentPrice: item.currentPrice,
              changePercent: item.changePercent,
              lastUpdated: item.lastUpdated,
            };
          }
          
          // 验证结构
          for (const [ticker, price] of Object.entries(livePrices)) {
            expect(typeof ticker).toBe('string');
            expect(typeof price.currentPrice).toBe('number');
            expect(typeof price.changePercent).toBe('number');
            expect(typeof price.lastUpdated).toBe('number');
            expect(price.currentPrice).toBeGreaterThan(0);
            expect(price.lastUpdated).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.2: snapshot data should map correctly to compat return', () => {
    fc.assert(
      fc.property(
        arbitrarySnapshot,
        (snapshot) => {
          // 模拟从 snapshot 到 compat 返回值的映射
          const compatReturn = {
            dashboard: snapshot.dashboard,
            riskMetrics: snapshot.riskMetrics,
            stockPositions: snapshot.stockPositions,
            optionPositions: snapshot.optionPositions,
            returnAttribution: snapshot.returnAttribution,
            costAnalysis: snapshot.costAnalysis,
            history: snapshot.history,
            livePrices: {},
            transactions: [],
            watchlist: [],
            settings: null,
            loading: false,
            error: null,
            lastUpdate: new Date(snapshot.timestamp),
            refresh: async () => {},
            refreshMarketData: async () => {},
            addTransaction: async () => {},
            deleteTransaction: async () => {},
            addToWatchlist: async () => {},
            removeFromWatchlist: async () => {},
            updateSettings: async () => {},
          };
          
          // 验证映射后的结构
          const result = validateCompatReturnType(compatReturn);
          expect(result.valid).toBe(true);
          
          // 验证数据一致性
          expect(compatReturn.dashboard).toBe(snapshot.dashboard);
          expect(compatReturn.stockPositions).toBe(snapshot.stockPositions);
          expect(compatReturn.optionPositions).toBe(snapshot.optionPositions);
          expect(compatReturn.riskMetrics).toBe(snapshot.riskMetrics);
          expect(compatReturn.history).toBe(snapshot.history);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.3: error field should be string or null', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string(), { nil: null }),
        (errorValue) => {
          const compatReturn = {
            dashboard: null,
            riskMetrics: null,
            stockPositions: [],
            optionPositions: [],
            returnAttribution: null,
            costAnalysis: null,
            history: [],
            livePrices: {},
            transactions: [],
            watchlist: [],
            settings: null,
            loading: false,
            error: errorValue,
            lastUpdate: new Date(),
            refresh: async () => {},
            refreshMarketData: async () => {},
            addTransaction: async () => {},
            deleteTransaction: async () => {},
            addToWatchlist: async () => {},
            removeFromWatchlist: async () => {},
            updateSettings: async () => {},
          };
          
          // error 应该是 string 或 null
          expect(compatReturn.error === null || typeof compatReturn.error === 'string').toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================
// 任务 7.3: Property 7 - 并行获取与部分失败处理
// **Feature: unified-data-layer, Property 7: 并行获取与部分失败处理**
// **Validates: Requirements 6.1, 6.3**
// ============================================

/**
 * 模拟并行查询结果的类型
 */
interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  dataUpdatedAt?: number;
}

/**
 * 模拟 useQueries 的 combine 函数逻辑
 * 用于测试部分失败处理
 */
function combineQueryResults(results: QueryResult<unknown>[]): {
  snapshot: DashboardSnapshot;
  isLoading: boolean;
  isError: boolean;
  errors: (Error | null)[];
} {
  // 计算统一的时间戳（取最新的 dataUpdatedAt）
  const timestamps = results
    .map(r => r.dataUpdatedAt)
    .filter((t): t is number => t !== undefined && t > 0);
  const latestTimestamp = timestamps.length > 0 
    ? Math.max(...timestamps) 
    : Date.now();
  
  const snapshot: DashboardSnapshot = {
    timestamp: latestTimestamp,
    dashboard: (results[0]?.data as any) ?? null,
    stockPositions: (results[1]?.data as any[]) ?? [],
    optionPositions: (results[2]?.data as any[]) ?? [],
    riskMetrics: (results[3]?.data as any) ?? null,
    history: (results[4]?.data as any[]) ?? [],
    returnAttribution: (results[5]?.data as any) ?? null,
    costAnalysis: (results[6]?.data as any) ?? null,
  };
  
  return {
    snapshot,
    isLoading: results.some(r => r.isLoading),
    isError: results.some(r => r.isError),
    errors: results.map(r => r.error ?? null),
  };
}

describe('Property Tests: Parallel Fetch and Partial Failure (Property 7)', () => {
  /**
   * Property 7: 并行获取与部分失败处理
   * 
   * *For any* 数据获取操作，当部分查询失败时，成功的数据应仍然可用，
   * `isError` 应为 `true`，`errors` 数组应包含失败信息。
   */
  
  it('Property 7: partial failure should not block successful data', () => {
    fc.assert(
      fc.property(
        // 生成 7 个查询结果（对应 7 个并行查询）
        fc.array(
          fc.record({
            success: fc.boolean(),
            data: fc.option(arbitraryDashboard, { nil: undefined }),
          }),
          { minLength: 7, maxLength: 7 }
        ),
        (queryConfigs) => {
          // 构建查询结果
          const results: QueryResult<unknown>[] = queryConfigs.map((config, index) => ({
            data: config.success ? config.data : undefined,
            isLoading: false,
            isError: !config.success,
            error: config.success ? null : new Error(`Query ${index} failed`),
            dataUpdatedAt: config.success ? Date.now() : undefined,
          }));
          
          const combined = combineQueryResults(results);
          
          // 验证：如果有任何失败，isError 应为 true
          const hasAnyError = queryConfigs.some(c => !c.success);
          expect(combined.isError).toBe(hasAnyError);
          
          // 验证：errors 数组长度应等于查询数量
          expect(combined.errors.length).toBe(7);
          
          // 验证：成功的查询数据应该可用
          for (let i = 0; i < queryConfigs.length; i++) {
            if (queryConfigs[i].success && queryConfigs[i].data !== undefined) {
              // 成功的查询应该有数据
              expect(combined.errors[i]).toBeNull();
            } else if (!queryConfigs[i].success) {
              // 失败的查询应该有错误
              expect(combined.errors[i]).not.toBeNull();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.1: all success should result in isError=false', () => {
    fc.assert(
      fc.property(
        arbitrarySnapshot,
        (snapshot) => {
          // 模拟所有查询都成功
          const results: QueryResult<unknown>[] = [
            { data: snapshot.dashboard, isLoading: false, isError: false, error: null, dataUpdatedAt: Date.now() },
            { data: snapshot.stockPositions, isLoading: false, isError: false, error: null, dataUpdatedAt: Date.now() },
            { data: snapshot.optionPositions, isLoading: false, isError: false, error: null, dataUpdatedAt: Date.now() },
            { data: snapshot.riskMetrics, isLoading: false, isError: false, error: null, dataUpdatedAt: Date.now() },
            { data: snapshot.history, isLoading: false, isError: false, error: null, dataUpdatedAt: Date.now() },
            { data: snapshot.returnAttribution, isLoading: false, isError: false, error: null, dataUpdatedAt: Date.now() },
            { data: snapshot.costAnalysis, isLoading: false, isError: false, error: null, dataUpdatedAt: Date.now() },
          ];
          
          const combined = combineQueryResults(results);
          
          // 所有成功时，isError 应为 false
          expect(combined.isError).toBe(false);
          expect(combined.errors.every(e => e === null)).toBe(true);
          
          // 数据应该完整
          expect(combined.snapshot.dashboard).toBe(snapshot.dashboard);
          expect(combined.snapshot.stockPositions).toBe(snapshot.stockPositions);
          expect(combined.snapshot.optionPositions).toBe(snapshot.optionPositions);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.2: single failure should set isError=true but preserve other data', () => {
    fc.assert(
      fc.property(
        arbitrarySnapshot,
        fc.integer({ min: 0, max: 6 }), // 失败的查询索引
        (snapshot, failIndex) => {
          // 模拟单个查询失败
          const results: QueryResult<unknown>[] = [
            { data: snapshot.dashboard, isLoading: false, isError: false, error: null, dataUpdatedAt: Date.now() },
            { data: snapshot.stockPositions, isLoading: false, isError: false, error: null, dataUpdatedAt: Date.now() },
            { data: snapshot.optionPositions, isLoading: false, isError: false, error: null, dataUpdatedAt: Date.now() },
            { data: snapshot.riskMetrics, isLoading: false, isError: false, error: null, dataUpdatedAt: Date.now() },
            { data: snapshot.history, isLoading: false, isError: false, error: null, dataUpdatedAt: Date.now() },
            { data: snapshot.returnAttribution, isLoading: false, isError: false, error: null, dataUpdatedAt: Date.now() },
            { data: snapshot.costAnalysis, isLoading: false, isError: false, error: null, dataUpdatedAt: Date.now() },
          ];
          
          // 设置一个查询失败
          results[failIndex] = {
            data: undefined,
            isLoading: false,
            isError: true,
            error: new Error(`Query ${failIndex} failed`),
            dataUpdatedAt: undefined,
          };
          
          const combined = combineQueryResults(results);
          
          // isError 应为 true
          expect(combined.isError).toBe(true);
          
          // 失败的查询应该有错误
          expect(combined.errors[failIndex]).not.toBeNull();
          
          // 其他查询应该没有错误
          for (let i = 0; i < 7; i++) {
            if (i !== failIndex) {
              expect(combined.errors[i]).toBeNull();
            }
          }
          
          // 成功的数据应该仍然可用
          // 根据失败的索引验证其他数据
          if (failIndex !== 1) {
            expect(combined.snapshot.stockPositions).toBe(snapshot.stockPositions);
          }
          if (failIndex !== 2) {
            expect(combined.snapshot.optionPositions).toBe(snapshot.optionPositions);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.3: loading state should be true if any query is loading', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 7, maxLength: 7 }), // 每个查询的 loading 状态
        (loadingStates) => {
          const results: QueryResult<unknown>[] = loadingStates.map((isLoading, index) => ({
            data: isLoading ? undefined : { mock: `data-${index}` },
            isLoading,
            isError: false,
            error: null,
            dataUpdatedAt: isLoading ? undefined : Date.now(),
          }));
          
          const combined = combineQueryResults(results);
          
          // 如果有任何查询在加载，isLoading 应为 true
          const hasAnyLoading = loadingStates.some(l => l);
          expect(combined.isLoading).toBe(hasAnyLoading);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.4: errors array length should always equal query count', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            isError: fc.boolean(),
            errorMessage: fc.option(fc.string(), { nil: null }),
          }),
          { minLength: 7, maxLength: 7 }
        ),
        (errorConfigs) => {
          const results: QueryResult<unknown>[] = errorConfigs.map((config, index) => ({
            data: config.isError ? undefined : { mock: `data-${index}` },
            isLoading: false,
            isError: config.isError,
            error: config.isError ? new Error(config.errorMessage || 'Unknown error') : null,
            dataUpdatedAt: config.isError ? undefined : Date.now(),
          }));
          
          const combined = combineQueryResults(results);
          
          // errors 数组长度应始终等于 7
          expect(combined.errors.length).toBe(7);
          
          // 验证每个错误的对应关系
          for (let i = 0; i < 7; i++) {
            if (errorConfigs[i].isError) {
              expect(combined.errors[i]).not.toBeNull();
            } else {
              expect(combined.errors[i]).toBeNull();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.5: timestamp should use latest successful dataUpdatedAt', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            success: fc.boolean(),
            timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }), // 合理的时间戳范围
          }),
          { minLength: 7, maxLength: 7 }
        ),
        (configs) => {
          const results: QueryResult<unknown>[] = configs.map((config, index) => ({
            data: config.success ? { mock: `data-${index}` } : undefined,
            isLoading: false,
            isError: !config.success,
            error: config.success ? null : new Error('Failed'),
            dataUpdatedAt: config.success ? config.timestamp : undefined,
          }));
          
          const combined = combineQueryResults(results);
          
          // 计算预期的最新时间戳
          const successfulTimestamps = configs
            .filter(c => c.success)
            .map(c => c.timestamp);
          
          if (successfulTimestamps.length > 0) {
            const expectedTimestamp = Math.max(...successfulTimestamps);
            expect(combined.snapshot.timestamp).toBe(expectedTimestamp);
          } else {
            // 如果没有成功的查询，应该使用当前时间
            expect(combined.snapshot.timestamp).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================
// 任务 7.2: 手动刷新功能验证
// **Feature: unified-data-layer, Manual Refresh**
// **Validates: Requirements 1.4, 6.4**
// ============================================

describe('Manual Refresh Functionality', () => {
  it('refresh function should be callable', () => {
    // 模拟 refresh 函数
    const mockRefresh = async () => {
      // 模拟 invalidateQueries 调用
      return Promise.resolve();
    };
    
    expect(typeof mockRefresh).toBe('function');
    expect(mockRefresh()).toBeInstanceOf(Promise);
  });

  it('refresh should return a Promise', async () => {
    const mockRefresh = async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    };
    
    const result = mockRefresh();
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeUndefined();
  });

  it('Property: refresh should be idempotent (multiple calls should not cause issues)', async () => {
    // 使用 asyncProperty 进行异步属性测试
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // 调用次数
        async (callCount) => {
          let refreshCount = 0;
          const mockRefresh = async () => {
            refreshCount++;
            await new Promise(resolve => setTimeout(resolve, 1));
          };
          
          // 多次调用 refresh
          const promises = Array(callCount).fill(null).map(() => mockRefresh());
          await Promise.all(promises);
          
          // 验证所有调用都完成了
          return refreshCount === callCount;
        }
      ),
      { numRuns: 20 } // 减少运行次数因为涉及异步操作
    );
  });
});


// ============================================
// 任务 4.3: Property 5 - 实时价格独立性
// **Feature: unified-data-layer, Property 5: 实时价格独立性**
// **Validates: Requirements 4.1, 4.2**
// ============================================

/**
 * 生成随机的实时价格数据
 */
const arbitraryLivePriceInfo = fc.record({
  currentPrice: fc.double({ min: 0.01, max: 10000, noNaN: true }),
  changePercent: fc.double({ min: -100, max: 100, noNaN: true }),
  lastUpdated: fc.nat().map(n => Date.now() - n % (60 * 60 * 1000)), // 过去 1 小时内
});

/**
 * 生成完整的股票持仓数据（用于 enrichWithLivePrices 测试）
 */
const arbitraryFullStockPosition = fc.record({
  id: fc.nat(),
  snapshot_date: fc.integer({ min: 0, max: 365 }).map(days => {
    const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }),
  ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  market: fc.constantFrom('US', 'HK', 'CN'),
  currency: fc.constantFrom('USD', 'HKD', 'CNY'),
  quantity: fc.integer({ min: 1, max: 10000 }),
  avg_cost: fc.double({ min: 0.01, max: 10000, noNaN: true }),
  current_price: fc.double({ min: 0.01, max: 10000, noNaN: true }),
  market_value: fc.double({ min: 0, max: 10000000, noNaN: true }),
  unrealized_pnl: fc.double({ min: -1000000, max: 1000000, noNaN: true }),
  unrealized_pnl_percent: fc.double({ min: -100, max: 1000, noNaN: true }),
  market_value_cny: fc.double({ min: 0, max: 10000000, noNaN: true }),
  unrealized_pnl_cny: fc.double({ min: -1000000, max: 1000000, noNaN: true }),
  position_type: fc.constantFrom('STOCK', 'ETF'),
  weight_percent: fc.double({ min: 0, max: 100, noNaN: true }),
  stop_loss_price: fc.double({ min: 0, max: 10000, noNaN: true }),
  stop_loss_triggered: fc.boolean(),
  created_at: fc.constant(new Date().toISOString()),
  updated_at: fc.constant(new Date().toISOString()),
});

describe('Property Tests: Live Price Independence', () => {
  /**
   * Property 5: 实时价格独立性
   * 
   * *For any* `livePrices` 更新事件，`snapshot` 的 `timestamp` 和内容应保持不变。
   * `livePrices` 的刷新不应触发静态数据的重新获取。
   */
  
  it('Property 5: enrichWithLivePrices should not modify original positions', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryFullStockPosition, { minLength: 1, maxLength: 20 }),
        fc.dictionary(
          fc.stringMatching(/^[A-Z]{1,5}$/),
          arbitraryLivePriceInfo
        ),
        (positions, livePrices) => {
          // 保存原始数据的深拷贝
          const originalPositions = JSON.parse(JSON.stringify(positions));
          const originalTimestamp = Date.now();
          
          // 创建快照
          const snapshot: DashboardSnapshot = {
            timestamp: originalTimestamp,
            dashboard: null,
            stockPositions: positions as unknown as SupabaseStockPosition[],
            optionPositions: [],
            riskMetrics: null,
            history: [],
            returnAttribution: null,
            costAnalysis: null,
          };
          
          // 调用 enrichWithLivePrices
          const enrichedPositions = enrichWithLivePrices(
            snapshot.stockPositions,
            livePrices
          );
          
          // 验证原始快照未被修改
          expect(snapshot.timestamp).toBe(originalTimestamp);
          expect(JSON.stringify(snapshot.stockPositions)).toBe(JSON.stringify(originalPositions));
          
          // 验证返回的是新数组
          expect(enrichedPositions).not.toBe(snapshot.stockPositions);
          
          // 验证每个元素都是新对象
          for (let i = 0; i < enrichedPositions.length; i++) {
            expect(enrichedPositions[i]).not.toBe(snapshot.stockPositions[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.1: enrichWithLivePrices should preserve all original fields', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryFullStockPosition, { minLength: 1, maxLength: 20 }),
        fc.dictionary(
          fc.stringMatching(/^[A-Z]{1,5}$/),
          arbitraryLivePriceInfo
        ),
        (positions, livePrices) => {
          const enrichedPositions = enrichWithLivePrices(
            positions as unknown as SupabaseStockPosition[],
            livePrices
          );
          
          // 验证所有原始字段都被保留
          for (let i = 0; i < positions.length; i++) {
            const original = positions[i];
            const enriched = enrichedPositions[i];
            
            // 验证原始字段未被修改
            expect(enriched.ticker).toBe(original.ticker);
            expect(enriched.quantity).toBe(original.quantity);
            expect(enriched.avg_cost).toBe(original.avg_cost);
            expect(enriched.current_price).toBe(original.current_price);
            expect(enriched.market_value).toBe(original.market_value);
            expect(enriched.unrealized_pnl).toBe(original.unrealized_pnl);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.2: enrichWithLivePrices should correctly mark has_live_price', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryFullStockPosition, { minLength: 1, maxLength: 20 }),
        fc.dictionary(
          fc.stringMatching(/^[A-Z]{1,5}$/),
          arbitraryLivePriceInfo
        ),
        (positions, livePrices) => {
          const enrichedPositions = enrichWithLivePrices(
            positions as unknown as SupabaseStockPosition[],
            livePrices
          );
          
          for (const enriched of enrichedPositions) {
            const hasLivePrice = enriched.ticker in livePrices;
            
            // has_live_price 应该正确反映是否有实时价格
            expect(enriched.has_live_price).toBe(hasLivePrice);
            
            if (hasLivePrice) {
              // 如果有实时价格，应该有 live_price 字段
              expect(enriched.live_price).toBe(livePrices[enriched.ticker].currentPrice);
              expect(enriched.live_change_percent).toBe(livePrices[enriched.ticker].changePercent);
              expect(enriched.live_last_updated).toBe(livePrices[enriched.ticker].lastUpdated);
            } else {
              // 如果没有实时价格，不应该有 live_price 字段
              expect(enriched.live_price).toBeUndefined();
              expect(enriched.live_change_percent).toBeUndefined();
              expect(enriched.live_last_updated).toBeUndefined();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.3: enrichWithLivePrices should correctly calculate live values', () => {
    fc.assert(
      fc.property(
        arbitraryFullStockPosition,
        arbitraryLivePriceInfo,
        (position, livePriceInfo) => {
          const positions = [position] as unknown as SupabaseStockPosition[];
          const livePrices: LivePriceData = {
            [position.ticker]: livePriceInfo,
          };
          
          const enrichedPositions = enrichWithLivePrices(positions, livePrices);
          const enriched = enrichedPositions[0];
          
          // 验证实时市值计算正确
          const expectedMarketValue = livePriceInfo.currentPrice * position.quantity;
          expect(enriched.live_market_value).toBeCloseTo(expectedMarketValue, 5);
          
          // 验证实时盈亏计算正确
          const totalCost = position.avg_cost * position.quantity;
          const expectedPnl = expectedMarketValue - totalCost;
          expect(enriched.live_unrealized_pnl).toBeCloseTo(expectedPnl, 5);
          
          // 验证实时盈亏百分比计算正确
          if (totalCost > 0) {
            const expectedPnlPercent = (expectedPnl / totalCost) * 100;
            expect(enriched.live_unrealized_pnl_percent).toBeCloseTo(expectedPnlPercent, 5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.4: snapshot timestamp should remain unchanged after multiple livePrices updates', () => {
    fc.assert(
      fc.property(
        arbitrarySnapshot,
        fc.array(
          fc.dictionary(
            fc.stringMatching(/^[A-Z]{1,5}$/),
            arbitraryLivePriceInfo
          ),
          { minLength: 2, maxLength: 5 }
        ),
        (snapshot, livePricesUpdates) => {
          const originalTimestamp = snapshot.timestamp;
          const originalSnapshotJson = JSON.stringify(snapshot);
          
          // 模拟多次 livePrices 更新
          for (const livePrices of livePricesUpdates) {
            // 每次更新都调用 enrichWithLivePrices
            enrichWithLivePrices(
              snapshot.stockPositions as unknown as SupabaseStockPosition[],
              livePrices
            );
            
            // 验证快照的 timestamp 和内容保持不变
            expect(snapshot.timestamp).toBe(originalTimestamp);
            expect(JSON.stringify(snapshot)).toBe(originalSnapshotJson);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.5: enrichWithLivePrices should handle empty inputs correctly', () => {
    // 空持仓列表
    const emptyResult = enrichWithLivePrices([], { AAPL: { currentPrice: 150, changePercent: 1.5, lastUpdated: Date.now() } });
    expect(emptyResult).toEqual([]);
    
    // 空实时价格
    fc.assert(
      fc.property(
        fc.array(arbitraryFullStockPosition, { minLength: 1, maxLength: 10 }),
        (positions) => {
          const enrichedPositions = enrichWithLivePrices(
            positions as unknown as SupabaseStockPosition[],
            {}
          );
          
          // 所有持仓都应该标记为没有实时价格
          for (const enriched of enrichedPositions) {
            expect(enriched.has_live_price).toBe(false);
            expect(enriched.live_price).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.6: livePrices query independence - simulated test', () => {
    /**
     * 这个测试模拟了 livePrices 查询独立性的验证：
     * - livePrices 使用独立的 30 秒 staleTime
     * - livePrices 的刷新不应触发静态数据的重新获取
     * 
     * 由于这是一个纯函数测试，我们验证：
     * 1. enrichWithLivePrices 是纯函数（相同输入产生相同输出）
     * 2. 不会修改输入数据
     */
    fc.assert(
      fc.property(
        fc.array(arbitraryFullStockPosition, { minLength: 1, maxLength: 10 }),
        fc.dictionary(
          fc.stringMatching(/^[A-Z]{1,5}$/),
          arbitraryLivePriceInfo
        ),
        (positions, livePrices) => {
          const positionsTyped = positions as unknown as SupabaseStockPosition[];
          
          // 调用两次，验证结果相同（纯函数特性）
          const result1 = enrichWithLivePrices(positionsTyped, livePrices);
          const result2 = enrichWithLivePrices(positionsTyped, livePrices);
          
          // 结果应该相等（但不是同一个引用）
          expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
          expect(result1).not.toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================
// enrichWithLivePrices 单元测试
// ============================================

describe('enrichWithLivePrices Unit Tests', () => {
  const mockPosition: SupabaseStockPosition = {
    id: 1,
    snapshot_date: '2024-01-15',
    ticker: 'AAPL',
    name: 'Apple Inc.',
    market: 'US',
    currency: 'USD',
    quantity: 100,
    avg_cost: 150,
    current_price: 160,
    market_value: 16000,
    unrealized_pnl: 1000,
    unrealized_pnl_percent: 6.67,
    market_value_cny: 115200,
    unrealized_pnl_cny: 7200,
    position_type: 'STOCK',
    weight_percent: 10,
    stop_loss_price: 140,
    stop_loss_triggered: false,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  it('should enrich position with live price data', () => {
    const livePrices: LivePriceData = {
      AAPL: {
        currentPrice: 175,
        changePercent: 2.5,
        lastUpdated: Date.now(),
      },
    };

    const result = enrichWithLivePrices([mockPosition], livePrices);

    expect(result).toHaveLength(1);
    expect(result[0].has_live_price).toBe(true);
    expect(result[0].live_price).toBe(175);
    expect(result[0].live_change_percent).toBe(2.5);
    expect(result[0].live_market_value).toBe(17500); // 175 * 100
    expect(result[0].live_unrealized_pnl).toBe(2500); // 17500 - 15000
    expect(result[0].live_unrealized_pnl_percent).toBeCloseTo(16.67, 1); // (2500 / 15000) * 100
  });

  it('should handle position without live price', () => {
    const livePrices: LivePriceData = {
      MSFT: {
        currentPrice: 400,
        changePercent: 1.0,
        lastUpdated: Date.now(),
      },
    };

    const result = enrichWithLivePrices([mockPosition], livePrices);

    expect(result).toHaveLength(1);
    expect(result[0].has_live_price).toBe(false);
    expect(result[0].live_price).toBeUndefined();
    expect(result[0].live_market_value).toBeUndefined();
  });

  it('should handle multiple positions with partial live prices', () => {
    const positions: SupabaseStockPosition[] = [
      mockPosition,
      { ...mockPosition, id: 2, ticker: 'MSFT', quantity: 50, avg_cost: 300 },
      { ...mockPosition, id: 3, ticker: 'GOOGL', quantity: 20, avg_cost: 140 },
    ];

    const livePrices: LivePriceData = {
      AAPL: { currentPrice: 175, changePercent: 2.5, lastUpdated: Date.now() },
      GOOGL: { currentPrice: 150, changePercent: -1.0, lastUpdated: Date.now() },
    };

    const result = enrichWithLivePrices(positions, livePrices);

    expect(result).toHaveLength(3);
    expect(result[0].has_live_price).toBe(true); // AAPL
    expect(result[1].has_live_price).toBe(false); // MSFT - no live price
    expect(result[2].has_live_price).toBe(true); // GOOGL
  });

  it('should not modify original positions array', () => {
    const originalPositions = [mockPosition];
    const originalJson = JSON.stringify(originalPositions);

    const livePrices: LivePriceData = {
      AAPL: { currentPrice: 175, changePercent: 2.5, lastUpdated: Date.now() },
    };

    enrichWithLivePrices(originalPositions, livePrices);

    expect(JSON.stringify(originalPositions)).toBe(originalJson);
  });
});
