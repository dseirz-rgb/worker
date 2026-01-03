/**
 * 双数据库客户端属性测试
 * 
 * **Feature: riskcontrol-integration**
 * **Property 2: 数据隔离完整性**
 * **Validates: Requirements 3.2, 3.3, 3.6**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { 
  DualDatabaseClient, 
  DatabaseConfig, 
  DataType,
  DatabaseError 
} from './index';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((url: string) => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    _url: url, // 用于测试识别
  })),
}));

describe('DualDatabaseClient', () => {
  let dbClient: DualDatabaseClient;
  const mockConfig: DatabaseConfig = {
    rcSupabaseUrl: 'https://rc.supabase.co',
    rcSupabaseAnonKey: 'rc-anon-key',
    echoSupabaseUrl: 'https://echo.supabase.co',
    echoSupabaseAnonKey: 'echo-anon-key',
  };

  beforeEach(() => {
    dbClient = new DualDatabaseClient(mockConfig);
  });

  describe('Property Tests', () => {
    /**
     * **Property 2: 数据隔离完整性**
     * For any data write operation, financial data (positions, transactions, risk metrics)
     * SHALL only be written to RiskControl_Database, and notes/tasks SHALL only be
     * written to Echo_Database.
     * 
     * **Validates: Requirements 3.2, 3.3, 3.6**
     */
    it('should route financial data types to RiskControl database', () => {
      const financialDataTypes: DataType[] = [
        'positions',
        'transactions',
        'risk_metrics',
        'watchlist',
        'investment_docs',
        'dashboard_snapshots',
        'trade_reviews',
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...financialDataTypes),
          (dataType) => {
            const target = DualDatabaseClient.getTargetDatabase(dataType);
            expect(target).toBe('riskcontrol');
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should route Echo data types to Echo database', () => {
      const echoDataTypes: DataType[] = [
        'notes',
        'tasks',
        'calendar',
        'tags',
        'attachments',
        'daily_knowledge',
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...echoDataTypes),
          (dataType) => {
            const target = DualDatabaseClient.getTargetDatabase(dataType);
            expect(target).toBe('echo');
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 验证数据类型路由的完整性
     * 所有定义的数据类型都应该有明确的目标数据库
     */
    it('should have routing for all data types', () => {
      const allDataTypes: DataType[] = [
        'notes', 'tasks', 'calendar', 'tags', 'attachments', 'daily_knowledge',
        'positions', 'transactions', 'risk_metrics', 'watchlist', 
        'investment_docs', 'dashboard_snapshots', 'trade_reviews',
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...allDataTypes),
          (dataType) => {
            const target = DualDatabaseClient.getTargetDatabase(dataType);
            expect(['echo', 'riskcontrol']).toContain(target);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    it('should return RiskControl client for financial data', () => {
      const client = dbClient.getClientForDataType('positions');
      expect(client).toBeDefined();
    });

    it('should return Echo client for notes data', () => {
      const client = dbClient.getClientForDataType('notes');
      expect(client).toBeDefined();
    });

    it('should correctly categorize Echo data types', () => {
      const echoTypes = DualDatabaseClient.getEchoDataTypes();
      expect(echoTypes).toContain('notes');
      expect(echoTypes).toContain('tasks');
      expect(echoTypes).toContain('calendar');
      expect(echoTypes).not.toContain('positions');
    });

    it('should correctly categorize RiskControl data types', () => {
      const rcTypes = DualDatabaseClient.getRiskControlDataTypes();
      expect(rcTypes).toContain('positions');
      expect(rcTypes).toContain('transactions');
      expect(rcTypes).toContain('risk_metrics');
      expect(rcTypes).not.toContain('notes');
    });

    it('should provide health check functionality', async () => {
      const health = await dbClient.healthCheck();
      expect(health).toHaveProperty('echo');
      expect(health).toHaveProperty('riskcontrol');
      expect(health.echo).toHaveProperty('connected');
      expect(health.riskcontrol).toHaveProperty('connected');
    });
  });
});
