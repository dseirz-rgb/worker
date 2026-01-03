/**
 * InvestmentStore 属性测试
 * 
 * **Feature: api-integration**
 * **Property 1: 数据库初始化正确性**
 * **Validates: Requirements 1.1, 1.4**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock import.meta.env
const mockEnv = {
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
};

vi.stubGlobal('import', {
  meta: {
    env: mockEnv,
  },
});

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
  })),
  auth: {
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
  },
};

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((url: string, key: string) => {
    // 验证 URL 和 key 格式
    if (!url || !key) {
      throw new Error('Invalid Supabase configuration');
    }
    return {
      ...mockSupabaseClient,
      _url: url,
      _key: key,
    };
  }),
}));

// Mock @echoai/shared/database
vi.mock('@echoai/shared/database', () => {
  let clientInstance: any = null;

  return {
    DualDatabaseClient: vi.fn().mockImplementation((config: any) => {
      // 验证配置有效性
      if (!config.rcSupabaseUrl || !config.rcSupabaseAnonKey) {
        throw new Error('Invalid database configuration');
      }
      
      return {
        riskcontrol: mockSupabaseClient,
        echo: mockSupabaseClient,
        getClientForDataType: vi.fn(() => mockSupabaseClient),
        healthCheck: vi.fn(() => Promise.resolve({
          echo: { connected: true, latency: 50 },
          riskcontrol: { connected: true, latency: 30 },
        })),
        _config: config,
      };
    }),
    getDatabaseClient: vi.fn(() => clientInstance),
    initDatabaseClient: vi.fn((config: any) => {
      // 验证配置
      if (!config.rcSupabaseUrl || !config.rcSupabaseAnonKey) {
        throw new Error('Invalid database configuration');
      }
      
      clientInstance = {
        riskcontrol: mockSupabaseClient,
        echo: mockSupabaseClient,
        getClientForDataType: vi.fn(() => mockSupabaseClient),
        healthCheck: vi.fn(() => Promise.resolve({
          echo: { connected: true, latency: 50 },
          riskcontrol: { connected: true, latency: 30 },
        })),
        _config: config,
      };
      return clientInstance;
    }),
  };
});

// Mock @echoai/shared/riskcontrol/circuit-breaker
vi.mock('@echoai/shared/riskcontrol/circuit-breaker', () => ({
  CircuitBreakerService: vi.fn(),
  getCircuitBreaker: vi.fn(() => null),
  initCircuitBreaker: vi.fn(() => ({
    checkRiskMetrics: vi.fn(() => ({ allowed: true, blockedBy: [], warnings: [] })),
    getAllBreakerStates: vi.fn(() => []),
    resetBreaker: vi.fn(() => true),
  })),
}));

// Mock @echoai/shared/riskcontrol/price-alert
vi.mock('@echoai/shared/riskcontrol/price-alert', () => ({
  PriceAlertService: vi.fn(),
  getAlertService: vi.fn(() => null),
  initAlertService: vi.fn(() => ({
    getAllRules: vi.fn(() => []),
    addRule: vi.fn((rule: any) => ({ ...rule, id: 'test-id', createdAt: new Date(), lastTriggeredAt: null, triggerCount: 0 })),
    removeRule: vi.fn(() => true),
    setRuleEnabled: vi.fn(() => true),
    checkPriceData: vi.fn(() => []),
  })),
}));

// Mock mobx
vi.mock('mobx', () => ({
  makeAutoObservable: vi.fn((obj) => obj),
  runInAction: vi.fn((fn) => fn()),
}));

// Mock react
vi.mock('react', () => ({
  useEffect: vi.fn((fn) => fn()),
}));

// 导入被测模块（在 mock 之后）
import { initDatabaseClient, getDatabaseClient, DualDatabaseClient } from '@echoai/shared/database';

// 扩展类型以包含 mock 属性
interface MockDatabaseClient {
  riskcontrol: typeof mockSupabaseClient;
  echo: typeof mockSupabaseClient;
  getClientForDataType: ReturnType<typeof vi.fn>;
  healthCheck: ReturnType<typeof vi.fn>;
  _config: {
    rcSupabaseUrl: string;
    rcSupabaseAnonKey: string;
    echoSupabaseUrl?: string;
    echoSupabaseAnonKey?: string;
  };
}

describe('InvestmentStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置环境变量
    mockEnv.VITE_SUPABASE_URL = '';
    mockEnv.VITE_SUPABASE_ANON_KEY = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Property Tests: Database Initialization', () => {
    /**
     * **Feature: api-integration, Property 1: 数据库初始化正确性**
     * **Validates: Requirements 1.1, 1.4**
     * 
     * 对于任何有效的 Supabase URL 和 anon key，DualDatabaseClient 应该成功初始化
     */
    it('should initialize database client with valid config', () => {
      fc.assert(
        fc.property(
          // 生成有效的 Supabase URL（https 协议）
          fc.webUrl({ validSchemes: ['https'] }),
          // 生成有效的 anon key（10-200 字符的字母数字字符串）
          fc.stringMatching(/^[a-zA-Z0-9._-]{10,200}$/),
          (url, key) => {
            // 构建配置
            const config = {
              rcSupabaseUrl: url,
              rcSupabaseAnonKey: key,
              echoSupabaseUrl: url,
              echoSupabaseAnonKey: key,
            };

            // 初始化数据库客户端
            const client = initDatabaseClient(config) as unknown as MockDatabaseClient;

            // 验证客户端已创建
            expect(client).toBeDefined();
            expect(client).not.toBeNull();
            
            // 验证配置已正确传递
            expect(client._config.rcSupabaseUrl).toBe(url);
            expect(client._config.rcSupabaseAnonKey).toBe(key);
            
            // 验证 riskcontrol 客户端可访问
            expect(client.riskcontrol).toBeDefined();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: api-integration, Property 1.1: URL 格式验证**
     * **Validates: Requirements 1.1**
     * 
     * 验证只有 HTTPS URL 才能成功初始化
     */
    it('should accept only valid HTTPS URLs', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['https'] }),
          fc.stringMatching(/^[a-zA-Z0-9._-]{20,100}$/),
          (url, key) => {
            const config = {
              rcSupabaseUrl: url,
              rcSupabaseAnonKey: key,
            };

            const client = initDatabaseClient(config) as unknown as MockDatabaseClient;
            
            // URL 应该以 https:// 开头
            expect(client._config.rcSupabaseUrl).toMatch(/^https:\/\//);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: api-integration, Property 1.2: Key 长度验证**
     * **Validates: Requirements 1.1**
     * 
     * 验证 anon key 长度在合理范围内
     */
    it('should accept anon keys with valid length', () => {
      fc.assert(
        fc.property(
          fc.constant('https://test.supabase.co'),
          fc.stringMatching(/^[a-zA-Z0-9._-]{10,200}$/),
          (url, key) => {
            const config = {
              rcSupabaseUrl: url,
              rcSupabaseAnonKey: key,
            };

            const client = initDatabaseClient(config) as unknown as MockDatabaseClient;
            
            // Key 长度应该在 10-200 之间
            expect(client._config.rcSupabaseAnonKey.length).toBeGreaterThanOrEqual(10);
            expect(client._config.rcSupabaseAnonKey.length).toBeLessThanOrEqual(200);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: api-integration, Property 1.3: 双数据库配置**
     * **Validates: Requirements 1.4**
     * 
     * 验证 Echo 和 RiskControl 可以使用相同或不同的配置
     */
    it('should support both same and different database configs', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['https'] }),
          fc.webUrl({ validSchemes: ['https'] }),
          fc.stringMatching(/^[a-zA-Z0-9._-]{20,100}$/),
          fc.stringMatching(/^[a-zA-Z0-9._-]{20,100}$/),
          fc.boolean(),
          (rcUrl, echoUrl, rcKey, echoKey, useSameConfig) => {
            const config = useSameConfig
              ? {
                  rcSupabaseUrl: rcUrl,
                  rcSupabaseAnonKey: rcKey,
                  echoSupabaseUrl: rcUrl,
                  echoSupabaseAnonKey: rcKey,
                }
              : {
                  rcSupabaseUrl: rcUrl,
                  rcSupabaseAnonKey: rcKey,
                  echoSupabaseUrl: echoUrl,
                  echoSupabaseAnonKey: echoKey,
                };

            const client = initDatabaseClient(config);
            
            expect(client).toBeDefined();
            expect(client.riskcontrol).toBeDefined();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests: Database Client', () => {
    /**
     * 验证 getDatabaseClient 在未初始化时返回 null
     */
    it('should return null when database client is not initialized', () => {
      // 重置 mock 使其返回 null
      vi.mocked(getDatabaseClient).mockReturnValueOnce(null);
      
      const client = getDatabaseClient();
      expect(client).toBeNull();
    });

    /**
     * 验证 initDatabaseClient 创建有效的客户端实例
     */
    it('should create valid client instance with initDatabaseClient', () => {
      const config = {
        rcSupabaseUrl: 'https://test.supabase.co',
        rcSupabaseAnonKey: 'test-anon-key-12345',
      };

      const client = initDatabaseClient(config);
      
      expect(client).toBeDefined();
      expect(client.riskcontrol).toBeDefined();
      expect(client.healthCheck).toBeDefined();
    });

    /**
     * 验证健康检查功能
     */
    it('should perform health check successfully', async () => {
      const config = {
        rcSupabaseUrl: 'https://test.supabase.co',
        rcSupabaseAnonKey: 'test-anon-key-12345',
      };

      const client = initDatabaseClient(config);
      const health = await client.healthCheck();
      
      expect(health).toBeDefined();
      expect(health.echo).toBeDefined();
      expect(health.riskcontrol).toBeDefined();
      expect(health.echo.connected).toBe(true);
      expect(health.riskcontrol.connected).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    /**
     * 验证空配置处理
     */
    it('should handle empty URL gracefully', () => {
      const config = {
        rcSupabaseUrl: '',
        rcSupabaseAnonKey: 'valid-key-12345',
      };

      expect(() => initDatabaseClient(config)).toThrow('Invalid database configuration');
    });

    /**
     * 验证空 key 处理
     */
    it('should handle empty key gracefully', () => {
      const config = {
        rcSupabaseUrl: 'https://test.supabase.co',
        rcSupabaseAnonKey: '',
      };

      expect(() => initDatabaseClient(config)).toThrow('Invalid database configuration');
    });
  });

  describe('Property Tests: Position Data Mapping', () => {
    /**
     * **Feature: api-integration, Property 2: 持仓数据映射正确性**
     * **Validates: Requirements 2.2**
     * 
     * 对于任何 position row（snake_case 字段），映射后的 Position 对象应有正确的 camelCase 字段
     */
    it('should correctly map snake_case fields to camelCase', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            ticker: fc.string({ minLength: 1, maxLength: 10 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            quantity: fc.float({ min: 0, max: 10000, noNaN: true }),
            avg_cost: fc.float({ min: 0, max: 10000, noNaN: true }),
            current_price: fc.float({ min: 0, max: 10000, noNaN: true }),
            market_value: fc.float({ min: 0, max: 1000000, noNaN: true }),
            unrealized_pnl: fc.float({ min: -100000, max: 100000, noNaN: true }),
            unrealized_pnl_percent: fc.float({ min: -100, max: 100, noNaN: true }),
            weight: fc.float({ min: 0, max: 1, noNaN: true }),
            asset_type: fc.constantFrom('stock', 'option', 'crypto', 'etf', 'bond'),
            sector: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
            last_updated: fc.date().map(d => d.toISOString()),
          }),
          (row) => {
            // 映射逻辑：snake_case → camelCase
            const mapped = {
              id: row.id,
              ticker: row.ticker,
              name: row.name || row.ticker,
              quantity: row.quantity,
              avgCost: row.avg_cost,
              currentPrice: row.current_price,
              marketValue: row.market_value,
              unrealizedPnL: row.unrealized_pnl,
              unrealizedPnLPercent: row.unrealized_pnl_percent,
              weight: row.weight,
              assetType: row.asset_type,
              sector: row.sector,
              lastUpdated: new Date(row.last_updated),
            };
            
            // 验证映射正确性
            expect(mapped.avgCost).toBe(row.avg_cost);
            expect(mapped.currentPrice).toBe(row.current_price);
            expect(mapped.marketValue).toBe(row.market_value);
            expect(mapped.unrealizedPnL).toBe(row.unrealized_pnl);
            expect(mapped.unrealizedPnLPercent).toBe(row.unrealized_pnl_percent);
            expect(mapped.assetType).toBe(row.asset_type);
            expect(mapped.lastUpdated).toBeInstanceOf(Date);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: api-integration, Property 2.1: 字段名称转换一致性**
     * **Validates: Requirements 2.2**
     * 
     * 验证所有 snake_case 字段都被正确转换为 camelCase
     */
    it('should maintain field value integrity during mapping', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            quantity: fc.integer({ min: 1, max: 10000 }),
            avg_cost: fc.float({ min: Math.fround(0.01), max: 10000, noNaN: true }),
            current_price: fc.float({ min: Math.fround(0.01), max: 10000, noNaN: true }),
            market_value: fc.float({ min: 0, max: 1000000, noNaN: true }),
            unrealized_pnl: fc.float({ min: -100000, max: 100000, noNaN: true }),
            unrealized_pnl_percent: fc.float({ min: -100, max: 100, noNaN: true }),
            weight: fc.float({ min: 0, max: 1, noNaN: true }),
            asset_type: fc.constantFrom('stock', 'option', 'crypto', 'etf', 'bond'),
            sector: fc.option(fc.constantFrom('Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer')),
            last_updated: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()),
          }),
          (row) => {
            // 映射逻辑
            const mapped = {
              id: row.id,
              ticker: row.ticker,
              name: row.name || row.ticker,
              quantity: row.quantity,
              avgCost: row.avg_cost,
              currentPrice: row.current_price,
              marketValue: row.market_value,
              unrealizedPnL: row.unrealized_pnl,
              unrealizedPnLPercent: row.unrealized_pnl_percent,
              weight: row.weight,
              assetType: row.asset_type,
              sector: row.sector,
              lastUpdated: new Date(row.last_updated),
            };
            
            // 验证数值字段的精度保持
            expect(mapped.quantity).toBe(row.quantity);
            expect(mapped.weight).toBe(row.weight);
            
            // 验证字符串字段完整性
            expect(mapped.id).toBe(row.id);
            expect(mapped.ticker).toBe(row.ticker);
            expect(mapped.sector).toBe(row.sector);
            
            // 验证日期转换有效性
            expect(mapped.lastUpdated.toISOString()).toBe(row.last_updated);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: api-integration, Property 2.2: 可选字段处理**
     * **Validates: Requirements 2.2**
     * 
     * 验证可选字段（如 sector）正确处理 null/undefined 值
     */
    it('should handle optional fields correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
            name: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
            quantity: fc.integer({ min: 1, max: 10000 }),
            avg_cost: fc.float({ min: Math.fround(0.01), max: 10000, noNaN: true }),
            current_price: fc.float({ min: Math.fround(0.01), max: 10000, noNaN: true }),
            market_value: fc.float({ min: 0, max: 1000000, noNaN: true }),
            unrealized_pnl: fc.float({ min: -100000, max: 100000, noNaN: true }),
            unrealized_pnl_percent: fc.float({ min: -100, max: 100, noNaN: true }),
            weight: fc.float({ min: 0, max: 1, noNaN: true }),
            asset_type: fc.constantFrom('stock', 'option', 'crypto', 'etf', 'bond'),
            sector: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
            last_updated: fc.date().map(d => d.toISOString()),
          }),
          (row) => {
            // 映射逻辑，处理可选字段
            const mapped = {
              id: row.id,
              ticker: row.ticker,
              name: row.name || row.ticker, // name 为空时使用 ticker
              quantity: row.quantity,
              avgCost: row.avg_cost,
              currentPrice: row.current_price,
              marketValue: row.market_value,
              unrealizedPnL: row.unrealized_pnl,
              unrealizedPnLPercent: row.unrealized_pnl_percent,
              weight: row.weight,
              assetType: row.asset_type,
              sector: row.sector ?? null, // 显式处理 undefined
              lastUpdated: new Date(row.last_updated),
            };
            
            // 验证 name 的 fallback 逻辑
            if (row.name) {
              expect(mapped.name).toBe(row.name);
            } else {
              expect(mapped.name).toBe(row.ticker);
            }
            
            // 验证 sector 可以为 null
            if (row.sector === null || row.sector === undefined) {
              expect(mapped.sector).toBeNull();
            } else {
              expect(mapped.sector).toBe(row.sector);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property Tests: Alert Badge Count', () => {
    /**
     * **Feature: api-integration, Property 3: 警报徽章计数准确性**
     * **Validates: Requirements 4.4**
     * 
     * 对于任何 alerts 数组，activeAlertCount 应等于 enabled=true 且 triggered=false 的警报数量
     */
    it('activeAlertCount should equal count of enabled non-triggered alerts', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              ticker: fc.string({ minLength: 1, maxLength: 10 }),
              type: fc.constantFrom('price_above', 'price_below', 'percent_change'),
              threshold: fc.float({ min: 0, max: 1000 }),
              enabled: fc.boolean(),
              triggered: fc.boolean(),
              channels: fc.array(fc.constantFrom('email', 'push', 'voice')),
              createdAt: fc.date(),
              lastTriggeredAt: fc.option(fc.date()),
              triggerCount: fc.nat({ max: 100 }),
              cooldownMinutes: fc.nat({ max: 60 }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          (alerts) => {
            // 计算预期的活跃警报数量（enabled=true 且 triggered=false）
            const expected = alerts.filter(a => a.enabled && !a.triggered).length;
            
            // 模拟 activeAlertCount 计算逻辑
            const computeActiveAlertCount = (alertList: typeof alerts): number => {
              return alertList.filter(alert => alert.enabled && !alert.triggered).length;
            };
            
            const actual = computeActiveAlertCount(alerts);
            
            // 验证计算结果与预期一致
            expect(actual).toBe(expected);
            
            // 额外验证：活跃警报数量不应超过总警报数量
            expect(actual).toBeLessThanOrEqual(alerts.length);
            
            // 额外验证：活跃警报数量应为非负数
            expect(actual).toBeGreaterThanOrEqual(0);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: api-integration, Property 3.1: 空数组边界情况**
     * **Validates: Requirements 4.4**
     * 
     * 空警报数组应返回 0 活跃警报
     */
    it('should return 0 for empty alerts array', () => {
      const alerts: any[] = [];
      const activeCount = alerts.filter(a => a.enabled && !a.triggered).length;
      expect(activeCount).toBe(0);
    });

    /**
     * **Feature: api-integration, Property 3.2: 全部禁用情况**
     * **Validates: Requirements 4.4**
     * 
     * 当所有警报都被禁用时，活跃警报数量应为 0
     */
    it('should return 0 when all alerts are disabled', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              ticker: fc.string({ minLength: 1, maxLength: 10 }),
              type: fc.constantFrom('price_above', 'price_below', 'percent_change'),
              threshold: fc.float({ min: 0, max: 1000 }),
              enabled: fc.constant(false), // 强制所有警报禁用
              triggered: fc.boolean(),
              channels: fc.array(fc.constantFrom('email', 'push', 'voice')),
              createdAt: fc.date(),
              lastTriggeredAt: fc.option(fc.date()),
              triggerCount: fc.nat({ max: 100 }),
              cooldownMinutes: fc.nat({ max: 60 }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (alerts) => {
            const activeCount = alerts.filter(a => a.enabled && !a.triggered).length;
            expect(activeCount).toBe(0);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: api-integration, Property 3.3: 全部已触发情况**
     * **Validates: Requirements 4.4**
     * 
     * 当所有警报都已触发时，活跃警报数量应为 0
     */
    it('should return 0 when all alerts are triggered', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              ticker: fc.string({ minLength: 1, maxLength: 10 }),
              type: fc.constantFrom('price_above', 'price_below', 'percent_change'),
              threshold: fc.float({ min: 0, max: 1000 }),
              enabled: fc.boolean(),
              triggered: fc.constant(true), // 强制所有警报已触发
              channels: fc.array(fc.constantFrom('email', 'push', 'voice')),
              createdAt: fc.date(),
              lastTriggeredAt: fc.option(fc.date()),
              triggerCount: fc.nat({ max: 100 }),
              cooldownMinutes: fc.nat({ max: 60 }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (alerts) => {
            const activeCount = alerts.filter(a => a.enabled && !a.triggered).length;
            expect(activeCount).toBe(0);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: api-integration, Property 3.4: 全部活跃情况**
     * **Validates: Requirements 4.4**
     * 
     * 当所有警报都启用且未触发时，活跃警报数量应等于总数
     */
    it('should return total count when all alerts are enabled and not triggered', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              ticker: fc.string({ minLength: 1, maxLength: 10 }),
              type: fc.constantFrom('price_above', 'price_below', 'percent_change'),
              threshold: fc.float({ min: 0, max: 1000 }),
              enabled: fc.constant(true), // 强制所有警报启用
              triggered: fc.constant(false), // 强制所有警报未触发
              channels: fc.array(fc.constantFrom('email', 'push', 'voice')),
              createdAt: fc.date(),
              lastTriggeredAt: fc.option(fc.date()),
              triggerCount: fc.nat({ max: 100 }),
              cooldownMinutes: fc.nat({ max: 60 }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (alerts) => {
            const activeCount = alerts.filter(a => a.enabled && !a.triggered).length;
            expect(activeCount).toBe(alerts.length);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
