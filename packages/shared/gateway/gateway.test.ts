/**
 * API Gateway 属性测试
 * 
 * **Feature: riskcontrol-integration, Property 5: API 路由正确性**
 * **Validates: Requirements 6.2, 6.3**
 * 
 * @module @echoai/shared/gateway/tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { 
  APIGateway, 
  DEFAULT_ROUTES, 
  GatewayError,
  type RouteConfig,
  type TargetService,
} from './index';

// ============================================
// 测试配置
// ============================================

const TEST_CONFIG = {
  echoBaseUrl: 'http://localhost:1111',
  rcBaseUrl: 'http://localhost:3000',
  defaultTimeout: 30000,
};

// ============================================
// 辅助函数
// ============================================

// 生成有效的 Echo 路径
const echoPathArb = fc.oneof(
  fc.constant('/api/echo'),
  fc.constant('/api/trpc'),
  fc.constant('/api/auth'),
  fc.constant('/api/file'),
  fc.constant('/api/rss'),
  fc.constant('/api/livekit'),
  fc.constant('/v1'),
  // 带子路径
  fc.tuple(
    fc.constantFrom('/api/echo', '/api/trpc', '/api/auth', '/api/file'),
    fc.stringMatching(/^\/[a-z0-9\-_\/]*$/).filter(s => s.length < 50)
  ).map(([base, sub]) => `${base}${sub}`)
);

// 生成有效的 RiskControl 路径
const rcPathArb = fc.oneof(
  fc.constant('/api/rc'),
  fc.constant('/api/positions'),
  fc.constant('/api/transactions'),
  fc.constant('/api/risk'),
  fc.constant('/api/watchlist'),
  fc.constant('/api/dashboard'),
  fc.constant('/api/alerts'),
  fc.constant('/api/ibkr'),
  // 带子路径
  fc.tuple(
    fc.constantFrom('/api/rc', '/api/positions', '/api/transactions', '/api/risk'),
    fc.stringMatching(/^\/[a-z0-9\-_\/]*$/).filter(s => s.length < 50)
  ).map(([base, sub]) => `${base}${sub}`)
);

// 生成无效路径（不匹配任何路由）
const invalidPathArb = fc.stringMatching(/^\/[a-z0-9\-_]+$/)
  .filter(path => {
    // 排除所有已知的路由前缀
    const knownPrefixes = ['/api/echo', '/api/trpc', '/api/auth', '/api/file', 
      '/api/rss', '/api/livekit', '/v1', '/api/rc', '/api/positions', 
      '/api/transactions', '/api/risk', '/api/watchlist', '/api/dashboard',
      '/api/alerts', '/api/ibkr'];
    return !knownPrefixes.some(prefix => path.startsWith(prefix));
  });

// ============================================
// 属性测试
// ============================================

describe('APIGateway Property Tests', () => {
  let gateway: APIGateway;

  beforeEach(() => {
    gateway = new APIGateway(TEST_CONFIG);
  });

  /**
   * **Property 5.1: Echo 路由正确性**
   * 所有 /api/echo/* 路径必须路由到 Echo 后端
   * **Validates: Requirements 6.2**
   */
  it('should route all Echo paths to Echo backend', () => {
    fc.assert(
      fc.property(echoPathArb, (path) => {
        const match = gateway.matchRoute(path);
        
        // 必须匹配
        expect(match.matched).toBe(true);
        // 必须路由到 echo
        expect(match.target).toBe('echo');
        // 目标 URL 必须指向 Echo
        const targetUrl = gateway.buildTargetUrl(path);
        expect(targetUrl).toContain(TEST_CONFIG.echoBaseUrl);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 5.2: RiskControl 路由正确性**
   * 所有 /api/rc/* 路径必须路由到 RiskControl 后端
   * **Validates: Requirements 6.3**
   */
  it('should route all RiskControl paths to RiskControl backend', () => {
    fc.assert(
      fc.property(rcPathArb, (path) => {
        const match = gateway.matchRoute(path);
        
        // 必须匹配
        expect(match.matched).toBe(true);
        // 必须路由到 riskcontrol
        expect(match.target).toBe('riskcontrol');
        // 目标 URL 必须指向 RiskControl
        const targetUrl = gateway.buildTargetUrl(path);
        expect(targetUrl).toContain(TEST_CONFIG.rcBaseUrl);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 5.3: 路由互斥性**
   * 同一路径不能同时路由到两个后端
   */
  it('should route each path to exactly one backend', () => {
    fc.assert(
      fc.property(
        fc.oneof(echoPathArb, rcPathArb),
        (path) => {
          const match = gateway.matchRoute(path);
          
          if (match.matched) {
            // 只能是 echo 或 riskcontrol，不能是其他值
            expect(['echo', 'riskcontrol']).toContain(match.target);
            
            // 验证目标 URL 只包含一个后端
            const targetUrl = gateway.buildTargetUrl(path);
            const containsEcho = targetUrl?.includes(TEST_CONFIG.echoBaseUrl);
            const containsRC = targetUrl?.includes(TEST_CONFIG.rcBaseUrl);
            
            // 互斥：只能包含一个
            expect(containsEcho !== containsRC).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 5.4: 未知路由处理**
   * 未知路径不应匹配任何路由
   */
  it('should not match unknown paths', () => {
    fc.assert(
      fc.property(invalidPathArb, (path) => {
        const match = gateway.matchRoute(path);
        
        // 不应匹配
        expect(match.matched).toBe(false);
        expect(match.target).toBeUndefined();
        
        // buildTargetUrl 应返回 null
        const targetUrl = gateway.buildTargetUrl(path);
        expect(targetUrl).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 5.5: 路由配置一致性**
   * 添加的路由配置应该被正确保存和使用
   */
  it('should maintain route configuration consistency', () => {
    fc.assert(
      fc.property(
        fc.record({
          pattern: fc.stringMatching(/^\/api\/test[a-z]*$/),
          target: fc.constantFrom('echo', 'riskcontrol') as fc.Arbitrary<TargetService>,
          requiresAuth: fc.boolean(),
          timeout: fc.integer({ min: 1000, max: 60000 }),
        }),
        (routeConfig: RouteConfig) => {
          // 添加路由
          gateway.addRoute(routeConfig);
          
          // 验证路由被添加
          const routes = gateway.getRoutes();
          const found = routes.find(r => r.pattern === routeConfig.pattern);
          expect(found).toBeDefined();
          expect(found?.target).toBe(routeConfig.target);
          expect(found?.requiresAuth).toBe(routeConfig.requiresAuth);
          
          // 验证路由匹配
          const match = gateway.matchRoute(routeConfig.pattern);
          expect(match.matched).toBe(true);
          expect(match.target).toBe(routeConfig.target);
          
          // 验证超时配置
          const timeout = gateway.getTimeout(routeConfig.pattern);
          expect(timeout).toBe(routeConfig.timeout);
          
          // 清理
          gateway.removeRoute(routeConfig.pattern);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Property 5.6: 认证要求一致性**
   * 需要认证的路由应该正确标记
   */
  it('should correctly identify auth requirements', () => {
    // 需要认证的路由
    const authRequiredPaths = ['/api/file', '/api/livekit', '/api/rc', '/api/positions'];
    // 不需要认证的路由
    const noAuthPaths = ['/api/echo', '/api/trpc', '/api/auth', '/api/rss'];

    fc.assert(
      fc.property(
        fc.constantFrom(...authRequiredPaths),
        (path) => {
          expect(gateway.requiresAuth(path)).toBe(true);
        }
      ),
      { numRuns: 20 }
    );

    fc.assert(
      fc.property(
        fc.constantFrom(...noAuthPaths),
        (path) => {
          expect(gateway.requiresAuth(path)).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ============================================
// 单元测试
// ============================================

describe('APIGateway Unit Tests', () => {
  let gateway: APIGateway;

  beforeEach(() => {
    gateway = new APIGateway(TEST_CONFIG);
  });

  describe('Route Matching', () => {
    it('should match exact paths', () => {
      const match = gateway.matchRoute('/api/echo');
      expect(match.matched).toBe(true);
      expect(match.target).toBe('echo');
    });

    it('should match paths with subpaths', () => {
      const match = gateway.matchRoute('/api/echo/notes/123');
      expect(match.matched).toBe(true);
      expect(match.target).toBe('echo');
      expect(match.remainingPath).toBe('/notes/123');
    });

    it('should handle paths without leading slash', () => {
      const match = gateway.matchRoute('api/echo');
      expect(match.matched).toBe(true);
      expect(match.target).toBe('echo');
    });

    it('should return unmatched for unknown paths', () => {
      const match = gateway.matchRoute('/unknown/path');
      expect(match.matched).toBe(false);
      expect(match.target).toBeUndefined();
    });
  });

  describe('URL Building', () => {
    it('should build correct Echo URL', () => {
      const url = gateway.buildTargetUrl('/api/echo/test');
      expect(url).toBe('http://localhost:1111/api/echo/test');
    });

    it('should build correct RiskControl URL', () => {
      const url = gateway.buildTargetUrl('/api/rc/positions');
      expect(url).toBe('http://localhost:3000/api/rc/positions');
    });

    it('should return null for unknown paths', () => {
      const url = gateway.buildTargetUrl('/unknown');
      expect(url).toBeNull();
    });
  });

  describe('Route Management', () => {
    it('should add new routes', () => {
      gateway.addRoute({
        pattern: '/api/custom',
        target: 'echo',
        requiresAuth: true,
      });

      const match = gateway.matchRoute('/api/custom/test');
      expect(match.matched).toBe(true);
      expect(match.target).toBe('echo');
    });

    it('should update existing routes', () => {
      gateway.addRoute({
        pattern: '/api/echo',
        target: 'riskcontrol', // 改变目标
        requiresAuth: true,
      });

      const match = gateway.matchRoute('/api/echo');
      expect(match.target).toBe('riskcontrol');
    });

    it('should remove routes', () => {
      gateway.addRoute({
        pattern: '/api/temp',
        target: 'echo',
        requiresAuth: false,
      });

      expect(gateway.matchRoute('/api/temp').matched).toBe(true);
      
      const removed = gateway.removeRoute('/api/temp');
      expect(removed).toBe(true);
      expect(gateway.matchRoute('/api/temp').matched).toBe(false);
    });

    it('should return false when removing non-existent route', () => {
      const removed = gateway.removeRoute('/api/nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('Timeout Configuration', () => {
    it('should return default timeout for routes without custom timeout', () => {
      const timeout = gateway.getTimeout('/api/echo');
      expect(timeout).toBe(30000);
    });

    it('should return custom timeout when configured', () => {
      gateway.addRoute({
        pattern: '/api/slow',
        target: 'echo',
        requiresAuth: false,
        timeout: 60000,
      });

      const timeout = gateway.getTimeout('/api/slow');
      expect(timeout).toBe(60000);
    });
  });

  describe('Health Check', () => {
    it('should return health status structure', async () => {
      const health = await gateway.healthCheck();
      
      expect(health).toHaveProperty('echo');
      expect(health).toHaveProperty('riskcontrol');
      expect(health).toHaveProperty('timestamp');
      
      expect(health.echo).toHaveProperty('available');
      expect(health.echo).toHaveProperty('lastCheck');
      expect(health.riskcontrol).toHaveProperty('available');
      expect(health.riskcontrol).toHaveProperty('lastCheck');
    });

    it('should cache health status', async () => {
      await gateway.healthCheck();
      const cached = gateway.getCachedHealth();
      
      expect(cached).not.toBeNull();
      expect(cached?.timestamp).toBeInstanceOf(Date);
    });
  });
});

// ============================================
// GatewayError 测试
// ============================================

describe('GatewayError', () => {
  it('should create error with correct properties', () => {
    const error = new GatewayError('ROUTE_NOT_FOUND', 'Route not found', 404);
    
    expect(error.code).toBe('ROUTE_NOT_FOUND');
    expect(error.message).toBe('Route not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('GatewayError');
  });

  it('should use default status code', () => {
    const error = new GatewayError('PROXY_ERROR', 'Proxy failed');
    expect(error.statusCode).toBe(500);
  });
});
