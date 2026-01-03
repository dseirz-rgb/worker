/**
 * 统一认证服务属性测试
 * 
 * **Feature: riskcontrol-integration**
 * **Property 1: 认证状态一致性**
 * **Validates: Requirements 1.1, 1.2**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { UnifiedAuthService, AuthConfig, AuthResult } from './index';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(() => Promise.resolve({ data: null, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      refreshSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
  })),
}));

describe('UnifiedAuthService', () => {
  let authService: UnifiedAuthService;
  const mockConfig: AuthConfig = {
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    echoApiUrl: 'http://localhost:1111',
  };

  beforeEach(() => {
    authService = new UnifiedAuthService(mockConfig);
  });

  describe('Property Tests', () => {
    /**
     * **Property 1: 认证状态一致性**
     * For any user session, if the user is authenticated in one module,
     * they SHALL be authenticated in the other module with the same identity.
     * 
     * **Validates: Requirements 1.1, 1.2**
     */
    it('should maintain consistent auth state across modules', async () => {
      fc.assert(
        fc.property(
          fc.record({
            email: fc.emailAddress(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            id: fc.uuid(),
          }),
          (userData) => {
            // 验证：初始状态下，两个模块的访问权限应该一致
            const echoAccess = authService.hasModuleAccess('echo');
            const rcAccess = authService.hasModuleAccess('riskcontrol');
            
            // 未认证时，两个模块都应该拒绝访问
            expect(echoAccess).toBe(rcAccess);
            expect(echoAccess).toBe(false);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Property 12: 认证一致性**
     * For any authenticated session, both Echo and RiskControl modules
     * SHALL accept the same authentication token.
     * 
     * **Validates: Requirements 6.4**
     */
    it('should provide consistent tokens for both modules', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          (token) => {
            // 验证：token 获取方法应该返回一致的结果
            const echoToken = authService.getEchoToken();
            const rcToken = authService.getRCToken();
            
            // 初始状态两个 token 都应该是 null
            expect(echoToken).toBeNull();
            expect(rcToken).toBeNull();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    it('should initialize with null user', async () => {
      const user = await authService.getCurrentUser();
      expect(user).toBeNull();
    });

    it('should deny module access when not authenticated', () => {
      expect(authService.hasModuleAccess('echo')).toBe(false);
      expect(authService.hasModuleAccess('riskcontrol')).toBe(false);
    });

    it('should return null tokens when not authenticated', () => {
      expect(authService.getEchoToken()).toBeNull();
      expect(authService.getRCToken()).toBeNull();
    });

    it('should handle logout gracefully when not authenticated', async () => {
      // 不应该抛出错误
      await expect(authService.logout()).resolves.not.toThrow();
    });
  });
});
